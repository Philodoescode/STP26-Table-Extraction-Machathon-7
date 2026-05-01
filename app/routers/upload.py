import logging
import os
import shutil
import time
import uuid
import asyncio
from datetime import datetime, timezone
from pathlib import Path

import aiofiles
import filetype
from fastapi import APIRouter, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
import json

from app.config import get_settings
from app.database import get_db
from app.services.csv_builder import build_csv
from app.services.modal_dispatch import run_document_processing
from app.services.modal_logging import modal_input_label
from app.services.modal_volume import commit_storage_async
from app.services.storage_service import ALLOWED_MIMES, job_dir, new_job_id

router = APIRouter(prefix="/api/v1")
logger = logging.getLogger(__name__)

_MAX_HEADER = 16  # bytes for magic-byte validation


def _sse_event(payload: dict) -> bytes:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n".encode("utf-8")


async def _process_upload(
    file: UploadFile,
    progress_cb=None,
) -> dict:
    async def _emit(payload: dict) -> None:
        if progress_cb is None:
            return
        result = progress_cb(payload)
        if asyncio.iscoroutine(result):
            await result

    settings = get_settings()
    on_modal = os.getenv("DISPATCH_MODE") == "modal"

    # Read the full file once so we can validate and (on Modal) pass as bytes.
    file_bytes = await file.read()

    # Magic-byte validation
    kind = filetype.guess(file_bytes[:_MAX_HEADER])
    mime = kind.mime if kind else (file.content_type or "")
    if mime not in ALLOWED_MIMES:
        raise HTTPException(
            status_code=422,
            detail={"detail": "Unsupported or corrupt file type", "code": "CORRUPT_FILE"},
        )

    # Size check
    max_bytes = settings.max_file_size_mb * 1024 * 1024
    if len(file_bytes) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail={"detail": f"File exceeds {settings.max_file_size_mb} MB limit", "code": "FILE_TOO_LARGE"},
        )

    job_id = new_job_id()
    suffix = Path(file.filename or "upload").suffix.lower()
    # Store the logical path; on Modal the TableExtractor writes it to this location.
    file_path = str(Path(settings.storage_path) / job_id / f"original{suffix}")

    if not on_modal:
        # Local mode: write file to disk so the job-queue thread can read it.
        dest = Path(file_path)
        dest.parent.mkdir(parents=True, exist_ok=True)
        async with aiofiles.open(dest, "wb") as out:
            await out.write(file_bytes)

    filename = file.filename or "upload"
    created_at = datetime.now(timezone.utc).isoformat()
    started_at = created_at
    run_started = time.perf_counter()
    await _emit({
        "type": "progress",
        "status": "processing",
        "stage": "queued",
        "progress": 5,
        "job_id": job_id,
    })

    loop = asyncio.get_running_loop()

    def _local_stage_progress(**kwargs):
        if progress_cb is None:
            return
        payload = {
            "type": "progress",
            "status": "processing",
            "stage": kwargs.get("stage"),
            "progress": int(kwargs.get("progress", 0)),
            "job_id": job_id,
        }
        asyncio.run_coroutine_threadsafe(_emit(payload), loop)

    try:
        await _emit({
            "type": "progress",
            "status": "processing",
            "stage": "gpu_processing",
            "progress": 20,
            "job_id": job_id,
        })
        payload = await run_document_processing(
            job_id, file_path,
            file_bytes=file_bytes,
            suffix=suffix,
            progress_cb=_local_stage_progress,
        )
    except Exception as exc:
        logger.exception(
            "%s processing_failed job_id=%s filename=%s",
            modal_input_label(), job_id, filename,
        )
        finished_at = datetime.now(timezone.utc).isoformat()
        with get_db() as conn:
            conn.execute(
                """
                INSERT INTO jobs
                    (id, filename, file_path, status, stage, progress, error,
                     created_at, started_at, finished_at, latency_ms)
                VALUES (?, ?, ?, 'failed', 'failed', 100, ?, ?, ?, ?, ?)
                """,
                [
                    job_id,
                    filename,
                    file_path,
                    str(exc),
                    created_at,
                    started_at,
                    finished_at,
                    int((time.perf_counter() - run_started) * 1000),
                ],
            )
        if on_modal:
            try:
                await commit_storage_async(strict=True)
            except Exception:
                logger.warning("%s cleanup_commit_failed job_id=%s", modal_input_label(), job_id)
        if not on_modal:
            shutil.rmtree(job_dir(job_id), ignore_errors=True)
        await _emit({
            "type": "progress",
            "status": "failed",
            "stage": "failed",
            "progress": 100,
            "job_id": job_id,
            "error": str(exc),
        })
        raise HTTPException(
            status_code=500,
            detail={"detail": "Processing job failed", "code": "PROCESSING_ERROR"},
        ) from exc

    table_results = payload.get("table_results", []) if isinstance(payload, dict) else []
    latency_ms = payload.get("latency_ms") if isinstance(payload, dict) else None
    if latency_ms is None:
        latency_ms = int((time.perf_counter() - run_started) * 1000)
    finished_at = datetime.now(timezone.utc).isoformat()
    await _emit({
        "type": "progress",
        "status": "processing",
        "stage": "storing",
        "progress": 85,
        "job_id": job_id,
    })

    tables_payload: list[dict] = []
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO jobs
                (id, filename, file_path, status, stage, progress, created_at, started_at, finished_at, latency_ms)
            VALUES (?, ?, ?, 'done', 'done', 100, ?, ?, ?, ?)
            """,
            [job_id, filename, file_path, created_at, started_at, finished_at, latency_ms],
        )
        for result in table_results:
            table_id = str(uuid.uuid4())
            table_index = int(result.get("table_index", 0))
            page_num = int(result.get("page_num", 0))
            stem = result.get("stem", f"page_{page_num + 1:02d}")
            crop = str(job_dir(job_id) / "crops" / stem / f"table_{table_index:02d}.png")
            bbox = result.get("bbox")
            detection_confidence = float(result.get("detection_confidence", 1.0))
            cells = result.get("cells", [])

            conn.execute(
                """
                INSERT INTO table_results
                    (id, job_id, page_num, table_index, bbox, detection_confidence, crop_path, ocr_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    table_id,
                    job_id,
                    page_num,
                    table_index,
                    json.dumps(bbox),
                    detection_confidence,
                    crop,
                    json.dumps({"cells": cells}),
                ],
            )
            tables_payload.append(
                {
                    "id": table_id,
                    "job_id": job_id,
                    "page_num": page_num,
                    "table_index": table_index,
                    "bbox": bbox,
                    "detection_confidence": detection_confidence,
                    "crop_url": f"/api/v1/jobs/{job_id}/tables/{table_id}/crop",
                }
            )

    out_dir = job_dir(job_id)
    out_dir.mkdir(parents=True, exist_ok=True)
    build_csv(job_id, table_results, out_dir)

    if on_modal:
        try:
            await commit_storage_async(strict=True)
        except Exception as exc:
            raise HTTPException(
                status_code=503,
                detail={"detail": "Failed to persist processing output", "code": "STORAGE_COMMIT_ERROR"},
            ) from exc

    logger.info(
        "%s upload_completed job_id=%s filename=%s table_count=%s latency_ms=%s",
        modal_input_label(),
        job_id,
        filename,
        len(tables_payload),
        latency_ms,
    )
    result = {
        "job_id": job_id,
        "filename": filename,
        "status": "done",
        "stage": "done",
        "progress": 100,
        "error": None,
        "created_at": created_at,
        "started_at": started_at,
        "finished_at": finished_at,
        "latency_ms": latency_ms,
        "tables": tables_payload,
    }
    await _emit({
        "type": "progress",
        "status": "done",
        "stage": "done",
        "progress": 100,
        "job_id": job_id,
    })
    return result


@router.post("/upload")
async def upload_file(file: UploadFile):
    return await _process_upload(file)


@router.post("/upload/stream")
async def upload_file_stream(file: UploadFile):
    queue: asyncio.Queue[dict] = asyncio.Queue()

    async def _progress_cb(payload: dict) -> None:
        await queue.put(payload)

    async def _runner() -> None:
        try:
            result = await _process_upload(file, progress_cb=_progress_cb)
            await queue.put({"type": "done", "job": result})
        except HTTPException as exc:
            await queue.put(
                {
                    "type": "error",
                    "status_code": exc.status_code,
                    "detail": exc.detail,
                }
            )
        except Exception as exc:  # defensive fallback
            await queue.put(
                {
                    "type": "error",
                    "status_code": 500,
                    "detail": {"detail": str(exc), "code": "STREAM_ERROR"},
                }
            )
        finally:
            await queue.put({"type": "eof"})

    task = asyncio.create_task(_runner())

    async def _event_stream():
        try:
            while True:
                payload = await queue.get()
                if payload.get("type") == "eof":
                    break
                yield _sse_event(payload)
        finally:
            if not task.done():
                task.cancel()

    return StreamingResponse(
        _event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
