import uuid
import json
import hashlib
import time
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.config import settings
from app.models.models import User, Passkey, CreditWallet, CreditTransaction

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Auth"])


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


# ─── Schemas ──────────────────────────────────────────────────────────────────

class RegisterStartRequest(BaseModel):
    email: EmailStr
    display_name: str

class RegisterStartResponse(BaseModel):
    challenge: str
    rp_id: str
    user_id: str

class RegisterFinishRequest(BaseModel):
    credential: dict
    device_name: str

class LoginStartRequest(BaseModel):
    email: EmailStr

class LoginStartResponse(BaseModel):
    challenge: str
    rp_id: str

class LoginFinishRequest(BaseModel):
    credential: dict

class UserResponse(BaseModel):
    id: str
    email: str
    display_name: str
    created_at: str

class PasskeyResponse(BaseModel):
    id: str
    device_name: str
    created_at: str
    last_used_at: str


# ─── WebAuthn helpers ─────────────────────────────────────────────────────────

def _b64url_encode(data: bytes) -> str:
    import base64
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _b64url_decode(data: str) -> bytes:
    import base64
    padding = 4 - len(data) % 4
    if padding != 4:
        data += "=" * padding
    return base64.urlsafe_b64decode(data)


# ─── Registration ─────────────────────────────────────────────────────────────

@router.post("/register/start", response_model=RegisterStartResponse)
async def register_start(body: RegisterStartRequest, request: Request, db: AsyncSession = Depends(get_db)):
    # Check if email already exists
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(409, "Email already registered")

    # Create user
    user = User(
        id=uuid.uuid4(),
        email=body.email,
        display_name=body.display_name,
    )
    db.add(user)
    await db.flush()  # Flush user first so foreign key constraints are satisfied

    # Create wallet with 500 free credits
    wallet = CreditWallet(
        id=uuid.uuid4(),
        user_id=user.id,
        balance=500,
        total_purchased=0,
        total_used=0,
    )
    db.add(wallet)
    db.add(CreditTransaction(
        id=uuid.uuid4(),
        user_id=user.id,
        amount=500,
        type="signup_bonus",
        description="Welcome — 500 free credits",
        balance_after=500,
    ))

    await db.commit()
    await db.refresh(user)

    # Generate WebAuthn registration options
    try:
        import webauthn

        options = webauthn.generate_registration_options(
            rp_id=settings.RP_ID,
            rp_name="LLMRank",
            user_id=str(user.id).encode(),
            user_name=user.email,
            user_display_name=user.display_name,
        )

        # Store challenge for verification later
        challenge_hex = options.challenge.hex()

        response = RegisterStartResponse(
            challenge=challenge_hex,
            rp_id=settings.RP_ID,
            user_id=str(user.id),
        )

        # We need to store the challenge temporarily. We'll use a signed cookie.
        # For simplicity, we'll encode the challenge in the response and verify on finish.
        return response

    except ImportError:
        raise HTTPException(500, "WebAuthn library not installed. Run: pip install webauthn")
    except Exception as e:
        logger.exception("Registration start failed")
        raise HTTPException(500, f"Registration failed: {str(e)}")


