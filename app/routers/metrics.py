"""
Routes for operational metrics and dashboarding.

GET /api/v1/metrics
GET /api/v1/metrics/history
"""

from fastapi import APIRouter, Query

from app.database import get_db
from app.schemas.metrics import MetricsHistoryResponse, MetricsSnapshot
from app.services.metrics_service import get_history, get_snapshot

router = APIRouter(prefix="/api/v1")


@router.get(
    "/metrics",
    response_model=MetricsSnapshot,
    summary="Real-time system metrics snapshot",
)
def metrics_snapshot():
    """
    Return a real-time snapshot of system health including:

    - **Job counts**: total, success, failure
    - **Latency**: average and p95 (ms)
    - **GPU**: availability, name, utilization, memory
    - **Throughput**: jobs-per-minute rolling window (5 min)
    """
    with get_db() as conn:
        return get_snapshot(conn)


@router.get(
    "/metrics/history",
    response_model=MetricsHistoryResponse,
    summary="Time-series metrics for dashboarding",
)
def metrics_history(
    window: str = Query(
        default="1h",
        description="Lookback window, e.g. '30m', '1h', '7d'",
        pattern=r"^\d+[mhd]$",
    ),
    granularity: str = Query(
        default="5m",
        description="Bucket size, e.g. '1m', '5m', '1h', '1d'",
        pattern=r"^\d+[mhd]$",
    ),
):
    """
    Return time-bucketed metrics within the requested window.

    Each data point contains ``timestamp``, ``latency_ms``,
    ``success_rate``, and ``job_count``.
    """
    with get_db() as conn:
        return get_history(conn, window=window, granularity=granularity)
