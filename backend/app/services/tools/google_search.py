"""Search tool — find what search engines say about a brand."""
import logging

logger = logging.getLogger(__name__)


async def search_google(brand_name: str, domain: str) -> str:
    """Search DuckDuckGo for info about a brand and return snippets.

    Uses the ddgs library (no API key needed).
    Returns combined search result snippets as context.
    """
    query = f"{brand_name} {domain} what does it do"

    try:
        from ddgs import DDGS

        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=8))

        cleaned = []
        for r in results:
            body = r.get("body", "").strip()
            if len(body) > 30:
                cleaned.append(body)

        result = "\n".join(cleaned)
        logger.info("Search for %s: %d snippets, %d chars", brand_name, len(cleaned), len(result))
        return result

    except ImportError:
        logger.warning("ddgs package not installed — pip install duckduckgo-search")
        return ""
    except Exception as e:
        logger.warning("Search failed for %s: %s", brand_name, e)
        return ""
