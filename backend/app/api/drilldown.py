import uuid
import logging
import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.core.database import get_db
from app.models.models import User, Brand, MonitoredQuery, Scan, QueryResult, ScanStatus
from app.schemas.schemas import (
    BrandOut, QueryResultOut, QueryDrilldownOut, DrilldownInsight,
    LLMDrilldownOut, LLMQueryResultItem,
    CompetitorDrilldownOut, CompetitorQueryResult, CompetitorMention,
)
from app.services.insight_engine import generate_insights_for_query, generate_competitor_insight

router = APIRouter()
logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    """Return naive UTC datetime compatible with TIMESTAMP WITHOUT TIME ZONE columns."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _normalize_competitor(name: str) -> str:
    """Normalize competitor name for fuzzy matching (ignore spaces, hyphens, underscores, case)."""
    return re.sub(r'[\s\-_\.]+', '', name).lower()


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
            competitors_mentioned=[CompetitorMention(name=c.get("name", ""), position=c.get("position")) for c in (r.competitors_mentioned or [])],
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
                comp_results.append((r, c.get("position")))
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
        if r.mentioned and brand_pos is not None and comp_pos is not None:
            if comp_pos < brand_pos:
                beats_count += 1
            elif comp_pos > brand_pos:
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

    queries_out.sort(key=lambda x: (x.competitor_position or 999))

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

    # Generate competitive insight with richer data
    brand_row = (await db.execute(select(Brand).where(Brand.id == brand_id))).scalar_one_or_none()
    brand_name = brand_row.name if brand_row else ""

    comp_insight = ""
    try:
        top_queries = [q.query_text for q in [query_map.get(r.query_id) for r, _ in comp_results] if q]
        brand_positions = [r.position for r, _ in comp_results if r.mentioned and r.position]
        comp_positions = [p for _, p in comp_results if p is not None]
        brand_avg_pos = round(sum(brand_positions) / len(brand_positions), 1) if brand_positions else None
        comp_avg_pos = round(sum(comp_positions) / len(comp_positions), 1) if comp_positions else None
        comp_insight = await generate_competitor_insight(
            brand_name, competitor_name,
            round(len(comp_results) / len(all_results) * 100, 1) if all_results else 0,
            brand_wins, beats_count,
            len({r.query_id for r, _ in comp_results}) - beats_count - brand_wins,
            branded_total=total_queries,
            brand_position=brand_avg_pos,
            competitor_position=comp_avg_pos,
            top_queries=top_queries,
        )
    except Exception as e:
        logger.warning("Competitor insight failed: %s", e)

    comp_insight = comp_insight or (
        f"{competitor_name} beats you in {beats_count} out of {total_queries} queries. "
        f"You could target their weaknesses in your content to improve your AI visibility."
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
