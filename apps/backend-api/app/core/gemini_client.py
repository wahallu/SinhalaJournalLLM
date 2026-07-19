"""
Async Gemini API client — used for visual prompt generation.

Calls Google's Gemini generateContent REST endpoint using httpx so we
stay dependency-light (no google-generativeai SDK required).

  POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
"""

import logging
from typing import Any

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models"
_GEMINI_MODEL = "gemini-2.0-flash"  # fast, cost-effective Flash model

_TIMEOUT = httpx.Timeout(60.0, connect=10.0)


class GeminiUnavailable(Exception):
    """Raised when the Gemini API cannot produce a completion."""


async def gemini_generate(
    system_prompt: str,
    user_message: str,
    *,
    temperature: float = 0.7,
    max_output_tokens: int = 300,
) -> str:
    """
    Call the Gemini generateContent API and return the text response.

    Args:
        system_prompt:     System-level instruction for the model.
        user_message:      The user turn content.
        temperature:       Sampling temperature (0.0–1.0).
        max_output_tokens: Maximum tokens in the model response.

    Returns:
        The generated text string (stripped).

    Raises:
        GeminiUnavailable: on missing key, HTTP error, or unexpected response shape.
    """
    settings = get_settings()
    api_key = settings.GEMINI_API_KEY

    if not api_key:
        raise GeminiUnavailable("GEMINI_API_KEY is not configured")

    url = f"{_GEMINI_BASE}/{_GEMINI_MODEL}:generateContent"

    payload: dict[str, Any] = {
        "system_instruction": {
            "parts": [{"text": system_prompt}]
        },
        "contents": [
            {
                "role": "user",
                "parts": [{"text": user_message}],
            }
        ],
        "generationConfig": {
            "temperature": temperature,
            "maxOutputTokens": max_output_tokens,
        },
    }

    headers = {"Content-Type": "application/json"}
    params = {"key": api_key}

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.post(url, json=payload, headers=headers, params=params)

        if resp.status_code != 200:
            logger.error(
                "Gemini API error %d: %s", resp.status_code, resp.text[:500]
            )
            raise GeminiUnavailable(
                f"Gemini API returned HTTP {resp.status_code}: {resp.text[:200]}"
            )

        data = resp.json()
        candidates = data.get("candidates", [])
        if not candidates:
            raise GeminiUnavailable("Gemini API returned no candidates")

        parts = candidates[0].get("content", {}).get("parts", [])
        text = "".join(p.get("text", "") for p in parts).strip()

        if not text:
            raise GeminiUnavailable("Gemini API returned an empty text response")

        return text

    except httpx.HTTPError as exc:
        raise GeminiUnavailable(f"HTTP error calling Gemini API: {exc}") from exc
