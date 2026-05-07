from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
from uuid import UUID
from app.core import get_db
from app.models import ToolCall, ApprovalRequest, ApprovalStatus, ApprovalDecision
from app.schemas import ToolCallResponse, ToolCallListResponse, ApprovalRequestResponse, ApprovalListResponse

router = APIRouter(prefix="/tool-calls", tags=["tool-calls"])


@router.get("/{tool_call_id}", response_model=ToolCallResponse)
async def get_tool_call(tool_call_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ToolCall).where(ToolCall.id == tool_call_id))
    tool_call = result.scalar_one_or_none()
    if not tool_call:
        raise HTTPException(status_code=404, detail="Tool call not found")
    return tool_call


# Approvals router
approval_router = APIRouter(prefix="/approvals", tags=["approvals"])


@approval_router.get("/pending", response_model=ApprovalListResponse)
async def list_pending_approvals(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ApprovalRequest)
        .where(ApprovalRequest.status == ApprovalStatus.PENDING)
        .order_by(ApprovalRequest.created_at.desc())
    )
    approvals = result.scalars().all()
    return ApprovalListResponse(approvals=approvals)


@approval_router.get("/{approval_id}", response_model=ApprovalRequestResponse)
async def get_approval(approval_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ApprovalRequest).where(ApprovalRequest.id == approval_id))
    approval = result.scalar_one_or_none()
    if not approval:
        raise HTTPException(status_code=404, detail="Approval not found")
    return approval


@approval_router.post("/{approval_id}/approve", response_model=ApprovalRequestResponse)
async def approve_tool_call(
    approval_id: UUID,
    reason: str = None,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ApprovalRequest).where(ApprovalRequest.id == approval_id))
    approval = result.scalar_one_or_none()
    if not approval:
        raise HTTPException(status_code=404, detail="Approval not found")

    if approval.status != ApprovalStatus.PENDING:
        raise HTTPException(status_code=400, detail="Approval already resolved")

    approval.decision = ApprovalDecision.APPROVED
    approval.decision_reason = reason
    approval.status = ApprovalStatus.RESOLVED
    approval.decided_by = "user"  # TODO: Get from auth
    approval.decided_at = datetime.utcnow()

    await db.flush()

    # TODO: Notify agent worker to resume with approval

    return approval


@approval_router.post("/{approval_id}/reject", response_model=ApprovalRequestResponse)
async def reject_tool_call(
    approval_id: UUID,
    reason: str = None,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ApprovalRequest).where(ApprovalRequest.id == approval_id))
    approval = result.scalar_one_or_none()
    if not approval:
        raise HTTPException(status_code=404, detail="Approval not found")

    if approval.status != ApprovalStatus.PENDING:
        raise HTTPException(status_code=400, detail="Approval already resolved")

    approval.decision = ApprovalDecision.REJECTED
    approval.decision_reason = reason
    approval.status = ApprovalStatus.RESOLVED
    approval.decided_by = "user"  # TODO: Get from auth
    approval.decided_at = datetime.utcnow()

    await db.flush()

    # TODO: Notify agent worker to resume with rejection

    return approval


@approval_router.post("/{approval_id}/edit", response_model=ApprovalRequestResponse)
async def edit_tool_call(
    approval_id: UUID,
    edited_args: dict,
    reason: str = None,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ApprovalRequest).where(ApprovalRequest.id == approval_id))
    approval = result.scalar_one_or_none()
    if not approval:
        raise HTTPException(status_code=404, detail="Approval not found")

    if approval.status != ApprovalStatus.PENDING:
        raise HTTPException(status_code=400, detail="Approval already resolved")

    approval.decision = ApprovalDecision.EDITED
    approval.edited_args = edited_args
    approval.decision_reason = reason
    approval.status = ApprovalStatus.RESOLVED
    approval.decided_by = "user"  # TODO: Get from auth
    approval.decided_at = datetime.utcnow()

    await db.flush()

    # TODO: Notify agent worker to resume with edited args

    return approval
