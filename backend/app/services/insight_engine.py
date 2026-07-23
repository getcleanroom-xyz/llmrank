"""LLM-powered insight engine — generates tailored recommendations based on scan data."""
import json
import logging

logger = logging.getLogger(__name__)

# Use the copilot's system prompt for insights — same quality, same personality
INSIGHT_SYSTEM_PROMPT = (
    "You are Lai, the AI visibility copilot inside LLMRanked. "
    "You talk like a smart friend who actually knows this stuff, not a consultant "
    "reading from a slide deck.\n\n"
    "You have REAL data about this brand below. Every query, number, and competitor "
    "name is pulled straight from their scan results.\n\n"
    "CRITICAL RULES:\n"
    "- NEVER assume or guess what the brand's features, products, or value propositions are.\n"
    "- ONLY use the brand name, domain, queries, scan results, and competitor data provided.\n"
    "- Be direct. No filler like 'Great question!' or 'I'd be happy to help!'\n"
    "- Use the actual data. Quote real query texts, real percentages, real positions.\n"
    "- When something is bad, say it's bad. When something is working, say so.\n"
    "- Give specific next steps, not vague advice like 'improve your content'\n"
    "- No emojis. No em dashes. No corporate jargon. Write like a human.\n\n"
    "WHEN ANALYZING SENTIMENT:\n"
    "- If sentiment is negative, explain WHY. What pain points, complaints, or issues "
    "are associated with this brand in AI responses? What are users complaining about?\n"
    "- Compare to competitors: what do competitors do RIGHT that this brand does NOT? "
    "Look at which competitors are mentioned positively and what they're known for.\n"
    "- Be specific: 'Users cite X as a pain point' not 'improve user experience'\n\n"
    "WHEN ANALYZING COMPETITORS:\n"
    "- Name the specific competitors that appear in AI responses\n"
    "- Explain WHAT those competitors do that makes them get mentioned instead\n"
    "- Look at the raw responses to understand the actual AI reasoning\n\n"
    "OUTPUT FORMAT:\n"
    "Return ONLY a valid JSON array with 2-3 insights:\n"
    "[{\"type\":\"tip\"|\"warning\",\"text\":\"HTML-formatted insight with <strong> for emphasis\"}]\n"
    "Each insight must explain the ROOT CAUSE, not just state the symptom.\n"
    "No text outside the JSON array."
)


async def _call_llm(messages: list[dict], model: str = "chatgpt") -> str:
    """Call LLM via llm_adapters."""
    from app.services.llm_adapters import _call_openrouter
    import httpx
    async with httpx.AsyncClient(timeout=30) as client:
        return await _call_openrouter(messages, model, client, temperature=0.4, max_tokens=1024)


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
            time.sleep(1.5)  # Sync sleep is acceptable here — this runs in a thread pool executor
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
    brand_id: str | None = None,
    query_id: str | None = None,
) -> list[dict]:
    """Generate tailored insights for a single query using LLM with rich context."""
    if not results:
        return []

    # Build rich context using the copilot's context builder
    context = ""
    if brand_id:
        try:
            from app.services.tools.domain import build_brand_context
            context = await build_brand_context(brand_id)
        except Exception as e:
            logger.debug("Failed to build brand context for insights: %s", e)

    if not context:
        # Fallback to simpler context
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
        context = (
            f"Brand: {brand_name}\n"
            f"Industry: {industry}\n"
            f"Query: {query_text}\n\n"
            f"Scan results:\n" + "\n".join(lines)
        )

    user_msg = (
        f"Generate 2-3 specific, actionable insights for this brand about this particular query:\n\n"
        f"Query: {query_text}\n\n"
        f"Focus on:\n"
        f"- Why the brand is or isn't mentioned for this specific query\n"
        f"- Which specific LLMs mention or skip the brand, and what competitors they mention instead\n"
        f"- What the brand can do to improve visibility for THIS EXACT QUERY\n\n"
        f"Brand data:\n{context}"
    )

    messages = [
        {"role": "developer", "content": INSIGHT_SYSTEM_PROMPT},
        {"role": "user", "content": user_msg},
    ]

    try:
        import re
        resp = await _call_llm(messages, "chatgpt")
        match = re.search(r"\[.*?\]", resp, re.DOTALL)
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
    brand_id: str | None = None,
) -> list[dict]:
    """Generate tailored dashboard-level insights using LLM with rich context."""
    if not all_results:
        return []

    # Build rich context using the copilot's context builder
    context = ""
    if brand_id:
        try:
            from app.services.tools.domain import build_brand_context
            context = await build_brand_context(brand_id)
        except Exception as e:
            logger.debug("Failed to build brand context for dashboard insights: %s", e)

    if not context:
        # Fallback to simpler context
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
        context = (
            f"Brand: {brand_name}\n"
            f"Industry: {industry}\n"
            f"Domain: {brand_domain}\n\n"
            f"Scan results across all queries:\n" + "\n".join(lines)
        )

    user_msg = (
        f"Generate 2-3 specific, actionable insights for this brand's overall AI visibility.\n\n"
        f"Focus on:\n"
        f"- Which models mention the brand most/least and why\n"
        f"- Which competitors are dominating and what they're doing differently\n"
        f"- The biggest opportunities for improvement\n"
        f"- Specific, concrete next steps (not vague advice)\n\n"
        f"Brand data:\n{context}"
    )

    messages = [
        {"role": "developer", "content": INSIGHT_SYSTEM_PROMPT},
        {"role": "user", "content": user_msg},
    ]

    try:
        import re
        resp = await _call_llm(messages, "chatgpt")
        match = re.search(r"\[.*?\]", resp, re.DOTALL)
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
