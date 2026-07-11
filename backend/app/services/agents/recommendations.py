"""Recommendations Agent — user-facing chat + quick actions for AI visibility strategy."""
import re
import uuid
import json
import logging
from datetime import datetime, timezone
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.services.agents.base import BaseAgent, AgentContext, AgentResult
from app.services.event_bus.broker import EventBus
from app.models.models import Brand, MonitoredQuery, Scan, QueryResult, ScanStatus

logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _build_full_context(brand: Brand, queries: list, scan_results: list, competitors: dict) -> str:
    """Build a detailed context with actual data the LLM can reference."""
    lines = [f"## Brand: {brand.name} ({brand.domain})"]

    # Per-query performance
    lines.append("\n## Monitored Queries and Their Performance")
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

            # Which LLMs mentioned vs didn't
            mentioned_llms = [r.llm_name for r in q_results if r.mentioned]
            not_mentioned_llms = [r.llm_name for r in q_results if not r.mentioned]

            # Competitors that beat the brand on this query
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
    if not competitors:
        lines.append("No competitor data yet.")
    else:
        for name, data in sorted(competitors.items(), key=lambda x: x[1]["beats"], reverse=True):
            lines.append(f"- {name}: mentioned in {data['pct']}% of results, beats you in {data['beats']} queries, avg position #{data.get('avg_pos', 'N/A')}")

    # Overall stats
    mentioned = sum(1 for r in scan_results if r.mentioned)
    total = len(scan_results) or 1
    lines.append(f"\n## Overall: {mentioned}/{total} mentions ({round(mentioned/total*100, 1)}%)")

    return "\n".join(lines)


