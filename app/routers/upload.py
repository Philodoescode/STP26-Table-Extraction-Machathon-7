import logging
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path

import aiofiles
import filetype
from fastapi import APIRouter, HTTPException, UploadFile

from app.config import get_settings
from app.database import get_db
from app.services.modal_logging import modal_input_label
from app.services.storage_service import ALLOWED_MIMES, job_dir, new_job_id

router = APIRouter(prefix="/api/v1")
logger = logging.getLogger(__name__)

_MAX_HEADER = 16  # bytes for magic-byte validation


@router.post("/upload")
async def upload_file(file: UploadFile):
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

    # Create job record
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO jobs (id, filename, file_path, status, stage, progress, created_at)
            VALUES (?, ?, ?, 'pending', 'queued', 0, ?)
            """,
            [job_id, file.filename or "upload", file_path,
             datetime.now(timezone.utc).isoformat()],
        )

    # Commit the new job row so other WebApp containers can find it when polled.
    from app.services.modal_volume import commit_storage_async
    await commit_storage_async()

    # Dispatch — on Modal passes bytes so TableExtractor writes the file itself,
    # avoiding any cross-container Volume visibility dependency.
    from app.services.modal_dispatch import spawn_document_processing
    try:
        await spawn_document_processing(
            job_id, file_path,
            file_bytes=file_bytes,
            suffix=suffix,
        )
    except Exception as exc:
        logger.exception(
            "%s dispatch_failed job_id=%s filename=%s",
            modal_input_label(), job_id, file.filename or "upload",
        )
        with get_db() as conn:
            conn.execute("DELETE FROM jobs WHERE id = ?", [job_id])
        if not on_modal:
            shutil.rmtree(job_dir(job_id), ignore_errors=True)
        raise HTTPException(
            status_code=503,
            detail={"detail": "Failed to dispatch processing job", "code": "DISPATCH_ERROR"},
        ) from exc

    logger.info(
        "%s upload_dispatched job_id=%s filename=%s",
        modal_input_label(), job_id, file.filename or "upload",
    )
    return {"job_id": job_id, "status": "pending"}
