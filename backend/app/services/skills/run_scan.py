"""Run Scan skill — full visibility scan lifecycle."""
import uuid
import json
import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.tools.db import read_model, query_db, write_model, count_records
from app.services.tools.llm import call_llm
from app.services.tools.event import emit_event
from app.services.tools.domain import compute_visibility_score

logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


async def run_scan(brand_id: str, scan_id: str, llm_names: list[str],
                   agent_name: str = "scan_orchestrator") -> dict:
    """Execute a full visibility scan for a brand.

    Steps:
    1. Get brand info and active queries
    2. Call each LLM with each query
    3. Score and process results
    4. Store results in database
    5. Emit scan.completed event

    Returns: {scan_id, score, mention_rate, successful, total}
    """
    from app.core.database import AsyncSessionLocal
    from app.models.models import (
        Brand, MonitoredQuery, Scan, QueryResult, ScanStatus
    )
    from app.services.llm_core import scan_all_llms

    async with AsyncSessionLocal() as db:
        # 1. Get brand
        brand_result = await db.execute(select(Brand).where(Brand.id == uuid.UUID(brand_id)))
        brand = brand_result.scalar_one_or_none()
        if not brand:
            raise ValueError(f"Brand {brand_id} not found")

        # 2. Get active queries
        queries_result = await db.execute(
            select(MonitoredQuery)
            .where(MonitoredQuery.brand_id == uuid.UUID(brand_id), MonitoredQuery.is_active == True)
        )
        queries = queries_result.scalars().all()
        if not queries:
            raise ValueError("No active queries for this brand")

        # 3. Get or create scan
        scan_uuid = uuid.UUID(scan_id) if scan_id else uuid.uuid4()
        scan_result = await db.execute(select(Scan).where(Scan.id == scan_uuid))
        scan = scan_result.scalar_one_or_none()
        if scan:
            scan.status = ScanStatus.running
            scan.started_at = _utcnow()
        else:
            scan = Scan(id=scan_uuid, brand_id=uuid.UUID(brand_id), status=ScanStatus.running, started_at=_utcnow())
            db.add(scan)
        await db.flush()

        logger.info("Scan %s: %d queries x %d LLMs = %d calls",
                     scan.id, len(queries), len(llm_names), len(queries) * len(llm_names))

        # 4. Fire all LLMs concurrently
        import httpx
        async with httpx.AsyncClient(timeout=45) as client:
            raw_results = await scan_all_llms(
                [(str(q.id), q.query_text) for q in queries], llm_names, client,
            )

        # 5. Process results
        all_results = []
        total_scores = []
        total_mentioned = 0
        total_successful = 0

        for q_id, llm_name, result_data, error in raw_results:
            if error or not result_data:
                result = QueryResult(
                    id=uuid.uuid4(), scan_id=scan.id,
                    query_id=uuid.UUID(q_id), llm_name=llm_name,
                    raw_response=f"[Error: {error}]" if error else "[Empty response]",
                    mentioned=False, position=None, sentiment="not_mentioned",
                    competitors_mentioned=[], annotated_response=None, score=None,
                )
            else:
                mentioned = result_data.get("brand_mentioned", False)
                position = result_data.get("brand_position")
                sentiment = result_data.get("brand_sentiment", "not_mentioned")
                if sentiment not in ("positive", "neutral", "negative", "not_mentioned"):
                    sentiment = "not_mentioned"
                comps_raw = result_data.get("competitors", [])
                brand_lower = brand.name.lower()
                competitors = [{"name": c} for c in comps_raw
                              if isinstance(c, str) and c.lower() != brand_lower and
                              c.lower() != brand.domain.split(".")[0]]
                score = compute_visibility_score(mentioned, position, sentiment)

                result = QueryResult(
                    id=uuid.uuid4(), scan_id=scan.id,
                    query_id=uuid.UUID(q_id), llm_name=llm_name,
                    raw_response=result_data.get("summary", json.dumps(result_data)),
                    mentioned=mentioned, position=position, sentiment=sentiment,
                    competitors_mentioned=competitors, annotated_response=None, score=score,
                )

            all_results.append(result)
            if not error and result_data:
                total_successful += 1
                if result.mentioned:
                    total_mentioned += 1
                if result.score is not None:
                    total_scores.append(result.score)

        db.add_all(all_results)

        # Log per-LLM breakdown
        llm_stats: dict[str, dict] = {}
        for r in all_results:
            if r.llm_name not in llm_stats:
                llm_stats[r.llm_name] = {"total": 0, "mentioned": 0, "errors": 0}
            llm_stats[r.llm_name]["total"] += 1
            if r.mentioned:
                llm_stats[r.llm_name]["mentioned"] += 1
            if r.raw_response.startswith("[Error") or r.raw_response.startswith("[Empty"):
                llm_stats[r.llm_name]["errors"] += 1

        for llm, stats in sorted(llm_stats.items()):
            logger.info("Scan %s LLM %s: %d/%d mentioned, %d errors",
                         scan.id, llm, stats["mentioned"], stats["total"], stats["errors"])

        visibility_score = round(sum(total_scores) / len(total_scores), 1) if total_scores else 0.0
        mention_rate = round((total_mentioned / total_successful) * 100, 1) if total_successful > 0 else 0.0

        scan.visibility_score = visibility_score
        scan.mention_rate = mention_rate
        scan.status = ScanStatus.completed
        scan.completed_at = _utcnow()

        logger.info("Scan %s: score=%.1f mention_rate=%.1f successful=%d/%d",
                     scan.id, visibility_score, mention_rate, total_successful, len(all_results))
        await db.commit()

        # 6. Emit event
        await emit_event("scans", "scan.completed", {
            "scan_id": str(scan.id),
            "brand_id": brand_id,
            "visibility_score": visibility_score,
            "mention_rate": mention_rate,
            "llm_names": llm_names,
        }, agent_name=agent_name)

        return {
            "scan_id": str(scan.id),
            "score": visibility_score,
            "mention_rate": mention_rate,
            "successful": total_successful,
            "total": len(all_results),
        }


async def keepalive_ping(db: AsyncSession, scan_id: uuid.UUID, stop_event: asyncio.Event):
    """Keepalive ping during long scan operations."""
    from sqlalchemy import text
    while not stop_event.is_set():
        try:
            await asyncio.wait_for(stop_event.wait(), timeout=30)
        except asyncio.TimeoutError:
            pass
        if stop_event.is_set():
            break
        try:
            await db.execute(text("SELECT 1"))
        except Exception:
            logger.warning("Keepalive ping failed for scan %s", scan_id)
            break
