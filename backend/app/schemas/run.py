from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime
from app.models import RunStatus


class RunBase(BaseModel):
    model: Optional[str] = "gpt-4o"


class RunCreate(RunBase):
    session_id: UUID
    messages: List[Dict[str, str]]


class RunUpdate(BaseModel):
    status: Optional[RunStatus] = None


class RunResponse(RunBase):
    id: UUID
    project_id: UUID
    session_id: UUID
    status: RunStatus
    started_by: str
    started_at: datetime
    completed_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    error_message: Optional[str] = None
    total_tokens: int
    estimated_cost: float

    class Config:
        from_attributes = True


class RunListResponse(BaseModel):
    runs: List[RunResponse]
    total: int