class RecommendationsAgent(BaseAgent):
    """User-facing agent for AI visibility recommendations and strategy."""

    name = "recommendations"
    description = "Provides actionable recommendations for improving AI visibility"
    system_prompt = (
        "You are lai, the AI visibility copilot inside LLMRank. "
        "You talk like a smart friend who actually knows this stuff, not a consultant "
        "reading from a slide deck. Think: someone scribbling notes in a notebook, "
        "then turning to you and saying what matters.\n\n"
        "You have REAL data about this brand below. Every query, number, and competitor "
        "name is pulled straight from their scan results.\n\n"
        "CRITICAL RULES:\n"
        "- NEVER assume or guess what the brand's features, products, or value propositions are. "
        "You do NOT know what this brand does beyond what is in the data below.\n"
        "- NEVER say things like 'If you have X feature...' or 'If your product does Y...'. "
        "You don't know. Only reference what is explicitly in the data.\n"
        "- ONLY use the brand name, domain, queries, scan results, and competitor data provided.\n"
        "- If the user asks about their product features, say you don't have that information "
        "and suggest they focus on the visibility data you DO have.\n\n"
        "HOW TO TALK:\n"
        "- Match the user's energy. If they ask a quick question, give a quick answer. "
        "If they want depth, go deep.\n"
        "- Be direct. No filler like 'Great question!' or 'I'd be happy to help!'\n"
        "- Use the actual data. Quote real query texts, real percentages, real positions.\n"
        "- When something is bad, say it's bad. When something is working, say so.\n"
        "- Give specific next steps, not vague advice like 'improve your content'\n"
        "- No emojis. No em dashes. No corporate jargon. Write like a human.\n"
        "- Use markdown when it helps (headers, bullet points, bold for emphasis)\n"
        "- Use newlines SPARINGLY. One blank line between sections, never more. "
        "Dense responses feel more natural than spaced-out ones.\n"
        "- If you don't have data for something, say so. Don't make it up."
    )
    model_key = "claude"

    def __init__(self, event_bus: EventBus):
        super().__init__(event_bus)

    async def _build_context(self, brand_id: uuid.UUID, db: AsyncSession) -> str:
        """Fetch ALL real data and build context for the LLM."""
        brand_result = await db.execute(select(Brand).where(Brand.id == brand_id))
        brand = brand_result.scalar_one_or_none()
        if not brand:
            return "Brand not found."

        # Get ALL queries (active)
        queries_result = await db.execute(
            select(MonitoredQuery)
            .where(MonitoredQuery.brand_id == brand_id, MonitoredQuery.is_active == True)
            .order_by(MonitoredQuery.created_at)
        )
        queries = queries_result.scalars().all()

        # Get latest scan results
        scan_result = await db.execute(
            select(Scan).where(Scan.brand_id == brand_id, Scan.status == ScanStatus.completed)
            .order_by(Scan.completed_at.desc()).limit(1)
        )
        latest_scan = scan_result.scalar_one_or_none()

        scan_results = []
        if latest_scan:
            results = await db.execute(
                select(QueryResult).where(QueryResult.scan_id == latest_scan.id)
            )
            scan_results = results.scalars().all()

        # Build competitor data
        comp_counts: dict[str, dict] = {}
        comp_beats: dict[str, int] = {}
        comp_positions: dict[str, list] = {}
        for r in scan_results:
            for comp in (r.competitors_mentioned or []):
                name = comp.get("name", "")
                if not name:
                    continue
                norm = name.lower().strip()
                if norm not in comp_counts:
                    comp_counts[norm] = {"name": name, "count": 0, "pct": 0}
                comp_counts[norm]["count"] += 1
                comp_positions.setdefault(norm, [])
                if r.mentioned and r.position is not None and comp.get("position") is not None:
                    comp_positions[norm].append(comp["position"])
                    if comp["position"] < r.position:
                        comp_beats[norm] = comp_beats.get(norm, 0) + 1

        total = len(scan_results) or 1
        competitors = {}
        for norm, entry in comp_counts.items():
            positions = comp_positions.get(norm, [])
            avg_pos = round(sum(positions) / len(positions), 1) if positions else None
            competitors[entry["name"]] = {
                "pct": round(entry["count"] / total * 100, 1),
                "beats": comp_beats.get(norm, 0),
                "avg_pos": avg_pos,
            }

        return _build_full_context(brand, queries, scan_results, competitors)

    async def stream_response(self, brand_id: uuid.UUID, db: AsyncSession,
                              user_message: str, history: list[dict] | None = None) -> AsyncGenerator[str, None]:
        """Stream a response token-by-token via SSE with real data context."""
        from app.services.llm_core import MODEL_REGISTRY
        from app.core.config import settings
        import httpx

        # Build FULL context with real data
        context = await self._build_context(brand_id, db)

        # Build messages
        messages = [{"role": "developer", "content": self.system_prompt + f"\n\n## Actual Brand Data\n\n{context}"}]
        if history:
            for msg in history[-6:]:
                messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})
        messages.append({"role": "user", "content": user_message})

        model = MODEL_REGISTRY.get(self.model_key, {})
        model_id = model.get("id", "anthropic/claude-sonnet-4.5")

        try:
            async with httpx.AsyncClient(timeout=60) as client:
                newline_buffer = ""
                async with client.stream(
                    "POST", "https://openrouter.ai/api/v1/chat/completions",
                    headers={"Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
                             "HTTP-Referer": "https://llmrank.dev", "X-Title": "LLMRank"},
                    json={"model": model_id, "messages": messages, "stream": True,
                          "temperature": 0.5, "max_tokens": 2048},
                ) as resp:
                    if resp.status_code != 200:
                        yield f'data: {json.dumps({"error": f"LLM error: {resp.status_code}"})}\n\n'
                        return
                    async for line in resp.aiter_lines():
                        if line.startswith("data: "):
                            data = line[6:]
                            if data.strip() == "[DONE]":
                                break
                            try:
                                chunk = json.loads(data)
                                delta = chunk.get("choices", [{}])[0].get("delta", {})
                                content = delta.get("content", "")
                                if content:
                                    # Strip excessive newlines: max 2 consecutive
                                    newline_buffer += content
                                    if "\n\n\n" in newline_buffer:
                                        newline_buffer = re.sub(r"\n{3,}", "\n\n", newline_buffer)
                                    # Flush if we have non-newline content or enough newlines
                                    if newline_buffer and (not content.isspace() or newline_buffer.count("\n") <= 2):
                                        clean = re.sub(r"\n{3,}", "\n\n", newline_buffer)
                                        if clean:
                                            yield f"data: {json.dumps({'token': clean})}\n\n"
                                        newline_buffer = ""
                            except json.JSONDecodeError:
                                continue
                    # Flush remaining buffer
                    if newline_buffer.strip():
                        clean = re.sub(r"\n{3,}", "\n\n", newline_buffer)
                        if clean:
                            yield f"data: {json.dumps({'token': clean})}\n\n"
        except Exception as e:
            logger.exception("Recommendations streaming failed: %s", e)
            yield f'data: {json.dumps({"error": str(e)})}\n\n'

        yield "data: [DONE]\n\n"

    async def run(self, context: AgentContext, **kwargs) -> AgentResult:
        """Non-streaming single response."""
        brand_id = kwargs.get("brand_id")
        db = kwargs.get("db")
        message = kwargs.get("message", "")

        if not brand_id or not db:
            return AgentResult(False, error="brand_id and db required")

        full_response = ""
        async for chunk in self.stream_response(brand_id, db, message):
            if chunk.startswith("data: ") and chunk.strip() != "data: [DONE]":
                try:
                    data = json.loads(chunk[6:])
                    if "token" in data:
                        full_response += data["token"]
                except json.JSONDecodeError:
                    pass

        return AgentResult(success=True, output=full_response)
