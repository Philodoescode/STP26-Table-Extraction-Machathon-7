"""
Service layer for operational metrics and time-series history.

Handles the business logic for:
- GET /api/v1/metrics
- GET /api/v1/metrics/history
"""

from __future__ import annotations

import json
import logging
import math
import os
import re
import sqlite3
import subprocess
import sys
from shutil import which
from datetime import datetime, timedelta, timezone

from app.schemas.metrics import (
    MetricsHistoryPoint,
    MetricsHistoryResponse,
    MetricsSnapshot,
)

logger = logging.getLogger(__name__)

# ── Allowed windows / granularities for the history endpoint ─────────────────

_DURATION_RE = re.compile(r"^(\d+)([mhd])$")

_UNIT_MAP = {
    "m": "minutes",
    "h": "hours",
    "d": "days",
}

_METRICS_MODAL_TOKEN_ID = os.getenv(
    "MODAL_METRICS_TOKEN_ID",
    "ak-W0NrRmdAmhDpzAdhCcLlSU",
)
_METRICS_MODAL_TOKEN_SECRET = os.getenv(
    "MODAL_METRICS_TOKEN_SECRET",
    "as-ThPhw7M2Yz8gJg2NzDM0Ij",
)


def _trim_log_text(value: str, max_chars: int = 1200) -> str:
    value = (value or "").strip()
    if len(value) <= max_chars:
        return value
    return f"{value[:max_chars]}...<trimmed>"


def _redact_cmd(cmd: list[str]) -> str:
    masked = list(cmd)
    for i, part in enumerate(masked):
        if part == "--token-secret" and i + 1 < len(masked):
            masked[i + 1] = "***REDACTED***"
    return " ".join(masked)


def _run_subprocess_logged(cmd: list[str], timeout: int = 8) -> subprocess.CompletedProcess[str]:
    return _run_subprocess_logged_env(cmd, timeout=timeout, env=None)


def _run_subprocess_logged_env(
    cmd: list[str],
    timeout: int = 8,
    env: dict[str, str] | None = None,
) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=timeout,
        check=False,
        env=env,
    )
    logger.info(
        "metrics_subprocess cmd=%s rc=%s stdout=%s stderr=%s",
        _redact_cmd(cmd),
        result.returncode,
        _trim_log_text(result.stdout),
        _trim_log_text(result.stderr),
    )
    return result


def _modal_cli_cmd() -> list[str] | None:
    """Return an executable command prefix for Modal CLI in this container."""
    modal_bin = which("modal")
    if modal_bin:
        return [modal_bin]
    # Fallback when CLI entrypoint script is missing from PATH but module exists.
    return [sys.executable, "-m", "modal"]


def _modal_cli_env() -> dict[str, str]:
    """Build subprocess env with Modal auth credentials."""
    env = dict(os.environ)
    if _METRICS_MODAL_TOKEN_ID:
        env["MODAL_TOKEN_ID"] = _METRICS_MODAL_TOKEN_ID
    if _METRICS_MODAL_TOKEN_SECRET:
        env["MODAL_TOKEN_SECRET"] = _METRICS_MODAL_TOKEN_SECRET
    return env


def _parse_duration(value: str) -> timedelta:
    """Parse a compact duration string like '1h', '30m', '7d'."""
    m = _DURATION_RE.match(value)
    if not m:
        raise ValueError(f"Invalid duration format: {value!r}")
    amount = int(m.group(1))
    unit = _UNIT_MAP[m.group(2)]
    return timedelta(**{unit: amount})


# ── Snapshot ─────────────────────────────────────────────────────────────────


