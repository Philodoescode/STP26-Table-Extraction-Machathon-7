from contextlib import asynccontextmanager

import torch
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import init_db
from app.routers import health, jobs, metrics, preview, upload


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    if torch.cuda.is_available():
        print(f"[startup] GPU: {torch.cuda.get_device_name(0)}", flush=True)
    else:
        print("[startup] No GPU — running on CPU", flush=True)
    yield


settings = get_settings()

app = FastAPI(
    title="Table Extraction API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(upload.router)
app.include_router(jobs.router)
app.include_router(preview.router)
app.include_router(metrics.router)
