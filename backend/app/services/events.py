import json
import asyncio
from datetime import datetime
from typing import AsyncGenerator, Optional
from uuid import UUID
from sse_starlette.sse import EventSourceResponse
from app.core import get_settings, async_session_maker
from app.models import Run, RunStatus, Message, AgentStep, ToolCall, ApprovalRequest, AuditLog, Log

settings = get_settings()


class EventType:
    RUN_STARTED = "run.started"
    MESSAGE_CREATED = "message.created"
    MESSAGE_DELTA = "message.delta"
    MESSAGE_COMPLETED = "message.completed"
    STEP_STARTED = "step.started"
    TOOL_CALL_CREATED = "tool_call.created"
    TOOL_CALL_PENDING_APPROVAL = "tool_call.pending_approval"
    TOOL_CALL_STARTED = "tool_call.started"
    TOOL_CALL_COMPLETED = "tool_call.completed"
    TOOL_CALL_FAILED = "tool_call.failed"
    APPROVAL_CREATED = "approval.created"
    APPROVAL_RESOLVED = "approval.resolved"
    FILE_DIFF_CREATED = "file_diff.created"
    LOG_CREATED = "log.created"
    RUN_COMPLETED = "run.completed"
    RUN_FAILED = "run.failed"
    RUN_CANCELLED = "run.cancelled"


class RunEventEmitter:
    """Emits SSE events for a specific run."""

    def __init__(self, run_id: UUID):
        self.run_id = run_id
        self.subscribers: list = []

    async def emit(
        self,
        event_type: str,
        payload: dict,
        event_id: Optional[str] = None,
    ):
        """Emit an event to all subscribers."""
        event = {
            "event_id": event_id or f"evt_{datetime.utcnow().timestamp()}",
            "run_id": str(self.run_id),
            "type": event_type,
            "created_at": datetime.utcnow().isoformat(),
            "payload": payload,
        }

        for queue in self.subscribers:
            await queue.put(event)

    async def stream_events(self) -> AsyncGenerator[dict, None]:
        """Stream events as SSE."""
        queue = asyncio.Queue()

        # Subscribe to events
        self.subscribers.append(queue)

        try:
            while True:
                event = await queue.get()
                yield {
                    "event": json.dumps(event),
                }
        except asyncio.CancelledError:
            pass
        finally:
            self.subscribers.remove(queue)


class EventStore:
    """In-memory event store for run events."""

    def __init__(self):
        self._events: dict[UUID, list[dict]] = {}

    async def add_event(self, run_id: UUID, event: dict):
        if run_id not in self._events:
            self._events[run_id] = []
        self._events[run_id].append(event)

    async def get_events(self, run_id: UUID, after_event_id: Optional[str] = None) -> list[dict]:
        events = self._events.get(run_id, [])
        if after_event_id:
            # Find the index of the event with the given ID
            for i, event in enumerate(events):
                if event.get("event_id") == after_event_id:
                    return events[i + 1 :]
        return events

    async def clear_events(self, run_id: UUID):
        if run_id in self._events:
            del self._events[run_id]


# Global event store
event_store = EventStore()

# Global emitter registry
_emitters: dict[UUID, RunEventEmitter] = {}


def get_run_emitter(run_id: UUID) -> RunEventEmitter:
    """Get or create an emitter for a run."""
    if run_id not in _emitters:
        _emitters[run_id] = RunEventEmitter(run_id)
    return _emitters[run_id]


async def emit_run_event(
    run_id: UUID,
    event_type: str,
    payload: dict,
):
    """Emit a run event to the event store and emitter."""
    emitter = get_run_emitter(run_id)

    event = {
        "event_id": f"evt_{datetime.utcnow().timestamp()}",
        "run_id": str(run_id),
        "type": event_type,
        "created_at": datetime.utcnow().isoformat(),
        "payload": payload,
    }

    # Store the event
    await event_store.add_event(run_id, event)

    # Emit to subscribers
    await emitter.emit(event_type, payload, event["event_id"])


async def emit_message_delta(run_id: UUID, content: str):
    """Emit a message delta event for streaming."""
    await emit_run_event(run_id, EventType.MESSAGE_DELTA, {"content": content})


