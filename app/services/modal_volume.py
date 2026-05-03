"""Helpers for Modal Volume cross-container consistency.

When the GPU container (TableExtractor) writes to the shared SQLite database
and filesystem, those writes must be committed so the web containers can see
them.  Conversely, web containers must reload before reading to pick up the
latest committed state.

Both helpers are no-ops when running locally (DISPATCH_MODE != "modal") so
the local dev workflow is unaffected.
"""

from __future__ import annotations

import asyncio
from contextlib import contextmanager
import logging
import os
import threading
import time

logger = logging.getLogger(__name__)

_VOL_NAME: str | None = None
_vol_cache = None
_storage_io_lock = threading.RLock()
_last_reload_at = 0.0
_reload_min_interval_s = float(os.getenv("MODAL_RELOAD_MIN_INTERVAL_S", "0.75"))


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


@contextmanager
def storage_io_guard():
    """Serialize volume reloads and DB/file access in a container.

    Modal docs note that during reload(), the mounted volume can appear empty to
    that container. Guarding storage I/O with this lock prevents reload/DB races
    that can surface as sqlite "unable to open database file".
    """
    if os.getenv("DISPATCH_MODE") != "modal":
        yield
        return
    with _storage_io_lock:
        yield


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
    global _last_reload_at
    try:
        with _storage_io_lock:
            now = time.monotonic()
            if now - _last_reload_at < _reload_min_interval_s:
                return
            vol.reload()
            _last_reload_at = now
    except Exception as exc:
        logger.debug("Volume reload failed (non-fatal): %s", exc)


def commit_storage(
    *,
    strict: bool = False,
    attempts: int = 3,
    base_delay_s: float = 0.1,
) -> bool:
    """Push pending writes to the storage volume backend (sync, for use in sync contexts).

    Call after writing to SQLite or the filesystem so other containers see the
    changes immediately.  No-op outside Modal.
    """
    if os.getenv("DISPATCH_MODE") != "modal":
        return True
    vol = _get_volume()
    if vol is None:
        if strict:
            raise RuntimeError("Could not obtain Modal volume reference for commit")
        return False

    last_exc: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            with _storage_io_lock:
                vol.commit()
            return True
        except Exception as exc:
            last_exc = exc
            if attempt < attempts:
                time.sleep(base_delay_s * attempt)
                continue
            if strict:
                raise RuntimeError(f"Volume commit failed after {attempts} attempts") from exc
            logger.warning("Volume commit failed after %d attempts: %s", attempts, exc)
            return False
    if strict and last_exc is not None:
        raise RuntimeError("Volume commit failed") from last_exc
    return False


async def commit_storage_async(
    *,
    strict: bool = False,
    attempts: int = 3,
    base_delay_s: float = 0.1,
) -> bool:
    """Async version of commit_storage for use inside async FastAPI handlers.

    Uses vol.commit.aio() to avoid blocking the event loop.
    No-op outside Modal.
    """
    if os.getenv("DISPATCH_MODE") != "modal":
        return True
    vol = _get_volume()
    if vol is None:
        if strict:
            raise RuntimeError("Could not obtain Modal volume reference for commit")
        return False

    last_exc: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            await vol.commit.aio()
            return True
        except Exception as exc:
            last_exc = exc
            if attempt < attempts:
                await asyncio.sleep(base_delay_s * attempt)
                continue
            if strict:
                raise RuntimeError(f"Volume commit failed after {attempts} attempts") from exc
            logger.warning("Volume commit failed after %d attempts: %s", attempts, exc)
            return False
    if strict and last_exc is not None:
        raise RuntimeError("Volume commit failed") from last_exc
    return False
