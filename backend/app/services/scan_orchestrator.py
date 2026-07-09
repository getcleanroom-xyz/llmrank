import asyncio
import uuid
import logging
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text

from app.models.models import Brand, MonitoredQuery, Scan, QueryResult, ScanStatus
from app.services.llm_adapters import query_llm, OpenRouterAdapter, MODEL_REGISTRY
from app.services.ranking_engine import rank_response

logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


async def _keepalive_ping(db: AsyncSession, scan_id: uuid.UUID, stop_event: asyncio.Event):
    while not stop_event.is_set():
        try:
            await asyncio.wait_for(stop_event.wait(), timeout=30)
        except asyncio.TimeoutError:
            pass
        if stop_event.is_set():
            break
        try:
            await db.execute(text("SELECT 1"))
        except Exception:
            logger.warning("Keepalive ping failed for scan %s", scan_id)
            break


def _make_prompt(query_text: str) -> str:
    return f"""You are a helpful assistant. A user is asking for recommendations.

User question: {query_text}

Please list the best options with your reasoning."""


async def _fire_all_llms(
    queries: list[MonitoredQuery],
    llm_names: list[str],
    client,
) -> list[tuple[str, str, str, str | None]]:
    """Fire every (query, llm) pair concurrently. Returns [(query_id, llm_name, response, error), ...]."""

    async def _call(q_id: str, q_text: str, llm: str):
        prompt = _make_prompt(q_text)
        adapter = OpenRouterAdapter(llm, client=client)
        try:
            response = await adapter.query(prompt)
            return (q_id, llm, response, None)
        except Exception as e:
            return (q_id, llm, "", str(e))

    tasks = [
        _call(str(q.id), q.query_text, llm)
        for q in queries
        for llm in llm_names
    ]
    results = await asyncio.gather(*tasks, return_exceptions=False)
    return results


async def run_scan(
    brand_id: uuid.UUID,
    db: AsyncSession,
    llm_names: list[str] | None = None,
    scan_id: uuid.UUID | None = None,
) -> Scan:
    if llm_names is None:
        llm_names = ["chatgpt", "llama"]

    brand_result = await db.execute(select(Brand).where(Brand.id == brand_id))
    brand = brand_result.scalar_one_or_none()
    if not brand:
        raise ValueError(f"Brand {brand_id} not found")

    queries_result = await db.execute(
        select(MonitoredQuery)
        .where(MonitoredQuery.brand_id == brand_id, MonitoredQuery.is_active == True)
    )
    queries = queries_result.scalars().all()
    if not queries:
        raise ValueError("No active queries for this brand")

    if scan_id:
        scan_result = await db.execute(select(Scan).where(Scan.id == scan_id))
        scan = scan_result.scalar_one_or_none()
        if scan:
            scan.status = ScanStatus.running
            scan.started_at = _utcnow()
        else:
            scan = Scan(id=scan_id, brand_id=brand_id, status=ScanStatus.running, started_at=_utcnow())
            db.add(scan)
    else:
        scan = Scan(id=uuid.uuid4(), brand_id=brand_id, status=ScanStatus.running, started_at=_utcnow())
        db.add(scan)
    await db.flush()

    logger.info("Scan %s: firing %d queries × %d LLMs = %d calls in parallel",
                 scan.id, len(queries), len(llm_names), len(queries) * len(llm_names))

    stop_event = asyncio.Event()
    keepalive_task = asyncio.create_task(_keepalive_ping(db, scan.id, stop_event))

    # Fire ALL LLMs for ALL queries concurrently using a shared httpx client
    import httpx as _httpx
    async with _httpx.AsyncClient(timeout=45) as client:
        raw_results = await _fire_all_llms(queries, llm_names, client)

    # Stop keepalive
    stop_event.set()
    keepalive_task.cancel()
    try:
        await keepalive_task
    except asyncio.CancelledError:
        pass

    # Process all results
    all_results: list[QueryResult] = []
    total_scores: list[float] = []
    total_mentioned = 0
    total_successful = 0

    for q_id, llm_name, response_text, error in raw_results:
        if error or not response_text:
            result = QueryResult(
                id=uuid.uuid4(), scan_id=scan.id,
                query_id=uuid.UUID(q_id), llm_name=llm_name,
                raw_response=f"[Error: {error}]" if error else "[Empty response]",
                mentioned=False, position=None, sentiment="not_mentioned",
                competitors_mentioned=[], annotated_response=None, score=None,
            )
        else:
            ranking = rank_response(brand.name, brand.domain, response_text)
            result = QueryResult(
                id=uuid.uuid4(), scan_id=scan.id,
                query_id=uuid.UUID(q_id), llm_name=llm_name,
                raw_response=response_text,
                mentioned=ranking.mentioned, position=ranking.position,
                sentiment=ranking.sentiment,
                competitors_mentioned=ranking.competitors,
                annotated_response=ranking.annotated_spans,
                score=ranking.score,
            )

        all_results.append(result)
        if not error and response_text:
            total_successful += 1
            if result.mentioned:
                total_mentioned += 1
            if result.score is not None:
                total_scores.append(result.score)

    # Batch insert all results
    db.add_all(all_results)

    visibility_score = round(sum(total_scores) / len(total_scores), 1) if total_scores else 0.0
    mention_rate = round((total_mentioned / total_successful) * 100, 1) if total_successful > 0 else 0.0

    scan.visibility_score = visibility_score
    scan.mention_rate = mention_rate
    scan.status = ScanStatus.completed
    scan.completed_at = _utcnow()

    logger.info("Scan %s: score=%.1f mention_rate=%.1f successful=%d/%d",
                 scan.id, visibility_score, mention_rate, total_successful, len(all_results))
    await db.commit()
    await db.refresh(scan)
    return scan


