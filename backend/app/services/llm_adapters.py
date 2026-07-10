"""Centralized LLM interaction: scan queries, competitor discovery, query generation."""
import asyncio
import hashlib
import hmac
import base64
import json
import re
import time
import secrets
import logging
from datetime import datetime, timezone
from typing import Optional

import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)

# ─── Model Registry ────────────────────────────────────────────────────────────

MODEL_REGISTRY: dict[str, dict] = {
    "chatgpt":     {"id": "openai/gpt-4o-mini",              "label": "GPT-4o Mini"},
    "gpt4o":       {"id": "openai/gpt-4o",                   "label": "GPT-4o"},
    "gemini":      {"id": "google/gemini-2.5-flash",          "label": "Gemini 2.5 Flash"},
    "llama":       {"id": "meta-llama/llama-3.3-70b-instruct","label": "Llama 3.3 70B"},
    "llama-small": {"id": "meta-llama/llama-3.1-8b-instruct", "label": "Llama 3.1 8B"},
    "claude":      {"id": "anthropic/claude-haiku-4.5",       "label": "Claude Haiku"},
    "deepseek":    {"id": "deepseek/deepseek-chat",           "label": "DeepSeek Chat"},
    "deepseek-r1": {"id": "deepseek/deepseek-r1",             "label": "DeepSeek R1"},
    "mistral":     {"id": "mistralai/mistral-large",          "label": "Mistral Large"},
    "qwen":        {"id": "qwen/qwen-2.5-72b-instruct",       "label": "Qwen 2.5 72B"},
}

ALL_LLM_KEYS = list(MODEL_REGISTRY.keys())

# ─── Prompts ───────────────────────────────────────────────────────────────────

SCAN_DEVELOPER = (
    "You are a product recommendation engine. A user has asked a question. "
    "Return ONLY a valid JSON object with this exact schema:\n"
    '{"items":[{"name":"Product Name","position":1,"description":"one sentence why"}],'
    '"brand_mentioned":true_or_false,'
    '"brand_position":1_or_null,'
    '"brand_sentiment":"positive"|"neutral"|"negative"|"not_mentioned",'
    '"competitors":["Brand1","Brand2"],'
    '"summary":"natural language summary of the recommendation"}\n'
    "No text, no markdown, no explanation. Only the JSON object."
)

CLASSIFY_DEVELOPER = (
    "Classify this company from its website content. Return ONLY a valid JSON object: "
    '{"industry":"...","sub_category":"...","price_tier":"...","target_audience":"...","key_features":["..."]} '
    "No preamble, no markdown."
)

DISCOVER_FROM_CRAWL_DEVELOPER = (
    "Extract competing brand names and their approximate domains from this company's website content. "
    "Return ONLY a valid JSON array of objects with keys: name, domain. Max 10. No preamble."
)

CATEGORY_COMPETITORS_DEVELOPER = (
    "Given a company in the <industry> industry, sub-category <sub_category>, with target audience <audience>, "
    "name the top 10 direct competitors or alternatives. Return ONLY a valid JSON array of objects with keys: "
    "name, domain (if known), relevance_score (1-5). No preamble."
)

SCORED_QUERY_DEVELOPER = (
    "You are a GEO expert generating queries for AI assistants like ChatGPT. "
    "Generate queries targeting these types: brand_category, workflow, competitor, adjacent. "
    "Self-score each query 1-5 based on naturalness and specificity. "
    "Return ONLY a valid JSON array: [{\"query_text\":\"...\",\"query_type\":\"...\",\"score\":N}]. "
    "Generate 25+ queries. No preamble, no markdown."
)

PROBE_DEVELOPER = (
    "Analyze these probe scan results. Return ONLY a valid JSON object: "
    '{"insights":[{"query_text":"...","brand_overmentioned":bool,"competitors_found":["..."],"recommendation":"keep"|"drop"|"refine"}],'
    '"summary":"..."} No preamble.'
)

