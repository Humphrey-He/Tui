import asyncio
import json
from typing import Optional, Callable, Any
from uuid import UUID
from datetime import datetime
from starlette.websockets import WebSocket


class ConnectionManager:
    """Manages WebSocket connections."""

    def __init__(self):
        self._connections: dict[str, WebSocket] = {}
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, client_id: str):
        """Accept and register a WebSocket connection."""
        await websocket.accept()
        async with self._lock:
            self._connections[client_id] = websocket

    async def disconnect(self, client_id: str):
        """Remove a WebSocket connection."""
        async with self._lock:
            if client_id in self._connections:
                del self._connections[client_id]

    async def send(self, client_id: str, message: dict):
        """Send a message to a specific client."""
        async with self._lock:
            if client_id in self._connections:
                await self._connections[client_id].send_json(message)

    async def broadcast(self, message: dict):
        """Broadcast a message to all connected clients."""
        async with self._lock:
            for websocket in self._connections.values():
                await websocket.send_json(message)

    def is_connected(self, client_id: str) -> bool:
        """Check if a client is connected."""
        return client_id in self._connections


class ControlMessage:
    """Control message for WebSocket communication."""

    def __init__(self, msg_type: str, data: dict):
        self.type = msg_type
        self.data = data

    @classmethod
    def from_dict(cls, data: dict) -> "ControlMessage":
        return cls(data.get("type", ""), {k: v for k, v in data.items() if k != "type"})

    def to_dict(self) -> dict:
        return {"type": self.type, **self.data}


class ControlHandler:
    """Handles control messages from WebSocket clients."""

    def __init__(self):
        self._handlers: dict[str, Callable] = {}

    def register(self, msg_type: str, handler: Callable):
        """Register a handler for a message type."""
        self._handlers[msg_type] = handler

    async def handle(self, message: ControlMessage, websocket: WebSocket):
        """Handle an incoming control message."""
        handler = self._handlers.get(message.type)
        if handler:
            try:
                await handler(message.data, websocket)
            except Exception as e:
                await websocket.send_json({
                    "type": "error",
                    "error": str(e),
                })
        else:
            await websocket.send_json({
                "type": "error",
                "error": f"Unknown message type: {message.type}",
            })


# Global instances
manager = ConnectionManager()
control_handler = ControlHandler()


# Built-in message handlers
async def handle_cancel_run(data: dict, websocket: WebSocket):
    """Handle run cancellation."""
    run_id = data.get("run_id")
    if not run_id:
        await websocket.send_json({"type": "error", "error": "run_id required"})
        return

    # Import here to avoid circular imports
    from app.agent.runtime import cancel_runtime

    try:
        await cancel_runtime(UUID(run_id))
        await websocket.send_json({
            "type": "run_cancelled",
            "run_id": run_id,
        })
    except Exception as e:
        await websocket.send_json({
            "type": "error",
            "error": str(e),
        })


async def handle_approve_tool_call(data: dict, websocket: WebSocket):
    """Handle tool call approval."""
    approval_id = data.get("approval_id")
    reason = data.get("reason")

    if not approval_id:
        await websocket.send_json({"type": "error", "error": "approval_id required"})
        return

    # Import here to avoid circular imports
    from app.services.events import emit_run_event, EventType

    try:
        # Get approval and emit event
        async with websocket.app.state.db_session() as session:
            from sqlalchemy import select
            from app.models import ApprovalRequest, ApprovalStatus, ApprovalDecision, ToolCall, ToolCallStatus

            result = await session.execute(
                select(ApprovalRequest).where(ApprovalRequest.id == UUID(approval_id))
            )
            approval = result.scalar_one_or_none()

            if not approval:
                await websocket.send_json({"type": "error", "error": "Approval not found"})
                return

            approval.decision = ApprovalDecision.APPROVED
            approval.decision_reason = reason
            approval.status = ApprovalStatus.RESOLVED
            approval.decided_by = "user"  # TODO: Get from auth
            approval.decided_at = datetime.utcnow()

            # Update tool call status
            if approval.tool_call_id:
                tool_result = await session.execute(
                    select(ToolCall).where(ToolCall.id == approval.tool_call_id)
                )
                tool_call = tool_result.scalar_one_or_none()
                if tool_call:
                    tool_call.status = ToolCallStatus.RUNNING

            await session.commit()

            # Emit events
            await emit_run_event(
                approval.run_id,
                EventType.APPROVAL_RESOLVED,
                {"approval_id": approval_id, "decision": "approved"},
            )

        await websocket.send_json({
            "type": "approval_resolved",
            "approval_id": approval_id,
            "decision": "approved",
        })
    except Exception as e:
        await websocket.send_json({
            "type": "error",
            "error": str(e),
        })


