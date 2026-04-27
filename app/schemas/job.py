from typing import Optional
from pydantic import BaseModel


class JobResponse(BaseModel):
    job_id: str
    filename: str
    status: str
    stage: Optional[str] = None
    progress: int = 0
    error: Optional[str] = None
    created_at: str
    started_at: Optional[str] = None
    finished_at: Optional[str] = None
    latency_ms: Optional[int] = None
