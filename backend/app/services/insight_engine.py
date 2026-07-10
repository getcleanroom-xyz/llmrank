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


async def _call_llm(messages: list[dict]) -> str:
    """Called via llm_adapters._call_openrouter — but we need a client."""
    # This is a placeholder; _call_openrouter is imported lazily
    from app.services.llm_adapters import _call_openrouter
    import httpx
    async with httpx.AsyncClient(timeout=15) as client:
        return await _call_openrouter(messages, "chatgpt", client, temperature=0.3, max_tokens=512)


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

    industry = classification.get("sub_category", classification.get("industry", "unknown")) if classification else "unknown"

    user_msg = (
        f"Brand: {brand_name}\n"
        f"Industry: {industry}\n"
        f"Domain: {brand_domain}\n\n"
        f"Scan results across all queries:\n" + "\n".join(lines)
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
) -> str:
    """Generate a specific, actionable competitive insight using LLM."""
    user_msg = (
        f"Brand: {brand_name} | Competitor: {competitor_name}\n"
        f"Mention rate: {mention_pct}% | Brand wins: {you_win_count} | Competitor wins: {they_win_count} | Brand absent: {you_absent_count}\n\n"
        f"Generate ONE specific, actionable sentence about how {brand_name} can compete better. Reference the data. Return ONLY the sentence."
    )
    messages = [
        {"role": "developer", "content": "You are a competitive strategist. Output a single short sentence. No JSON, no lists, no preamble."},
        {"role": "user", "content": user_msg},
    ]
    try:
        from app.services.llm_adapters import _call_openrouter
        import httpx
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await _call_openrouter(messages, "chatgpt", client, temperature=0.3, max_tokens=256)
            return resp.strip().strip('"').strip("'")
    except Exception:
        return ""
