from contextlib import asynccontextmanager
from datetime import datetime, timezone
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
import asyncio
import logging

from app.core.config import settings
from app.core.rate_limit import limiter
from app.api.routes import router, _run_scan_background  # noqa: F401
from app.api.webauthn import router as auth_router
from app.api.payments import router as payments_router
from app.api.admin import router as admin_router
from app.api.campaigns import router as campaigns_router
from app.api.campaign_audience import router as audience_router
from app.api.tracking import router as tracking_router
from app.api.recommendations import router as recommendations_router
from app.api.conversations import router as conversations_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
# Suppress noisy third-party loggers
for noisy in ("primp", "httpx", "httpcore", "urllib3", "ddgs"):
    logging.getLogger(noisy).setLevel(logging.WARNING)
logger = logging.getLogger(__name__)


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
                    scan.completed_at = datetime.now(timezone.utc).replace(tzinfo=None)
                    await db.commit()
                    logger.warning("Marked stuck running scan %s as failed", scan.id)
                    continue

                # Re-queue pending scans — use the scan's original LLM selection if stored
                # Default to free models for recovery
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

    # Start campaign scheduler
    from app.services.scheduler import init_scheduler, shutdown_scheduler
    await init_scheduler()

    # Start chat persistence subscriber
    from app.services.chat_persistence import init_chat_persistence
    init_chat_persistence()

    logger.info("LLMRanked API started (CORS: %s)", settings.cors_origins_list)
    yield

    await shutdown_scheduler()
    logger.info("LLMRanked API shutting down")


app = FastAPI(
    title="LLMRanked API",
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
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/v1")
app.include_router(payments_router, prefix="/api/v1")
app.include_router(router, prefix="/api/v1")
app.include_router(admin_router, prefix="/api/v1")
app.include_router(campaigns_router, prefix="/api/v1")
app.include_router(audience_router, prefix="/api/v1")
app.include_router(tracking_router, prefix="/api/v1")
app.include_router(recommendations_router, prefix="/api/v1")
app.include_router(conversations_router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "llmranked-api"}
