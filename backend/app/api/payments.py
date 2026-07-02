"""Payment routes for Flutterwave integration."""
import uuid
import logging
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.config import settings
from app.models.models import User
from app.api.auth import get_current_user
from app.services.flutterwave import (
    CREDIT_PACKAGES,
    create_flutterwave_charge,
    verify_flutterwave_charge,
    grant_credits_from_payment,
    verify_flutterwave_signature,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/payments", tags=["Payments"])


# ─── Schemas ──────────────────────────────────────────────────────────────────

class CreateCheckoutRequest(BaseModel):
    package_key: str  # "starter", "popular", "pro", "enterprise"
    currency: str = "USD"

class CreateCheckoutResponse(BaseModel):
    charge_id: str
    reference: str
    checkout_url: str | None
    amount: float
    currency: str

class PackageInfo(BaseModel):
    key: str
    credits: int
    amount_usd: float
    label: str


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.get("/packages", response_model=list[PackageInfo])
async def list_packages():
    """List available credit packages."""
    return [
        PackageInfo(
            key=key,
            credits=pkg["credits"],
            amount_usd=pkg["amount_usd"],
            label=pkg["label"],
        )
        for key, pkg in CREDIT_PACKAGES.items()
    ]


@router.post("/checkout", response_model=CreateCheckoutResponse)
async def create_checkout(
    body: CreateCheckoutRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a Flutterwave checkout session."""
    try:
        result = await create_flutterwave_charge(
            user=user,
            package_key=body.package_key,
            currency=body.currency,
        )
        return CreateCheckoutResponse(**result)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        logger.exception("Failed to create checkout")
        raise HTTPException(500, "Payment initialization failed")


@router.post("/webhook")
async def flutterwave_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Flutterwave webhook endpoint for payment confirmation."""
    body = await request.body()
    signature = request.headers.get("flutterwave-signature", "")

    # Verify signature
    if not verify_flutterwave_signature(body, signature, settings.FLW_SECRET_HASH):
        logger.warning("Flutterwave webhook signature verification failed")
        raise HTTPException(401, "Invalid signature")

    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(400, "Invalid JSON")

    event_type = payload.get("type")
    if event_type != "charge.completed":
        return {"status": "ignored", "type": event_type}

    charge_data = payload.get("data", {})
    charge_id = charge_data.get("id")
    status = charge_data.get("status")
    meta = charge_data.get("meta", {})

    if status != "succeeded":
        return {"status": "ignored", "status": status}

    # Extract user_id and package from meta
    user_id_str = meta.get("user_id")
    package_key = meta.get("package_key")
    reference = charge_data.get("reference")

    if not user_id_str or not package_key:
        logger.warning("Missing meta data in webhook: user_id=%s, package=%s", user_id_str, package_key)
        return {"status": "ignored", "reason": "missing_meta"}

    try:
        user_id = uuid.UUID(user_id_str)
    except ValueError:
        logger.warning("Invalid user_id in webhook: %s", user_id_str)
        return {"status": "error", "reason": "invalid_user_id"}

    # Grant credits
    try:
        await grant_credits_from_payment(
            db=db,
            user_id=user_id,
            amount=charge_data.get("amount", 0),
            package_key=package_key,
            reference=reference,
            charge_id=charge_id,
        )
        await db.commit()
        logger.info("Successfully granted credits for payment %s", charge_id)
        return {"status": "ok", "credits_granted": CREDIT_PACKAGES[package_key]["credits"]}
    except Exception as e:
        logger.exception("Failed to grant credits for payment %s", charge_id)
        await db.rollback()
        raise HTTPException(500, "Failed to process payment")


@router.get("/verify/{transaction_id}")
async def verify_payment(
    transaction_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Verify a Flutterwave transaction by ID (call this after redirect).
    Grants credits if the payment succeeded and hasn't been processed yet."""
    result = await verify_flutterwave_charge(transaction_id)

    if not result["verified"]:
        raise HTTPException(400, "Payment verification failed")

    if result["status"] == "succeeded":
        # Check if already credited via webhook (desc contains reference like [llmrank_...])
        from app.models.models import CreditTransaction
        tx_ref = result.get("tx_ref", "")
        existing = await db.execute(
            select(CreditTransaction).where(
                CreditTransaction.user_id == user.id,
                CreditTransaction.type == "payment",
                CreditTransaction.description.contains(tx_ref),
            )
        )
        if existing.scalar_one_or_none():
            return {"status": "already_credited", "message": "Credits already granted"}

        # Grant credits (fallback in case webhook hasn't fired yet)
        meta = result.get("meta", {})
        package_key = meta.get("package_key")
        if package_key and package_key in CREDIT_PACKAGES:
            await grant_credits_from_payment(
                db=db,
                user_id=user.id,
                amount=result["amount"],
                package_key=package_key,
                reference=result.get("tx_ref", ""),
                charge_id=str(transaction_id),
            )
            await db.commit()
            return {
                "status": "successful",
                "credits_granted": CREDIT_PACKAGES[package_key]["credits"],
            }

    return result
