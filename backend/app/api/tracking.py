import uuid
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.models import CampaignRecipient, CampaignLink, RecipientStatus

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/track", tags=["Tracking"])

TRANSPARENT_PIXEL = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
    "000000017352474200aece1ce90000000467414d410000b18f0bfc610500000009"
    "7048597300000ec300000ec301c76fa8640000000c4944415418d6366000000002"
    "000105d5b5720000000049454e44ae426082"
)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


@router.get("/open/{recipient_id}.png")
async def track_open(recipient_id: str, db: AsyncSession = Depends(get_db)):
    try:
        rid = uuid.UUID(recipient_id)
    except ValueError:
        raise HTTPException(404, "Not found")

    result = await db.execute(select(CampaignRecipient).where(CampaignRecipient.id == rid))
    recipient = result.scalar_one_or_none()
    if not recipient:
        raise HTTPException(404, "Not found")

    if recipient.status not in (RecipientStatus.clicked,):
        recipient.status = RecipientStatus.opened
    if not recipient.opened_at:
        recipient.opened_at = _utcnow()

    await db.commit()

    return Response(content=TRANSPARENT_PIXEL, media_type="image/png")


@router.get("/click/{redirect_path}")
async def track_click(redirect_path: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CampaignLink).where(CampaignLink.redirect_path == redirect_path))
    link = result.scalar_one_or_none()
    if not link:
        raise HTTPException(404, "Not found")

    link.click_count += 1

    # Update any recipient that opened from this campaign to clicked
    await db.execute(
        update(CampaignRecipient)
        .where(
            CampaignRecipient.campaign_id == link.campaign_id,
            CampaignRecipient.status == RecipientStatus.opened,
        )
        .values(status=RecipientStatus.clicked, clicked_at=_utcnow())
    )

    await db.commit()

    from fastapi.responses import RedirectResponse
    return RedirectResponse(url=link.original_url)
