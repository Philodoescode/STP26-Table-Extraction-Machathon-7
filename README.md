# SiamRAM Table Extraction Service

A high-performance table extraction pipeline that combines **Surya** for table detection and **TDATR** for table structure recognition.

## Overview

This service provides a robust API for extracting structured data (CSV/JSON) from tables in PDF and image documents. The pipeline follows these steps:
1.  **Rasterization**: Converts PDF pages to high-resolution images.
2.  **Detection (Surya)**: Detects table bounding boxes on each page.
3.  **Structure Recognition (TDATR)**: Parses detected table crops into structured cells (rows, columns, text).
4.  **Export**: Generates downloadable CSV and JSON results.

## Performance Optimization

The TDATR structure recognition engine is integrated as an in-process singleton. The model is loaded into GPU memory on the first request and kept warm for subsequent jobs. This refactor eliminates the significant overhead of model re-initialization (saving ~30s per job compared to subprocess-based implementations).

The API also runs an internal job queue with worker threads, so uploads return immediately and multiple users can submit at once. Jobs are processed asynchronously by workers, and GPU sections are controlled with a semaphore to prevent unsafe overcommit.

---

## Getting Started

### Prerequisites
- Docker and Docker Compose
- NVIDIA Container Toolkit (for GPU support)
- TDATR model checkpoint (`model.pt`)
- Surya layout model directory

### 1. Configure Environment
Copy the example environment file and fill in the absolute host paths for your models:

```bash
cp .env.example .env
```

Edit `.env` and set the following variables:
- `HOST_TDATR_CHECKPOINT`: Absolute path to your TDATR `model.pt`.
- `HOST_SURYA_MODEL_DIR`: Absolute path to your Surya layout model directory.
- Optional concurrency knobs:
  - `JOB_WORKER_COUNT`: Number of parallel background workers (default `2`).
  - `GPU_CONCURRENCY`: Number of jobs allowed in GPU inference at once (default `1`).
  - `JOB_QUEUE_SIZE`: Max queued jobs (`0` = unbounded).

### 2. Run with Docker
The TDATR code is baked into the image, while large model weights are mounted via volumes for efficiency.

```bash
# Build and start the service
docker-compose up --build
```

The API will be available at `http://localhost:8000`. You can access the interactive API documentation at `http://localhost:8000/docs`.

---

## Docker Configuration Details

### Volume Mounts
The `docker-compose.yml` uses the following mounts to link host resources to the container:
- `./storage`: Persists uploaded files, job data, and extracted results.
- `${HOST_TDATR_CHECKPOINT}`: Mounts the specific TDATR weights file to `/models/model.pt`.
- `${HOST_SURYA_MODEL_DIR}`: Mounts the layout model directory to `/models/surya_layout`.

### GPU Support
The service is configured to use one NVIDIA GPU. Ensure your host has the `nvidia-container-toolkit` installed to enable passthrough.

---

## API Usage Quick Start

1.  **Create a Job**: `POST /api/v1/upload` with a PDF or image file.
2.  **Poll Status**: `GET /api/v1/jobs/{job_id}` until `status` is `done`.
3.  **Fetch Results**: `GET /api/v1/jobs/{job_id}/tables` to see the extracted data.

---

## Deploy on Modal (GPU)

This repo includes a Modal entrypoint at `modal_app.py` that reuses the current `Dockerfile` and runs the same FastAPI backend on a GPU container.

### 1. Install and authenticate Modal CLI

```bash
pip install modal
modal setup
```

### 2. Create persistent volumes

```bash
modal volume create table-extraction-models
modal volume create table-extraction-storage
```

### 3. Upload model weights to Modal volume

```bash
# Upload TDATR checkpoint
modal volume put table-extraction-models /absolute/path/to/model.pt /model.pt

# Upload Surya layout model directory
modal volume put table-extraction-models /absolute/path/to/surya_layout /surya_layout
```

### 4. Deploy the app

```bash
# Optional overrides
export MODAL_APP_NAME=table-extraction-api
export MODAL_GPU=A10G
export MODAL_MODELS_VOLUME=table-extraction-models
export MODAL_STORAGE_VOLUME=table-extraction-storage
export MODAL_MIN_CONTAINERS=0
export MODAL_MAX_CONTAINERS=1
export MODAL_SCALEDOWN_WINDOW=300
export MODAL_MAX_INPUTS=32
export MODAL_TARGET_INPUTS=16
export CORS_ORIGINS='["http://localhost:5173","http://localhost:3000","https://table-extraction-front.onrender.com"]'
export CORS_ORIGIN_REGEX='^https?://(localhost|127\.0\.0\.1)(:\d+)?$|^https://([a-zA-Z0-9-]+\.)*(onrender\.com|vercel\.app|netlify\.app|modal\.run)$'
# emergency fallback (less strict): export CORS_ALLOW_ALL=true

modal deploy modal_app.py
```

After deploy, Modal prints the public endpoint URL. Your API routes remain the same (for example, `/health`, `/api/v1/upload`, `/api/v1/jobs/{job_id}`).

The deployment uses `@modal.concurrent` so each container can handle multiple web requests at once. Keep `MODAL_MAX_CONTAINERS=1` if you want one shared in-container queue/GPU worker pool, and tune request concurrency with `MODAL_MAX_INPUTS` / `MODAL_TARGET_INPUTS`.
