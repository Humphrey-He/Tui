from typing import Optional, Literal
from abc import ABC, abstractmethod
from pydantic import BaseModel
from app.models import RiskLevel


class ToolDefinition(BaseModel):
    name: str
    description: str
    args_schema: dict
    risk_level: RiskLevel = RiskLevel.LOW
    required_permission: Optional[str] = None
    approval_policy: Literal["always", "never", "high_risk_only"] = "never"
    preview_supported: bool = False


class BaseTool(ABC):
    """Base class for all tools."""

    def __init__(self):
        self._definition = self.get_definition()

    @abstractmethod
    def get_definition(self) -> ToolDefinition:
        """Return the tool definition."""
        pass

    @abstractmethod
    async def execute(self, **kwargs) -> dict:
        """Execute the tool and return the result."""
        pass


# Built-in tools
class ReadFileTool(BaseTool):
    def get_definition(self) -> ToolDefinition:
        return ToolDefinition(
            name="read_file",
            description="Read contents of a file",
            args_schema={
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Path to the file"}
                },
                "required": ["path"],
            },
            risk_level=RiskLevel.LOW,
            required_permission="file.read",
        )

    async def execute(self, path: str, **kwargs) -> dict:
        # TODO: Implement actual file reading
        return {"content": f"File content of {path}", "path": path}


class WriteFileTool(BaseTool):
    def get_definition(self) -> ToolDefinition:
        return ToolDefinition(
            name="write_file",
            description="Write content to a file",
            args_schema={
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Path to the file"},
                    "content": {"type": "string", "description": "Content to write"},
                },
                "required": ["path", "content"],
            },
            risk_level=RiskLevel.HIGH,
            required_permission="file.write",
            approval_policy="always",
            preview_supported=True,
        )

    async def execute(self, path: str, content: str, **kwargs) -> dict:
        # TODO: Implement actual file writing
        return {"path": path, "bytes_written": len(content)}


class ExecuteCommandTool(BaseTool):
    def get_definition(self) -> ToolDefinition:
        return ToolDefinition(
            name="execute_command",
            description="Execute a shell command",
            args_schema={
                "type": "object",
                "properties": {
                    "command": {"type": "string", "description": "Command to execute"},
                    "cwd": {"type": "string", "description": "Working directory"},
                },
                "required": ["command"],
            },
            risk_level=RiskLevel.CRITICAL,
            required_permission="shell.execute",
            approval_policy="always",
        )

    async def execute(self, command: str, cwd: Optional[str] = None, **kwargs) -> dict:
        # TODO: Implement actual command execution
        return {"command": command, "exit_code": 0, "stdout": "", "stderr": ""}


class WebSearchTool(BaseTool):
    def get_definition(self) -> ToolDefinition:
        return ToolDefinition(
            name="web_search",
            description="Search the web for information",
            args_schema={
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query"},
                    "num_results": {"type": "integer", "description": "Number of results", "default": 5},
                },
                "required": ["query"],
            },
            risk_level=RiskLevel.MEDIUM,
            required_permission="web.search",
        )

    async def execute(self, query: str, num_results: int = 5, **kwargs) -> dict:
        # TODO: Implement actual web search
        return {"query": query, "results": [], "num_results": num_results}


class DeleteFileTool(BaseTool):
    def get_definition(self) -> ToolDefinition:
        return ToolDefinition(
            name="delete_file",
            description="Delete a file",
            args_schema={
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Path to the file to delete"},
                },
                "required": ["path"],
            },
            risk_level=RiskLevel.HIGH,
            required_permission="file.write",
            approval_policy="always",
        )

    async def execute(self, path: str, **kwargs) -> dict:
        # TODO: Implement actual file deletion
        return {"path": path, "deleted": True}


# Registry
class ToolRegistry:
    """Registry for all available tools."""

    def __init__(self):
        self._tools: dict[str, BaseTool] = {}
        self._register_builtin_tools()

    def _register_builtin_tools(self):
        tools = [
            ReadFileTool(),
            WriteFileTool(),
            ExecuteCommandTool(),
            WebSearchTool(),
            DeleteFileTool(),
        ]
        for tool in tools:
            self.register(tool)

    def register(self, tool: BaseTool):
        self._tools[tool._definition.name] = tool

    def get(self, name: str) -> Optional[BaseTool]:
        return self._tools.get(name)

    def list_tools(self) -> list[ToolDefinition]:
        return [tool._definition for tool in self._tools.values()]

    def get_tools_by_permission(self, permission: str) -> list[ToolDefinition]:
        return [
            tool._definition
            for tool in self._tools.values()
            if tool._definition.required_permission == permission
        ]


# Global registry
tool_registry = ToolRegistry()
