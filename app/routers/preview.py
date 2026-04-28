"""
Routes for table preview, user overrides, and CSV export.

GET  /api/v1/jobs/{job_id}/tables/{table_id}/preview
PUT  /api/v1/jobs/{job_id}/tables/{table_id}/preview
POST /api/v1/jobs/{job_id}/export
"""

from fastapi import APIRouter

from app.database import get_db
from app.schemas.table import (
    ExportResponse,
    PreviewResponse,
    PreviewUpdateRequest,
    PreviewUpdateResponse,
)
from app.services.export_service import export_job
from app.services.preview_service import get_table_preview, save_overrides

router = APIRouter(prefix="/api/v1")


@router.get(
    "/jobs/{job_id}/tables/{table_id}/preview",
    response_model=PreviewResponse,
    summary="Fetch raw OCR result with user overrides applied",
    responses={404: {"description": "Job or table not found"}},
)
def preview_table(job_id: str, table_id: str):
    """
    Return the structured OCR preview grid for a single table.

    Each cell contains ``text``, ``confidence``, and ``bbox``.
    If the user has previously submitted overrides, they are merged
    on top of the raw OCR data.
    """
    with get_db() as conn:
        return get_table_preview(conn, job_id, table_id)


@router.put(
    "/jobs/{job_id}/tables/{table_id}/preview",
    response_model=PreviewUpdateResponse,
    summary="Submit user-edited cell data",
    responses={
        404: {"description": "Job or table not found"},
        422: {"description": "Invalid edit payload"},
    },
)
def update_preview(job_id: str, table_id: str, body: PreviewUpdateRequest):
    """
    Accept user corrections for individual cells and store them as
    overrides.  This does **not** trigger a re-run of the OCR engine;
    the raw OCR data remains untouched.
    """
    with get_db() as conn:
        return save_overrides(conn, job_id, table_id, body.cells)


@router.post(
    "/jobs/{job_id}/export",
    response_model=ExportResponse,
    summary="Build or retrieve the final CSV",
    responses={
        404: {"description": "Job not found"},
        409: {"description": "Job processing not complete"},
        500: {"description": "Export generation failed"},
    },
)
def export(job_id: str):
    """
    Trigger the final CSV build, merging raw OCR data with any user
    overrides.

    **Idempotent**: if the data has not changed since the last export,
    the existing download URL is returned with ``cached: true``.
    """
    with get_db() as conn:
        return export_job(conn, job_id)
