"""Brand access helpers — centralized brand lookup with soft-delete filtering."""
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.models import Brand


async def get_brand_or_404(
    db: AsyncSession,
    brand_id: uuid.UUID,
    owner_id: uuid.UUID | None = None,
) -> Brand:
    """Get an active (non-deleted) brand or raise 404.

    Usage:
        brand = await get_brand_or_404(db, brand_id)
        brand = await get_brand_or_404(db, brand_id, owner_id=user.id)
    """
    from fastapi import HTTPException

    stmt = Brand.active().where(Brand.id == brand_id)
    if owner_id is not None:
        stmt = stmt.where(Brand.owner_id == owner_id)

    result = await db.execute(stmt)
    brand = result.scalar_one_or_none()
    if not brand:
        raise HTTPException(404, "Brand not found")
    return brand
