"""Brand classification and competitor discovery via LLMs."""
import re
import time
import json
import logging
from datetime import datetime, timezone

import httpx

logger = logging.getLogger(__name__)

_PLACEHOLDER_NAMES = {"branda", "brandb", "brandc", "brand1", "brand2", "competitor1", "competitor2", "competitora", "competitorb", "company1", "company2", "companyx", "companyy", "clienta", "clientb"}

_VALID_TLDS = {"com", "io", "co", "net", "org", "ai", "dev", "app", "us", "uk", "ca", "de", "fr", "jp", "cn", "in", "br", "au", "ru", "xyz", "me", "tv", "cc", "shop", "site", "online", "tech", "store", "cloud"}


def _is_valid_competitor(name: str) -> bool:
    """Reject obviously fake placeholder competitor names."""
    lower = name.lower().strip()
    if lower in _PLACEHOLDER_NAMES:
        return False
    if re.match(r"^(brand|competitor|company|client|product|vendor|provider)[a-z0-9]*$", lower):
        return False
    if len(lower) <= 1:
        return False
    return True


def _is_valid_domain(domain: str) -> bool:
    """Validate a domain string looks real (not hallucinated by LLM)."""
    if not domain or "." not in domain:
        return False
    tld = domain.rsplit(".", 1)[-1].lower()
    return tld in _VALID_TLDS


def _clean_competitor(c: dict) -> dict | None:
    """Validate and clean a competitor dict from LLM response. Returns None if invalid."""
    name = c.get("name", "").strip()
    if not _is_valid_competitor(name):
        return None
    domain = c.get("domain", "").strip()
    if domain and not _is_valid_domain(domain):
        domain = ""  # drop hallucinated domains
    return {"name": name, "domain": domain, "relevance_score": c.get("relevance_score", 3)}


async def classify_brand(content: str, brand_name: str, domain: str, client) -> dict:
    from app.services.llm_core import _call_openrouter, _parse_json
    messages = [
        {"role": "developer", "content": "Return ONLY a valid JSON object. No text, no markdown, no explanation."},
        {"role": "user", "content": (
            f"Classify {brand_name} ({domain}) based on this content:\n\n"
            f"<content>{content[:3000]}</content>\n\n"
            f'Return exactly: {{"industry":"...","sub_category":"...","price_tier":"...","target_audience":"...","key_features":["..."]}}'
        )},
    ]
    for model in ["chatgpt"]:
        try:
            resp = await _call_openrouter(messages, model, client, temperature=0.2, max_tokens=512)
            return _parse_json(resp)
        except Exception:
            continue
    return {"industry": "unknown", "sub_category": "", "price_tier": "", "target_audience": "", "key_features": []}


async def discover_competitors_from_crawl(content: str, client) -> list[dict]:
    from app.services.llm_core import _call_openrouter, _parse_json
    messages = [
        {"role": "developer", "content": "Return ONLY a valid JSON array. No text, no markdown, no explanation."},
        {"role": "user", "content": (
            f"From this company's website content, identify competing brands mentioned, compared to, or referenced.\n\n"
            f"<content>{content[:3000]}</content>\n\n"
            f'Return: [{{"name":"BrandName","domain":"domain.com","relevance_score":1-5}}]\n'
            f'Maximum 10 entries. Only include real brand names, not generic terms like "competitors" or "alternatives".'
        )},
    ]
    for model in ["chatgpt"]:
        try:
            resp = await _call_openrouter(messages, model, client, temperature=0.2, max_tokens=1024)
            result = _parse_json(resp)
            if isinstance(result, list):
                cleaned = [c for c in (_clean_competitor(item) for item in result if isinstance(item, dict)) if c]
                return cleaned[:10]
        except Exception:
            continue
    return []


async def discover_competitors_by_category(classification: dict, client, country: str = "") -> list[dict]:
    from app.services.llm_core import _call_openrouter, _parse_json
    country_hint = f" The brand is based in {country}. Prefer competitors from the same country when known." if country else ""
    messages = [
        {"role": "developer", "content": "Return ONLY a valid JSON array. No text, no markdown, no explanation. Return [] if you don't know any."},
        {"role": "user", "content": (
            f"Name real competitors in the {classification.get('industry','')} industry, "
            f"sub-category: {classification.get('sub_category','')}, "
            f"target audience: {classification.get('target_audience','')}.{country_hint}\n\n"
            f'Return: [{{"name":"BrandName","domain":"domain.com","relevance_score":1-5}}]\n'
            f'IMPORTANT: Only include real, verified brands. If you are not sure about a competitor, leave it out. '
            f'It is better to return [] than to make up names.'
        )},
    ]
    for model in ["chatgpt"]:
        try:
            resp = await _call_openrouter(messages, model, client, temperature=0.3, max_tokens=1024)
            result = _parse_json(resp)
            if isinstance(result, list):
                cleaned = [c for c in (_clean_competitor(item) for item in result if isinstance(item, dict)) if c]
                if country:
                    country_lower = country.lower()
                    same_country = [c for c in cleaned if country_lower in c.get("domain", "").lower().split(".")[-1]]
                    other = [c for c in cleaned if country_lower not in c.get("domain", "").lower().split(".")[-1]]
                    cleaned = same_country + other
                return cleaned[:10]
        except Exception:
            continue
    return []


