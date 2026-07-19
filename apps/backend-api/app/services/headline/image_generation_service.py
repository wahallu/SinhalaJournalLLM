"""
Image generation service.

Takes an English visual prompt and calls Gemini's image generation API
(gemini-2.0-flash-preview-image-generation) to produce a base64-encoded image.

The google-genai SDK's generate_content call is synchronous, so we run it
inside asyncio's thread-pool executor to keep the FastAPI event loop free.
"""

import asyncio
import base64
import logging
from functools import lru_cache

from app.core.config import get_settings

logger = logging.getLogger(__name__)


class ImageGenerationError(Exception):
    """Raised when Gemini image generation fails."""


@lru_cache(maxsize=1)
def _get_genai_client():
    """Lazily initialise the google-genai client (cached singleton)."""
    try:
        from google import genai  # type: ignore[import]
    except ImportError as exc:
        raise ImageGenerationError(
            "google-genai package is not installed. "
            "Add 'google-genai>=1.0.0' to requirements.txt and reinstall."
        ) from exc

    settings = get_settings()
    if not settings.GEMINI_IMAGE_API_KEY:
        raise ImageGenerationError("GEMINI_IMAGE_API_KEY is not configured in .env")

    return genai.Client(api_key=settings.GEMINI_IMAGE_API_KEY)


def _blocking_generate_image(prompt: str) -> str:
    """
    Synchronous call to Gemini image generation — runs inside a thread executor.

    Returns:
        Base64-encoded PNG/JPEG image string.
    """
    from google.genai import types  # type: ignore[import]

    client = _get_genai_client()

    response = client.models.generate_content(
        model="gemini-2.0-flash-preview-image-generation",
        contents=prompt,
        config=types.GenerateContentConfig(
            response_modalities=["IMAGE", "TEXT"],
        ),
    )

    # Walk the response parts looking for an inline image
    for candidate in response.candidates or []:
        for part in candidate.content.parts or []:
            if hasattr(part, "inline_data") and part.inline_data:
                raw = part.inline_data.data
                # SDK may return bytes or an already-encoded str
                if isinstance(raw, (bytes, bytearray)):
                    return base64.b64encode(raw).decode("utf-8")
                return raw  # already base64 string

    raise ImageGenerationError(
        "Gemini returned no image data. The model may not support this prompt."
    )


async def generate_image_from_prompt(visual_prompt: str) -> dict:
    """
    Generate an image from an English visual prompt via Gemini.

    Args:
        visual_prompt: The detailed English image-generation prompt.

    Returns:
        dict with keys:
            image_data  – base64-encoded image string
            mime_type   – 'image/png' (assumed; adjust if SDK exposes it)

    Raises:
        ImageGenerationError: if the API key is missing or the call fails.
    """
    logger.info(
        "Generating image via Gemini (prompt length=%d chars)", len(visual_prompt)
    )

    loop = asyncio.get_running_loop()
    try:
        image_b64 = await loop.run_in_executor(
            None,
            _blocking_generate_image,
            visual_prompt,
        )
    except ImageGenerationError:
        raise
    except Exception as exc:
        raise ImageGenerationError(f"Gemini image generation failed: {exc}") from exc

    return {"image_data": image_b64, "mime_type": "image/png"}
