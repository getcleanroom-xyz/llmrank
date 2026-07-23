import uuid
import logging
import re
from urllib.parse import unquote
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.core.database import get_db
from app.models.models import User, Brand, MonitoredQuery, Scan, QueryResult, ScanStatus
from app.schemas.schemas import (
    BrandOut, QueryResultOut, QueryDrilldownOut, DrilldownInsight,
    LLMDrilldownOut, LLMQueryResultItem,
    CompetitorDrilldownOut, CompetitorQueryResult, CompetitorMention, CompetitorLLMBreakdown,
)
from app.services.insight_engine import generate_insights_for_query, generate_competitor_insight
from app.api.auth import get_current_user

router = APIRouter()
logger = logging.getLogger(__name__)


def _normalize_competitor(name: str) -> str:
    """Normalize competitor name for fuzzy matching (ignore spaces, hyphens, underscores, case)."""
    return re.sub(r'[\s\-_\.]+', '', name).lower()


def _is_valid_domain(domain: str) -> bool:
    """Check if a domain string looks like a real domain (not hallucinated)."""
    if not domain or len(domain) < 4:
        return False
    if "." not in domain:
        return False
    tld = domain.rsplit(".", 1)[-1].lower()
    valid_tlds = {"com", "io", "co", "net", "org", "ai", "dev", "app", "us", "uk", "ca", "de", "fr", "jp", "cn", "in", "br", "au", "ru", "xyz", "me", "tv", "cc", "shop", "site", "online", "tech", "store", "cloud"}
    return tld in valid_tlds


# ─── Query drilldown ────────────────────────────────────────────────────────────

