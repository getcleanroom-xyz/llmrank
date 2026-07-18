from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.models import User
from app.schemas.schemas import CreditBalanceOut, CreditGrantRequest, CreditTransactionOut
from app.services.credit_service import get_or_create_wallet, grant_credits, get_credit_history, CREDIT_COSTS
from app.api.auth import get_current_user
from app.api.admin import require_admin

router = APIRouter()


# ─── Credits ──────────────────────────────────────────────────────────────────

@router.get("/credits", response_model=CreditBalanceOut, tags=["Credits"])
async def get_credits(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    wallet = await get_or_create_wallet(db, user.id)
    return CreditBalanceOut(
        balance=wallet.balance,
        total_purchased=wallet.total_purchased,
        total_used=wallet.total_used,
        cost_per_scan=CREDIT_COSTS,
    )


@router.post("/credits/grant", response_model=CreditBalanceOut, tags=["Credits"])
async def admin_grant_credits(body: CreditGrantRequest, db: AsyncSession = Depends(get_db), user: User = Depends(require_admin)):
    target_id = body.target_user_id or user.id
    wallet = await grant_credits(db, body.amount, body.description, "admin_grant", target_id)
    await db.commit()
    return CreditBalanceOut(
        balance=wallet.balance,
        total_purchased=wallet.total_purchased,
        total_used=wallet.total_used,
        cost_per_scan=CREDIT_COSTS,
    )


@router.get("/credits/history", response_model=list[CreditTransactionOut], tags=["Credits"])
async def credit_history(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    page: int = 1,
    per_page: int = 50,
):
    return await get_credit_history(db, user.id, limit=per_page, offset=(page - 1) * per_page)
