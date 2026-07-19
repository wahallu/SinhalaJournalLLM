"""
Async Groq client — used exclusively by the visual-prompt service.

Groq exposes an OpenAI-compatible Chat Completions endpoint:

    POST https://api.groq.com/openai/v1/chat/completions

httpx is already a project dependency so no extra SDK is required.
"""

import asyncio
import logging

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_GROQ_BASE = "https://api.groq.com/openai/v1"
_TIMEOUT = 60.0       # seconds
_MAX_RETRIES = 3      # retry on 429 (rate-limit) with backoff


class GroqUnavailable(Exception):
    """Raised when the Groq API can't produce a completion."""


async def groq_chat(
    messages: list[dict],
    *,
    temperature: float = 0.7,
    max_tokens: int = 300,
) -> str:
    """
    Send a chat completion request to Groq and return the text response.
    Retries on HTTP 429 (rate-limit) with exponential backoff.

    Args:
        messages:    OpenAI-style message list (role/content dicts).
        temperature: Sampling temperature.
        max_tokens:  Maximum output tokens.

    Returns:
        The model's text response, stripped of leading/trailing whitespace.

    Raises:
        GroqUnavailable: if the API key is missing, retries are exhausted,
                         or the response shape is unexpected.
    """
    settings = get_settings()
    if not settings.GROQ_API_KEY:
        raise GroqUnavailable("GROQ_API_KEY is not configured in .env")

    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": settings.GROQ_MODEL,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
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
                last_error = GroqUnavailable("HTTP 429 rate-limit")
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

            logger.info(
                "Groq (%s) responded successfully on attempt %d",
                settings.GROQ_MODEL, attempt + 1,
            )
            return content.strip()

        except (httpx.HTTPError, KeyError, IndexError) as exc:
            last_error = exc
            logger.warning(
                "Groq attempt %d/%d failed: %s", attempt + 1, _MAX_RETRIES, exc
            )
            await asyncio.sleep(1)

    raise GroqUnavailable(
        f"Groq failed after {_MAX_RETRIES} attempts: {last_error}"
    )
