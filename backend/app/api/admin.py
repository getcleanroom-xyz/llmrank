import uuid
import csv
import io
import re
import logging
import secrets
import string
from datetime import datetime, timezone
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Form
from pydantic import BaseModel, EmailStr
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.config import settings
from app.models.models import User, Campaign, CampaignRecipient, CampaignLink
from app.models.models import CampaignStatus, ScheduleType, AudienceType, RecipientStatus
from app.api.auth import get_current_user
from app.services.email_service import send_email, prepare_tracked_html
from app.services.scheduler import scheduler, send_campaign_job
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.date import DateTrigger

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["Admin"])


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _generate_path() -> str:
    return ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(10))


_URL_RE = re.compile(r'https?://[^\s"\'<>]+')


# ─── Admin Auth ───────────────────────────────────────────────────────────────

async def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.email not in settings.admin_emails_list:
        raise HTTPException(403, "Admin access required")
    return user


# ─── Schemas ──────────────────────────────────────────────────────────────────

class CampaignCreate(BaseModel):
    name: str
    subject: str
    html_body: str
    from_email: str | None = None
    audience_type: AudienceType = AudienceType.all_users
    audience_config: dict | None = None
    template_vars: list[dict] | None = None


class CampaignUpdate(BaseModel):
    name: str | None = None
    subject: str | None = None
    html_body: str | None = None
    from_email: str | None = None
    audience_type: AudienceType | None = None
    audience_config: dict | None = None
    template_vars: list[dict] | None = None


class ScheduleRequest(BaseModel):
    schedule_type: ScheduleType
    cron_expr: str | None = None
    scheduled_at: datetime | None = None


class CampaignResponse(BaseModel):
    id: str
    name: str
    subject: str
    audience_type: str
    status: str
    schedule_type: str
    cron_expr: str | None
    scheduled_at: str | None
    last_sent_at: str | None
    next_send_at: str | None
    total_recipients: int
    sent_count: int
    opened_count: int
    clicked_count: int
    created_by: str
    created_at: str
    updated_at: str


class CampaignDetailResponse(CampaignResponse):
    html_body: str
    from_email: str
    audience_config: dict | None
    template_vars: list[dict] | None = None
    recipients: list | None = None


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


# ─── Campaign CRUD ────────────────────────────────────────────────────────────

@router.get("/campaigns", response_model=list[CampaignResponse])
async def list_campaigns(admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Campaign).order_by(Campaign.created_at.desc())
    )
    campaigns = result.scalars().all()
    return [_campaign_to_response(c) for c in campaigns]


@router.post("/campaigns", response_model=CampaignResponse, status_code=201)
async def create_campaign(body: CampaignCreate, admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    campaign = Campaign(
        id=uuid.uuid4(),
        name=body.name,
        subject=body.subject,
        html_body=body.html_body,
        from_email=body.from_email or settings.CAMPAIGN_FROM_EMAIL,
        audience_type=body.audience_type,
        audience_config=body.audience_config,
        template_vars=body.template_vars,
        status=CampaignStatus.draft,
        schedule_type=ScheduleType.now,
        created_by=admin.id,
    )
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)
    return _campaign_to_response(campaign)


