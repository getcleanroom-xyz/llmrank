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

    def to_schema(self) -> dict:
        """Return a JSON Schema representation for LLM consumption."""
        return {
            "name": self.name,
            "description": self.description,
            "parameters": self.parameters,
        }


class ToolRegistry:
    """Registry of available tools for agents."""

    def __init__(self):
        self._tools: dict[str, Tool] = {}

    def register(self, tool: Tool):
        self._tools[tool.name] = tool

    def get(self, name: str) -> Tool | None:
        return self._tools.get(name)

    def list_tools(self) -> list[Tool]:
        return list(self._tools.values())

    def list_schemas(self) -> list[dict]:
        return [t.to_schema() for t in self._tools.values()]

    async def execute(self, name: str, **kwargs) -> Any:
        tool = self._tools.get(name)
        if not tool:
            raise ValueError(f"Unknown tool: {name}")
        logger.info("Executing tool '%s' with args: %s", name, list(kwargs.keys()))
        return await tool.handler(**kwargs)
