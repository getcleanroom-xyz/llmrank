"""Flutterwave payment service for credit purchases."""
import uuid
import hashlib
import hmac
import logging
from datetime import datetime, timezone

import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.models.models import User, CreditWallet, CreditTransaction

logger = logging.getLogger(__name__)

# ─── Credit Packages ──────────────────────────────────────────────────────────

CREDIT_PACKAGES = {
    "starter": {"credits": 1000, "amount_usd": 5.00, "label": "Starter"},
    "popular": {"credits": 5000, "amount_usd": 20.00, "label": "Popular"},
    "pro": {"credits": 15000, "amount_usd": 50.00, "label": "Pro"},
    "enterprise": {"credits": 50000, "amount_usd": 150.00, "label": "Enterprise"},
}


def verify_flutterwave_signature(payload: bytes, signature: str, secret_hash: str) -> bool:
    """Verify Flutterwave webhook signature using HMAC-SHA256."""
    if not secret_hash:
        return True  # Skip verification if no secret configured
    expected = hmac.new(secret_hash.encode(), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


async def create_flutterwave_charge(
    user: User,
    package_key: str,
    currency: str = "USD",
) -> dict:
    """Create a Flutterwave charge and return checkout URL."""
    package = CREDIT_PACKAGES.get(package_key)
    if not package:
        raise ValueError(f"Invalid package: {package_key}")

    reference = f"llmrank_{user.id}_{uuid.uuid4().hex[:12]}"

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            f"{settings.FLW_BASE_URL}/orchestration/direct-charges",
            headers={
                "Authorization": f"Bearer {settings.FLW_SECRET_KEY}",
                "Content-Type": "application/json",
                "X-Trace-Id": str(uuid.uuid4()),
            },
            json={
                "amount": package["amount_usd"],
                "currency": currency,
                "reference": reference,
                "redirect_url": f"{settings.RP_ORIGIN}/credits/success",
                "meta": {
                    "user_id": str(user.id),
                    "package_key": package_key,
                    "credits": package["credits"],
                },
                "customer": {
                    "email": user.email,
                    "name": user.display_name,
                },
            },
        )

        data = response.json()
        if data.get("status") != "success":
            logger.error("Flutterwave charge failed: %s", data)
            raise ValueError(data.get("message", "Payment initialization failed"))

        return {
            "charge_id": data["data"]["id"],
            "reference": reference,
            "checkout_url": data["data"].get("next_action", {}).get("redirect_url", {}).get("url"),
            "amount": package["amount_usd"],
            "currency": currency,
        }


async def verify_flutterwave_charge(charge_id: str) -> dict:
    """Verify a Flutterwave charge status."""
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(
            f"{settings.FLW_BASE_URL}/charges/{charge_id}",
            headers={
                "Authorization": f"Bearer {settings.FLW_SECRET_KEY}",
                "Content-Type": "application/json",
            },
        )

        data = response.json()
        if data.get("status") != "success":
            logger.error("Flutterwave verification failed: %s", data)
            return {"verified": False, "status": "failed"}

        charge = data["data"]
        return {
            "verified": True,
            "status": charge["status"],
            "amount": charge["amount"],
            "currency": charge["currency"],
            "reference": charge.get("reference"),
            "charge_id": charge["id"],
        }


async def grant_credits_from_payment(
    db: AsyncSession,
    user_id: uuid.UUID,
    amount: float,
    package_key: str,
    reference: str,
    charge_id: str,
) -> CreditWallet:
    """Grant credits after successful payment."""
    from app.services.credit_service import grant_credits, CREDITS_PER_DOLLAR

    package = CREDIT_PACKAGES.get(package_key)
    if not package:
        raise ValueError(f"Invalid package: {package_key}")

    credits_to_grant = package["credits"]

    wallet = await grant_credits(
        db,
        amount=credits_to_grant,
        description=f"Payment: ${amount} ({package['label']}) → {credits_to_grant} credits",
        tx_type="payment",
        user_id=user_id,
    )

    logger.info(
        "Granted %d credits to user %s from Flutterwave payment %s",
        credits_to_grant, user_id, charge_id,
    )
    return wallet
