"""
Full ML pipeline: rasterize → Surya table detection → TDATR structure recognition → store results.

Runs synchronously inside a BackgroundTask thread. Imports heavy ML libraries lazily
so the FastAPI process starts without loading models.
"""
from __future__ import annotations

import json
import math
import re
import threading
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.config import get_settings
from app.database import get_db

# ---------------------------------------------------------------------------
# Lazy Surya model singleton
# ---------------------------------------------------------------------------

_surya_lock = threading.Lock()
_layout_predictor = None


def _get_layout_predictor():
    global _layout_predictor
    if _layout_predictor is not None:
        return _layout_predictor
    with _surya_lock:
        if _layout_predictor is not None:
            return _layout_predictor
        import torch
        from surya.foundation import FoundationPredictor
        from surya.layout import LayoutPredictor

        settings = get_settings()
        device = "cuda" if torch.cuda.is_available() else "cpu"
        foundation = FoundationPredictor(
            checkpoint=settings.surya_layout_model_dir,
            device=device,
        )
        predictor = LayoutPredictor(foundation)
        predictor.disable_tqdm = True
        _layout_predictor = predictor
    return _layout_predictor


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def _norm_bbox(bbox: Any) -> list[int] | None:
    if not isinstance(bbox, (list, tuple)) or len(bbox) != 4:
        return None
    x0, y0, x1, y1 = (float(v) for v in bbox)
    x0, y0 = int(math.floor(x0)), int(math.floor(y0))
    x1, y1 = int(math.ceil(x1)), int(math.ceil(y1))
    return [x0, y0, x1, y1] if x1 > x0 and y1 > y0 else None


def _stem_to_page_num(stem: str) -> int:
    m = re.search(r"(\d+)$", stem)
    return int(m.group(1)) - 1 if m else 0


def _update_job(job_id: str, **kwargs) -> None:
    with get_db() as conn:
        fields, values = [], []
        for k, v in kwargs.items():
            fields.append(f"{k} = ?")
            values.append(v)
        if not fields:
            return
        values.append(job_id)
        conn.execute(f"UPDATE jobs SET {', '.join(fields)} WHERE id = ?", values)


# ---------------------------------------------------------------------------
# Step 1: rasterize
# ---------------------------------------------------------------------------

def _rasterize_pdf(pdf_path: Path, pages_dir: Path) -> list[Path]:
    import pypdfium2 as pdfium
    from PIL import Image

    pages_dir.mkdir(parents=True, exist_ok=True)
    doc = pdfium.PdfDocument(str(pdf_path))
    paths: list[Path] = []
    try:
        for i in range(len(doc)):
            page = doc[i]
            bitmap = page.render(scale=300 / 72)
            img: Image.Image = bitmap.to_pil().convert("RGB")
            if img.width < 1000:
                scale = 1000 / img.width
                img = img.resize((1000, int(img.height * scale)), Image.BICUBIC)
            p = pages_dir / f"page_{i + 1:02d}.png"
            img.save(str(p), "PNG")
            paths.append(p)
    finally:
        doc.close()
    return paths


def _load_image(image_path: Path, pages_dir: Path) -> list[Path]:
    from PIL import Image

    pages_dir.mkdir(parents=True, exist_ok=True)
    with Image.open(str(image_path)) as img:
        img = img.convert("RGB")
        if img.width < 1000:
            scale = 1000 / img.width
            img = img.resize((1000, int(img.height * scale)), Image.BICUBIC)
        p = pages_dir / "page_01.png"
        img.save(str(p), "PNG")
    return [p]


# ---------------------------------------------------------------------------
# Step 2: Surya table detection + crop
# ---------------------------------------------------------------------------

