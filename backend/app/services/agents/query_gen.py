"""Query Gen Agent — manages query lifecycle: generate, score, prune, refresh."""
import uuid
import json
import logging
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.services.agents.base import BaseAgent, AgentContext, AgentResult
from app.services.event_bus.broker import EventBus
from app.models.models import Brand, MonitoredQuery, Scan, QueryResult, ScanStatus

logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


async def _generate_queries_llm(brand_name: str, domain: str, crawl_content: str,
                                 classification: dict, competitors: list[dict]) -> list[dict]:
    """Generate scored queries using LLM. Wraps query_generator logic."""
    from app.services.llm_core import _call_openrouter, _parse_json

    comp_str = ", ".join(c.get("name", "") for c in competitors[:8])
    prompt = (
        f"A person who doesn't know about {brand_name} is looking for solutions in the "
        f"{classification.get('sub_category', classification.get('industry', ''))} space.\n"
        f"They haven't discovered any brand yet. They're exploring their options.\n"
        f"What questions would they ask an AI assistant like ChatGPT?\n\n"
        f"Company context: {brand_name} ({domain})\n"
        f"Industry: {classification.get('industry', '')}\n"
        f"Known alternatives: {comp_str}\n\n"
        f"Generate 20 natural, conversational questions people type into ChatGPT.\n"
        f"Avoid 'best X tool' or 'X alternatives'. Be specific and scenario-based.\n"
        f"Do NOT include the brand name {brand_name}.\n"
        f'Return ONLY a valid JSON array: [{{"query_text":"...","query_type":"workflow","score":1-5}}]\n'
        f"No text, no markdown."
    )

    messages = [
        {"role": "developer", "content": (
            "You are a UX researcher simulating real users. Generate conversational questions "
            "people ask AI when researching products. Return ONLY a valid JSON array."
        )},
        {"role": "user", "content": prompt},
    ]

    for model in ["chatgpt", "llama"]:
        try:
            import httpx
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await _call_openrouter(messages, model, client, temperature=0.6, max_tokens=2048)
            result = _parse_json(resp)
            if isinstance(result, list) and len(result) >= 5:
                for q in result:
                    q["score"] = max(1, min(5, int(q.get("score", 3))))
                    q["query_type"] = q.get("query_type", "brand_category")
                result.sort(key=lambda q: q.get("score", 0), reverse=True)
                return result[:20]
        except Exception as e:
            logger.warning("Query generation failed with %s: %s", model, e)
    return []


async def _score_queries_from_scans(db: AsyncSession, brand_id: uuid.UUID) -> list[dict]:
    """Score existing queries based on scan performance."""
    result = await db.execute(
        select(MonitoredQuery)
        .where(MonitoredQuery.brand_id == brand_id, MonitoredQuery.is_active == True)
    )
    queries = result.scalars().all()

    scored = []
    for q in queries:
        # Get latest scan results for this query
        latest_result = await db.execute(
            select(QueryResult)
            .join(Scan, QueryResult.scan_id == Scan.id)
            .where(QueryResult.query_id == q.id, Scan.status == ScanStatus.completed)
            .order_by(Scan.completed_at.desc())
            .limit(1)
        )
        latest = latest_result.scalar_one_or_none()

        if latest:
            # Score based on: mentioned, position, sentiment
            score = 3  # default
            if latest.mentioned:
                score = 5 if (latest.position or 99) <= 2 else 4 if (latest.position or 99) <= 4 else 3
            else:
                score = 1 if latest.score is not None and latest.score < 10 else 2
        else:
            score = q.query_score or 3

        scored.append({
            "query_id": str(q.id),
            "query_text": q.query_text,
            "score": score,
            "last_scanned": latest.created_at.isoformat() if latest else None,
        })

    scored.sort(key=lambda x: x["score"])
    return scored


async def _prune_queries(db: AsyncSession, brand_id: uuid.UUID,
                          scored: list[dict], min_score: int = 2) -> list[str]:
    """Deactivate queries with persistently low scores. Returns pruned query texts."""
    pruned = []
    for item in scored:
        if item["score"] < min_score:
            result = await db.execute(
                select(MonitoredQuery).where(MonitoredQuery.id == uuid.UUID(item["query_id"]))
            )
            q = result.scalar_one_or_none()
            if q and q.is_active:
                q.is_active = False
                pruned.append(item["query_text"])
    if pruned:
        await db.flush()
    return pruned


