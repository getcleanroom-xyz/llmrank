"""Recommendations Agent — user-facing chat using skills."""
import json
import logging
from typing import AsyncGenerator

from app.services.agents.base import BaseAgent, AgentContext, AgentResult
from app.services.agents.tools import Tool
from app.services.event_bus.broker import EventBus

logger = logging.getLogger(__name__)


class RecommendationsAgent(BaseAgent):
    """User-facing agent for AI visibility recommendations and chat.

    Uses the answer_question skill for responses and exposes
    the skill as a tool in the ReAct loop.
    """

    name = "recommendations"
    description = "Provides actionable recommendations for improving AI visibility"
    system_prompt = (
        "You are lai, the AI visibility copilot inside LLMRank. "
        "You answer user questions about their AI visibility using real scan data.\n\n"
        "You have an 'answer_question' skill that generates responses using brand data. "
        "Use it to answer user questions."
    )
    model_key = "claude"

    def __init__(self, event_bus: EventBus):
        super().__init__(event_bus, allowed_permissions=["db:read", "llm:call", "event:emit"])

        # Register the answer_question skill as a tool
        self.tools.register(Tool(
            name="answer_question",
            description="Answer a user question about brand visibility. Args: brand_id, user_message, history, conversation_id",
            handler=self._answer_skill,
            parameters={
                "type": "object",
                "properties": {
                    "brand_id": {"type": "string", "description": "UUID of the brand"},
                    "user_message": {"type": "string", "description": "The user's question"},
                    "history": {"type": "array", "description": "Chat history [{role, content}]"},
                    "conversation_id": {"type": "string", "description": "Conversation UUID for persistence"},
                },
                "required": ["brand_id", "user_message"],
            },
            permissions=["db:read", "llm:call", "event:emit"],
        ))

        # Register context building tool
        self.tools.register(Tool(
            name="build_brand_context",
            description="Build brand context string from scan data. Args: brand_id",
            handler=self._build_context_skill,
            parameters={
                "type": "object",
                "properties": {
                    "brand_id": {"type": "string"},
                },
                "required": ["brand_id"],
            },
            permissions=["db:read"],
        ))

    async def _answer_skill(self, brand_id: str, user_message: str,
                            history: list[dict] | None = None,
                            conversation_id: str | None = None) -> str:
        """Answer a question using the answer_question skill."""
        from app.services.skills.answer_question import answer_question
        return await answer_question(brand_id, user_message, history, conversation_id, self.name)

    async def _build_context_skill(self, brand_id: str) -> str:
        """Build brand context using the domain tool."""
        from app.services.tools.domain import build_brand_context
        return await build_brand_context(brand_id)

    async def stream_response(self, brand_id, db, user_message: str,
                              history: list[dict] | None = None,
                              conversation_id: str | None = None) -> AsyncGenerator[str, None]:
        """Stream a response token-by-token via SSE.

        Uses the answer_question skill's stream function.
        """
        from app.services.skills.answer_question import stream_answer
        async for chunk in stream_answer(
            str(brand_id), user_message, history, conversation_id, self.name
        ):
            yield chunk

    async def run(self, context: AgentContext, **kwargs) -> AgentResult:
        """Non-streaming single response."""
        brand_id = kwargs.get("brand_id")
        message = kwargs.get("message", "")
        history = kwargs.get("history")
        conversation_id = kwargs.get("conversation_id")

        if not brand_id:
            return AgentResult(False, error="brand_id required")

        try:
            from app.services.skills.answer_question import answer_question
            response = await answer_question(
                str(brand_id), message, history, conversation_id, self.name
            )
            return AgentResult(success=True, output=response)
        except Exception as e:
            logger.exception("Recommendations agent failed: %s", e)
            return AgentResult(False, error=str(e))