async def generate_query_suggestions(brand_name: str, domain: str, keywords: list[str]) -> list[str]:
    import json, re
    from urllib.parse import urljoin, urlparse
    import httpx as _httpx

    MAX_PAGES = 6
    MAX_CONTENT_PER_PAGE = 1500
    MAX_TOTAL_CONTENT = 6000
    BASE_URL = f"https://{domain}" if not domain.startswith("http") else domain
    parsed_base = urlparse(BASE_URL)
    base_domain = parsed_base.netloc

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
                clean = urlparse(full)._replace(fragment="").geturl().rstrip("/")
                urls.append(clean)
        return urls

    try:
        async with _httpx.AsyncClient(timeout=8, follow_redirects=True, headers={"User-Agent": "Mozilla/5.0 (compatible; LLMRank/1.0)"}) as client:
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
                    links = extract_links(html, url)
                    all_links.extend(links)
                except Exception as e:
                    logger.debug("Failed to crawl %s: %s", url, e)
                    continue

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

    combined = "\n\n".join(all_content)[:MAX_TOTAL_CONTENT]
    logger.info("Crawled %d pages from %s (%d chars)", len(visited), base_domain, len(combined))

    keyword_block = f"\n\nContext keywords: {', '.join(keywords)}" if keywords else ""
    has_useful_content = len(combined) >= 300

    async def _web_search_context(query: str, max_results: int = 5) -> list[str]:
        snippets: list[str] = []
        try:
            async with _httpx.AsyncClient(timeout=10, follow_redirects=False) as client:
                resp = await client.post(
                    "https://html.duckduckgo.com/html/",
                    data={"q": query},
                    headers={
                        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
                        "Content-Type": "application/x-www-form-urlencoded",
                        "Accept": "text/html",
                    },
                )
                if resp.status_code == 200:
                    snippets = re.findall(r'<a[^>]*class="result__snippet"[^>]*>(.*?)</a>', resp.text, re.DOTALL | re.IGNORECASE)
                    if not snippets:
                        snippets = re.findall(r'class="result__snippet"[^>]*>(.*?)</(?:a|span|div)>', resp.text, re.DOTALL | re.IGNORECASE)
                    snippets = [re.sub(r"<[^>]+>", "", s).strip() for s in snippets]
                    snippets = [s for s in snippets if len(s) > 15][:max_results]
        except Exception as e:
            logger.warning("Web search failed: %s", e)
        return snippets

    web_context = ""
    if not has_useful_content:
        search_results = await _web_search_context(f"{brand_name} {domain}")
        if search_results:
            web_context = "Web search context:\n" + "\n".join(f"- {s}" for s in search_results)
            logger.info("Got %d web search snippets for %s", len(search_results), domain)
        else:
            try:
                async with _httpx.AsyncClient(timeout=5, follow_redirects=True, headers={"User-Agent": "Mozilla/5.0"}) as c:
                    r = await c.get(BASE_URL)
                    m = re.search(r'<meta\s+name=["\']description["\']\s+content=["\']([^"\']+)["\']', r.text, re.IGNORECASE)
                    if m:
                        web_context = f"Tagline: {m.group(1)}"
            except Exception:
                pass

    content_signal = combined if has_useful_content else f"Brand name: {brand_name} | Domain: {domain}\n\n{web_context}".strip()
    content_label = "crawled website content" if has_useful_content else ("brand signals + web search results" if web_context else "brand signals (name, domain)")

    prompt = f"""You are an SEO expert. Based on the following {content_label}, generate 12 realistic search queries that potential customers would ask an AI assistant when looking for the products, services, or tools this company offers.

{content_signal}{keyword_block}

Requirements:
- Queries must be directly relevant to what this company actually does/sells
- Natural, conversational questions a real user would ask
- Mix of: "best X for Y", "X vs Y", "how to do Z", "tool for Z", "alternatives to X"
- Do NOT include the brand name
- Return ONLY a JSON array of strings, no explanation

Example: ["best project management tool for startups", "how to organize team tasks efficiently", ...]"""

    for model_key in ["llama", "chatgpt", "gemini"]:
        try:
            adapter = OpenRouterAdapter(model_key)
            response = await adapter.query(prompt)
            match = re.search(r"\[.*?\]", response, re.DOTALL)
            if match:
                queries = json.loads(match.group())
                results = [q for q in queries if isinstance(q, str)][:12]
                if results:
                    logger.info("Generated %d domain-aware queries for %s via %s", len(results), domain, model_key)
                    return results
        except Exception as e:
            logger.warning("Query generation failed with %s: %s", model_key, e)

    return []
