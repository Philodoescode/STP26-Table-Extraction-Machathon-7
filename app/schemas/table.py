from typing import Optional
from pydantic import BaseModel


class TableResponse(BaseModel):
    id: str
    job_id: str
    page_num: int
    table_index: int
    bbox: Optional[list[int]] = None
    detection_confidence: float
    crop_url: str


class CellData(BaseModel):
    row: int
    col: int
    text: str
    bbox: Optional[list[int]] = None
    rowspan: int = 1
    colspan: int = 1
    confidence: float = 1.0
    flagged: bool = False
    user_edit: Optional[str] = None


class TablePreviewResponse(BaseModel):
    table_id: str
    rows: list[list[CellData]]
