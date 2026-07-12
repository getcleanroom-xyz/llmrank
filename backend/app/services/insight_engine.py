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
    "For each topic where the brand was NOT mentioned, I checked whether the brand already has content "
    "about that topic on their website. The results are included below.\n\n"
    "Use this to differentiate your recommendations:\n"
    "- If content EXISTS but brand is still not mentioned → the issue is DISCOVERABILITY or TRUST. "
    "Recommend structural fixes: clearer headings, schema markup, better page structure, "
    "stronger associations with the topic, or authority-building.\n"
    "- If content is MISSING → recommend creating targeted content about the topic.\n"
    "- NEVER recommend 'create more content' if the content already exists. That would be redundant.\n"
    "- Be specific about which fix applies. 'Improve your content' is too vague."
)


async def _call_llm(messages: list[dict]) -> str:
    """Called via llm_adapters._call_openrouter — but we need a client."""
    # This is a placeholder; _call_openrouter is imported lazily
    from app.services.llm_adapters import _call_openrouter
    import httpx
    async with httpx.AsyncClient(timeout=15) as client:
        return await _call_openrouter(messages, "chatgpt", client, temperature=0.3, max_tokens=512)


async def diagnose_visibility_gap(brand_name: str, brand_domain: str, query_text: str) -> dict:
    """Check whether a brand already has content about a query topic.

    Returns {"exists": bool, "evidence": str} indicating whether content exists
    and what evidence was found.
    """
    try:
        from duckduckgo_search import DDGS

        # Search for the brand's content about this topic
        search_query = f'"{brand_name}" {query_text}'
        with DDGS() as ddgs:
            results = list(ddgs.text(search_query, max_results=5))

        # Check if the brand's domain appears in results
        brand_domain_lower = brand_domain.lower().replace("www.", "")
        for r in results:
            href = r.get("href", "").lower()
            if brand_domain_lower in href:
                return {
                    "exists": True,
                    "evidence": f"Found on {href}: {r.get('body', '')[:150]}",
                }

        # Also check if brand name appears in any result snippet
        for r in results:
            body = r.get("body", "")
            if brand_name.lower() in body.lower():
                return {
                    "exists": True,
                    "evidence": f"Mentioned in: {body[:150]}",
                }

        return {"exists": False, "evidence": "No content found for this topic"}

    except ImportError:
        logger.debug("ddgs not installed — skipping content diagnosis")
        return {"exists": False, "evidence": "Diagnosis unavailable"}
    except Exception as e:
        logger.debug("Content diagnosis failed for '%s': %s", query_text, e)
        return {"exists": False, "evidence": "Diagnosis failed"}


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
) -> list[dict]:
    """Generate tailored dashboard-level insights using LLM."""
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
            query_results[r.query_text].append(r)

        for query_text, results in query_results.items():
            if not any(r.mentioned for r in results):
                # Brand was completely absent — check if content exists
                diag = await diagnose_visibility_gap(brand_name, brand_domain, query_text)
                status = "EXISTS" if diag["exists"] else "MISSING"
                diagnosis_lines.append(
                    f"  [{status}] \"{query_text}\" — {diag['evidence']}"
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
