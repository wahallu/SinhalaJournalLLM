"""
Async NVIDIA NIM client — used for visual prompt generation.

NVIDIA's NIM API is OpenAI Chat Completions-compatible:

    POST https://integrate.api.nvidia.com/v1/chat/completions

Set NVIDIA_API_KEY and NVIDIA_MODEL in .env to enable.
"""

import asyncio
import logging

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_NVIDIA_BASE = "https://integrate.api.nvidia.com/v1"
_TIMEOUT = 60.0   # seconds
_MAX_RETRIES = 3  # retry on 429 before giving up


class NvidiaUnavailable(Exception):
    """Raised when the NVIDIA NIM API can't produce a completion."""


async def nvidia_chat(
    messages: list[dict],
    *,
    temperature: float = 0.7,
    max_tokens: int = 300,
) -> str:
    """
    Send a chat completion request to NVIDIA NIM and return the text response.
    Retries up to _MAX_RETRIES times on 429 (rate limit) with exponential backoff.

    Args:
        messages:    OpenAI-style message list (role + content dicts).
        temperature: Sampling temperature (0.0–1.0).
        max_tokens:  Maximum tokens in the response.

    Returns:
        The model's text response, stripped of leading/trailing whitespace.

    Raises:
        NvidiaUnavailable: on missing key, exhausted retries, or unexpected shape.
    """
    settings = get_settings()
    if not settings.NVIDIA_API_KEY:
        raise NvidiaUnavailable("NVIDIA_API_KEY is not configured")

    headers = {
        "Authorization": f"Bearer {settings.NVIDIA_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": settings.NVIDIA_MODEL,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    last_error: Exception | None = None
    for attempt in range(_MAX_RETRIES):
        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                response = await client.post(
                    f"{_NVIDIA_BASE}/chat/completions",
                    headers=headers,
                    json=payload,
                )

            if response.status_code == 429:
                wait = 2 ** attempt  # 1s, 2s, 4s
                logger.warning(
                    "NVIDIA NIM rate-limited on attempt %d/%d — waiting %ds",
                    attempt + 1, _MAX_RETRIES, wait,
                )
                await asyncio.sleep(wait)
                last_error = NvidiaUnavailable(f"HTTP 429")
                continue

            response.raise_for_status()
            data = response.json()

            # Surface any API-level errors inside a 200 response
            if "error" in data:
                err = data["error"]
                raise NvidiaUnavailable(
                    f"NVIDIA NIM API error {err.get('code', '')}: {err.get('message', err)}"
                )

            content = data["choices"][0]["message"].get("content")
            if not content:
                raise NvidiaUnavailable(f"NVIDIA NIM returned empty content: {data}")
            return content.strip()

        except (httpx.HTTPError, KeyError, IndexError) as exc:
            last_error = exc
            logger.warning(
                "NVIDIA NIM attempt %d/%d failed: %s", attempt + 1, _MAX_RETRIES, exc
            )
            await asyncio.sleep(1)

    raise NvidiaUnavailable(
        f"NVIDIA NIM failed after {_MAX_RETRIES} attempts: {last_error}"
    )
