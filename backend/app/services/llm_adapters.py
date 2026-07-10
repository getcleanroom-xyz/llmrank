"""Backward-compatible re-exports — prefer importing from llm_core / competitor_service / query_generator."""
from app.services.llm_core import (  # noqa: F401
    MODEL_REGISTRY,
    ALL_LLM_KEYS,
    SCAN_DEVELOPER,
    OpenRouterAdapter,
    _call_openrouter,
    _parse_json,
    scan_query,
    scan_all_llms,
)
from app.services.competitor_service import (  # noqa: F401
    _is_valid_competitor,
    classify_brand,
    discover_competitors_from_crawl,
    discover_competitors_by_category,
    crawl_competitor_sites,
    competitors_need_refresh,
)
from app.services.query_generator import (  # noqa: F401
    generate_scored_queries,
    run_probe_scan,
    orchestrate_query_generation,
    query_llm,
    query_all_llms,
)
