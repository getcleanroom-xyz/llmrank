import uuid
import logging
import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.core.database import get_db
from app.models.models import User, Brand, MonitoredQuery, Scan, QueryResult, ScanStatus
from app.schemas.schemas import BrandOut, ScanOut, DashboardOut, LLMBreakdown, CompetitorShareItem, QuerySummary, DrilldownInsight
from app.services.insight_engine import generate_dashboard_insights
from app.services.cache import dashboard_cache

router = APIRouter()
logger = logging.getLogger(__name__)


def _normalize_competitor(name: str) -> str:
    """Normalize competitor name for fuzzy matching (ignore spaces, hyphens, underscores, case)."""
    return re.sub(r'[\s\-_\.]+', '', name).lower()


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
    comp_beats: dict[str, int] = {}
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
            # Track when competitor outranks the brand
            comp_pos = comp.get("position")
            if r.mentioned and r.position is not None and comp_pos is not None:
                if comp_pos < r.position:
                    comp_beats[norm] = comp_beats.get(norm, 0) + 1

    competitor_share = sorted(
        [
            CompetitorShareItem(
                name=entry["name"],
                mention_pct=round(entry["count"] / total_results_count * 100, 1),
                beats_you=comp_beats.get(norm, 0),
            )
            for norm, entry in comp_counts.items()
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

    # Cache key for dashboard (include scan id to avoid stale data)
    import json as _json
    cache_key = f"dash:{brand_id}:{latest_scan.id}"
    cached = dashboard_cache.get(cache_key)
    if cached:
        return cached

    # Compute dashboard insights (non-blocking: fire-and-forget, cached separately)
    insights_cache_key = f"dash_insights:{brand_id}:{latest_scan.id}"
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
    dashboard_cache.set(cache_key, result, ttl=30)
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