class QueryGenAgent(BaseAgent):
    """Agent that manages query lifecycle for a brand."""

    name = "query_gen"
    description = "Generates, scores, and prunes search queries for AI visibility scans"
    system_prompt = (
        "You are a query generation specialist. Your job is to create, evaluate, "
        "and manage search queries that people would type into AI assistants. "
        "You generate scenario-based questions, score them based on scan performance, "
        "and prune low-performing queries."
    )
    model_key = "chatgpt"

    def __init__(self, event_bus: EventBus):
        super().__init__(event_bus)
        # Subscribe to competitors.updated to refresh queries when competitor landscape changes
        event_bus.subscribe("competitors", self._on_competitors_updated, name="query_gen_handler",
                           event_types=["competitors.updated"])

    async def _on_competitors_updated(self, event):
        """Refresh queries when competitor data changes."""
        brand_id = event.payload.get("brand_id")
        if not brand_id:
            return
        logger.info("Query Gen agent triggered by competitor update for brand %s", brand_id)
        try:
            from app.core.database import AsyncSessionLocal
            async with AsyncSessionLocal() as db:
                ctx = AgentContext(brand_id)
                result = await self.run(ctx, brand_id=uuid.UUID(brand_id), db=db, mode="refresh")
                if result.success:
                    logger.info("Query refresh complete for brand %s", brand_id)
        except Exception as e:
            logger.exception("Query Gen refresh failed: %s", e)

    async def run(self, context: AgentContext, **kwargs) -> AgentResult:
        """Run query lifecycle management."""
        brand_id = kwargs.get("brand_id")
        db = kwargs.get("db")
        mode = kwargs.get("mode", "generate")  # generate, score, refresh

        if not brand_id or not db:
            return AgentResult(False, error="brand_id and db required")

        try:
            if mode == "generate":
                return await self._generate_new(context, brand_id, db)
            elif mode == "score":
                return await self._score_existing(context, brand_id, db)
            elif mode == "refresh":
                return await self._refresh_queries(context, brand_id, db)
            else:
                return AgentResult(False, error=f"Unknown mode: {mode}")
        except Exception as e:
            logger.exception("Query Gen agent failed: %s", e)
            return AgentResult(False, error=str(e))

    async def _generate_new(self, ctx: AgentContext, brand_id: uuid.UUID, db: AsyncSession) -> AgentResult:
        """Generate initial queries for a brand."""
        brand_result = await db.execute(select(Brand).where(Brand.id == brand_id))
        brand = brand_result.scalar_one_or_none()
        if not brand:
            return AgentResult(False, error="Brand not found")

        # Check existing queries
        existing = await db.execute(
            select(func.count()).select_from(MonitoredQuery)
            .where(MonitoredQuery.brand_id == brand_id, MonitoredQuery.is_active == True)
        )
        if existing.scalar() > 0:
            return AgentResult(True, output={"message": "Queries already exist", "count": existing.scalar()})

        # Generate queries
        classification = ctx.get("classification", {"industry": "unknown"})
        competitors = ctx.get("competitors", [])
        crawl_content = ctx.get("crawl_content", "")

        queries = await _generate_queries_llm(brand.name, brand.domain, crawl_content, classification, competitors)

        if not queries:
            # Fallback: create basic queries from domain
            domain_root = brand.domain.split(".")[0].replace("-", " ").replace("_", " ")
            queries = [
                {"query_text": f"best {domain_root} alternatives", "query_type": "brand_category", "score": 3},
                {"query_text": f"{domain_root} vs competitors", "query_type": "brand_category", "score": 3},
                {"query_text": f"how to use {domain_root}", "query_type": "workflow", "score": 3},
                {"query_text": f"{domain_root} pricing and plans", "query_type": "brand_category", "score": 3},
                {"query_text": f"{domain_root} review {brand.name}", "query_type": "brand_category", "score": 3},
            ]

        # Save to DB
        for q_data in queries[:8]:
            db.add(MonitoredQuery(
                id=uuid.uuid4(), brand_id=brand_id,
                query_text=q_data["query_text"],
                query_type=q_data.get("query_type"),
                query_score=q_data.get("score"),
            ))
        await db.flush()

        # Emit event
        await self.event_bus.publish("queries", "queries.generated", {
            "brand_id": str(brand_id), "count": min(len(queries), 8),
        })

        return AgentResult(success=True, output={"queries": [q["query_text"] for q in queries[:8]]})

    async def _score_existing(self, ctx: AgentContext, brand_id: uuid.UUID, db: AsyncSession) -> AgentResult:
        """Score existing queries based on scan performance."""
        scored = await _score_queries_from_scans(db, brand_id)
        ctx.set("query_scores", scored)
        return AgentResult(success=True, output={"scored": scored})

    async def _refresh_queries(self, ctx: AgentContext, brand_id: uuid.UUID, db: AsyncSession) -> AgentResult:
        """Full refresh cycle: score, prune, and generate replacements."""
        brand_result = await db.execute(select(Brand).where(Brand.id == brand_id))
        brand = brand_result.scalar_one_or_none()
        if not brand:
            return AgentResult(False, error="Brand not found")

        # Step 1: Score existing queries
        scored = await _score_queries_from_scans(db, brand_id)

        # Step 2: Prune low-performing queries
        pruned = await _prune_queries(db, brand_id, scored, min_score=2)

        # Step 3: Count active queries
        active_count = await db.execute(
            select(func.count()).select_from(MonitoredQuery)
            .where(MonitoredQuery.brand_id == brand_id, MonitoredQuery.is_active == True)
        )
        active = active_count.scalar()

        # Step 4: Generate replacements if below threshold
        new_queries = []
        if active < 8:
            classification = ctx.get("classification", {"industry": "unknown"})
            competitors = ctx.get("competitors", [])
            generated = await _generate_queries_llm(brand.name, brand.domain, "", classification, competitors)
            # Only add queries that don't already exist
            existing_texts = {q["query_text"].lower() for q in scored}
            for q in generated:
                if q["query_text"].lower() not in existing_texts and active + len(new_queries) < 8:
                    db.add(MonitoredQuery(
                        id=uuid.uuid4(), brand_id=brand_id,
                        query_text=q["query_text"],
                        query_type=q.get("query_type"),
                        query_score=q.get("score"),
                    ))
                    new_queries.append(q["query_text"])

        await db.flush()

        # Emit events
        if pruned:
            await self.event_bus.publish("queries", "queries.pruned", {
                "brand_id": str(brand_id), "pruned": pruned,
            })
        if new_queries:
            await self.event_bus.publish("queries", "queries.refreshed", {
                "brand_id": str(brand_id), "new_queries": new_queries, "pruned": pruned,
            })

        # Write agent memory
        from app.services.agents.context_store import set_agent_memory
        notes = f"Refreshed queries: pruned {len(pruned)}, added {len(new_queries)}, {active} active."
        await set_agent_memory(db, brand_id, self.name, notes)
        await db.commit()

        return AgentResult(success=True, output={
            "pruned": pruned, "new_queries": new_queries, "active_count": active,
        })

    async def suggest(self, brand: "Brand", user_competitors: list[str]) -> dict:
        """Full query suggestion pipeline (for the suggest_queries endpoint)."""
        from app.services.competitor_service import (
            classify_brand, discover_competitors_from_crawl,
            discover_competitors_by_category, crawl_competitor_sites, competitors_need_refresh,
        )
        import httpx

        async with httpx.AsyncClient(timeout=30) as client:
            classification = await classify_brand("", brand.name, brand.domain, client)
            from_crawl = await discover_competitors_from_crawl("", client)
            from_category = await discover_competitors_by_category(classification, client)

            seen = {}
            for c in from_crawl + from_category:
                name_lower = c.get("name", "").lower()
                if name_lower and name_lower != brand.name.lower():
                    seen[name_lower] = c
            for name in user_competitors:
                if name.lower() not in seen:
                    seen[name.lower()] = {"name": name, "domain": "", "relevance_score": 5}
            competitors = sorted(seen.values(), key=lambda c: c.get("relevance_score", 0), reverse=True)[:10]

            if competitors_need_refresh(competitors):
                competitors = await crawl_competitor_sites(competitors)

            queries = await _generate_queries_llm(brand.name, brand.domain, "", classification, competitors)

        return {"classification": classification, "competitors": competitors, "queries": queries}

    async def probe(self, brand: "Brand") -> dict:
        """Run probe scan on generated queries (for the probe endpoint)."""
        import httpx
        from app.services.llm_core import scan_all_llms, _call_openrouter, _parse_json

        async with httpx.AsyncClient(timeout=60) as client:
            from app.services.competitor_service import classify_brand, discover_competitors_from_crawl, discover_competitors_by_category
            classification = await classify_brand("", brand.name, brand.domain, client)
            from_crawl = await discover_competitors_from_crawl("", client)
            from_category = await discover_competitors_by_category(classification, client)
            user_comps = [c.get("name", "") for c in (brand.competitors or [])]
            seen = {c.get("name", "").lower(): c for c in from_crawl + from_category if c.get("name", "").lower() != brand.name.lower()}
            for n in user_comps:
                if n.lower() not in seen:
                    seen[n.lower()] = {"name": n, "domain": "", "relevance_score": 5}
            competitors = sorted(seen.values(), key=lambda c: c.get("relevance_score", 0), reverse=True)[:10]
            queries = await _generate_queries_llm(brand.name, brand.domain, "", classification, competitors)

            # Run probe scan on top 3 queries
            probe_queries = sorted(queries, key=lambda q: q.get("score", 0), reverse=True)[:3]
            raw = await scan_all_llms(
                [(q["query_text"], q["query_text"]) for q in probe_queries],
                ["chatgpt", "gemini", "llama"], client,
            )
            results_text = []
            for q_id, llm_name, result_data, error in raw:
                status = error or (result_data.get("summary", "") if isinstance(result_data, dict) else "empty")
                results_text.append(f"Query: {q_id}\nLLM: {llm_name}\nResponse: {status}\n")

            messages = [
                {"role": "developer", "content": "Return ONLY a valid JSON object with keys 'insights' (array) and 'summary' (string)."},
                {"role": "user", "content": f"Analyze probe scan for {brand.name}:\n\n{''.join(results_text)}"},
            ]
            try:
                resp = await _call_openrouter(messages, "chatgpt", client, temperature=0.3, max_tokens=1024)
                probe = _parse_json(resp)
            except Exception:
                probe = {"insights": [], "summary": "Probe analysis unavailable"}

        return {"queries": queries, "probe_result": probe}
