import uuid
import logging
import re
import asyncio
import json
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func

from app.core.database import get_db
from app.core.config import settings
from app.core.rate_limit import limiter
from app.models.models import User, Brand, MonitoredQuery, Scan, QueryResult, ScanStatus
from app.schemas.schemas import (
    QueryCreate, QueryOut, QuerySuggestRequest, QuerySuggestResponse,
    QueryTableItem, QueryTableResponse,
    ScanCreate, ScanOut, BrandOut,
)
from app.services.llm_adapters import scan_all_llms, scan_query, OpenRouterAdapter, _call_openrouter, _parse_json, SCAN_DEVELOPER
from app.api.auth import get_current_user

router = APIRouter()
logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    """Return naive UTC datetime compatible with TIMESTAMP WITHOUT TIME ZONE columns."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


# ─── Queries ───────────────────────────────────────────────────────────────────

@router.get("/brands/{brand_id}/queries", response_model=list[QueryOut], tags=["Queries"])
async def list_queries(brand_id: uuid.UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    brand_result = await db.execute(select(Brand).where(Brand.id == brand_id, Brand.owner_id == user.id))
    if not brand_result.scalar_one_or_none():
        raise HTTPException(404, "Brand not found")
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
    from app.services.agents.registry import agent_registry
    result = await agent_registry.query_gen.suggest(brand, [c.get("name", "") for c in (brand.competitors or [])])
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
    from app.services.agents.registry import agent_registry
    return await agent_registry.query_gen.probe(brand)


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
