"""Core LLM interaction: model registry, OpenRouter calls, JSON parsing."""
import json
import re
import logging
from typing import Optional

import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)

# ─── Model Registry ────────────────────────────────────────────────────────────

MODEL_REGISTRY: dict[str, dict] = {
    "chatgpt":     {"id": "openai/gpt-4o-mini",              "label": "GPT-4o Mini"},
    "gpt4o":       {"id": "openai/gpt-4o",                   "label": "GPT-4o"},
    "gemini":      {"id": "google/gemini-3-flash-preview",    "label": "Gemini 3 Flash"},
    "llama":       {"id": "meta-llama/llama-3.3-70b-instruct","label": "Llama 3.3 70B"},
    "llama-small": {"id": "meta-llama/llama-3.1-8b-instruct", "label": "Llama 3.1 8B"},
    "claude":      {"id": "anthropic/claude-sonnet-4.5",       "label": "Claude Sonnet 4.5"},
    "deepseek":    {"id": "deepseek/deepseek-chat",           "label": "DeepSeek Chat"},
    "deepseek-r1": {"id": "deepseek/deepseek-r1",             "label": "DeepSeek R1"},
    "mistral":     {"id": "mistralai/mistral-large",          "label": "Mistral Large"},
    "qwen":        {"id": "qwen/qwen-2.5-72b-instruct",       "label": "Qwen 2.5 72B"},
}

ALL_LLM_KEYS = list(MODEL_REGISTRY.keys())

# ─── Prompts ───────────────────────────────────────────────────────────────────

