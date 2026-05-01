import json
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.database import get_db
from app.schemas.job import JobResponse
from app.schemas.table import TableResponse
from app.services.api_retry import run_with_read_retries
from app.services.export_service import normalize_export_format
from app.services.modal_volume import reload_storage
from app.services.storage_service import output_export_path

router = APIRouter(prefix="/api/v1")


def _row_to_job(row) -> JobResponse:
    return JobResponse(
        job_id=row["id"],
        filename=row["filename"],
        status=row["status"],
        stage=row["stage"],
        progress=row["progress"] or 0,
        error=row["error"],
        created_at=row["created_at"],
        started_at=row["started_at"],
        finished_at=row["finished_at"],
        latency_ms=row["latency_ms"],
    )


def _get_job_or_404(conn, job_id: str):
    row = conn.execute("SELECT * FROM jobs WHERE id = ?", [job_id]).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail={"detail": "Job not found", "code": "NOT_FOUND"})
    return row


# GET /api/v1/jobs/{job_id}
@router.get("/jobs/{job_id}", response_model=JobResponse)
def get_job(job_id: str):
    def _read() -> JobResponse:
        with get_db() as conn:
            row = _get_job_or_404(conn, job_id)
            return _row_to_job(row)

    return run_with_read_retries(_read, reload_before_attempt=reload_storage)


# GET /api/v1/jobs/{job_id}/tables
@router.get("/jobs/{job_id}/tables", response_model=list[TableResponse])
def list_tables(job_id: str):
    def _read() -> list[TableResponse]:
        with get_db() as conn:
            _get_job_or_404(conn, job_id)
            rows = conn.execute(
                "SELECT * FROM table_results WHERE job_id = ? ORDER BY page_num, table_index",
                [job_id],
            ).fetchall()

        return [
            TableResponse(
                id=r["id"],
                job_id=job_id,
                page_num=r["page_num"],
                table_index=r["table_index"],
                bbox=json.loads(r["bbox"]) if r["bbox"] else None,
                detection_confidence=r["detection_confidence"],
                crop_url=f"/api/v1/jobs/{job_id}/tables/{r['id']}/crop",
            )
            for r in rows
        ]

    return run_with_read_retries(_read, reload_before_attempt=reload_storage)


# GET /api/v1/jobs/{job_id}/tables/{table_id}/crop
@router.get("/jobs/{job_id}/tables/{table_id}/crop")
def get_crop(job_id: str, table_id: str):
    def _read() -> FileResponse:
        with get_db() as conn:
            _get_job_or_404(conn, job_id)
            row = conn.execute(
                "SELECT crop_path FROM table_results WHERE id = ? AND job_id = ?",
                [table_id, job_id],
            ).fetchone()

        if row is None:
            raise HTTPException(status_code=404, detail={"detail": "Table not found", "code": "NOT_FOUND"})

        crop = Path(row["crop_path"])
        if not crop.exists():
            raise HTTPException(status_code=404, detail={"detail": "Crop image missing", "code": "FILE_MISSING"})

        return FileResponse(
            str(crop),
            media_type="image/jpeg",
            headers={"Content-Disposition": f'inline; filename="{crop.name}"'},
        )

    return run_with_read_retries(_read, reload_before_attempt=reload_storage)


def _download_export(job_id: str, export_format: str):
    def _read() -> FileResponse:
        with get_db() as conn:
            row = _get_job_or_404(conn, job_id)
            if row["status"] != "done":
                raise HTTPException(
                    status_code=409,
                    detail={"detail": f"Job is not done yet (status: {row['status']})", "code": "JOB_NOT_DONE"},
                )

        normalized_format = normalize_export_format(export_format)
        export_path = output_export_path(job_id, normalized_format)
        if not export_path.exists():
            raise HTTPException(
                status_code=404,
                detail={
                    "detail": f"{normalized_format.upper()} not found",
                    "code": "FILE_MISSING",
                },
            )

        media_type = (
            "text/csv"
            if normalized_format == "csv"
            else "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        filename = f"tables_{job_id}.{normalized_format}"

        return FileResponse(
            str(export_path),
            media_type=media_type,
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    return run_with_read_retries(_read, reload_before_attempt=reload_storage)


# GET /api/v1/jobs/{job_id}/csv
@router.get("/jobs/{job_id}/csv")
def download_csv(job_id: str):
    return _download_export(job_id, "csv")


# GET /api/v1/jobs/{job_id}/xlsx
@router.get("/jobs/{job_id}/xlsx")
def download_xlsx(job_id: str):
    return _download_export(job_id, "xlsx")


# GET /api/v1/jobs/{job_id}/xslx (typo alias for compatibility)
@router.get("/jobs/{job_id}/xslx")
def download_xslx_alias(job_id: str):
    return _download_export(job_id, "xslx")
