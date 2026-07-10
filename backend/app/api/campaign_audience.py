"""Campaign audience building: CSV upload, user segments."""
import uuid
import csv
import io
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.models import User, Campaign, CampaignRecipient, CampaignStatus, AudienceType
from app.api.admin import require_admin

router = APIRouter(prefix="/admin", tags=["Admin"])


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
        for u in users_result.scalars().all():
            db.add(CampaignRecipient(id=uuid.uuid4(), campaign_id=campaign.id, email=u.email, user_id=u.id))

    elif campaign.audience_type == AudienceType.segment:
        config = campaign.audience_config or {}
        query = select(User)
        if config.get("signed_up_before"):
            query = query.where(User.created_at < datetime.fromisoformat(config["signed_up_before"]))
        if config.get("signed_up_after"):
            query = query.where(User.created_at > datetime.fromisoformat(config["signed_up_after"]))
        users_result = await db.execute(query.order_by(User.created_at))
        for u in users_result.scalars().all():
            db.add(CampaignRecipient(id=uuid.uuid4(), campaign_id=campaign.id, email=u.email, user_id=u.id))

    elif campaign.audience_type == AudienceType.upload:
        for email in (campaign.audience_config or {}).get("emails", []):
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

    count_result = await db.execute(
        select(func.count(CampaignRecipient.id)).where(CampaignRecipient.campaign_id == campaign.id)
    )
    campaign.total_recipients = count_result.scalar() or 0

    await db.commit()
    return {"status": "ok", "recipients": campaign.total_recipients}