# ─── HTTP ──────────────────────────────────────────────────────────────────────

_token_cache: dict = {"access_token": None, "expires_at": 0}


def _base_url() -> str:
    if getattr(settings, "FLW_SANDBOX", False):
        return "https://developersandbox-api.flutterwave.com"
    return "https://f4bexperience.flutterwave.com"


async def _get_access_token() -> str:
    now = time.time()
    if _token_cache["access_token"] and _token_cache["expires_at"] > now + 60:
        return _token_cache["access_token"]
    if not getattr(settings, "FLW_CLIENT_ID", "") or not getattr(settings, "FLW_CLIENT_SECRET", ""):
        raise ValueError("FLW_CLIENT_ID and FLW_CLIENT_SECRET required")
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            "https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token",
            data={"client_id": settings.FLW_CLIENT_ID, "client_secret": settings.FLW_CLIENT_SECRET, "grant_type": "client_credentials"},
        )
        data = resp.json()
        if resp.status_code != 200 or "access_token" not in data:
            raise ValueError("Failed to get Flutterwave token")
        _token_cache["access_token"] = data["access_token"]
        _token_cache["expires_at"] = now + data.get("expires_in", 600)
    return _token_cache["access_token"]


def verify_flutterwave_signature(payload: bytes, signature: str, secret_hash: str) -> bool:
    if not secret_hash:
        return True
    expected = base64.b64encode(hmac.new(secret_hash.encode(), payload, hashlib.sha256).digest()).decode()
    return hmac.compare_digest(expected, signature)


# ─── OpenRouter ────────────────────────────────────────────────────────────────

class OpenRouterAdapter:
    """Backward-compatible adapter for old code paths."""
    def __init__(self, model_key: str, client=None):
        self.model_key = model_key
        self._client = client

    async def query(self, prompt: str) -> str:
        async with httpx.AsyncClient(timeout=30) as client:
            return await _call_openrouter(
                [{"role": "user", "content": prompt}],
                self.model_key,
                self._client or client,
            )


async def _call_openrouter(messages: list[dict], model_key: str, client, temperature: float = 0.3, max_tokens: int = 1024) -> str:
    if not settings.OPENROUTER_API_KEY:
        raise ValueError("OPENROUTER_API_KEY not configured")
    model = MODEL_REGISTRY[model_key]
    payload = {"model": model["id"], "messages": messages, "temperature": temperature, "max_tokens": max_tokens}
    headers = {"Authorization": f"Bearer {settings.OPENROUTER_API_KEY}", "HTTP-Referer": "https://llmrank.dev", "X-Title": "LLMRank", "Content-Type": "application/json"}
    resp = await client.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=payload)
    resp.raise_for_status()
    data = resp.json()
    choices = data.get("choices")
    if not choices:
        raise ValueError(f"{model['label']} returned no choices")
    content = choices[0].get("message", {}).get("content")
    if not content:
        raise ValueError(f"{model['label']} returned empty content")
    return content


