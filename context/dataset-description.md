## Machathon Phase 1 COCO Tables Dataset — Summary (HF-ready)

* **Domain:** Document images containing tables (scientific / paper-style pages).
* **Size:** ~1500 images (each image has 0+ table-related annotations).
* **Original annotation format:** COCO-style JSON with:

  * `images`: `{id, file_name, width, height}`
  * `annotations`: `{id, image_id, category_id, bbox, area, iscrowd, ...}`
  * `categories`: table-structure classes

### Classes (6)

COCO category IDs (1–6):

1. `table`
2. `table column`
3. `table row`
4. `table column header`
5. `table projected row header`
6. `table spanning cell`

### Hugging Face dataset structure

Converted into a Hugging Face `datasets.Dataset` with 2 columns:

1. **`image`**

   * Stored as HF `Image()` feature (decoded to a PIL image when accessed).

2. **`objects`** (a structured dict per image)

   * `bbox`: list of bounding boxes in **COCO format** `[x, y, width, height]` (float32)
   * `category`: list of integer labels **0-based** (mapped from COCO `category_id - 1`) using `ClassLabel(names=[...])`
   * `area`: list of floats (float32), copied from COCO `area`
   * `iscrowd`: list of ints (int64), copied from COCO `iscrowd`

### Notes / compatibility

* **Label indexing:** shifted from COCO’s 1-based IDs to 0-based indices so it works with `ClassLabel` and HF training pipelines.
* **“DETR-ready” meaning:** the dataset matches the structure commonly used by Hugging Face object detection training (image + objects with bbox/labels + optional COCO fields like area/iscrowd), so it can be used directly with transformer-based detectors (e.g., DETR) after applying the model’s image processor.

https://huggingface.co/datasets/ysif9/test-dataset