async def handle_reject_tool_call(data: dict, websocket: WebSocket):
    """Handle tool call rejection."""
    approval_id = data.get("approval_id")
    reason = data.get("reason")

    if not approval_id:
        await websocket.send_json({"type": "error", "error": "approval_id required"})
        return

    from app.services.events import emit_run_event, EventType

    try:
        async with websocket.app.state.db_session() as session:
            from sqlalchemy import select
            from app.models import ApprovalRequest, ApprovalStatus, ApprovalDecision, ToolCall, ToolCallStatus

            result = await session.execute(
                select(ApprovalRequest).where(ApprovalRequest.id == UUID(approval_id))
            )
            approval = result.scalar_one_or_none()

            if not approval:
                await websocket.send_json({"type": "error", "error": "Approval not found"})
                return

            approval.decision = ApprovalDecision.REJECTED
            approval.decision_reason = reason
            approval.status = ApprovalStatus.RESOLVED
            approval.decided_by = "user"
            approval.decided_at = datetime.utcnow()

            # Update tool call status
            if approval.tool_call_id:
                tool_result = await session.execute(
                    select(ToolCall).where(ToolCall.id == approval.tool_call_id)
                )
                tool_call = tool_result.scalar_one_or_none()
                if tool_call:
                    tool_call.status = ToolCallStatus.REJECTED

            await session.commit()

            await emit_run_event(
                approval.run_id,
                EventType.APPROVAL_RESOLVED,
                {"approval_id": approval_id, "decision": "rejected"},
            )

        await websocket.send_json({
            "type": "approval_resolved",
            "approval_id": approval_id,
            "decision": "rejected",
        })
    except Exception as e:
        await websocket.send_json({
            "type": "error",
            "error": str(e),
        })


async def handle_edit_tool_call(data: dict, websocket: WebSocket):
    """Handle tool call with edited arguments."""
    approval_id = data.get("approval_id")
    edited_args = data.get("edited_args", {})
    reason = data.get("reason")

    if not approval_id:
        await websocket.send_json({"type": "error", "error": "approval_id required"})
        return

    from app.services.events import emit_run_event, EventType

    try:
        async with websocket.app.state.db_session() as session:
            from sqlalchemy import select
            from app.models import ApprovalRequest, ApprovalStatus, ApprovalDecision

            result = await session.execute(
                select(ApprovalRequest).where(ApprovalRequest.id == UUID(approval_id))
            )
            approval = result.scalar_one_or_none()

            if not approval:
                await websocket.send_json({"type": "error", "error": "Approval not found"})
                return

            approval.decision = ApprovalDecision.EDITED
            approval.edited_args = edited_args
            approval.decision_reason = reason
            approval.status = ApprovalStatus.RESOLVED
            approval.decided_by = "user"
            approval.decided_at = datetime.utcnow()

            await session.commit()

            await emit_run_event(
                approval.run_id,
                EventType.APPROVAL_RESOLVED,
                {"approval_id": approval_id, "decision": "edited", "edited_args": edited_args},
            )

        await websocket.send_json({
            "type": "approval_resolved",
            "approval_id": approval_id,
            "decision": "edited",
        })
    except Exception as e:
        await websocket.send_json({
            "type": "error",
            "error": str(e),
        })


# Register built-in handlers
control_handler.register("cancel_run", handle_cancel_run)
control_handler.register("approve_tool_call", handle_approve_tool_call)
control_handler.register("reject_tool_call", handle_reject_tool_call)
control_handler.register("edit_tool_call", handle_edit_tool_call)
