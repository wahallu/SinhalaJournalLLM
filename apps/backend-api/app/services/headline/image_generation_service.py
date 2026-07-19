"""
Image generation service.

Takes an English visual prompt and calls Gemini's image generation API
(gemini-3.1-flash-image, "Nano Banana 2") to produce a base64-encoded image.

The google-genai SDK's generate_content call is synchronous, so we run it
inside asyncio's thread-pool executor to keep the FastAPI event loop free.
"""

import asyncio
import base64
import logging
from functools import lru_cache

from app.core.config import get_settings

logger = logging.getLogger(__name__)

# Stable Nano Banana 2 model — replaces the deprecated preview string
_IMAGE_MODEL = "gemini-3.1-flash-image"


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

    Mirrors the updated Nano Banana 2 logic from the bug-fix directive:
      1. Target gemini-3.1-flash-image
      2. Explicitly set responseModalities=["IMAGE"]
      3. Robustly walk all response parts to find inline image data

    Returns:
        Base64-encoded image string (PNG or JPEG).

    Raises:
        ImageGenerationError: if no inline image data is found in the response.
    """
    from google.genai import types  # type: ignore[import]

    client = _get_genai_client()

    # 1. Point to the active Nano Banana 2 model with IMAGE modality
    response = client.models.generate_content(
        model=_IMAGE_MODEL,
        contents=[
            types.Content(
                parts=[types.Part(text=prompt)],
            )
        ],
        config=types.GenerateContentConfig(
            # 2. Explicitly request IMAGE output (required for this model)
            response_modalities=["IMAGE"],
        ),
    )

    # 3. Robustly walk all candidates → parts to find inline image data
    base64_data: str | None = None
    mime: str = "image/png"

    for candidate in response.candidates or []:
        for part in (candidate.content.parts or []):
            inline = getattr(part, "inline_data", None)
            if inline and getattr(inline, "data", None):
                raw = inline.data
                mime = getattr(inline, "mime_type", "image/png") or "image/png"
                if isinstance(raw, (bytes, bytearray)):
                    base64_data = base64.b64encode(raw).decode("utf-8")
                else:
                    # SDK may already return a base64 string
                    base64_data = raw
                break
        if base64_data:
            break

    if not base64_data:
        raise ImageGenerationError(
            "Gemini responded successfully but no inline image data was found. "
            "The model may not support this prompt or quota may be exhausted."
        )

    logger.info("Nano Banana 2 image generation succeeded (mime=%s)", mime)
    return base64_data, mime


async def generate_image_from_prompt(visual_prompt: str) -> dict:
    """
    Generate an image from an English visual prompt via Gemini Nano Banana 2.

    Args:
        visual_prompt: The detailed English image-generation prompt.

    Returns:
        dict with keys:
            image_data  – base64-encoded image string
            mime_type   – actual MIME type reported by the API (e.g. 'image/png')

    Raises:
        ImageGenerationError: if the API key is missing or the call fails.
    """
    logger.info(
        "Requesting image from %s (prompt length=%d chars)",
        _IMAGE_MODEL,
        len(visual_prompt),
    )

    loop = asyncio.get_running_loop()
    try:
        image_b64, mime = await loop.run_in_executor(
            None,
            _blocking_generate_image,
            visual_prompt,
        )
    except ImageGenerationError:
        raise
    except Exception as exc:
        raise ImageGenerationError(
            f"Gemini ({_IMAGE_MODEL}) image generation failed: {exc}"
        ) from exc

    return {"image_data": image_b64, "mime_type": mime}
