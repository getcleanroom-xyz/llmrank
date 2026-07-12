"""Query Gen Agent — manages query lifecycle using skills."""
import uuid
import logging
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.services.agents.base import BaseAgent, AgentContext, AgentResult
from app.services.agents.tools import Tool
from app.services.event_bus.broker import EventBus

logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class QueryGenAgent(BaseAgent):
    """Agent that manages query lifecycle for a brand.

    Uses manage_queries skills and exposes them as tools.
    """

    name = "query_gen"
    description = "Generates, scores, and prunes search queries for AI visibility scans"
    system_prompt = (
        "You are a query generation specialist. Your job is to create, evaluate, "
        "and manage search queries that people would type into AI assistants. "
        "You generate scenario-based questions, score them based on scan performance, "
        "and prune low-performing queries.\n\n"
        "You have skills for generating, scoring, and managing queries. "
        "Use them to maintain a healthy set of monitored queries for brands."
    )
    model_key = "chatgpt"

    def __init__(self, event_bus: EventBus):
        super().__init__(event_bus, allowed_permissions=["db:read", "db:write", "llm:call", "event:emit"])

        # Register skills as tools
        self.tools.register(Tool(
            name="generate_queries",
            description="Generate new search queries for a brand. Args: brand_id, brand_name, domain, classification, competitors",
            handler=self._generate_skill,
            parameters={
                "type": "object",
                "properties": {
                    "brand_id": {"type": "string"},
                    "brand_name": {"type": "string"},
                    "domain": {"type": "string"},
                    "classification": {"type": "object"},
                    "competitors": {"type": "array"},
                },
                "required": ["brand_id", "brand_name", "domain"],
            },
            permissions=["db:read", "db:write", "llm:call", "event:emit"],
        ))

        self.tools.register(Tool(
            name="score_queries",
            description="Score existing queries based on scan performance. Args: brand_id",
            handler=self._score_skill,
            parameters={
                "type": "object",
                "properties": {
                    "brand_id": {"type": "string"},
                },
                "required": ["brand_id"],
            },
            permissions=["db:read"],
        ))

        self.tools.register(Tool(
            name="prune_queries",
            description="Deactivate low-performing queries. Args: brand_id, min_score",
            handler=self._prune_skill,
            parameters={
                "type": "object",
                "properties": {
                    "brand_id": {"type": "string"},
                    "min_score": {"type": "integer"},
                },
                "required": ["brand_id"],
            },
            permissions=["db:read", "db:write"],
        ))

        self.tools.register(Tool(
            name="refresh_queries",
            description="Full refresh: score, prune, generate replacements. Args: brand_id, brand_name, domain",
            handler=self._refresh_skill,
            parameters={
                "type": "object",
                "properties": {
                    "brand_id": {"type": "string"},
                    "brand_name": {"type": "string"},
                    "domain": {"type": "string"},
                },
                "required": ["brand_id", "brand_name", "domain"],
            },
            permissions=["db:read", "db:write", "llm:call", "event:emit"],
        ))

        # Subscribe to competitor updates
        event_bus.subscribe("competitors", self._on_competitors_updated, name="query_gen_handler",
                           event_types=["competitors.updated"])

    async def _generate_skill(self, brand_id: str, brand_name: str, domain: str,
                               summary: dict) -> list[dict]:
        from app.services.skills.manage_queries import generate_queries
        return await generate_queries(brand_id, brand_name, domain, summary, self.name)

    async def _score_skill(self, brand_id: str) -> list[dict]:
        from app.services.skills.manage_queries import score_queries
        return await score_queries(brand_id)

    async def _prune_skill(self, brand_id: str, min_score: int = 2) -> list[str]:
        from app.services.skills.manage_queries import prune_queries
        return await prune_queries(brand_id, min_score)

    async def _refresh_skill(self, brand_id: str, brand_name: str, domain: str) -> dict:
        from app.services.skills.manage_queries import refresh_queries
        return await refresh_queries(brand_id, brand_name, domain, agent_name=self.name)

    async def _on_competitors_updated(self, event):
        """Refresh queries when competitor data changes."""
        brand_id = event.payload.get("brand_id")
        if not brand_id:
            return
        logger.info("Query Gen agent triggered by competitor update for brand %s", brand_id)

        try:
            from app.core.database import AsyncSessionLocal
            from app.models.models import Brand
            async with AsyncSessionLocal() as db:
                brand_result = await db.execute(
                    Brand.active().where(Brand.id == uuid.UUID(brand_id))
                )
                brand = brand_result.scalar_one_or_none()
                if brand:
                    result = await self.run(
                        AgentContext(brand_id),
                        brand_id=uuid.UUID(brand_id),
                        brand_name=brand.name,
                        domain=brand.domain,
                        db=db,
                        mode="refresh",
                    )
                    # Skill commits internally — just check success
                    if result.success:
                        logger.info("Query refresh complete for brand %s", brand_id)
        except Exception as e:
            logger.exception("Query Gen refresh failed: %s", e)

    async def run(self, context: AgentContext, **kwargs) -> AgentResult:
        """Run query lifecycle management."""
        brand_id = kwargs.get("brand_id")
        db = kwargs.get("db")
        mode = kwargs.get("mode", "generate")

        if not brand_id or not db:
            return AgentResult(False, error="brand_id and db required")

        try:
            if mode == "generate":
                return await self._run_generate(context, brand_id, db)
            elif mode == "score":
                return await self._run_score(brand_id)
            elif mode == "refresh":
                return await self._run_refresh(context, brand_id, db)
            else:
                return AgentResult(False, error=f"Unknown mode: {mode}")
        except Exception as e:
            logger.exception("Query Gen agent failed: %s", e)
            return AgentResult(False, error=str(e))

    async def _run_generate(self, ctx: AgentContext, brand_id: uuid.UUID, db: AsyncSession) -> AgentResult:
        """Generate initial queries for a brand."""
        from app.models.models import Brand, MonitoredQuery
        from app.services.skills.manage_queries import generate_queries

        brand_result = await db.execute(
            Brand.active().where(Brand.id == brand_id)
        )
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

        # Summarize the brand
        from app.services.tools.summarize import summarize_company
        from app.services.crawler import crawl_website
        crawl_content = await crawl_website(brand.domain)
        summary = await summarize_company(crawl_content, brand.name, brand.domain)

        queries = await generate_queries(
            str(brand_id), brand.name, brand.domain, summary, self.name
        )

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

        return AgentResult(success=True, output={"queries": [q["query_text"] for q in queries[:8]]})

    async def _run_score(self, brand_id: uuid.UUID) -> AgentResult:
        from app.services.skills.manage_queries import score_queries
        scored = await score_queries(str(brand_id))
        return AgentResult(success=True, output={"scored": scored})

    async def _run_refresh(self, ctx: AgentContext, brand_id: uuid.UUID, db: AsyncSession) -> AgentResult:
        from app.models.models import Brand
        from app.services.skills.manage_queries import refresh_queries

        brand_result = await db.execute(
            Brand.active().where(Brand.id == brand_id)
        )
        brand = brand_result.scalar_one_or_none()
        if not brand:
            return AgentResult(False, error="Brand not found")

        result = await refresh_queries(
            str(brand_id), brand.name, brand.domain,
            agent_name=self.name, db=db,
        )
        return AgentResult(success=True, output=result)

    async def suggest(self, brand, user_competitors: list[str]) -> dict:
        """Full query suggestion pipeline (for the suggest_queries endpoint)."""
        from app.services.competitor_service import (
            discover_competitors_from_crawl, discover_competitors_by_category,
            crawl_competitor_sites, competitors_need_refresh,
        )
        from app.services.skills.manage_queries import generate_queries
        from app.services.tools.summarize import summarize_company
        from app.services.crawler import crawl_website
        import httpx

        # 1. Crawl the brand's website (up to 6 pages)
        crawl_content = await crawl_website(brand.domain)

        # 2. Summarize what the company does
        summary = await summarize_company(crawl_content, brand.name, brand.domain)
        logger.info("Summary for %s: industry=%s, category=%s, features=%s",
                     brand.name, summary.get("industry"), summary.get("category"),
                     summary.get("key_features", [])[:3])

        # 3. Discover competitors from crawled content and category
        async with httpx.AsyncClient(timeout=30) as client:
            from_crawl = await discover_competitors_from_crawl(crawl_content, client)
            from_category = await discover_competitors_by_category(summary, client)

        seen = {}
        for c in from_crawl + from_category:
            name_lower = c.get("name", "").lower()
            if name_lower and name_lower != brand.name.lower():
                seen[name_lower] = c
        # Add competitors from summary
        for name in summary.get("competitors_mentioned", []):
            if name.lower() not in seen:
                seen[name.lower()] = {"name": name, "domain": "", "relevance_score": 4}
        for name in user_competitors:
            if name.lower() not in seen:
                seen[name.lower()] = {"name": name, "domain": "", "relevance_score": 5}
        competitors = sorted(seen.values(), key=lambda c: c.get("relevance_score", 0), reverse=True)[:10]

        # Fill in missing domains via web search
        from app.services.competitor_service import fill_missing_domains
        competitors = await fill_missing_domains(competitors)

        if competitors_need_refresh(competitors):
            async with httpx.AsyncClient(timeout=30) as client:
                competitors = await crawl_competitor_sites(competitors)

        # 4. Generate queries using summary
        queries = await generate_queries(
            str(brand.id), brand.name, brand.domain, summary, self.name,
        )

        return {"summary": summary, "competitors": competitors, "queries": queries}

    async def probe(self, brand) -> dict:
        """Run probe scan on generated queries."""
        from app.services.llm_core import scan_all_llms, _call_openrouter, _parse_json
        from app.services.competitor_service import discover_competitors_from_crawl, discover_competitors_by_category
        from app.services.skills.manage_queries import generate_queries
        from app.services.tools.summarize import summarize_company
        from app.services.crawler import crawl_website
        import httpx

        # 1. Crawl and summarize
        crawl_content = await crawl_website(brand.domain)
        summary = await summarize_company(crawl_content, brand.name, brand.domain)

        # 2. Discover competitors
        async with httpx.AsyncClient(timeout=30) as client:
            from_crawl = await discover_competitors_from_crawl(crawl_content, client)
            from_category = await discover_competitors_by_category(summary, client)

        user_comps = [c.get("name", "") for c in (brand.competitors or [])]
        seen = {c.get("name", "").lower(): c for c in from_crawl + from_category if c.get("name", "").lower() != brand.name.lower()}
        for name in summary.get("competitors_mentioned", []):
            if name.lower() not in seen:
                seen[name.lower()] = {"name": name, "domain": "", "relevance_score": 4}
        for n in user_comps:
            if n.lower() not in seen:
                seen[n.lower()] = {"name": n, "domain": "", "relevance_score": 5}
        competitors = sorted(seen.values(), key=lambda c: c.get("relevance_score", 0), reverse=True)[:10]

        # Fill in missing domains via web search
        from app.services.competitor_service import fill_missing_domains
        competitors = await fill_missing_domains(competitors)

        # 3. Generate queries using summary
        queries = await generate_queries(
            str(brand.id), brand.name, brand.domain, summary, self.name,
        )

        # 4. Run probe scan on top 3 queries
        async with httpx.AsyncClient(timeout=60) as client:
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

        return {"summary": summary, "queries": queries, "probe_result": probe}
