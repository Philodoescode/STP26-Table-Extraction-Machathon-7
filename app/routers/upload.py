from datetime import datetime, timezone

import filetype
from fastapi import APIRouter, BackgroundTasks, HTTPException, UploadFile

from app.database import get_db
from app.services.storage_service import ALLOWED_MIMES, new_job_id, save_upload
from app.workers.tasks import run_process_document

router = APIRouter(prefix="/api/v1")

_MAX_HEADER = 16  # bytes to read for magic-byte check


@router.post("/upload")
async def upload_file(file: UploadFile, background_tasks: BackgroundTasks):
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
            INSERT INTO jobs (id, filename, file_path, status, progress, created_at)
            VALUES (?, ?, ?, 'pending', 0, ?)
            """,
            [job_id, file.filename or "upload", str(saved_path),
             datetime.now(timezone.utc).isoformat()],
        )

    # --- enqueue background task ---
    background_tasks.add_task(run_process_document, job_id, str(saved_path))

    return {"job_id": job_id, "status": "pending"}
