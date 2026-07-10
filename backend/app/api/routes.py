import uuid
import logging
import re
from datetime import datetime, timezone
from typing import AsyncGenerator, Optional
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
    QueryTableItem, QueryTableResponse,
    ScanCreate, ScanOut,
    QueryResultOut, DashboardOut, QueryDrilldownOut,
    LLMBreakdown, CompetitorShareItem, QuerySummary, DrilldownInsight,
    LLMDrilldownOut, LLMQueryResultItem,
    CompetitorDrilldownOut, CompetitorQueryResult, CompetitorMention,
    CreditBalanceOut, CreditGrantRequest, CreditTransactionOut,
)
from app.services.scan_orchestrator import run_scan, generate_query_suggestions
from app.services.llm_adapters import scan_all_llms, scan_query, OpenRouterAdapter, _call_openrouter, _parse_json, SCAN_DEVELOPER
from app.services.insight_engine import generate_insights_for_query, generate_dashboard_insights, generate_competitor_insight
from app.services.credit_service import get_or_create_wallet, check_credits, deduct_credits, grant_credits, get_credit_history, calculate_scan_cost, CREDIT_COSTS, CREDITS_PER_DOLLAR
from app.services.cache import dashboard_cache
from app.api.auth import get_current_user, get_optional_user

router = APIRouter()
logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    """Return naive UTC datetime compatible with TIMESTAMP WITHOUT TIME ZONE columns."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _normalize_competitor(name: str) -> str:
    """Normalize competitor name for fuzzy matching (ignore spaces, hyphens, underscores, case)."""
    return re.sub(r'[\s\-_\.]+', '', name).lower()


# ─── Brands ────────────────────────────────────────────────────────────────────

@router.post("/brands", response_model=BrandOut, status_code=201, tags=["Brands"])
@limiter.limit(f"{settings.RATE_LIMIT_PER_MINUTE}/minute")
async def create_brand(request: Request, body: BrandCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    competitors_json = [{"name": c, "domain": "", "relevance_score": 5} for c in body.competitors] if body.competitors else None
    brand = Brand(id=uuid.uuid4(), name=body.name, domain=body.domain, owner_id=user.id, competitors=competitors_json)
    db.add(brand)
    await db.commit()
    await db.refresh(brand)
    return brand


@router.get("/brands", response_model=list[BrandOut], tags=["Brands"])
async def list_brands(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    page: int = 1,
    per_page: int = 50,
    search: str = "",
):
    stmt = select(Brand).where(Brand.owner_id == user.id)
    if search:
        stmt = stmt.where(
            (Brand.name.ilike(f"%{search}%")) | (Brand.domain.ilike(f"%{search}%"))
        )
    stmt = stmt.order_by(desc(Brand.created_at)).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(stmt)
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
        query_type=body.query_type,
        query_score=body.query_score,
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


@router.get("/brands/{brand_id}/queries/table", response_model=QueryTableResponse, tags=["Queries"])
async def list_queries_table(
    brand_id: uuid.UUID,
    page: int = 1,
    per_page: int = 20,
    q: str = "",
    db: AsyncSession = Depends(get_db),
):
    # count total matching
    count_query = select(func.count(MonitoredQuery.id)).where(MonitoredQuery.brand_id == brand_id)
    if q:
        count_query = count_query.where(MonitoredQuery.query_text.ilike(f"%{q}%"))
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    pages = max(1, (total + per_page - 1) // per_page)
    page = max(1, min(page, pages))

    # fetch page
    stmt = (
        select(MonitoredQuery)
        .where(MonitoredQuery.brand_id == brand_id)
    )
    if q:
        stmt = stmt.where(MonitoredQuery.query_text.ilike(f"%{q}%"))
    stmt = stmt.order_by(MonitoredQuery.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(stmt)
    queries = result.scalars().all()

    # get result counts and last scan per query
    qids = [mq.id for mq in queries]
    items: list[QueryTableItem] = []
    if qids:
        counts_result = await db.execute(
            select(QueryResult.query_id, func.count(QueryResult.id), func.max(QueryResult.created_at))
            .where(QueryResult.query_id.in_(qids))
            .group_by(QueryResult.query_id)
        )
        counts = {row[0]: (row[1], row[2]) for row in counts_result}

        for mq in queries:
            cnt, last_at = counts.get(mq.id, (0, None))
            items.append(QueryTableItem(
                id=mq.id,
                query_text=mq.query_text,
                query_type=mq.query_type,
                query_score=mq.query_score,
                is_active=mq.is_active,
                created_at=mq.created_at,
                result_count=cnt,
                last_scan_at=last_at,
            ))
    else:
        for mq in queries:
            items.append(QueryTableItem(
                id=mq.id,
                query_text=mq.query_text,
                query_type=mq.query_type,
                query_score=mq.query_score,
                is_active=mq.is_active,
                created_at=mq.created_at,
            ))

    return QueryTableResponse(items=items, total=total, page=page, per_page=per_page, pages=pages)


@router.post("/brands/{brand_id}/queries/suggest", tags=["Queries"])
@limiter.limit("5/minute")
async def suggest_queries(request: Request, brand_id: uuid.UUID, body: QuerySuggestRequest, db: AsyncSession = Depends(get_db)):
    brand_result = await db.execute(select(Brand).where(Brand.id == brand_id))
    brand = brand_result.scalar_one_or_none()
    if not brand:
        raise HTTPException(404, "Brand not found")
    user_comps = [c.get("name", "") for c in (brand.competitors or [])]
    import httpx as _httpx
    async with _httpx.AsyncClient(timeout=30) as client:
        result = await orchestrate_query_generation(brand.name, brand.domain, "", user_comps, client)
    # Persist competitors back to brand if new ones were found
    if result.get("competitors"):
        brand.competitors = result["competitors"]
        await db.commit()
    return result


@router.post("/brands/{brand_id}/queries/probe", tags=["Queries"])
@limiter.limit("5/minute")
async def probe_queries(request: Request, brand_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Run a probe scan on generated queries and return insights."""
    brand_result = await db.execute(select(Brand).where(Brand.id == brand_id))
    brand = brand_result.scalar_one_or_none()
    if not brand:
        raise HTTPException(404, "Brand not found")
    user_comps = [c.get("name", "") for c in (brand.competitors or [])]
    import httpx as _httpx
    async with _httpx.AsyncClient(timeout=60) as client:
        from app.services.llm_adapters import classify_brand, discover_competitors_from_crawl, discover_competitors_by_category, generate_scored_queries, run_probe_scan
        classification = await classify_brand("", brand.name, brand.domain, client)
        from_crawl = await discover_competitors_from_crawl("", client)
        from_category = await discover_competitors_by_category(classification, client)
        seen = {c.get("name", "").lower(): c for c in from_crawl + from_category if c.get("name", "").lower() != brand.name.lower()}
        for n in user_comps:
            if n.lower() not in seen:
                seen[n.lower()] = {"name": n, "domain": "", "relevance_score": 5}
        competitors = sorted(seen.values(), key=lambda c: c.get("relevance_score", 0), reverse=True)[:10]
        queries = await generate_scored_queries(brand.name, brand.domain, classification, competitors, client)
        probe = await run_probe_scan(brand.name, brand.domain, queries, client)
    return {"queries": queries, "probe_result": probe}


