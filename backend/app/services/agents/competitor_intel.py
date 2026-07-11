"""Competitor Intelligence Agent — analyzes competitors after scans."""
import uuid
import json
import logging
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.services.agents.base import BaseAgent, AgentContext, AgentResult
from app.services.event_bus.broker import EventBus
from app.models.models import Brand, Scan, QueryResult

logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class CompetitorIntelAgent(BaseAgent):
    """Agent that analyzes competitor data from completed scans."""

    name = "competitor_intel"
    description = "Analyzes competitor presence and positioning from scan results"
    system_prompt = (
        "You are a competitor intelligence analyst. After a scan completes, "
        "you analyze which competitors appeared, their positions, and how "
        "they compare to the brand. You identify gaps and opportunities."
    )
    model_key = "chatgpt"

    def __init__(self, event_bus: EventBus):
        super().__init__(event_bus)
        # Subscribe to scan.completed events
        event_bus.subscribe("scans", self._on_scan_completed, name="competitor_intel_handler",
                           event_types=["scan.completed"])

    async def _on_scan_completed(self, event):
        """Handle scan.completed events."""
        scan_id = event.payload.get("scan_id")
        brand_id = event.payload.get("brand_id")
        logger.info("Competitor Intel agent triggered for scan %s (brand %s)", scan_id, brand_id)

        try:
            from app.core.database import AsyncSessionLocal
            async with AsyncSessionLocal() as db:
                result = await self.run(
                    AgentContext(brand_id),
                    brand_id=uuid.UUID(brand_id),
                    scan_id=uuid.UUID(scan_id),
                    db=db,
                )
                if result.success:
                    logger.info("Competitor Intel analysis complete for brand %s", brand_id)
                else:
                    logger.warning("Competitor Intel analysis failed: %s", result.error)
        except Exception as e:
            logger.exception("Competitor Intel agent error: %s", e)

    async def run(self, context: AgentContext, **kwargs) -> AgentResult:
        """Analyze competitor data from a completed scan."""
        brand_id = kwargs.get("brand_id")
        scan_id = kwargs.get("scan_id")
        db = kwargs.get("db")

        if not all([brand_id, scan_id, db]):
            return AgentResult(False, error="brand_id, scan_id, and db required")

        try:
            # Get scan results
            results = await db.execute(
                select(QueryResult).where(QueryResult.scan_id == scan_id)
            )
            all_results = results.scalars().all()

            # Aggregate competitor mentions
            competitor_mentions: dict[str, dict] = {}
            for r in all_results:
                for comp in r.competitors_mentioned:
                    name = comp.get("name", "")
                    if not name:
                        continue
                    if name not in competitor_mentions:
                        competitor_mentions[name] = {"count": 0, "positions": [], "llms": set()}
                    competitor_mentions[name]["count"] += 1
                    if r.position:
                        competitor_mentions[name]["positions"].append(r.position)
                    competitor_mentions[name]["llms"].add(r.llm_name)

            # Build competitor summary
            competitors = []
            for name, data in sorted(competitor_mentions.items(), key=lambda x: x[1]["count"], reverse=True):
                avg_pos = round(sum(data["positions"]) / len(data["positions"]), 1) if data["positions"] else None
                competitors.append({
                    "name": name,
                    "mention_count": data["count"],
                    "avg_position": avg_pos,
                    "llm_coverage": len(data["llms"]),
                })

            # Store analysis in context
            analysis = {
                "scan_id": str(scan_id),
                "analyzed_at": _utcnow().isoformat(),
                "competitors": competitors,
                "total_results": len(all_results),
            }
            context.set("competitor_analysis", analysis)

            # Write agent memory
            from app.services.agents.context_store import set_agent_memory
            notes = f"Analyzed scan {scan_id}: found {len(competitors)} competitors. "
            if competitors:
                top = competitors[0]
                notes += f"Top competitor: {top['name']} ({top['mention_count']} mentions, avg pos {top['avg_position']})."
            await set_agent_memory(db, uuid.UUID(brand_id), self.name, notes)
            await db.commit()

            # Emit event for downstream agents
            await self.event_bus.publish("competitors", "competitors.updated", {
                "brand_id": str(brand_id),
                "scan_id": str(scan_id),
                "competitor_count": len(competitors),
                "top_competitor": competitors[0]["name"] if competitors else None,
            })

            return AgentResult(success=True, output=analysis)
        except Exception as e:
            logger.exception("Competitor Intel analysis failed: %s", e)
            return AgentResult(False, error=str(e))
