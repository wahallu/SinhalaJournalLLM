"""
Async Groq client — used for visual prompt generation.

Groq's API is OpenAI Chat Completions–compatible:

    POST https://api.groq.com/openai/v1/chat/completions

Only used by visual_prompt_service; services never call this directly.
"""

import asyncio
import logging

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_GROQ_BASE = "https://api.groq.com/openai/v1"
_TIMEOUT = 60.0   # seconds
_MAX_RETRIES = 3  # retry on 429 (rate limit) before giving up


class GroqUnavailable(Exception):
    """Raised when the Groq API can't produce a completion."""


async def groq_chat(
    messages: list[dict],
    *,
    temperature: float = 0.3,
    max_tokens: int = 2048,
) -> str:
    """
    Send a chat completion request to Groq and return the text response.
    Retries on 429 (rate limit) with exponential back-off.

    Raises:
        GroqUnavailable: on missing key, exhausted retries, or bad response shape.
    """
    settings = get_settings()
    if not settings.GROQ_API_KEY:
        raise GroqUnavailable("GROQ_API_KEY is not configured")

    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": settings.GROQ_MODEL,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        # The current GROQ_MODEL default (openai/gpt-oss-120b) is a
        # chain-of-thought model: without this, it burns the token budget on
        # an internal <think> trace and "content" comes back empty. "low"
        # keeps the visible reasoning short so the actual answer lands in
        # content within a normal max_tokens budget.
        "reasoning_effort": "low",
    }

    last_error: Exception | None = None
    for attempt in range(_MAX_RETRIES):
        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                response = await client.post(
                    f"{_GROQ_BASE}/chat/completions",
                    headers=headers,
                    json=payload,
                )

            if response.status_code == 429:
                wait = 2 ** attempt  # 1s, 2s, 4s
                logger.warning(
                    "Groq rate-limited on attempt %d/%d — waiting %ds",
                    attempt + 1, _MAX_RETRIES, wait,
                )
                await asyncio.sleep(wait)
                last_error = GroqUnavailable(f"HTTP {response.status_code}")
                continue

            response.raise_for_status()
            data = response.json()

            # Groq can embed API-level errors inside a 200 response
            if "error" in data:
                err = data["error"]
                raise GroqUnavailable(
                    f"Groq API error {err.get('code', '')}: {err.get('message', err)}"
                )

            content = data["choices"][0]["message"].get("content")
            if not content:
                raise GroqUnavailable(f"Groq returned empty content: {data}")
            return content.strip()

        except (httpx.HTTPError, KeyError, IndexError) as exc:
            last_error = exc
            logger.warning("Groq attempt %d/%d failed: %s", attempt + 1, _MAX_RETRIES, exc)
            await asyncio.sleep(1)

    raise GroqUnavailable(f"Groq failed after {_MAX_RETRIES} attempts: {last_error}")
