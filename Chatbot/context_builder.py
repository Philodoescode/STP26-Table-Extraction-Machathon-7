"""
context_builder.py — Converts table pipeline output (stored in the main
app's SQLite database) into structured Markdown tables for LLM context.

Usage:
    from context_builder import get_job_context_markdown
    markdown = get_job_context_markdown(job_id)
"""
from __future__ import annotations

import json
import os
import sqlite3
from pathlib import Path
from typing import Optional


# ── DB connection ─────────────────────────────────────────────────────────────

def _get_db_path() -> Path:
    """Resolve the database path.

    Looks up DATABASE_PATH env var first (so you can override in .env),
    then falls back to the main app's default location relative to this file.
    """
    env_path = os.getenv("DATABASE_PATH")
    if env_path:
        return Path(env_path)
    # Default: navigate up from Chatbot/ to project root, then storage/jobs.db
    project_root = Path(__file__).parent.parent
    return project_root / "storage" / "jobs.db"


def _open_db() -> sqlite3.Connection:
    db_path = _get_db_path()
    if not db_path.exists():
        raise FileNotFoundError(f"Database not found at {db_path}")
    conn = sqlite3.connect(str(db_path), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


# ── Markdown conversion ───────────────────────────────────────────────────────

def _cells_to_grid(cells: list[dict]) -> list[list[str]]:
    """Rebuild a 2-D row-major grid from the flat cell list stored in ocr_json."""
    if not cells:
        return []

    max_row = max(c.get("row", 0) for c in cells) + 1
    max_col = max(c.get("col", 0) for c in cells) + 1

    grid: list[list[str]] = [[""] * max_col for _ in range(max_row)]

    for cell in cells:
        r = cell.get("row", 0)
        c = cell.get("col", 0)
        if 0 <= r < max_row and 0 <= c < max_col:
            grid[r][c] = (cell.get("text") or "").strip()

    return grid


def _grid_to_markdown(grid: list[list[str]], table_label: str) -> str:
    """Convert a 2-D grid into a GFM (GitHub Flavoured Markdown) table string."""
    if not grid:
        return f"*{table_label}: (empty table)*\n"

    # Escape pipe characters inside cells so they don't break the MD table
    def _esc(s: str) -> str:
        return s.replace("|", "\\|").replace("\n", " ")

    header = grid[0]
    rows = grid[1:]

    # Column widths for padding (purely cosmetic — LLMs don't need it, but nice for debugging)
    col_widths = [max(len(_esc(header[c])), 3) for c in range(len(header))]
    for row in rows:
        for c, cell in enumerate(row):
            if c < len(col_widths):
                col_widths[c] = max(col_widths[c], len(_esc(cell)))

    def _fmt_row(cells: list[str]) -> str:
        padded = []
        for c, cell in enumerate(cells):
            w = col_widths[c] if c < len(col_widths) else len(_esc(cell))
            padded.append(_esc(cell).ljust(w))
        return "| " + " | ".join(padded) + " |"

    sep_parts = ["-" * w for w in col_widths]
    separator = "| " + " | ".join(sep_parts) + " |"

    lines = [
        f"**{table_label}**",
        "",
        _fmt_row(header),
        separator,
    ]
    for row in rows:
        # Pad short rows with empty strings
        padded_row = row + [""] * max(0, len(header) - len(row))
        lines.append(_fmt_row(padded_row))

    return "\n".join(lines) + "\n"


def _apply_overrides(
    conn: sqlite3.Connection,
    job_id: str,
    table_id: str,
    grid: list[list[str]],
) -> list[list[str]]:
    """Overlay any user-submitted cell edits on top of the OCR grid."""
    overrides = conn.execute(
        "SELECT row_index, col_index, override_text FROM cell_overrides "
        "WHERE table_id = ? AND job_id = ?",
        [table_id, job_id],
    ).fetchall()

    for ov in overrides:
        r, c = ov["row_index"], ov["col_index"]
        if 0 <= r < len(grid) and 0 <= c < len(grid[r]):
            grid[r][c] = (ov["override_text"] or "").strip()

    return grid


# ── Public API ────────────────────────────────────────────────────────────────

def get_job_context_markdown(job_id: str) -> Optional[str]:
    """
    Fetch all tables for *job_id*, convert them to Markdown, and return a
    context block ready to be injected into the LLM system prompt.

    Returns ``None`` if the job does not exist or has no tables yet.
    """
    try:
        conn = _open_db()
    except FileNotFoundError:
        return None

    try:
        # Confirm job exists and is done
        job_row = conn.execute(
            "SELECT status, filename FROM jobs WHERE id = ?", [job_id]
        ).fetchone()
        if job_row is None:
            return None

        filename = job_row["filename"] or "document"
        status = job_row["status"]
        if status != "done":
            return None

        # Fetch all table rows for this job, ordered by page then index
        table_rows = conn.execute(
            """
            SELECT id, page_num, table_index, ocr_json
            FROM   table_results
            WHERE  job_id = ?
            ORDER  BY page_num, table_index
            """,
            [job_id],
        ).fetchall()

        if not table_rows:
            return None

        sections: list[str] = [
            f"# Extracted Tables from: {filename}",
            "",
            "The following tables were extracted from the uploaded document. "
            "Use them as the primary source of truth when answering the user's questions.",
            "",
        ]

        for t_row in table_rows:
            table_id: str = t_row["id"]
            page_num: int = (t_row["page_num"] or 0) + 1      # 1-indexed for humans
            table_idx: int = (t_row["table_index"] or 0) + 1  # 1-indexed for humans
            label = f"Page {page_num} — Table {table_idx}"

            ocr_json = t_row["ocr_json"]
            cells: list[dict] = []
            if ocr_json:
                parsed = json.loads(ocr_json)
                cells = parsed.get("cells", [])

            grid = _cells_to_grid(cells)
            grid = _apply_overrides(conn, job_id, table_id, grid)

            sections.append(_grid_to_markdown(grid, label))
            sections.append("")

        return "\n".join(sections)

    finally:
        conn.close()