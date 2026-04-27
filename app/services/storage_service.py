import uuid
from pathlib import Path

import aiofiles
from fastapi import UploadFile

from app.config import get_settings

ALLOWED_MIMES = {"application/pdf", "image/jpeg", "image/png", "image/webp", "image/tiff"}
ALLOWED_SUFFIXES = {".pdf", ".jpg", ".jpeg", ".png", ".webp", ".tiff", ".tif"}


def job_dir(job_id: str) -> Path:
    return Path(get_settings().storage_path) / job_id


def crop_path(job_id: str, page_stem: str, table_index: int) -> Path:
    return job_dir(job_id) / "crops" / page_stem / f"table_{table_index:02d}.png"


def output_csv_path(job_id: str) -> Path:
    return job_dir(job_id) / "output.csv"


async def save_upload(file: UploadFile, job_id: str) -> Path:
    settings = get_settings()
    max_bytes = settings.max_file_size_mb * 1024 * 1024

    suffix = Path(file.filename or "upload").suffix.lower()
    dest_dir = job_dir(job_id)
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / f"original{suffix}"

    total = 0
    async with aiofiles.open(dest, "wb") as out:
        while chunk := await file.read(1024 * 256):
            total += len(chunk)
            if total > max_bytes:
                dest.unlink(missing_ok=True)
                raise ValueError(f"File exceeds {settings.max_file_size_mb} MB limit")
            await out.write(chunk)

    return dest


def new_job_id() -> str:
    return str(uuid.uuid4())
