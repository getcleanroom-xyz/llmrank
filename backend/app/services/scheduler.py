import logging
from urllib.parse import urlencode, parse_qs, urlparse, urlunparse

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.date import DateTrigger
from sqlalchemy import select

from app.core.config import settings

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler(job_defaults={"misfire_grace_time": 300})


async def send_campaign_job(campaign_id: str, base_url: str):
    """Job wrapper that opens a DB session and dispatches the campaign."""
    from app.core.database import AsyncSessionLocal
    from app.services.campaign_scheduler import dispatch_campaign
    import uuid

    async with AsyncSessionLocal() as db:
        try:
            await dispatch_campaign(db, uuid.UUID(campaign_id), base_url)
        except Exception:
            logger.exception("Campaign dispatch failed for %s", campaign_id)


_initialized = False


async def init_scheduler():
    """Initialize and start the APScheduler."""
    global _initialized
    if _initialized:
        return
    _initialized = True

    from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
    from sqlalchemy import create_engine

    # Convert asyncpg URL to psycopg2-compatible URL
    sync_url = settings.DATABASE_URL
    sync_url = sync_url.replace("+asyncpg", "")
    if sync_url.startswith("postgresql://"):
        sync_url = "postgresql+psycopg2://" + sync_url[len("postgresql://"):]

    parsed = urlparse(sync_url)
    qs = parse_qs(parsed.query, keep_blank_values=True)
    if "ssl" in qs:
        qs["sslmode"] = qs.pop("ssl")
    parsed = parsed._replace(query=urlencode(qs, doseq=True))
    sync_url = urlunparse(parsed)

    sync_engine = create_engine(sync_url, pool_pre_ping=True)
    jobstore = SQLAlchemyJobStore(engine=sync_engine)
    scheduler.add_jobstore(jobstore)

    scheduler.start()
    logger.info("APScheduler started")

    # Register periodic query refresh job (daily at 3 AM)
    scheduler.add_job(
        periodic_query_refresh,
        trigger=CronTrigger(hour=3, minute=0),
        id="query_refresh_daily",
        replace_existing=True,
        misfire_grace_time=3600,
    )
    logger.info("Registered daily query refresh job (3:00 AM)")

    try:
        from app.core.database import AsyncSessionLocal
        from app.models.models import Campaign, CampaignStatus, ScheduleType

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Campaign).where(
                    Campaign.status.in_([CampaignStatus.scheduled, CampaignStatus.sending])
                )
            )
            campaigns = result.scalars().all()
            for campaign in campaigns:
                job_id = f"campaign_{campaign.id}"
                if scheduler.get_job(job_id):
                    continue

                try:
                    if campaign.schedule_type == ScheduleType.now:
                        scheduler.add_job(
                            send_campaign_job,
                            args=[str(campaign.id), settings.CORS_ORIGINS.split(",")[0].strip()],
                            id=job_id,
                            replace_existing=True,
                            misfire_grace_time=300,
                        )
                    elif campaign.schedule_type == ScheduleType.once and campaign.scheduled_at:
                        scheduler.add_job(
                            send_campaign_job,
                            trigger=DateTrigger(run_date=campaign.scheduled_at),
                            args=[str(campaign.id), settings.CORS_ORIGINS.split(",")[0].strip()],
                            id=job_id,
                            replace_existing=True,
                            misfire_grace_time=300,
                        )
                    elif campaign.schedule_type == ScheduleType.recurring and campaign.cron_expr:
                        scheduler.add_job(
                            send_campaign_job,
                            trigger=CronTrigger.from_crontab(campaign.cron_expr),
                            args=[str(campaign.id), settings.CORS_ORIGINS.split(",")[0].strip()],
                            id=job_id,
                            replace_existing=True,
                            misfire_grace_time=300,
                        )
                except Exception:
                    logger.exception("Failed to register job for campaign %s", campaign.id)
    except Exception:
        logger.exception("Failed to recover pending campaigns (table may not exist yet)")


async def shutdown_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("APScheduler shut down")


async def periodic_query_refresh():
    """Daily job: refresh queries for all active brands."""
    from app.core.database import AsyncSessionLocal
    from app.models.models import Brand
    from app.services.agents.registry import agent_registry
    from app.services.agents.context_store import AgentContext, get_brand_context

    logger.info("Starting periodic query refresh")
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Brand))
        brands = result.scalars().all()

        for brand in brands:
            try:
                ctx_data = await get_brand_context(db, brand.id)
                ctx = AgentContext(str(brand.id), ctx_data)
                agent_result = await agent_registry.query_gen.run(
                    ctx, brand_id=brand.id, db=db, mode="refresh",
                )
                if agent_result.success:
                    logger.info("Query refresh OK for %s", brand.name)
                else:
                    logger.warning("Query refresh failed for %s: %s", brand.name, agent_result.error)
            except Exception as e:
                logger.exception("Query refresh error for %s: %s", brand.name, e)

    logger.info("Periodic query refresh complete")
