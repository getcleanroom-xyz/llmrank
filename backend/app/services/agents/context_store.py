"""Brand context store — CRUD for per-brand agent memory."""
import uuid
import logging
from datetime import datetime, timezone, timedelta

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.models import BrandAgentContext

logger = logging.getLogger(__name__)

# Crawl content TTL: 24 hours
CRAWL_CONTENT_TTL_HOURS = 24


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


async def get_brand_context(db: AsyncSession, brand_id: uuid.UUID) -> dict:
    """Get the agent context for a brand. Returns empty dict if none exists."""
    result = await db.execute(
        select(BrandAgentContext).where(BrandAgentContext.brand_id == brand_id)
    )
    row = result.scalar_one_or_none()
    return row.context if row else {}


async def update_brand_context(db: AsyncSession, brand_id: uuid.UUID, updates: dict):
    """Merge updates into the brand's agent context."""
    result = await db.execute(
        select(BrandAgentContext).where(BrandAgentContext.brand_id == brand_id)
    )
    row = result.scalar_one_or_none()
    if row:
        row.context = {**row.context, **updates}
        row.updated_at = _utcnow()
    else:
        row = BrandAgentContext(brand_id=brand_id, context=updates, updated_at=_utcnow())
        db.add(row)
    await db.flush()


async def set_agent_memory(db: AsyncSession, brand_id: uuid.UUID, agent_name: str, notes: str):
    """Write notes from a specific agent into the brand context."""
    ctx = await get_brand_context(db, brand_id)
    memory = ctx.get("agent_memory", {})
    memory[agent_name] = {"notes": notes, "updated_at": _utcnow().isoformat()}
    await update_brand_context(db, brand_id, {"agent_memory": memory})


async def get_agent_memory(db: AsyncSession, brand_id: uuid.UUID, agent_name: str) -> str:
    """Read notes from a specific agent."""
    ctx = await get_brand_context(db, brand_id)
    memory = ctx.get("agent_memory", {})
    return memory.get(agent_name, {}).get("notes", "")


async def delete_brand_context(db: AsyncSession, brand_id: uuid.UUID):
    """Delete all agent context for a brand."""
    result = await db.execute(
        select(BrandAgentContext).where(BrandAgentContext.brand_id == brand_id)
    )
    row = result.scalar_one_or_none()
    if row:
        await db.delete(row)
        await db.flush()


async def get_crawl_content(db: AsyncSession, brand_id: uuid.UUID) -> str | None:
    """Get cached crawl content if it exists and is within TTL.

    Returns crawl content string if fresh, None if stale or missing.
    """
    ctx = await get_brand_context(db, brand_id)
    crawl_data = ctx.get("crawl_content")
    if not crawl_data:
        return None

    cached_at_str = crawl_data.get("cached_at")
    content = crawl_data.get("content")
    if not cached_at_str or not content:
        return None

    try:
        cached_at = datetime.fromisoformat(cached_at_str)
        now = datetime.now(timezone.utc)
        if cached_at.tzinfo is None:
            cached_at = cached_at.replace(tzinfo=timezone.utc)
        if now - cached_at > timedelta(hours=CRAWL_CONTENT_TTL_HOURS):
            logger.debug("Crawl content for brand %s is stale (> %dh old)", brand_id, CRAWL_CONTENT_TTL_HOURS)
            return None
    except (ValueError, TypeError):
        return None

    return content


async def store_crawl_content(db: AsyncSession, brand_id: uuid.UUID, content: str):
    """Store crawl content with timestamp for TTL tracking."""
    await update_brand_context(db, brand_id, {
        "crawl_content": {
            "content": content,
            "cached_at": _utcnow().isoformat(),
        }
    })
