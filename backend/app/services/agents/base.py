"""Agent base class — ReAct loop with tool calling and context management."""
import json
import uuid
import logging
from datetime import datetime, timezone
from typing import Any

from app.services.agents.tools import ToolRegistry, Tool
from app.services.event_bus.broker import EventBus

logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class AgentContext:
    """Per-brand context that agents read/write."""

    def __init__(self, brand_id: str, data: dict | None = None):
        self.brand_id = brand_id
        self.data = data or {}
        self._dirty = False

    def get(self, key: str, default: Any = None) -> Any:
        return self.data.get(key, default)

    def set(self, key: str, value: Any):
        self.data[key] = value
        self._dirty = True

    def update(self, updates: dict):
        self.data.update(updates)
        self._dirty = True

    @property
    def is_dirty(self) -> bool:
        return self._dirty

    def mark_clean(self):
        self._dirty = False

    def to_dict(self) -> dict:
        return {"brand_id": self.brand_id, "context": self.data}


class AgentResult:
    """Result from an agent run."""

    def __init__(self, success: bool, output: Any = None, error: str | None = None,
                 steps: list[dict] | None = None, metadata: dict | None = None):
        self.success = success
        self.output = output
        self.error = error
        self.steps = steps or []
        self.metadata = metadata or {}

    def to_dict(self) -> dict:
        return {
            "success": self.success, "output": self.output,
            "error": self.error, "steps": self.steps,
            "metadata": self.metadata,
        }


class BaseAgent:
    """ReAct-style agent with tool calling and event publishing.

    Subclasses should:
    1. Set name, description, system_prompt
    2. Register tools in __init__
    3. Optionally override run() for custom logic
    """

    name: str = "base"
    description: str = ""
    system_prompt: str = ""
    max_steps: int = 10
    model_key: str = "chatgpt"  # cheap model for agent reasoning

    def __init__(self, event_bus: EventBus):
        self.event_bus = event_bus
        self.tools = ToolRegistry()
        self._register_default_tools()

    def _register_default_tools(self):
        """Register built-in tools available to all agents."""
        self.tools.register(Tool(
            name="emit_event",
            description="Publish an event to the event bus for other agents",
            handler=self._emit_event,
            parameters={
                "type": "object",
                "properties": {
                    "topic": {"type": "string"},
                    "event_type": {"type": "string"},
                    "payload": {"type": "object"},
                },
                "required": ["topic", "event_type", "payload"],
            },
        ))

    async def _emit_event(self, topic: str, event_type: str, payload: dict) -> dict:
        event = await self.event_bus.publish(topic, event_type, payload)
        return {"event_id": event.id, "status": "published"}

    async def run(self, context: AgentContext, **kwargs) -> AgentResult:
        """Execute the agent's main logic. Override in subclasses."""
        raise NotImplementedError

    async def run_with_react(self, context: AgentContext, task: str, **kwargs) -> AgentResult:
        """ReAct loop: Think → Act → Observe → repeat."""
        from app.services.llm_core import _call_openrouter, _parse_json

        steps = []
        for step_num in range(self.max_steps):
            # Build prompt with tool schemas
            tools_desc = json.dumps(self.tools.list_schemas(), indent=2)
            history = "\n".join(f"Step {s['step']}: {s['action']} -> {s['result'][:200]}"
                               for s in steps[-3:])  # last 3 steps for context

            prompt = (
                f"{self.system_prompt}\n\n"
                f"Task: {task}\n\n"
                f"Context: {json.dumps(context.data, default=str)[:2000]}\n\n"
                f"Recent steps:\n{history}\n\n"
                f"Available tools:\n{tools_desc}\n\n"
                f"Respond with a JSON object:\n"
                f'{{"thought": "your reasoning", "action": "tool_name", '
                f'"action_input": {{...}}, "done": false}}\n'
                f'When complete, set "done": true and put result in "output".'
            )

            try:
                import httpx
                async with httpx.AsyncClient(timeout=30) as client:
                    resp = await _call_openrouter(
                        [{"role": "user", "content": prompt}],
                        self.model_key, client, temperature=0.3, max_tokens=1024,
                    )
                decision = _parse_json(resp)
            except Exception as e:
                logger.error("Agent %s step %d LLM error: %s", self.name, step_num, e)
                return AgentResult(False, error=f"LLM error at step {step_num}: {e}", steps=steps)

            thought = decision.get("thought", "")
            action = decision.get("action", "")
            action_input = decision.get("action_input", {})
            done = decision.get("done", False)

            if done:
                return AgentResult(True, output=decision.get("output"), steps=steps,
                                   metadata={"thought": thought})

            # Execute tool
            try:
                result = await self.tools.execute(action, **action_input)
                result_str = json.dumps(result, default=str)[:500]
            except Exception as e:
                result_str = f"Error: {e}"
                logger.warning("Agent %s tool '%s' failed: %s", self.name, action, e)

            steps.append({
                "step": step_num + 1, "thought": thought,
                "action": action, "action_input": action_input,
                "result": result_str,
            })

        return AgentResult(False, error="Max steps reached", steps=steps)
