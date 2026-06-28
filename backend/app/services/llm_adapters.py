import httpx
import asyncio
import logging
from abc import ABC, abstractmethod
from app.core.config import settings

logger = logging.getLogger(__name__)

SCAN_PROMPT_TEMPLATE = """You are a helpful assistant. A user is asking for recommendations.

User question: {query}

Please provide a comprehensive, honest answer listing the best options. Be specific about which tools or products you recommend and why. List them in order of your recommendation."""


# ─── OpenRouter Model Registry ────────────────────────────────────────────────

MODEL_REGISTRY: dict[str, dict] = {
    # OpenAI
    "chatgpt": {"id": "openai/gpt-4o-mini", "label": "GPT-4o Mini", "provider": "OpenAI", "free": False, "cost_per_request": 0.01},
    "gpt4o": {"id": "openai/gpt-4o", "label": "GPT-4o", "provider": "OpenAI", "free": False, "cost_per_request": 0.03},

    # Google
    "gemini": {"id": "google/gemini-2.5-flash", "label": "Gemini 2.5 Flash", "provider": "Google", "free": False, "cost_per_request": 0.02},

    # Meta
    "llama": {"id": "meta-llama/llama-3.3-70b-instruct", "label": "Llama 3.3 70B", "provider": "Meta", "free": False, "cost_per_request": 0.01},
    "llama-small": {"id": "meta-llama/llama-3.1-8b-instruct", "label": "Llama 3.1 8B", "provider": "Meta", "free": False, "cost_per_request": 0.005},

    # Anthropic
    "claude": {"id": "anthropic/claude-haiku-4.5", "label": "Claude Haiku", "provider": "Anthropic", "free": False, "cost_per_request": 0.01},

    # DeepSeek
    "deepseek": {"id": "deepseek/deepseek-chat", "label": "DeepSeek Chat", "provider": "DeepSeek", "free": False, "cost_per_request": 0.01},
    "deepseek-r1": {"id": "deepseek/deepseek-r1", "label": "DeepSeek R1", "provider": "DeepSeek", "free": False, "cost_per_request": 0.01},

    # Mistral
    "mistral": {"id": "mistralai/mistral-large", "label": "Mistral Large", "provider": "Mistral", "free": False, "cost_per_request": 0.02},

    # Qwen
    "qwen": {"id": "qwen/qwen-2.5-72b-instruct", "label": "Qwen 2.5 72B", "provider": "Alibaba", "free": False, "cost_per_request": 0.01},
}


# ─── LLM Adapter ──────────────────────────────────────────────────────────────

class LLMAdapter(ABC):
    name: str
    model_id: str
    label: str

    @abstractmethod
    async def query(self, prompt: str) -> str:
        pass


class OpenRouterAdapter(LLMAdapter):
    """Unified adapter for all models via OpenRouter API."""

    BASE_URL = "https://openrouter.ai/api/v1/chat/completions"

    def __init__(self, model_key: str):
        model = MODEL_REGISTRY[model_key]
        self.name = model_key
        self.model_id = model["id"]
        self.label = model["label"]

    async def query(self, prompt: str) -> str:
        if not settings.OPENROUTER_API_KEY:
            raise ValueError("OPENROUTER_API_KEY not configured")

        headers = {
            "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
            "HTTP-Referer": "https://llmrank.dev",
            "X-Title": "LLMRank",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model_id,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.3,
            "max_tokens": 1024,
        }

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(self.BASE_URL, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()

            choices = data.get("choices")
            if not choices:
                raise ValueError(f"{self.label} returned no choices")
            content = choices[0].get("message", {}).get("content")
            if not content:
                raise ValueError(f"{self.label} returned empty content")
            return content


# ─── Adapter Factory ──────────────────────────────────────────────────────────

ALL_ADAPTERS: dict[str, LLMAdapter] = {
    key: OpenRouterAdapter(key) for key in MODEL_REGISTRY
}


async def query_llm(llm_name: str, query_text: str) -> tuple[str, str | None]:
    """
    Returns (response_text, error_message).
    Retries on 503 with exponential backoff. Does NOT retry on 429.
    """
    adapter = ALL_ADAPTERS.get(llm_name)
    if not adapter:
        return "", f"Unknown LLM: {llm_name}"

    prompt = SCAN_PROMPT_TEMPLATE.format(query=query_text)
    last_error = None
    max_retries = 3
    retry_delay = 2

    for attempt in range(max_retries):
        try:
            response = await adapter.query(prompt)
            return response, None
        except httpx.HTTPStatusError as e:
            last_error = e
            status = e.response.status_code
            if status == 429:
                logger.warning("%s rate limited (429), skipping", llm_name)
                return "", f"{llm_name} rate limited (429)"
            if status == 503:
                delay = retry_delay * (2 ** attempt)
                logger.warning("%s returned 503, retrying in %ds (attempt %d/%d)", llm_name, delay, attempt + 1, max_retries)
                await asyncio.sleep(delay)
                continue
            return "", str(e)
        except Exception as e:
            return "", str(e)

    return "", f"{llm_name} unavailable after {max_retries} retries: {last_error}"


async def query_all_llms(
    query_text: str,
    llm_names: list[str],
) -> dict[str, tuple[str, str | None]]:
    """Fire all LLM queries concurrently. Returns dict of llm_name → (response, error)."""
    tasks = {name: query_llm(name, query_text) for name in llm_names}
    results = await asyncio.gather(*tasks.values(), return_exceptions=False)
    return dict(zip(tasks.keys(), results))
