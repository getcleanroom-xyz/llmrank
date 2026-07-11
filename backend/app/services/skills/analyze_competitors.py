"""Analyze Competitors skill — analyze competitor presence from scan results."""
import uuid
import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.tools.event import emit_event
from app.services.tools.memory import store_memory

logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


async def analyze_competitors(brand_id: str, scan_id: str,
                               agent_name: str = "competitor_intel",
                               db: AsyncSession | None = None) -> dict:
    """Analyze competitor data from a completed scan.

    Steps:
    1. Get all query results from the scan
    2. Aggregate competitor mentions, positions, LLM coverage
    3. Store analysis in agent memory
    4. Emit competitors.updated event

    Returns: {competitors: [...], total_results: int}
    """
    from app.core.database import AsyncSessionLocal
    from app.models.models import QueryResult

    async def _execute(session: AsyncSession):
        # 1. Get scan results
        results = await session.execute(
            select(QueryResult).where(QueryResult.scan_id == uuid.UUID(scan_id))
        )
        all_results = results.scalars().all()

        # 2. Aggregate competitor mentions
        competitor_mentions: dict[str, dict] = {}
        for r in all_results:
            for comp in r.competitors_mentioned:
                name = comp.get("name", "")
                if not name:
                    continue
                if name not in competitor_mentions:
                    competitor_mentions[name] = {
                        "count": 0, "positions": [], "llms": set()
                    }
                competitor_mentions[name]["count"] += 1
                if r.position:
                    competitor_mentions[name]["positions"].append(r.position)
                competitor_mentions[name]["llms"].add(r.llm_name)

        # Build competitor summary
        competitors = []
        for name, data in sorted(competitor_mentions.items(),
                                  key=lambda x: x[1]["count"], reverse=True):
            avg_pos = (
                round(sum(data["positions"]) / len(data["positions"]), 1)
                if data["positions"] else None
            )
            competitors.append({
                "name": name,
                "mention_count": data["count"],
                "avg_position": avg_pos,
                "llm_coverage": len(data["llms"]),
            })

        # 3. Store analysis in memory
        notes = f"Analyzed scan {scan_id}: found {len(competitors)} competitors."
        if competitors:
            top = competitors[0]
            notes += f" Top: {top['name']} ({top['mention_count']} mentions, avg pos {top['avg_position']})."

        await store_memory(agent_name, brand_id, notes, db=session)

        # 4. Emit event
        await emit_event("competitors", "competitors.updated", {
            "brand_id": brand_id,
            "scan_id": scan_id,
            "competitor_count": len(competitors),
            "top_competitor": competitors[0]["name"] if competitors else None,
        }, agent_name=agent_name)

        return {
            "competitors": competitors,
            "total_results": len(all_results),
        }

    if db:
        result = await _execute(db)
        await db.commit()
        return result

    async with AsyncSessionLocal() as session:
        result = await _execute(session)
        await session.commit()
        return result
