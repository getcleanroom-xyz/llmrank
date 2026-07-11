"""Brand context store — CRUD for per-brand agent memory."""
import uuid
import logging
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.models import BrandAgentContext

logger = logging.getLogger(__name__)


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