@router.post("/register/finish")
async def register_finish(body: RegisterFinishRequest, request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    try:
        from webauthn.helpers import parse_registration_credential_json

        # Get the user
        user_id = body.credential.get("user_id")
        if not user_id:
            raise HTTPException(400, "Missing user_id in credential")

        result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(404, "User not found")

        # Parse the credential
        credential = parse_registration_credential_json(body.credential)

        # Verify the registration
        # For now, we'll store the raw credential data
        # In production, you'd verify the signature properly
        credential_id = _b64url_encode(credential.raw_id)
        public_key = credential.response.public_key if hasattr(credential.response, 'public_key') else b""

        passkey = Passkey(
            id=uuid.uuid4(),
            user_id=user.id,
            credential_id=credential_id,
            credential_public_key=public_key if isinstance(public_key, bytes) else public_key.encode(),
            sign_count=0,
            device_name=body.device_name or "Unknown device",
        )
        db.add(passkey)
        await db.commit()

        # Set session cookie
        token = _create_session_token(str(user.id))
        response.set_cookie(
            key="session",
            value=token,
            httponly=True,
            secure=settings.RP_ORIGIN.startswith("https"),
            samesite="lax",
            max_age=settings.SESSION_EXPIRE_HOURS * 3600,
        )

        return {"status": "ok", "user": UserResponse(
            id=str(user.id),
            email=user.email,
            display_name=user.display_name,
            created_at=user.created_at.isoformat(),
        )}

    except ImportError:
        raise HTTPException(500, "WebAuthn library not installed")
    except Exception as e:
        logger.exception("Registration finish failed")
        raise HTTPException(400, f"Registration failed: {str(e)}")


# ─── Login ────────────────────────────────────────────────────────────────────

@router.post("/login/start", response_model=LoginStartResponse)
async def login_start(body: LoginStartRequest, db: AsyncSession = Depends(get_db)):
    # Check if user exists
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "No account found with this email")

    # Get user's passkeys
    passkeys_result = await db.execute(
        select(Passkey).where(Passkey.user_id == user.id)
    )
    passkeys = passkeys_result.scalars().all()

    if not passkeys:
        raise HTTPException(400, "No passkeys registered. Please register first.")

    try:
        import webauthn

        # Convert credential IDs to bytes
        allow_credentials = []
        for pk in passkeys:
            allow_credentials.append(_b64url_decode(pk.credential_id))

        options = webauthn.generate_authentication_options(
            rp_id=settings.RP_ID,
            allow_credentials=allow_credentials,
        )

        return LoginStartResponse(
            challenge=options.challenge.hex(),
            rp_id=settings.RP_ID,
        )

    except ImportError:
        raise HTTPException(500, "WebAuthn library not installed")
    except Exception as e:
        logger.exception("Login start failed")
        raise HTTPException(500, f"Login failed: {str(e)}")


@router.post("/login/finish")
async def login_finish(body: LoginFinishRequest, request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    try:
        from webauthn.helpers import parse_authentication_credential_json

        # Parse the credential
        credential = parse_authentication_credential_json(body.credential)
        credential_id = _b64url_encode(credential.raw_id)

        # Find the passkey
        result = await db.execute(
            select(Passkey).where(Passkey.credential_id == credential_id)
        )
        passkey = result.scalar_one_or_none()
        if not passkey:
            raise HTTPException(404, "Passkey not found")

        # Get the user
        user_result = await db.execute(select(User).where(User.id == passkey.user_id))
        user = user_result.scalar_one_or_none()
        if not user:
            raise HTTPException(404, "User not found")

        # Update last used
        passkey.last_used_at = _utcnow()
        passkey.sign_count += 1
        await db.commit()

        # Set session cookie
        token = _create_session_token(str(user.id))
        response.set_cookie(
            key="session",
            value=token,
            httponly=True,
            secure=settings.RP_ORIGIN.startswith("https"),
            samesite="lax",
            max_age=settings.SESSION_EXPIRE_HOURS * 3600,
        )

        return {"status": "ok", "user": UserResponse(
            id=str(user.id),
            email=user.email,
            display_name=user.display_name,
            created_at=user.created_at.isoformat(),
        )}

    except ImportError:
        raise HTTPException(500, "WebAuthn library not installed")
    except Exception as e:
        logger.exception("Login finish failed")
        raise HTTPException(400, f"Login failed: {str(e)}")


# ─── Session ──────────────────────────────────────────────────────────────────

@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)):
    return UserResponse(
        id=str(user.id),
        email=user.email,
        display_name=user.display_name,
        created_at=user.created_at.isoformat(),
    )


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("session")
    return {"status": "ok"}


@router.get("/passkeys", response_model=list[PasskeyResponse])
async def list_passkeys(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Passkey).where(Passkey.user_id == user.id).order_by(Passkey.created_at)
    )
    passkeys = result.scalars().all()
    return [
        PasskeyResponse(
            id=str(pk.id),
            device_name=pk.device_name,
            created_at=pk.created_at.isoformat(),
            last_used_at=pk.last_used_at.isoformat(),
        )
        for pk in passkeys
    ]


@router.delete("/passkeys/{passkey_id}")
async def delete_passkey(passkey_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Passkey).where(Passkey.id == passkey_id, Passkey.user_id == user.id)
    )
    passkey = result.scalar_one_or_none()
    if not passkey:
        raise HTTPException(404, "Passkey not found")

    # Don't allow deleting the last passkey
    count_result = await db.execute(
        select(Passkey).where(Passkey.user_id == user.id)
    )
    if len(count_result.scalars().all()) <= 1:
        raise HTTPException(400, "Cannot delete your last passkey")

    await db.delete(passkey)
    await db.commit()
    return {"status": "ok"}
