"""Manage Queries skill — generate, score, and prune queries."""
import uuid
import json
import re
import logging
from datetime import datetime, timezone

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.tools.db import read_model, query_db, write_model, count_records
from app.services.tools.llm import call_llm_json
from app.services.tools.event import emit_event
from app.services.tools.memory import store_memory

logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


async def generate_queries(brand_id: str, brand_name: str, domain: str,
                           classification: dict | None = None,
                           competitors: list[dict] | None = None,
                           crawl_content: str = "",
                           summary: dict | None = None,
                           agent_name: str = "query_gen") -> list[dict]:
    """Generate new search queries for a brand using LLM.

    Args:
        summary: Optional pre-computed summary from summarize_company()
        classification: Fallback if summary not provided
        competitors: List of competitor dicts
        crawl_content: Raw crawled content

    Returns list of {query_text, query_type, score}.
    """
    # Build prompt from summary if available, otherwise fallback to classification
    if summary:
        product_desc = summary.get("description", "")
        industry = summary.get("industry", "unknown")
        category = summary.get("category", "unknown")
        features = summary.get("key_features", [])
        use_cases = summary.get("use_cases", [])
        audience = summary.get("target_audience", "")
        value_prop = summary.get("value_proposition", "")
        mentioned_competitors = summary.get("competitors_mentioned", [])
        comp_str = ", ".join(mentioned_competitors[:5])
    else:
        classification = classification or {"industry": "unknown", "sub_category": ""}
        product_desc = crawl_content[:500] if crawl_content else f"{brand_name} at {domain}"
        industry = classification.get("industry", "unknown")
        category = classification.get("sub_category", "unknown")
        features = []
        use_cases = []
        audience = ""
        value_prop = ""
        competitors = competitors or []
        comp_str = ", ".join(c.get("name", "") for c in competitors[:5])

    logger.info("Query gen for %s: industry=%s, category=%s, features=%s",
                brand_name, industry, category, features[:3])

    prompt = (
        f"Generate 20 conversational questions that people would ask an AI assistant "
        f"when researching a product like {brand_name}.\n\n"
        f"PRODUCT: {brand_name}\n"
        f"DESCRIPTION: {product_desc}\n"
        f"INDUSTRY: {industry}\n"
        f"CATEGORY: {category}\n"
        f"KEY FEATURES: {', '.join(features[:5]) if features else 'unknown'}\n"
        f"TARGET AUDIENCE: {audience or 'unknown'}\n"
        f"USE CASES: {', '.join(use_cases[:3]) if use_cases else 'unknown'}\n"
        f"COMPETITORS: {comp_str or 'none known'}\n"
        f"VALUE PROP: {value_prop or 'unknown'}\n\n"
        f"RULES:\n"
        f"- Questions must be directly about THIS specific product type\n"
        f"- Use the DESCRIPTION and USE CASES above as the source of truth\n"
        f"- Do NOT generate generic questions unrelated to this product\n"
        f"- Do NOT include the brand name {brand_name} in questions\n\n"
        f'Return ONLY a valid JSON array: [{{"query_text":"...","query_type":"workflow","score":1-5}}]'
    )

    messages = [
        {"role": "developer", "content": (
            "You are a UX researcher. Generate questions people ask when researching "
            "a SPECIFIC type of product. The questions must be directly relevant to what "
            "this product does, based on the description provided. Return ONLY a valid JSON array."
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
            latest_result = await session.execute(
                select(QueryResult)
                .join(Scan, QueryResult.scan_id == Scan.id)
                .where(QueryResult.query_id == q.id, Scan.status == ScanStatus.completed)
                .order_by(Scan.completed_at.desc())
                .limit(1)
            )
            latest = latest_result.scalar_one_or_none()

            if latest:
                score = 3
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

    # Generate queries OUTSIDE the session to avoid holding a connection during LLM calls
    generated = await generate_queries(
        brand_id, brand_name, domain, classification, competitors, agent_name
    )

    async def _execute(session: AsyncSession):
        # 1. Score existing
        scored = await score_queries(brand_id, session)

        # 2. Prune low-performing
        pruned = await prune_queries(brand_id, min_score=2, db=session)

        # 3. Count active
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
