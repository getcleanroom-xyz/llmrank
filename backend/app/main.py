from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
import asyncio
import logging

from app.core.config import settings
from app.core.rate_limit import limiter
from app.api.routes import router
from app.api.auth import router as auth_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


async def ensure_default_wallet():
    """Ensure default wallet exists with 500 credits on every startup."""
    from app.core.database import AsyncSessionLocal
    from app.models.models import CreditWallet, CreditTransaction, User
    from app.services.credit_service import DEFAULT_USER_ID
    from sqlalchemy import select
    import uuid

    await asyncio.sleep(1)
    try:
        async with AsyncSessionLocal() as db:
            # Ensure default user exists
            user_result = await db.execute(select(User).where(User.id == DEFAULT_USER_ID))
            user = user_result.scalar_one_or_none()
            if not user:
                user = User(
                    id=DEFAULT_USER_ID,
                    email="default@llmrank.local",
                    display_name="Default User",
                )
                db.add(user)
                await db.flush()

            # Ensure default wallet exists
            result = await db.execute(select(CreditWallet).where(CreditWallet.user_id == DEFAULT_USER_ID))
            wallet = result.scalar_one_or_none()
            if not wallet:
                wallet = CreditWallet(
                    id=uuid.uuid4(), user_id=DEFAULT_USER_ID,
                    balance=500, total_purchased=0, total_used=0,
                )
                db.add(wallet)
                db.add(CreditTransaction(
                    id=uuid.uuid4(), user_id=DEFAULT_USER_ID,
                    amount=500, type="signup_bonus",
                    description="Welcome — 500 free credits",
                    balance_after=500,
                ))
                await db.commit()
                logger.info("Created default wallet with 500 credits")
            elif wallet.balance < 500:
                old = wallet.balance
                wallet.balance = 500
                db.add(CreditTransaction(
                    id=uuid.uuid4(), user_id=DEFAULT_USER_ID,
                    amount=500 - old, type="admin_grant",
                    description="Startup seed — wallet topped up to 500",
                    balance_after=500,
                ))
                await db.commit()
                logger.info("Topped up wallet from %d to 500 credits", old)
    except Exception as e:
        logger.warning("Could not ensure wallet: %s", e)


async def recover_pending_scans():
    """On startup, find scans stuck in pending/running (from a crash/restart)
    and re-queue them as background tasks."""
    from app.core.database import AsyncSessionLocal
    from app.models.models import Scan, ScanStatus
    from app.api.routes import _run_scan_background
    from sqlalchemy import select

    await asyncio.sleep(2)  # Wait for DB to be ready

    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Scan).where(
                    Scan.status.in_([ScanStatus.pending, ScanStatus.running])
                )
            )
            stuck_scans = result.scalars().all()

            if not stuck_scans:
                return

            logger.info("Recovering %d orphaned scan(s) from previous session", len(stuck_scans))

            for scan in stuck_scans:
                # Reset pending scans to re-run, mark running as failed (unclear state)
                if scan.status == ScanStatus.running:
                    scan.status = ScanStatus.failed
                    await db.commit()
                    logger.warning("Marked stuck running scan %s as failed", scan.id)
                    continue

                # Re-queue pending scans
                # We need to determine which LLMs were selected — default to free models
                from app.core.database import AsyncSessionLocal as SessionLocal
                asyncio.create_task(
                    _run_scan_background(scan.brand_id, scan.id, ["chatgpt", "llama"])
                )
                logger.info("Re-queued pending scan %s for brand %s", scan.id, scan.brand_id)

    except Exception as e:
        logger.exception("Failed to recover orphaned scans: %s", e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup validation
    if not settings.OPENROUTER_API_KEY:
        logger.warning("STARTUP: OPENROUTER_API_KEY not configured — scans will fail")
    else:
        logger.info("OpenRouter API key configured")

    if settings.SECRET_KEY == "dev-secret-change-in-production":
        logger.warning("STARTUP: SECRET_KEY is default — change it for production")

    # Recover orphaned scans from previous session
    asyncio.create_task(recover_pending_scans())

    # Ensure default wallet exists with 500 credits
    asyncio.create_task(ensure_default_wallet())

    logger.info("LLMRank API started (CORS: %s)", settings.cors_origins_list)
    yield
    logger.info("LLMRank API shutting down")


app = FastAPI(
    title="LLMRank API",
    description="AI SEO visibility tracking — see how LLMs rank your brand",
    version="1.0.0",
    lifespan=lifespan,
    tags=[
        {"name": "Brands", "description": "Create, list, and manage brands"},
        {"name": "Queries", "description": "Manage monitored queries and get AI suggestions"},
        {"name": "Scans", "description": "Trigger and monitor LLM scans"},
        {"name": "Dashboard", "description": "Dashboard data and query drilldowns"},
        {"name": "Credits", "description": "Credit balance and transaction history"},
        {"name": "Webhooks", "description": "External webhook endpoints"},
    ],
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/v1")
app.include_router(router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "llmrank-api"}