SCAN_DEVELOPER = (
    "You are a product recommendation engine. A user has asked a question. "
    "Return ONLY a valid JSON object with this exact schema. Do NOT make up products or brands.\n"
    '{"items":[{"name":"Real Product","position":1,"description":"one sentence why"}],'
    '"competitors":["Existing Competitor Name"],'
    '"summary":"natural language summary of your full answer"}\n'
    "RULES:\n"
    "- Only include real products and competitor names you are certain exist\n"
    "- If you don't know any competitors, return an empty array []\n"
    "- Never make up brands like 'BrandA' or 'Brand1'\n"
    "- Give a genuine, helpful answer to the user's question\n"
    "- No text, no markdown, no explanation. Only the JSON object."
)

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
    headers = {"Authorization": f"Bearer {settings.OPENROUTER_API_KEY}", "HTTP-Referer": "https://llmranked.org", "X-Title": "LLMRanked", "Content-Type": "application/json"}
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
    """Safely extract JSON from LLM response. Tries direct parse, then code block, then bracket-matching."""
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
    # Use non-greedy matching to avoid capturing across multiple JSON objects
    match = re.search(r"(\[.*?\]|\{.*?\})", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except (json.JSONDecodeError, TypeError):
            pass
    raise ValueError("No valid JSON found in LLM response")


# ─── Scan ──────────────────────────────────────────────────────────────────────

async def scan_query(query_text: str, llm_name: str, client, brand_name: str = "") -> tuple[Optional[dict], Optional[str]]:
    """Query an LLM for a scan. Returns (parsed_json, error_message).
    
    Post-hoc detects brand mentions in the LLM's response text rather than
    relying on LLM self-reporting, giving an accurate organic visibility measurement.
    """
    import asyncio
    messages = [
        {"role": "developer", "content": SCAN_DEVELOPER},
        {"role": "user", "content": f"<query>{query_text}</query>"},
    ]
    for attempt in range(3):
        try:
            resp = await _call_openrouter(messages, llm_name, client)
            try:
                parsed = _parse_json(resp)
            except ValueError:
                logger.warning("Scan %s/%s: JSON parse failed, using fallback. Response: %s",
                               llm_name, query_text[:40], resp[:200])
                parsed = {
                    "items": [{"name": line.strip(), "position": i + 1, "description": ""}
                               for i, line in enumerate(resp.strip().split("\n")) if line.strip()],
                    "competitors": [],
                    "summary": resp[:500],
                }

            # Store the full raw response text for display
            parsed["raw_response_text"] = resp

            # Post-hoc brand mention detection
            brand_mentioned = False
            brand_position = None
            brand_sentiment = "not_mentioned"
            
            if brand_name:
                summary_text = parsed.get("summary", "").lower()
                items = parsed.get("items", [])
                brand_lower = brand_name.lower()
                
                # Use word-boundary regex for exact brand matching to avoid false positives
                # e.g., "Art" should not match "SmartArt", "Go" should not match "going"
                brand_pattern = re.compile(r'\b' + re.escape(brand_lower) + r'\b', re.IGNORECASE)
                
                # Check items list for brand mention
                for item in items:
                    item_name = item.get("name", "").lower()
                    if brand_lower == item_name or brand_pattern.search(item.get("name", "")):
                        brand_mentioned = True
                        brand_position = item.get("position")
                        break
                
                # Also check summary text
                if not brand_mentioned and brand_pattern.search(summary_text):
                    brand_mentioned = True
                
                # Fuzzy check: brand name words appear in items (at least 1 word for 2-word brands)
                if not brand_mentioned and len(brand_name.split()) > 1:
                    brand_words = set(brand_lower.split())
                    for item in items:
                        item_words = set(item.get("name", "").lower().split())
                        if len(brand_words & item_words) >= 1:
                            brand_mentioned = True
                            brand_position = item.get("position")
                            break

                # Determine sentiment — scope to text about the brand only
                if brand_mentioned:
                    # Extract text segments that mention the brand
                    brand_relevant_text = ""
                    if brand_pattern.search(summary_text):
                        brand_relevant_text += parsed.get("summary", "") + " "
                    for item in items:
                        item_desc = item.get("description", "")
                        item_name = item.get("name", "")
                        if brand_pattern.search(item_name) or brand_pattern.search(item_desc):
                            brand_relevant_text += f" {item_name} {item_desc}"
                    
                    # Fall back to full text if no brand-specific segments found
                    if not brand_relevant_text.strip():
                        brand_relevant_text = parsed.get("summary", "") + " " + " ".join(
                            item.get("description", "") for item in items
                        )
                    
                    full_text = brand_relevant_text.lower()
                    
                    # Use word-boundary matching for sentiment keywords to avoid false matches
                    # e.g., "best" should not match "bestial", "top" should not match "topic"
                    positive_signals = ["best", "excellent", "top", "great", "recommend", "leading", "popular", "trusted", "innovative", "award"]
                    negative_signals = ["avoid", "poor", "bad", "issue", "problem", "complaint", "expensive", "overpriced", "disappointing"]
                    
                    pos_count = sum(1 for s in positive_signals if re.search(r'\b' + re.escape(s) + r'\b', full_text))
                    neg_count = sum(1 for s in negative_signals if re.search(r'\b' + re.escape(s) + r'\b', full_text))
                    
                    if pos_count > neg_count:
                        brand_sentiment = "positive"
                    elif neg_count > pos_count:
                        brand_sentiment = "negative"
                    else:
                        brand_sentiment = "neutral"

            parsed["brand_mentioned"] = brand_mentioned
            parsed["brand_position"] = brand_position
            parsed["brand_sentiment"] = brand_sentiment

            logger.info("Scan %s/%s: brand_mentioned=%s position=%s competitors=%d",
                        llm_name, query_text[:40],
                        parsed.get("brand_mentioned"),
                        parsed.get("brand_position"),
                        len(parsed.get("competitors", [])))
            return parsed, None
        except httpx.HTTPStatusError as e:
            status = e.response.status_code
            if status == 429:
                return None, f"{llm_name} rate limited"
            if status in (500, 502, 503, 504) and attempt < 2:
                await asyncio.sleep(2 * (2 ** attempt))
                continue
            return None, str(e)
        except Exception as e:
            return None, str(e)
    return None, f"{llm_name} unavailable after retries"


async def scan_all_llms(queries: list[tuple[str, str]], llm_names: list[str], client, brand_name: str = "") -> list[tuple[str, str, dict | None, Optional[str]]]:
    """Returns [(query_id, llm_name, result_dict_or_None, error_or_None)]."""
    import asyncio
    semaphore = asyncio.Semaphore(10)  # Limit concurrent requests

    async def _bounded_scan(q_text, llm):
        async with semaphore:
            return await scan_query(q_text, llm, client, brand_name)

    tasks = [_bounded_scan(q_text, llm) for q_id, q_text in queries for llm in llm_names]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    out = []
    idx = 0
    for q_id, _ in queries:
        for llm in llm_names:
            result = results[idx]
            if isinstance(result, Exception):
                out.append((q_id, llm, None, str(result)))
            else:
                out.append((q_id, llm, result[0], result[1]))
            idx += 1
    return out
