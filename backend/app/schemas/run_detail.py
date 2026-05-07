from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime


class FileDiffBase(BaseModel):
    file_path: str
    change_type: str
    diff_content: str


class FileDiffCreate(FileDiffBase):
    run_id: UUID


class FileDiffResponse(FileDiffBase):
    id: UUID
    run_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True


class FileDiffListResponse(BaseModel):
    diffs: List[FileDiffResponse]


class AgentStepBase(BaseModel):
    step_order: int
    step_type: str
    status: str


class AgentStepCreate(AgentStepBase):
    run_id: UUID


class AgentStepResponse(AgentStepBase):
    id: UUID
    run_id: UUID
    created_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AgentStepListResponse(BaseModel):
    steps: List[AgentStepResponse]
