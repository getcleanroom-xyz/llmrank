import uuid
import logging
import re
import asyncio
import json
from datetime import datetime, timezone
from typing import AsyncGenerator

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.core.database import get_db
from app.core.config import settings
from app.core.rate_limit import limiter
from app.models.models import User, Brand, MonitoredQuery, Scan, QueryResult, ScanStatus
from app.schemas.schemas import BrandOut, ScanCreate, ScanOut, QuerySummary
from app.services.scan_orchestrator import generate_query_suggestions
from app.services.credit_service import check_credits, deduct_credits
from app.api.auth import get_current_user

router = APIRouter()
logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    """Return naive UTC datetime compatible with TIMESTAMP WITHOUT TIME ZONE columns."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _normalize_competitor(name: str) -> str:
    """Normalize competitor name for fuzzy matching (ignore spaces, hyphens, underscores, case)."""
    return re.sub(r'[\s\-_\.]+', '', name).lower()


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
        logger.info("No queries for brand %s, auto-generating via Query Gen agent", brand_id)
        from app.services.agents.registry import agent_registry
        from app.services.agents.context_store import AgentContext
        ctx = AgentContext(str(brand_id))
        gen_result = await agent_registry.query_gen.run(ctx, brand_id=brand_id, db=db, mode="generate")

        # Re-fetch after agent runs
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
    """Background task — runs scan via the Scan Orchestrator Agent."""
    from app.core.database import AsyncSessionLocal
    from app.services.agents.context_store import AgentContext
    from app.services.agents.registry import agent_registry
    logger.info("Background scan started: scan_id=%s brand_id=%s llms=%s", scan_id, brand_id, llm_names)
    async with AsyncSessionLocal() as db:
        try:
            ctx = AgentContext(str(brand_id))
            result = await agent_registry.scan_orchestrator.run(
                ctx, brand_id=brand_id, db=db, llm_names=llm_names, scan_id=scan_id,
            )
            if result.success:
                logger.info("Background scan completed: scan_id=%s", scan_id)
            else:
                logger.error("Background scan failed: scan_id=%s error=%s", scan_id, result.error)
                # Mark scan as failed and refund credits
                scan_result = await db.execute(select(Scan).where(Scan.id == scan_id))
                scan = scan_result.scalar_one_or_none()
                if scan:
                    scan.status = ScanStatus.failed
                    scan.completed_at = _utcnow()
                    await db.commit()
                from app.services.credit_service import grant_credits
                from app.models.models import CreditTransaction
                tx_result = await db.execute(
                    select(CreditTransaction)
                    .where(CreditTransaction.description.ilike(f"%Scan: %{scan_id}%"))
                    .order_by(CreditTransaction.created_at.desc()).limit(1)
                )
                last_tx = tx_result.scalar_one_or_none()
                if last_tx and last_tx.amount < 0:
                    brand_result = await db.execute(select(Brand).where(Brand.id == brand_id))
                    brand = brand_result.scalar_one_or_none()
                    if brand:
                        await grant_credits(db, abs(last_tx.amount), f"Refund: failed scan {scan_id}", "refund", brand.owner_id)
                        await db.commit()
        except Exception as e:
            logger.exception("Background scan failed: scan_id=%s error=%s", scan_id, e)


@router.get("/brands/{brand_id}/scans", response_model=list[ScanOut], tags=["Scans"])
async def list_scans(
    brand_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    page: int = 1,
    per_page: int = 20,
):
    brand_result = await db.execute(select(Brand).where(Brand.id == brand_id, Brand.owner_id == user.id))
    if not brand_result.scalar_one_or_none():
        raise HTTPException(404, "Brand not found")
    result = await db.execute(
        select(Scan)
        .where(Scan.brand_id == brand_id)
        .order_by(desc(Scan.started_at))
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    return result.scalars().all()


@router.get("/brands/{brand_id}/scans/{scan_id}", response_model=ScanOut, tags=["Scans"])
async def get_scan(brand_id: uuid.UUID, scan_id: uuid.UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    brand_result = await db.execute(select(Brand).where(Brand.id == brand_id, Brand.owner_id == user.id))
    if not brand_result.scalar_one_or_none():
        raise HTTPException(404, "Brand not found")
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

    # Batch-fetch all query texts to avoid N+1
    qids = list(query_map.keys())
    mq_result = await db.execute(select(MonitoredQuery).where(MonitoredQuery.id.in_(qids)))
    mq_map = {mq.id: mq for mq in mq_result.scalars().all()}

    # Build query summaries with results
    summaries = []
    for qid, qr_list in query_map.items():
        mq = mq_map.get(qid)
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
                try:
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
                except asyncio.CancelledError:
                    break
                except Exception as e:
                    logger.warning("SSE poll error for scan %s: %s", scan_id, e)
                    break

    return StreamingResponse(event_generator(), media_type="text/event-stream")
