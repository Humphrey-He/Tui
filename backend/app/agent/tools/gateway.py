from typing import Optional, Literal
from uuid import UUID
from app.models import ToolCall, ApprovalRequest, RiskLevel, ApprovalStatus
from app.agent.tools import tool_registry, ToolDefinition


class ToolGateway:
    """Gateway for tool execution with permission checks and approval flow."""

    def __init__(self, project_id: UUID):
        self.project_id = project_id

    async def check_approval_required(
        self,
        tool_definition: ToolDefinition,
        arguments: dict,
    ) -> tuple[bool, Optional[str]]:
        """Check if approval is required for a tool call.

        Returns:
            tuple of (approval_required, reason)
        """
        if tool_definition.approval_policy == "always":
            return True, f"Tool '{tool_definition.name}' always requires approval"

        if tool_definition.approval_policy == "high_risk_only":
            if tool_definition.risk_level in [RiskLevel.HIGH, RiskLevel.CRITICAL]:
                return True, f"High risk tool '{tool_definition.name}' requires approval"

        # Check permission level
        # TODO: Check project permissions

        return False, None

    async def validate_arguments(
        self,
        tool_definition: ToolDefinition,
        arguments: dict,
    ) -> tuple[bool, Optional[str]]:
        """Validate tool arguments against schema.

        Returns:
            tuple of (valid, error_message)
        """
        # TODO: Implement proper JSON schema validation
        required = tool_definition.args_schema.get("required", [])
        for field in required:
            if field not in arguments:
                return False, f"Missing required field: {field}"

        return True, None

    async def get_risk_level(
        self,
        tool_definition: ToolDefinition,
        arguments: dict,
    ) -> RiskLevel:
        """Determine the risk level of a tool call."""
        return tool_definition.risk_level

    def needs_approval(
        self,
        tool_definition: ToolDefinition,
    ) -> bool:
        """Check if a tool needs approval based on its policy."""
        return tool_definition.approval_policy == "always"
