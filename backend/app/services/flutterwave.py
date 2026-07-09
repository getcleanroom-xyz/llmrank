"""Flutterwave v4 payment service for credit purchases."""
import uuid
import hashlib
import hmac
import base64
import time
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
    return settings.FLW_BASE_URL


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
        return True
    expected = base64.b64encode(
        hmac.new(secret_hash.encode(), payload, hashlib.sha256).digest()
    ).decode()
    return hmac.compare_digest(expected, signature)


async def create_flutterwave_charge(
    user: User,
    package_key: str,
    currency: str = "USD",
) -> dict:
    """Create a Flutterwave v4 charge and return redirect URL."""
    package = CREDIT_PACKAGES.get(package_key)
    if not package:
        raise ValueError(f"Invalid package: {package_key}")

    token = await _get_access_token()
    reference = f"llmrank_{user.id}_{uuid.uuid4().hex[:12]}"
    trace_id = str(uuid.uuid4())
    base = _base_url()

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "X-Trace-Id": trace_id,
    }

    # Step 1: Get or create customer
    customer_id = await _get_or_create_customer(user, headers, base)

    # Step 2: Create charge
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            f"{base}/charges",
            headers=headers,
            json={
                "reference": reference,
                "amount": package["amount_usd"],
                "currency": currency,
                "customer_id": customer_id,
                "redirect_url": f"{settings.RP_ORIGIN}/credits/success",
                "meta": {
                    "user_id": str(user.id),
                    "package_key": package_key,
                    "credits": package["credits"],
                },
            },
        )

        data = response.json()
        if data.get("status") not in ("success", "pending"):
            logger.error("Flutterwave charge failed: %s", data)
            raise ValueError(data.get("message", "Payment initialization failed"))

        charge_data = data.get("data", {})
        charge_id = charge_data.get("id")

        # Get redirect URL from next_action
        redirect_url = None
        next_action = charge_data.get("next_action", {})
        if next_action.get("type") == "redirect_url":
            redirect_url = next_action.get("redirect_url", {}).get("url")

        if not charge_id:
            logger.error("Flutterwave response missing charge id: %s", data)
            raise ValueError("Payment provider returned unexpected response format")

        logger.info("Flutterwave v4 charge created: ref=%s, id=%s, url=%s", reference, charge_id, redirect_url)

        return {
            "charge_id": charge_id,
            "reference": reference,
            "checkout_url": redirect_url,
            "amount": package["amount_usd"],
            "currency": currency,
        }


async def _get_or_create_customer(user: User, headers: dict, base: str) -> str:
    """Create a Flutterwave v4 customer."""
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(
            f"{base}/customers",
            headers=headers,
            json={
                "email": user.email,
                "name": {
                    "first": user.display_name or "User",
                    "last": "",
                },
                "phone": {"country_code": "1", "number": "0000000000"},
            },
        )
        data = response.json()
        if data.get("status") != "success":
            logger.error("Flutterwave customer creation failed: %s", data)
            raise ValueError(data.get("message", "Failed to create customer"))

        return data["data"]["id"]


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
