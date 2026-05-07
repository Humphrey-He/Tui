from typing import Optional
from uuid import UUID
from app.models import AuditLog, ApprovalDecision
from app.core import async_session_maker
from sqlalchemy import select


async def create_audit_log(
    project_id: UUID,
    action: str,
    actor_id: Optional[UUID] = None,
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
    metadata: Optional[dict] = None,
):
    """Create an audit log entry."""
    async with async_session_maker() as session:
        audit_log = AuditLog(
            project_id=project_id,
            actor_id=actor_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            metadata=metadata or {},
        )
        session.add(audit_log)
        await session.commit()


async def log_run_created(project_id: UUID, run_id: UUID, actor_id: Optional[UUID] = None):
    await create_audit_log(
        project_id=project_id,
        action="run.created",
        target_type="run",
        target_id=str(run_id),
        actor_id=actor_id,
    )


async def log_run_cancelled(project_id: UUID, run_id: UUID, actor_id: Optional[UUID] = None):
    await create_audit_log(
        project_id=project_id,
        action="run.cancelled",
        target_type="run",
        target_id=str(run_id),
        actor_id=actor_id,
    )


async def log_approval_decision(
    project_id: UUID,
    approval_id: UUID,
    decision: ApprovalDecision,
    reason: Optional[str] = None,
    actor_id: Optional[UUID] = None,
):
    action_map = {
        ApprovalDecision.APPROVED: "approval.approved",
        ApprovalDecision.REJECTED: "approval.rejected",
        ApprovalDecision.EDITED: "approval.edited",
    }
    await create_audit_log(
        project_id=project_id,
        action=action_map.get(decision, "approval.resolved"),
        target_type="approval",
        target_id=str(approval_id),
        actor_id=actor_id,
        metadata={"reason": reason} if reason else None,
    )


async def log_tool_call_executed(
    project_id: UUID,
    tool_call_id: UUID,
    tool_name: str,
    actor_id: Optional[UUID] = None,
):
    await create_audit_log(
        project_id=project_id,
        action="tool_call.executed",
        target_type="tool_call",
        target_id=str(tool_call_id),
        actor_id=actor_id,
        metadata={"tool_name": tool_name},
    )


async def log_file_change(
    project_id: UUID,
    file_path: str,
    change_type: str,
    run_id: UUID,
    actor_id: Optional[UUID] = None,
):
    await create_audit_log(
        project_id=project_id,
        action=f"file.{change_type}",
        target_type="file",
        target_id=file_path,
        actor_id=actor_id,
        metadata={"run_id": str(run_id)},
    )
