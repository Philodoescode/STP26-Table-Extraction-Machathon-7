"""Modal deployment for the table extraction API.

Architecture:
  TableExtractor  — GPU-backed @app.cls that pre-loads models and processes jobs.
                    One job per container at a time; Modal auto-scales containers.
  WebApp          — CPU-only @app.cls serving FastAPI.
                    High input concurrency; spawns TableExtractor jobs on upload.

Deploy:  modal deploy modal_app.py
Serve:   modal serve modal_app.py
"""

from __future__ import annotations

import os

import modal

APP_NAME = os.getenv("MODAL_APP_NAME", "table-extraction-api")
GPU_TYPE = os.getenv("MODAL_GPU", "T4")
MIN_CONTAINERS = int(os.getenv("MODAL_MIN_CONTAINERS", "0"))
MAX_GPU_CONTAINERS = int(os.getenv("MODAL_MAX_GPU_CONTAINERS", "5"))
MAX_WEB_CONTAINERS = int(os.getenv("MODAL_MAX_WEB_CONTAINERS", "10"))
SCALEDOWN_WINDOW = int(os.getenv("MODAL_SCALEDOWN_WINDOW", "300"))
STORAGE_VOLUME_NAME = os.getenv("MODAL_STORAGE_VOLUME", "table-extraction-storage")
MODELS_VOLUME_NAME = os.getenv("MODAL_MODELS_VOLUME", "table-extraction-models")

STORAGE_MOUNT = "/app/storage"
MODELS_MOUNT = "/models"

app = modal.App(APP_NAME)

# ---------------------------------------------------------------------------
# Shared container image
# ---------------------------------------------------------------------------

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
    # Keep torch install first — it's the largest, most cache-stable layer.
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
    # App code last — changes here don't bust the expensive dep layers above.
    .add_local_dir("app", remote_path="/app/app", copy=True)
    .add_local_dir("TDATR", remote_path="/app/TDATR", copy=True)
)

# Import torch in global scope so it's captured by CPU memory snapshots.
# Saves the >20k file-read init on every container cold start.
with image.imports():
    import torch  # noqa: F401 (captured for snapshot)

# ---------------------------------------------------------------------------
# Volumes
# ---------------------------------------------------------------------------

storage_volume = modal.Volume.from_name(STORAGE_VOLUME_NAME, create_if_missing=True)
models_volume = modal.Volume.from_name(MODELS_VOLUME_NAME, create_if_missing=True)

# ---------------------------------------------------------------------------
# Shared env block
# ---------------------------------------------------------------------------

_COMMON_ENV: dict[str, str] = {
    "STORAGE_PATH": STORAGE_MOUNT,
    "DATABASE_PATH": f"{STORAGE_MOUNT}/jobs.db",
    "TDATR_REPO_DIR": "/app/TDATR",
    "TDATR_CHECKPOINT_PATH": f"{MODELS_MOUNT}/model.pt",
    "SURYA_LAYOUT_MODEL_DIR": f"{MODELS_MOUNT}/surya_layout",
    # Tells FastAPI app it's running on Modal so it skips the local job queue.
    "DISPATCH_MODE": "modal",
    "MODAL_APP_NAME": APP_NAME,
    "MODAL_STORAGE_VOLUME": STORAGE_VOLUME_NAME,
}

# ---------------------------------------------------------------------------
# TableExtractor — GPU inference class
# ---------------------------------------------------------------------------


@app.cls(
    image=image,
    gpu=GPU_TYPE,
    timeout=60 * 60,
    startup_timeout=60 * 30,
    max_containers=MAX_GPU_CONTAINERS,
    min_containers=MIN_CONTAINERS,
    scaledown_window=SCALEDOWN_WINDOW,
    volumes={
        STORAGE_MOUNT: storage_volume,
        MODELS_MOUNT: models_volume.read_only(),
    },
    env=_COMMON_ENV,
    # CPU memory snapshot: captures torch + PIL + numpy import state.
    # Model weights are loaded in snap=False (I/O-bound, not helped by snapshot).
    enable_memory_snapshot=True,
)
class TableExtractor:
    @modal.enter(snap=True)
    def preload_libraries(self) -> None:
        """Import CPU-safe libraries before snapshot (captured for all future restores)."""
        import torch  # noqa: F401
        import torchvision  # noqa: F401
        from PIL import Image  # noqa: F401
        import numpy as np  # noqa: F401
        import cv2  # noqa: F401

    @modal.enter(snap=False)
    def load_models(self) -> None:
        """Load model weights onto GPU after snapshot restore.

        Re-import torch here to reinitialize CUDA state after snapshot, then
        eagerly load both Surya and TDATR so the first request has zero model
        cold-start delay.
        """
        # Clear cached settings so env vars are re-read after snapshot restore.
        from app.config import get_settings
        get_settings.cache_clear()

        import torch  # re-import to reinitialize GPU availability post-snapshot
        if torch.cuda.is_available():
            print(f"[TableExtractor] GPU: {torch.cuda.get_device_name(0)}", flush=True)

        from app.database import init_db
        init_db()

        # Surya layout detector
        from app.services.table_pipeline import _get_layout_predictor
        _get_layout_predictor()

        # TDATR structure recognition
        from app.services.tdatr_predictor import _get_tdatr_predictor
        _get_tdatr_predictor()

        print("[TableExtractor] Models ready", flush=True)

    @modal.method()
    def process(self, job_id: str, file_bytes: bytes, suffix: str) -> None:
        """Write the uploaded file and run the extraction pipeline.

        Bytes are passed directly from WebApp so we never depend on cross-container
        Volume visibility.  This container writes the file to its own mount, then
        commits after the job finishes so WebApp containers can read the results.
        """
        from pathlib import Path
        from app.config import get_settings
        from app.services.table_pipeline import process_document

        settings = get_settings()
        file_path = Path(settings.storage_path) / job_id / f"original{suffix}"
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_bytes(file_bytes)

        try:
            process_document(job_id, str(file_path))
        finally:
            storage_volume.commit()


# ---------------------------------------------------------------------------
# WebApp — CPU-only FastAPI class
# ---------------------------------------------------------------------------


@app.cls(
    image=image,
    timeout=300,
    max_containers=MAX_WEB_CONTAINERS,
    # Keep one container always warm so uploads get instant responses.
    min_containers=1,
    scaledown_window=60,
    volumes={STORAGE_MOUNT: storage_volume},
    env={
        **_COMMON_ENV,
        "CORS_ORIGINS": os.getenv(
            "CORS_ORIGINS",
            '["http://localhost:5173","http://localhost:3000","https://table-extraction-front.onrender.com"]',
        ),
    },
    enable_memory_snapshot=True,
)
@modal.concurrent(max_inputs=50, target_inputs=20)
class WebApp:
    @modal.enter(snap=True)
    def preload(self) -> None:
        """Import FastAPI stack for CPU memory snapshot."""
        import fastapi  # noqa: F401
        import pydantic  # noqa: F401

    @modal.enter(snap=False)
    def startup(self) -> None:
        """Initialize DB and reload volume view after snapshot restore."""
        # Clear cached settings so env vars are re-read correctly after snapshot restore.
        from app.config import get_settings
        get_settings.cache_clear()

        # reload() syncs volume state; guard against transient failures so
        # init_db() always runs even if the volume client has a hiccup.
        try:
            storage_volume.reload()
        except Exception as exc:
            print(f"[WebApp] storage_volume.reload() failed (non-fatal): {exc}", flush=True)

        from app.database import init_db
        init_db()

    @modal.asgi_app()
    def serve(self):
        from app.main import app as api
        return api