async def emit_message_completed(run_id: UUID, message_id: str, content: str):
    """Emit a message completed event."""
    # Fetch the message from DB to get full object
    async with async_session_maker() as session:
        from sqlalchemy import select
        result = await session.execute(
            select(Message).where(Message.id == message_id)
        )
        message = result.scalar_one_or_none()

    if message:
        message_data = {
            "id": str(message.id),
            "session_id": str(message.session_id),
            "role": message.role,
            "content": message.content,
            "created_at": message.created_at.isoformat() if message.created_at else None,
        }
    else:
        message_data = {"id": message_id, "content": content, "role": "assistant"}

    await emit_run_event(
        run_id,
        EventType.MESSAGE_COMPLETED,
        {"message": message_data},
    )


async def emit_tool_call_created(run_id: UUID, tool_call_id: str, tool_name: str):
    """Emit a tool call created event with full tool_call object."""
    from uuid import UUID as UUIDType

    async with async_session_maker() as session:
        from sqlalchemy import select

        result = await session.execute(
            select(ToolCall).where(ToolCall.id == UUIDType(tool_call_id))
        )
        tool_call = result.scalar_one_or_none()

    tool_call_data = None
    if tool_call:
        tool_call_data = {
            "id": str(tool_call.id),
            "run_id": str(tool_call.run_id),
            "tool_name": tool_call.tool_name,
            "arguments": tool_call.arguments,
            "status": tool_call.status.value if hasattr(tool_call.status, 'value') else tool_call.status,
            "risk_level": tool_call.risk_level.value if hasattr(tool_call.risk_level, 'value') else tool_call.risk_level,
            "started_at": tool_call.started_at.isoformat() if tool_call.started_at else None,
        }

    await emit_run_event(
        run_id,
        EventType.TOOL_CALL_CREATED,
        {"tool_call": tool_call_data},
    )


async def emit_tool_call_started(run_id: UUID, tool_call_id: str):
    """Emit a tool call started event with full tool_call object."""
    from uuid import UUID as UUIDType

    async with async_session_maker() as session:
        from sqlalchemy import select

        result = await session.execute(
            select(ToolCall).where(ToolCall.id == UUIDType(tool_call_id))
        )
        tool_call = result.scalar_one_or_none()

    tool_call_data = None
    if tool_call:
        tool_call_data = {
            "id": str(tool_call.id),
            "run_id": str(tool_call.run_id),
            "tool_name": tool_call.tool_name,
            "arguments": tool_call.arguments,
            "status": tool_call.status.value if hasattr(tool_call.status, 'value') else tool_call.status,
            "risk_level": tool_call.risk_level.value if hasattr(tool_call.risk_level, 'value') else tool_call.risk_level,
            "started_at": tool_call.started_at.isoformat() if tool_call.started_at else None,
        }

    await emit_run_event(
        run_id,
        EventType.TOOL_CALL_STARTED,
        {"tool_call": tool_call_data},
    )


async def emit_tool_call_completed(run_id: UUID, tool_call_id: str, result: dict):
    """Emit a tool call completed event with full tool_call object."""
    from uuid import UUID as UUIDType

    async with async_session_maker() as session:
        from sqlalchemy import select

        result_db = await session.execute(
            select(ToolCall).where(ToolCall.id == UUIDType(tool_call_id))
        )
        tool_call = result_db.scalar_one_or_none()

    tool_call_data = None
    if tool_call:
        tool_call_data = {
            "id": str(tool_call.id),
            "run_id": str(tool_call.run_id),
            "tool_name": tool_call.tool_name,
            "arguments": tool_call.arguments,
            "status": tool_call.status.value if hasattr(tool_call.status, 'value') else tool_call.status,
            "risk_level": tool_call.risk_level.value if hasattr(tool_call.risk_level, 'value') else tool_call.risk_level,
            "result": result,
            "completed_at": tool_call.completed_at.isoformat() if tool_call.completed_at else None,
        }

    await emit_run_event(
        run_id,
        EventType.TOOL_CALL_COMPLETED,
        {"tool_call": tool_call_data},
    )


async def emit_tool_call_failed(run_id: UUID, tool_call_id: str, error: str):
    """Emit a tool call failed event with full tool_call object."""
    from uuid import UUID as UUIDType

    async with async_session_maker() as session:
        from sqlalchemy import select

        result_db = await session.execute(
            select(ToolCall).where(ToolCall.id == UUIDType(tool_call_id))
        )
        tool_call = result_db.scalar_one_or_none()

    tool_call_data = None
    if tool_call:
        tool_call_data = {
            "id": str(tool_call.id),
            "run_id": str(tool_call.run_id),
            "tool_name": tool_call.tool_name,
            "arguments": tool_call.arguments,
            "status": tool_call.status.value if hasattr(tool_call.status, 'value') else tool_call.status,
            "risk_level": tool_call.risk_level.value if hasattr(tool_call.risk_level, 'value') else tool_call.risk_level,
            "error_message": error,
            "completed_at": tool_call.completed_at.isoformat() if tool_call.completed_at else None,
        }

    await emit_run_event(
        run_id,
        EventType.TOOL_CALL_FAILED,
        {"tool_call": tool_call_data},
    )


