"""Recommendations Agent — user-facing chat + quick actions for AI visibility strategy."""
import uuid
import json
import logging
from datetime import datetime, timezone
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.services.agents.base import BaseAgent, AgentContext, AgentResult
from app.services.event_bus.broker import EventBus
from app.models.models import Brand, Scan, QueryResult, ScanStatus, BrandAgentContext

logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _build_brand_brief(brand_name: str, domain: str, scan_results: list, competitors: list[dict]) -> str:
    """Build a context brief about the brand for the agent."""
    mentioned = sum(1 for r in scan_results if r.mentioned)
    total = len(scan_results)
    avg_score = round(sum(r.score or 0 for r in scan_results) / max(total, 1), 1)

    top_comps = sorted(
        [{"name": c.name, "pct": c.mention_pct, "beats": c.beats_you or 0} for c in competitors],
        key=lambda x: x["beats"], reverse=True,
    )[:5]

    comp_text = "\n".join(
        f"  - {c['name']}: appears in {c['pct']}% of responses, beats you in {c['beats']} queries"
        for c in top_comps
    ) or "  No competitors detected yet."

    return (
        f"Brand: {brand_name} ({domain})\n"
        f"Visibility: {mentioned}/{total} mentions, avg score {avg_score}/100\n"
        f"Top competitors:\n{comp_text}\n"
    )


class RecommendationsAgent(BaseAgent):
    """User-facing agent for AI visibility recommendations and strategy."""

    name = "recommendations"
    description = "Provides actionable recommendations for improving AI visibility"
    system_prompt = (
        "You are an AI visibility expert for LLMRank. You help brands improve "
        "how they appear in AI assistant responses (ChatGPT, Claude, Gemini, etc.).\n\n"
        "You have access to the brand's scan data, competitor analysis, and query performance. "
        "Use this data to provide specific, actionable recommendations.\n\n"
        "Guidelines:\n"
        "- Be specific and data-driven. Reference actual numbers.\n"
        "- Prioritize actions by impact. Focus on what will move the needle most.\n"
        "- If a competitor beats the brand, explain WHY (content gap, different positioning, etc.)\n"
        "- Suggest concrete content topics, not vague advice\n"
        "- Keep responses concise but thorough\n"
        "- Use markdown formatting for readability"
    )
    model_key = "claude"  # use the best model for recommendations

    def __init__(self, event_bus: EventBus):
        super().__init__(event_bus)

    async def stream_response(self, brand_id: uuid.UUID, db: AsyncSession,
                              user_message: str, history: list[dict] | None = None) -> AsyncGenerator[str, None]:
        """Stream a response token-by-token via SSE."""
        from app.services.llm_core import MODEL_REGISTRY
        from app.core.config import settings
        import httpx

        # Build context
        brand_result = await db.execute(select(Brand).where(Brand.id == brand_id))
        brand = brand_result.scalar_one_or_none()
        if not brand:
            yield 'data: {"error": "Brand not found"}\n\n'
            return

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

        # Get competitor share
        from app.schemas.schemas import CompetitorShareItem
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
                if r.mentioned and r.position is not None and comp.get("position") is not None:
                    if comp["position"] < r.position:
                        comp_beats[norm] = comp_beats.get(norm, 0) + 1

        total = len(scan_results) or 1
        competitors = [
            CompetitorShareItem(
                name=entry["name"],
                mention_pct=round(entry["count"] / total * 100, 1),
                beats_you=comp_beats.get(norm, 0),
            )
            for norm, entry in comp_counts.items()
        ]

        brief = _build_brand_brief(brand.name, brand.domain, scan_results, competitors)

        # Build messages
        messages = [{"role": "developer", "content": self.system_prompt + f"\n\n{brief}"}]
        if history:
            for msg in history[-6:]:  # last 6 messages for context
                messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})
        messages.append({"role": "user", "content": user_message})

        # Stream via OpenRouter
        model = MODEL_REGISTRY.get(self.model_key, {})
        model_id = model.get("id", "anthropic/claude-sonnet-4.5")

        try:
            async with httpx.AsyncClient(timeout=60) as client:
                async with client.stream(
                    "POST", "https://openrouter.ai/api/v1/chat/completions",
                    headers={"Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
                             "HTTP-Referer": "https://llmrank.dev", "X-Title": "LLMRank"},
                    json={"model": model_id, "messages": messages, "stream": True,
                          "temperature": 0.4, "max_tokens": 2048},
                ) as resp:
                    if resp.status_code != 200:
                        error_body = await resp.aread()
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
                                    yield f"data: {json.dumps({'token': content})}\n\n"
                            except json.JSONDecodeError:
                                continue
        except Exception as e:
            logger.exception("Recommendations streaming failed: %s", e)
            yield f'data: {json.dumps({"error": str(e)})}\n\n'

        yield "data: [DONE]\n\n"

    async def run(self, context: AgentContext, **kwargs) -> AgentResult:
        """Non-streaming single response (for quick actions)."""
        brand_id = kwargs.get("brand_id")
        db = kwargs.get("db")
        message = kwargs.get("message", "")

        if not brand_id or not db:
            return AgentResult(False, error="brand_id and db required")

        # Collect full response
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
