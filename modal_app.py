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

image = modal.Image.from_dockerfile(
    path="Dockerfile",
    context_dir=".",
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
        "TDATR_CHECKPOINT_PATH": f"{MODELS_MOUNT}/model.pt",
        "SURYA_LAYOUT_MODEL_DIR": f"{MODELS_MOUNT}/surya_layout",
        "CORS_ORIGINS": os.getenv(
            "CORS_ORIGINS",
            "[\"http://localhost:5173\",\"http://localhost:3000\",\"https://table-extraction-front.onrender.com\"]",
        ),
        "CORS_ORIGIN_REGEX": os.getenv(
            "CORS_ORIGIN_REGEX",
            r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$|^https://([a-zA-Z0-9-]+\.)*(onrender\.com|vercel\.app|netlify\.app|modal\.run)$",
        ),
        "CORS_ALLOW_ALL": os.getenv("CORS_ALLOW_ALL", "false"),
    },
)
@modal.concurrent(max_inputs=MAX_INPUTS, target_inputs=TARGET_INPUTS)
@modal.asgi_app()
def fastapi_app():
    from app.main import app as api

    return api
