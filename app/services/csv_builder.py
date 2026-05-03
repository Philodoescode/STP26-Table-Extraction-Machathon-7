from pathlib import Path
from typing import Any

import pandas as pd


def build_csv(job_id: str, table_results: list[dict[str, Any]], job_dir: Path) -> Path:
    rows: list[dict] = []

    for result in table_results:
        cells = result.get("cells", [])
        if not cells:
            continue

        max_row = max(c["row"] for c in cells) + 1
        max_col = max(c["col"] for c in cells) + 1
        grid = [[""] * max_col for _ in range(max_row)]

        for cell in cells:
            r, c = cell["row"], cell["col"]
            if 0 <= r < max_row and 0 <= c < max_col:
                grid[r][c] = cell.get("text", "")

        for row_data in grid:
            rows.append({
                "page": result.get("page_num", 0),
                "table_index": result.get("table_index", 0),
                "detection_confidence": round(result.get("detection_confidence", 1.0), 4),
                **{f"col_{i}": v for i, v in enumerate(row_data)},
            })

    output_path = job_dir / "output.csv"
    if rows:
        pd.DataFrame(rows).to_csv(str(output_path), index=False, encoding="utf-8")
    else:
        output_path.write_text("page,table_index,detection_confidence\n", encoding="utf-8")

    return output_path
