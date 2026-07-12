"""Website crawler — fetches multiple pages from a domain for content analysis."""
import re
import logging
from urllib.parse import urljoin, urlparse

import httpx

logger = logging.getLogger(__name__)

MAX_PAGES = 6
MAX_CONTENT_PER_PAGE = 2000
MAX_TOTAL_CONTENT = 8000
PRIORITY_PATHS = ["/about", "/product", "/products", "/pricing", "/features",
                  "/solutions", "/docs", "/use-cases", "/customers"]


def extract_text(html: str) -> str:
    """Extract visible text from HTML, preserving paragraph structure."""
    # Remove script, style, nav, footer
    text = re.sub(r"<script[^>]*>.*?</script>", "", html, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<style[^>]*>.*?</style>", "", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<nav[^>]*>.*?</nav>", "", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<footer[^>]*>.*?</footer>", "", text, flags=re.DOTALL | re.IGNORECASE)

    # Convert block elements to newlines
    text = re.sub(r"<(p|div|h[1-6]|li|br)[^>]*>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"</(p|div|h[1-6]|li)>", "\n", text, flags=re.IGNORECASE)

    # Remove remaining tags
    text = re.sub(r"<[^>]+>", " ", text)

    # Decode HTML entities
    text = text.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
    text = text.replace("&quot;", '"').replace("&#x27;", "'").replace("&nbsp;", " ")

    # Collapse whitespace but preserve newlines
    text = re.sub(r"[^\S\n]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = text.strip()

    return text[:MAX_CONTENT_PER_PAGE]


def extract_links(html: str, base_url: str, visited: set) -> list[str]:
    """Extract internal links from HTML."""
    links = re.findall(r'href=["\']([^"\']+)["\']', html, re.IGNORECASE)
    parsed_base = urlparse(base_url)
    urls = []
    for link in links:
        if link.startswith(("#", "javascript:", "mailto:", "tel:")):
            continue
        full = urljoin(base_url, link)
        parsed = urlparse(full)
        if parsed.netloc == parsed_base.netloc and full not in visited:
            clean = parsed._replace(fragment="").geturl().rstrip("/")
            urls.append(clean)
    return urls


async def crawl_website(domain: str, max_pages: int = MAX_PAGES) -> str:
    """Crawl a website and return combined text content.

    Fetches up to max_pages pages following internal links,
    plus priority paths like /about, /pricing, etc.
    """
    base_url = f"https://{domain}" if not domain.startswith("http") else domain
    parsed_base = urlparse(base_url)
    visited: set[str] = set()
    all_content: list[str] = []

    try:
        async with httpx.AsyncClient(
            timeout=10, follow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0 (compatible; LLMRank/1.0)"}
        ) as client:
            to_visit = [base_url.rstrip("/")]
            all_links: list[str] = []

            while to_visit and len(visited) < max_pages:
                url = to_visit.pop(0)
                if url in visited:
                    continue
                visited.add(url)
                try:
                    resp = await client.get(url)
                    if resp.status_code != 200:
                        continue
                    text = extract_text(resp.text)
                    if len(text) > 100:
                        path = urlparse(url).path or "/"
                        all_content.append(f"=== Page: {path} ===\n{text}")
                    links = extract_links(resp.text, url, visited)
                    all_links.extend(links)
                    logger.debug("Crawled %s: %d chars", url, len(text))
                except Exception as e:
                    logger.debug("Failed to crawl %s: %s", url, e)
                    continue

            # Try priority paths if we haven't hit max pages
            if len(visited) < max_pages:
                for path in PRIORITY_PATHS:
                    if len(visited) >= max_pages:
                        break
                    candidate = f"{base_url.rstrip('/')}{path}"
                    if candidate not in visited and candidate in all_links:
                        to_visit.append(candidate)
                        try:
                            resp = await client.get(candidate)
                            if resp.status_code == 200:
                                text = extract_text(resp.text)
                                if len(text) > 100:
                                    all_content.append(f"=== Page: {path} ===\n{text}")
                                    visited.add(candidate)
                        except Exception:
                            pass

    except Exception as e:
        logger.warning("Failed to crawl %s: %s", base_url, e)

    combined = "\n\n".join(all_content)[:MAX_TOTAL_CONTENT]
    logger.info("Crawled %d pages from %s (%d chars)", len(visited), domain, len(combined))
    return combined
