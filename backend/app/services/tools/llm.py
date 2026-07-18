"""LLM tools — secure LLM API operations for agents."""
import json
import re
import logging
from typing import AsyncGenerator

import httpx

from app.core.config import settings
from app.services.llm_core import MODEL_REGISTRY, _parse_json

logger = logging.getLogger(__name__)

# Allowed model keys for agent use
ALLOWED_AGENT_MODELS = {"chatgpt", "llama", "llama-small", "gemini", "claude", "deepseek"}


async def call_llm(messages: list[dict], model_key: str = "chatgpt",
                   temperature: float = 0.3, max_tokens: int = 1024,
                   timeout: float = 30) -> str:
    """Call an LLM via OpenRouter and return the response text.

    Security:
    - Model key validated against allowlist
    - Timeout enforced
    - Rate limiting handled by caller
    """
    if model_key not in ALLOWED_AGENT_MODELS:
        raise ValueError(f"Model '{model_key}' not allowed. Use: {ALLOWED_AGENT_MODELS}")

    if not settings.OPENROUTER_API_KEY:
        raise ValueError("OPENROUTER_API_KEY not configured")

    model = MODEL_REGISTRY[model_key]
    payload = {
        "model": model["id"],
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    headers = {
        "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
        "HTTP-Referer": "https://llmrank.dev",
        "X-Title": "LLMRank",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers=headers,
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()

    choices = data.get("choices")
    if not choices:
        raise ValueError(f"{model['label']} returned no choices")

    content = choices[0].get("message", {}).get("content")
    if not content:
        raise ValueError(f"{model['label']} returned empty content")

    logger.info("LLM call: model=%s tokens=%d", model_key, len(content.split()))
    return content


async def call_llm_json(messages: list[dict], model_key: str = "chatgpt",
                        temperature: float = 0.3, max_tokens: int = 1024) -> any:
    """Call an LLM and parse the response as JSON."""
    response = await call_llm(messages, model_key, temperature, max_tokens)
    return _parse_json(response)


async def stream_llm(messages: list[dict], model_key: str = "claude",
                     temperature: float = 0.5, max_tokens: int = 2048,
                     timeout: float = 60) -> AsyncGenerator[str, None]:
    """Stream an LLM response token-by-token."""
    if model_key not in ALLOWED_AGENT_MODELS:
        raise ValueError(f"Model '{model_key}' not allowed. Use: {ALLOWED_AGENT_MODELS}")

    if not settings.OPENROUTER_API_KEY:
        raise ValueError("OPENROUTER_API_KEY not configured")

    model = MODEL_REGISTRY[model_key]
    payload = {
        "model": model["id"],
        "messages": messages,
        "stream": True,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    headers = {
        "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
        "HTTP-Referer": "https://llmrank.dev",
        "X-Title": "LLMRank",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=timeout) as client:
        async with client.stream(
            "POST", "https://openrouter.ai/api/v1/chat/completions",
            headers=headers, json=payload,
        ) as resp:
            if resp.status_code != 200:
                raise ValueError(f"LLM streaming error: {resp.status_code}")

            import re as _re
            newline_buffer = ""
            async for line in resp.aiter_lines():
                if line.startswith("data: "):
                    data = line[6:]
                    if data.strip() == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data)
                        choices = chunk.get("choices", [])
                        delta = choices[0].get("delta", {}) if choices else {}
                        content = delta.get("content", "")
                        if content:
                            newline_buffer += content
                            if "\n\n\n" in newline_buffer:
                                newline_buffer = _re.sub(r"\n{3,}", "\n\n", newline_buffer)
                            if newline_buffer and (not content.isspace() or newline_buffer.count("\n") <= 2):
                                clean = _re.sub(r"\n{3,}", "\n\n", newline_buffer)
                                if clean:
                                    yield clean
                                newline_buffer = ""
                    except json.JSONDecodeError:
                        continue

            if newline_buffer.strip():
                clean = _re.sub(r"\n{3,}", "\n\n", newline_buffer)
                if clean:
                    yield clean


def parse_json_response(text: str) -> any:
    """Parse JSON from LLM response text."""
    return _parse_json(text)
