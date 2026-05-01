"""Modal deployment entrypoint for the table extraction API.

Deploy:
  modal deploy modal_app.py

Serve locally against Modal infra:
  modal serve modal_app.py
"""

from __future__ import annotations

import os

import modal

APP_NAME = os.getenv("MODAL_APP_NAME", "table-extraction-api")
GPU_TYPE = os.getenv("MODAL_GPU", "T4")
MIN_CONTAINERS = int(os.getenv("MODAL_MIN_CONTAINERS", "0"))
MAX_CONTAINERS = int(os.getenv("MODAL_MAX_CONTAINERS", "1"))
SCALEDOWN_WINDOW = int(os.getenv("MODAL_SCALEDOWN_WINDOW", "300"))
MAX_INPUTS = int(os.getenv("MODAL_MAX_INPUTS", "32"))
TARGET_INPUTS = int(os.getenv("MODAL_TARGET_INPUTS", "16"))

STORAGE_MOUNT = "/app/storage"
MODELS_MOUNT = "/models"

app = modal.App(APP_NAME)

image = (
    modal.Image.from_registry(
        "nvidia/cuda:12.8.1-base-ubuntu22.04",
        add_python="3.12",
    )
    .env(
        {
            "DEBIAN_FRONTEND": "noninteractive",
            "PYTHONDONTWRITEBYTECODE": "1",
            "PYTHONUNBUFFERED": "1",
            "PYTHONPATH": "/app",
        }
    )
    .apt_install(
        "git",
        "curl",
        "build-essential",
        "clang",
        "python3-dev",
        "poppler-utils",
        "tesseract-ocr",
        "tesseract-ocr-ara",
        "libgl1-mesa-glx",
        "libglib2.0-0",
        "libsm6",
        "libxext6",
        "libxrender1",
    )
    # Keep fast-changing app code later so dependency layers stay cached.
    .uv_pip_install(
        "torch==2.11.0+cu128",
        "torchvision==0.26.0+cu128",
        "torchaudio==2.11.0+cu128",
        index_url="https://download.pytorch.org/whl/cu128",
    )
    .uv_pip_install(
        "hydra-core==1.3.2",
        "omegaconf==2.3.0",
        "surya-ocr==0.17.1",
        requirements=["backend-requirements.txt"],
    )
    .run_commands("mkdir -p /app/storage")
    .add_local_dir("app", remote_path="/app/app", copy=True)
    .add_local_dir("TDATR", remote_path="/app/TDATR", copy=True)
)

storage_volume = modal.Volume.from_name(
    os.getenv("MODAL_STORAGE_VOLUME", "table-extraction-storage"),
    create_if_missing=True,
)
models_volume = modal.Volume.from_name(
    os.getenv("MODAL_MODELS_VOLUME", "table-extraction-models"),
    create_if_missing=True,
)


@app.function(
    image=image,
    gpu=GPU_TYPE,
    timeout=60 * 60,
    startup_timeout=60 * 30,
    max_containers=MAX_CONTAINERS,
    min_containers=MIN_CONTAINERS,
    scaledown_window=SCALEDOWN_WINDOW,
    volumes={
        STORAGE_MOUNT: storage_volume,
        MODELS_MOUNT: models_volume.read_only(),
    },
    env={
        "STORAGE_PATH": STORAGE_MOUNT,
        "DATABASE_PATH": f"{STORAGE_MOUNT}/jobs.db",
        "TDATR_REPO_DIR": "/app/TDATR",
        "TDATR_CHECKPOINT_PATH": os.getenv("TDATR_CHECKPOINT_PATH", f"{MODELS_MOUNT}/model.pt"),
        "SURYA_LAYOUT_MODEL_DIR": os.getenv("SURYA_LAYOUT_MODEL_DIR", f"{MODELS_MOUNT}/surya_layout"),
        "SURYA_RECOGNITION_MODEL_DIR": os.getenv("SURYA_RECOGNITION_MODEL_DIR", f"{MODELS_MOUNT}/surya_recognition"),
        "TATR_MODEL_NAME": os.getenv(
            "TATR_MODEL_NAME",
            "microsoft/table-transformer-structure-recognition-v1.1-all",
        ),
        "TATR_TSR_CHECKPOINT": os.getenv("TATR_TSR_CHECKPOINT", f"{MODELS_MOUNT}/tatr_tsr.pt"),
        "CORS_ORIGINS": os.getenv(
            "CORS_ORIGINS",
            "[\"http://localhost:5173\",\"http://localhost:3000\",\"https://table-extraction-front.onrender.com\"]",
        ),
    },
)
@modal.concurrent(max_inputs=MAX_INPUTS, target_inputs=TARGET_INPUTS)
@modal.asgi_app()
def fastapi_app():
    from app.main import app as api

    return api