@router.post("/brands/{brand_id}/queries/{query_id}/rescan", tags=["Queries"])
@limiter.limit("10/minute")
async def rescan_single_query(
    request: Request,
    brand_id: uuid.UUID,
    query_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Rescan a single query across standard LLMs and persist results."""
    query_result = await db.execute(
        select(MonitoredQuery).where(MonitoredQuery.id == query_id, MonitoredQuery.brand_id == brand_id)
    )
    query = query_result.scalar_one_or_none()
    if not query:
        raise HTTPException(404, "Query not found")

    llm_names = ["chatgpt", "gemini", "llama"]

    # Create a scan record
    scan = Scan(id=uuid.uuid4(), brand_id=brand_id, status=ScanStatus.running, started_at=_utcnow())
    db.add(scan)
    await db.commit()

    import httpx as _httpx
    async with _httpx.AsyncClient(timeout=45) as client:
        raw_results = await scan_all_llms([(str(query.id), query.query_text)], llm_names, client)

    results: list[QueryResult] = []
    for q_id, llm_name, result_data, error in raw_results:
        if error or not result_data:
            r = QueryResult(id=uuid.uuid4(), scan_id=scan.id, query_id=query.id, llm_name=llm_name,
                raw_response=f"[Error: {error}]" if error else "[Empty response]",
                mentioned=False, position=None, sentiment="not_mentioned",
                competitors_mentioned=[], annotated_response=None, score=None)
        else:
            r = QueryResult(id=uuid.uuid4(), scan_id=scan.id, query_id=query.id, llm_name=llm_name,
                raw_response=result_data.get("summary", str(result_data)),
                mentioned=result_data.get("brand_mentioned", False),
                position=result_data.get("brand_position"),
                sentiment=result_data.get("brand_sentiment", "not_mentioned"),
                competitors_mentioned=[{"name": c, "position": 0} for c in result_data.get("competitors", [])],
                annotated_response=None,
                score=_compute_scan_score(
                    result_data.get("brand_mentioned", False),
                    result_data.get("brand_position"),
                    result_data.get("brand_sentiment", "not_mentioned"),
                ))
        results.append(r)

    db.add_all(results)
    scan.status = ScanStatus.completed
    scan.completed_at = _utcnow()
    await db.commit()

    return {"scan_id": str(scan.id)}


def _compute_scan_score(mentioned: bool, position: Optional[int], sentiment: str) -> float:
    """Replicate the score logic from scan_orchestrator."""
    if not mentioned:
        return 5.0
    base = 40.0
    pos_bonus = {1: 35, 2: 25, 3: 15, 4: 8}.get(position or 99, 3)
    sent_bonus = {"positive": 20, "neutral": 10, "negative": 0}.get(sentiment, 0)
    return round(min(100.0, base + pos_bonus + sent_bonus), 1)


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
async def list_scans(
    brand_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    page: int = 1,
    per_page: int = 20,
):
    result = await db.execute(
        select(Scan)
        .where(Scan.brand_id == brand_id)
        .order_by(desc(Scan.started_at))
        .offset((page - 1) * per_page)
        .limit(per_page)
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


@router.get("/brands/{brand_id}/scans/{scan_id}/results", tags=["Scans"])
async def get_scan_results(brand_id: uuid.UUID, scan_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Return scan with grouped per-query results."""
    from pydantic import BaseModel
    from app.schemas.schemas import QueryResultOut, QuerySummary

    result = await db.execute(
        select(Scan).where(Scan.id == scan_id, Scan.brand_id == brand_id)
    )
    scan = result.scalar_one_or_none()
    if not scan:
        raise HTTPException(404, "Scan not found")

    # Fetch all results for this scan
    qr = await db.execute(
        select(QueryResult).where(QueryResult.scan_id == scan_id)
    )
    results = qr.scalars().all()

    # Group by query
    query_map: dict[uuid.UUID, list] = {}
    for r in results:
        qid = r.query_id
        if qid not in query_map:
            query_map[qid] = []
        query_map[qid].append(r)

    # Build query summaries with results
    summaries = []
    for qid, qr_list in query_map.items():
        # Get query text from MonitoredQuery
        mq_result = await db.execute(select(MonitoredQuery).where(MonitoredQuery.id == qid))
        mq = mq_result.scalar_one_or_none()
        query_text = mq.query_text if mq else "Unknown query"

        results_out = []
        for r in qr_list:
            results_out.append({
                "llm_name": r.llm_name,
                "mentioned": r.mentioned,
                "position": r.position,
                "sentiment": r.sentiment.value if hasattr(r.sentiment, "value") else r.sentiment,
                "score": r.score,
                "competitors_mentioned": [{"name": c.get("name", ""), "position": c.get("position", 0)} for c in (r.competitors_mentioned or [])],
            })

        summaries.append({
            "query_id": str(qid),
            "query_text": query_text,
            "results": results_out,
        })

    # Sort by position of first result that mentions the brand
    summaries.sort(key=lambda s: min((r["position"] or 999 for r in s["results"] if r["mentioned"]), default=999))

    return {
        "id": str(scan.id),
        "brand_id": str(scan.brand_id),
        "status": scan.status.value,
        "started_at": scan.started_at.isoformat() if scan.started_at else None,
        "completed_at": scan.completed_at.isoformat() if scan.completed_at else None,
        "visibility_score": scan.visibility_score,
        "mention_rate": scan.mention_rate,
        "query_summaries": summaries,
    }


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
            insights=[],
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
    comp_counts: dict[str, dict] = {}
    total_results_count = len(successful_results)
    for r in successful_results:
        for comp in (r.competitors_mentioned or []):
            raw_name = comp.get("name", "")
            if not raw_name:
                continue
            norm = _normalize_competitor(raw_name)
            if norm not in comp_counts:
                comp_counts[norm] = {"name": raw_name, "count": 0}
            comp_counts[norm]["count"] += 1

    competitor_share = sorted(
        [
            CompetitorShareItem(name=entry["name"], mention_pct=round(entry["count"] / total_results_count * 100, 1))
            for entry in comp_counts.values()
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

    # Cache key for dashboard
    import json as _json
    cache_key = f"dash:{brand_id}"
    cached = dashboard_cache.get(cache_key)
    if cached:
        return cached

    # Compute dashboard insights (non-blocking: fire-and-forget, cached separately)
    insights_cache_key = f"dash_insights:{brand_id}"
    dash_insights = dashboard_cache.get(insights_cache_key)
    if dash_insights is None:
        dash_insights = []
        import asyncio as _asyncio
        _asyncio.ensure_future(_compute_and_cache_insights(brand.name, all_results, brand.domain, insights_cache_key))

    result = DashboardOut(
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
        insights=dash_insights,
    )
    dashboard_cache.set(cache_key, result, ttl=10)
    return result


async def _compute_and_cache_insights(brand_name: str, all_results: list, domain: str, cache_key: str) -> None:
    """Background task: generate insights and cache them."""
    try:
        raw = await generate_dashboard_insights(brand_name, all_results, domain)
        insights = [DrilldownInsight(type=i["type"], text=i["text"]) for i in raw]
        dashboard_cache.set(cache_key, insights, ttl=300)
        logger.info("Dashboard insights cached for %s", brand_name)
    except Exception as e:
        logger.warning("Failed to generate dashboard insights: %s", e)


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
    raw_insights = await generate_insights_for_query(brand.name, query.query_text, successful)
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


# ─── LLM drilldown ──────────────────────────────────────────────────────────────

@router.get("/brands/{brand_id}/llms/{llm_name}", response_model=LLMDrilldownOut, tags=["Dashboard"])
async def get_llm_drilldown(
    brand_id: uuid.UUID,
    llm_name: str,
    db: AsyncSession = Depends(get_db),
):
    # Get latest completed scan
    scan_result = await db.execute(
        select(Scan)
        .where(Scan.brand_id == brand_id, Scan.status == ScanStatus.completed)
        .order_by(desc(Scan.started_at))
        .limit(1)
    )
    latest_scan = scan_result.scalar_one_or_none()
    if not latest_scan:
        raise HTTPException(404, "No completed scan found")

    # Get all results for this LLM in the latest scan
    results_result = await db.execute(
        select(QueryResult)
        .where(QueryResult.scan_id == latest_scan.id, QueryResult.llm_name == llm_name)
    )
    results = results_result.scalars().all()

    if not results:
        raise HTTPException(404, f"No results for LLM '{llm_name}'")

    mentioned = [r for r in results if r.mentioned]
    positions = [r.position for r in mentioned if r.position]
    scores = [r.score for r in results if r.score is not None]

    # Get query texts
    qids = list({r.query_id for r in results})
    queries_result = await db.execute(
        select(MonitoredQuery).where(MonitoredQuery.id.in_(qids))
    )
    query_map = {q.id: q for q in queries_result.scalars().all()}

    queries_out = []
    for r in results:
        q = query_map.get(r.query_id)
        queries_out.append(LLMQueryResultItem(
            query_id=r.query_id,
            query_text=q.query_text if q else "(unknown)",
            mentioned=r.mentioned,
            position=r.position,
            sentiment=r.sentiment.value if hasattr(r.sentiment, "value") else r.sentiment,
            score=r.score,
            competitors_mentioned=[CompetitorMention(name=c.get("name", ""), position=c.get("position", 0)) for c in (r.competitors_mentioned or [])],
        ))

    queries_out.sort(key=lambda x: (x.position or 999))

    return LLMDrilldownOut(
        llm_name=llm_name,
        scanned_at=latest_scan.completed_at or latest_scan.started_at,
        total_queries=len(results),
        times_mentioned=len(mentioned),
        visibility_pct=round(len(mentioned) / len(results) * 100, 1) if results else 0,
        avg_position=round(sum(positions) / len(positions), 1) if positions else None,
        avg_score=round(sum(scores) / len(scores), 1) if scores else 0,
        queries=queries_out,
    )


# ─── Competitor drilldown ───────────────────────────────────────────────────────

@router.get("/brands/{brand_id}/competitors/{competitor_name}", response_model=CompetitorDrilldownOut, tags=["Dashboard"])
async def get_competitor_drilldown(
    brand_id: uuid.UUID,
    competitor_name: str,
    db: AsyncSession = Depends(get_db),
):
    # Get latest completed scan
    scan_result = await db.execute(
        select(Scan)
        .where(Scan.brand_id == brand_id, Scan.status == ScanStatus.completed)
        .order_by(desc(Scan.started_at))
        .limit(1)
    )
    latest_scan = scan_result.scalar_one_or_none()
    if not latest_scan:
        raise HTTPException(404, "No completed scan found")

    # Get ALL results from the latest scan
    all_results = await db.execute(
        select(QueryResult).where(QueryResult.scan_id == latest_scan.id)
    )
    all_results = all_results.scalars().all()

    total_queries = len({r.query_id for r in all_results})

    # Filter to results where this competitor is mentioned
    comp_results = []
    normalized_target = _normalize_competitor(competitor_name)
    for r in all_results:
        comps = r.competitors_mentioned or []
        for c in comps:
            if _normalize_competitor(c.get("name", "")) == normalized_target:
                comp_results.append((r, c.get("position", 0)))
                break

    if not comp_results:
        raise HTTPException(404, f"No mentions found for competitor '{competitor_name}'")

    # Get query texts
    qids = list({r.query_id for r, _ in comp_results})
    queries_query = await db.execute(
        select(MonitoredQuery).where(MonitoredQuery.id.in_(qids))
    )
    query_map = {q.id: q for q in queries_query.scalars().all()}

    beats_count = 0
    brand_wins = 0
    queries_out = []
    for r, comp_pos in comp_results:
        q = query_map.get(r.query_id)
        brand_pos = r.position if r.mentioned else None
        if r.mentioned and brand_pos is not None and comp_pos < brand_pos:
            beats_count += 1
        elif r.mentioned and brand_pos is not None and comp_pos > brand_pos:
            brand_wins += 1

        queries_out.append(CompetitorQueryResult(
            query_id=r.query_id,
            query_text=q.query_text if q else "(unknown)",
            llm_name=r.llm_name,
            competitor_position=comp_pos,
            brand_mentioned=r.mentioned,
            brand_position=brand_pos,
            score=r.score,
        ))

    queries_out.sort(key=lambda x: x.competitor_position)

    # Look up domain from brand's competitors list
    comp_domain = ""
    brand_result = await db.execute(select(Brand.competitors).where(Brand.id == brand_id))
    competitors_data = brand_result.scalar_one_or_none()
    if competitors_data:
        for c in competitors_data:
            if _normalize_competitor(c.get("name", "")) == _normalize_competitor(competitor_name):
                comp_domain = c.get("domain", "") or ""
                break
    # Fallback: construct domain from competitor name
    if not comp_domain:
        comp_domain = f"{competitor_name.lower().replace(' ', '').replace('-', '')}.com"

    # Generate competitive insight
    brand_row = (await db.execute(select(Brand).where(Brand.id == brand_id))).scalar_one_or_none()
    brand_name = brand_row.name if brand_row else ""

    comp_insight = ""
    try:
        comp_insight = await generate_competitor_insight(
            brand_name, competitor_name,
            round(len(comp_results) / len(all_results) * 100, 1) if all_results else 0,
            brand_wins, beats_count,
            len({r.query_id for r, _ in comp_results}) - beats_count - brand_wins,
        )
    except Exception as e:
        logger.warning("Competitor insight failed: %s", e)

    comp_insight = comp_insight or (
        f"{competitor_name} beats you in {beats_count} out of {total_queries} queries. "
        f"A comparison page targeting their weaknesses is your highest-impact move."
    )

    return CompetitorDrilldownOut(
        competitor_name=competitor_name,
        domain=comp_domain,
        insight=comp_insight,
        scanned_at=latest_scan.completed_at or latest_scan.started_at,
        mention_pct=round(len(comp_results) / len(all_results) * 100, 1) if all_results else 0,
        total_appearances=len(comp_results),
        total_queries=total_queries,
        beats_brand_count=beats_count,
        queries=queries_out,
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
async def credit_history(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    page: int = 1,
    per_page: int = 50,
):
    return await get_credit_history(db, user.id, limit=per_page, offset=(page - 1) * per_page)