def _detect_and_crop(
    page_paths: list[Path],
    crops_dir: Path,
    threshold: float,
    padding: float,
) -> dict[str, list[dict]]:
    from PIL import Image

    predictor = _get_layout_predictor()
    crops_dir.mkdir(parents=True, exist_ok=True)
    detections_by_stem: dict[str, list[dict]] = {}

    for page_path in page_paths:
        stem = page_path.stem
        out_dir = crops_dir / stem
        out_dir.mkdir(parents=True, exist_ok=True)

        with Image.open(str(page_path)) as img:
            img = img.convert("RGB")
            orig_w, orig_h = img.size

            result = predictor([img], batch_size=1)[0]

            detections: list[dict] = []
            for box in result.bboxes:
                if box.label != "Table":
                    continue
                score = float(box.confidence) if box.confidence is not None else 0.0
                if score < threshold:
                    continue
                x0 = max(0.0, float(box.bbox[0]) - padding)
                y0 = max(0.0, float(box.bbox[1]) - padding)
                x1 = min(float(orig_w), float(box.bbox[2]) + padding)
                y1 = min(float(orig_h), float(box.bbox[3]) + padding)
                if x1 > x0 and y1 > y0:
                    detections.append({"bbox": [x0, y0, x1, y1], "score": score})

            detections.sort(key=lambda d: (d["bbox"][1], d["bbox"][0]))

            crops_meta: list[dict] = []
            for idx, det in enumerate(detections):
                crop = img.crop(det["bbox"])
                crop_name = f"table_{idx:02d}.png"
                crop.save(str(out_dir / crop_name))
                crops_meta.append({
                    "crop_file": crop_name,
                    "score": round(det["score"], 4),
                    "bbox_orig_space": [round(v, 2) for v in det["bbox"]],
                    "crop_size_wh": list(crop.size),
                })

            (out_dir / "config.json").write_text(
                json.dumps({
                    "image_path": str(page_path),
                    "original_size_wh": [orig_w, orig_h],
                    "detector": "surya_layout",
                    "threshold": threshold,
                    "padding": padding,
                    "num_detections": len(crops_meta),
                    "crops": crops_meta,
                }, indent=2),
                encoding="utf-8",
            )
            detections_by_stem[stem] = crops_meta

    return detections_by_stem


# ---------------------------------------------------------------------------
# Step 3: TDATR inference (in-process singleton)
# ---------------------------------------------------------------------------

def _run_tdatr(job_dir: Path, crops_dir: Path) -> list[dict]:
    """Run TDATR structure recognition using the persistent in-process model.

    Returns a list of per-image result dicts (no filesystem round-trip).
    Visualization images and JSON are still saved under ``job_dir/output/``.
    """
    from app.services.tdatr_predictor import _get_tdatr_predictor

    predictor = _get_tdatr_predictor()
    return predictor.infer(crops_dir, output_base_dir=job_dir)


# ---------------------------------------------------------------------------
# Step 3.1: TATR inference (fast mode)
# ---------------------------------------------------------------------------

def _run_tatr(job_dir: Path, crops_dir: Path) -> list[dict]:
    """Run TATR structure recognition using the persistent in-process model."""
    from app.services.tatr_predictor import _get_tatr_predictor

    predictor = _get_tatr_predictor()
    return predictor.infer(crops_dir, output_base_dir=job_dir)


# ---------------------------------------------------------------------------
# Step 4: parse TDATR output → normalized cell dicts
# ---------------------------------------------------------------------------

_HTML_TAG = re.compile(r"<[^>]+>")
_WS = re.compile(r"\s+")


def _clean_text(text: str) -> str:
    return _WS.sub(" ", _HTML_TAG.sub(" ", text or "")).strip()


def _parse_tdatr_output(
    tdatr_results: list[dict],
    detections_by_stem: dict[str, list[dict]],
) -> list[dict]:
    """Convert in-memory TDATR result dicts to the normalized format
    expected by ``_store_results``.

    ``tdatr_results`` is the list returned by ``TDATRPredictor.infer()``.
    Each entry has an ``image_path`` and a ``tables`` list.
    """
    results: list[dict] = []

    for payload in tdatr_results:
        stem = Path(payload.get("image_path", "")).stem
        surya = detections_by_stem.get(stem, [])

        for table in sorted(payload.get("tables", []), key=lambda t: int(t.get("table_index", 0))):
            tidx = int(table.get("table_index", 0))
            cells: list[dict] = []
            for row_idx, row in enumerate(table.get("answer", {}).get("cells", [])):
                if not isinstance(row, list):
                    continue
                for col_idx, cell in enumerate(row):
                    if not isinstance(cell, dict):
                        continue
                    cells.append({
                        "row": int(cell.get("row_id", row_idx)),
                        "col": col_idx,
                        "text": _clean_text(str(cell.get("text", ""))),
                        "bbox": _norm_bbox(cell.get("box")),
                        "rowspan": 1,
                        "colspan": 1,
                        "confidence": float(cell.get("confidence", 1.0)),
                        "flagged": False,
                    })

            det_conf = surya[tidx]["score"] if tidx < len(surya) else 1.0
            bbox = _norm_bbox(table.get("bbox"))
            if bbox is None and tidx < len(surya):
                bbox = _norm_bbox(surya[tidx].get("bbox_orig_space"))

            results.append({
                "stem": stem,
                "page_num": _stem_to_page_num(stem),
                "table_index": tidx,
                "bbox": bbox,
                "detection_confidence": det_conf,
                "cells": cells,
            })

    return results


