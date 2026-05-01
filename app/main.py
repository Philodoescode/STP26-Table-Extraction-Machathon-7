from contextlib import asynccontextmanager
import logging
import os
import time

from fastapi import FastAPI
from fastapi import Request
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import init_db
from app.routers import health, jobs, metrics, preview, upload
from app.services.modal_logging import modal_input_label

logger = logging.getLogger(__name__)

_ON_MODAL = os.getenv("DISPATCH_MODE") == "modal"


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()

    if _ON_MODAL:
        # On Modal, TableExtractor handles GPU processing via direct RPC.
        # No local thread pool needed; avoid importing torch at web-server startup.
        try:
            import modal
            print(f"[startup] Modal web container — dispatch via {os.getenv('MODAL_APP_NAME')}.TableExtractor", flush=True)
        except ImportError:
            pass
    else:
        # Local dev: use the in-process thread pool as before.
        import torch
        from app.services.job_queue import start_job_queue, stop_job_queue as _stop
        start_job_queue()
        if torch.cuda.is_available():
            print(f"[startup] GPU: {torch.cuda.get_device_name(0)}", flush=True)
        else:
            print("[startup] No GPU — running on CPU", flush=True)

    yield

    if not _ON_MODAL:
        from app.services.job_queue import stop_job_queue
        stop_job_queue()


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


@app.middleware("http")
async def log_requests(request: Request, call_next):
    input_id = modal_input_label()
    method = request.method
    path = request.url.path
    started = time.perf_counter()
    logger.info("%s request_start method=%s path=%s", input_id, method, path)
    try:
        response = await call_next(request)
    except Exception:
        elapsed_ms = int((time.perf_counter() - started) * 1000)
        logger.exception(
            "%s request_error method=%s path=%s duration_ms=%s",
            input_id,
            method,
            path,
            elapsed_ms,
        )
        raise
    elapsed_ms = int((time.perf_counter() - started) * 1000)
    logger.info(
        "%s request_end method=%s path=%s status=%s duration_ms=%s",
        input_id,
        method,
        path,
        response.status_code,
        elapsed_ms,
    )
    return response


app.include_router(health.router)
app.include_router(upload.router)
app.include_router(jobs.router)
app.include_router(preview.router)
app.include_router(metrics.router)
