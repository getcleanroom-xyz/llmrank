"""LLM-powered insight engine — generates tailored recommendations based on scan data."""
import json
import logging

logger = logging.getLogger(__name__)

INSIGHT_DEVELOPER = (
    "You are an SEO/GEO strategist. Based on the scan results below, provide 2-3 specific, actionable recommendations "
    "for the brand. Each insight must reference actual data from the scan (specific LLMs, positions, competitors). "
    "Return ONLY a valid JSON array: [{\"type\":\"tip\"|\"warning\",\"text\":\"...\"}]. "
    "No text outside the array. Insights must be concrete — not generic advice."
)

DIAGNOSIS_PROMPT_ADDENDUM = (
    "\n\nDIAGNOSTIC DATA:\n"
    "For each query where the brand was absent, I ran a multi-signal diagnosis:\n"
    "- Does the brand have content about this topic on their own website?\n"
    "- Are there brand mentions across the web (Reddit, YouTube, Wikipedia, industry sites)?\n"
    "- Is the brand present on key citation sources that AI models trust?\n\n"
    "Each gap is labeled with a fix_type. Use this to give PRECISE recommendations:\n\n"
    "fix_type=content_gap: Content doesn't exist. Recommend creating targeted content.\n"
    "fix_type=discoverability: Content exists but AI can't find or trust it. "
    "Recommend: clearer headings, schema markup, structured data, FAQ sections, "
    "better internal linking, server-side rendering.\n"
    "fix_type=mentions: Content exists but brand lacks web mentions. "
    "Recommend: PR outreach, guest posts, industry rankings, review sites, "
    "unlinked mentions on authoritative pages.\n"
    "fix_type=authority: Brand missing from trusted citation sources. "
    "Recommend: Reddit presence, YouTube content, Wikipedia (if notable), "
    "industry publications, expert endorsements.\n\n"
    "CRITICAL: Never recommend 'create more content' when content already exists. "
    "The fix must match the actual root cause. Be specific — name the exact action."
)


async def _call_llm(messages: list[dict]) -> str:
    """Called via llm_adapters._call_openrouter — but we need a client."""
    # This is a placeholder; _call_openrouter is imported lazily
    from app.services.llm_adapters import _call_openrouter
    import httpx
    async with httpx.AsyncClient(timeout=15) as client:
        return await _call_openrouter(messages, "chatgpt", client, temperature=0.3, max_tokens=512)


async def diagnose_visibility_gap(
    brand_name: str,
    brand_domain: str,
    query_text: str,
    crawl_content: str | None = None,
) -> dict:
    """Diagnose why a brand is absent from AI responses for a given query.

    Checks multiple signals based on AEO/GEO research:
    1. Content on brand's own domain (uses crawl_content if available, otherwise web search)
    2. Brand mentions across the web (the #1 factor for AI visibility)
    3. Presence on key citation sources (Reddit, YouTube, Wikipedia)

    Returns {"exists": bool, "diagnosis": str, "evidence": str, "fix_type": str}.
    fix_type is one of: "content_gap", "discoverability", "authority", "mentions", "unknown"
    """
    import asyncio
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(
        None, _diagnose_sync, brand_name, brand_domain, query_text, crawl_content
    )


