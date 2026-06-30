import uuid
import logging
import re
from datetime import datetime, timezone
from urllib.parse import urlparse

from sqlalchemy import select, func, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Campaign, CampaignRecipient, CampaignLink
from app.models.models import CampaignStatus, ScheduleType, RecipientStatus
from app.services.email_service import send_email, prepare_tracked_html

logger = logging.getLogger(__name__)

_URL_RE = re.compile(r'https?://[^\s"\'<>]+')


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


async def dispatch_campaign(db: AsyncSession, campaign_id: uuid.UUID, base_url: str):
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = result.scalar_one_or_none()
    if not campaign or campaign.status not in (CampaignStatus.scheduled, CampaignStatus.sending, CampaignStatus.draft):
        return

    if campaign.status == CampaignStatus.draft:
        campaign.status = CampaignStatus.scheduled
        await db.flush()

    # Build audience if not yet built
    recipients_result = await db.execute(
        select(func.count(CampaignRecipient.id)).where(CampaignRecipient.campaign_id == campaign.id)
    )
    if (recipients_result.scalar() or 0) == 0:
        await _build_audience(db, campaign)

    # Find all URLs in html_body and create tracking links
    urls = set(_URL_RE.findall(campaign.html_body))
    await db.execute(delete(CampaignLink).where(CampaignLink.campaign_id == campaign.id))
    link_map = {}
    for url in urls:
        link = CampaignLink(
            id=uuid.uuid4(),
            campaign_id=campaign.id,
            original_url=url,
            redirect_path=_generate_path(),
        )
        db.add(link)
        link_map[url] = link.redirect_path
    await db.flush()

    links_data = [{"original_url": url, "redirect_path": path} for url, path in link_map.items()]

    # Mark as sending
    campaign.status = CampaignStatus.sending
    await db.flush()

    # Fetch recipients
    rec_result = await db.execute(
        select(CampaignRecipient).where(
            CampaignRecipient.campaign_id == campaign.id,
            CampaignRecipient.status == RecipientStatus.pending,
        )
    )
    recipients = rec_result.scalars().all()

    sent = 0
    for recipient in recipients:
        tracked_html = prepare_tracked_html(campaign.html_body, str(campaign.id), str(recipient.id), links_data, base_url)
        ok, err = send_email(recipient.email, campaign.subject, tracked_html, campaign.from_email)
        if ok:
            recipient.status = RecipientStatus.sent
            recipient.sent_at = _utcnow()
            sent += 1
        else:
            recipient.status = RecipientStatus.failed
            recipient.error = err
            logger.error("Failed to send campaign %s to %s: %s", campaign.id, recipient.email, err)
        await db.flush()

    campaign.sent_count += sent
    campaign.last_sent_at = _utcnow()

    if campaign.schedule_type == ScheduleType.recurring and campaign.cron_expr:
        # For recurring, keep as scheduled for next run
        campaign.status = CampaignStatus.scheduled
        campaign.next_send_at = None  # APScheduler will set the next trigger time
    else:
        campaign.status = CampaignStatus.sent

    # Update campaign aggregate counts
    open_count = await db.execute(
        select(func.count(CampaignRecipient.id)).where(
            CampaignRecipient.campaign_id == campaign.id,
            CampaignRecipient.status.in_([RecipientStatus.opened, RecipientStatus.clicked]),
        )
    )
    campaign.opened_count = open_count.scalar() or 0

    click_count = await db.execute(
        select(func.count(CampaignRecipient.id)).where(
            CampaignRecipient.campaign_id == campaign.id,
            CampaignRecipient.status == RecipientStatus.clicked,
        )
    )
    campaign.clicked_count = click_count.scalar() or 0

    await db.commit()


async def _build_audience(db: AsyncSession, campaign: Campaign):
    from app.models.models import User
    from app.core.database import AsyncSessionLocal

    await db.execute(delete(CampaignRecipient).where(CampaignRecipient.campaign_id == campaign.id))

    if campaign.audience_type.value == "all_users":
        users_result = await db.execute(select(User).order_by(User.created_at))
        users = users_result.scalars().all()
        for u in users:
            db.add(CampaignRecipient(id=uuid.uuid4(), campaign_id=campaign.id, email=u.email, user_id=u.id))

    elif campaign.audience_type.value == "segment":
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

    elif campaign.audience_type.value == "upload":
        emails = (campaign.audience_config or {}).get("emails", [])
        for email in emails:
            db.add(CampaignRecipient(id=uuid.uuid4(), campaign_id=campaign.id, email=email))

    count_result = await db.execute(
        select(func.count(CampaignRecipient.id)).where(CampaignRecipient.campaign_id == campaign.id)
    )
    campaign.total_recipients = count_result.scalar() or 0
    await db.flush()


import secrets
import string


def _generate_path() -> str:
    return ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(10))
