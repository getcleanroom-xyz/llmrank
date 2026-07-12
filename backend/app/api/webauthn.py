import uuid
import time
import logging

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.config import settings
from app.models.models import User, Passkey, CreditWallet, CreditTransaction
from app.api.auth import _utcnow, _create_session_token, _sign_data, _verify_signed_data, _pending_registrations, _pending_reg_timestamps, _cleanup_pending_registrations, get_current_user
from app.api.webauthn_types import (
    RegisterStartRequest, RegisterStartResponse, RegisterFinishRequest,
    LoginStartRequest, LoginStartResponse, LoginFinishRequest,
    EmailRegisterRequest, EmailLoginRequest,
    UserResponse, PasskeyResponse, b64url_encode, b64url_decode,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Auth"])


# ─── Registration ─────────────────────────────────────────────────────────────

REGISTRATION_TTL = 300  # 5 minutes


@router.post("/register/start", response_model=RegisterStartResponse)
async def register_start(body: RegisterStartRequest, request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(409, "Email already registered")

    temp_id = str(uuid.uuid4())
    _cleanup_pending_registrations()
    _pending_registrations[temp_id] = {"email": body.email, "display_name": body.display_name}
    _pending_reg_timestamps[temp_id] = time.time()

    try:
        import webauthn
        from webauthn.helpers import bytes_to_base64url

        options = webauthn.generate_registration_options(
            rp_id=settings.RP_ID,
            rp_name="LLMRank",
            user_id=temp_id.encode(),
            user_name=body.email,
            user_display_name=body.display_name,
        )

        challenge_b64 = bytes_to_base64url(options.challenge)
        response.set_cookie(
            key="challenge",
            value=_sign_data(challenge_b64),
            httponly=True,
            secure=settings.RP_ORIGIN.startswith("https"),
            samesite="none" if settings.RP_ORIGIN.startswith("https") else "lax",
            max_age=300,
        )
        response.set_cookie(
            key="pending_reg",
            value=_sign_data(temp_id),
            httponly=True,
            secure=settings.RP_ORIGIN.startswith("https"),
            samesite="none" if settings.RP_ORIGIN.startswith("https") else "lax",
            max_age=300,
        )

        return RegisterStartResponse(challenge=challenge_b64, rp_id=settings.RP_ID, user_id=temp_id)

    except ImportError:
        _pending_registrations.pop(temp_id, None)
        raise HTTPException(500, "WebAuthn library not installed. Run: pip install webauthn")
    except Exception as e:
        _pending_registrations.pop(temp_id, None)
        logger.exception("Registration start failed")
        raise HTTPException(500, "Registration failed")


@router.post("/register/finish")
async def register_finish(body: RegisterFinishRequest, request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    try:
        from webauthn import verify_registration_response, base64url_to_bytes

        signed_challenge = request.cookies.get("challenge")
        if not signed_challenge:
            raise HTTPException(400, "Missing challenge cookie — restart registration")
        challenge_b64 = _verify_signed_data(signed_challenge)
        if not challenge_b64:
            raise HTTPException(400, "Invalid challenge — restart registration")

        signed_temp_id = request.cookies.get("pending_reg")
        if not signed_temp_id:
            raise HTTPException(400, "Missing registration data — restart registration")
        temp_id = _verify_signed_data(signed_temp_id)
        if not temp_id:
            raise HTTPException(400, "Invalid registration data — restart registration")

        pending = _pending_registrations.pop(temp_id, None)
        if not pending:
            raise HTTPException(400, "Registration expired — restart registration")

        from webauthn.helpers import bytes_to_base64url

        verification = verify_registration_response(
            credential=body.credential,
            expected_challenge=base64url_to_bytes(challenge_b64),
            expected_origin=settings.RP_ORIGIN,
            expected_rp_id=settings.RP_ID,
        )

        # Now create the user — only after passkey verification succeeds
        user = User(id=uuid.uuid4(), email=pending["email"], display_name=pending["display_name"])
        db.add(user)
        await db.flush()

        passkey = Passkey(
            id=uuid.uuid4(),
            user_id=user.id,
            credential_id=b64url_encode(verification.credential_id),
            credential_public_key=bytes_to_base64url(verification.credential_public_key),
            sign_count=verification.sign_count,
            device_name=body.device_name or "Unknown device",
        )
        db.add(passkey)

        wallet = CreditWallet(id=uuid.uuid4(), user_id=user.id, balance=settings.NEW_USER_CREDITS, total_purchased=0, total_used=0)
        db.add(wallet)
        db.add(CreditTransaction(id=uuid.uuid4(), user_id=user.id, amount=settings.NEW_USER_CREDITS,
                                 type="signup_bonus",
                                 description=f"Welcome — {settings.NEW_USER_CREDITS} free credits",
                                 balance_after=settings.NEW_USER_CREDITS))
        await db.commit()

        response.delete_cookie("challenge")
        response.delete_cookie("pending_reg")
        token = _create_session_token(str(user.id))
        response.set_cookie(
            key="session",
            value=token,
            httponly=True,
            secure=settings.RP_ORIGIN.startswith("https"),
            samesite="none" if settings.RP_ORIGIN.startswith("https") else "lax",
            max_age=settings.SESSION_EXPIRE_HOURS * 3600,
        )

        return {"status": "ok", "user": UserResponse(
            id=str(user.id),
            email=user.email,
            display_name=user.display_name,
            created_at=user.created_at.isoformat(),
            is_admin=user.email in settings.admin_emails_list,
        )}

    except ImportError:
        raise HTTPException(500, "WebAuthn library not installed")
    except Exception as e:
        logger.exception("Registration finish failed")
        raise HTTPException(400, "Registration failed")


# ─── Login ────────────────────────────────────────────────────────────────────

@router.post("/login/start", response_model=LoginStartResponse)
async def login_start(body: LoginStartRequest, request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "No account found with this email")

    passkeys_result = await db.execute(select(Passkey).where(Passkey.user_id == user.id))
    passkeys = passkeys_result.scalars().all()
    if not passkeys:
        raise HTTPException(400, "No passkeys registered. Please register first.")

    try:
        import webauthn
        from webauthn.helpers import bytes_to_base64url

        allow_credentials_bytes = []
        for pk in passkeys:
            allow_credentials_bytes.append(b64url_decode(pk.credential_id))

        options = webauthn.generate_authentication_options(
            rp_id=settings.RP_ID,
            allow_credentials=allow_credentials_bytes,
        )

        challenge_b64 = bytes_to_base64url(options.challenge)
        response.set_cookie(
            key="challenge",
            value=_sign_data(challenge_b64),
            httponly=True,
            secure=settings.RP_ORIGIN.startswith("https"),
            samesite="none" if settings.RP_ORIGIN.startswith("https") else "lax",
            max_age=300,
        )

        allow_credentials_b64 = [pk.credential_id for pk in passkeys]
        return LoginStartResponse(challenge=challenge_b64, rp_id=settings.RP_ID, allow_credentials=allow_credentials_b64)

    except ImportError:
        raise HTTPException(500, "WebAuthn library not installed")
    except Exception as e:
        logger.exception("Login start failed")
        raise HTTPException(500, "Login failed")


@router.post("/login/finish")
async def login_finish(body: LoginFinishRequest, request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    try:
        from webauthn import verify_authentication_response, base64url_to_bytes

        signed_challenge = request.cookies.get("challenge")
        if not signed_challenge:
            raise HTTPException(400, "Missing challenge cookie — restart login")
        challenge_b64 = _verify_signed_data(signed_challenge)
        if not challenge_b64:
            raise HTTPException(400, "Invalid challenge — restart login")

        credential_id = body.credential.get("id") if isinstance(body.credential, dict) else ""
        result = await db.execute(select(Passkey).where(Passkey.credential_id == credential_id))
        pk = result.scalar_one_or_none()
        if not pk:
            raise HTTPException(404, "Passkey not found")

        verification = verify_authentication_response(
            credential=body.credential,
            expected_challenge=base64url_to_bytes(challenge_b64),
            expected_rp_id=settings.RP_ID,
            expected_origin=settings.RP_ORIGIN,
            credential_public_key=base64url_to_bytes(pk.credential_public_key),
            credential_current_sign_count=pk.sign_count,
            require_user_verification=False,
        )

        user_result = await db.execute(select(User).where(User.id == pk.user_id))
        user = user_result.scalar_one_or_none()
        if not user:
            raise HTTPException(404, "User not found")

        pk.last_used_at = _utcnow()
        pk.sign_count = verification.new_sign_count
        await db.commit()

        response.delete_cookie("challenge")
        token = _create_session_token(str(user.id))
        response.set_cookie(
            key="session",
            value=token,
            httponly=True,
            secure=settings.RP_ORIGIN.startswith("https"),
            samesite="none" if settings.RP_ORIGIN.startswith("https") else "lax",
            max_age=settings.SESSION_EXPIRE_HOURS * 3600,
        )

        return {"status": "ok", "user": UserResponse(
            id=str(user.id),
            email=user.email,
            display_name=user.display_name,
            created_at=user.created_at.isoformat(),
            is_admin=user.email in settings.admin_emails_list,
        )}

    except ImportError:
        raise HTTPException(500, "WebAuthn library not installed")
    except Exception as e:
        logger.exception("Login finish failed")
        raise HTTPException(400, "Login failed")


# ─── Email + Password Auth (fallback) ──────────────────────────────────────────

@router.post("/register/email")
async def register_email(body: EmailRegisterRequest, response: Response, db: AsyncSession = Depends(get_db)):
    from app.services.password import hash_password

    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(409, "Email already registered")

    user = User(
        id=uuid.uuid4(),
        email=body.email,
        display_name=body.display_name,
        hashed_password=hash_password(body.password),
    )
    db.add(user)
    await db.flush()

    wallet = CreditWallet(id=uuid.uuid4(), user_id=user.id, balance=settings.NEW_USER_CREDITS, total_purchased=0, total_used=0)
    db.add(wallet)
    db.add(CreditTransaction(id=uuid.uuid4(), user_id=user.id, amount=settings.NEW_USER_CREDITS,
                             type="signup_bonus",
                             description=f"Welcome — {settings.NEW_USER_CREDITS} free credits",
                             balance_after=settings.NEW_USER_CREDITS))
    await db.commit()

    token = _create_session_token(str(user.id))
    response.set_cookie(
        key="session",
        value=token,
        httponly=True,
        secure=settings.RP_ORIGIN.startswith("https"),
        samesite="none" if settings.RP_ORIGIN.startswith("https") else "lax",
        max_age=settings.SESSION_EXPIRE_HOURS * 3600,
    )

    return {"status": "ok", "user": UserResponse(
        id=str(user.id),
        email=user.email,
        display_name=user.display_name,
        created_at=user.created_at.isoformat(),
        is_admin=user.email in settings.admin_emails_list,
    )}


@router.post("/login/email")
async def login_email(body: EmailLoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    from app.services.password import verify_password

    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user or not user.hashed_password:
        raise HTTPException(401, "Invalid email or password")

    if not verify_password(body.password, user.hashed_password):
        raise HTTPException(401, "Invalid email or password")

    token = _create_session_token(str(user.id))
    response.set_cookie(
        key="session",
        value=token,
        httponly=True,
        secure=settings.RP_ORIGIN.startswith("https"),
        samesite="none" if settings.RP_ORIGIN.startswith("https") else "lax",
        max_age=settings.SESSION_EXPIRE_HOURS * 3600,
    )

    return {"status": "ok", "user": UserResponse(
        id=str(user.id),
        email=user.email,
        display_name=user.display_name,
        created_at=user.created_at.isoformat(),
        is_admin=user.email in settings.admin_emails_list,
    )}


# ─── Session ──────────────────────────────────────────────────────────────────

@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)):
    return UserResponse(
        id=str(user.id),
        email=user.email,
        display_name=user.display_name,
        created_at=user.created_at.isoformat(),
        is_admin=user.email in settings.admin_emails_list,
    )


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(
        key="session",
        path="/",
        httponly=True,
        secure=settings.RP_ORIGIN.startswith("https"),
        samesite="none" if settings.RP_ORIGIN.startswith("https") else "lax",
    )
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
