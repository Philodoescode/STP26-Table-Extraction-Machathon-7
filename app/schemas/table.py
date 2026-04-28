"""
Pydantic models for table-related endpoints (preview, edit, export).
"""

from typing import Optional

from pydantic import BaseModel, Field


class TableResponse(BaseModel):
    """Summary of a detected table (used in GET /tables listing)."""

    id: str
    job_id: str
    page_num: int
    table_index: int
    bbox: Optional[list[int]] = None
    detection_confidence: float
    crop_url: str


class CellData(BaseModel):
    """Full cell record stored alongside OCR JSON."""

    row: int
    col: int
    text: str
    bbox: Optional[list[int]] = None
    rowspan: int = 1
    colspan: int = 1
    confidence: float = 1.0
    flagged: bool = False
    user_edit: Optional[str] = None


# ── Preview endpoints ────────────────────────────────────────────────────────


class CellPreview(BaseModel):
    """Single cell in the structured preview grid."""

    text: str
    confidence: float = 1.0
    bbox: Optional[list[int]] = None


class PreviewResponse(BaseModel):
    """GET /jobs/{job_id}/tables/{table_id}/preview response."""

    rows: list[list[CellPreview]]


class CellOverrideItem(BaseModel):
    """One cell edit inside a PUT /preview request."""

    row: int = Field(ge=0)
    col: int = Field(ge=0)
    text: str


class PreviewUpdateRequest(BaseModel):
    """PUT /jobs/{job_id}/tables/{table_id}/preview request body."""

    cells: list[CellOverrideItem] = Field(min_length=1)


class PreviewUpdateResponse(BaseModel):
    """PUT /preview response confirming saved overrides."""

    overrides_saved: int
    table_id: str


# ── Export endpoint ──────────────────────────────────────────────────────────


class ExportResponse(BaseModel):
    """POST /jobs/{job_id}/export response."""

    job_id: str
    download_url: str
    cached: bool

