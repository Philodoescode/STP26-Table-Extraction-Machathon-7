"""
In-process TATR (Table Transformer) + Surya OCR singleton for table structure recognition.

Replaces TDATR as an alternative pipeline step, running Phase 3 notebook logic:
  1. TATR (microsoft/table-transformer-structure-recognition-v1.1-all) to locate cells.
  2. NMS and bounding-box intersection rules to build the grid / handling rowspans.
  3. Surya OCR batched over all cell crops to populate text.
"""
from __future__ import annotations

import json
import logging
import math
import time
import threading
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

import cv2

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Utility Functions (from Phase 3 Notebook)
# ---------------------------------------------------------------------------

def clip_xyxy(box: Iterable[float], width: int, height: int) -> List[float]:
    x1, y1, x2, y2 = [float(v) for v in box]
    x1 = max(0.0, min(x1, float(width)))
    y1 = max(0.0, min(y1, float(height)))
    x2 = max(0.0, min(x2, float(width)))
    y2 = max(0.0, min(y2, float(height)))
    if x2 < x1:
        x1, x2 = x2, x1
    if y2 < y1:
        y1, y2 = y2, y1
    return [x1, y1, x2, y2]


def is_valid_xyxy(box: Sequence[float]) -> bool:
    return box[2] > box[0] and box[3] > box[1]


def normalize_text(text: str) -> str:
    if not text:
        return ''
    return ' '.join(text.split())


def apply_class_aware_nms(boxes: Any, scores: Any, labels: Any, iou_thresholds: Dict[int, float]) -> Any:
    import torch
    import torchvision
    keep = []
    for cls_id in torch.unique(labels):
        cls_mask = labels == cls_id
        cls_boxes = boxes[cls_mask]
        cls_scores = scores[cls_mask]
        cls_indices = torch.nonzero(cls_mask).squeeze(1)
        iou_thresh = iou_thresholds.get(int(cls_id.item()), 0.5)
        cls_keep = torchvision.ops.nms(cls_boxes, cls_scores, iou_thresh)
        keep.append(cls_indices[cls_keep])

    if keep:
        return torch.cat(keep)
    return torch.empty(0, dtype=torch.long, device=boxes.device)


def row_coverage_check(rows: List[List[float]], table_abs: Sequence[float]) -> None:
    if not rows: return
    rows[0][1] = min(rows[0][1], float(table_abs[1]))
    rows[-1][3] = max(rows[-1][3], float(table_abs[3]))


def column_count_consistency(rows: List[List[float]], cols: List[List[float]]) -> None:
    if not rows or not cols: return
    min_x = min(c[0] for c in cols)
    max_x = max(c[2] for c in cols)
    for r in rows:
        r[0] = min(r[0], min_x)
        r[2] = max(r[2], max_x)


def header_deduplication(headers: List[Tuple[float, List[float]]]) -> List[List[float]]:
    if not headers: return []
    return [h[1] for h in headers]


def spanning_cell_validation(rowspan: int, colspan: int) -> bool:
    return rowspan >= 2 or colspan >= 2


# ---------------------------------------------------------------------------
# TATRPredictor Class
# ---------------------------------------------------------------------------

