"""
Async Gemini client — used exclusively by the visual-prompt service to call
Google Gemini 2.5 Flash.

The google-genai SDK is sync-first, so we wrap the blocking call in an
asyncio thread-pool executor to keep the FastAPI event loop unblocked.
"""

import asyncio
import logging
from functools import lru_cache

from app.core.config import get_settings

logger = logging.getLogger(__name__)


class GeminiUnavailable(Exception):
    """Raised when the Gemini API can't produce a completion."""


@lru_cache(maxsize=1)
def _get_genai_client():
    """Lazily import and initialise the google-genai client (cached singleton)."""
    try:
        from google import genai  # type: ignore[import]
    except ImportError as exc:
        raise GeminiUnavailable(
            "google-genai package is not installed. "
            "Add 'google-genai>=1.0.0' to requirements.txt and reinstall."
        ) from exc

    settings = get_settings()
    if not settings.GEMINI_API_KEY:
        raise GeminiUnavailable("GEMINI_API_KEY is not configured in .env")

    return genai.Client(api_key=settings.GEMINI_API_KEY)


def _blocking_generate(system_prompt: str, user_message: str, temperature: float, max_tokens: int) -> str:
    """Synchronous Gemini call — run inside a thread executor."""
    from google.genai import types  # type: ignore[import]

    client = _get_genai_client()
    settings = get_settings()

    config = types.GenerateContentConfig(
        system_instruction=system_prompt,
        temperature=temperature,
        max_output_tokens=max_tokens,
    )

    response = client.models.generate_content(
        model=settings.GEMINI_MODEL,
        contents=user_message,
        config=config,
    )

    text = response.text
    if not text or not text.strip():
        raise GeminiUnavailable("Gemini returned an empty response")

    return text.strip()


async def gemini_generate(
    system_prompt: str,
    user_message: str,
    *,
    temperature: float = 0.7,
    max_tokens: int = 300,
) -> str:
    """
    Async wrapper around Gemini content generation.

    Runs the blocking google-genai call in a thread-pool executor so it
    doesn't block the FastAPI event loop.

    Args:
        system_prompt: The system/persona instruction for the model.
        user_message:  The user turn content.
        temperature:   Sampling temperature (default 0.7 for creative tasks).
        max_tokens:    Maximum output tokens.

    Returns:
        The model's text response, stripped of leading/trailing whitespace.

    Raises:
        GeminiUnavailable: if the API key is missing, the package is absent,
                           or the API call fails.
    """
    logger.info(
        "Calling Gemini (%s) — user message length=%d chars",
        get_settings().GEMINI_MODEL,
        len(user_message),
    )

    loop = asyncio.get_running_loop()
    try:
        result = await loop.run_in_executor(
            None,
            _blocking_generate,
            system_prompt,
            user_message,
            temperature,
            max_tokens,
        )
    except GeminiUnavailable:
        raise
    except Exception as exc:
        raise GeminiUnavailable(f"Gemini API call failed: {exc}") from exc

    return result
