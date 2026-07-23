"""Query generation pipeline: scored queries, probe scans, full orchestrator."""
import json
import logging
from typing import Optional

import httpx

logger = logging.getLogger(__name__)


async def generate_scored_queries(brand_name: str, domain: str, classification: dict, competitors: list[dict], client) -> list[dict]:
    from app.services.llm_core import _call_openrouter, _parse_json
    comp_str = ", ".join(c.get("name", "") for c in competitors[:8])
    user_msg = (
        f"A person who doesn't know about {brand_name} is looking for solutions in the {classification.get('sub_category', classification.get('industry', ''))} space.\n"
        f"They haven't discovered any brand yet. They're exploring their options.\n"
        f"What questions would they ask an AI assistant like ChatGPT?\n\n"
        f"Company context: {brand_name} ({domain})\n"
        f"Industry: {classification.get('industry', '')}\n"
        f"Known alternatives: {comp_str}\n\n"
        f"Generate 30 natural, conversational questions. These are real questions people type into ChatGPT.\n"
        f"Examples of good queries:\n"
        f'- "I run a small team and need better collaboration tools"\n'
        f'- "What should I use to manage my projects more efficiently"\n'
        f'- "How do other people handle team communication"\n'
        f"- \"Is there a better way to track tasks than spreadsheets\"\n\n"
        f"Avoid: generic questions like 'best X tool' or 'X alternatives'. Be specific and scenario-based.\n"
        f"Every query must NOT contain the brand name {brand_name}.\n"
        f"Competitor names ARE allowed.\n\n"
        f'Return ONLY a valid JSON array: [{{"query_text":"...","query_type":"workflow","score":1-5}}]\n'
        f"Score each 1-5 based on how natural and specific the query is.\n"
        f"No text, no markdown, no explanation."
    )

    messages = [
        {"role": "developer", "content": (
            "You are a UX researcher simulating real users. Generate conversational questions "
            "people would type into ChatGPT when researching products in a specific industry. "
            "These are people who don't know any brand names yet — they're solving problems.\n"
            "Use scenario-based, specific questions. Never use 'best X' or 'X alternatives' patterns.\n"
            "Return ONLY a valid JSON array. No text, no markdown."
        )},
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

    weak = [q for q in queries if q.get("score", 0) < 3]
    strong = [q for q in queries if q.get("score", 0) >= 3]
    if weak and len(queries) < 25:
        try:
            resp = await _call_openrouter([
                {"role": "developer", "content": (
                    "Generate natural, scenario-based questions people ask AI when researching products. "
                    "Avoid 'best X' patterns. Be specific and conversational. Do NOT include the brand name.\n"
                    "Return ONLY a valid JSON array."
                )},
                {"role": "user", "content": (
                    f"These queries scored poorly for {brand_name} ({domain}):\n{json.dumps(weak)}\n\n"
                    f"Generate {len(weak)} better, scenario-based, natural replacements.\n"
                    f"Example of good query: 'I run a small team and need better collaboration tools'\n"
                    f"Return: [{{\"query_text\":\"...\",\"query_type\":\"workflow\",\"score\":1-5}}]"
                )},
            ], "chatgpt", client, temperature=0.7, max_tokens=1024)
            result = _parse_json(resp)
            if isinstance(result, list):
                queries = strong + result
        except Exception:
            pass

    if len(queries) < 20:
        try:
            resp = await _call_openrouter([
                {"role": "developer", "content": (
                    f"Generate natural, scenario-based questions people ask AI when researching {brand_name} ({domain}). "
                    "Avoid 'best X' patterns. Be specific and conversational.\n"
                    "Return ONLY a valid JSON array."
                )},
                {"role": "user", "content": (
                    f"Generate {20 - len(queries)} more scenario-based questions for {brand_name} ({domain}). "
                    f"People don't know any brands yet. They're asking about their problems.\n"
                    f"Do NOT include the brand name.\n"
                    f'Return: [{{"query_text":"...","query_type":"workflow","score":4-5}}]'
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


async def run_probe_scan(brand_name: str, domain: str, queries: list[dict], client) -> dict:
    from app.services.llm_core import scan_all_llms, _call_openrouter, _parse_json
    probe_queries = sorted(queries, key=lambda q: q.get("score", 0), reverse=True)[:3]
    llm_names = ["chatgpt", "gemini", "llama"]

    raw = await scan_all_llms(
        [(q["query_text"], q["query_text"]) for q in probe_queries],
        llm_names,
        client,
        brand_name=brand_name,
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


async def orchestrate_query_generation(brand_name, domain, crawl_content, user_competitors, client) -> dict:
    from app.services.competitor_service import classify_brand, discover_competitors_from_crawl, discover_competitors_by_category, crawl_competitor_sites, fill_missing_domains, competitors_need_refresh, _is_valid_competitor

    classification = await classify_brand(crawl_content, brand_name, domain, client)
    logger.info("Classification for %s: %s", domain, classification.get("industry"))

    from_crawl = await discover_competitors_from_crawl(crawl_content, client)
    from_category = await discover_competitors_by_category(classification, client)

    seen = {}
    for c in from_crawl + from_category:
        name_lower = c.get("name", "").lower()
        if name_lower and name_lower not in seen and name_lower != brand_name.lower() and _is_valid_competitor(name_lower):
            seen[name_lower] = c
    for name in user_competitors:
        if name.lower() not in seen and _is_valid_competitor(name.lower()):
            seen[name.lower()] = {"name": name, "domain": "", "relevance_score": 5}
    competitors = sorted(seen.values(), key=lambda c: c.get("relevance_score", 0), reverse=True)[:10]
    logger.info("Discovered %d competitors for %s", len(competitors), domain)

    # Fill missing domains before crawling
    competitors = await fill_missing_domains(competitors, classification.get("industry", ""))

    if competitors_need_refresh(competitors):
        competitors = await crawl_competitor_sites(competitors)

    queries = await generate_scored_queries(brand_name, domain, classification, competitors, client)
    logger.info("Generated %d scored queries for %s", len(queries), domain)

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
    from app.services.llm_core import scan_query
    async with httpx.AsyncClient(timeout=45) as client:
        return await scan_query(query_text, llm_name, client)


async def query_all_llms(query_text: str, llm_names: list[str]) -> dict[str, tuple[str, str | None]]:
    from app.services.llm_core import scan_query
    import asyncio
    async with httpx.AsyncClient(timeout=45) as client:
        tasks = {name: scan_query(query_text, name, client) for name in llm_names}
        results = await asyncio.gather(*tasks.values(), return_exceptions=False)
        return dict(zip(tasks.keys(), results))
