from __future__ import annotations

from pathlib import Path
from typing import Any

import pandas as pd


def _table_grid(cells: list[dict[str, Any]]) -> list[list[str]]:
    if not cells:
        return []
    max_row = max(c["row"] for c in cells) + 1
    max_col = max(c["col"] for c in cells) + 1
    grid = [[""] * max_col for _ in range(max_row)]
    for cell in cells:
        r, c = cell["row"], cell["col"]
        if 0 <= r < max_row and 0 <= c < max_col:
            grid[r][c] = cell.get("text", "")
    return grid


def build_csv_export(table_results: list[dict[str, Any]], output_path: Path) -> Path:
    rows: list[dict[str, Any]] = []
    for result in table_results:
        cells = result.get("cells", [])
        if not cells:
            continue
        grid = _table_grid(cells)
        for row_data in grid:
            rows.append(
                {
                    "page": result.get("page_num", 0),
                    "table_index": result.get("table_index", 0),
                    "detection_confidence": round(
                        result.get("detection_confidence", 1.0), 4
                    ),
                    **{f"col_{i}": v for i, v in enumerate(row_data)},
                }
            )

    if rows:
        pd.DataFrame(rows).to_csv(str(output_path), index=False, encoding="utf-8")
    else:
        output_path.write_text("page,table_index,detection_confidence\n", encoding="utf-8")
    return output_path


def _sanitize_sheet_name(name: str) -> str:
    invalid = set("[]:*?/\\")
    cleaned = "".join(ch if ch not in invalid else "_" for ch in name)
    cleaned = cleaned.strip() or "Table"
    return cleaned[:31]


def _next_sheet_name(base_name: str, used: set[str]) -> str:
    candidate = base_name
    suffix = 2
    while candidate in used:
        suffix_str = f"_{suffix}"
        candidate = f"{base_name[: 31 - len(suffix_str)]}{suffix_str}"
        suffix += 1
    used.add(candidate)
    return candidate


def build_xlsx_export(table_results: list[dict[str, Any]], output_path: Path) -> Path:
    with pd.ExcelWriter(str(output_path), engine="openpyxl") as writer:
        used_sheet_names: set[str] = set()
        wrote_sheet = False

        for result in table_results:
            cells = result.get("cells", [])
            if not cells:
                continue

            grid = _table_grid(cells)
            df = pd.DataFrame(
                grid, columns=[f"col_{idx}" for idx in range(len(grid[0]))]
            )
            base_name = _sanitize_sheet_name(
                f"Page_{result.get('page_num', 0)}_Table_{result.get('table_index', 0)}"
            )
            sheet_name = _next_sheet_name(base_name, used_sheet_names)
            df.to_excel(writer, sheet_name=sheet_name, index=False)
            wrote_sheet = True

        if not wrote_sheet:
            pd.DataFrame(columns=["info"]).to_excel(
                writer, sheet_name="Table_1", index=False
            )

    return output_path