def _parse_json(text: str) -> any:
    """Safely extract JSON from LLM response. Tries direct parse, then regex fallback."""
    try:
        return json.loads(text)
    except (json.JSONDecodeError, TypeError):
        pass
    match = re.search(r"```json\s*(.*?)\s*```", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except (json.JSONDecodeError, TypeError):
            pass
    match = re.search(r"(\[.*\]|\{.*\})", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except (json.JSONDecodeError, TypeError):
            pass
    raise ValueError("No valid JSON found in LLM response")


# ─── Scan ──────────────────────────────────────────────────────────────────────

async def scan_query(query_text: str, llm_name: str, client) -> tuple[Optional[dict], Optional[str]]:
    """Query an LLM for a scan. Returns (parsed_json, error_message)."""
    messages = [
        {"role": "developer", "content": SCAN_DEVELOPER},
        {"role": "user", "content": f"<query>{query_text}</query>"},
    ]
    for attempt in range(3):
        try:
            resp = await _call_openrouter(messages, llm_name, client)
            try:
                return _parse_json(resp), None
            except ValueError:
                # Fallback: treat as raw text and build a minimal JSON
                return {
                    "items": [{"name": line.strip(), "position": i + 1, "description": ""}
                               for i, line in enumerate(resp.strip().split("\n")) if line.strip()],
                    "brand_mentioned": None, "brand_position": None,
                    "brand_sentiment": "not_mentioned", "competitors": [],
                    "summary": resp[:500],
                }, None
        except httpx.HTTPStatusError as e:
            status = e.response.status_code
            if status == 429:
                return None, f"{llm_name} rate limited"
            if status == 503 and attempt < 2:
                await asyncio.sleep(2 * (2 ** attempt))
                continue
            return None, str(e)
        except Exception as e:
            return None, str(e)
    return None, f"{llm_name} unavailable after retries"


async def scan_all_llms(queries: list[tuple[str, str]], llm_names: list[str], client) -> list[tuple[str, str, dict | None, Optional[str]]]:
    """Returns [(query_id, llm_name, result_dict_or_None, error_or_None)]."""
    tasks = [scan_query(q_text, llm, client) for q_id, q_text in queries for llm in llm_names]
    results = await asyncio.gather(*tasks, return_exceptions=False)
    out = []
    idx = 0
    for q_id, _ in queries:
        for llm in llm_names:
            result, error = results[idx]
            out.append((q_id, llm, result, error))
            idx += 1
    return out


# ─── Brand Classification ─────────────────────────────────────────────────────

async def classify_brand(content: str, brand_name: str, domain: str, client) -> dict:
    """Classify brand using structured JSON output."""
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


# ─── Competitor Discovery ─────────────────────────────────────────────────────

async def discover_competitors_from_crawl(content: str, client) -> list[dict]:
    """Extract competitors from the brand's website content using structured JSON."""
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
                return result[:10]
        except Exception:
            continue
    return []


async def discover_competitors_by_category(classification: dict, client) -> list[dict]:
    """Get category-typical competitors using structured JSON."""
    messages = [
        {"role": "developer", "content": "Return ONLY a valid JSON array. No text, no markdown, no explanation."},
        {"role": "user", "content": (
            f"List the top 10 known competitors in the {classification.get('industry','')} industry, "
            f"sub-category: {classification.get('sub_category','')}, "
            f"target audience: {classification.get('target_audience','')}.\n\n"
            f'Return: [{{"name":"BrandName","domain":"domain.com","relevance_score":1-5}}]\n'
            f'Include real brand names only. No generic category terms.'
        )},
    ]
    for model in ["chatgpt"]:
        try:
            resp = await _call_openrouter(messages, model, client, temperature=0.3, max_tokens=1024)
            result = _parse_json(resp)
            if isinstance(result, list):
                return result[:10]
        except Exception:
            continue
    return []


async def crawl_competitor_sites(competitors: list[dict], max_sites: int = 5) -> list[dict]:
    """Crawl competitor websites to get their content profiles for TTL-based caching."""
    from urllib.parse import urlparse
    results = []
    async with httpx.AsyncClient(timeout=10, follow_redirects=True, headers={"User-Agent": "LLMRank/1.0"}) as client:
        for comp in competitors[:max_sites]:
            domain = comp.get("domain", "")
            if not domain:
                continue
            url = f"https://{domain}" if not domain.startswith("http") else domain
            try:
                resp = await client.get(url)
                if resp.status_code == 200:
                    text = re.sub(r"<(script|style|noscript)\b[^>]*>.*?</\1>", "", resp.text, flags=re.DOTALL | re.IGNORECASE)
                    text = re.sub(r"<[^>]+>", " ", text)
                    text = re.sub(r"\s+", " ", text).strip()[:3000]
                    comp["crawled_content"] = text
                    comp["crawled_at"] = datetime.now(timezone.utc).isoformat()
            except Exception:
                comp["crawled_content"] = ""
                comp["crawled_at"] = datetime.now(timezone.utc).isoformat()
            results.append(comp)
    return results


def competitors_need_refresh(competitors: list[dict], ttl_days: int = 7) -> bool:
    """Check if any competitor data is older than the TTL."""
    if not competitors:
        return True
    cutoff = time.time() - (ttl_days * 86400)
    for comp in competitors:
        fetched = comp.get("crawled_at")
        if not fetched:
            return True
        try:
            if time.mktime(datetime.fromisoformat(fetched).timetuple()) < cutoff:
                return True
        except Exception:
            return True
    return False


# ─── Query Generation ──────────────────────────────────────────────────────────

async def generate_scored_queries(brand_name: str, domain: str, classification: dict, competitors: list[dict], client) -> list[dict]:
    """Agent loop: generate queries, score, dedup, regenerate weak ones."""
    comp_str = ", ".join(c.get("name", "") for c in competitors[:8])
    user_msg = (
        f"Generate 30 queries for {brand_name} ({domain}) targeting these types: brand_category, workflow, competitor, adjacent.\n\n"
        f"Classification: {json.dumps(classification)}\n"
        f"Known competitors: {comp_str}\n\n"
        f"RULES:\n"
        f"- Do NOT include the brand name ({brand_name}) in any query\n"
        f"- Competitor names ARE allowed in competitor-type queries\n"
        f"- Generate at least 25 queries across all 4 types\n\n"
        f'Return ONLY a valid JSON array: [{{"query_text":"...","query_type":"brand_category|workflow|competitor|adjacent","score":1-5}}]\n'
        f"Score each 1-5 based on how natural and specific the query is.\n"
        f"No text, no markdown, no explanation."
    )

    messages = [
        {"role": "developer", "content": "Return ONLY a valid JSON array of scored queries. No text, no markdown, no explanation."},
        {"role": "user", "content": user_msg},
    ]

    queries = []
    for model in ["chatgpt", "llama"]:
        try:
            resp = await _call_openrouter(messages, model, client, temperature=0.6, max_tokens=2048)
            result = _parse_json(resp)
            if isinstance(result, list) and len(result) >= 15:
                queries = result
                break
        except Exception:
            continue

    if not queries:
        return []

    # Dedup via LLM if batch is large
    if len(queries) > 15:
        try:
            resp = await _call_openrouter([
                {"role": "developer", "content": "Remove semantically duplicate queries. Keep only the best-scored one from each group. Return deduped JSON array."},
                {"role": "user", "content": json.dumps(queries)},
            ], "chatgpt", client, temperature=0.2, max_tokens=1536)
            result = _parse_json(resp)
            if isinstance(result, list):
                queries = result
        except Exception:
            pass

    # Regenerate weak queries
    weak = [q for q in queries if q.get("score", 0) < 3]
    strong = [q for q in queries if q.get("score", 0) >= 3]
    if weak and len(queries) < 25:
        try:
            resp = await _call_openrouter([
                {"role": "developer", "content": "Return ONLY a valid JSON array of replacement queries. No text, no markdown. Do NOT include the brand name in queries."},
                {"role": "user", "content": (
                    f"These queries for {brand_name} ({domain}) scored poorly:\n{json.dumps(weak)}\n\n"
                    f"Generate {len(weak)} better, more specific, natural replacements.\n"
                    f"Return: [{{\"query_text\":\"...\",\"query_type\":\"...\",\"score\":1-5}}]"
                )},
            ], "chatgpt", client, temperature=0.7, max_tokens=1024)
            result = _parse_json(resp)
            if isinstance(result, list):
                queries = strong + result
        except Exception:
            pass

    # Final guard: ensure at least 20 queries
    if len(queries) < 20:
        try:
            resp = await _call_openrouter([
                {"role": "developer", "content": "Return ONLY a valid JSON array. No text, no markdown. Do NOT include the brand name in queries."},
                {"role": "user", "content": (
                    f"Generate {20 - len(queries)} additional queries for {brand_name} ({domain}). "
                    f"Do NOT include the brand name ({brand_name}) in the queries.\n"
                    f"Return: [{{\"query_text\":\"...\",\"query_type\":\"workflow|adjacent\",\"score\":4-5}}]"
                )},
            ], "chatgpt", client, temperature=0.6, max_tokens=1024)
            result = _parse_json(resp)
            if isinstance(result, list):
                queries.extend(result)
        except Exception:
            pass

    for q in queries:
        q["score"] = max(1, min(5, int(q.get("score", 3))))
        q["query_type"] = q.get("query_type", "brand_category")
    queries.sort(key=lambda q: q.get("score", 0), reverse=True)
    return queries[:30]


# ─── Probe Scan ────────────────────────────────────────────────────────────────

async def run_probe_scan(brand_name: str, domain: str, queries: list[dict], client) -> dict:
    """Run a small probe scan (3 queries x 3 LLMs) and return structured analysis."""
    probe_queries = sorted(queries, key=lambda q: q.get("score", 0), reverse=True)[:3]
    llm_names = ["chatgpt", "gemini", "llama"]

    raw = await scan_all_llms(
        [(q["query_text"], q["query_text"]) for q in probe_queries],
        llm_names,
        client,
    )

    results_text = []
    for q_id, llm_name, result_data, error in raw:
        if error:
            status = error
        elif isinstance(result_data, dict):
            status = result_data.get("summary", json.dumps(result_data)[:300])
        else:
            status = "empty"
        results_text.append(f"Query: {q_id}\nLLM: {llm_name}\nResponse: {status}\n")

    messages = [
        {"role": "developer", "content": "Return ONLY a valid JSON object with keys 'insights' (array) and 'summary' (string). No text, no markdown."},
        {"role": "user", "content": (
            f"Analyze probe scan for {brand_name} ({domain}):\n\n{''.join(results_text)}\n\n"
            f'For each query, return:\n{{"query_text":"...","brand_overmentioned":bool,"competitors_found":["..."],"recommendation":"keep"|"drop"|"refine"}}\n'
            f'Overall summary explaining findings.'
        )},
    ]

    for model in ["chatgpt"]:
        try:
            resp = await _call_openrouter(messages, model, client, temperature=0.3, max_tokens=1024)
            return _parse_json(resp)
        except Exception:
            continue

    return {"insights": [], "summary": "Probe analysis unavailable"}


# ─── Full Orchestrator ─────────────────────────────────────────────────────────

async def orchestrate_query_generation(brand_name, domain, crawl_content, user_competitors, client) -> dict:
    classification = await classify_brand(crawl_content, brand_name, domain, client)
    logger.info("Classification for %s: %s", domain, classification.get("industry"))

    # Step 2: Discover competitors (from crawl + LLM knowledge)
    from_crawl = await discover_competitors_from_crawl(crawl_content, client)
    from_category = await discover_competitors_by_category(classification, client)

    # Merge, dedup, rank by relevance
    seen = {}
    for c in from_crawl + from_category:
        name_lower = c.get("name", "").lower()
        if name_lower and name_lower not in seen and name_lower != brand_name.lower():
            seen[name_lower] = c
    for name in user_competitors:
        if name.lower() not in seen:
            seen[name.lower()] = {"name": name, "domain": "", "relevance_score": 5}
    competitors = sorted(seen.values(), key=lambda c: c.get("relevance_score", 0), reverse=True)[:10]
    logger.info("Discovered %d competitors for %s", len(competitors), domain)

    # Step 3: Crawl competitor sites
    if competitors_need_refresh(competitors):
        competitors = await crawl_competitor_sites(competitors)

    # Step 4: Generate scored queries
    queries = await generate_scored_queries(brand_name, domain, classification, competitors, client)
    logger.info("Generated %d scored queries for %s", len(queries), domain)

    # Step 5: Probe scan
    probe = None
    if queries:
        probe = await run_probe_scan(brand_name, domain, queries, client)
        logger.info("Probe scan done for %s: %s", domain, probe.get("summary", ""))

    return {
        "classification": classification,
        "competitors": competitors,
        "queries": queries,
        "probe_result": probe,
    }


async def query_llm(llm_name: str, query_text: str) -> tuple[str, str | None]:
    """Backward-compatible wrapper for old code paths."""
    async with httpx.AsyncClient(timeout=45) as client:
        return await scan_query(query_text, llm_name, client)


async def query_all_llms(
    query_text: str,
    llm_names: list[str],
) -> dict[str, tuple[str, str | None]]:
    """Backward-compatible wrapper for old code paths."""
    async with httpx.AsyncClient(timeout=45) as client:
        tasks = {name: scan_query(query_text, name, client) for name in llm_names}
        results = await asyncio.gather(*tasks.values(), return_exceptions=False)
        return dict(zip(tasks.keys(), results))


# ─── Flutterwave v4 ────────────────────────────────────────────────────────────

async def create_flutterwave_charge(user, package_key, encrypted_card, currency="USD"):
    from app.services.credit_service import CREDITS_PER_DOLLAR
    CREDIT_PACKAGES = {
        "starter": {"credits": 1000, "amount_usd": 5.00, "label": "Starter"},
        "popular": {"credits": 5000, "amount_usd": 20.00, "label": "Popular"},
        "pro": {"credits": 15000, "amount_usd": 50.00, "label": "Pro"},
        "enterprise": {"credits": 50000, "amount_usd": 150.00, "label": "Enterprise"},
    }
    package = CREDIT_PACKAGES.get(package_key)
    if not package:
        raise ValueError(f"Invalid package: {package_key}")

    token = await _get_access_token()
    ref = secrets.token_hex(10)
    display = (user.display_name or "User").strip()
    parts = display.split(" ", 1)
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json", "X-Trace-Id": str(__import__("uuid").uuid4()), "X-Idempotency-Key": ref}

    body = {
        "amount": package["amount_usd"], "currency": currency, "reference": ref,
        "redirect_url": f"{settings.RP_ORIGIN}/credits/success",
        "customer": {"email": user.email, "name": {"first": parts[0] or "User", "last": parts[1] if len(parts) > 1 and len(parts[1]) >= 2 else "Customer"}, "phone": {"country_code": "1", "number": "0000000000"}},
        "payment_method": {"type": "card", "card": encrypted_card},
        "meta": {"user_id": str(user.id), "package_key": package_key, "credits": package["credits"]},
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(f"{_base_url()}/orchestration/direct-charges", headers=headers, json=body)
        data = resp.json()
        if data.get("status") not in ("success", "pending"):
            raise ValueError(data.get("message", "Payment initialization failed"))
        charge_data = data.get("data", {})
        redirect_url = None
        next_action = charge_data.get("next_action", {})
        if next_action.get("type") == "redirect_url":
            redirect_url = next_action.get("redirect_url", {}).get("url")
        return {"charge_id": charge_data.get("id"), "reference": ref, "checkout_url": redirect_url, "amount": package["amount_usd"], "currency": currency}


async def verify_flutterwave_charge(transaction_id: str) -> dict:
    token = await _get_access_token()
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(f"{_base_url()}/transactions/{transaction_id}/verify", headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
        data = resp.json()
        if data.get("status") != "success":
            return {"verified": False, "status": "failed"}
        charge = data["data"]
        return {"verified": True, "status": charge["status"], "amount": charge.get("amount"), "currency": charge.get("currency"), "tx_ref": charge.get("reference"), "charge_id": charge.get("id"), "meta": charge.get("meta", {})}
