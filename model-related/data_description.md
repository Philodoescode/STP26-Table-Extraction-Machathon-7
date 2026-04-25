# Data Description Report (EDA Phase)

## 1. Dataset Overview
The dataset consists of **1,500 images** containing a total of **36,850 annotations**. The data is formatted in COCO JSON format and includes 6 distinct categories related to table structure recognition.

| Metric | Value |
| :--- | :--- |
| **Total Images** | 1,500 |
| **Total Annotations** | 36,850 |
| **Average Annotations per Image** | 24.6 |
| **Categories** | 6 |
| **Empty Images** | 0 (0.0%) |

## 2. Category Distribution
The dataset is heavily dominated by structural components (rows, columns) rather than table entities themselves, indicating a hierarchical labelling scheme.

| Category ID | Category Name | Count | Parent Category |
| :--- | :--- | :--- | :--- |
| **1** | table | 1,791 | (root) |
| **2** | table column | 8,274 | table |
| **3** | table row | 20,558 | table |
| **4** | table column header | 1,453 | table row |
| **5** | table projected row header | 1,207 | table row |
| **6** | table spanning cell | 3,567 | table |

*Observation:* There is a significant class imbalance, with `table row` accounts for nearly 56% of all annotations, while `table` (the higher-level target) comprises only ~4.8% of annotations.

## 3. Image Analysis
### Dimensions
The dataset contains **55 unique image dimensions**, but is highly standardized.
- **Dominant Aspect Ratio:** Portrait-oriented documents (approx. 0.75 - 0.85 aspect ratio).
- **Top 3 Resolutions:**
  1. **762 x 1000** (15.2% of dataset)
  2. **827 x 1000** (6.5%)
  3. **758 x 1000** (6.1%)

### Annotation Density
- **Mean Annotations/Image:** 24.6
- **Standard Deviation:** 18.0
- **Outliers (>3σ):** 5 images contain an varying number of annotations (>78), with the maximum reaching **116 annotations** (e.g., `PMC3663737_3.jpg`).
- **Sparse Images:** 238 images have fewer than 3 annotations.

## 4. Bounding Box Characteristics
### Area & Size
- **Mean Box Area:** 2.5% of image size.
- **Median Box Area:** 0.6% of image size.
- **Tiny Boxes (<0.15% area):** 929 annotations. These are likely small cells or headers.
- **Large Boxes (>95% area):** 0 annotations. No full-page artifacts detected.

### Aspect Ratios (Width / Height)
The component-based labelling results in extreme aspect ratios:
- **Wide Boxes (>5:1):** 6,666 annotations (mostly rows and headers).
- **Tall Boxes (<1:5):** 101 annotations (likely columns).
- **Mean AR:** 3.4
- **Median AR:** 2.5

### Spatial Distribution
- **Centroids:** The annotations are centered on average at **(x=0.48, y=0.46)**, indicating a fairly central distribution on the document pages, typical for academic papers where tables are centered.

## 5. Data Quality & Integrity
Several potential issues were identified for the cleaning phase:

### 1. Hierarchical Inconsistency (Orphans)
- **Problem:** 473 non-table elements (e.g., rows, cells) do not fall strictly within any `table` bounding box.
- **Impact:** These "orphaned" elements might be valid tables missing the parent `table` label or annotation errors.

### 2. Duplicates
- **Problem:** 218 pairs of annotations have an IoU > 0.8 with the same category label.
- **Impact:** Potential double-counting of objects.

### 3. Missing Negative Samples
- **Problem:** There are **0 empty images** in the dataset.
- **Recommendation:** A robust detector requires negative samples (images without tables) to reduce false positives. The target should be 10-15% of the dataset.

## 6. COCO Annotation Example
Below is a representative sample from `Cells_Anotations_coco.json` showing how an image (ID 1) is associated with its table-level and structural annotations.

```json
{
  "images": [
    {
      "id": 1,
      "file_name": "PMC1064076_6.jpg",
      "width": 771,
      "height": 1000
    }
  ],
  "annotations": [
    {
      "id": 1,
      "image_id": 1,
      "category_id": 1,
      "bbox": [41.45, 165.04, 685.33, 598.82],
      "area": 410389.31,
      "iscrowd": 0,
      "ignore": 0
    },
    {
      "id": 2,
      "image_id": 1,
      "category_id": 6,
      "bbox": [41.45, 165.04, 84.33, 79.86],
      "area": 6734.59,
      "iscrowd": 0,
      "ignore": 0
    }
  ],
  "categories": [
    { "id": 1, "name": "table", "supercategory": "none" },
    { "id": 2, "name": "table column", "supercategory": "table" },
    { "id": 3, "name": "table row", "supercategory": "table" },
    { "id": 4, "name": "table column header", "supercategory": "table row" },
    { "id": 5, "name": "table projected row header", "supercategory": "table row" },
    { "id": 6, "name": "table spanning cell", "supercategory": "table" }
  ]
}
```

### Annotation Key Definitions
- **`images`**: Contains metadata for the image file.
- **`annotations`**: Contains the bounding box and classification for each object.
    - `bbox`: Specified as `[x_min, y_min, width, height]`.
    - `category_id`: References the `id` in the `categories` list.
    - `area`: The area of the bounding box.
    - `image_id`: Links the annotation to a specific image.
- **`categories`**: Defines the class mapping and hierarchical relationships (supercategories).