"""Conversations API — CRUD for chat conversations and messages."""
import uuid
import asyncio
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update

from app.core.database import get_db
from app.models.models import User, Brand, Conversation, ChatMessage
from app.schemas.schemas import (
    ConversationCreate, ConversationOut, ConversationUpdate,
    ChatMessageCreate, ChatMessageOut, ConversationListResponse,
)
from app.api.auth import get_current_user

router = APIRouter()
logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


async def _verify_brand_owner(db: AsyncSession, brand_id: uuid.UUID, user_id: uuid.UUID) -> Brand:
    """Verify brand exists and user owns it."""
    result = await db.execute(
        select(Brand).where(Brand.id == brand_id, Brand.owner_id == user_id, Brand.deleted_at.is_(None))
    )
    brand = result.scalar_one_or_none()
    if not brand:
        raise HTTPException(404, "Brand not found")
    return brand


# ─── Conversations ────────────────────────────────────────────────────────────

@router.get("/brands/{brand_id}/conversations", response_model=ConversationListResponse, tags=["Conversations"])
async def list_conversations(
    brand_id: uuid.UUID,
    page: int = 1,
    per_page: int = 50,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List conversations for a brand, newest first."""
    await _verify_brand_owner(db, brand_id, user.id)

    count_q = select(func.count()).where(
        Conversation.brand_id == brand_id, Conversation.user_id == user.id
    )
    total = (await db.execute(count_q)).scalar() or 0

    offset = (page - 1) * per_page
    result = await db.execute(
        select(Conversation)
        .where(Conversation.brand_id == brand_id, Conversation.user_id == user.id)
        .order_by(Conversation.updated_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    items = result.scalars().all()

    return ConversationListResponse(
        items=[ConversationOut.model_validate(c) for c in items],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.post("/brands/{brand_id}/conversations", response_model=ConversationOut, tags=["Conversations"])
async def create_conversation(
    brand_id: uuid.UUID,
    body: ConversationCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create a new conversation."""
    await _verify_brand_owner(db, brand_id, user.id)

    conv = Conversation(
        id=uuid.uuid4(),
        brand_id=brand_id,
        user_id=user.id,
        title=body.title or "New chat",
    )
    db.add(conv)
    await db.commit()
    await db.refresh(conv)
    return ConversationOut.model_validate(conv)


@router.get("/brands/{brand_id}/conversations/{conversation_id}", response_model=ConversationOut, tags=["Conversations"])
async def get_conversation(
    brand_id: uuid.UUID,
    conversation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get a single conversation."""
    await _verify_brand_owner(db, brand_id, user.id)

    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.brand_id == brand_id,
            Conversation.user_id == user.id,
        )
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(404, "Conversation not found")
    return ConversationOut.model_validate(conv)


@router.patch("/brands/{brand_id}/conversations/{conversation_id}", response_model=ConversationOut, tags=["Conversations"])
async def update_conversation(
    brand_id: uuid.UUID,
    conversation_id: uuid.UUID,
    body: ConversationUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Update conversation title."""
    await _verify_brand_owner(db, brand_id, user.id)

    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.brand_id == brand_id,
            Conversation.user_id == user.id,
        )
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(404, "Conversation not found")

    if body.title is not None:
        conv.title = body.title
    conv.updated_at = _utcnow()
    await db.commit()
    await db.refresh(conv)
    return ConversationOut.model_validate(conv)


@router.delete("/brands/{brand_id}/conversations/{conversation_id}", tags=["Conversations"])
async def delete_conversation(
    brand_id: uuid.UUID,
    conversation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Delete a conversation and all its messages."""
    await _verify_brand_owner(db, brand_id, user.id)

    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.brand_id == brand_id,
            Conversation.user_id == user.id,
        )
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(404, "Conversation not found")

    await db.delete(conv)
    await db.commit()
    return {"ok": True}


# ─── Messages ─────────────────────────────────────────────────────────────────

@router.get("/brands/{brand_id}/conversations/{conversation_id}/messages", response_model=list[ChatMessageOut], tags=["Conversations"])
async def list_messages(
    brand_id: uuid.UUID,
    conversation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List all messages in a conversation."""
    await _verify_brand_owner(db, brand_id, user.id)

    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.brand_id == brand_id,
            Conversation.user_id == user.id,
        )
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(404, "Conversation not found")

    msg_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.conversation_id == conversation_id)
        .order_by(ChatMessage.created_at)
    )
    messages = msg_result.scalars().all()
    return [ChatMessageOut.model_validate(m) for m in messages]


@router.post("/brands/{brand_id}/conversations/{conversation_id}/messages", response_model=ChatMessageOut, tags=["Conversations"])
async def add_message(
    brand_id: uuid.UUID,
    conversation_id: uuid.UUID,
    body: ChatMessageCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Add a message to a conversation (synchronous write)."""
    await _verify_brand_owner(db, brand_id, user.id)

    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.brand_id == brand_id,
            Conversation.user_id == user.id,
        )
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(404, "Conversation not found")

    msg = ChatMessage(
        id=uuid.uuid4(),
        conversation_id=conversation_id,
        role=body.role,
        content=body.content,
    )
    db.add(msg)
    conv.updated_at = _utcnow()
    await db.commit()
    await db.refresh(msg)
    return ChatMessageOut.model_validate(msg)


@router.post("/brands/{brand_id}/conversations/{conversation_id}/messages/batch", tags=["Conversations"])
async def add_messages_batch(
    brand_id: uuid.UUID,
    conversation_id: uuid.UUID,
    messages: list[ChatMessageCreate],
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Add multiple messages at once (used after streaming completes)."""
    await _verify_brand_owner(db, brand_id, user.id)

    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.brand_id == brand_id,
            Conversation.user_id == user.id,
        )
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(404, "Conversation not found")

    now = _utcnow()
    for m in messages:
        msg = ChatMessage(
            id=uuid.uuid4(),
            conversation_id=conversation_id,
            role=m.role,
            content=m.content,
        )
        db.add(msg)
    conv.updated_at = now
    await db.commit()
    return {"ok": True, "count": len(messages)}
