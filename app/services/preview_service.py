"""
Service layer for table preview retrieval and user override persistence.

Handles the business logic for:
- GET  /api/v1/jobs/{job_id}/tables/{table_id}/preview
- PUT  /api/v1/jobs/{job_id}/tables/{table_id}/preview
"""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone

from fastapi import HTTPException

from app.schemas.table import (
    CellOverrideItem,
    CellPreview,
    PreviewResponse,
    PreviewUpdateResponse,
)


def _get_table_row(conn: sqlite3.Connection, job_id: str, table_id: str):
    """Fetch the table_results row, raising 404 if job or table is missing."""
    job = conn.execute("SELECT id FROM jobs WHERE id = ?", [job_id]).fetchone()
    if job is None:
        raise HTTPException(
            status_code=404,
            detail={"detail": "Job not found", "code": "NOT_FOUND"},
        )

    row = conn.execute(
        "SELECT * FROM table_results WHERE id = ? AND job_id = ?",
        [table_id, job_id],
    ).fetchone()
    if row is None:
        raise HTTPException(
            status_code=404,
            detail={"detail": "Table not found", "code": "NOT_FOUND"},
        )
    return row


def get_table_preview(
    conn: sqlite3.Connection,
    job_id: str,
    table_id: str,
) -> PreviewResponse:
    """
    Build a structured preview grid from raw OCR JSON, overlaying any
    user overrides stored in the cell_overrides table.

    Returns a row-major grid where each cell contains text, confidence,
    and bbox.
    """
    row = _get_table_row(conn, job_id, table_id)

    # Parse raw OCR cells
    ocr_json = row["ocr_json"]
    cells: list[dict] = []
    if ocr_json:
        parsed = json.loads(ocr_json)
        cells = parsed.get("cells", [])

    if not cells:
        return PreviewResponse(rows=[])

    # Determine grid dimensions
    max_row = max(c.get("row", 0) for c in cells) + 1
    max_col = max(c.get("col", 0) for c in cells) + 1

    # Build the base grid from OCR data
    grid: list[list[CellPreview]] = [
        [CellPreview(text="", confidence=0.0, bbox=None) for _ in range(max_col)]
        for _ in range(max_row)
    ]

    for cell in cells:
        r = cell.get("row", 0)
        c = cell.get("col", 0)
        if 0 <= r < max_row and 0 <= c < max_col:
            grid[r][c] = CellPreview(
                text=cell.get("text", ""),
                confidence=cell.get("confidence", 1.0),
                bbox=cell.get("bbox"),
            )

    # Overlay user overrides
    overrides = conn.execute(
        "SELECT row_index, col_index, override_text FROM cell_overrides "
        "WHERE table_id = ? AND job_id = ?",
        [table_id, job_id],
    ).fetchall()

    for ov in overrides:
        r, c = ov["row_index"], ov["col_index"]
        if 0 <= r < max_row and 0 <= c < max_col:
            existing = grid[r][c]
            grid[r][c] = CellPreview(
                text=ov["override_text"],
                confidence=existing.confidence,
                bbox=existing.bbox,
            )

    return PreviewResponse(rows=grid)


def save_overrides(
    conn: sqlite3.Connection,
    job_id: str,
    table_id: str,
    cells: list[CellOverrideItem],
) -> PreviewUpdateResponse:
    """
    Persist user cell edits as overrides without modifying the raw OCR data.
    Uses INSERT OR REPLACE to upsert on (table_id, row_index, col_index).
    """
    row = _get_table_row(conn, job_id, table_id)

    # Parse existing OCR data to capture original text
    ocr_json = row["ocr_json"]
    original_lookup: dict[tuple[int, int], str] = {}
    if ocr_json:
        parsed = json.loads(ocr_json)
        for cell in parsed.get("cells", []):
            key = (cell.get("row", 0), cell.get("col", 0))
            original_lookup[key] = cell.get("text", "")

    now = datetime.now(timezone.utc).isoformat()
    saved = 0

    for cell in cells:
        original = original_lookup.get((cell.row, cell.col), "")
        conn.execute(
            """
            INSERT OR REPLACE INTO cell_overrides
                (table_id, job_id, row_index, col_index, original_text,
                 override_text, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            [table_id, job_id, cell.row, cell.col, original, cell.text, now],
        )
        saved += 1

    return PreviewUpdateResponse(overrides_saved=saved, table_id=table_id)
