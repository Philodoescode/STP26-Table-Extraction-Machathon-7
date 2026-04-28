"""
Pydantic models for the /api/v1/metrics endpoints.
"""

from typing import Optional

from pydantic import BaseModel


class MetricsSnapshot(BaseModel):
    """Real-time snapshot of system health and performance."""

    total_jobs: int
    success_count: int
    failure_count: int
    avg_latency_ms: Optional[float] = None
    p95_latency_ms: Optional[float] = None
    gpu_available: bool
    gpu_name: Optional[str] = None
    gpu_utilization_pct: Optional[float] = None
    gpu_memory_used_mb: Optional[float] = None
    gpu_memory_total_mb: Optional[float] = None
    jobs_per_minute: float


class MetricsHistoryPoint(BaseModel):
    """Single data-point in a time-series response."""

    timestamp: str
    latency_ms: Optional[float] = None
    success_rate: float
    job_count: int


class MetricsHistoryResponse(BaseModel):
    """Paginated time-series data for dashboarding."""

    window: str
    granularity: str
    data: list[MetricsHistoryPoint]
