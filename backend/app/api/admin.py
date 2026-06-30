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


class CampaignUpdate(BaseModel):
    name: str | None = None
    subject: str | None = None
    html_body: str | None = None
    from_email: str | None = None
    audience_type: AudienceType | None = None
    audience_config: dict | None = None


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
    return resp


@router.put("/campaigns/{campaign_id}", response_model=CampaignResponse)
async def update_campaign(campaign_id: uuid.UUID, body: CampaignUpdate, admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(404, "Campaign not found")
    if campaign.status != CampaignStatus.draft:
        raise HTTPException(400, "Can only edit draft campaigns")

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
    if campaign.status != CampaignStatus.draft:
        raise HTTPException(400, "Can only schedule draft campaigns")

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
    return _campaign_to_response(campaign)


@router.post("/campaigns/{campaign_id}/preview")
async def preview_campaign(campaign_id: uuid.UUID, admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(404, "Campaign not found")

    ok, err = send_email(admin.email, campaign.subject, campaign.html_body, campaign.from_email)
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
        raise HTTPException(400, "Can only modify draft campaigns")

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
    if campaign.status != CampaignStatus.draft:
        raise HTTPException(400, "Can only modify draft campaigns")

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

    # Count total
    count_result = await db.execute(
        select(func.count(CampaignRecipient.id)).where(CampaignRecipient.campaign_id == campaign.id)
    )
    campaign.total_recipients = count_result.scalar() or 0

    await db.commit()
    return {"status": "ok", "recipients": campaign.total_recipients}


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
    }
