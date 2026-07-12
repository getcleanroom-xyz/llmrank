"""Flutterwave v4 payment service for credit purchases."""
import uuid
import hashlib
import hmac
import base64
import time
import secrets
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

# ─── Token Cache ──────────────────────────────────────────────────────────────

_token_cache: dict = {"access_token": None, "expires_at": 0}


def _base_url() -> str:
    if settings.FLW_SANDBOX:
        return "https://developersandbox-api.flutterwave.com"
    return "https://f4bexperience.flutterwave.com"


async def _get_access_token() -> str:
    """Get or refresh Flutterwave v4 OAuth2 access token."""
    now = time.time()
    if _token_cache["access_token"] and _token_cache["expires_at"] > now + 60:
        return _token_cache["access_token"]

    if not settings.FLW_CLIENT_ID or not settings.FLW_CLIENT_SECRET:
        raise ValueError("FLW_CLIENT_ID and FLW_CLIENT_SECRET must be set for Flutterwave v4")

    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(
            "https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token",
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            data={
                "client_id": settings.FLW_CLIENT_ID,
                "client_secret": settings.FLW_CLIENT_SECRET,
                "grant_type": "client_credentials",
            },
        )
        data = response.json()
        if response.status_code != 200 or "access_token" not in data:
            logger.error("Flutterwave token failed: %s", data)
            raise ValueError("Failed to authenticate with Flutterwave v4. Check FLW_CLIENT_ID and FLW_CLIENT_SECRET.")

        _token_cache["access_token"] = data["access_token"]
        _token_cache["expires_at"] = now + data.get("expires_in", 600)
        logger.info("Flutterwave v4 token refreshed")
        return _token_cache["access_token"]


def verify_flutterwave_signature(payload: bytes, signature: str, secret_hash: str) -> bool:
    """Verify Flutterwave v4 webhook signature using HMAC-SHA256 (base64)."""
    if not secret_hash:
        return False
    expected = base64.b64encode(
        hmac.new(secret_hash.encode(), payload, hashlib.sha256).digest()
    ).decode()
    return hmac.compare_digest(expected, signature)


async def create_flutterwave_charge(
    user: User,
    package_key: str,
    encrypted_card: dict,
    currency: str = "USD",
) -> dict:
    """Create a Flutterwave v4 charge via orchestrator with encrypted card data."""
    package = CREDIT_PACKAGES.get(package_key)
    if not package:
        raise ValueError(f"Invalid package: {package_key}")

    token = await _get_access_token()
    base = _base_url()

    # v4 requires alphanumeric reference, 6-42 chars
    ref = secrets.token_hex(10)  # 20-char alphanumeric hex

    display = (user.display_name or "User").strip()
    parts = display.split(" ", 1)
    first_name = parts[0] if parts[0] else "User"
    last_name = parts[1] if len(parts) > 1 and len(parts[1]) >= 2 else "Customer"

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "X-Trace-Id": str(uuid.uuid4()),
        "X-Idempotency-Key": ref,
    }

    body = {
        "amount": package["amount_usd"],
        "currency": currency,
        "reference": ref,
        "redirect_url": f"{settings.RP_ORIGIN}/credits/success",
        "customer": {
            "email": user.email,
            "name": {"first": first_name, "last": last_name},
            "phone": {"country_code": "1", "number": "0000000000"},
        },
        "payment_method": {
            "type": "card",
            "card": encrypted_card,
        },
        "meta": {
            "user_id": str(user.id),
            "package_key": package_key,
            "credits": package["credits"],
        },
    }

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            f"{base}/orchestration/direct-charges",
            headers=headers,
            json=body,
        )

        data = response.json()
        if data.get("status") not in ("success", "pending"):
            logger.error("Flutterwave orchestrator charge failed: %s", data)
            raise ValueError(data.get("message", "Payment initialization failed"))

        charge_data = data.get("data", {})
        charge_id = charge_data.get("id")

        redirect_url = None
        next_action = charge_data.get("next_action", {})
        if next_action.get("type") == "redirect_url":
            redirect_url = next_action.get("redirect_url", {}).get("url")

        if not charge_id:
            logger.error("Flutterwave orchestrator response missing charge id: %s", data)
            raise ValueError("Payment provider returned unexpected response format")

        logger.info("Flutterwave v4 orchestrator charge created: ref=%s, id=%s, url=%s", ref, charge_id, redirect_url)

        return {
            "charge_id": charge_id,
            "reference": ref,
            "checkout_url": redirect_url,
            "amount": package["amount_usd"],
            "currency": currency,
        }


async def verify_flutterwave_charge(transaction_id: str) -> dict:
    """Verify a Flutterwave v4 charge by charge ID."""
    token = await _get_access_token()
    base = _base_url()

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(
            f"{base}/charges/{transaction_id}",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
        )

        data = response.json()
        if data.get("status") != "success":
            logger.error("Flutterwave verification failed: %s", data)
            return {"verified": False, "status": "failed"}

        charge = data["data"]

        # v4 returns status as "succeeded" not "successful"
        charge_status = charge.get("status")

        # Extract our custom meta
        meta = charge.get("meta", {})
        if not meta or not meta.get("package_key"):
            # meta might be empty in v4 webhook docs example but should be present
            # as a fallback, try to determine package from amount
            logger.warning("Meta missing or empty in charge response: %s", meta)

        return {
            "verified": True,
            "status": charge_status,
            "amount": charge.get("amount"),
            "currency": charge.get("currency"),
            "tx_ref": charge.get("reference"),
            "charge_id": charge.get("id"),
            "meta": meta,
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
        description=f"Payment: ${amount} ({package['label']}) => {credits_to_grant} credits [txn:{charge_id}]",
        tx_type="payment",
        user_id=user_id,
    )

    logger.info(
        "Granted %d credits to user %s from Flutterwave v4 payment %s",
        credits_to_grant, user_id, charge_id,
    )
    return wallet
