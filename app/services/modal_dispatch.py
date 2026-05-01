"""Modal-native job dispatch.

On Modal (DISPATCH_MODE=modal): spawns a TableExtractor.process() call that
runs asynchronously on a GPU container.  The HTTP upload endpoint returns
immediately; processing happens in the background.

Locally (DISPATCH_MODE unset): falls back to the in-process thread-based job
queue so local development still works without Modal.
"""

from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)

_APP_NAME: str = os.getenv("MODAL_APP_NAME", "table-extraction-api")


async def spawn_document_processing(
    job_id: str,
    file_path: str,
    file_bytes: bytes = b"",
    suffix: str = "",
) -> str | None:
    """Dispatch document processing and return the Modal call ID (or None locally).

    On Modal, passes file bytes directly to TableExtractor so it writes the file
    to its own volume mount — no cross-container Volume visibility issues.

    Locally, enqueues to the in-process thread pool using the saved file path.
    """
    if os.getenv("DISPATCH_MODE") == "modal":
        return await _spawn_modal(job_id, file_bytes, suffix)
    return _enqueue_local(job_id, file_path)


async def _spawn_modal(job_id: str, file_bytes: bytes, suffix: str) -> str:
    import modal

    extractor_cls = modal.Cls.from_name(_APP_NAME, "TableExtractor")
    call = await extractor_cls().process.spawn.aio(job_id, file_bytes, suffix)
    logger.info("modal_spawn job_id=%s call_id=%s", job_id, call.object_id)
    return call.object_id


def _enqueue_local(job_id: str, file_path: str) -> None:
    from app.services.job_queue import get_job_queue
    get_job_queue().enqueue(job_id, file_path)
    logger.info("local_enqueue job_id=%s", job_id)
    return None