class TATRPredictor:
    """Persistent wrapper around TATR + Surya OCR.

    Loads models once to GPU and serves structure recognition inferences in-process.
    """

    def __init__(self, settings: Any) -> None:
        import torch
        from transformers import AutoConfig, AutoImageProcessor, TableTransformerForObjectDetection
        from surya.recognition import RecognitionPredictor

        t0 = time.time()
        self._device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

        # 1. Load TATR (Table Transformer)
        self.sr_model_name = settings.tatr_model_name
        self.sr_longest_edge = getattr(settings, 'tatr_longest_edge', 1000)
        self.sr_shortest_edge = getattr(settings, 'tatr_shortest_edge', 800)
        self.sr_threshold = getattr(settings, 'tatr_threshold', 0.3)

        logger.info(f"Loading TATR model: {self.sr_model_name}")
        sr_config = AutoConfig.from_pretrained(self.sr_model_name)
        self.sr_model = TableTransformerForObjectDetection(sr_config).to(self._device)
        self.sr_processor = AutoImageProcessor.from_pretrained(
            self.sr_model_name,
            use_fast=True,
            size={'longest_edge': self.sr_longest_edge, 'shortest_edge': self.sr_shortest_edge}
        )

        # Optionally load custom checkpoint weights if provided in config
        ckpt_path = settings.tatr_tsr_checkpoint
        if ckpt_path and Path(ckpt_path).exists():
            logger.info(f"Loading TATR custom checkpoint: {ckpt_path}")
            checkpoint = torch.load(ckpt_path, map_location=self._device)
            state_dict = checkpoint.get('model_state', checkpoint)
            try:
                self.sr_model.load_state_dict(state_dict, strict=True, assign=True)
            except TypeError:
                self.sr_model.load_state_dict(state_dict, strict=True)

        self.sr_model.eval()

        # 2. Load Surya OCR
        logger.info(f"Loading Surya OCR predictor from {settings.surya_recognition_model_dir}")
        from surya.foundation import FoundationPredictor
        ocr_foundation = FoundationPredictor(
            checkpoint=settings.surya_recognition_model_dir,
            device=str(self._device)
        )
        self.ocr_predictor = RecognitionPredictor(ocr_foundation)
        self.ocr_predictor.disable_tqdm = True

        elapsed = time.time() - t0
        logger.info(f"TATRPredictor initialized in {elapsed:.1f}s on {self._device}")

    def _recognize_structure(self, crop_image: Any) -> List[Dict[str, Any]]:
        """Processes a single table crop image through TATR & rule-based grid matching."""
        import torch

        inputs = self.sr_processor(images=crop_image, return_tensors='pt').to(self._device)
        target_sizes = torch.tensor([crop_image.size[::-1]], device=self._device)

        with torch.no_grad():
            sr_outputs = self.sr_model(**inputs)
            sr_result = self.sr_processor.post_process_object_detection(
                sr_outputs,
                threshold=self.sr_threshold,
                target_sizes=target_sizes,
            )[0]

        iou_thresholds = {1: 0.5, 2: 0.5, 3: 0.5, 4: 0.5, 5: 0.5}
        keep_idx = apply_class_aware_nms(sr_result['boxes'], sr_result['scores'], sr_result['labels'], iou_thresholds)

        sr_result['boxes'] = sr_result['boxes'][keep_idx]
        sr_result['scores'] = sr_result['scores'][keep_idx]
        sr_result['labels'] = sr_result['labels'][keep_idx]

        rows: List[List[float]] = []
        cols: List[List[float]] = []
        spanning_cells: List[List[float]] = []
        headers: List[Tuple[float, List[float]]] = []

        label_names = {
            0: 'table',
            1: 'table column',
            2: 'table row',
            3: 'table column header',
            4: 'table projected row header',
            5: 'table spanning cell',
        }

        img_w, img_h = crop_image.size

        for score, label, box in zip(sr_result['scores'], sr_result['labels'], sr_result['boxes']):
            name = label_names.get(int(label.item()))
            if name is None:
                continue

            abs_box = clip_xyxy([float(v) for v in box.tolist()], img_w, img_h)
            if not is_valid_xyxy(abs_box):
                continue

            if name == 'table row':
                rows.append(abs_box)
            elif name == 'table column':
                cols.append(abs_box)
            elif name == 'table spanning cell':
                spanning_cells.append(abs_box)
            elif name == 'table column header':
                headers.append((float(score.item()), abs_box))

        rows.sort(key=lambda b: b[1])
        cols.sort(key=lambda b: b[0])

        table_box_abs = [0.0, 0.0, float(img_w), float(img_h)]
        row_coverage_check(rows, table_box_abs)
        column_count_consistency(rows, cols)
        valid_headers = header_deduplication(headers)

        for hb in valid_headers:
            spanning_cells.append(hb)

        cells: List[Dict[str, Any]] = []
        occupied = set()

        for sc_box in spanning_cells:
            sc_x1, sc_y1, sc_x2, sc_y2 = sc_box
            covered_rows = [r for r, rb in enumerate(rows) if sc_y1 <= (rb[1] + rb[3]) / 2 <= sc_y2]
            covered_cols = [c for c, cb in enumerate(cols) if sc_x1 <= (cb[0] + cb[2]) / 2 <= sc_x2]

            if not covered_rows or not covered_cols:
                continue

            row_idx, col_idx = min(covered_rows), min(covered_cols)
            rowspan = max(covered_rows) - row_idx + 1
            colspan = max(covered_cols) - col_idx + 1

            if not spanning_cell_validation(rowspan, colspan):
                continue

            for r in covered_rows:
                for c in covered_cols:
                    occupied.add((r, c))

            cells.append({
                'bbox': sc_box,
                'row': int(row_idx),
                'col': int(col_idx),
                'rowspan': int(rowspan),
                'colspan': int(colspan),
                'text': '',
            })

        for row_idx, row_box in enumerate(rows):
            for col_idx, col_box in enumerate(cols):
                if (row_idx, col_idx) in occupied:
                    continue

                x1 = max(row_box[0], col_box[0])
                y1 = max(row_box[1], col_box[1])
                x2 = min(row_box[2], col_box[2])
                y2 = min(row_box[3], col_box[3])

                cell_box = clip_xyxy([x1, y1, x2, y2], img_w, img_h)
                if not is_valid_xyxy(cell_box):
                    continue

                cells.append({
                    'bbox': cell_box,
                    'row': int(row_idx),
                    'col': int(col_idx),
                    'rowspan': 1,
                    'colspan': 1,
                    'text': '',
                })

        span_bboxes = [c['bbox'] for c in cells if c['rowspan'] > 1 or c['colspan'] > 1]
        if span_bboxes:
            def mostly_covered(cell_bbox: List[float]) -> bool:
                cx1, cy1, cx2, cy2 = cell_bbox
                cell_area = max(0.0, cx2 - cx1) * max(0.0, cy2 - cy1)
                if cell_area <= 0: return False
                for sb in span_bboxes:
                    inter_w = max(0.0, min(cx2, sb[2]) - max(cx1, sb[0]))
                    inter_h = max(0.0, min(cy2, sb[3]) - max(cy1, sb[1]))
                    if (inter_w * inter_h) / cell_area > 0.5:
                        return True
                return False

            cells = [c for c in cells if c['rowspan'] > 1 or c['colspan'] > 1 or not mostly_covered(c['bbox'])]

        cells.sort(key=lambda c: (c['row'], c['col'], c['bbox'][1], c['bbox'][0]))
        return cells

    def infer(self, crops_dir: Path, output_base_dir: Optional[Path] = None) -> List[Dict]:
        """
        Run structure recognition & OCR batched across precomputed table crops.
        """
        from PIL import Image

        all_results: List[Dict] = []
        crops_dir = Path(crops_dir)

        vis_dir = None
        json_dir = None
        if output_base_dir is not None:
            out_name = crops_dir.name
            vis_dir = output_base_dir / "output" / "infer_TATR" / out_name / "out_vis"
            json_dir = output_base_dir / "output" / "infer_TATR" / out_name / "out_jsons"
            vis_dir.mkdir(parents=True, exist_ok=True)
            json_dir.mkdir(parents=True, exist_ok=True)

        jobs = []

        # 1. Gather all crops & run TATR structural detection
        for page_dir in sorted(crops_dir.iterdir()):
            if not page_dir.is_dir():
                continue

            config_file = page_dir / "config.json"
            if not config_file.exists():
                continue

            with open(config_file, "r", encoding="utf-8") as f:
                config = json.load(f)

            image_path = config.get("image_path")
            detections = config.get("crops", [])

            for table_idx, detection in enumerate(detections):
                crop_file = page_dir / detection["crop_file"]
                if not crop_file.exists():
                    continue

                try:
                    crop_image = Image.open(crop_file).convert("RGB")
                except Exception as e:
                    logger.warning(f"Failed to load crop {crop_file}: {e}")
                    continue

                cells = self._recognize_structure(crop_image)

                # Compute valid bounding boxes inside crop for Surya OCR
                rel_boxes = []
                for cell in cells:
                    rel = clip_xyxy(cell['bbox'], crop_image.width, crop_image.height)
                    if not is_valid_xyxy(rel):
                        rel = [0.0, 0.0, float(crop_image.width), float(crop_image.height)]
                    rel_boxes.append([int(math.floor(rel[0])), int(math.floor(rel[1])),
                                      int(math.ceil(rel[2])), int(math.ceil(rel[3]))])

                jobs.append({
                    "page_dir": page_dir,
                    "config": config,
                    "detection": detection,
                    "table_idx": table_idx,
                    "crop_image": crop_image,
                    "cells": cells,
                    "rel_boxes": rel_boxes,
                })

        # 2. Run batched OCR over all collected crops
        if jobs:
            valid_jobs_idx = [i for i, job in enumerate(jobs) if job["rel_boxes"]]
            if valid_jobs_idx:
                chunk_crops = [jobs[i]["crop_image"] for i in valid_jobs_idx]
                chunk_boxes = [jobs[i]["rel_boxes"] for i in valid_jobs_idx]

                try:
                    ocr_results = self.ocr_predictor(
                        chunk_crops,
                        task_names=['ocr_with_boxes'] * len(chunk_crops),
                        bboxes=chunk_boxes,
                        recognition_batch_size=8,
                        math_mode=True
                    )

                    res_idx = 0
                    for i, job in enumerate(jobs):
                        if i in valid_jobs_idx:
                            ocr_res = ocr_results[res_idx]
                            res_idx += 1
                            text_lines = ocr_res.text_lines if ocr_res else []
                            for idx, cell in enumerate(job["cells"]):
                                if idx < len(text_lines) and text_lines[idx] is not None:
                                    cell['text'] = normalize_text(text_lines[idx].text)
                                    cell['confidence'] = float(getattr(text_lines[idx], 'confidence', 1.0))
                        else:
                            for cell in job["cells"]:
                                cell['text'] = ''
                                cell['confidence'] = 0.0
                except Exception as e:
                    logger.error(f"Surya OCR batch inference failed: {e}")

        # 3. Format outputs matching the table_pipeline expected structure
        results_by_page = {}
        for job in jobs:
            page_dir = job["page_dir"]
            config = job["config"]
            detection = job["detection"]
            cells = job["cells"]

            bbox_orig_space = detection.get("bbox_orig_space")
            score = detection.get("score", 0.0)
            table_index = detection.get("table_index", job["table_idx"])

            # Find table offset on original page (x0, y0)
            x0, y0 = 0.0, 0.0
            if bbox_orig_space is not None:
                x0, y0 = bbox_orig_space[0], bbox_orig_space[1]

            max_row = max((c['row'] for c in cells), default=-1)
            rows_list = [[] for _ in range(max_row + 1)]

            for c in cells:
                cx0, cy0, cx1, cy1 = c['bbox']

                # Shift cells back to absolute page coordinates (pipeline expects this format)
                page_box = [cx0 + x0, cy0 + y0, cx1 + x0, cy1 + y0]

                rows_list[c['row']].append({
                    "row_id": c['row'],
                    "text": c['text'],
                    "box": page_box,
                    "confidence": c.get('confidence', 1.0),
                    "rowspan": c['rowspan'],
                    "colspan": c['colspan']
                })

            for r in rows_list:
                r.sort(key=lambda x: x['box'][0])

            table_dict = {
                "table_index": table_index,
                "score": round(score, 4),
                "bbox": bbox_orig_space,
                "crop_size": list(job["crop_image"].size),
                "answer": {"cells": rows_list}
            }

            page_name = page_dir.name
            if page_name not in results_by_page:
                results_by_page[page_name] = {
                    "image_path": config.get("image_path"),
                    "detector": {
                        "name": config.get("detector", "surya_layout"),
                        "threshold": config.get("threshold"),
                        "padding": config.get("padding")
                    },
                    "tables": []
                }
            results_by_page[page_name]["tables"].append(table_dict)

        # 4. Optional: Draw visualizations and save JSON outputs
        for page_name, ans_info in results_by_page.items():
            all_results.append(ans_info)
            image_path = ans_info.get("image_path")
            save_name = Path(image_path).name if image_path else page_name

            if vis_dir is not None and image_path and Path(image_path).exists():
                vis_image = cv2.imread(image_path)
                if vis_image is not None:
                    for table in ans_info["tables"]:
                        bbox = table.get("bbox")
                        if bbox:
                            cv2.rectangle(vis_image, (int(bbox[0]), int(bbox[1])), (int(bbox[2]), int(bbox[3])),
                                          (0, 255, 0), 3)
                        for row in table["answer"]["cells"]:
                            for cell in row:
                                bx0, by0, bx1, by1 = [int(v) for v in cell["box"]]
                                cv2.rectangle(vis_image, (bx0, by0), (bx1, by1), (0, 0, 255), 2)
                    cv2.imwrite(str(vis_dir / save_name), vis_image)

            if json_dir is not None:
                save_path = json_dir / f"{save_name}.json"
                with open(save_path, "w", encoding="utf-8") as f:
                    json.dump(ans_info, f, indent=4, ensure_ascii=False)

        return all_results


# ---------------------------------------------------------------------------
# Lazy thread-safe singleton
# ---------------------------------------------------------------------------

_tatr_lock = threading.Lock()
_tatr_predictor: TATRPredictor | None = None


def _get_tatr_predictor() -> TATRPredictor:
    """Return the global TATRPredictor, creating it on the first call."""
    global _tatr_predictor
    if _tatr_predictor is not None:
        return _tatr_predictor

    with _tatr_lock:
        if _tatr_predictor is not None:
            return _tatr_predictor

        from app.config import get_settings
        settings = get_settings()
        _tatr_predictor = TATRPredictor(settings)

    return _tatr_predictor