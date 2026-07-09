"""Credit system — tracks and deducts credits for paid model usage.

Pricing:
  1 credit = $0.001 (1/10th of a cent)
  1000 credits = $1.00

Free models (GPT-4o-mini, Llama 3.3, DeepSeek) cost 0 credits.
Paid models cost credits based on OpenRouter pricing.
"""
import uuid
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.models import CreditWallet, CreditTransaction
from app.services.llm_adapters import MODEL_REGISTRY

logger = logging.getLogger(__name__)

# ─── Pricing Constants ────────────────────────────────────────────────────────

CREDITS_PER_DOLLAR = 1000  # 1 credit = $0.001
FREE_CREDITS = 500         # New users get 500 free credits

# Credits cost per query — derived from actual OpenRouter pricing
# 1 credit = $0.001, so $0.01/request = 10 credits
CREDIT_COSTS: dict[str, int] = {
    "chatgpt": 10,       # $0.01/request
    "gpt4o": 30,         # $0.03/request
    "gemini": 20,        # $0.02/request
    "llama": 10,         # $0.01/request
    "llama-small": 5,    # $0.005/request
    "claude": 10,        # $0.01/request
    "deepseek": 10,      # $0.01/request
    "deepseek-r1": 10,   # $0.01/request
    "mistral": 20,       # $0.02/request
    "qwen": 10,          # $0.01/request
}

FREE_MODELS = {k for k, v in MODEL_REGISTRY.items() if v.get("free")}

def calculate_scan_cost(llm_names: list[str], num_queries: int) -> int:
    """Calculate total credits needed for a scan."""
    total = 0
    for llm in llm_names:
        cost_per_query = CREDIT_COSTS.get(llm, 0)
        total += cost_per_query * num_queries
    return total


async def get_or_create_wallet(db: AsyncSession, user_id: uuid.UUID) -> CreditWallet:
    """Get or create a credit wallet for a user."""
    result = await db.execute(select(CreditWallet).where(CreditWallet.user_id == user_id))
    wallet = result.scalar_one_or_none()
    if not wallet:
        wallet = CreditWallet(
            id=uuid.uuid4(),
            user_id=user_id,
            balance=FREE_CREDITS,
            total_purchased=0,
            total_used=0,
        )
        db.add(wallet)
        await db.flush()
        tx = CreditTransaction(
            id=uuid.uuid4(),
            user_id=user_id,
            amount=FREE_CREDITS,
            type="signup_bonus",
            description=f"Welcome — {FREE_CREDITS} free credits",
            balance_after=FREE_CREDITS,
        )
        db.add(tx)
        await db.flush()
        logger.info("Created wallet for %s with %d signup bonus", user_id, FREE_CREDITS)
    return wallet


async def check_credits(db: AsyncSession, llm_names: list[str], num_queries: int, user_id: uuid.UUID) -> tuple[bool, int, int]:
    """Check if user has enough credits. Returns (has_enough, cost, balance)."""
    wallet = await get_or_create_wallet(db, user_id)
    cost = calculate_scan_cost(llm_names, num_queries)
    return wallet.balance >= cost, cost, wallet.balance


async def deduct_credits(db: AsyncSession, amount: int, description: str, user_id: uuid.UUID) -> CreditWallet:
    """Deduct credits from wallet. Returns updated wallet."""
    wallet = await get_or_create_wallet(db, user_id)
    wallet.balance -= amount
    wallet.total_used += amount

    tx = CreditTransaction(
        id=uuid.uuid4(),
        user_id=user_id,
        amount=-amount,
        type="scan_usage",
        description=description,
        balance_after=wallet.balance,
    )
    db.add(tx)
    await db.flush()

    logger.info("Deducted %d credits from %s (balance: %d)", amount, user_id, wallet.balance)
    return wallet


async def grant_credits(db: AsyncSession, amount: int, description: str, tx_type: str, user_id: uuid.UUID) -> CreditWallet:
    """Add credits to wallet. Returns updated wallet."""
    wallet = await get_or_create_wallet(db, user_id)
    wallet.balance += amount
    wallet.total_purchased += amount

    tx = CreditTransaction(
        id=uuid.uuid4(),
        user_id=user_id,
        amount=amount,
        type=tx_type,
        description=description,
        balance_after=wallet.balance,
    )
    db.add(tx)
    await db.flush()

    logger.info("Granted %d credits to %s (balance: %d) [%s]", amount, user_id, wallet.balance, tx_type)
    return wallet


async def get_credit_history(db: AsyncSession, user_id: uuid.UUID, limit: int = 50, offset: int = 0) -> list[CreditTransaction]:
    """Get recent credit transactions."""
    result = await db.execute(
        select(CreditTransaction)
        .where(CreditTransaction.user_id == user_id)
        .order_by(CreditTransaction.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return result.scalars().all()
