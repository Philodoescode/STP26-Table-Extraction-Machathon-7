"""Small retry helper for transient read-path API failures."""

from __future__ import annotations

import logging
import sqlite3
import time
from collections.abc import Callable
from typing import TypeVar

from fastapi import HTTPException
from starlette import status

logger = logging.getLogger(__name__)

T = TypeVar("T")

_TRANSIENT_404_CODES = {"NOT_FOUND", "FILE_MISSING"}


def _is_transient(exc: Exception) -> bool:
    if isinstance(exc, sqlite3.OperationalError):
        return True
    if isinstance(exc, HTTPException) and exc.status_code == 404 and isinstance(exc.detail, dict):
        return exc.detail.get("code") in _TRANSIENT_404_CODES
    return False


def run_with_read_retries(
    action: Callable[[], T],
    *,
    reload_before_attempt: Callable[[], None] | None = None,
    eager_reload: bool = False,
    attempts: int = 3,
    base_delay_s: float = 0.15,
) -> T:
    """Run a read operation with small bounded retries for transient failures."""
    last_exc: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            if reload_before_attempt is not None and (eager_reload or attempt > 1):
                reload_before_attempt()
            return action()
        except Exception as exc:
            if not _is_transient(exc) or attempt == attempts:
                if _is_transient(exc):
                    logger.warning(
                        "Read path exhausted retries (%d attempts): %s",
                        attempts,
                        exc,
                    )
                    raise HTTPException(
                        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                        detail={
                            "detail": "Temporary backend storage inconsistency. Please retry.",
                            "code": "TEMPORARY_UNAVAILABLE",
                        },
                    ) from exc
                raise
            last_exc = exc
            sleep_s = base_delay_s * attempt
            logger.debug(
                "Transient read failure on attempt %d/%d; retrying in %.2fs: %s",
                attempt,
                attempts,
                sleep_s,
                exc,
            )
            time.sleep(sleep_s)
    # Unreachable in normal control flow; keeps type checkers happy.
    assert last_exc is not None
    raise last_exc
