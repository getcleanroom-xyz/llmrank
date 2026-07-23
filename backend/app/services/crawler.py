"""Website crawler — fetches multiple pages from a domain for content analysis."""
import re
import logging
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

MAX_PAGES = 6
MAX_CONTENT_PER_PAGE = 2000
MAX_TOTAL_CONTENT = 8000


def extract_text(html: str) -> str:
    """Extract visible text from HTML, keeping tags but removing attributes."""
    try:
        soup = BeautifulSoup(html, "lxml")
    except Exception:
        soup = BeautifulSoup(html, "html.parser")

    # Remove unwanted elements entirely
    for tag in soup.find_all(["script", "style", "nav", "footer", "header",
                               "noscript", "svg", "iframe", "form", "button"]):
        tag.decompose()

    # Remove attributes from all remaining tags (keep tags, lose class/id/etc)
    for tag in soup.find_all(True):
        tag.attrs = {}

    # Get the text with tags preserved
    text = soup.get_text(separator="\n", strip=True)

    # Clean up excessive whitespace
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[^\S\n]+", " ", text)

    return text[:MAX_CONTENT_PER_PAGE]


def extract_links(html: str, base_url: str, visited: set) -> list[str]:
    """Extract internal links from HTML."""
    try:
        soup = BeautifulSoup(html, "lxml")
    except Exception:
        soup = BeautifulSoup(html, "html.parser")
    parsed_base = urlparse(base_url)
    urls = []

    for a in soup.find_all("a", href=True):
        href = a["href"]
        if href.startswith(("#", "javascript:", "mailto:", "tel:")):
            continue
        full = urljoin(base_url, href)
        parsed = urlparse(full)
        if parsed.netloc == parsed_base.netloc and full not in visited:
            clean = parsed._replace(fragment="").geturl().rstrip("/")
            urls.append(clean)

    return urls


async def crawl_website(domain: str, max_pages: int = MAX_PAGES) -> str:
    """Crawl a website and return combined text content.

    Follows internal links up to max_pages using BFS.
    """
    base_url = f"https://{domain}" if not domain.startswith("http") else domain
    parsed_base = urlparse(base_url)
    visited = set()
    all_content = []

    try:
        async with httpx.AsyncClient(
            timeout=10, follow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0 (compatible; LLMRanked/1.0)"}
        ) as client:
            to_visit = [base_url.rstrip("/")]

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
                    # Discover new internal links and add to queue
                    links = extract_links(resp.text, url, visited)
                    for link in links:
                        if link not in to_visit and link not in visited:
                            to_visit.append(link)
                    to_visit = to_visit[:max_pages * 3]
                    logger.debug("Crawled %s: %d chars, %d new links", url, len(text), len(links))
                except Exception as e:
                    logger.debug("Failed to crawl %s: %s", url, e)
                    continue

    except Exception as e:
        logger.warning("Failed to crawl %s: %s", base_url, e)

    combined = "\n\n".join(all_content)[:MAX_TOTAL_CONTENT]
    logger.info("Crawled %d pages from %s (%d chars)", len(visited), domain, len(combined))
    return combined
