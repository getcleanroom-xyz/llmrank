"""Manage Queries skill — generate, score, and prune queries."""
import uuid
import logging
from datetime import datetime, timezone

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.tools.db import write_model, count_records
from app.services.tools.llm import call_llm_json
from app.services.tools.event import emit_event
from app.services.tools.memory import store_memory

logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


async def generate_queries(brand_id: str, brand_name: str, domain: str,
                           summary: dict,
                           agent_name: str = "query_gen") -> list[dict]:
    """Generate new search queries for a brand using LLM.

    Args:
        summary: Pre-computed summary from summarize_company()

    Returns list of {query_text, query_type, score}.
    """
    logger.info("Query gen for %s: industry=%s, category=%s",
                brand_name, summary.get("industry"), summary.get("category"))

    description = summary.get("description") or f"products in the {summary.get('industry', 'technology')} space"
    features = summary.get("key_features") or []
    use_cases = summary.get("use_cases") or []
    audience = summary.get("target_audience") or "general users"
    category = summary.get("category") or summary.get("industry") or "technology"

    prompt = (
        f"Generate 20 conversational questions people ask when researching products "
        f"in the {category} category.\n\n"
        f"Product description: {description}\n"
    )
    if features:
        prompt += f"Key features: {', '.join(features)}\n"
    if use_cases:
        prompt += f"Use cases: {', '.join(use_cases)}\n"
    prompt += (
        f"Target audience: {audience}\n\n"
        f"These are people who NEED this type of product but haven't chosen a brand yet.\n"
    )
    if use_cases:
        prompt += f"They're solving problems like: {', '.join(use_cases[:3])}\n"
    prompt += (
        f"\nRULES:\n"
        f"- Questions must be about solving these specific problems\n"
        f"- Do NOT mention {brand_name} or any brand name\n"
        f"- Be scenario-based and specific to this product category\n\n"
        f'Return ONLY a valid JSON array: [{{"query_text":"...","query_type":"workflow","score":1-5}}]'
    )

    messages = [
        {"role": "developer", "content": (
            "You are a UX researcher. Generate questions people ask when researching "
            "products in a specific category. Ground every question in the product description, "
            "features, and use cases provided. Questions should sound like real users solving "
            "real problems — not meta questions about a tool. Return ONLY a valid JSON array."
        )},
        {"role": "user", "content": prompt},
    ]

    for model in ["chatgpt", "llama"]:
        try:
            result = await call_llm_json(messages, model_key=model, temperature=0.6, max_tokens=2048)
            if isinstance(result, list) and len(result) >= 5:
                for q in result:
                    q["score"] = max(1, min(5, int(q.get("score", 3))))
                    q["query_type"] = q.get("query_type", "brand_category")
                result.sort(key=lambda q: q.get("score", 0), reverse=True)
                logger.info("Generated %d queries for %s: %s", len(result), brand_name,
                            [q["query_text"][:50] for q in result[:5]])
                return result[:20]
            else:
                logger.warning("Query gen returned %d results (need >= 5): %s", len(result) if isinstance(result, list) else 0, result)
        except Exception as e:
            logger.warning("Query generation failed with %s: %s", model, e)

    return []


async def score_queries(brand_id: str, db: AsyncSession | None = None) -> list[dict]:
    """Score existing queries based on scan performance.

    Returns list of {query_id, query_text, score, last_scanned}.
    """
    from app.core.database import AsyncSessionLocal
    from app.models.models import MonitoredQuery, Scan, QueryResult, ScanStatus

    async def _execute(session: AsyncSession):
        result = await session.execute(
            select(MonitoredQuery)
            .where(MonitoredQuery.brand_id == uuid.UUID(brand_id), MonitoredQuery.is_active == True)
        )
        queries = result.scalars().all()

        scored = []
        for q in queries:
            # Get ALL results from the most recent completed scan for this query
            latest_scan_subq = (
                select(Scan.id)
                .join(QueryResult, QueryResult.scan_id == Scan.id)
                .where(QueryResult.query_id == q.id, Scan.status == ScanStatus.completed)
                .order_by(Scan.completed_at.desc())
                .limit(1)
                .scalar_subquery()
            )
            latest_results = await session.execute(
                select(QueryResult)
                .where(QueryResult.query_id == q.id, QueryResult.scan_id == latest_scan_subq)
            )
            results = latest_results.scalars().all()

            if results:
                # Aggregate: if ANY LLM mentioned the brand, count it as mentioned.
                # Use the best position/sentiment across LLMs.
                any_mentioned = any(r.mentioned for r in results)
                best_position = min((r.position or 99 for r in results if r.mentioned), default=99)
                best_score = max((r.score or 0 for r in results), default=0)

                if any_mentioned:
                    score = 5 if best_position <= 2 else 4 if best_position <= 4 else 3
                else:
                    score = 2 if best_score >= 5 else 1
                last_scanned = max(r.created_at for r in results)
            else:
                score = q.query_score or 3
                last_scanned = None

            scored.append({
                "query_id": str(q.id),
                "query_text": q.query_text,
                "score": score,
                "last_scanned": last_scanned.isoformat() if last_scanned else None,
            })

        scored.sort(key=lambda x: x["score"])
        return scored

    if db:
        return await _execute(db)

    async with AsyncSessionLocal() as session:
        return await _execute(session)


