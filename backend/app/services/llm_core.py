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
    '"brand_mentioned":true_or_false,'
    '"brand_position":1_or_null,'
    '"brand_sentiment":"positive"|"neutral"|"negative"|"not_mentioned",'
    '"competitors":["Existing Competitor Name"],'
    '"summary":"natural language summary"}\n'
    "RULES:\n"
    "- Only include real products and competitor names you are certain exist\n"
    "- If you don't know any competitors, return an empty array []\n"
    "- If the brand was NOT mentioned, set brand_mentioned: false and brand_position: null\n"
    "- Never make up brands like 'BrandA' or 'Brand1'\n"
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
    import asyncio
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
    import asyncio
    tasks = [scan_query(q_text, llm, client) for q_id, q_text in queries for llm in llm_names]
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