@router.get("/brands/{brand_id}/queries/{query_id}/drilldown", response_model=QueryDrilldownOut, tags=["Dashboard"])
async def get_query_drilldown(
    brand_id: uuid.UUID,
    query_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Brand
    brand_result = await db.execute(Brand.active().where(Brand.id == brand_id, Brand.owner_id == user.id))
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
    # Cache query insight to avoid repeated LLM calls
    insight_cache_key = f"query_insight:{brand_id}:{latest_scan.id}:{query_id}"
    from app.services.cache import dashboard_cache
    cached_insights = dashboard_cache.get(insight_cache_key)
    if cached_insights is not None:
        insights = cached_insights
    else:
        raw_insights = await generate_insights_for_query(
            brand.name, query.query_text, successful,
            brand_id=str(brand_id), query_id=str(query_id),
        )
        insights = [DrilldownInsight(type=i["type"], text=i["text"]) for i in raw_insights]
        dashboard_cache.set(insight_cache_key, insights, ttl=300)

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
    user: User = Depends(get_current_user),
):
    # Verify brand exists and not deleted
    brand_result = await db.execute(
        Brand.active().where(Brand.id == brand_id, Brand.owner_id == user.id)
    )
    if not brand_result.scalar_one_or_none():
        raise HTTPException(404, "Brand not found")

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
    user: User = Depends(get_current_user),
):
    competitor_name = unquote(competitor_name)
    # Verify brand exists and not deleted
    brand_row = (await db.execute(
        Brand.active().where(Brand.id == brand_id, Brand.owner_id == user.id)
    )).scalar_one_or_none()
    if not brand_row:
        raise HTTPException(404, "Brand not found")

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
    all_results = (await db.execute(
        select(QueryResult).where(QueryResult.scan_id == latest_scan.id)
    )).scalars().all()

    total_queries = len({r.query_id for r in all_results})
    normalized_target = _normalize_competitor(competitor_name)

    # Filter to results where this competitor is mentioned
    comp_results = []
    for r in all_results:
        for c in (r.competitors_mentioned or []):
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

    # Compute head-to-head stats
    beats_count = 0
    brand_wins = 0
    neither_mentioned = 0
    queries_out = []
    sentiments = {"positive": 0, "neutral": 0, "negative": 0, "not_mentioned": 0}
    llm_stats: dict[str, dict] = {}

    # Compute brand mention rate early (used in historical trend)
    brand_mentioned_count = sum(1 for r in all_results if r.mentioned)
    brand_mention_pct = round(brand_mentioned_count / len(all_results) * 100, 1) if all_results else 0

    # Compute "neither mentioned" from all results (queries where brand is absent AND competitor is not in competitors_mentioned)
    comp_name_lower = normalized_target
    for r in all_results:
        brand_absent = not r.mentioned
        comp_absent = not any(
            _normalize_competitor(c.get("name", "")) == comp_name_lower
            for c in (r.competitors_mentioned or [])
        )
        if brand_absent and comp_absent:
            neither_mentioned += 1

    for r, comp_pos in comp_results:
        q = query_map.get(r.query_id)
        brand_pos = r.position if r.mentioned else None
        sentiment = r.sentiment or "neutral"

        if r.mentioned and brand_pos is not None and comp_pos is not None:
            if comp_pos < brand_pos:
                beats_count += 1
            elif comp_pos > brand_pos:
                brand_wins += 1

        sentiments[sentiment] = sentiments.get(sentiment, 0) + 1

        # Per-LLM aggregation
        llm = r.llm_name
        if llm not in llm_stats:
            llm_stats[llm] = {"mention": 0, "comp_positions": [], "brand_positions": [], "brand_wins": 0, "comp_wins": 0, "total": 0}
        llm_stats[llm]["total"] += 1
        if comp_pos is not None:
            llm_stats[llm]["comp_positions"].append(comp_pos)
        if r.mentioned and brand_pos is not None:
            llm_stats[llm]["brand_positions"].append(brand_pos)
        if r.mentioned and brand_pos is not None and comp_pos is not None:
            if comp_pos < brand_pos:
                llm_stats[llm]["comp_wins"] += 1
            elif comp_pos > brand_pos:
                llm_stats[llm]["brand_wins"] += 1

        queries_out.append(CompetitorQueryResult(
            query_id=r.query_id,
            query_text=q.query_text if q else "(unknown)",
            llm_name=r.llm_name,
            competitor_position=comp_pos,
            brand_mentioned=r.mentioned,
            brand_position=brand_pos,
            score=r.score,
            sentiment=sentiment,
            raw_response=r.raw_response[:500] if r.raw_response else "",
        ))

    queries_out.sort(key=lambda x: (x.competitor_position or 999))

    # Position averages
    comp_positions = [p for _, p in comp_results if p is not None]
    brand_positions = [r.position for r, _ in comp_results if r.mentioned and r.position is not None]
    avg_comp_pos = round(sum(comp_positions) / len(comp_positions), 1) if comp_positions else None
    avg_brand_pos = round(sum(brand_positions) / len(brand_positions), 1) if brand_positions else None

    # Per-LLM breakdown
    llm_breakdown = []
    for llm_name, stats in sorted(llm_stats.items()):
        total = stats["total"]
        llm_breakdown.append(CompetitorLLMBreakdown(
            llm_name=llm_name,
            mention_count=total,
            total=total_queries,
            mention_pct=round(total / total_queries * 100, 1) if total_queries > 0 else 0,
            avg_competitor_position=round(sum(stats["comp_positions"]) / len(stats["comp_positions"]), 1) if stats["comp_positions"] else None,
            avg_brand_position=round(sum(stats["brand_positions"]) / len(stats["brand_positions"]), 1) if stats["brand_positions"] else None,
            brand_wins=stats["brand_wins"],
            competitor_wins=stats["comp_wins"],
        ))

    # Look up domain, logo, and crawled content from brand's competitors list
    comp_domain = ""
    comp_logo = ""
    comp_profile = ""
    competitors_data = brand_row.competitors or []
    comp_index = -1
    for i, c in enumerate(competitors_data):
        if _normalize_competitor(c.get("name", "")) == normalized_target:
            stored = c.get("domain", "") or ""
            if _is_valid_domain(stored):
                comp_domain = stored
            comp_logo = c.get("logo_url", "") or ""
            crawled = c.get("crawled_content", "") or ""
            if crawled:
                comp_profile = crawled[:1500]
            comp_index = i
            break

    # Fill missing domain via web search if not found
    if not comp_domain and competitor_name:
        try:
            from app.services.competitor_service import fill_missing_domains
            temp = [{"name": competitor_name, "domain": ""}]
            filled = await fill_missing_domains(temp)
            if filled and filled[0].get("domain"):
                comp_domain = filled[0]["domain"]
                # Save back to brand's competitors list
                if comp_index >= 0:
                    competitors_data[comp_index]["domain"] = comp_domain
                    brand_row.competitors = competitors_data
                    await db.commit()
                logger.info("Filled missing domain for %s: %s", competitor_name, comp_domain)
        except Exception as e:
            logger.debug("Failed to fill domain for %s: %s", competitor_name, e)

    # Historical trend: query last 5 scans with per-LLM breakdowns
    historical_trend = []
    try:
        prev_scans_result = await db.execute(
            select(Scan)
            .where(Scan.brand_id == brand_id, Scan.status == ScanStatus.completed, Scan.id != latest_scan.id)
            .order_by(desc(Scan.started_at))
            .limit(5)
        )
        prev_scans = prev_scans_result.scalars().all()
        prev_scan_ids = [ps.id for ps in prev_scans]
        all_prev_results = []
        if prev_scan_ids:
            all_prev_results = (await db.execute(
                select(QueryResult).where(QueryResult.scan_id.in_(prev_scan_ids))
            )).scalars().all()
        results_by_scan: dict[uuid.UUID, list] = {}
        for r in all_prev_results:
            results_by_scan.setdefault(r.scan_id, []).append(r)
        for prev_scan in reversed(prev_scans):
            prev_results = results_by_scan.get(prev_scan.id, [])
            prev_total = len({r.query_id for r in prev_results})
            prev_comp = 0
            prev_brand = 0
            per_llm: dict[str, dict] = {}
            for r in prev_results:
                is_comp = any(
                    _normalize_competitor(c.get("name", "")) == normalized_target
                    for c in (r.competitors_mentioned or [])
                )
                is_brand = r.mentioned
                if is_comp:
                    prev_comp += 1
                if is_brand:
                    prev_brand += 1
                llm = r.llm_name
                if llm not in per_llm:
                    per_llm[llm] = {"comp": 0, "brand": 0, "total": 0}
                per_llm[llm]["total"] += 1
                if is_comp:
                    per_llm[llm]["comp"] += 1
                if is_brand:
                    per_llm[llm]["brand"] += 1
            # Normalize per-LLM to percentages
            per_llm_pct = {}
            for llm_name, stats in per_llm.items():
                t = stats["total"]
                per_llm_pct[llm_name] = {
                    "mention_pct": min(round(stats["comp"] / t * 100, 1), 100) if t > 0 else 0,
                    "brand_pct": min(round(stats["brand"] / t * 100, 1), 100) if t > 0 else 0,
                }
            historical_trend.append({
                "date": (prev_scan.completed_at or prev_scan.started_at).isoformat(),
                "mention_pct": min(round(prev_comp / prev_total * 100, 1), 100) if prev_total > 0 else 0,
                "brand_mention_pct": min(round(prev_brand / prev_total * 100, 1), 100) if prev_total > 0 else 0,
                "appearances": prev_comp,
                "brand_appearances": prev_brand,
                "total_queries": prev_total,
                "per_llm": per_llm_pct,
            })
        # Add current scan
        current_per_llm = {}
        for lb in llm_breakdown:
            current_per_llm[lb.llm_name] = {
                "mention_pct": lb.mention_pct,
                "brand_pct": min(round(lb.brand_wins / lb.total * 100, 1), 100) if lb.total > 0 else 0,
            }
        historical_trend.append({
            "date": (latest_scan.completed_at or latest_scan.started_at).isoformat(),
            "mention_pct": min(round(len(comp_results) / total_queries * 100, 1), 100) if total_queries > 0 else 0,
            "brand_mention_pct": brand_mention_pct,
            "appearances": len(comp_results),
            "brand_appearances": brand_mentioned_count,
            "total_queries": total_queries,
            "per_llm": current_per_llm,
        })
    except Exception as e:
        logger.warning("Failed to build historical trend: %s", e)

    # Generate insight
    comp_insight = ""
    insight_cache_key = f"comp_insight:{brand_id}:{latest_scan.id}:{normalized_target}"
    from app.services.cache import dashboard_cache
    cached_insight = dashboard_cache.get(insight_cache_key)
    if cached_insight is not None:
        comp_insight = cached_insight
    else:
        try:
            top_queries = [query_map.get(r.query_id).query_text for r, _ in comp_results if query_map.get(r.query_id)]
            comp_insight = await generate_competitor_insight(
                brand_row.name, competitor_name,
                round(len(comp_results) / len(all_results) * 100, 1) if all_results else 0,
                brand_wins, beats_count,
                neither_mentioned,
                branded_total=total_queries,
                brand_position=avg_brand_pos,
                competitor_position=avg_comp_pos,
                top_queries=top_queries,
            )
            if comp_insight:
                dashboard_cache.set(insight_cache_key, comp_insight, ttl=300)
        except Exception as e:
            logger.warning("Competitor insight failed: %s", e)

    comp_insight = comp_insight or (
        f"{competitor_name} beats you in {beats_count} out of {total_queries} queries. "
        f"You could target their weaknesses in your content to improve your AI visibility."
    )

    return CompetitorDrilldownOut(
        competitor_name=competitor_name,
        domain=comp_domain,
        logo_url=comp_logo,
        insight=comp_insight,
        scanned_at=latest_scan.completed_at or latest_scan.started_at,
        mention_pct=min(round(len(comp_results) / len(all_results) * 100, 1), 100) if all_results else 0,
        total_appearances=len(comp_results),
        total_queries=total_queries,
        beats_brand_count=beats_count,
        brand_wins_count=brand_wins,
        brand_mention_pct=brand_mention_pct,
        both_absent_count=neither_mentioned,
        avg_competitor_position=avg_comp_pos,
        avg_brand_position=avg_brand_pos,
        sentiment_summary=sentiments,
        llm_breakdown=llm_breakdown,
        competitor_profile=comp_profile,
        historical_trend=historical_trend,
        queries=queries_out,
    )