async def prune_queries(brand_id: str, min_score: int = 2,
                        db: AsyncSession | None = None) -> list[str]:
    """Deactivate queries with persistently low scores. Returns pruned query texts."""
    from app.core.database import AsyncSessionLocal
    from app.models.models import MonitoredQuery

    async def _execute(session: AsyncSession):
        scored = await score_queries(brand_id, session)
        pruned = []

        for item in scored:
            if item["score"] < min_score:
                result = await session.execute(
                    select(MonitoredQuery).where(MonitoredQuery.id == uuid.UUID(item["query_id"]))
                )
                q = result.scalar_one_or_none()
                if q and q.is_active:
                    q.is_active = False
                    pruned.append(item["query_text"])

        if pruned:
            await session.flush()
        return pruned

    if db:
        return await _execute(db)

    async with AsyncSessionLocal() as session:
        result = await _execute(session)
        await session.commit()
        return result


async def refresh_queries(brand_id: str, brand_name: str, domain: str,
                          classification: dict | None = None,
                          competitors: list[dict] | None = None,
                          agent_name: str = "query_gen",
                          db: AsyncSession | None = None) -> dict:
    """Full refresh cycle: score, prune, generate replacements.

    Returns {pruned: [...], new_queries: [...], active_count: int}.
    """
    from app.core.database import AsyncSessionLocal
    from app.models.models import Brand, MonitoredQuery
    from app.services.tools.summarize import summarize_company

    # Fetch brand summary if not provided
    summary = classification
    if not summary:
        try:
            from app.services.crawler import crawl_website
            crawl_content = await crawl_website(domain)
            summary = await summarize_company(crawl_content, brand_name, domain)
        except Exception as e:
            logger.warning("Failed to get summary for %s: %s", brand_name, e)
            summary = {"description": brand_name, "industry": None, "category": None,
                       "key_features": [], "target_audience": None, "use_cases": []}

    # Generate queries OUTSIDE the session to avoid holding a connection during LLM calls
    generated = await generate_queries(
        brand_id, brand_name, domain, summary, agent_name
    )

    async def _execute(session: AsyncSession):
        # 1. Score existing
        scored = await score_queries(brand_id, session)

        # 2. Prune low-performing
        pruned = await prune_queries(brand_id, min_score=2, db=session)

        # 3. Count active (after prune)
        active_count = await count_records("MonitoredQuery", {
            "brand_id": uuid.UUID(brand_id), "is_active": True
        }, db=session)

        # 4. Add generated replacements if below threshold
        new_queries = []
        if active_count < 8:
            existing_texts = {q["query_text"].lower() for q in scored}
            for q in generated:
                if q["query_text"].lower() not in existing_texts and active_count + len(new_queries) < 8:
                    from app.models.models import MonitoredQuery as MQ
                    session.add(MQ(
                        id=uuid.uuid4(),
                        brand_id=uuid.UUID(brand_id),
                        query_text=q["query_text"],
                        query_type=q.get("query_type"),
                        query_score=q.get("score"),
                    ))
                    new_queries.append(q["query_text"])

        await session.flush()

        # 5. Emit events
        if pruned:
            await emit_event("queries", "queries.pruned", {
                "brand_id": brand_id, "pruned": pruned,
            }, agent_name=agent_name)
        if new_queries:
            await emit_event("queries", "queries.refreshed", {
                "brand_id": brand_id, "new_queries": new_queries, "pruned": pruned,
            }, agent_name=agent_name)

        # 6. Store memory
        notes = f"Refreshed queries: pruned {len(pruned)}, added {len(new_queries)}, {active_count} active."
        await store_memory(agent_name, brand_id, notes, db=session)

        return {
            "pruned": pruned,
            "new_queries": new_queries,
            "active_count": active_count,
        }

    if db:
        result = await _execute(db)
        await db.commit()
        return result

    async with AsyncSessionLocal() as session:
        result = await _execute(session)
        await session.commit()
        return result