def _gpu_info() -> dict:
    """Best-effort GPU info via torch.cuda (no pynvml dependency)."""
    info: dict = {
        "gpu_available": False,
        "gpu_name": None,
        "gpu_utilization_pct": None,
        "gpu_memory_used_mb": None,
        "gpu_memory_total_mb": None,
    }
    try:
        import torch

        if not torch.cuda.is_available():
            return info
        info["gpu_available"] = True
        info["gpu_name"] = torch.cuda.get_device_name(0)

        # Memory stats from torch
        mem_alloc = torch.cuda.memory_allocated(0)
        mem_total = torch.cuda.get_device_properties(0).total_memory
        info["gpu_memory_used_mb"] = round(mem_alloc / (1024 * 1024), 1)
        info["gpu_memory_total_mb"] = round(mem_total / (1024 * 1024), 1)

        # Attempt utilization via pynvml (optional)
        try:
            import pynvml  # type: ignore[import-untyped]

            pynvml.nvmlInit()
            handle = pynvml.nvmlDeviceGetHandleByIndex(0)
            util = pynvml.nvmlDeviceGetUtilizationRates(handle)
            info["gpu_utilization_pct"] = float(util.gpu)
        except Exception:
            pass
    except Exception:
        pass

    return info


def _modal_gpu_containers_up() -> int | None:
    """Get live GPU container count from Modal control-plane container list.

    Uses:
      modal container list --app-id <id> --json

    We subtract one for the always-on WebApp container.
    """
    app_id = os.getenv("MODAL_METRICS_APP_ID", "ap-DsikVzbMtPuiTeEZoXcKc8").strip()
    if not app_id:
        return None
    modal_cmd = _modal_cli_cmd()
    if not modal_cmd:
        return None

    try:
        modal_env = _modal_cli_env()

        result = _run_subprocess_logged_env(
            [*modal_cmd, "container", "list", "--app-id", app_id, "--json"],
            timeout=8,
            env=modal_env,
        )
        if result.returncode != 0:
            logger.warning(
                "modal_container_list_failed app_id=%s token_id=%s",
                app_id,
                _METRICS_MODAL_TOKEN_ID,
            )
            return None

        payload = json.loads(result.stdout or "[]")
        if isinstance(payload, list):
            total_containers = len(payload)
        elif isinstance(payload, dict):
            # Defensive shape handling in case CLI output changes.
            for key in ("containers", "items", "data"):
                value = payload.get(key)
                if isinstance(value, list):
                    total_containers = len(value)
                    break
            else:
                return None
        else:
            return None
        logger.info(
            "modal_container_count app_id=%s total_containers=%s gpu_containers_up=%s",
            app_id,
            total_containers,
            max(total_containers - 1, 0),
        )
        return max(total_containers - 1, 0)
    except Exception:
        logger.exception("modal_gpu_count_failed app_id=%s", app_id)
        return None