def _diagnose_sync(
    brand_name: str,
    brand_domain: str,
    query_text: str,
    crawl_content: str | None = None,
) -> dict:
    """Synchronous diagnosis — runs in thread pool to avoid blocking event loop."""
    try:
        import time
        from ddgs import DDGS

        evidence_parts = []
        scores = {"own_domain": 0, "web_mentions": 0, "citation_sources": 0}

        # 1. Check brand's own domain for this topic
        # Use crawl_content if available (fast, no rate limits), otherwise fall back to web search
        if crawl_content:
            query_lower = query_text.lower()
            crawl_lower = crawl_content.lower()
            # Check if key words from the query appear in the crawled content
            query_words = [w for w in query_lower.split() if len(w) > 3]
            matches = sum(1 for w in query_words if w in crawl_lower)
            if matches >= max(1, len(query_words) // 2):
                scores["own_domain"] = 2
                evidence_parts.append(f"Content exists on {brand_domain} about this topic (from crawl)")
            else:
                scores["own_domain"] = 0
                evidence_parts.append(f"No relevant content found on {brand_domain} for this topic (from crawl)")
        else:
            # Fallback to web search if no crawl content available
            own_query = f'site:{brand_domain} {query_text}'
            try:
                try:
                    with DDGS() as ddgs:
                        own_results = list(ddgs.text(own_query, max_results=3))
                except Exception:
                    own_results = []
                if own_results:
                    scores["own_domain"] = 2
                    evidence_parts.append(f"Content exists on {brand_domain} about this topic")
            except Exception:
                pass

        # 2. Check brand mentions across the web
        mention_query = f'"{brand_name}" {query_text}'
        try:
            try:
                with DDGS() as ddgs:
                    mention_results = list(ddgs.text(mention_query, max_results=5))
            except Exception:
                mention_results = []
            brand_domain_lower = brand_domain.lower().replace("www.", "")
            third_party_mentions = 0
            for r in mention_results:
                href = r.get("href", "").lower()
                body = r.get("body", "").lower()
                if brand_name.lower() in body or brand_domain_lower in href:
                    third_party_mentions += 1
            if third_party_mentions >= 2:
                scores["web_mentions"] = 2
                evidence_parts.append(f"Brand mentioned in {third_party_mentions} search results")
            elif third_party_mentions == 1:
                scores["web_mentions"] = 1
                evidence_parts.append("Limited web mentions found")
        except Exception:
            pass

        # 3. Check key citation sources (Reddit, YouTube, Wikipedia)
        # Rate-limited: pause before search to avoid 429s
        citation_query = f'"{brand_name}" {query_text}'
        try:
            time.sleep(1.5)  # Rate limit: pause before citation search
            try:
                with DDGS() as ddgs:
                    citation_results = list(ddgs.text(citation_query, max_results=10))
            except Exception:
                citation_results = []
            citation_domains = {"reddit.com", "youtube.com", "wikipedia.org", "medium.com",
                                "github.com", "stackoverflow.com", "quora.com"}
            found_on = set()
            for r in citation_results:
                href = r.get("href", "").lower()
                for d in citation_domains:
                    if d in href:
                        found_on.add(d)
            if found_on:
                scores["citation_sources"] = 2
                evidence_parts.append(f"Found on: {', '.join(found_on)}")
            else:
                scores["citation_sources"] = 0
                evidence_parts.append("Not found on key citation sources (Reddit, YouTube, Wikipedia)")
        except Exception:
            pass

        # Determine diagnosis based on scores
        total = sum(scores.values())
        evidence = "; ".join(evidence_parts) if evidence_parts else "Diagnosis incomplete"

        if scores["own_domain"] >= 2 and scores["web_mentions"] < 2:
            return {"exists": True, "diagnosis": "Content exists but lacks web presence",
                    "evidence": evidence, "fix_type": "mentions"}
        elif scores["own_domain"] >= 2 and scores["web_mentions"] >= 2:
            return {"exists": True, "diagnosis": "Content exists with web presence — likely trust/structure issue",
                    "evidence": evidence, "fix_type": "discoverability"}
        elif scores["own_domain"] < 2 and scores["web_mentions"] >= 1:
            return {"exists": False, "diagnosis": "Limited content, some web mentions",
                    "evidence": evidence, "fix_type": "content_gap"}
        elif scores["citation_sources"] < 2:
            return {"exists": False, "diagnosis": "Missing from key citation sources",
                    "evidence": evidence, "fix_type": "authority"}
        else:
            return {"exists": False, "diagnosis": "Content genuinely missing",
                    "evidence": evidence, "fix_type": "content_gap"}

    except ImportError:
        logger.debug("ddgs not installed — skipping content diagnosis")
        return {"exists": False, "diagnosis": "Diagnosis unavailable",
                "evidence": "ddgs package not installed", "fix_type": "unknown"}
    except Exception as e:
        logger.debug("Content diagnosis failed for '%s': %s", query_text, e)
        return {"exists": False, "diagnosis": "Diagnosis failed",
                "evidence": str(e), "fix_type": "unknown"}


async def generate_insights_for_query(
    brand_name: str,
    query_text: str,
    results: list,
    classification: dict | None = None,
) -> list[dict]:
    """Generate tailored insights for a single query using LLM."""
    if not results:
        return []

    # Build a concise summary of results per LLM
    lines = []
    for r in results:
        mentioned = "mentioned" if r.mentioned else "NOT mentioned"
        position = f" at position #{r.position}" if r.position else ""
        sentiment = r.sentiment
        competitors = ", ".join(c.get("name", "") for c in (r.competitors_mentioned or []))
        comp_str = f" | competitors: {competitors}" if competitors else ""
        llm_name = r.llm_name.title() if hasattr(r.llm_name, "title") else r.llm_name
        lines.append(f"  {llm_name}: {mentioned}{position} (sentiment: {sentiment}, score: {r.score}){comp_str}")

    industry = classification.get("sub_category", classification.get("industry", "unknown")) if classification else "unknown"

    user_msg = (
        f"Brand: {brand_name}\n"
        f"Industry: {industry}\n"
        f"Query: {query_text}\n\n"
        f"Scan results:\n" + "\n".join(lines)
    )

    messages = [
        {"role": "developer", "content": INSIGHT_DEVELOPER},
        {"role": "user", "content": user_msg},
    ]

    try:
        import re
        resp = await _call_llm(messages)
        match = re.search(r"\[.*\]", resp, re.DOTALL)
        if match:
            insights = json.loads(match.group())
            if isinstance(insights, list):
                return insights
    except Exception as e:
        logger.warning("LLM insight generation failed for query '%s': %s", query_text, e)

    # Fallback: one basic insight
    return [{
        "type": "tip",
        "text": (
            f"<strong>Review your content for \"{query_text}\"</strong> — "
            f"{'you are mentioned' if any(r.mentioned for r in results) else 'you are not mentioned'} in these results. "
            f"Targeted content improvements can improve visibility."
        ),
    }]


async def generate_dashboard_insights(
    brand_name: str,
    all_results: list,
    brand_domain: str = "",
    classification: dict | None = None,
    query_map: dict | None = None,
    crawl_content: str | None = None,
) -> list[dict]:
    """Generate tailored dashboard-level insights using LLM.

    Args:
        crawl_content: Optional cached crawl content to avoid web searches for own-domain checks.
    """
    if not all_results:
        return []

    # Build per-LLM summary
    from collections import defaultdict
    llm_data = defaultdict(list)
    for r in all_results:
        llm_data[r.llm_name].append(r)

    lines = []
    for llm, results in sorted(llm_data.items()):
        avg_score = sum(r.score or 0 for r in results) / len(results)
        mentioned = sum(1 for r in results if r.mentioned)
        total = len(results)
        comps = set()
        for r in results:
            for c in (r.competitors_mentioned or []):
                if c.get("name"):
                    comps.add(c["name"])
        comp_str = f", competitors: {', '.join(list(comps)[:3])}" if comps else ""
        llm_name = llm.title() if hasattr(llm, "title") else llm
        lines.append(f"  {llm_name}: avg score {avg_score:.0f}/100, mentioned {mentioned}/{total}{comp_str}")

    # Diagnose visibility gaps for queries where brand was NOT mentioned
    diagnosis_lines = []
    if brand_domain:
        # Group results by query to find fully-missed queries
        query_results = defaultdict(list)
        for r in all_results:
            query_results[r.query_id].append(r)

        # Run diagnoses with rate limiting (max 3 concurrent to avoid 429s)
        import asyncio
        sem = asyncio.Semaphore(3)

        async def _rate_limited_diagnose(q_text: str) -> dict:
            async with sem:
                return await diagnose_visibility_gap(
                    brand_name, brand_domain, q_text, crawl_content=crawl_content
                )

        diag_tasks = []
        diag_query_ids = []
        for query_id, results in query_results.items():
            if not any(r.mentioned for r in results):
                query_obj = query_map.get(query_id) if query_map else None
                query_text = query_obj.query_text if hasattr(query_obj, "query_text") else str(query_id)
                diag_tasks.append(_rate_limited_diagnose(query_text))
                diag_query_ids.append(query_text)

        if diag_tasks:
            diags = await asyncio.gather(*diag_tasks, return_exceptions=True)
            for query_text, diag in zip(diag_query_ids, diags):
                if isinstance(diag, Exception):
                    continue
                diagnosis_lines.append(
                    f"  [{diag['fix_type'].upper()}] \"{query_text}\" — {diag['diagnosis']}. Evidence: {diag['evidence']}"
                )

    industry = classification.get("sub_category", classification.get("industry", "unknown")) if classification else "unknown"

    user_msg = (
        f"Brand: {brand_name}\n"
        f"Industry: {industry}\n"
        f"Domain: {brand_domain}\n\n"
        f"Scan results across all queries:\n" + "\n".join(lines)
    )

    if diagnosis_lines:
        user_msg += (
            f"\n\nContent diagnosis for queries where brand was absent:\n"
            + "\n".join(diagnosis_lines)
        )

    prompt = INSIGHT_DEVELOPER
    if diagnosis_lines:
        prompt += DIAGNOSIS_PROMPT_ADDENDUM

    messages = [
        {"role": "developer", "content": prompt},
        {"role": "user", "content": user_msg},
    ]

    try:
        import re
        resp = await _call_llm(messages)
        match = re.search(r"\[.*\]", resp, re.DOTALL)
        if match:
            insights = json.loads(match.group())
            if isinstance(insights, list):
                return insights[:3]
    except Exception as e:
        logger.warning("Dashboard insight generation failed: %s", e)

    return []


async def generate_competitor_insight(
    brand_name: str,
    competitor_name: str,
    mention_pct: float,
    you_win_count: int,
    they_win_count: int,
    you_absent_count: int,
    branded_total: int = 0,
    brand_position: float | None = None,
    competitor_position: float | None = None,
    top_queries: list[str] | None = None,
) -> str:
    """Generate a specific, actionable competitive insight using LLM."""
    prompt = (
        f"Brand: {brand_name} | Competitor: {competitor_name}\n"
    )
    if top_queries:
        prompt += f"Queries where {competitor_name} competes: {', '.join(top_queries[:5])}\n"
    prompt += (
        f"Your mention rate vs them: {mention_pct}% | "
        f"You rank higher: {you_win_count}x | They rank higher: {they_win_count}x | You're absent: {you_absent_count}x\n"
    )
    if brand_position is not None:
        prompt += f"Your avg position: {brand_position}\n"
    if competitor_position is not None:
        prompt += f"Their avg position: {competitor_position}\n"
    prompt += (
        "\nGive ONE specific, actionable recommendation for how this brand can improve "
        "its AI visibility against this competitor. Reference the actual data. "
        "Return ONLY the sentence."
    )
    messages = [
        {"role": "developer", "content": "You are a competitive strategist. Output a single short sentence. No JSON, no lists, no preamble."},
        {"role": "user", "content": prompt},
    ]
    try:
        from app.services.llm_adapters import _call_openrouter
        import httpx
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await _call_openrouter(messages, "chatgpt", client, temperature=0.3, max_tokens=256)
            return resp.strip().strip('"').strip("'")
    except Exception:
        return ""
