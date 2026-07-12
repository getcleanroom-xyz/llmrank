"""Summarize tool — extract structured company info from crawled content + Google search."""
import logging

logger = logging.getLogger(__name__)


async def summarize_company(crawl_content: str, brand_name: str, domain: str) -> dict:
    """Summarize what a company does based on crawled content and Google search.

    Combines website content with Google search results for comprehensive info.
    Returns structured data: description, industry, category, features, competitors, use_cases.
    """
    from app.services.tools.llm import call_llm_json
    from app.services.tools.google_search import search_google

    # Get Google search results for additional context
    search_results = await search_google(brand_name, domain)

    # Combine crawl content and search results
    context_parts = []
    if crawl_content:
        context_parts.append(f"WEBSITE CONTENT:\n{crawl_content}")
    if search_results:
        context_parts.append(f"GOOGLE SEARCH RESULTS:\n{search_results}")

    if not context_parts:
        return {
            "description": f"{brand_name} at {domain}",
            "industry": None,
            "category": None,
            "key_features": [],
            "target_audience": None,
            "use_cases": [],
            "competitors_mentioned": [],
            "value_proposition": None,
        }

    full_context = "\n\n".join(context_parts)

    prompt = f"""Analyze this information about {brand_name} ({domain}) and extract structured company data.

{full_context}

Return a JSON object with exactly these fields:
{{
  "description": "One paragraph describing what this company/product does",
  "industry": "Primary industry (e.g., SaaS, E-commerce, FinTech)",
  "category": "Specific product category (e.g., Email Service, Analytics Tool, CRM)",
  "key_features": ["feature1", "feature2", "feature3"],
  "target_audience": "Who uses this product (e.g., developers, marketers, enterprises)",
  "use_cases": ["use case 1", "use case 2", "use case 3"],
  "competitors_mentioned": ["competitor1", "competitor2"],
  "value_proposition": "One sentence: why would someone use this over alternatives?"
}}

RULES:
- Combine information from both website content and search results
- If information is not available in either source, use null
- Be specific, not generic
- Return ONLY the JSON object, no text before or after"""

    messages = [
        {"role": "developer", "content": "Return ONLY a valid JSON object. No text, no markdown, no explanation."},
        {"role": "user", "content": prompt},
    ]

    try:
        result = await call_llm_json(messages, model_key="chatgpt", temperature=0.2, max_tokens=1024)
        if isinstance(result, dict):
            logger.info("Summarized %s: industry=%s, category=%s, features=%d, competitors=%d",
                        brand_name, result.get("industry"), result.get("category"),
                        len(result.get("key_features", [])),
                        len(result.get("competitors_mentioned", [])))
            return result
    except Exception as e:
        logger.warning("Summarize failed for %s: %s", brand_name, e)

    return {
        "description": f"{brand_name} at {domain}",
        "industry": None,
        "category": None,
        "key_features": [],
        "target_audience": None,
        "use_cases": [],
        "competitors_mentioned": [],
        "value_proposition": None,
    }