# ---------------------------------------------------------------------------
# Step 5: persist to DB
# ---------------------------------------------------------------------------

def _store_results(job_id: str, table_results: list[dict], crops_dir: Path) -> None:
    with get_db() as conn:
        for r in table_results:
            tid = str(uuid.uuid4())
            crop = str(crops_dir / r["stem"] / f"table_{r['table_index']:02d}.png")
            conn.execute(
                """
                INSERT INTO table_results
                    (id, job_id, page_num, table_index, bbox, detection_confidence, crop_path, ocr_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    tid, job_id,
                    r["page_num"], r["table_index"],
                    json.dumps(r["bbox"]),
                    r["detection_confidence"],
                    crop,
                    json.dumps({"cells": r["cells"]}),
                ],
            )


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def process_document(job_id: str, file_path: str, mode: str = "accurate") -> None:
    settings = get_settings()
    storage = Path(settings.storage_path)
    jdir = storage / job_id
    fp = Path(file_path)
    t0 = time.time()

    def _upd(**kw):
        _update_job(job_id, **kw)

    try:
        _upd(status="processing", stage="rasterizing", progress=5,
             started_at=datetime.now(timezone.utc).isoformat())

        # Step 1 – rasterize
        pages_dir = jdir / "pages"
        if fp.suffix.lower() == ".pdf":
            page_paths = _rasterize_pdf(fp, pages_dir)
        else:
            page_paths = _load_image(fp, pages_dir)
        _log(f"[{job_id}] rasterized {len(page_paths)} page(s)")

        _upd(stage="detecting", progress=20)

        # Step 2 – Surya detection + crop
        crops_dir = jdir / "crops"
        detections = _detect_and_crop(
            page_paths, crops_dir,
            threshold=settings.table_detection_threshold,
            padding=settings.table_detection_padding,
        )
        total_crops = sum(len(v) for v in detections.values())
        _log(f"[{job_id}] detected {total_crops} table(s)")

        if total_crops == 0:
            elapsed = int((time.time() - t0) * 1000)
            _upd(status="done", stage="done", progress=100,
                 finished_at=datetime.now(timezone.utc).isoformat(),
                 latency_ms=elapsed)
            return

        _upd(stage="structure_recognition", progress=40)

        # Step 3 – Structure recognition (in-process)
        if mode == "fast":
            structure_results = _run_tatr(jdir, crops_dir)
            _log(f"[{job_id}] TATR (fast) done, {len(structure_results)} result(s)")
        else:
            structure_results = _run_tdatr(jdir, crops_dir)
            _log(f"[{job_id}] TDATR (accurate) done, {len(structure_results)} result(s)")

        _upd(stage="storing", progress=80)

        # Step 4 – parse
        table_results = _parse_tdatr_output(structure_results, detections)

        # Step 5 – persist
        _store_results(job_id, table_results, crops_dir)

        # Step 6 – CSV
        from app.services.csv_builder import build_csv
        build_csv(job_id, table_results, jdir)

        elapsed = int((time.time() - t0) * 1000)
        _upd(status="done", stage="done", progress=100,
             finished_at=datetime.now(timezone.utc).isoformat(),
             latency_ms=elapsed)
        _log(f"[{job_id}] complete in {elapsed}ms")

    except Exception as exc:
        _log(f"[{job_id}] FAILED: {exc}")
        _upd(status="failed", error=str(exc),
             finished_at=datetime.now(timezone.utc).isoformat())
        raise
