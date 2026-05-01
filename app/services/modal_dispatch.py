"""Modal-native job execution.

On Modal (DISPATCH_MODE=modal): calls TableExtractor.process() and awaits its
return payload from the GPU container.

Locally (DISPATCH_MODE unset): runs the same pipeline in-process on a worker
thread and returns the same payload shape.
"""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Any, Callable

logger = logging.getLogger(__name__)

_APP_NAME: str = os.getenv("MODAL_APP_NAME", "table-extraction-api")


async def run_document_processing(
    job_id: str,
    file_path: str,
    file_bytes: bytes = b"",
    suffix: str = "",
    progress_cb: Callable[..., None] | None = None,
) -> dict[str, Any]:
    """Run document processing and return the final extraction payload.

    On Modal, sends bytes directly to TableExtractor and awaits its return.
    Locally, runs the same pipeline in-process on a worker thread.
    """
    if os.getenv("DISPATCH_MODE") == "modal":
        return await _run_modal(job_id, file_bytes, suffix)
    return await _run_local(job_id, file_path, progress_cb=progress_cb)


async def _run_modal(job_id: str, file_bytes: bytes, suffix: str) -> dict[str, Any]:
    import modal

    extractor_cls = modal.Cls.from_name(_APP_NAME, "TableExtractor")
    payload = await extractor_cls().process.remote.aio(job_id, file_bytes, suffix)
    table_count = len(payload.get("table_results", [])) if isinstance(payload, dict) else 0
    logger.info("modal_run_done job_id=%s table_count=%s", job_id, table_count)
    return payload if isinstance(payload, dict) else {}


async def _run_local(
    job_id: str,
    file_path: str,
    progress_cb: Callable[..., None] | None = None,
) -> dict[str, Any]:
    from app.services.table_pipeline import run_document_pipeline

    table_results, latency_ms = await asyncio.to_thread(
        run_document_pipeline,
        job_id,
        file_path,
        progress_cb=progress_cb,
    )
    logger.info("local_run_done job_id=%s table_count=%s", job_id, len(table_results))
    return {"table_results": table_results, "latency_ms": latency_ms}
