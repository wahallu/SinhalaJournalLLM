"""
Async OpenRouter client — hosted-LLM fallback for when the SinLlama GPU
server is offline. OpenRouter is API-compatible with OpenAI Chat Completions:

    POST https://openrouter.ai/api/v1/chat/completions

Only used by the model gateway; services never call this directly.
"""

import asyncio
import logging

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_OPENROUTER_BASE = "https://openrouter.ai/api/v1"
_TIMEOUT = 60.0  # seconds
_MAX_RETRIES = 3  # retry on 429/402 before giving up


class OpenRouterUnavailable(Exception):
    """Raised when OpenRouter can't produce a completion."""


async def openrouter_chat(
    messages: list[dict],
    *,
    temperature: float = 0.3,
    max_tokens: int = 2048,
) -> str:
    """
    Send a chat completion request and return the text response.
    Retries on 429 (rate limit) and 402 (free-tier quota) with backoff.

    Raises:
        OpenRouterUnavailable: on missing key, exhausted retries, or bad shape.
    """
    settings = get_settings()
    if not settings.OPENROUTER_API_KEY:
        raise OpenRouterUnavailable("OPENROUTER_API_KEY is not configured")

    headers = {
        "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://sinhalajournalllm.local",
        "X-Title": "SinAI - Sinhala Journalism LLM",
    }
    payload = {
        "model": settings.OPENROUTER_MODEL,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    last_error: Exception | None = None
    for attempt in range(_MAX_RETRIES):
        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                response = await client.post(
                    f"{_OPENROUTER_BASE}/chat/completions",
                    headers=headers,
                    json=payload,
                )

            if response.status_code in (429, 402):
                wait = 2 ** attempt  # 1s, 2s, 4s
                logger.warning(
                    "OpenRouter %d on attempt %d/%d — waiting %ds",
                    response.status_code, attempt + 1, _MAX_RETRIES, wait,
                )
                await asyncio.sleep(wait)
                last_error = OpenRouterUnavailable(f"HTTP {response.status_code}")
                continue

            response.raise_for_status()
            data = response.json()

            # OpenRouter can embed API-level errors inside a 200 response
            if "error" in data:
                err = data["error"]
                raise OpenRouterUnavailable(
                    f"OpenRouter API error {err.get('code', '')}: {err.get('message', err)}"
                )

            content = data["choices"][0]["message"].get("content")
            if not content:
                raise OpenRouterUnavailable(f"OpenRouter returned empty content: {data}")
            return content.strip()

        except (httpx.HTTPError, KeyError, IndexError) as exc:
            last_error = exc
            logger.warning("OpenRouter attempt %d/%d failed: %s", attempt + 1, _MAX_RETRIES, exc)
            await asyncio.sleep(1)

    raise OpenRouterUnavailable(f"OpenRouter failed after {_MAX_RETRIES} attempts: {last_error}")
