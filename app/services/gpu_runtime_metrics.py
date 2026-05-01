from __future__ import annotations

from datetime import datetime, timezone

from app.database import get_db
from app.services.modal_volume import commit_storage


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def mark_container_up(container_key: str, route_key: str, hostname: str) -> None:
    now = _now_iso()
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO gpu_container_state
                (container_key, route_key, hostname, is_up, active_calls, started_at, last_heartbeat_at, last_down_at)
            VALUES (?, ?, ?, 1, 0, ?, ?, NULL)
            ON CONFLICT(container_key) DO UPDATE SET
                route_key = excluded.route_key,
                hostname = excluded.hostname,
                is_up = 1,
                last_heartbeat_at = excluded.last_heartbeat_at,
                last_down_at = NULL
            """,
            [container_key, route_key, hostname, now, now],
        )
    # Ensure other containers can observe the state update quickly.
    commit_storage(strict=False)


def mark_container_down(container_key: str) -> None:
    now = _now_iso()
    with get_db() as conn:
        conn.execute(
            """
            UPDATE gpu_container_state
            SET is_up = 0,
                active_calls = 0,
                last_heartbeat_at = ?,
                last_down_at = ?
            WHERE container_key = ?
            """,
            [now, now, container_key],
        )
    commit_storage(strict=False)


def begin_call(container_key: str) -> None:
    now = _now_iso()
    with get_db() as conn:
        conn.execute(
            """
            UPDATE gpu_container_state
            SET is_up = 1,
                active_calls = active_calls + 1,
                last_heartbeat_at = ?
            WHERE container_key = ?
            """,
            [now, container_key],
        )
    commit_storage(strict=False)


def end_call(container_key: str) -> None:
    now = _now_iso()
    with get_db() as conn:
        conn.execute(
            """
            UPDATE gpu_container_state
            SET active_calls = CASE WHEN active_calls > 0 THEN active_calls - 1 ELSE 0 END,
                last_heartbeat_at = ?
            WHERE container_key = ?
            """,
            [now, container_key],
        )
    commit_storage(strict=False)
