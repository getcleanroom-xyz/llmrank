"""Recommendations API — chat + quick actions with streaming SSE."""
import uuid
import json
import logging
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.core.config import settings
from app.core.rate_limit import limiter
from app.models.models import User, Brand, AgentRateLimit, Conversation, ChatMessage
from app.schemas.schemas import RecommendationRequest
from app.api.auth import get_current_user

router = APIRouter()
logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _current_hour_bucket() -> datetime:
    now = _utcnow()
    return now.replace(minute=0, second=0, microsecond=0)


async def _check_rate_limit(db: AsyncSession, user_id: uuid.UUID) -> tuple[bool, int]:
    """Check hourly rate limit. Returns (allowed, remaining)."""
    bucket = _current_hour_bucket()
    result = await db.execute(
        select(AgentRateLimit).where(
            AgentRateLimit.user_id == user_id,
            AgentRateLimit.hour_bucket == bucket,
        )
    )
    limit = result.scalar_one_or_none()
    count = limit.request_count if limit else 0
    max_per_hour = 20  # free tier
    return count < max_per_hour, max_per_hour - count


async def _increment_rate_limit(db: AsyncSession, user_id: uuid.UUID):
    bucket = _current_hour_bucket()
    result = await db.execute(
        select(AgentRateLimit).where(
            AgentRateLimit.user_id == user_id,
            AgentRateLimit.hour_bucket == bucket,
        )
    )
    limit = result.scalar_one_or_none()
    if limit:
        limit.request_count += 1
    else:
        db.add(AgentRateLimit(
            id=uuid.uuid4(), user_id=user_id,
            hour_bucket=bucket, request_count=1,
        ))
    await db.flush()


async def _publish_chat_messages(brand_id: uuid.UUID, conversation_id: uuid.UUID | None,
                                  user_message: str, assistant_response: str):
    """Publish chat messages via event bus for deferred DB persistence."""
    from app.services.event_bus.broker import event_bus
    await event_bus.publish(
        topic="chat",
        event_type="chat.messages_created",
        payload={
            "brand_id": str(brand_id),
            "conversation_id": str(conversation_id) if conversation_id else None,
            "user_message": user_message,
            "assistant_response": assistant_response,
        },
    )


@router.post("/brands/{brand_id}/recommend", tags=["Recommendations"])
@limiter.limit("30/minute")
async def recommend(
    request: Request,
    brand_id: uuid.UUID,
    body: RecommendationRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Non-streaming recommendation (for quick action buttons)."""
    brand_result = await db.execute(
        select(Brand).where(Brand.id == brand_id, Brand.owner_id == user.id)
    )
    brand = brand_result.scalar_one_or_none()
    if not brand:
        raise HTTPException(404, "Brand not found")

    # Rate limit check
    allowed, remaining = await _check_rate_limit(db, user.id)
    if not allowed:
        raise HTTPException(429, "Rate limit exceeded. Try again later.")

    # Credit check (5 credits per recommendation)
    from app.services.credit_service import check_credits, deduct_credits
    from app.models.models import CreditWallet
    wallet_result = await db.execute(select(CreditWallet).where(CreditWallet.user_id == user.id))
    wallet = wallet_result.scalar_one_or_none()
    if not wallet or wallet.balance < 5:
        raise HTTPException(402, "Insufficient credits for recommendations")

    await deduct_credits(db, 5, f"Recommendation: {body.message[:50]}", user.id)
    await _increment_rate_limit(db, user.id)

    from app.services.agents.registry import agent_registry
    from app.services.agents.base import AgentContext
    ctx = AgentContext(str(brand_id))
    result = await agent_registry.recommendations.run(
        ctx, brand_id=brand_id, db=db, message=body.message,
    )

    # Publish for deferred persistence
    conversation_id = body.conversation_id if hasattr(body, 'conversation_id') else None
    await _publish_chat_messages(brand_id, conversation_id, body.message, result.output)

    return {"response": result.output, "success": result.success}


@router.post("/brands/{brand_id}/recommend/stream", tags=["Recommendations"])
@limiter.limit("30/minute")
async def recommend_stream(
    request: Request,
    brand_id: uuid.UUID,
    body: RecommendationRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Streaming recommendation via SSE."""
    brand_result = await db.execute(
        select(Brand).where(Brand.id == brand_id, Brand.owner_id == user.id)
    )
    brand = brand_result.scalar_one_or_none()
    if not brand:
        raise HTTPException(404, "Brand not found")

    # Rate limit
    allowed, remaining = await _check_rate_limit(db, user.id)
    if not allowed:
        raise HTTPException(429, "Rate limit exceeded. Try again later.")

    # Credit check
    from app.services.credit_service import deduct_credits
    from app.models.models import CreditWallet
    wallet_result = await db.execute(select(CreditWallet).where(CreditWallet.user_id == user.id))
    wallet = wallet_result.scalar_one_or_none()
    if not wallet or wallet.balance < 5:
        raise HTTPException(402, "Insufficient credits for recommendations")

    await deduct_credits(db, 5, f"Recommendation (stream): {body.message[:50]}", user.id)
    await _increment_rate_limit(db, user.id)

    history = body.history or []
    conversation_id = body.conversation_id if hasattr(body, 'conversation_id') else None
    from app.services.agents.registry import agent_registry

    async def generate():
        full_response = ""
        async for chunk in agent_registry.recommendations.stream_response(
            brand_id, db, body.message, history,
        ):
            # Accumulate the full response for deferred persistence
            if chunk.startswith("data: ") and chunk.strip() != "data: [DONE]":
                try:
                    data = json.loads(chunk[6:])
                    if "token" in data:
                        full_response += data["token"]
                except (json.JSONDecodeError, KeyError):
                    pass
            yield chunk

        # After streaming completes, publish for deferred DB write
        if full_response:
            await _publish_chat_messages(brand_id, conversation_id, body.message, full_response)

    return StreamingResponse(generate(), media_type="text/event-stream")
