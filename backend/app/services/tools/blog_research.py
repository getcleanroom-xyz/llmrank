"""Blog research tool — gather context for AI blog post generation."""
import logging
import json

logger = logging.getLogger(__name__)


async def research_topic(topic: str, keywords: list[str]) -> dict:
    """Research a blog topic using web search and DB data.

    Returns {"web_context": str, "db_context": str, "trending": list[str]}.
    """
    web_context = await _search_web(topic, keywords)
    trending = await _find_trending(keywords)
    db_context = await _get_user_patterns()

    return {
        "web_context": web_context,
        "db_context": db_context,
        "trending": trending,
    }


async def _search_web(topic: str, keywords: list[str]) -> str:
    """Search the web for context on the topic."""
    try:
        from ddgs import DDGS
        all_snippets = []

        # Search for the main topic
        try:
            with DDGS() as ddgs:
                results = list(ddgs.text(topic, max_results=5))
            for r in results:
                body = r.get("body", "").strip()
                if body:
                    all_snippets.append(f"[{r.get('title', '')}] {body}")
        except Exception:
            pass

        # Search for related keywords
        for kw in keywords[:3]:
            try:
                with DDGS() as ddgs:
                    results = list(ddgs.text(kw, max_results=3))
                for r in results:
                    body = r.get("body", "").strip()
                    if body:
                        all_snippets.append(f"[{r.get('title', '')}] {body}")
            except Exception:
                continue

        return "\n\n".join(all_snippets[:15])

    except ImportError:
        logger.warning("ddgs not installed")
        return ""
    except Exception as e:
        logger.warning("Web research failed: %s", e)
        return ""


async def _find_trending(keywords: list[str]) -> list[str]:
    """Find trending related topics."""
    try:
        from ddgs import DDGS
        trending = []

        for kw in keywords[:2]:
            try:
                with DDGS() as ddgs:
                    results = list(ddgs.text(f"{kw} 2026 trends", max_results=3))
                for r in results:
                    title = r.get("title", "")
                    if title and title not in trending:
                        trending.append(title)
            except Exception:
                continue

        return trending[:5]

    except Exception:
        return []


async def _get_user_patterns() -> str:
    """Get anonymized patterns from user scan data."""
    try:
        from app.core.database import AsyncSessionLocal
        from app.models.models import Brand, MonitoredQuery, Scan, QueryResult, ScanStatus
        from sqlalchemy import select, func

        async with AsyncSessionLocal() as db:
            # Count active brands
            brand_count = await db.execute(select(func.count(Brand.id)).where(Brand.deleted_at.is_(None)))
            num_brands = brand_count.scalar() or 0

            # Count total queries
            query_count = await db.execute(select(func.count(MonitoredQuery.id)).where(MonitoredQuery.is_active == True))
            num_queries = query_count.scalar() or 0

            # Count total scans
            scan_count = await db.execute(select(func.count(Scan.id)).where(Scan.status == ScanStatus.completed))
            num_scans = scan_count.scalar() or 0

            # Get most common query types/patterns
            recent_queries = await db.execute(
                select(MonitoredQuery.query_text)
                .where(MonitoredQuery.is_active == True)
                .order_by(MonitoredQuery.created_at.desc())
                .limit(20)
            )
            query_texts = [row[0] for row in recent_queries]

            # Get top competitors mentioned
            results = await db.execute(
                select(QueryResult.competitors_mentioned)
                .join(Scan, QueryResult.scan_id == Scan.id)
                .where(Scan.status == ScanStatus.completed, QueryResult.mentioned == True)
                .order_by(Scan.completed_at.desc())
                .limit(100)
            )
            comp_mentions = {}
            for row in results:
                for comp in (row[0] or []):
                    name = comp.get("name", "") if isinstance(comp, dict) else str(comp)
                    if name:
                        comp_mentions[name] = comp_mentions.get(name, 0) + 1
            top_competitors = sorted(comp_mentions.items(), key=lambda x: x[1], reverse=True)[:10]

            patterns = {
                "num_brands": num_brands,
                "num_queries": num_queries,
                "num_scans": num_scans,
                "sample_queries": query_texts[:10],
                "top_competitors": [name for name, _ in top_competitors],
            }
            return json.dumps(patterns, indent=2)

    except Exception as e:
        logger.warning("Failed to get user patterns: %s", e)
        return "{}"