def get_snapshot(conn: sqlite3.Connection) -> MetricsSnapshot:
    """Aggregate current job counts, latency percentiles, and GPU info."""
    row = conn.execute(
        """
        SELECT
            COUNT(*)                                       AS total,
            SUM(CASE WHEN status = 'done'   THEN 1 ELSE 0 END) AS success,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failure,
            AVG(latency_ms)                                AS avg_lat
        FROM jobs
        """
    ).fetchone()

    total = row["total"] or 0
    success = row["success"] or 0
    failure = row["failure"] or 0
    avg_lat = round(row["avg_lat"], 2) if row["avg_lat"] is not None else None

    # p95 latency (approximate via sorted array in SQLite)
    p95 = None
    if total > 0:
        latencies = conn.execute(
            "SELECT latency_ms FROM jobs WHERE latency_ms IS NOT NULL "
            "ORDER BY latency_ms"
        ).fetchall()
        if latencies:
            idx = int(math.ceil(0.95 * len(latencies))) - 1
            idx = max(0, min(idx, len(latencies) - 1))
            p95 = float(latencies[idx]["latency_ms"])

    # Rolling jobs-per-minute (last 5 minutes)
    five_min_ago = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
    jpm_row = conn.execute(
        "SELECT COUNT(*) AS cnt FROM jobs "
        "WHERE finished_at IS NOT NULL AND finished_at >= ?",
        [five_min_ago],
    ).fetchone()
    jpm = round((jpm_row["cnt"] or 0) / 5.0, 2)

    gpu = _gpu_info()

    scaledown_window_s = int(os.getenv("MODAL_SCALEDOWN_WINDOW", "120"))
    stale_seconds = scaledown_window_s + 30
    stale_cutoff = (datetime.now(timezone.utc) - timedelta(seconds=stale_seconds)).isoformat()

    gpu_row = conn.execute(
        """
        SELECT
            COUNT(*) AS up_cnt,
            SUM(CASE WHEN active_calls > 0 THEN 1 ELSE 0 END) AS active_cnt,
            SUM(active_calls) AS active_calls,
            COUNT(DISTINCT route_key) AS routes_up
        FROM gpu_container_state
        WHERE is_up = 1
          AND last_heartbeat_at >= ?
        """,
        [stale_cutoff],
    ).fetchone()

    gpu_containers_up = int(gpu_row["up_cnt"] or 0)
    gpu_containers_active = int(gpu_row["active_cnt"] or 0)
    gpu_active_calls = int(gpu_row["active_calls"] or 0)
    gpu_routes_up = int(gpu_row["routes_up"] or 0)

    modal_gpu_up = _modal_gpu_containers_up()
    if modal_gpu_up is not None:
        gpu_containers_up = modal_gpu_up

    return MetricsSnapshot(
        total_jobs=total,
        success_count=success,
        failure_count=failure,
        avg_latency_ms=avg_lat,
        p95_latency_ms=p95,
        jobs_per_minute=jpm,
        gpu_containers_up=gpu_containers_up,
        gpu_containers_active=gpu_containers_active,
        gpu_active_calls=gpu_active_calls,
        gpu_routes_up=gpu_routes_up,
        gpu_max_containers=int(os.getenv("MODAL_MAX_GPU_CONTAINERS", "3")),
        gpu_min_containers=int(os.getenv("MODAL_MIN_GPU_CONTAINERS", "0")),
        gpu_buffer_containers=int(os.getenv("MODAL_GPU_BUFFER_CONTAINERS", "2")),
        gpu_scaledown_window_s=scaledown_window_s,
        gpu_routing_mode=os.getenv("MODAL_GPU_ROUTING_MODE", "pool"),
        gpu_shards=int(os.getenv("MODAL_GPU_SHARDS", "2")),
        **gpu,
    )


# ── History ──────────────────────────────────────────────────────────────────

# SQLite strftime format strings by granularity unit
_GRANULARITY_FMT = {
    "m": "%Y-%m-%dT%H:%M",
    "h": "%Y-%m-%dT%H:00",
    "d": "%Y-%m-%d",
}


def get_history(
    conn: sqlite3.Connection,
    window: str = "1h",
    granularity: str = "5m",
) -> MetricsHistoryResponse:
    """
    Return time-bucketed job metrics within the requested window.

    Uses SQLite ``strftime`` to bucket ``finished_at`` timestamps.
    """
    delta = _parse_duration(window)
    gran_match = _DURATION_RE.match(granularity)
    if not gran_match:
        raise ValueError(f"Invalid granularity: {granularity!r}")

    fmt = _GRANULARITY_FMT.get(gran_match.group(2))
    if fmt is None:
        raise ValueError(f"Unsupported granularity unit: {granularity!r}")

    cutoff = (datetime.now(timezone.utc) - delta).isoformat()

    rows = conn.execute(
        f"""
        SELECT
            strftime('{fmt}', finished_at)             AS bucket,
            COUNT(*)                                   AS cnt,
            AVG(latency_ms)                            AS avg_lat,
            SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS ok
        FROM jobs
        WHERE finished_at IS NOT NULL AND finished_at >= ?
        GROUP BY bucket
        ORDER BY bucket
        """,
        [cutoff],
    ).fetchall()

    data = [
        MetricsHistoryPoint(
            timestamp=r["bucket"],
            latency_ms=round(r["avg_lat"], 2) if r["avg_lat"] is not None else None,
            success_rate=round(r["ok"] / r["cnt"], 4) if r["cnt"] else 0.0,
            job_count=r["cnt"],
        )
        for r in rows
    ]

    return MetricsHistoryResponse(
        window=window,
        granularity=granularity,
        data=data,
    )
