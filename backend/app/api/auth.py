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
MAX_PENDING_REGISTRATIONS = 1000

def _cleanup_pending_registrations():
    """Remove expired pending registrations and enforce max size."""
    now = time.time()
    expired = [k for k, ts in _pending_reg_timestamps.items() if now - ts > REGISTRATION_TTL]
    for k in expired:
        _pending_registrations.pop(k, None)
        _pending_reg_timestamps.pop(k, None)
    # Enforce max size even if TTL hasn't expired
    if len(_pending_registrations) > MAX_PENDING_REGISTRATIONS:
        oldest = sorted(_pending_reg_timestamps, key=_pending_reg_timestamps.get)[:len(_pending_registrations) - MAX_PENDING_REGISTRATIONS]
        for k in oldest:
            _pending_registrations.pop(k, None)
            _pending_reg_timestamps.pop(k, None)


# ─── Revoked session store (for logout/revocation) ───────────────────────────
_revoked_tokens: set[str] = set()
MAX_REVOKED_TOKENS = 10000

def _revoke_token(token: str):
    """Mark a session token as revoked."""
    if len(_revoked_tokens) >= MAX_REVOKED_TOKENS:
        # Evict oldest entries (tokens are FIFO, so just clear half)
        to_remove = len(_revoked_tokens) // 2
        for _ in range(to_remove):
            _revoked_tokens.pop()
    _revoked_tokens.add(token)

def _is_token_revoked(token: str) -> bool:
    """Check if a session token has been revoked."""
    return token in _revoked_tokens


# ─── Recovery code rate limiting ──────────────────────────────────────────────
_recovery_rate_limits: dict[str, list[float]] = {}  # email -> list of timestamps
RECOVERY_RATE_LIMIT = 3  # max attempts per window
RECOVERY_RATE_WINDOW = 900  # 15 minutes

def _check_recovery_rate_limit(email: str) -> bool:
    """Returns True if rate limit allows, False if exceeded."""
    now = time.time()
    attempts = _recovery_rate_limits.get(email, [])
    # Remove expired entries
    attempts = [t for t in attempts if now - t < RECOVERY_RATE_WINDOW]
    if len(attempts) >= RECOVERY_RATE_LIMIT:
        return False
    attempts.append(now)
    _recovery_rate_limits[email] = attempts
    return True


async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)) -> User:
    """Dependency to get current authenticated user."""
    token = request.cookies.get("session")
    if not token:
        raise HTTPException(401, "Not authenticated")
    if _is_token_revoked(token):
        raise HTTPException(401, "Session has been revoked")
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
    if _is_token_revoked(token):
        return None
    user_id = _verify_session_token(token)
    if not user_id:
        return None
    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    return result.scalar_one_or_none()

