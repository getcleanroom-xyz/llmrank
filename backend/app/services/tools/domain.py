"""Domain tools — domain-specific computation for agents."""
import uuid
import json
import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


def compute_visibility_score(mentioned: bool, position: int | None = None,
                             sentiment: str = "not_mentioned") -> float:
    """Compute a visibility score (0-100) for a query result.

    Scoring:
    - Not mentioned: 5.0 (baseline)
    - Mentioned: base 40 + position bonus + sentiment bonus
    """
    if not mentioned:
        return 5.0

    base = 40.0
    position_bonus = {1: 35, 2: 25, 3: 15, 4: 8}.get(position or 99, 3)
    sentiment_bonus = {"positive": 20, "neutral": 10, "negative": 0}.get(sentiment, 0)
    return round(min(100.0, base + position_bonus + sentiment_bonus), 1)


def extract_competitors_from_text(text: str, brand_name: str) -> list[str]:
    """Extract competitor names from LLM response text.

    Uses simple heuristics — not perfect but fast.
    """
    brand_lower = brand_name.lower()
    competitors = set()

    # Common patterns in LLM responses
    # "X, Y, and Z are popular..."
    # "Companies like X and Y..."
    lines = text.split("\n")
    for line in lines:
        line_lower = line.lower()
        # Skip lines that are clearly about the brand
        if brand_lower in line_lower:
            continue
        # Extract capitalized words that look like brand names
        import re
        # Match patterns like "BrandName" or "Brand Name" (2-3 capitalized words)
        matches = re.findall(r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b', line)
        for m in matches:
            if m.lower() != brand_lower and len(m) > 2:
                competitors.add(m)

    return list(competitors)[:20]


async def build_brand_context(brand_id: str, db: AsyncSession | None = None) -> str:
    """Build a detailed context string with brand data for LLM consumption.

    Returns a formatted string with brand info, query performance,
    competitor data, and overall stats.
    """
    from app.core.database import AsyncSessionLocal
    from app.models.models import Brand, MonitoredQuery, Scan, QueryResult, ScanStatus

    async def _execute(session: AsyncSession):
        brand_result = await session.execute(
            Brand.active().where(Brand.id == uuid.UUID(brand_id))
        )
        brand = brand_result.scalar_one_or_none()
        if not brand:
            return "Brand not found."

        # Get active queries
        queries_result = await session.execute(
            select(MonitoredQuery)
            .where(MonitoredQuery.brand_id == uuid.UUID(brand_id), MonitoredQuery.is_active == True)
            .order_by(MonitoredQuery.created_at)
        )
        queries = queries_result.scalars().all()

        # Get latest scan
        scan_result = await session.execute(
            select(Scan)
            .where(Scan.brand_id == uuid.UUID(brand_id), Scan.status == ScanStatus.completed)
            .order_by(Scan.completed_at.desc())
            .limit(1)
        )
        latest_scan = scan_result.scalar_one_or_none()

        scan_results = []
        if latest_scan:
            results = await session.execute(
                select(QueryResult).where(QueryResult.scan_id == latest_scan.id)
            )
            scan_results = results.scalars().all()

        # Build context
        lines = [f"## Brand: {brand.name} ({brand.domain})"]

        # Query performance
        lines.append("\n## Monitored Queries and Their Performance")
        lines.append(
            "These queries are auto-generated questions that real users might ask an AI assistant "
            "when researching products in this category. They simulate what people say BEFORE they "
            "know about any specific brand. The purpose is to test whether LLMs mention this brand "
            "when users ask general category questions — not to rank for branded search terms."
        )
        if not queries:
            lines.append("No queries configured yet.")
        else:
            for q in queries:
                q_results = [r for r in scan_results if str(r.query_id) == str(q.id)]
                if not q_results:
                    lines.append(f"- \"{q.query_text}\" — NOT YET SCANNED")
                    continue

                mentioned_in = sum(1 for r in q_results if r.mentioned)
                total_llms = len(q_results)
                avg_score = round(sum(r.score or 0 for r in q_results) / max(len(q_results), 1), 1)
                positions = [r.position for r in q_results if r.mentioned and r.position]
                avg_pos = round(sum(positions) / len(positions), 1) if positions else None

                sentiment_dist = {}
                for r in q_results:
                    s = r.sentiment.value if hasattr(r.sentiment, "value") else r.sentiment
                    sentiment_dist[s] = sentiment_dist.get(s, 0) + 1

                mentioned_llms = [r.llm_name for r in q_results if r.mentioned]
                not_mentioned_llms = [r.llm_name for r in q_results if not r.mentioned]

                beat_by = []
                for r in q_results:
                    for comp in (r.competitors_mentioned or []):
                        comp_pos = comp.get("position")
                        if comp_pos and r.position and comp_pos < r.position:
                            beat_by.append(f"{comp['name']} (#{comp_pos})")
                beat_by = list(set(beat_by))

                lines.append(f"- \"{q.query_text}\"")
                lines.append(f"  Score: {avg_score}/100 | Mentioned in: {mentioned_in}/{total_llms} LLMs | Avg position: #{avg_pos or 'N/A'}")
                lines.append(f"  Mentioned by: {', '.join(mentioned_llms) if mentioned_llms else 'none'}")
                if not_mentioned_llms:
                    lines.append(f"  NOT mentioned by: {', '.join(not_mentioned_llms)}")
                if beat_by:
                    lines.append(f"  BEATEN BY: {', '.join(beat_by)}")
                lines.append(f"  Sentiment: {json.dumps(sentiment_dist)}")

        # Competitor breakdown
        lines.append("\n## Competitor Performance")
        comp_counts: dict[str, dict] = {}
        comp_beats: dict[str, int] = {}
        for r in scan_results:
            for comp in (r.competitors_mentioned or []):
                name = comp.get("name", "")
                if not name:
                    continue
                norm = name.lower().strip()
                if norm not in comp_counts:
                    comp_counts[norm] = {"name": name, "count": 0}
                comp_counts[norm]["count"] += 1
                if r.mentioned and r.position and comp.get("position") and comp["position"] < r.position:
                    comp_beats[norm] = comp_beats.get(norm, 0) + 1

        if not comp_counts:
            lines.append("No competitor data yet.")
        else:
            total = len(scan_results) or 1
            for norm, entry in sorted(comp_counts.items(), key=lambda x: x[1]["count"], reverse=True):
                pct = round(entry["count"] / total * 100, 1)
                beats = comp_beats.get(norm, 0)
                lines.append(f"- {entry['name']}: mentioned in {pct}% of results, beats you in {beats} queries")

        # Overall stats
        mentioned = sum(1 for r in scan_results if r.mentioned)
        total = len(scan_results) or 1
        lines.append(f"\n## Overall: {mentioned}/{total} mentions ({round(mentioned/total*100, 1)}%)")

        return "\n".join(lines)

    if db:
        return await _execute(db)

    async with AsyncSessionLocal() as session:
        return await _execute(session)
