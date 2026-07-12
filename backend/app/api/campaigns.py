import uuid
import re
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.config import settings
from app.models.models import User, Campaign, CampaignStatus, ScheduleType, AudienceType
from app.api.admin import require_admin
from app.api.campaign_templates import (
    campaign_to_response, build_sample_vars, apply_template_vars,
)
from app.services.email_service import send_email
from app.services.scheduler import scheduler, send_campaign_job
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.date import DateTrigger

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["Admin"])


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


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


# ─── Campaign CRUD ────────────────────────────────────────────────────────────

@router.get("/campaigns", response_model=list[CampaignResponse])
async def list_campaigns(admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Campaign).order_by(Campaign.created_at.desc()))
    return [campaign_to_response(c) for c in result.scalars().all()]


@router.post("/campaigns", response_model=CampaignResponse, status_code=201)
async def create_campaign(body: CampaignCreate, admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    campaign = Campaign(
        id=uuid.uuid4(), name=body.name, subject=body.subject, html_body=body.html_body,
        from_email=body.from_email or settings.CAMPAIGN_FROM_EMAIL,
        audience_type=body.audience_type, audience_config=body.audience_config,
        template_vars=body.template_vars, status=CampaignStatus.draft,
        schedule_type=ScheduleType.now, created_by=admin.id,
    )
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)
    return campaign_to_response(campaign)


@router.get("/campaigns/{campaign_id}", response_model=CampaignDetailResponse)
async def get_campaign(campaign_id: uuid.UUID, admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(404, "Campaign not found")
    resp = campaign_to_response(campaign)
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
    for field in ("name", "subject", "html_body", "from_email", "audience_type", "audience_config", "template_vars"):
        val = getattr(body, field)
        if val is not None:
            setattr(campaign, field, val)
    await db.commit()
    await db.refresh(campaign)
    return campaign_to_response(campaign)


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

    base_url = settings.cors_origins_list[0] if settings.cors_origins_list else "https://llmrank.getcleanroom.xyz"
    job_id = f"campaign_{campaign.id}"
    try:
        if scheduler.get_job(job_id):
            scheduler.remove_job(job_id)
        if body.schedule_type == ScheduleType.now:
            scheduler.add_job(send_campaign_job, args=[str(campaign.id), base_url], id=job_id, replace_existing=True, misfire_grace_time=300)
        elif body.schedule_type == ScheduleType.once:
            scheduler.add_job(send_campaign_job, trigger=DateTrigger(run_date=campaign.scheduled_at), args=[str(campaign.id), base_url], id=job_id, replace_existing=True, misfire_grace_time=300)
        elif body.schedule_type == ScheduleType.recurring and campaign.cron_expr:
            scheduler.add_job(send_campaign_job, trigger=CronTrigger.from_crontab(campaign.cron_expr), args=[str(campaign.id), base_url], id=job_id, replace_existing=True, misfire_grace_time=300)
    except Exception:
        logger.exception("Failed to register scheduler job for campaign %s", campaign.id)

    return campaign_to_response(campaign)


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
    try:
        scheduler.remove_job(f"campaign_{campaign.id}")
    except Exception:
        pass
    return campaign_to_response(campaign)


@router.post("/campaigns/{campaign_id}/preview")
async def preview_campaign(campaign_id: uuid.UUID, admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    from app.models.models import User
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(404, "Campaign not found")
    sample_vars = build_sample_vars(admin, campaign.template_vars)
    preview_html = apply_template_vars(campaign.html_body, sample_vars)
    ok, err = send_email(admin.email, campaign.subject, preview_html, campaign.from_email)
    if not ok:
        raise HTTPException(500, f"Failed to send preview: {err}")
    return {"status": "ok", "message": f"Preview sent to {admin.email}"}


@router.post("/campaigns/{campaign_id}/clone", response_model=CampaignDetailResponse, status_code=201)
async def clone_campaign(campaign_id: uuid.UUID, admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    original = result.scalar_one_or_none()
    if not original:
        raise HTTPException(404, "Campaign not found")
    clone = Campaign(
        id=uuid.uuid4(), name=f"{original.name} (copy)", subject=original.subject,
        html_body=original.html_body, from_email=original.from_email,
        audience_type=original.audience_type, audience_config=original.audience_config,
        template_vars=original.template_vars, status=CampaignStatus.draft,
        schedule_type=ScheduleType.now, created_by=admin.id,
    )
    db.add(clone)
    await db.commit()
    await db.refresh(clone)
    resp = campaign_to_response(clone)
    resp["html_body"] = clone.html_body
    resp["from_email"] = clone.from_email
    resp["audience_config"] = clone.audience_config
    resp["template_vars"] = clone.template_vars
    return resp
