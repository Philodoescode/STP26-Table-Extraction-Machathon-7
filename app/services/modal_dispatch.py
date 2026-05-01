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
_GPU_ROUTING_MODE: str = os.getenv("MODAL_GPU_ROUTING_MODE", "pool").lower()
_GPU_SHARDS: int = max(1, int(os.getenv("MODAL_GPU_SHARDS", "2")))


def _next_shard_round_robin() -> int:
    """Pick next shard using a global sqlite-backed round-robin counter."""
    from app.database import get_db

    with get_db() as conn:
        conn.execute("BEGIN IMMEDIATE")
        row = conn.execute(
            "SELECT value FROM routing_state WHERE key_name = 'gpu_shard_rr'"
        ).fetchone()
        current = int(row["value"]) if row is not None else 0
        shard = current % _GPU_SHARDS
        conn.execute(
            """
            INSERT INTO routing_state (key_name, value)
            VALUES ('gpu_shard_rr', ?)
            ON CONFLICT(key_name) DO UPDATE SET value = excluded.value
            """,
            [current + 1],
        )
        return shard


def _route_key_for_job(job_id: str) -> str:
    """Select a TableExtractor route key.

    Routing modes:
      - pool   : all jobs use a single shared pool (legacy behavior)
      - shard  : round-robin across N fixed pools (good for warm parallel pools)
    """
    if _GPU_ROUTING_MODE == "pool":
        return "pool-0"

    # Default and fallback: shard routing.
    shard = _next_shard_round_robin()
    return f"shard-{shard}"


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
    route_key = _route_key_for_job(job_id)
    payload = await extractor_cls(route_key=route_key).process.remote.aio(job_id, file_bytes, suffix)
    table_count = len(payload.get("table_results", [])) if isinstance(payload, dict) else 0
    logger.info(
        "modal_run_done job_id=%s route_key=%s table_count=%s mode=%s shards=%s",
        job_id,
        route_key,
        table_count,
        _GPU_ROUTING_MODE,
        _GPU_SHARDS,
    )
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
