"""Google search tool — find what Google says about a brand."""
import logging
import re

import httpx

logger = logging.getLogger(__name__)


async def search_google(brand_name: str, domain: str) -> str:
    """Search Google for info about a brand and return snippets.

    Uses DuckDuckGo HTML search (no API key needed).
    Returns combined search result snippets as context.
    """
    query = f"{brand_name} {domain} what does it do"
    url = "https://html.duckduckgo.com/html/"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Content-Type": "application/x-www-form-urlencoded",
    }

    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
            resp = await client.post(url, data={"q": query}, headers=headers)
            if resp.status_code != 200:
                logger.warning("DuckDuckGo search returned %d", resp.status_code)
                return ""

            # Extract snippets from results
            snippets = re.findall(r'class="result__snippet">(.*?)</a>', resp.text, re.DOTALL)
            if not snippets:
                # Try alternative pattern
                snippets = re.findall(r'class="result__body">(.*?)</div>', resp.text, re.DOTALL)

            # Clean HTML from snippets
            cleaned = []
            for s in snippets[:8]:
                text = re.sub(r"<[^>]+>", "", s).strip()
                text = re.sub(r"\s+", " ", text)
                if len(text) > 30:
                    cleaned.append(text)

            result = "\n".join(cleaned)
            logger.info("Google search for %s: %d snippets, %d chars", brand_name, len(cleaned), len(result))
            return result

    except Exception as e:
        logger.warning("Google search failed for %s: %s", brand_name, e)
        return ""
