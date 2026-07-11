"""Chat persistence — event bus subscriber that writes chat messages to DB asynchronously."""
import uuid
import json
import logging
import asyncio
from datetime import datetime, timezone

from app.services.event_bus.broker import event_bus, EventHandler
from app.services.event_bus.types import Event

logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


async def _generate_title(user_message: str) -> str:
    """Generate a short conversation title from the first user message via LLM."""
    from app.core.config import settings
    import httpx

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
                    "HTTP-Referer": "https://llmrank.dev",
                    "X-Title": "LLMRank",
                },
                json={
                    "model": "anthropic/claude-haiku-3",
                    "messages": [
                        {"role": "user", "content": f"Generate a short title (max 6 words, no quotes, no punctuation at end) for this conversation starter:\n\n{user_message[:200]}"}
                    ],
                    "temperature": 0.3,
                    "max_tokens": 30,
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                title = data["choices"][0]["message"]["content"].strip().strip('"').strip("'").strip(".")
                return title[:200] if title else "New chat"
    except Exception as e:
        logger.debug("Title generation failed: %s", e)

    # Fallback: truncate the first message
    return user_message[:50].strip() or "New chat"


async def _handle_chat_messages(event: Event):
    """Persist chat messages to DB when a chat.messages_created event is received."""
    from app.core.database import AsyncSessionLocal
    from app.models.models import Conversation, ChatMessage
    from sqlalchemy import select, func

    payload = event.payload
    brand_id = payload.get("brand_id")
    conversation_id = payload.get("conversation_id")
    user_message = payload.get("user_message", "")
    assistant_response = payload.get("assistant_response", "")

    if not brand_id or not user_message:
        logger.warning("chat.messages_created event missing required fields")
        return

    try:
        async with AsyncSessionLocal() as db:
            # If no conversation_id, we can't persist (conversation not yet created on frontend)
            if not conversation_id:
                logger.debug("No conversation_id — skipping persistence (frontend will batch later)")
                return

            conv_uuid = uuid.UUID(conversation_id)

            # Verify conversation exists
            result = await db.execute(select(Conversation).where(Conversation.id == conv_uuid))
            conv = result.scalar_one_or_none()
            if not conv:
                logger.warning("Conversation %s not found — skipping persistence", conversation_id)
                return

            now = _utcnow()

            # Check if this is the first message (for auto-title)
            msg_count = (await db.execute(
                select(func.count()).where(ChatMessage.conversation_id == conv_uuid)
            )).scalar() or 0
            is_first = msg_count == 0

            # Write user message
            user_msg = ChatMessage(
                id=uuid.uuid4(),
                conversation_id=conv_uuid,
                role="user",
                content=user_message,
                created_at=now,
            )
            db.add(user_msg)

            # Write assistant response
            if assistant_response:
                assistant_msg = ChatMessage(
                    id=uuid.uuid4(),
                    conversation_id=conv_uuid,
                    role="assistant",
                    content=assistant_response,
                    created_at=now,
                )
                db.add(assistant_msg)

            # Auto-generate title on first message
            if is_first and conv.title == "New chat":
                title = await _generate_title(user_message)
                conv.title = title

            conv.updated_at = now
            await db.commit()
            logger.info("Persisted %d messages to conversation %s", 1 + (1 if assistant_response else 0), conversation_id)

    except Exception as e:
        logger.exception("Failed to persist chat messages: %s", e)


def init_chat_persistence():
    """Subscribe to chat events on the event bus."""
    event_bus.subscribe(
        topic="chat",
        handler=_handle_chat_messages,
        name="chat-persistence",
        event_types=["chat.messages_created"],
    )
    logger.info("Chat persistence subscriber registered")
