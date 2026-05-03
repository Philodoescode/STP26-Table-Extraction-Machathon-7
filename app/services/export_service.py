"""
Service layer for idempotent export with user-override merging.

Handles the business logic for:
- POST /api/v1/jobs/{job_id}/export
"""

from __future__ import annotations

import hashlib
import json
import sqlite3
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException

from app.schemas.table import ExportResponse
from app.services.export_builder import build_csv_export, build_xlsx_export
from app.services.storage_service import output_export_path

SUPPORTED_EXPORT_FORMATS = {"csv", "xlsx"}


def normalize_export_format(export_format: str) -> str:
    normalized = (export_format or "csv").lower()
    if normalized == "xslx":
        normalized = "xlsx"
    if normalized not in SUPPORTED_EXPORT_FORMATS:
        raise HTTPException(
            status_code=422,
            detail={
                "detail": (
                    f"Unsupported export format '{export_format}'. "
                    "Supported formats are: csv, xlsx."
                ),
                "code": "INVALID_EXPORT_FORMAT",
            },
        )
    return normalized


def _get_done_job_or_error(conn: sqlite3.Connection, job_id: str):
    """Ensure the job exists and is in 'done' status."""
    row = conn.execute("SELECT * FROM jobs WHERE id = ?", [job_id]).fetchone()
    if row is None:
        raise HTTPException(
            status_code=404,
            detail={"detail": "Job not found", "code": "NOT_FOUND"},
        )
    if row["status"] != "done":
        raise HTTPException(
            status_code=409,
            detail={
                "detail": f"Job is not done yet (status: {row['status']})",
                "code": "JOB_NOT_DONE",
            },
        )
    return row


def _merge_tables_with_overrides(
    conn: sqlite3.Connection,
    job_id: str,
) -> list[dict[str, Any]]:
    """
    Load all table_results for a job, overlay any cell_overrides, and
    return a list of table dicts compatible with export builders.
    """
    table_rows = conn.execute(
        "SELECT * FROM table_results WHERE job_id = ? "
        "ORDER BY page_num, table_index",
        [job_id],
    ).fetchall()

    # Pre-load all overrides for this job keyed by (table_id, row, col)
    override_rows = conn.execute(
        "SELECT table_id, row_index, col_index, override_text "
        "FROM cell_overrides WHERE job_id = ?",
        [job_id],
    ).fetchall()

    overrides: dict[str, dict[tuple[int, int], str]] = {}
    for ov in override_rows:
        tid = ov["table_id"]
        overrides.setdefault(tid, {})[(ov["row_index"], ov["col_index"])] = ov[
            "override_text"
        ]

    merged: list[dict[str, Any]] = []
    for tr in table_rows:
        ocr_json = tr["ocr_json"]
        cells: list[dict] = []
        if ocr_json:
            cells = json.loads(ocr_json).get("cells", [])

        tid = tr["id"]
        table_overrides = overrides.get(tid, {})

        # Apply overrides in-place
        for cell in cells:
            key = (cell.get("row", 0), cell.get("col", 0))
            if key in table_overrides:
                cell["text"] = table_overrides[key]

        merged.append(
            {
                "page_num": tr["page_num"],
                "table_index": tr["table_index"],
                "detection_confidence": tr["detection_confidence"],
                "cells": cells,
            }
        )

    return merged


def _compute_data_hash(merged: list[dict[str, Any]]) -> str:
    """Deterministic SHA-256 of the merged cell data for cache invalidation."""
    serialized = json.dumps(merged, sort_keys=True, ensure_ascii=True)
    return hashlib.sha256(serialized.encode()).hexdigest()


def _build_export_file(
    job_id: str,
    merged: list[dict[str, Any]],
    export_format: str,
):
    output_path = output_export_path(job_id, export_format)
    if export_format == "csv":
        return build_csv_export(merged, output_path)
    return build_xlsx_export(merged, output_path)


def export_job(
    conn: sqlite3.Connection,
    job_id: str,
    export_format: str = "csv",
) -> ExportResponse:
    """
    Build (or return cached) export for a completed job.

    Merging priority: user overrides > raw OCR data.
    Idempotency: if merged data hash matches the stored export, the
    existing download URL is returned without regenerating the file.
    """
    export_format = normalize_export_format(export_format)
    _get_done_job_or_error(conn, job_id)

    merged = _merge_tables_with_overrides(conn, job_id)
    data_hash = _compute_data_hash(merged)
    download_url = f"/api/v1/jobs/{job_id}/{export_format}"
    output_path = output_export_path(job_id, export_format)

    # Check for existing export with matching hash
    existing = conn.execute(
        "SELECT data_hash FROM exports WHERE job_id = ?",
        [job_id],
    ).fetchone()

    if existing and existing["data_hash"] == data_hash:
        if output_path.exists():
            return ExportResponse(
                job_id=job_id,
                download_url=download_url,
                cached=True,
            )

    # Build new export file
    try:
        output_path = _build_export_file(job_id, merged, export_format)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={
                "detail": f"Export generation failed: {exc}",
                "code": "EXPORT_FAILED",
            },
        )

    # Upsert export record
    conn.execute(
        """
        INSERT OR REPLACE INTO exports
            (job_id, csv_path, data_hash, created_at, download_url)
        VALUES (?, ?, ?, ?, ?)
        """,
        [job_id, str(output_path), data_hash,
         datetime.now(timezone.utc).isoformat(), download_url],
    )

    return ExportResponse(
        job_id=job_id,
        download_url=download_url,
        cached=False,
    )
