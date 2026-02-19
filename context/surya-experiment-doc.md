# Surya Table Extraction Experiment (Phase 1)

## 1. Objective

Evaluate a Surya-based table extraction pipeline for **Machathon Phase 1 (table extraction only)** on our Hugging Face
dataset setup.

Unlike the baseline experiment that used the original COCO JSON directly, this run uses the team dataset published on HF
and maps Surya outputs to the 6 table-structure classes.

---

## 2. Dataset

### Source

- Hugging Face dataset: `ysif9/test-dataset`
- Domain: document pages with scientific/paper-style tables

### Labels (6 classes)

1. `table`
2. `table column`
3. `table row`
4. `table column header`
5. `table projected row header`
6. `table spanning cell`

### Format Notes

- HF `objects.bbox` is COCO format: `[x, y, width, height]`
- Labels are **0-based** in HF (`category_id - 1` from original COCO)
- In notebook evaluation, boxes are converted to `xyxy` for metrics

---

## 3. Evaluation Subset

- Notebook: `test-surya.ipynb`
- Split used: `train`
- `CONFIG.max_samples = 500`
- Random seed: `42`

This run is therefore a **500-sample subset evaluation** (not full 1500 images and not a held-out test split).

---

## 4. Model / Pipeline

### Core Model

- `surya-ocr==0.17.1`
- Table recognition via `TableRecPredictor`
- Layout-based table region detection enabled (`LayoutPredictor`)
- `LayoutPredictor` backbone size: ~`722M` parameters
- `TableRecPredictor` model size: ~`105M` parameters

### Main Inference Flow

1. Load images + GT annotations from HF dataset.
2. Detect table regions from layout model.
3. Crop detected table areas (small expansion ratio).
4. Run Surya table structure recognition on crops.
5. Map outputs back to original image coordinates.
6. Post-process and deduplicate predictions.

### Heuristic Mapping to Competition Classes

- Surya does **not** expose an explicit `table projected row header` class.
- Native outputs are table/row/column/cell structures plus a binary header signal (`is_header`) on structural elements.
- Row and column boxes come directly from Surya row/column outputs.
- Column header rows are inferred from top header-like rows/cell patterns.
- Projected row headers are inferred from non-top header rows + geometric fallback.
- Spanning cells combine structural spans and geometric fallbacks with filtering.

---

## 5. Evaluation Metrics

Metrics were computed with `torchmetrics.detection.MeanAveragePrecision`:

- `mAP@0.50`
- `mAP@0.50:0.95`
- `mAP@0.75`
- `mAR@1`, `mAR@10`, `mAR@100`

Additional detection stats at IoU = 0.50:

- overall precision, recall, F1
- per-class precision, recall, F1 and TP/FP/FN

---

## 6. Results (500-sample run)

### Overall

- **mAP@0.50:** `0.649507`
- **mAP@0.50:0.95:** `0.489957`
- **mAP@0.75:** `0.565423`
- **mAR@1:** `0.253988`
- **mAR@10:** `0.488183`
- **mAR@100:** `0.560942`
- **Precision:** `0.961419`
- **Recall:** `0.877022`
- **F1:** `0.917283`

### Per-Class Snapshot

| Class                      | Precision |   Recall |       F1 |  AP@0.50 | mAP@0.50:0.95 |
|----------------------------|----------:|---------:|---------:|---------:|--------------:|
| table                      |  0.978548 | 0.994966 | 0.986689 | 0.970587 |      0.734950 |
| table column               |  0.974629 | 0.987151 | 0.980850 | 0.959911 |      0.863997 |
| table row                  |  0.977310 | 0.988932 | 0.983087 | 0.958988 |      0.676082 |
| table column header        |  0.912541 | 0.946918 | 0.929412 | 0.865164 |      0.582835 |
| table projected row header |  0.015625 | 0.001916 | 0.003413 | 0.000183 |      0.000147 |
| table spanning cell        |  0.696809 | 0.188625 | 0.296884 | 0.142207 |      0.081730 |

---

## 7. Key Observations

- Strong detection quality for `table`, `table column`, and `table row`.
- Header detection is usable but weaker than base table/row/column classes.
- Lower-class performance is concentrated in class IDs `4` and `5` (0-based): `table projected row header` and `table spanning cell`.
- `table projected row header` performance is extremely low in this run.
- `table spanning cell` remains challenging (low recall and low AP).
- High global precision with lower recall suggests conservative prediction behavior after dedup/heuristics.

---

## 8. Limitations

1. Evaluated on `train` subset (`500`) instead of full dataset or held-out split.
2. Results depend on heuristic class-mapping logic, not pure end-to-end native class outputs.
3. There is no explicit projected-row-header category in Surya outputs; mapping this class is heuristic and error-prone.
4. Class IDs `4` and `5` (0-based) are current bottlenecks with weak AP/recall, especially projected row headers.
5. Inference uses multiple fallback/cleanup rules, which may overfit behavior to specific layouts.
6. Runtime is relatively heavy due to layout + table recognition passes.

---

## 9. Improvements for Next Iteration

- Evaluate on full dataset and define fixed `train/val/test` reporting protocol.
- Reduce heuristic brittleness for projected row headers and spanning cells.
- Add ablation runs (with/without each heuristic block) to identify high-impact rules.
- Tune decision thresholds separately per class instead of a shared policy.
- Add qualitative error review from saved visualizations for hard failure patterns.

---

## 10. Final Outcome

For Phase 1 table extraction, the Surya pipeline is a strong baseline for **table/row/column localization**, but still
needs targeted improvement for **projected row headers** and **spanning cells** before final leaderboard submissions.
