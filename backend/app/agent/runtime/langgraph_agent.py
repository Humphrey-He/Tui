"""
LangGraph-based Agent for Agent Console.

This module implements a LangGraph agent with human-in-the-loop support.
"""

import asyncio
import json
from typing import TypedDict, Annotated, Sequence, Literal, Optional, Any
from uuid import UUID
from datetime import datetime
from langgraph.graph import StateGraph, END
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage, ToolMessage
from langchain_core.outputs import ChatGeneration, ChatResult
from langchain_core.tools import tool as create_tool
from langchain_openai import ChatOpenAI

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


class AgentState(TypedDict):
    """State for the LangGraph agent."""
    messages: Annotated[Sequence[BaseMessage], "The conversation messages."]
    run_id: str
    session_id: str
    project_id: str
    pending_approval_id: Optional[str]
    should_continue: bool
    tool_result: Optional[dict]


class LangGraphAgent:
    """LangGraph-based agent with streaming and approval support."""

    def __init__(self, run_id: UUID):
        self.run_id = run_id
        self._cancelled = False
        self._tool_gateway: Optional[ToolGateway] = None
        self._graph: Optional[StateGraph] = None
        self._config: Optional[dict] = None

    async def initialize(self):
        """Initialize the agent."""
        async with async_session_maker() as session:
            from sqlalchemy import select

            result = await session.execute(select(Run).where(Run.id == self.run_id))
            run = result.scalar_one_or_none()
            if not run:
                raise ValueError(f"Run {self.run_id} not found")

            result = await session.execute(select(Session).where(Session.id == run.session_id))
            session_obj = result.scalar_one_or_none()

            self._tool_gateway = ToolGateway(run.project_id)
            self._project_id = run.project_id

            # Update run status
            run.status = RunStatus.RUNNING
            await session.commit()

            await emit_run_event(self.run_id, EventType.RUN_STARTED, {"run_id": str(self.run_id)})

    def _build_graph(self) -> StateGraph:
        """Build the LangGraph state graph."""
        graph = StateGraph(AgentState)

        # Add nodes
        graph.add_node("llm_node", self._llm_node)
        graph.add_node("tool_node", self._tool_node)
        graph.add_node("approval_node", self._approval_wait_node)

        # Set entry point
        graph.set_entry_point("llm_node")

        # Add edges
        graph.add_edge("llm_node", "tool_node")
        graph.add_conditional_edges(
            "tool_node",
            self._should_approve,
            {
                "approve": "approval_node",
                "continue": END,
            }
        )
        graph.add_edge("approval_node", "llm_node")

        return graph

    async def _llm_node(self, state: AgentState) -> dict:
        """LLM node that generates responses."""
        try:
            # Get tools from registry and bind to LLM
            tools = []
            for tool_def in tool_registry.list_tools():
                # Convert tool definition to LangChain tool
                lc_tool = create_tool(
                    name=tool_def.name,
                    description=tool_def.description,
                    args_schema=tool_def.args_schema,
                )(self._create_tool_function(tool_def.name))
                tools.append(lc_tool)

            # Initialize LLM with tools
            llm = ChatOpenAI(
                model=settings.openai_model or "gpt-4o",
                api_key=settings.openai_api_key,
                streaming=True,
            ).bind_tools(tools)

            # Get the last message
            messages = state["messages"]

            # Stream the response
            response_content = ""
            async for chunk in llm.astream(messages):
                if self._cancelled:
                    break
                if chunk.content:
                    response_content += chunk.content
                    await emit_message_delta(self.run_id, chunk.content)

            # Create AI message
            ai_message = AIMessage(content=response_content)

            await emit_message_completed(self.run_id, f"msg_{self.run_id}_assistant", response_content)

            return {
                "messages": messages + [ai_message],
                "should_continue": True,
            }
        except Exception as e:
            await emit_run_failed(self.run_id, str(e))
            return {"should_continue": False, "messages": state["messages"]}

    def _create_tool_function(self, tool_name: str):
        """Create a tool function for LangChain binding."""
        async def tool_func(**kwargs):
            tool = tool_registry.get(tool_name)
            if not tool:
                return {"error": f"Tool {tool_name} not found"}
            return await tool.execute(**kwargs)
        return tool_func

    async def _tool_node(self, state: AgentState) -> dict:
        """Tool node that executes tools."""
        messages = state["messages"]
        last_message = messages[-1] if messages else None

        # Check if the last message has tool calls
        if not hasattr(last_message, "tool_calls") or not last_message.tool_calls:
            return {"tool_result": None, "should_continue": False}

        tool_calls = last_message.tool_calls
        results = []

        for tool_call in tool_calls:
            tool_name = tool_call.get("name")
            args = tool_call.get("args", {})

            # Get tool from registry
            tool = tool_registry.get(tool_name)
            if not tool:
                error_msg = {"error": f"Tool {tool_name} not found"}
                # Use a placeholder tool_call_id since we don't have a DB record
                error_tool_message = ToolMessage(
                    content=json.dumps(error_msg),
                    tool_call_id=f"error_{tool_name}",
                )
                results.append({"error": error_msg, "tool_message": error_tool_message})
                continue

            definition = tool._definition

            # Create tool call record
            async with async_session_maker() as session:
                from sqlalchemy import select

                tc = ToolCall(
                    run_id=self.run_id,
                    tool_name=tool_name,
                    arguments=args,
                    status=ToolCallStatus.CREATED,
                    risk_level=definition.risk_level,
                    required_permission=definition.required_permission,
                )
                session.add(tc)
                await session.commit()
                await session.refresh(tc)

                tool_call_id = str(tc.id)

                await emit_run_event(
                    self.run_id,
                    EventType.TOOL_CALL_CREATED,
                    {"tool_call_id": tool_call_id, "tool_name": tool_name},
                )

                # Check if approval required
                approval_required, reason = await self._tool_gateway.check_approval_required(
                    definition, args
                )

                if approval_required:
                    tc.status = ToolCallStatus.PENDING_APPROVAL
                    await session.commit()

                    await emit_tool_call_pending_approval(
                        self.run_id,
                        tool_call_id,
                        tool_name,
                        args,
                        definition.risk_level.value,
                    )

                    # Create approval request
                    approval = ApprovalRequest(
                        run_id=self.run_id,
                        tool_call_id=tc.id,
                        status=ApprovalStatus.PENDING,
                        requested_action=f"Execute {tool_name}",
                        original_args=args,
                    )
                    session.add(approval)
                    await session.commit()
                    await session.refresh(approval)

                    await emit_approval_created(
                        self.run_id,
                        str(approval.id),
                        f"Execute {tool_name}",
                    )

                    # Return pending approval state
                    return {
                        "pending_approval_id": str(approval.id),
                        "should_continue": True,
                    }

                # Execute tool directly
                tc.status = ToolCallStatus.RUNNING
                await session.commit()

                await emit_run_event(
                    self.run_id,
                    EventType.TOOL_CALL_STARTED,
                    {"tool_call_id": tool_call_id},
                )

                try:
                    result = await tool.execute(**args)
                    tc.status = ToolCallStatus.COMPLETED
                    tc.result = result
                    tc.completed_at = datetime.utcnow()
                    await session.commit()

                    await emit_run_event(
                        self.run_id,
                        EventType.TOOL_CALL_COMPLETED,
                        {"tool_call_id": tool_call_id, "result": result},
                    )

                    # Add tool result to messages so LLM can see it
                    tool_message = ToolMessage(
                        content=json.dumps(result),
                        tool_call_id=tool_call_id,
                    )
                    results.append({"result": result, "tool_message": tool_message})
                except Exception as e:
                    tc.status = ToolCallStatus.FAILED
                    tc.error_message = str(e)
                    await session.commit()

                    await emit_run_event(
                        self.run_id,
                        EventType.TOOL_CALL_FAILED,
                        {"tool_call_id": tool_call_id, "error": str(e)},
                    )

                    error_tool_message = ToolMessage(
                        content=json.dumps({"error": str(e)}),
                        tool_call_id=tool_call_id,
                    )
                    results.append({"error": str(e), "tool_message": error_tool_message})

        return {
            "tool_result": results,
            "should_continue": True,
            "messages": messages + [result.get("tool_message") for result in results if result.get("tool_message")],
        }

    def _should_approve(self, state: AgentState) -> Literal["approval_node", "__end__"]:
        """Determine if we need approval before continuing."""
        if state.get("pending_approval_id"):
            return "approval_node"
        return END

    async def _approval_wait_node(self, state: AgentState) -> dict:
        """Node that waits for human approval."""
        approval_id = state.get("pending_approval_id")
        if not approval_id:
            return {"pending_approval_id": None}

        # Wait for approval
        # In a real implementation, this would be async and wait for the WebSocket event
        max_wait = 300  # 5 minutes timeout
        waited = 0

        while waited < max_wait:
            if self._cancelled:
                break

            async with async_session_maker() as session:
                from sqlalchemy import select

                result = await session.execute(
                    select(ApprovalRequest).where(ApprovalRequest.id == UUID(approval_id))
                )
                approval = result.scalar_one_or_none()

                if approval and approval.status == ApprovalStatus.RESOLVED:
                    # Get the tool call and execute with approved args
                    if approval.tool_call_id:
                        tool_result = await self._execute_approved_tool(
                            approval.tool_call_id,
                            approval.decision,
                            approval.edited_args,
                        )
                        # Include tool message in state so LLM can see it
                        tool_msg = tool_result.get("tool_message")
                        if tool_msg:
                            return {
                                "pending_approval_id": None,
                                "tool_result": tool_result,
                                "messages": state["messages"] + [tool_msg],
                            }
                        return {"pending_approval_id": None, "tool_result": tool_result}

                    return {"pending_approval_id": None}

            await asyncio.sleep(1)
            waited += 1

        # Timeout
        return {"pending_approval_id": None}

    async def _execute_approved_tool(
        self,
        tool_call_id: UUID,
        decision: ApprovalDecision,
        edited_args: Optional[dict],
    ) -> dict:
        """Execute a tool after approval."""
        async with async_session_maker() as session:
            from sqlalchemy import select

            result = await session.execute(
                select(ToolCall).where(ToolCall.id == tool_call_id)
            )
            tool_call = result.scalar_one_or_none()

            if not tool_call:
                return {"error": "Tool call not found"}

            if decision == ApprovalDecision.REJECTED:
                tool_call.status = ToolCallStatus.REJECTED
                await session.commit()
                return {"rejected": True}

            args = edited_args or tool_call.arguments
            tool = tool_registry.get(tool_call.tool_name)

            if not tool:
                return {"error": f"Tool {tool_call.tool_name} not found"}

            try:
                result = await tool.execute(**args)
                tool_call.status = ToolCallStatus.COMPLETED
                tool_call.result = result
                tool_call.completed_at = datetime.utcnow()
                await session.commit()

                await emit_run_event(
                    self.run_id,
                    EventType.TOOL_CALL_COMPLETED,
                    {"tool_call_id": str(tool_call_id), "result": result},
                )

                tool_message = ToolMessage(
                    content=json.dumps(result),
                    tool_call_id=str(tool_call_id),
                )
                return {"result": result, "tool_message": tool_message}
            except Exception as e:
                tool_call.status = ToolCallStatus.FAILED
                tool_call.error_message = str(e)
                await session.commit()

                await emit_run_event(
                    self.run_id,
                    EventType.TOOL_CALL_FAILED,
                    {"tool_call_id": str(tool_call_id), "error": str(e)},
                )

                error_message = ToolMessage(
                    content=json.dumps({"error": str(e)}),
                    tool_call_id=str(tool_call_id),
                )
                return {"error": str(e), "tool_message": error_message}

    async def execute(self):
        """Execute the agent."""
        try:
            await self.initialize()

            # Build the graph
            self._graph = self._build_graph()
            app = self._graph.compile()

            # Get messages from database
            async with async_session_maker() as session:
                from sqlalchemy import select

                result = await session.execute(
                    select(Message)
                    .where(Message.run_id == self.run_id)
                    .order_by(Message.created_at)
                )
                messages = list(result.scalars().all())

                if not messages:
                    await emit_run_failed(self.run_id, "No messages in run")
                    return

                # Convert to LangChain messages
                lc_messages = []
                for msg in messages:
                    if msg.role == "user":
                        lc_messages.append(HumanMessage(content=msg.content))
                    elif msg.role == "assistant":
                        lc_messages.append(AIMessage(content=msg.content))
                    elif msg.role == "system":
                        lc_messages.append(SystemMessage(content=msg.content))

            # Initial state
            initial_state: AgentState = {
                "messages": lc_messages,
                "run_id": str(self.run_id),
                "session_id": str(messages[0].session_id) if messages else "",
                "project_id": str(self._project_id),
                "pending_approval_id": None,
                "should_continue": True,
                "tool_result": None,
            }

            # Run the graph
            async for state in app.astream(initial_state):
                if self._cancelled:
                    break

                if not state.get("should_continue", True):
                    break

            # Mark run as completed
            async with async_session_maker() as session:
                from sqlalchemy import select

                result = await session.execute(select(Run).where(Run.id == self.run_id))
                run = result.scalar_one_or_none()
                if run:
                    run.status = RunStatus.COMPLETED
                    run.completed_at = datetime.utcnow()
                    await session.commit()

                total_tokens = sum(
                    len(m.content) // 4 for m in lc_messages if isinstance(m, (HumanMessage, AIMessage))
                )
                run.total_tokens = total_tokens
                run.estimated_cost = total_tokens * 0.00003
                await session.commit()

            await emit_run_completed(self.run_id, run.total_tokens, run.estimated_cost)

        except Exception as e:
            import structlog
            logger = structlog.get_logger()
            logger.exception("Agent execution failed", error=str(e))
            await emit_run_failed(self.run_id, str(e))
            raise

    async def cancel(self):
        """Cancel the agent execution."""
        self._cancelled = True
        async with async_session_maker() as session:
            from sqlalchemy import select

            result = await session.execute(select(Run).where(Run.id == self.run_id))
            run = result.scalar_one_or_none()
            if run:
                run.status = RunStatus.CANCELLED
                run.cancelled_at = datetime.utcnow()
                await session.commit()

            await emit_run_event(self.run_id, EventType.RUN_CANCELLED, {})


def create_langgraph_agent(run_id: UUID) -> LangGraphAgent:
    """Create a new LangGraph agent for a run."""
    return LangGraphAgent(run_id)
