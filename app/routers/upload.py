from datetime import datetime, timezone
import logging
import shutil

import filetype
from fastapi import APIRouter, HTTPException, UploadFile

from app.database import get_db
from app.services.job_queue import JobQueueFullError, get_job_queue
from app.services.modal_logging import modal_input_label
from app.services.storage_service import ALLOWED_MIMES, job_dir, new_job_id, save_upload

router = APIRouter(prefix="/api/v1")
logger = logging.getLogger(__name__)

_MAX_HEADER = 16  # bytes to read for magic-byte check


@router.post("/upload")
async def upload_file(file: UploadFile):
    # --- magic-byte validation ---
    header = await file.read(_MAX_HEADER)
    await file.seek(0)

    kind = filetype.guess(header)
    mime = kind.mime if kind else (file.content_type or "")
    if mime not in ALLOWED_MIMES:
        raise HTTPException(
            status_code=422,
            detail={"detail": "Unsupported or corrupt file type", "code": "CORRUPT_FILE"},
        )

    job_id = new_job_id()

    # --- save to disk ---
    try:
        saved_path = await save_upload(file, job_id)
    except ValueError as exc:
        raise HTTPException(status_code=413, detail={"detail": str(exc), "code": "FILE_TOO_LARGE"})

    # --- create job record ---
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO jobs (id, filename, file_path, status, stage, progress, created_at)
            VALUES (?, ?, ?, 'pending', 'queued', 0, ?)
            """,
            [job_id, file.filename or "upload", str(saved_path),
             datetime.now(timezone.utc).isoformat()],
        )

    # --- enqueue in shared worker queue ---
    try:
        queue_position = get_job_queue().enqueue(job_id, str(saved_path))
    except JobQueueFullError:
        logger.warning(
            "%s upload_queue_full job_id=%s filename=%s",
            modal_input_label(),
            job_id,
            file.filename or "upload",
        )
        with get_db() as conn:
            conn.execute("DELETE FROM jobs WHERE id = ?", [job_id])
        shutil.rmtree(job_dir(job_id), ignore_errors=True)
        raise HTTPException(
            status_code=503,
            detail={"detail": "Server queue is full, retry later", "code": "QUEUE_FULL"},
        )

    logger.info(
        "%s upload_enqueued job_id=%s queue_position=%s filename=%s",
        modal_input_label(),
        job_id,
        queue_position,
        file.filename or "upload",
    )
    return {"job_id": job_id, "status": "pending", "queue_position": queue_position}
