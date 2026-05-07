from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime


class SessionBase(BaseModel):
    name: str


class SessionCreate(SessionBase):
    project_id: UUID


class SessionUpdate(BaseModel):
    name: Optional[str] = None


class SessionResponse(SessionBase):
    id: UUID
    project_id: UUID
    created_at: datetime
    updated_at: datetime
    last_run_id: Optional[UUID] = None

    class Config:
        from_attributes = True


class SessionListResponse(BaseModel):
    sessions: List[SessionResponse]
    total: int


class MessageBase(BaseModel):
    role: str
    content: str


class MessageCreate(MessageBase):
    pass


class MessageResponse(MessageBase):
    id: UUID
    session_id: UUID
    run_id: Optional[UUID] = None
    created_at: datetime

    class Config:
        from_attributes = True


class MessageListResponse(BaseModel):
    messages: List[MessageResponse]
