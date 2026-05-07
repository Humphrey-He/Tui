from pydantic import BaseModel
from typing import Optional, List, Dict, Any, Literal
from uuid import UUID
from datetime import datetime
from app.models import ToolCallStatus, RiskLevel, ApprovalStatus, ApprovalDecision


class ToolCallBase(BaseModel):
    tool_name: str
    arguments: Dict[str, Any]


class ToolCallCreate(ToolCallBase):
    run_id: UUID


class ToolCallUpdate(BaseModel):
    status: Optional[ToolCallStatus] = None
    result: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None


class ToolCallResponse(ToolCallBase):
    id: UUID
    run_id: UUID
    step_id: Optional[UUID] = None
    status: ToolCallStatus
    risk_level: RiskLevel
    required_permission: Optional[str] = None
    started_at: datetime
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None

    class Config:
        from_attributes = True


class ToolCallListResponse(BaseModel):
    tool_calls: List[ToolCallResponse]


# Approval schemas
class ApprovalDecisionRequest(BaseModel):
    decision: ApprovalDecision
    edited_args: Optional[Dict[str, Any]] = None
    reason: Optional[str] = None


class ApprovalRequestBase(BaseModel):
    requested_action: str
    original_args: Dict[str, Any]


class ApprovalRequestCreate(ApprovalRequestBase):
    run_id: UUID
    tool_call_id: Optional[UUID] = None


class ApprovalRequestResponse(ApprovalRequestBase):
    id: UUID
    run_id: UUID
    tool_call_id: Optional[UUID] = None
    status: ApprovalStatus
    edited_args: Optional[Dict[str, Any]] = None
    decision: Optional[ApprovalDecision] = None
    decision_reason: Optional[str] = None
    decided_by: Optional[str] = None
    decided_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ApprovalListResponse(BaseModel):
    approvals: List[ApprovalRequestResponse]
