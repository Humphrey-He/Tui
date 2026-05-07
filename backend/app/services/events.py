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
    await emit_run_event(
        run_id,
        EventType.MESSAGE_COMPLETED,
        {"message_id": message_id, "content": content},
    )


async def emit_tool_call_pending_approval(
    run_id: UUID,
    tool_call_id: str,
    tool_name: str,
    arguments: dict,
    risk_level: str,
):
    """Emit a tool call pending approval event."""
    await emit_run_event(
        run_id,
        EventType.TOOL_CALL_PENDING_APPROVAL,
        {
            "tool_call_id": tool_call_id,
            "tool_name": tool_name,
            "arguments": arguments,
            "risk_level": risk_level,
        },
    )


async def emit_approval_created(
    run_id: UUID,
    approval_id: str,
    requested_action: str,
):
    """Emit an approval created event."""
    await emit_run_event(
        run_id,
        EventType.APPROVAL_CREATED,
        {
            "approval_id": approval_id,
            "requested_action": requested_action,
        },
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
            metadata=metadata or {},
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