async def emit_tool_call_pending_approval(
    run_id: UUID,
    tool_call_id: str,
    tool_name: str,
    arguments: dict,
    risk_level: str,
):
    """Emit a tool call pending approval event."""
    from uuid import UUID as UUIDType

    async with async_session_maker() as session:
        from sqlalchemy import select

        # Fetch tool call
        result = await session.execute(
            select(ToolCall).where(ToolCall.id == UUIDType(tool_call_id))
        )
        tool_call = result.scalar_one_or_none()

        # Fetch approval request
        result = await session.execute(
            select(ApprovalRequest).where(
                ApprovalRequest.tool_call_id == UUIDType(tool_call_id),
                ApprovalRequest.status == ApprovalStatus.PENDING
            )
        )
        approval = result.scalar_one_or_none()

    tool_call_data = None
    if tool_call:
        tool_call_data = {
            "id": str(tool_call.id),
            "run_id": str(tool_call.run_id),
            "tool_name": tool_call.tool_name,
            "arguments": tool_call.arguments,
            "status": tool_call.status.value if hasattr(tool_call.status, 'value') else tool_call.status,
            "risk_level": tool_call.risk_level.value if hasattr(tool_call.risk_level, 'value') else tool_call.risk_level,
            "started_at": tool_call.started_at.isoformat() if tool_call.started_at else None,
        }

    approval_data = None
    if approval:
        approval_data = {
            "id": str(approval.id),
            "run_id": str(approval.run_id),
            "tool_call_id": str(approval.tool_call_id) if approval.tool_call_id else None,
            "status": approval.status.value if hasattr(approval.status, 'value') else approval.status,
            "requested_action": approval.requested_action,
            "original_args": approval.original_args,
            "created_at": approval.created_at.isoformat() if approval.created_at else None,
        }

    await emit_run_event(
        run_id,
        EventType.TOOL_CALL_PENDING_APPROVAL,
        {
            "tool_call": tool_call_data,
            "approval": approval_data,
        },
    )


async def emit_approval_created(
    run_id: UUID,
    approval_id: str,
    requested_action: str,
):
    """Emit an approval created event."""
    from uuid import UUID as UUIDType

    async with async_session_maker() as session:
        from sqlalchemy import select

        result = await session.execute(
            select(ApprovalRequest).where(ApprovalRequest.id == UUIDType(approval_id))
        )
        approval = result.scalar_one_or_none()

    approval_data = None
    if approval:
        approval_data = {
            "id": str(approval.id),
            "run_id": str(approval.run_id),
            "tool_call_id": str(approval.tool_call_id) if approval.tool_call_id else None,
            "status": approval.status.value if hasattr(approval.status, 'value') else approval.status,
            "requested_action": approval.requested_action,
            "original_args": approval.original_args,
            "created_at": approval.created_at.isoformat() if approval.created_at else None,
        }

    await emit_run_event(
        run_id,
        EventType.APPROVAL_CREATED,
        {"approval": approval_data},
    )


async def emit_run_completed(run_id: UUID, total_tokens: int, estimated_cost: float):
    """Emit a run completed event."""
    await emit_run_event(
        run_id,
        EventType.RUN_COMPLETED,
        {"total_tokens": total_tokens, "estimated_cost": estimated_cost},
    )


async def emit_run_failed(run_id: UUID, error_message: str):
    """Emit a run failed event."""
    await emit_run_event(
        run_id,
        EventType.RUN_FAILED,
        {"error_message": error_message},
    )


async def emit_log(
    run_id: UUID,
    level: str,
    message: str,
    metadata: Optional[dict] = None,
):
    """Emit a log event."""
    # Store log in database
    async with async_session_maker() as session:
        log = Log(
            run_id=run_id,
            level=level,
            message=message,
            meta=metadata or {},
        )
        session.add(log)
        await session.commit()
        await session.refresh(log)

        log_data = {
            "id": str(log.id),
            "run_id": str(run_id),
            "level": level,
            "message": message,
            "metadata": metadata or {},
            "created_at": log.created_at.isoformat(),
        }

    await emit_run_event(
        run_id,
        EventType.LOG_CREATED,
        {"log": log_data},
    )
