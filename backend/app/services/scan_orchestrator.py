import asyncio
import uuid
import logging
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.models import Brand, MonitoredQuery, Scan, QueryResult, ScanStatus
from app.services.llm_adapters import query_all_llms, SCAN_PROMPT_TEMPLATE
from app.services.ranking_engine import rank_response
from app.services.insight_engine import generate_insights_for_query

logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    """Return naive UTC datetime compatible with TIMESTAMP WITHOUT TIME ZONE columns."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


async def run_scan(
    brand_id: uuid.UUID,
    db: AsyncSession,
    llm_names: list[str] | None = None,
    scan_id: uuid.UUID | None = None,
) -> Scan:
    """
    Orchestrate a full scan for a brand:
    1. Update existing scan record (or create new)
    2. Load brand + active queries
    3. Fire queries concurrently across all LLMs
    4. Run ranking engine on each response
    5. Persist results
    6. Compute aggregate scores
    7. Mark scan complete
    """
    if llm_names is None:
        llm_names = ["chatgpt", "llama"]

    # Load brand
    brand_result = await db.execute(select(Brand).where(Brand.id == brand_id))
    brand = brand_result.scalar_one_or_none()
    if not brand:
        raise ValueError(f"Brand {brand_id} not found")

    # Load active queries
    queries_result = await db.execute(
        select(MonitoredQuery)
        .where(MonitoredQuery.brand_id == brand_id, MonitoredQuery.is_active == True)
    )
    queries = queries_result.scalars().all()
    if not queries:
        raise ValueError("No active queries for this brand")

    # Use existing scan record or create new one
    if scan_id:
        scan_result = await db.execute(select(Scan).where(Scan.id == scan_id))
        scan = scan_result.scalar_one_or_none()
        if scan:
            logger.info("Found existing scan %s, updating to running", scan_id)
            scan.status = ScanStatus.running
            scan.started_at = _utcnow()
        else:
            logger.warning("Scan %s not found in DB, creating new record", scan_id)
            scan = Scan(
                id=scan_id,
                brand_id=brand_id,
                status=ScanStatus.running,
                started_at=_utcnow(),
            )
            db.add(scan)
    else:
        logger.info("No scan_id provided, creating new scan record")
        scan = Scan(
            id=uuid.uuid4(),
            brand_id=brand_id,
            status=ScanStatus.running,
            started_at=_utcnow(),
        )
        db.add(scan)
    await db.flush()
    logger.info("Scan %s flushed (status=running), processing %d queries with %d LLMs", scan.id, len(queries), len(llm_names))

    total_scores = []
    total_mentioned = 0
    total_successful = 0

    # Process each query
    for query in queries:
        # Fire all LLMs concurrently for this query
        llm_responses = await query_all_llms(query.query_text, llm_names)

        query_results = []
        for llm_name, (response_text, error) in llm_responses.items():
            if error or not response_text:
                # Record failed result — stored but excluded from aggregates
                result = QueryResult(
                    id=uuid.uuid4(),
                    scan_id=scan.id,
                    query_id=query.id,
                    llm_name=llm_name,
                    raw_response=f"[Error: {error}]" if error else "[Empty response]",
                    mentioned=False,
                    position=None,
                    sentiment="not_mentioned",
                    competitors_mentioned=[],
                    annotated_response=None,
                    score=None,  # None signals "not applicable", not 0
                )
            else:
                ranking = rank_response(brand.name, brand.domain, response_text)
                result = QueryResult(
                    id=uuid.uuid4(),
                    scan_id=scan.id,
                    query_id=query.id,
                    llm_name=llm_name,
                    raw_response=response_text,
                    mentioned=ranking.mentioned,
                    position=ranking.position,
                    sentiment=ranking.sentiment,
                    competitors_mentioned=ranking.competitors,
                    annotated_response=ranking.annotated_spans,
                    score=ranking.score,
                )

            db.add(result)
            query_results.append(result)

            # Only count successful results in aggregates
            if not error and response_text:
                total_successful += 1
                if result.mentioned:
                    total_mentioned += 1
                if result.score is not None:
                    total_scores.append(result.score)

    # Compute aggregate scores from successful results only
    visibility_score = round(sum(total_scores) / len(total_scores), 1) if total_scores else 0.0
    mention_rate = round((total_mentioned / total_successful) * 100, 1) if total_successful > 0 else 0.0

    scan.visibility_score = visibility_score
    scan.mention_rate = mention_rate
    scan.status = ScanStatus.completed
    scan.completed_at = _utcnow()

    logger.info("Scan %s committing: score=%.1f mention_rate=%.1f successful=%d", scan.id, visibility_score, mention_rate, total_successful)
    await db.commit()
    await db.refresh(scan)
    logger.info("Scan %s committed successfully", scan.id)
    return scan


async def generate_query_suggestions(brand_name: str, domain: str, keywords: list[str]) -> list[str]:
    """
    Crawl the brand's website starting from the landing page, following internal links
    to build a rich content profile. Generates domain-aware query suggestions.
    """
    import json, re
    from urllib.parse import urljoin, urlparse
    import httpx as _httpx

    MAX_PAGES = 6
    MAX_CONTENT_PER_PAGE = 1500
    MAX_TOTAL_CONTENT = 6000
    BASE_URL = f"https://{domain}" if not domain.startswith("http") else domain
    parsed_base = urlparse(BASE_URL)
    base_domain = parsed_base.netloc

    # Priority paths to crawl if found as links
    PRIORITY_PATHS = ["/about", "/product", "/products", "/pricing", "/features", "/solutions", "/docs", "/use-cases", "/customers"]

    visited: set[str] = set()
    all_content: list[str] = []

    def is_internal(url: str) -> bool:
        parsed = urlparse(url)
        return parsed.netloc == "" or parsed.netloc == base_domain

    def extract_text(html: str) -> str:
        html = re.sub(r"<(script|style|noscript|svg)\b[^>]*>.*?</\1>", "", html, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r"<[^>]+>", " ", html)
        text = re.sub(r"\s+", " ", text).strip()
        return text[:MAX_CONTENT_PER_PAGE]

    def extract_links(html: str, base_url: str) -> list[str]:
        links = re.findall(r'href=["\']([^"\']+)["\']', html, re.IGNORECASE)
        urls = []
        for link in links:
            if link.startswith(("#", "javascript:", "mailto:", "tel:")):
                continue
            full = urljoin(base_url, link)
            if is_internal(full) and full not in visited:
                # Strip fragments and trailing slashes for dedup
                clean = urlparse(full)._replace(fragment="").geturl().rstrip("/")
                urls.append(clean)
        return urls

    try:
        async with _httpx.AsyncClient(timeout=8, follow_redirects=True, headers={"User-Agent": "Mozilla/5.0 (compatible; LLMRank/1.0)"}) as client:
            # Crawl starting from landing page
            to_visit = [BASE_URL.rstrip("/")]
            all_links: list[str] = []

            while to_visit and len(visited) < MAX_PAGES:
                url = to_visit.pop(0)
                if url in visited:
                    continue
                visited.add(url)

                try:
                    resp = await client.get(url)
                    if resp.status_code != 200:
                        continue
                    html = resp.text
                    text = extract_text(html)
                    if len(text) > 100:
                        all_content.append(f"[{urlparse(url).path or '/'}] {text}")
                    # Collect links for next pages
                    links = extract_links(html, url)
                    all_links.extend(links)
                except Exception as e:
                    logger.debug("Failed to crawl %s: %s", url, e)
                    continue

            # Add priority pages if not yet visited
            if len(visited) < MAX_PAGES:
                for path in PRIORITY_PATHS:
                    if len(visited) >= MAX_PAGES:
                        break
                    candidate = f"{BASE_URL.rstrip('/')}{path}"
                    if candidate not in visited and candidate in all_links:
                        to_visit.append(candidate)
                        try:
                            resp = await client.get(candidate)
                            if resp.status_code == 200:
                                text = extract_text(resp.text)
                                if len(text) > 100:
                                    all_content.append(f"[{path}] {text}")
                                    visited.add(candidate)
                        except Exception:
                            pass

    except Exception as e:
        logger.warning("Failed to crawl %s: %s", BASE_URL, e)

    # Combine all content, respect total limit
    combined = "\n\n".join(all_content)[:MAX_TOTAL_CONTENT]
    logger.info("Crawled %d pages from %s (%d chars of content)", len(visited), base_domain, len(combined))

    # Build prompt
    context_block = f"\n\nWebsite content (crawled {len(visited)} pages):\n{combined}" if combined else ""
    keyword_block = f"\n\nContext keywords: {', '.join(keywords)}" if keywords else ""

    prompt = f"""You are an SEO expert. Based on the crawled content from "{brand_name}" (website: {domain}), generate 12 realistic search queries that potential customers would ask an AI assistant (like ChatGPT or Google Gemini) when looking for the products, services, or tools this company offers.{context_block}{keyword_block}

Requirements:
- Queries must be directly relevant to what this company actually does/sells (based on the crawled content)
- Natural, conversational questions a real user would ask
- Mix of: "best X for Y", "X vs Y", "how to do Z", "tool for Z", "alternatives to X"
- Do NOT include the brand name — these are queries where the brand SHOULD appear organically
- Return ONLY a JSON array of strings, no explanation

Example: ["best project management tool for startups", "how to organize team tasks efficiently", ...]"""

    # Try LLMs — Gemini (free) → Groq (free) → OpenAI (paid, more reliable)
    from app.services.llm_adapters import GeminiAdapter, GroqAdapter, OpenAIAdapter

    for adapter_cls in [GeminiAdapter, GroqAdapter, OpenAIAdapter]:
        try:
            adapter = adapter_cls()
            response = await adapter.query(prompt)
            match = re.search(r"\[.*?\]", response, re.DOTALL)
            if match:
                queries = json.loads(match.group())
                results = [q for q in queries if isinstance(q, str)][:12]
                if results:
                    logger.info("Generated %d domain-aware queries for %s via %s", len(results), domain, adapter.name)
                    return results
        except Exception as e:
            logger.warning("Query generation failed with %s: %s", adapter_cls.__name__, e)

    return []
