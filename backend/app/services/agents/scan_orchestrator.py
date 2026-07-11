"""Scan Orchestrator Agent — manages the scan lifecycle with ReAct capabilities."""
import uuid
import json
import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text

from app.services.agents.base import BaseAgent, AgentContext, AgentResult
from app.services.agents.tools import Tool
from app.services.event_bus.broker import EventBus
from app.models.models import Brand, MonitoredQuery, Scan, QueryResult, ScanStatus
from app.services.llm_core import scan_all_llms

logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _compute_score(mentioned: bool, position: int | None, sentiment: str) -> float:
    if not mentioned:
        return 5.0
    base = 40.0
    position_bonus = {1: 35, 2: 25, 3: 15, 4: 8}.get(position or 99, 3)
    sentiment_bonus = {"positive": 20, "neutral": 10, "negative": 0}.get(sentiment, 0)
    return round(min(100.0, base + position_bonus + sentiment_bonus), 1)


class ScanOrchestratorAgent(BaseAgent):
    """Agent that orchestrates LLM scans for a brand."""

    name = "scan_orchestrator"
    description = "Runs visibility scans across multiple LLMs for a brand"
    system_prompt = (
        "You are a scan orchestrator. Your job is to run visibility scans "
        "across multiple LLMs and report results. You manage the scan lifecycle "
        "from creation to completion, ensuring all queries are executed and "
        "results are properly scored and stored."
    )
    model_key = "chatgpt"  # cheap model for agent reasoning

    def __init__(self, event_bus: EventBus):
        super().__init__(event_bus)

    async def run(self, context: AgentContext, **kwargs) -> AgentResult:
        """Execute a scan. Expects brand_id, db, llm_names in kwargs."""
        brand_id = kwargs.get("brand_id")
        db = kwargs.get("db")
        llm_names = kwargs.get("llm_names", ["chatgpt", "llama"])
        scan_id = kwargs.get("scan_id")

        if not brand_id or not db:
            return AgentResult(False, error="brand_id and db required")

        try:
            scan = await self._execute_scan(brand_id, db, llm_names, scan_id)
            # Emit scan.completed event
            await self.event_bus.publish("scans", "scan.completed", {
                "scan_id": str(scan.id),
                "brand_id": str(brand_id),
                "visibility_score": scan.visibility_score,
                "mention_rate": scan.mention_rate,
                "llm_names": llm_names,
            })
            # Persist event
            event = await self.event_bus.publish("scans", "scan.completed", {
                "scan_id": str(scan.id), "brand_id": str(brand_id),
                "visibility_score": scan.visibility_score,
            })
            await self.event_bus.persist_event(event)

            return AgentResult(
                success=True,
                output={"scan_id": str(scan.id), "score": scan.visibility_score,
                        "mention_rate": scan.mention_rate},
                metadata={"brand_id": str(brand_id), "llm_count": len(llm_names)},
            )
        except Exception as e:
            logger.exception("Scan agent failed for brand %s", brand_id)
            await self.event_bus.publish("scans", "scan.failed", {
                "brand_id": str(brand_id), "error": str(e),
            })
            return AgentResult(False, error=str(e))

    async def _execute_scan(self, brand_id: uuid.UUID, db: AsyncSession,
                            llm_names: list[str], scan_id: uuid.UUID | None = None) -> Scan:
        """Core scan execution logic — migrated from scan_orchestrator.run_scan."""
        brand_result = await db.execute(select(Brand).where(Brand.id == brand_id))
        brand = brand_result.scalar_one_or_none()
        if not brand:
            raise ValueError(f"Brand {brand_id} not found")

        queries_result = await db.execute(
            select(MonitoredQuery)
            .where(MonitoredQuery.brand_id == brand_id, MonitoredQuery.is_active == True)
        )
        queries = queries_result.scalars().all()
        if not queries:
            raise ValueError("No active queries for this brand")

        # Create or update scan record
        if scan_id:
            scan_result = await db.execute(select(Scan).where(Scan.id == scan_id))
            scan = scan_result.scalar_one_or_none()
            if scan:
                scan.status = ScanStatus.running
                scan.started_at = _utcnow()
            else:
                scan = Scan(id=scan_id, brand_id=brand_id, status=ScanStatus.running, started_at=_utcnow())
                db.add(scan)
        else:
            scan = Scan(id=uuid.uuid4(), brand_id=brand_id, status=ScanStatus.running, started_at=_utcnow())
            db.add(scan)
        await db.flush()

        logger.info("Scan %s: %d queries x %d LLMs = %d calls",
                     scan.id, len(queries), len(llm_names), len(queries) * len(llm_names))

        # Keepalive ping
        stop_event = asyncio.Event()
        keepalive_task = asyncio.create_task(self._keepalive_ping(db, scan.id, stop_event))

        # Fire all LLMs concurrently
        import httpx
        async with httpx.AsyncClient(timeout=45) as client:
            raw_results = await scan_all_llms(
                [(str(q.id), q.query_text) for q in queries], llm_names, client,
            )

        stop_event.set()
        keepalive_task.cancel()
        try:
            await keepalive_task
        except asyncio.CancelledError:
            pass

        # Process results
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
                score = _compute_score(mentioned, position, sentiment)

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

        visibility_score = round(sum(total_scores) / len(total_scores), 1) if total_scores else 0.0
        mention_rate = round((total_mentioned / total_successful) * 100, 1) if total_successful > 0 else 0.0

        scan.visibility_score = visibility_score
        scan.mention_rate = mention_rate
        scan.status = ScanStatus.completed
        scan.completed_at = _utcnow()

        logger.info("Scan %s: score=%.1f mention_rate=%.1f successful=%d/%d",
                     scan.id, visibility_score, mention_rate, total_successful, len(all_results))
        await db.commit()
        await db.refresh(scan)
        return scan

    async def _keepalive_ping(self, db: AsyncSession, scan_id: uuid.UUID, stop_event: asyncio.Event):
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
