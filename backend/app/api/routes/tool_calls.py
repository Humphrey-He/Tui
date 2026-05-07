from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
from uuid import UUID
from app.core import get_db
from app.models import ToolCall, ApprovalRequest, ApprovalStatus, ApprovalDecision, RunStatus
from app.schemas import ToolCallResponse, ToolCallListResponse, ApprovalRequestResponse, ApprovalListResponse
from app.services.audit import log_approval_decision

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
    """Approve a pending tool call."""
    from app.models import Run

    result = await db.execute(select(ApprovalRequest).where(ApprovalRequest.id == approval_id))
    approval = result.scalar_one_or_none()
    if not approval:
        raise HTTPException(status_code=404, detail="Approval not found")

    if approval.status != ApprovalStatus.PENDING:
        raise HTTPException(status_code=400, detail="Approval already resolved")

    # Get run for project_id
    run_result = await db.execute(select(Run).where(Run.id == approval.run_id))
    run = run_result.scalar_one_or_none()
    project_id = run.project_id if run else approval.run_id

    # Update approval
    approval.decision = ApprovalDecision.APPROVED
    approval.decision_reason = reason
    approval.status = ApprovalStatus.RESOLVED
    approval.decided_by = "user"  # TODO: Get from auth
    approval.decided_at = datetime.utcnow()

    # Update tool call status
    if approval.tool_call_id:
        tool_result = await db.execute(
            select(ToolCall).where(ToolCall.id == approval.tool_call_id)
        )
        tool_call = tool_result.scalar_one_or_none()
        if tool_call:
            tool_call.status = "running"

    await db.flush()

    # Log audit
    await log_approval_decision(
        project_id=project_id,
        approval_id=approval.id,
        decision=ApprovalDecision.APPROVED,
        reason=reason,
    )

    # Emit event to notify agent runtime
    from app.services.events import emit_run_event, EventType
    await emit_run_event(
        approval.run_id,
        EventType.APPROVAL_RESOLVED,
        {
            "approval_id": str(approval.id),
            "decision": "approved",
            "tool_call_id": str(approval.tool_call_id) if approval.tool_call_id else None,
            "edited_args": None,
        },
    )

    await db.commit()
    await db.refresh(approval)
    return approval


@approval_router.post("/{approval_id}/reject", response_model=ApprovalRequestResponse)
async def reject_tool_call(
    approval_id: UUID,
    reason: str = None,
    db: AsyncSession = Depends(get_db),
):
    """Reject a pending tool call."""
    from app.models import Run

    result = await db.execute(select(ApprovalRequest).where(ApprovalRequest.id == approval_id))
    approval = result.scalar_one_or_none()
    if not approval:
        raise HTTPException(status_code=404, detail="Approval not found")

    if approval.status != ApprovalStatus.PENDING:
        raise HTTPException(status_code=400, detail="Approval already resolved")

    # Get run for project_id
    run_result = await db.execute(select(Run).where(Run.id == approval.run_id))
    run = run_result.scalar_one_or_none()
    project_id = run.project_id if run else approval.run_id

    # Update approval
    approval.decision = ApprovalDecision.REJECTED
    approval.decision_reason = reason
    approval.status = ApprovalStatus.RESOLVED
    approval.decided_by = "user"  # TODO: Get from auth
    approval.decided_at = datetime.utcnow()

    # Update tool call status
    if approval.tool_call_id:
        tool_result = await db.execute(
            select(ToolCall).where(ToolCall.id == approval.tool_call_id)
        )
        tool_call = tool_result.scalar_one_or_none()
        if tool_call:
            tool_call.status = "rejected"

    await db.flush()

    # Log audit
    await log_approval_decision(
        project_id=project_id,
        approval_id=approval.id,
        decision=ApprovalDecision.REJECTED,
        reason=reason,
    )

    # Emit event to notify agent runtime
    from app.services.events import emit_run_event, EventType
    await emit_run_event(
        approval.run_id,
        EventType.APPROVAL_RESOLVED,
        {
            "approval_id": str(approval.id),
            "decision": "rejected",
            "tool_call_id": str(approval.tool_call_id) if approval.tool_call_id else None,
        },
    )

    await db.commit()
    await db.refresh(approval)
    return approval


@approval_router.post("/{approval_id}/edit", response_model=ApprovalRequestResponse)
async def edit_tool_call(
    approval_id: UUID,
    edited_args: dict,
    reason: str = None,
    db: AsyncSession = Depends(get_db),
):
    """Approve a tool call with edited arguments."""
    from app.models import Run

    result = await db.execute(select(ApprovalRequest).where(ApprovalRequest.id == approval_id))
    approval = result.scalar_one_or_none()
    if not approval:
        raise HTTPException(status_code=404, detail="Approval not found")

    if approval.status != ApprovalStatus.PENDING:
        raise HTTPException(status_code=400, detail="Approval already resolved")

    # Get run for project_id
    run_result = await db.execute(select(Run).where(Run.id == approval.run_id))
    run = run_result.scalar_one_or_none()
    project_id = run.project_id if run else approval.run_id

    # Update approval
    approval.decision = ApprovalDecision.EDITED
    approval.edited_args = edited_args
    approval.decision_reason = reason
    approval.status = ApprovalStatus.RESOLVED
    approval.decided_by = "user"  # TODO: Get from auth
    approval.decided_at = datetime.utcnow()

    # Update tool call status
    if approval.tool_call_id:
        tool_result = await db.execute(
            select(ToolCall).where(ToolCall.id == approval.tool_call_id)
        )
        tool_call = tool_result.scalar_one_or_none()
        if tool_call:
            tool_call.status = "running"

    await db.flush()

    # Log audit
    await log_approval_decision(
        project_id=project_id,
        approval_id=approval.id,
        decision=ApprovalDecision.EDITED,
        reason=reason,
    )

    # Emit event to notify agent runtime
    from app.services.events import emit_run_event, EventType
    await emit_run_event(
        approval.run_id,
        EventType.APPROVAL_RESOLVED,
        {
            "approval_id": str(approval.id),
            "decision": "edited",
            "tool_call_id": str(approval.tool_call_id) if approval.tool_call_id else None,
            "edited_args": edited_args,
        },
    )

    await db.commit()
    await db.refresh(approval)
    return approval
