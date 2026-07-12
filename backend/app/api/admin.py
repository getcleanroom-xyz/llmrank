from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.models import User, Campaign
from app.api.auth import get_current_user
from app.core.config import settings

router = APIRouter(prefix="/admin", tags=["Admin"])


# ─── Admin Auth ───────────────────────────────────────────────────────────────

async def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.email not in settings.admin_emails_list:
        raise HTTPException(403, "Admin access required")
    return user


# ─── Schemas ──────────────────────────────────────────────────────────────────

class AdminUserResponse(BaseModel):
    id: str
    email: str
    display_name: str
    created_at: str


class StatsResponse(BaseModel):
    total_users: int
    total_campaigns: int
    total_sent: int
    total_opened: int
    total_clicked: int


# ─── Users ────────────────────────────────────────────────────────────────────

@router.get("/users", response_model=list[AdminUserResponse])
async def list_users(search: str | None = None, page: int = 1, per_page: int = 50, admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    query = select(User).order_by(User.created_at.desc())
    if search:
        query = query.where(User.email.ilike(f"%{search}%") | User.display_name.ilike(f"%{search}%"))
    query = query.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    users = result.scalars().all()
    return [
        AdminUserResponse(id=str(u.id), email=u.email, display_name=u.display_name, created_at=u.created_at.isoformat())
        for u in users
    ]


# ─── Stats ────────────────────────────────────────────────────────────────────

@router.get("/stats", response_model=StatsResponse)
async def admin_stats(admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    users_count = (await db.execute(select(func.count(User.id)))).scalar() or 0
    campaigns_count = (await db.execute(select(func.count(Campaign.id)))).scalar() or 0

    sent = (await db.execute(select(func.coalesce(func.sum(Campaign.sent_count), 0)))).scalar() or 0
    opened = (await db.execute(select(func.coalesce(func.sum(Campaign.opened_count), 0)))).scalar() or 0
    clicked = (await db.execute(select(func.coalesce(func.sum(Campaign.clicked_count), 0)))).scalar() or 0

    return StatsResponse(
        total_users=users_count,
        total_campaigns=campaigns_count,
        total_sent=sent,
        total_opened=opened,
        total_clicked=clicked,
    )
