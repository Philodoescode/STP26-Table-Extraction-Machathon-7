# CUDA 12.8 + cuDNN runtime — requires host driver >= 570.x
FROM nvidia/cuda:12.8.0-cudnn-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# ── system deps ──────────────────────────────────────────────────────────────
# deadsnakes PPA for Python 3.12 (Ubuntu 22.04 ships 3.10 by default)
RUN apt-get update && apt-get install -y --no-install-recommends \
        software-properties-common curl git build-essential \
    && add-apt-repository ppa:deadsnakes/ppa \
    && apt-get update && apt-get install -y --no-install-recommends \
        python3.12 python3.12-dev python3.12-venv \
        poppler-utils \
        tesseract-ocr tesseract-ocr-ara \
        libgl1-mesa-glx libglib2.0-0 libsm6 libxext6 libxrender1 \
    && rm -rf /var/lib/apt/lists/*

# bootstrap pip for 3.12 and set default python / pip
RUN curl -sS https://bootstrap.pypa.io/get-pip.py | python3.12 \
    && ln -sf /usr/bin/python3.12 /usr/local/bin/python \
    && ln -sf /usr/local/bin/pip   /usr/local/bin/pip3

WORKDIR /app

# ── step 1 : setuptools / wheel ───────────────────────────────────────────────
RUN pip install -U setuptools wheel

# ── step 2 : PyTorch with CUDA 12.8 wheels ───────────────────────────────────
# Install before the pip downgrade so the cu128 resolver works cleanly.
RUN pip install \
      --index-url https://download.pytorch.org/whl/cu128 \
      torch==2.11.0+cu128 \
      torchvision==0.26.0+cu128 \
      torchaudio==2.11.0+cu128

# ── step 3 : downgrade pip (required by some transitive deps) ─────────────────
RUN pip install "pip<24.1"

# ── step 4 : main requirements ───────────────────────────────────────────────
COPY backend-requirements.txt .
RUN pip install --no-cache-dir -r backend-requirements.txt

# ── step 5 : surya-ocr ───────────────────────────────────────────────────────
RUN pip install surya-ocr==0.17.1

# ── step 6 : Python 3.12-compatible Hydra/OmegaConf pins ─────────────────────
RUN pip install --no-cache-dir hydra-core==1.3.2 omegaconf==2.3.0

# ── application code ─────────────────────────────────────────────────────────
COPY app/ ./app/

# Bundled TDATR model code (no external volume mount needed)
# Checkpoint (.pt) and Surya model are still volume-mounted (large binaries)
COPY TDATR/ ./TDATR/

# Storage directory (will be overridden by volume mount at runtime)
RUN mkdir -p /app/storage


# ── healthcheck ──────────────────────────────────────────────────────────────
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s \
  CMD curl -f http://localhost:8000/health || exit 1

EXPOSE 8000

CMD ["uvicorn", "app.main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "1"]
