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
    link_result = await db.execute(
        select(CampaignLink)
        .where(CampaignLink.redirect_path == redirect_path)
        .with_for_update()
    )
    link = link_result.scalar_one_or_none()
    if not link:
        raise HTTPException(404, "Not found")

    # Atomic increment to prevent lost updates
    link.click_count = CampaignLink.click_count + 1

    # Note: click tracking only counts link clicks, not recipient status,
    # because the redirect_path doesn't include recipient identification.
    # Recipient-level click tracking requires recipient_id in the redirect URL.

    await db.commit()

    from fastapi.responses import RedirectResponse
    return RedirectResponse(url=link.original_url)
