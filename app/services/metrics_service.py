"""
Service layer for operational metrics and time-series history.

Handles the business logic for:
- GET /api/v1/metrics
- GET /api/v1/metrics/history
"""

from __future__ import annotations

import math
import re
import sqlite3
from datetime import datetime, timedelta, timezone

from app.schemas.metrics import (
    MetricsHistoryPoint,
    MetricsHistoryResponse,
    MetricsSnapshot,
)

# ── Allowed windows / granularities for the history endpoint ─────────────────

_DURATION_RE = re.compile(r"^(\d+)([mhd])$")

_UNIT_MAP = {
    "m": "minutes",
    "h": "hours",
    "d": "days",
}


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
        mem_total = torch.cuda.get_device_properties(0).total_mem
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

    return MetricsSnapshot(
        total_jobs=total,
        success_count=success,
        failure_count=failure,
        avg_latency_ms=avg_lat,
        p95_latency_ms=p95,
        jobs_per_minute=jpm,
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
