import asyncio
from typing import Optional, Literal
from uuid import UUID
from datetime import datetime
from app.core import get_settings, async_session_maker
from app.models import Run, Session, Message, AgentStep, ToolCall, ApprovalRequest, RunStatus, ToolCallStatus, ApprovalStatus, ApprovalDecision, RiskLevel
from app.agent.tools import tool_registry, ToolGateway
from app.services.events import (
    EventType,
    emit_run_event,
    emit_message_delta,
    emit_message_completed,
    emit_tool_call_pending_approval,
    emit_approval_created,
    emit_run_completed,
    emit_run_failed,
)

settings = get_settings()


class AgentRuntime:
    """Runtime for executing agent tasks."""

    def __init__(self, run_id: UUID):
        self.run_id = run_id
        self._cancelled = False
        self._tool_gateway: Optional[ToolGateway] = None

    async def initialize(self):
        """Initialize the runtime for a run."""
        async with async_session_maker() as session:
            from sqlalchemy import select

            # Get run and session
            result = await session.execute(select(Run).where(Run.id == self.run_id))
            run = result.scalar_one_or_none()
            if not run:
                raise ValueError(f"Run {self.run_id} not found")

            result = await session.execute(select(Session).where(Session.id == run.session_id))
            session_obj = result.scalar_one_or_none()

            self._tool_gateway = ToolGateway(run.project_id)

            # Update run status
            run.status = RunStatus.RUNNING
            await session.commit()

            # Emit run started event
            await emit_run_event(self.run_id, EventType.RUN_STARTED, {"run_id": str(self.run_id)})

    async def execute(self):
        """Execute the agent task."""
        try:
            await self.initialize()

            async with async_session_maker() as session:
                from sqlalchemy import select

                # Get run messages
                result = await session.execute(
                    select(Message)
                    .where(Message.run_id == self.run_id)
                    .order_by(Message.created_at)
                )
                messages = list(result.scalars().all())

                if not messages:
                    await emit_run_failed(self.run_id, "No messages in run")
                    return

                # Create initial agent step
                step = AgentStep(
                    run_id=self.run_id,
                    step_order=1,
                    step_type="message",
                    status="started",
                )
                session.add(step)
                await session.commit()
                await session.refresh(step)

                # Simulate agent response (replace with actual LangGraph call)
                response_content = await self._generate_response(messages)

                # Stream the response
                assistant_message_id = f"msg_{self.run_id}_assistant"
                for chunk in self._chunk_text(response_content):
                    if self._cancelled:
                        break
                    await emit_message_delta(self.run_id, chunk)
                    await asyncio.sleep(0.01)  # Simulate streaming

                # Save the completed message
                await emit_message_completed(self.run_id, assistant_message_id, response_content)

                # Complete the step
                step.status = "completed"
                step.completed_at = datetime.utcnow()
                await session.commit()

                # Mark run as completed
                result = await session.execute(select(Run).where(Run.id == self.run_id))
                run = result.scalar_one_or_none()
                if run:
                    run.status = RunStatus.COMPLETED
                    run.completed_at = datetime.utcnow()
                    run.total_tokens = len(response_content) // 4  # Rough estimate
                    run.estimated_cost = run.total_tokens * 0.00003  # Rough estimate
                    await session.commit()

                await emit_run_completed(
                    self.run_id,
                    run.total_tokens,
                    run.estimated_cost,
                )

        except Exception as e:
            await emit_run_failed(self.run_id, str(e))
            raise

    async def _generate_response(self, messages: list) -> str:
        """Generate agent response. Replace with actual LLM call."""
        # TODO: Integrate with LangGraph / LangChain
        last_message = messages[-1] if messages else None
        user_input = last_message.content if last_message else ""

        # Simulate response
        response = f"This is a simulated response to: {user_input[:100]}..."

        # Check if we should simulate a tool call
        if "read file" in user_input.lower():
            await self._simulate_tool_call("read_file", {"path": "/example/file.txt"})

        return response

    async def _simulate_tool_call(
        self,
        tool_name: str,
        arguments: dict,
    ):
        """Simulate a tool call with approval flow."""
        async with async_session_maker() as session:
            from sqlalchemy import select

            tool = tool_registry.get(tool_name)
            if not tool:
                return

            definition = tool._definition

            # Create tool call record
            tool_call = ToolCall(
                run_id=self.run_id,
                tool_name=tool_name,
                arguments=arguments,
                status=ToolCallStatus.CREATED,
                risk_level=definition.risk_level,
                required_permission=definition.required_permission,
            )
            session.add(tool_call)
            await session.commit()
            await session.refresh(tool_call)

            await emit_run_event(
                self.run_id,
                EventType.TOOL_CALL_CREATED,
                {"tool_call_id": str(tool_call.id), "tool_name": tool_name},
            )

            # Check if approval required
            approval_required, reason = await self._tool_gateway.check_approval_required(
                definition, arguments
            )

            if approval_required:
                # Update tool call status
                tool_call.status = ToolCallStatus.PENDING_APPROVAL
                await session.commit()

                await emit_tool_call_pending_approval(
                    self.run_id,
                    str(tool_call.id),
                    tool_name,
                    arguments,
                    definition.risk_level.value,
                )

                # Create approval request
                approval = ApprovalRequest(
                    run_id=self.run_id,
                    tool_call_id=tool_call.id,
                    status=ApprovalStatus.PENDING,
                    requested_action=f"Execute {tool_name}",
                    original_args=arguments,
                )
                session.add(approval)
                await session.commit()
                await session.refresh(approval)

                await emit_approval_created(
                    self.run_id,
                    str(approval.id),
                    f"Execute {tool_name}",
                )

                # In a real implementation, we would pause here and wait for user decision
                # For simulation, auto-approve after a delay
                await asyncio.sleep(2)

                # Simulate approval
                approval.decision = ApprovalDecision.APPROVED
                approval.status = ApprovalStatus.RESOLVED
                await session.commit()

                tool_call.status = ToolCallStatus.RUNNING
                await session.commit()

            # Execute tool
            tool_call.status = ToolCallStatus.RUNNING
            await session.commit()

            await emit_run_event(
                self.run_id,
                EventType.TOOL_CALL_STARTED,
                {"tool_call_id": str(tool_call.id)},
            )

            # Execute the tool
            result = await tool.execute(**arguments)

            # Complete tool call
            tool_call.status = ToolCallStatus.COMPLETED
            tool_call.result = result
            await session.commit()

            await emit_run_event(
                self.run_id,
                EventType.TOOL_CALL_COMPLETED,
                {"tool_call_id": str(tool_call.id), "result": result},
            )

    def _chunk_text(self, text: str, chunk_size: int = 10) -> list[str]:
        """Split text into chunks for streaming."""
        for i in range(0, len(text), chunk_size):
            yield text[i : i + chunk_size]

    async def cancel(self):
        """Cancel the running task."""
        self._cancelled = True
        async with async_session_maker() as session:
            from sqlalchemy import select

            result = await session.execute(select(Run).where(Run.id == self.run_id))
            run = result.scalar_one_or_none()
            if run:
                run.status = RunStatus.CANCELLED
                await session.commit()

            await emit_run_event(self.run_id, EventType.RUN_CANCELLED, {})


# Runtime registry
_runtimes: dict[UUID, AgentRuntime] = {}


def get_runtime(run_id: UUID) -> AgentRuntime:
    """Get or create a runtime for a run."""
    if run_id not in _runtimes:
        _runtimes[run_id] = AgentRuntime(run_id)
    return _runtimes[run_id]


async def start_runtime(run_id: UUID):
    """Start a runtime for a run."""
    runtime = get_runtime(run_id)
    asyncio.create_task(runtime.execute())


async def cancel_runtime(run_id: UUID):
    """Cancel a running runtime."""
    if run_id in _runtimes:
        await _runtimes[run_id].cancel()
