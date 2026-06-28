import uuid
import logging
from datetime import datetime, timezone
from typing import AsyncGenerator
import asyncio
import json

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func

from app.core.database import get_db
from app.core.config import settings
from app.core.rate_limit import limiter
from app.models.models import User, Brand, MonitoredQuery, Scan, QueryResult, ScanStatus
from app.schemas.schemas import (
    BrandCreate, BrandOut,
    QueryCreate, QueryOut, QuerySuggestRequest, QuerySuggestResponse,
    ScanCreate, ScanOut,
    QueryResultOut, DashboardOut, QueryDrilldownOut,
    LLMBreakdown, CompetitorShareItem, QuerySummary, DrilldownInsight,
    CreditBalanceOut, CreditGrantRequest, CreditTransactionOut,
)
from app.services.scan_orchestrator import run_scan, generate_query_suggestions
from app.services.insight_engine import generate_insights_for_query, generate_dashboard_insights
from app.services.credit_service import get_or_create_wallet, check_credits, deduct_credits, grant_credits, get_credit_history, calculate_scan_cost, CREDIT_COSTS, CREDITS_PER_DOLLAR, verify_bmc_signature
from app.api.auth import get_current_user, get_optional_user

router = APIRouter()
logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    """Return naive UTC datetime compatible with TIMESTAMP WITHOUT TIME ZONE columns."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


# ─── Brands ────────────────────────────────────────────────────────────────────

@router.post("/brands", response_model=BrandOut, status_code=201, tags=["Brands"])
@limiter.limit(f"{settings.RATE_LIMIT_PER_MINUTE}/minute")
async def create_brand(request: Request, body: BrandCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    brand = Brand(id=uuid.uuid4(), name=body.name, domain=body.domain, owner_id=user.id)
    db.add(brand)
    await db.commit()
    await db.refresh(brand)
    return brand


@router.get("/brands", response_model=list[BrandOut], tags=["Brands"])
async def list_brands(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(
        select(Brand).where(Brand.owner_id == user.id).order_by(desc(Brand.created_at))
    )
    return result.scalars().all()


@router.get("/brands/{brand_id}", response_model=BrandOut, tags=["Brands"])
async def get_brand(brand_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Brand).where(Brand.id == brand_id))
    brand = result.scalar_one_or_none()
    if not brand:
        raise HTTPException(404, "Brand not found")
    return brand


@router.delete("/brands/{brand_id}", status_code=204, tags=["Brands"])
@limiter.limit(f"{settings.RATE_LIMIT_PER_MINUTE}/minute")
async def delete_brand(request: Request, brand_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Brand).where(Brand.id == brand_id))
    brand = result.scalar_one_or_none()
    if not brand:
        raise HTTPException(404, "Brand not found")
    await db.delete(brand)
    await db.commit()


# ─── Queries ───────────────────────────────────────────────────────────────────

@router.get("/brands/{brand_id}/queries", response_model=list[QueryOut], tags=["Queries"])
async def list_queries(brand_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(MonitoredQuery)
        .where(MonitoredQuery.brand_id == brand_id)
        .order_by(MonitoredQuery.created_at)
    )
    return result.scalars().all()


@router.post("/brands/{brand_id}/queries", response_model=QueryOut, status_code=201, tags=["Queries"])
@limiter.limit(f"{settings.RATE_LIMIT_PER_MINUTE}/minute")
async def add_query(request: Request, brand_id: uuid.UUID, body: QueryCreate, db: AsyncSession = Depends(get_db)):
    brand_result = await db.execute(select(Brand).where(Brand.id == brand_id))
    if not brand_result.scalar_one_or_none():
        raise HTTPException(404, "Brand not found")

    query = MonitoredQuery(
        id=uuid.uuid4(),
        brand_id=brand_id,
        query_text=body.query_text,
    )
    db.add(query)
    await db.commit()
    await db.refresh(query)
    return query


@router.delete("/brands/{brand_id}/queries/{query_id}", status_code=204, tags=["Queries"])
@limiter.limit(f"{settings.RATE_LIMIT_PER_MINUTE}/minute")
async def delete_query(request: Request, brand_id: uuid.UUID, query_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(MonitoredQuery)
        .where(MonitoredQuery.id == query_id, MonitoredQuery.brand_id == brand_id)
    )
    query = result.scalar_one_or_none()
    if not query:
        raise HTTPException(404, "Query not found")
    await db.delete(query)
    await db.commit()


@router.post("/brands/{brand_id}/queries/suggest", response_model=QuerySuggestResponse, tags=["Queries"])
@limiter.limit("5/minute")
async def suggest_queries(request: Request, brand_id: uuid.UUID, body: QuerySuggestRequest, db: AsyncSession = Depends(get_db)):
    # Verify brand exists and use its actual data
    brand_result = await db.execute(select(Brand).where(Brand.id == brand_id))
    brand = brand_result.scalar_one_or_none()
    if not brand:
        raise HTTPException(404, "Brand not found")
    suggestions = await generate_query_suggestions(brand.name, brand.domain, body.keywords)
    return QuerySuggestResponse(suggested_queries=suggestions)


# ─── Scans ─────────────────────────────────────────────────────────────────────

@router.post("/brands/{brand_id}/scans", response_model=ScanOut, status_code=202, tags=["Scans"])
@limiter.limit("5/minute")
async def trigger_scan(
    request: Request,
    brand_id: uuid.UUID,
    body: ScanCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    brand_result = await db.execute(select(Brand).where(Brand.id == brand_id))
    brand = brand_result.scalar_one_or_none()
    if not brand:
        raise HTTPException(404, "Brand not found")

    # Check for active queries
    queries_result = await db.execute(
        select(MonitoredQuery)
        .where(MonitoredQuery.brand_id == brand_id, MonitoredQuery.is_active == True)
    )
    active_queries = queries_result.scalars().all()

    # Auto-generate queries if none exist — seamless first-run experience
    if not active_queries:
        logger.info("No queries for brand %s, auto-generating via AI", brand_id)
        suggestions = await generate_query_suggestions(brand.name, brand.domain, [])

        # If AI generation failed, create basic fallback queries from domain/brand name
        if not suggestions:
            logger.info("AI generation failed, using fallback queries for %s", brand.name)
            domain_root = brand.domain.split(".")[0].replace("-", " ").replace("_", " ")
            suggestions = [
                f"best {domain_root} alternatives",
                f"{domain_root} vs competitors",
                f"how to use {domain_root}",
                f"{domain_root} pricing and plans",
                f"{domain_root} review {brand.name}",
            ]

        for text in suggestions[:8]:
            db.add(MonitoredQuery(
                id=uuid.uuid4(),
                brand_id=brand_id,
                query_text=text,
            ))
        await db.flush()
        # Re-fetch after flush so the orchestrator sees them
        queries_result = await db.execute(
            select(MonitoredQuery)
            .where(MonitoredQuery.brand_id == brand_id, MonitoredQuery.is_active == True)
        )
        active_queries = queries_result.scalars().all()
        if not active_queries:
            raise HTTPException(400, "Could not generate queries automatically. Please add queries manually.")

    # Check credits before proceeding
    has_enough, cost, balance = await check_credits(db, body.llms, len(active_queries), user.id)
    if not has_enough:
        raise HTTPException(
            402,
            f"Insufficient credits. This scan costs {cost} credits but you have {balance}. "
            f"Contact support to purchase more credits."
        )

    # Deduct credits
    await deduct_credits(db, cost, f"Scan: {len(active_queries)} queries × {len(body.llms)} LLMs", user.id)

    # Create pending scan immediately to return to client
    scan = Scan(
        id=uuid.uuid4(),
        brand_id=brand_id,
        status=ScanStatus.pending,
        started_at=_utcnow(),
    )
    db.add(scan)
    await db.commit()
    await db.refresh(scan)

    # Run in background — pass scan.id so orchestrator updates the same record
    background_tasks.add_task(_run_scan_background, brand_id, scan.id, body.llms)

    return scan


async def _run_scan_background(brand_id: uuid.UUID, scan_id: uuid.UUID, llm_names: list[str]):
    """Background task wrapper for scan execution."""
    from app.core.database import AsyncSessionLocal
    logger.info("Background scan started: scan_id=%s brand_id=%s llms=%s", scan_id, brand_id, llm_names)
    async with AsyncSessionLocal() as db:
        try:
            await run_scan(brand_id, db, llm_names, scan_id=scan_id)
            logger.info("Background scan completed: scan_id=%s", scan_id)
        except Exception as e:
            logger.exception("Background scan failed: scan_id=%s error=%s", scan_id, e)
            # Mark scan as failed
            try:
                result = await db.execute(select(Scan).where(Scan.id == scan_id))
                scan = result.scalar_one_or_none()
                if scan:
                    scan.status = ScanStatus.failed
                    scan.completed_at = _utcnow()
                    await db.commit()
                    logger.info("Background scan marked as failed: scan_id=%s", scan_id)
            except Exception as inner_e:
                logger.exception("Failed to mark scan as failed: scan_id=%s error=%s", scan_id, inner_e)


@router.get("/brands/{brand_id}/scans", response_model=list[ScanOut], tags=["Scans"])
async def list_scans(brand_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Scan)
        .where(Scan.brand_id == brand_id)
        .order_by(desc(Scan.started_at))
        .limit(20)
    )
    return result.scalars().all()


@router.get("/brands/{brand_id}/scans/{scan_id}", response_model=ScanOut, tags=["Scans"])
async def get_scan(brand_id: uuid.UUID, scan_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Scan).where(Scan.id == scan_id, Scan.brand_id == brand_id)
    )
    scan = result.scalar_one_or_none()
    if not scan:
        raise HTTPException(404, "Scan not found")
    return scan


# ─── SSE: live scan progress ────────────────────────────────────────────────────

@router.get("/brands/{brand_id}/scans/{scan_id}/stream", tags=["Scans"])
async def stream_scan_progress(
    brand_id: uuid.UUID,
    scan_id: uuid.UUID,
):
    async def event_generator() -> AsyncGenerator[str, None]:
        from app.core.database import AsyncSessionLocal
        async with AsyncSessionLocal() as db:
            for _ in range(60):  # Poll up to 60s
                result = await db.execute(select(Scan).where(Scan.id == scan_id))
                scan = result.scalar_one_or_none()
                if not scan:
                    yield f"data: {json.dumps({'error': 'scan not found'})}\n\n"
                    break

                payload = {
                    "status": scan.status.value,
                    "visibility_score": scan.visibility_score,
                    "mention_rate": scan.mention_rate,
                }
                yield f"data: {json.dumps(payload)}\n\n"

                if scan.status in (ScanStatus.completed, ScanStatus.failed):
                    break

                await asyncio.sleep(2)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


# ─── Dashboard ─────────────────────────────────────────────────────────────────

@router.get("/brands/{brand_id}/dashboard", response_model=DashboardOut, tags=["Dashboard"])
async def get_dashboard(brand_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    # Brand
    brand_result = await db.execute(select(Brand).where(Brand.id == brand_id))
    brand = brand_result.scalar_one_or_none()
    if not brand:
        raise HTTPException(404, "Brand not found")

    # Latest completed scan
    scan_result = await db.execute(
        select(Scan)
        .where(Scan.brand_id == brand_id, Scan.status == ScanStatus.completed)
        .order_by(desc(Scan.started_at))
        .limit(1)
    )
    latest_scan = scan_result.scalar_one_or_none()

    # Active (pending/running) scan — the one currently in progress
    active_result = await db.execute(
        select(Scan)
        .where(
            Scan.brand_id == brand_id,
            Scan.status.in_([ScanStatus.pending, ScanStatus.running]),
        )
        .order_by(desc(Scan.started_at))
        .limit(1)
    )
    active_scan = active_result.scalar_one_or_none()

    # Queries
    queries_result = await db.execute(
        select(MonitoredQuery).where(MonitoredQuery.brand_id == brand_id, MonitoredQuery.is_active == True)
    )
    queries = queries_result.scalars().all()
    query_map = {q.id: q for q in queries}

    if not latest_scan:
        return DashboardOut(
            brand=BrandOut.model_validate(brand),
            latest_scan=None,
            active_scan=ScanOut.model_validate(active_scan) if active_scan else None,
            visibility_score=0,
            mention_rate=0,
            queries_monitored=len(queries),
            top_competitor=None,
            llm_breakdown=[],
            competitor_share=[],
            query_summaries=[],
            score_history=[],
        )

    # All results for latest scan
    results_result = await db.execute(
        select(QueryResult).where(QueryResult.scan_id == latest_scan.id)
    )
    all_results = results_result.scalars().all()

    # Filter out errored results from aggregations
    successful_results = [r for r in all_results if not r.raw_response.startswith("[Error") and not r.raw_response.startswith("[Empty")]

    # LLM breakdown — based on successful results only
    llm_data: dict[str, list] = {}
    for r in successful_results:
        llm_data.setdefault(r.llm_name, []).append(r)

    llm_breakdown = []
    for llm_name, results in llm_data.items():
        mentioned = [r for r in results if r.mentioned]
        scores = [r.score for r in results if r.score is not None]
        positions = [r.position for r in mentioned if r.position]
        sentiment_dist = {"positive": 0, "neutral": 0, "negative": 0, "not_mentioned": 0}
        for r in results:
            sentiment_dist[r.sentiment.value if hasattr(r.sentiment, "value") else r.sentiment] += 1

        llm_breakdown.append(LLMBreakdown(
            llm_name=llm_name,
            visibility_pct=round(len(mentioned) / len(results) * 100, 1) if results else 0,
            avg_position=round(sum(positions) / len(positions), 1) if positions else None,
            sentiment_distribution=sentiment_dist,
            score=round(sum(scores) / len(scores), 1) if scores else 0,
        ))

    # Competitor share of voice — based on successful results only
    comp_counts: dict[str, int] = {}
    total_results_count = len(successful_results)
    for r in successful_results:
        for comp in (r.competitors_mentioned or []):
            name = comp.get("name", "")
            if name:
                comp_counts[name] = comp_counts.get(name, 0) + 1

    competitor_share = sorted(
        [
            CompetitorShareItem(name=name, mention_pct=round(count / total_results_count * 100, 1))
            for name, count in comp_counts.items()
        ],
        key=lambda x: x.mention_pct,
        reverse=True,
    )[:8]

    top_competitor = competitor_share[0].name if competitor_share else None

    # Query summaries (for query chip panel)
    query_summaries = []
    results_by_query: dict[uuid.UUID, list] = {}
    for r in all_results:
        results_by_query.setdefault(r.query_id, []).append(r)

    for query_id, results in results_by_query.items():
        q = query_map.get(query_id)
        if not q:
            continue
        query_summaries.append(QuerySummary(
            query_id=query_id,
            query_text=q.query_text,
            results=[
                {
                    "llm_name": r.llm_name,
                    "mentioned": r.mentioned,
                    "position": r.position,
                    "sentiment": r.sentiment.value if hasattr(r.sentiment, "value") else r.sentiment,
                    "score": r.score,
                }
                for r in results if not r.raw_response.startswith("[Error") and not r.raw_response.startswith("[Empty")
            ],
        ))

    # Score history (last 10 scans)
    history_result = await db.execute(
        select(Scan)
        .where(Scan.brand_id == brand_id, Scan.status == ScanStatus.completed)
        .order_by(desc(Scan.started_at))
        .limit(10)
    )
    history_scans = history_result.scalars().all()
    score_history = [
        {
            "date": s.started_at.isoformat(),
            "visibility_score": s.visibility_score,
            "mention_rate": s.mention_rate,
        }
        for s in reversed(history_scans)
    ]

    return DashboardOut(
        brand=BrandOut.model_validate(brand),
        latest_scan=ScanOut.model_validate(latest_scan),
        active_scan=ScanOut.model_validate(active_scan) if active_scan else None,
        visibility_score=latest_scan.visibility_score or 0,
        mention_rate=latest_scan.mention_rate or 0,
        queries_monitored=len(queries),
        top_competitor=top_competitor,
        llm_breakdown=llm_breakdown,
        competitor_share=competitor_share,
        query_summaries=query_summaries,
        score_history=score_history,
    )


# ─── Query drilldown ────────────────────────────────────────────────────────────

@router.get("/brands/{brand_id}/queries/{query_id}/drilldown", response_model=QueryDrilldownOut, tags=["Dashboard"])
async def get_query_drilldown(
    brand_id: uuid.UUID,
    query_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    # Brand
    brand_result = await db.execute(select(Brand).where(Brand.id == brand_id))
    brand = brand_result.scalar_one_or_none()
    if not brand:
        raise HTTPException(404, "Brand not found")

    # Query
    query_result = await db.execute(
        select(MonitoredQuery).where(MonitoredQuery.id == query_id, MonitoredQuery.brand_id == brand_id)
    )
    query = query_result.scalar_one_or_none()
    if not query:
        raise HTTPException(404, "Query not found")

    # Latest scan
    scan_result = await db.execute(
        select(Scan)
        .where(Scan.brand_id == brand_id, Scan.status == ScanStatus.completed)
        .order_by(desc(Scan.started_at))
        .limit(1)
    )
    latest_scan = scan_result.scalar_one_or_none()
    if not latest_scan:
        raise HTTPException(404, "No completed scans yet")

    # Results for this query in the latest scan
    results_result = await db.execute(
        select(QueryResult)
        .where(QueryResult.scan_id == latest_scan.id, QueryResult.query_id == query_id)
    )
    results = results_result.scalars().all()

    # Exclude errored results from stats
    successful = [r for r in results if not r.raw_response.startswith("[Error") and not r.raw_response.startswith("[Empty")]
    mentioned = [r for r in successful if r.mentioned]
    positions = [r.position for r in mentioned if r.position]
    avg_position = round(sum(positions) / len(positions), 1) if positions else None

    # Top competitor — from successful results only
    comp_counts: dict[str, int] = {}
    for r in successful:
        for comp in (r.competitors_mentioned or []):
            name = comp.get("name", "")
            if name:
                comp_counts[name] = comp_counts.get(name, 0) + 1
    top_competitor = max(comp_counts, key=comp_counts.get) if comp_counts else None

    # Overall sentiment — from successful results only
    sentiments = [r.sentiment.value if hasattr(r.sentiment, "value") else r.sentiment for r in mentioned]
    if not sentiments:
        overall_sentiment = "not mentioned"
    elif sentiments.count("positive") > sentiments.count("negative"):
        overall_sentiment = "positive"
    elif sentiments.count("negative") > sentiments.count("positive"):
        overall_sentiment = "negative"
    else:
        overall_sentiment = "mixed"

    # Generate insights — from successful results only
    raw_insights = generate_insights_for_query(brand.name, query.query_text, successful)
    insights = [DrilldownInsight(type=i["type"], text=i["text"]) for i in raw_insights]

    return QueryDrilldownOut(
        query_text=query.query_text,
        scanned_at=latest_scan.completed_at or latest_scan.started_at,
        avg_position=avg_position,
        llms_mentioned=len(mentioned),
        total_llms=len(successful),  # Successful only, not errored
        top_competitor=top_competitor,
        overall_sentiment=overall_sentiment,
        results=[QueryResultOut.model_validate(r) for r in results],  # Show all results (including errors) in the UI
        insights=insights,
    )


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
async def admin_grant_credits(body: CreditGrantRequest, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    wallet = await grant_credits(db, body.amount, body.description, "admin_grant", user.id)
    await db.commit()
    return CreditBalanceOut(
        balance=wallet.balance,
        total_purchased=wallet.total_purchased,
        total_used=wallet.total_used,
        cost_per_scan=CREDIT_COSTS,
    )


@router.get("/credits/history", response_model=list[CreditTransactionOut], tags=["Credits"])
async def credit_history(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    transactions = await get_credit_history(db, user.id)
    return transactions


@router.post("/webhooks/bmc", tags=["Webhooks"])
async def bmc_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Buy Me a Coffee webhook — converts donations to credits."""
    from fastapi.responses import JSONResponse
    body = await request.body()
    signature = request.headers.get("X-BMC-Signature", "")

    if not verify_bmc_signature(body, signature, settings.BMC_WEBHOOK_SECRET):
        logger.warning("BMC webhook signature verification failed")
        raise HTTPException(401, "Invalid signature")

    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(400, "Invalid JSON")

    event_type = data.get("type")
    if event_type != "donation.completed":
        return JSONResponse({"status": "ignored", "type": event_type})

    donation = data.get("data", {})
    user_id_hex = donation.get("user_id", "")
    if not user_id_hex:
        logger.warning("BMC webhook missing user_id in donation data")
        return JSONResponse({"status": "error", "detail": "user_id required"})
    try:
        user_id = uuid.UUID(user_id_hex)
    except ValueError:
        return JSONResponse({"status": "error", "detail": "invalid user_id"})

    amount = donation.get("amount", 0)
    donor_name = donation.get("donor_name", "Anonymous")

    if amount <= 0:
        return JSONResponse({"status": "ignored", "amount": amount})

    credits = amount * CREDITS_PER_DOLLAR

    await grant_credits(
        db,
        amount=credits,
        description=f"Donation: ${amount} from {donor_name} → {credits} credits",
        tx_type="donation",
        user_id=user_id,
    )
    await db.commit()

    logger.info("BMC donation: $%d from %s → %d credits for user %s", amount, donor_name, credits, user_id)
    return JSONResponse({"status": "ok", "credits_granted": credits})
