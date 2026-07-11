import uuid
import logging
import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.core.database import get_db
from app.core.config import settings
from app.core.rate_limit import limiter
from app.models.models import User, Brand
from app.schemas.schemas import BrandCreate, BrandOut
from app.api.auth import get_current_user

router = APIRouter()
logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    """Return naive UTC datetime compatible with TIMESTAMP WITHOUT TIME ZONE columns."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _normalize_competitor(name: str) -> str:
    """Normalize competitor name for fuzzy matching (ignore spaces, hyphens, underscores, case)."""
    return re.sub(r'[\s\-_\.]+', '', name).lower()


# ─── Brands ────────────────────────────────────────────────────────────────────

@router.post("/brands", response_model=BrandOut, status_code=201, tags=["Brands"])
@limiter.limit(f"{settings.RATE_LIMIT_PER_MINUTE}/minute")
async def create_brand(request: Request, body: BrandCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    competitors_json = [{"name": c, "domain": "", "relevance_score": 5} for c in body.competitors] if body.competitors else None
    brand = Brand(id=uuid.uuid4(), name=body.name, domain=body.domain, owner_id=user.id, competitors=competitors_json)
    db.add(brand)
    await db.commit()
    await db.refresh(brand)
    return brand


@router.get("/brands", response_model=list[BrandOut], tags=["Brands"])
async def list_brands(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    page: int = 1,
    per_page: int = 50,
    search: str = "",
):
    per_page = min(per_page, 100)
    stmt = Brand.active().where(Brand.owner_id == user.id)
    if search:
        stmt = stmt.where(
            (Brand.name.ilike(f"%{search}%")) | (Brand.domain.ilike(f"%{search}%"))
        )
    stmt = stmt.order_by(desc(Brand.created_at)).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/brands/{brand_id}", response_model=BrandOut, tags=["Brands"])
async def get_brand(brand_id: uuid.UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(
        Brand.active().where(Brand.id == brand_id, Brand.owner_id == user.id)
    )
    brand = result.scalar_one_or_none()
    if not brand:
        raise HTTPException(404, "Brand not found")
    return brand


@router.delete("/brands/{brand_id}", status_code=204, tags=["Brands"])
@limiter.limit(f"{settings.RATE_LIMIT_PER_MINUTE}/minute")
async def delete_brand(request: Request, brand_id: uuid.UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """Soft delete a brand: obfuscate data and set deleted_at timestamp."""
    result = await db.execute(
        Brand.active().where(Brand.id == brand_id, Brand.owner_id == user.id)
    )
    brand = result.scalar_one_or_none()
    if not brand:
        raise HTTPException(404, "Brand not found")

    # Obfuscate data for audit trail
    brand.name = f"[deleted-{brand.id}]"
    brand.domain = f"deleted-{brand.id}.invalid"
    brand.competitors = None
    brand.deleted_at = _utcnow()

    await db.commit()