@router.get("/campaigns/{campaign_id}", response_model=CampaignDetailResponse)
async def get_campaign(campaign_id: uuid.UUID, admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(404, "Campaign not found")
    resp = _campaign_to_response(campaign)
    resp["html_body"] = campaign.html_body
    resp["from_email"] = campaign.from_email
    resp["audience_config"] = campaign.audience_config
    resp["template_vars"] = campaign.template_vars
    return resp


@router.put("/campaigns/{campaign_id}", response_model=CampaignResponse)
async def update_campaign(campaign_id: uuid.UUID, body: CampaignUpdate, admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(404, "Campaign not found")
    if campaign.status not in (CampaignStatus.draft, CampaignStatus.cancelled):
        raise HTTPException(400, "Can only edit draft or cancelled campaigns")

    if body.name is not None:
        campaign.name = body.name
    if body.subject is not None:
        campaign.subject = body.subject
    if body.html_body is not None:
        campaign.html_body = body.html_body
    if body.from_email is not None:
        campaign.from_email = body.from_email
    if body.audience_type is not None:
        campaign.audience_type = body.audience_type
    if body.audience_config is not None:
        campaign.audience_config = body.audience_config
    if body.template_vars is not None:
        campaign.template_vars = body.template_vars

    await db.commit()
    await db.refresh(campaign)
    return _campaign_to_response(campaign)


@router.delete("/campaigns/{campaign_id}")
async def delete_campaign(campaign_id: uuid.UUID, admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(404, "Campaign not found")
    if campaign.status not in (CampaignStatus.draft, CampaignStatus.cancelled):
        raise HTTPException(400, "Can only delete draft or cancelled campaigns")

    await db.delete(campaign)
    await db.commit()
    return {"status": "ok"}


@router.post("/campaigns/{campaign_id}/schedule", response_model=CampaignResponse)
async def schedule_campaign(campaign_id: uuid.UUID, body: ScheduleRequest, admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(404, "Campaign not found")
    if campaign.status not in (CampaignStatus.draft, CampaignStatus.cancelled):
        raise HTTPException(400, "Can only schedule draft or cancelled campaigns")

    campaign.schedule_type = body.schedule_type

    if body.schedule_type == ScheduleType.now:
        campaign.scheduled_at = _utcnow()
    elif body.schedule_type == ScheduleType.once:
        if not body.scheduled_at:
            raise HTTPException(400, "scheduled_at is required for once-off schedule")
        campaign.scheduled_at = body.scheduled_at
        campaign.cron_expr = None
    elif body.schedule_type == ScheduleType.recurring:
        if not body.cron_expr:
            raise HTTPException(400, "cron_expr is required for recurring schedule")
        campaign.cron_expr = body.cron_expr
        campaign.scheduled_at = body.scheduled_at or _utcnow()

    campaign.status = CampaignStatus.scheduled
    campaign.next_send_at = campaign.scheduled_at
    await db.commit()
    await db.refresh(campaign)

    # Register job with running APScheduler
    base_url = settings.cors_origins_list[0] if settings.cors_origins_list else "https://llmrank.getcleanroom.xyz"
    job_id = f"campaign_{campaign.id}"
    try:
        if scheduler.get_job(job_id):
            scheduler.remove_job(job_id)
        if body.schedule_type == ScheduleType.now:
            scheduler.add_job(
                send_campaign_job,
                args=[str(campaign.id), base_url],
                id=job_id,
                replace_existing=True,
                misfire_grace_time=300,
            )
        elif body.schedule_type == ScheduleType.once:
            scheduler.add_job(
                send_campaign_job,
                trigger=DateTrigger(run_date=campaign.scheduled_at),
                args=[str(campaign.id), base_url],
                id=job_id,
                replace_existing=True,
                misfire_grace_time=300,
            )
        elif body.schedule_type == ScheduleType.recurring and campaign.cron_expr:
            scheduler.add_job(
                send_campaign_job,
                trigger=CronTrigger.from_crontab(campaign.cron_expr),
                args=[str(campaign.id), base_url],
                id=job_id,
                replace_existing=True,
                misfire_grace_time=300,
            )
    except Exception:
        logger.exception("Failed to register scheduler job for campaign %s", campaign.id)

    return _campaign_to_response(campaign)


@router.post("/campaigns/{campaign_id}/cancel", response_model=CampaignResponse)
async def cancel_campaign(campaign_id: uuid.UUID, admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(404, "Campaign not found")
    if campaign.status not in (CampaignStatus.scheduled, CampaignStatus.sending):
        raise HTTPException(400, "Campaign is not scheduled or sending")

    campaign.status = CampaignStatus.cancelled
    await db.commit()
    await db.refresh(campaign)

    # Remove from scheduler
    try:
        scheduler.remove_job(f"campaign_{campaign.id}")
    except Exception:
        pass

    return _campaign_to_response(campaign)


@router.post("/campaigns/{campaign_id}/preview")
async def preview_campaign(campaign_id: uuid.UUID, admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(404, "Campaign not found")

    # Render with sample data for preview
    sample_vars = _build_sample_vars(admin, campaign.template_vars)
    preview_html = _apply_template_vars(campaign.html_body, sample_vars)

    ok, err = send_email(admin.email, campaign.subject, preview_html, campaign.from_email)
    if not ok:
        raise HTTPException(500, f"Failed to send preview: {err}")
    return {"status": "ok", "message": f"Preview sent to {admin.email}"}


# ─── Audience ─────────────────────────────────────────────────────────────────

@router.get("/users", response_model=list[AdminUserResponse])
async def list_users(search: str | None = None, admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    query = select(User).order_by(User.created_at.desc())
    if search:
        query = query.where(User.email.ilike(f"%{search}%") | User.display_name.ilike(f"%{search}%"))
    result = await db.execute(query)
    users = result.scalars().all()
    return [
        AdminUserResponse(id=str(u.id), email=u.email, display_name=u.display_name, created_at=u.created_at.isoformat())
        for u in users
    ]


@router.post("/campaigns/{campaign_id}/upload-csv")
async def upload_campaign_csv(
    campaign_id: uuid.UUID,
    file: UploadFile = File(...),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(404, "Campaign not found")
    if campaign.status != CampaignStatus.draft:
        raise HTTPException(400, "Can only modify draft or cancelled campaigns")

    content = await file.read()
    text = content.decode("utf-8-sig")
    reader = csv.reader(io.StringIO(text))

    emails = []
    for row in reader:
        for cell in row:
            cell = cell.strip()
            if "@" in cell:
                emails.append(cell)

    if not emails:
        raise HTTPException(400, "No valid emails found in CSV")

    campaign.audience_type = AudienceType.upload
    campaign.audience_config = {"emails": emails, "filename": file.filename}
    campaign.total_recipients = len(emails)

    await db.execute(delete(CampaignRecipient).where(CampaignRecipient.campaign_id == campaign.id))
    for email in emails:
        db.add(CampaignRecipient(id=uuid.uuid4(), campaign_id=campaign.id, email=email))

    await db.commit()
    return {"status": "ok", "recipients_added": len(emails)}


@router.post("/campaigns/{campaign_id}/build-audience")
async def build_campaign_audience(campaign_id: uuid.UUID, admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(404, "Campaign not found")
    if campaign.status not in (CampaignStatus.draft, CampaignStatus.cancelled):
        raise HTTPException(400, "Can only modify draft or cancelled campaigns")

    await db.execute(delete(CampaignRecipient).where(CampaignRecipient.campaign_id == campaign.id))

    if campaign.audience_type == AudienceType.all_users:
        users_result = await db.execute(select(User).order_by(User.created_at))
        users = users_result.scalars().all()
        for u in users:
            db.add(CampaignRecipient(id=uuid.uuid4(), campaign_id=campaign.id, email=u.email, user_id=u.id))

    elif campaign.audience_type == AudienceType.segment:
        config = campaign.audience_config or {}
        query = select(User)
        if config.get("signed_up_before"):
            query = query.where(User.created_at < datetime.fromisoformat(config["signed_up_before"]))
        if config.get("signed_up_after"):
            query = query.where(User.created_at > datetime.fromisoformat(config["signed_up_after"]))

        users_result = await db.execute(query.order_by(User.created_at))
        users = users_result.scalars().all()
        for u in users:
            db.add(CampaignRecipient(id=uuid.uuid4(), campaign_id=campaign.id, email=u.email, user_id=u.id))

    elif campaign.audience_type == AudienceType.upload:
        emails = (campaign.audience_config or {}).get("emails", [])
        for email in emails:
            db.add(CampaignRecipient(id=uuid.uuid4(), campaign_id=campaign.id, email=email))

    elif campaign.audience_type == AudienceType.selected:
        config = campaign.audience_config or {}
        user_ids = config.get("user_ids", [])
        if user_ids:
            users_result = await db.execute(select(User).where(User.id.in_([uuid.UUID(uid) for uid in user_ids])))
            for u in users_result.scalars().all():
                db.add(CampaignRecipient(id=uuid.uuid4(), campaign_id=campaign.id, email=u.email, user_id=u.id))
        for email in config.get("emails", []):
            db.add(CampaignRecipient(id=uuid.uuid4(), campaign_id=campaign.id, email=email))

    # Count total
    count_result = await db.execute(
        select(func.count(CampaignRecipient.id)).where(CampaignRecipient.campaign_id == campaign.id)
    )
    campaign.total_recipients = count_result.scalar() or 0

    await db.commit()
    return {"status": "ok", "recipients": campaign.total_recipients}


# ─── Clone ─────────────────────────────────────────────────────────────────────

@router.post("/campaigns/{campaign_id}/clone", response_model=CampaignDetailResponse, status_code=201)
async def clone_campaign(campaign_id: uuid.UUID, admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    original = result.scalar_one_or_none()
    if not original:
        raise HTTPException(404, "Campaign not found")

    clone = Campaign(
        id=uuid.uuid4(),
        name=f"{original.name} (copy)",
        subject=original.subject,
        html_body=original.html_body,
        from_email=original.from_email,
        audience_type=original.audience_type,
        audience_config=original.audience_config,
        template_vars=original.template_vars,
        status=CampaignStatus.draft,
        schedule_type=ScheduleType.now,
        created_by=admin.id,
    )
    db.add(clone)
    await db.commit()
    await db.refresh(clone)
    resp = _campaign_to_response(clone)
    resp["html_body"] = clone.html_body
    resp["from_email"] = clone.from_email
    resp["audience_config"] = clone.audience_config
    resp["template_vars"] = clone.template_vars
    return resp


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


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _campaign_to_response(c: Campaign) -> dict:
    return {
        "id": str(c.id),
        "name": c.name,
        "subject": c.subject,
        "audience_type": c.audience_type.value if c.audience_type else "",
        "status": c.status.value if c.status else "",
        "schedule_type": c.schedule_type.value if c.schedule_type else "",
        "cron_expr": c.cron_expr,
        "scheduled_at": c.scheduled_at.isoformat() if c.scheduled_at else None,
        "last_sent_at": c.last_sent_at.isoformat() if c.last_sent_at else None,
        "next_send_at": c.next_send_at.isoformat() if c.next_send_at else None,
        "total_recipients": c.total_recipients,
        "sent_count": c.sent_count,
        "opened_count": c.opened_count,
        "clicked_count": c.clicked_count,
        "created_by": str(c.created_by),
        "created_at": c.created_at.isoformat() if c.created_at else "",
        "updated_at": c.updated_at.isoformat() if c.updated_at else "",
        "template_vars": c.template_vars,
    }


# ─── Template helpers ─────────────────────────────────────────────────────────

_TEMPLATE_RE = re.compile(r'\{\{(\s*[a-zA-Z_][a-zA-Z0-9_]*\s*)\}}')


def _build_sample_vars(admin: User, template_vars: list[dict] | None) -> dict[str, str]:
    """Build a sample variable context for preview."""
    ctx = {
        "display_name": admin.display_name,
        "email": admin.email,
    }
    if template_vars:
        for v in template_vars:
            key = v.get("key", "").strip()
            if key and key not in ctx:
                ctx[key] = v.get("default_value", v.get("default", f"[{v.get('label', key)}]"))
    return ctx


def _build_recipient_vars(user: User | None, email: str, template_vars: list[dict] | None) -> dict[str, str]:
    """Build variable context for a given recipient."""
    name = user.display_name if user else email.split("@")[0]
    ctx = {
        "display_name": name,
        "email": email,
        "name": name,
    }
    if template_vars:
        for v in template_vars:
            key = v.get("key", "").strip()
            if key and key not in ctx:
                ctx[key] = v.get("default_value", v.get("default", ""))
    return ctx


def _apply_template_vars(html_body: str, ctx: dict[str, str]) -> str:
    """Replace all {{ key }} placeholders with values from ctx."""
    def _replacer(m: re.Match) -> str:
        key = m.group(1).strip()
        return ctx.get(key, "")
    return _TEMPLATE_RE.sub(_replacer, html_body)
