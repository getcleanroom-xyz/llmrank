import hmac

from fastapi import APIRouter, Depends, HTTPException, Header
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


class BlogGenerateResponse(BaseModel):
    title: str
    filename: str
    pr_url: str | None
    social: dict


# ─── Users ────────────────────────────────────────────────────────────────────

@router.get("/users", response_model=list[AdminUserResponse])
async def list_users(search: str | None = None, page: int = 1, per_page: int = 50, admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    query = select(User).order_by(User.created_at.desc())
    if search:
        safe_search = search.replace("%", "\\%").replace("_", "\\_")
        query = query.where(User.email.ilike(f"%{safe_search}%", escape="\\") | User.display_name.ilike(f"%{safe_search}%", escape="\\"))
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


# ─── Blog ────────────────────────────────────────────────────────────────────

@router.post("/blog/generate", response_model=BlogGenerateResponse)
async def generate_blog(admin: User = Depends(require_admin)):
    """Generate a blog post from the content calendar and create a PR."""
    from app.services.blog_generator import run_weekly_post

    result = await run_weekly_post()
    if not result:
        raise HTTPException(500, "Blog generation failed. Check logs for details.")

    return BlogGenerateResponse(
        title=result["title"],
        filename=result["filename"],
        pr_url=result.get("pr_url"),
        social=result.get("social", {}),
    )


@router.get("/blog/calendar")
async def list_calendar(admin: User = Depends(require_admin)):
    """List remaining topics in the content calendar."""
    from app.services.blog_generator import load_calendar
    return {"topics": load_calendar()}


@router.get("/blog/posts")
async def list_generated_posts(admin: User = Depends(require_admin)):
    """List all blog posts (generated and manual)."""
    import os
    blog_dir = os.path.join(os.path.dirname(__file__), "..", "..", "..", "frontend", "content", "blog")
    posts = []
    if os.path.exists(blog_dir):
        for f in sorted(os.listdir(blog_dir)):
            if f.endswith(".md"):
                posts.append({"filename": f, "generated": f.startswith("generated-")})
    return {"posts": posts}


# ─── Blog Webhook (for GitHub Actions) ────────────────────────────────────────

@router.post("/blog/webhook")
async def blog_webhook(authorization: str = Header(None)):
    """Webhook endpoint for GitHub Actions to trigger blog generation.

    Expects: Authorization: Bearer <BLOG_WEBHOOK_SECRET>
    """
    import os
    secret = os.environ.get("BLOG_WEBHOOK_SECRET")
    if not secret:
        raise HTTPException(503, "Blog webhook not configured (BLOG_WEBHOOK_SECRET not set)")

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing or invalid Authorization header")

    token = authorization.removeprefix("Bearer ").strip()
    if not hmac.compare_digest(token, secret):
        raise HTTPException(403, "Invalid webhook secret")

    from app.services.blog_generator import run_weekly_post

    result = await run_weekly_post()
    if not result:
        raise HTTPException(500, "Blog generation failed. Check logs for details.")

    return {
        "status": "ok",
        "title": result["title"],
        "filename": result["filename"],
        "pr_url": result.get("pr_url"),
    }
