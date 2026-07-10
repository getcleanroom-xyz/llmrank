import uuid
import hashlib
import time
import logging
from datetime import datetime, timezone

from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.config import settings
from app.models.models import User

logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


# ─── Session helpers ──────────────────────────────────────────────────────────

def _create_session_token(user_id: str) -> str:
    """Create a signed session token."""
    import hmac
    payload = f"{user_id}:{int(time.time())}"
    sig = hmac.new(settings.SECRET_KEY.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}:{sig}"


def _verify_session_token(token: str) -> str | None:
    """Verify and extract user_id from session token."""
    import hmac
    parts = token.split(":")
    if len(parts) != 3:
        return None
    user_id, ts, sig = parts
    payload = f"{user_id}:{ts}"
    expected = hmac.new(settings.SECRET_KEY.encode(), payload.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(sig, expected):
        return None
    if time.time() - int(ts) > settings.SESSION_EXPIRE_HOURS * 3600:
        return None
    return user_id


def _sign_data(data: str) -> str:
    import hmac
    sig = hmac.new(settings.SECRET_KEY.encode(), data.encode(), hashlib.sha256).hexdigest()
    return f"{data}:{sig}"


def _verify_signed_data(signed: str) -> str | None:
    import hmac
    last_colon = signed.rfind(":")
    if last_colon == -1:
        return None
    data, sig = signed[:last_colon], signed[last_colon + 1:]
    expected = hmac.new(settings.SECRET_KEY.encode(), data.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(sig, expected):
        return None
    return data


# ─── Pending registration store (shared with webauthn.py) ─────────────────────

_pending_registrations: dict[str, dict] = {}
_pending_reg_timestamps: dict[str, float] = {}

REGISTRATION_TTL = 300  # 5 minutes

def _cleanup_pending_registrations():
    """Remove expired pending registrations to prevent memory leak."""
    now = time.time()
    expired = [k for k, ts in _pending_reg_timestamps.items() if now - ts > REGISTRATION_TTL]
    for k in expired:
        _pending_registrations.pop(k, None)
        _pending_reg_timestamps.pop(k, None)


async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)) -> User:
    """Dependency to get current authenticated user."""
    token = request.cookies.get("session")
    if not token:
        raise HTTPException(401, "Not authenticated")
    user_id = _verify_session_token(token)
    if not user_id:
        raise HTTPException(401, "Invalid or expired session")
    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(401, "User not found")
    return user


async def get_optional_user(request: Request, db: AsyncSession = Depends(get_db)) -> User | None:
    """Dependency to get current user if authenticated, None otherwise."""
    token = request.cookies.get("session")
    if not token:
        return None
    user_id = _verify_session_token(token)
    if not user_id:
        return None
    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    return result.scalar_one_or_none()