async def crawl_competitor_sites(competitors: list[dict], max_sites: int = 5) -> list[dict]:
    from urllib.parse import urljoin
    results = []
    async with httpx.AsyncClient(timeout=10, follow_redirects=True, headers={"User-Agent": "LLMRanked/1.0"}) as client:
        for comp in competitors[:max_sites]:
            domain = comp.get("domain", "")
            if not domain:
                continue
            url = f"https://{domain}" if not domain.startswith("http") else domain
            try:
                resp = await client.get(url)
                if resp.status_code == 200:
                    html = resp.text
                    text = re.sub(r"<(script|style|noscript)\b[^>]*>.*?</\1>", "", html, flags=re.DOTALL | re.IGNORECASE)
                    text = re.sub(r"<[^>]+>", " ", text)
                    text = re.sub(r"\s+", " ", text).strip()[:3000]
                    comp["crawled_content"] = text
                    comp["crawled_at"] = datetime.now(timezone.utc).isoformat()

                    # Extract favicon/logo
                    favicon = ""
                    for pattern in [
                        r'<link[^>]*rel=["\'](?:shortcut )?icon["\'][^>]*href=["\']([^"\']+)["\']',
                        r'<link[^>]*href=["\']([^"\']+)["\'][^>]*rel=["\'](?:shortcut )?icon["\']',
                        r'<link[^>]*rel=["\']apple-touch-icon["\'][^>]*href=["\']([^"\']+)["\']',
                        r'<link[^>]*href=["\']([^"\']+)["\'][^>]*rel=["\']apple-touch-icon["\']',
                    ]:
                        m = re.search(pattern, html, re.IGNORECASE)
                        if m:
                            favicon = urljoin(url, m.group(1))
                            break
                    if not favicon:
                        favicon = urljoin(url, "/favicon.ico")
                    comp["logo_url"] = favicon
            except Exception:
                comp["crawled_content"] = ""
                comp["crawled_at"] = datetime.now(timezone.utc).isoformat()
                comp["logo_url"] = ""
            results.append(comp)
    return results


def competitors_need_refresh(competitors: list[dict], ttl_days: int = 7) -> bool:
    if not competitors:
        return True
    cutoff = time.time() - (ttl_days * 86400)
    for comp in competitors:
        fetched = comp.get("crawled_at")
        if not fetched:
            return True
        try:
            dt = datetime.fromisoformat(fetched)
            if dt.tzinfo is None:
                from datetime import timezone
                dt = dt.replace(tzinfo=timezone.utc)
            import calendar
            if calendar.timegm(dt.timetuple()) < cutoff:
                return True
        except Exception:
            return True
    return False


def _name_variants(name: str) -> list[str]:
    """Generate search-friendly variants of a competitor name."""
    import re
    lower = name.lower()
    variants = [lower]
    # Handle & vs "and"
    if "&" in lower:
        variants.append(lower.replace("&", "and"))
    if " and " in lower:
        variants.append(lower.replace(" and ", "&"))
    # Split camelCase or PascalCase
    split = re.sub(r"([a-z])([A-Z])", r"\1 \2", name)
    if split != name:
        variants.append(split.lower())
    # Generate abbreviation from initials (e.g., "Weights & Biases" -> "wb", "w&b", "w and b")
    words = re.split(r"[\s&]+", lower)
    if len(words) >= 2:
        initials = "".join(w[0] for w in words if w)
        variants.append(initials)
        variants.append(initials.replace(" ", ""))
        # Also try with & between initials
        variants.append("&".join(w[0] for w in words if w))
        variants.append("and".join(w[0] for w in words if w))
    return list(set(variants))


def _name_matches(name: str, text: str) -> bool:
    """Check if a competitor name appears in text, with fuzzy matching."""
    text_lower = text.lower()
    name_lower = name.lower()
    # Exact match
    if name_lower in text_lower:
        return True
    # Try variants
    for variant in _name_variants(name):
        if variant in text_lower:
            return True
    # Check if all words from name appear in text
    import re
    name_words = set(re.split(r"[\s&]+", name_lower))
    text_words = set(re.split(r"[\s&]+", text_lower))
    if len(name_words) > 1 and name_words.issubset(text_words):
        return True
    return False


async def fill_missing_domains(competitors: list[dict], industry: str = "") -> list[dict]:
    """Look up domains for competitors that don't have one via web search."""
    try:
        from ddgs import DDGS
    except ImportError:
        logger.warning("ddgs not installed — cannot fill missing domains")
        return competitors

    for comp in competitors:
        if comp.get("domain"):
            continue
        name = comp.get("name", "")
        if not name:
            continue

        found = False
        # Try multiple query variations
        queries = [
            f"{name} official website",
            f"{name} {industry} company".strip() if industry else None,
            f"{name} homepage",
        ]
        queries = [q for q in queries if q]

        for query in queries:
            if found:
                break
            try:
                with DDGS() as ddgs:
                    results = list(ddgs.text(query, max_results=5))
                for r in results:
                    href = r.get("href", "")
                    title = r.get("title", "")
                    snippet = r.get("body", "")
                    # Extract domain from URL
                    from urllib.parse import urlparse
                    parsed = urlparse(href)
                    domain = parsed.netloc.lower().replace("www.", "")
                    if not domain or "." not in domain or not _is_valid_domain(domain):
                        continue
                    # Reject obviously wrong results
                    skip_domains = {"wikipedia.org", "linkedin.com", "twitter.com", "x.com",
                                    "facebook.com", "instagram.com", "youtube.com", "reddit.com"}
                    if any(skip in domain for skip in skip_domains):
                        continue
                    # Flexible name matching
                    if _name_matches(name, title + " " + snippet):
                        comp["domain"] = domain
                        found = True
                        logger.info("Filled domain for %s: %s (query: %s)", name, domain, query)
                        break
            except Exception as e:
                logger.debug("Domain lookup failed for %s (query: %s): %s", name, query, e)
                continue

        if not found:
            logger.warning("Could not find domain for competitor: %s", name)

    return competitors
