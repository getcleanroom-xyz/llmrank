"""Agent tools — callable actions that agents can invoke."""
import uuid
import logging
from dataclasses import dataclass, field
from typing import Callable, Awaitable, Any

logger = logging.getLogger(__name__)


@dataclass
class Tool:
    """A tool that an agent can invoke."""
    name: str
    description: str
    handler: Callable[..., Awaitable[Any]]
    parameters: dict = field(default_factory=dict)  # JSON Schema-like
    permissions: list[str] = field(default_factory=list)  # e.g., ["db:read", "llm:call"]

    def to_schema(self) -> dict:
        """Return a JSON Schema representation for LLM consumption."""
        return {
            "name": self.name,
            "description": self.description,
            "parameters": self.parameters,
        }


class ToolRegistry:
    """Registry of available tools for agents with permission checking."""

    def __init__(self, allowed_permissions: list[str] | None = None):
        self._tools: dict[str, Tool] = {}
        self._allowed_permissions = allowed_permissions  # None = allow all

    def register(self, tool: Tool):
        """Register a tool. Rejects if agent lacks required permissions."""
        if self._allowed_permissions is not None:
            for perm in tool.permissions:
                if perm not in self._allowed_permissions and perm.split(":")[0] not in self._allowed_permissions:
                    logger.warning("Tool '%s' requires permission '%s' not in allowed: %s — skipping registration",
                                   tool.name, perm, self._allowed_permissions)
                    return
        self._tools[tool.name] = tool

    def get(self, name: str) -> Tool | None:
        return self._tools.get(name)

    def list_tools(self) -> list[Tool]:
        return list(self._tools.values())

    def list_schemas(self) -> list[dict]:
        return [t.to_schema() for t in self._tools.values()]

    def has_permission(self, tool_name: str) -> bool:
        """Check if the agent has permission to use a tool."""
        tool = self._tools.get(tool_name)
        if not tool:
            return False
        if self._allowed_permissions is None:
            return True
        for perm in tool.permissions:
            base_perm = perm.split(":")[0]
            if perm in self._allowed_permissions or base_perm in self._allowed_permissions:
                return True
        return not tool.permissions  # No permissions required = always allowed

    async def execute(self, name: str, **kwargs) -> Any:
        tool = self._tools.get(name)
        if not tool:
            raise ValueError(f"Unknown tool: {name}")
        if not self.has_permission(name):
            raise PermissionError(f"Agent does not have permission to use tool: {name}")
        logger.info("Executing tool '%s' with args: %s", name, list(kwargs.keys()))
        return await tool.handler(**kwargs)
