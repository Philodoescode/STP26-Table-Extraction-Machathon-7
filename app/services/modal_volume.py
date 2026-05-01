"""Helpers for Modal Volume cross-container consistency.

When the GPU container (TableExtractor) writes to the shared SQLite database
and filesystem, those writes must be committed so the web containers can see
them.  Conversely, web containers must reload before reading to pick up the
latest committed state.

Both helpers are no-ops when running locally (DISPATCH_MODE != "modal") so
the local dev workflow is unaffected.
"""

from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)

_VOL_NAME: str | None = None
_vol_cache = None


def _get_volume():
    global _VOL_NAME, _vol_cache
    if _vol_cache is not None:
        return _vol_cache
    if _VOL_NAME is None:
        _VOL_NAME = os.getenv("MODAL_STORAGE_VOLUME", "table-extraction-storage")
    try:
        import modal
        _vol_cache = modal.Volume.from_name(_VOL_NAME)
        return _vol_cache
    except Exception as exc:
        logger.debug("Could not obtain Modal volume reference: %s", exc)
        return None


def reload_storage() -> None:
    """Sync this container's view of the storage volume.

    Call before reading job status from SQLite so the latest writes from GPU
    containers are visible.  No-op outside Modal.
    """
    if os.getenv("DISPATCH_MODE") != "modal":
        return
    vol = _get_volume()
    if vol is None:
        return
    try:
        vol.reload()
    except Exception as exc:
        logger.debug("Volume reload failed (non-fatal): %s", exc)


def commit_storage() -> None:
    """Push pending writes to the storage volume backend (sync, for use in sync contexts).

    Call after writing to SQLite or the filesystem so other containers see the
    changes immediately.  No-op outside Modal.
    """
    if os.getenv("DISPATCH_MODE") != "modal":
        return
    vol = _get_volume()
    if vol is None:
        return
    try:
        vol.commit()
    except Exception as exc:
        logger.debug("Volume commit failed (non-fatal): %s", exc)


async def commit_storage_async() -> None:
    """Async version of commit_storage for use inside async FastAPI handlers.

    Uses vol.commit.aio() to avoid blocking the event loop.
    No-op outside Modal.
    """
    if os.getenv("DISPATCH_MODE") != "modal":
        return
    vol = _get_volume()
    if vol is None:
        return
    try:
        await vol.commit.aio()
    except Exception as exc:
        logger.debug("Volume commit failed (non-fatal): %s", exc)
