import os
import json
import random
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from PIL import Image
from pathlib import Path
from typing import List, Dict

# =====================================================================
# PATHS (As requested for Kaggle environment)
# =====================================================================
IMAGES_DIR = "/kaggle/input/datasets/mohammedahmedxx12/machathon-dataset/Phase1_Train_Dataset/images"
TD_ANNOTATIONS_DIR = "/kaggle/input/datasets/philopaterg/stp26-preprocessed-dataset/preprocessed_dataset/table_detection"
TSR_ANNOTATIONS_DIR = "/kaggle/input/datasets/philopaterg/stp26-preprocessed-dataset/preprocessed_dataset/table_structure"

# LOCAL PATHS (For local testing)
# IMAGES_DIR = "e:/Coding projects/STP26-Table-Extraction-Machathon-7/data/images" # Adjust if local images exist
# TD_ANNOTATIONS_DIR = "e:/Coding projects/STP26-Table-Extraction-Machathon-7/data/preprocessed_dataset/table_detection"
# TSR_ANNOTATIONS_DIR = "e:/Coding projects/STP26-Table-Extraction-Machathon-7/data/preprocessed_dataset/table_structure"

# =====================================================================
# CONFIGURATION
# =====================================================================
NUM_SAMPLES = 3  # Number of samples to visualize from each task
CATEGORY_COLORS = {
    1: '#E74C3C',  # table - Red
    2: '#3498DB',  # table column - Blue
    3: '#2ECC71',  # table row - Green
    4: '#F39C12',  # table column header - Orange
    5: '#9B59B6',  # table projected row header - Purple
    6: '#1ABC9C',  # table spanning cell - Teal
}

def load_coco_json(json_path):
    if not os.path.exists(json_path):
        print(f"Error: JSON file not found at {json_path}")
        return None
    with open(json_path, 'r') as f:
        return json.load(f)

def find_image(file_name, search_dirs):
    """Search for image in multiple directories."""
    for d in search_dirs:
        # Check direct
        path = os.path.join(d, file_name)
        if os.path.exists(path):
            return path
        # Check in 'images' subfolder
        path = os.path.join(d, 'images', file_name)
        if os.path.exists(path):
            return path
    return None

def visualize_samples(coco_data, root_dirs, title_prefix, num_samples=3):
    if not coco_data:
        return

    images = coco_data['images']
    # Filter images that have annotations
    img_ids_with_anns = set(ann['image_id'] for ann in coco_data['annotations'])
    valid_images = [img for img in images if img['id'] in img_ids_with_anns]
    
    if not valid_images:
        print(f"No images with annotations found for {title_prefix}")
        return

    samples = random.sample(valid_images, min(num_samples, len(valid_images)))
    
    cat_id_to_name = {cat['id']: cat['name'] for cat in coco_data['categories']}

    for img_info in samples:
        img_id = img_info['id']
        file_name = img_info['file_name']
        
        img_path = find_image(file_name, root_dirs)
        
        if not img_path:
            print(f"Warning: Image {file_name} not found in {root_dirs}")
            continue

        # Load image
        img = Image.open(img_path).convert("RGB")
        fig, ax = plt.subplots(1, figsize=(10, 10))
        ax.imshow(img)
        
        # Draw annotations
        img_anns = [ann for ann in coco_data['annotations'] if ann['image_id'] == img_id]
        for ann in img_anns:
            bbox = ann['bbox'] # [x, y, w, h]
            cat_id = ann['category_id']
            cat_name = cat_id_to_name.get(cat_id, "Unknown")
            color = CATEGORY_COLORS.get(cat_id, 'yellow')
            
            rect = patches.Rectangle((bbox[0], bbox[1]), bbox[2], bbox[3], 
                                     linewidth=2, edgecolor=color, facecolor='none')
            ax.add_patch(rect)
            ax.text(bbox[0], bbox[1], cat_name, color='white', 
                    fontsize=8, bbox=dict(facecolor=color, alpha=0.5))

        plt.title(f"{title_prefix} - {file_name} (ID: {img_id})")
        plt.axis('off')
        plt.show()

def main():
    print("Starting visual verification of preprocessed data...")

    # 1. Table Detection (TD) Visualization
    print("\nVisualizing Table Detection (TD) Examples...")
    td_train_path = os.path.join(TD_ANNOTATIONS_DIR, "train.json")
    td_data = load_coco_json(td_train_path)
    if td_data:
        # Search TD images in preprocessed TD image folder OR original IMAGES_DIR
        # Preprocessed images are likely in TD_ANNOTATIONS_DIR/images
        visualize_samples(td_data, [TD_ANNOTATIONS_DIR, IMAGES_DIR], "TD", NUM_SAMPLES)

    # 2. Table Structure Recognition (TSR) Visualization
    print("\nVisualizing Table Structure Recognition (TSR) Examples...")
    tsr_train_path = os.path.join(TSR_ANNOTATIONS_DIR, "train.json")
    tsr_data = load_coco_json(tsr_train_path)
    if tsr_data:
        # Search TSR crops in preprocessed TSR folder
        visualize_samples(tsr_data, [TSR_ANNOTATIONS_DIR], "TSR", NUM_SAMPLES)

if __name__ == "__main__":
    main()
