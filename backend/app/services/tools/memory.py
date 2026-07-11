"""Memory tools — agent memory and brand context operations."""
import uuid
import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


async def store_memory(agent_name: str, brand_id: str, notes: str,
                       db: AsyncSession | None = None) -> bool:
    """Store notes in agent memory for a brand.

    Security: Agent can only write to its own namespace.
    """
    from app.core.database import AsyncSessionLocal
    from app.models.models import BrandAgentContext

    async def _execute(session: AsyncSession):
        result = await session.execute(
            select(BrandAgentContext).where(
                BrandAgentContext.brand_id == uuid.UUID(brand_id)
            )
        )
        row = result.scalar_one_or_none()

        memory = {}
        if row:
            memory = row.context.get("agent_memory", {})

        memory[agent_name] = {
            "notes": notes,
            "updated_at": _utcnow().isoformat(),
        }

        if row:
            row.context = {**row.context, "agent_memory": memory}
            row.updated_at = _utcnow()
        else:
            row = BrandAgentContext(
                brand_id=uuid.UUID(brand_id),
                context={"agent_memory": memory},
                updated_at=_utcnow(),
            )
            session.add(row)

        await session.flush()
        return True

    if db:
        return await _execute(db)

    async with AsyncSessionLocal() as session:
        result = await _execute(session)
        await session.commit()
        return result


async def read_memory(agent_name: str, brand_id: str,
                      db: AsyncSession | None = None) -> str:
    """Read notes from agent memory for a brand."""
    from app.core.database import AsyncSessionLocal
    from app.models.models import BrandAgentContext

    async def _execute(session: AsyncSession):
        result = await session.execute(
            select(BrandAgentContext).where(
                BrandAgentContext.brand_id == uuid.UUID(brand_id)
            )
        )
        row = result.scalar_one_or_none()
        if not row:
            return ""
        return row.context.get("agent_memory", {}).get(agent_name, {}).get("notes", "")

    if db:
        return await _execute(db)

    async with AsyncSessionLocal() as session:
        return await _execute(session)


async def get_brand_context(brand_id: str,
                            db: AsyncSession | None = None) -> dict:
    """Get the full agent context for a brand."""
    from app.core.database import AsyncSessionLocal
    from app.models.models import BrandAgentContext

    async def _execute(session: AsyncSession):
        result = await session.execute(
            select(BrandAgentContext).where(
                BrandAgentContext.brand_id == uuid.UUID(brand_id)
            )
        )
        row = result.scalar_one_or_none()
        return row.context if row else {}

    if db:
        return await _execute(db)

    async with AsyncSessionLocal() as session:
        return await _execute(session)


async def update_brand_context(brand_id: str, updates: dict,
                               db: AsyncSession | None = None) -> bool:
    """Merge updates into the brand's agent context."""
    from app.core.database import AsyncSessionLocal
    from app.models.models import BrandAgentContext

    async def _execute(session: AsyncSession):
        result = await session.execute(
            select(BrandAgentContext).where(
                BrandAgentContext.brand_id == uuid.UUID(brand_id)
            )
        )
        row = result.scalar_one_or_none()

        if row:
            row.context = {**row.context, **updates}
            row.updated_at = _utcnow()
        else:
            row = BrandAgentContext(
                brand_id=uuid.UUID(brand_id),
                context=updates,
                updated_at=_utcnow(),
            )
            session.add(row)

        await session.flush()
        return True

    if db:
        return await _execute(db)

    async with AsyncSessionLocal() as session:
        result = await _execute(session)
        await session.commit()
        return result
