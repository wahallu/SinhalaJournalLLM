"""
Hugging Face image generation service.

Calls Hugging Face Inference API using `stabilityai/stable-diffusion-xl-base-1.0`.

Auth:
    Authorization: Bearer {HUGGINGFACE_API_KEY}
"""

import asyncio
import base64
from io import BytesIO

from huggingface_hub import InferenceClient

from app.core.config import get_settings
from app.schemas.image_generation import HUGGINGFACE_MODEL


def _sync_generate_image(api_key: str, prompt: str) -> str:
    """Synchronous worker to call Hugging Face Inference Client."""
    client = InferenceClient(api_key=api_key)
    pil_image = client.text_to_image(
        prompt=prompt,
        model=HUGGINGFACE_MODEL,
        negative_prompt="blurry, low quality, distorted anatomy, extra limbs",
        guidance_scale=7.5,
    )
    buf = BytesIO()
    pil_image.save(buf, format="PNG")
    b64_str = base64.b64encode(buf.getvalue()).decode("utf-8")
    return f"data:image/png;base64,{b64_str}"


async def generate_image(prompt: str) -> str:
    """
    Generate an image from *prompt* using Hugging Face (Stable Diffusion XL).

    Args:
        prompt: English image prompt (should be the visual prompt from the headline tool).

    Returns:
        Base64 PNG data URL string.

    Raises:
        RuntimeError: If API key is missing or the API returns an error.
    """
    settings = get_settings()
    api_key = settings.HUGGINGFACE_API_KEY

    if not api_key:
        raise RuntimeError(
            "HUGGINGFACE_API_KEY is not configured in apps/backend-api/.env."
        )

    try:
        return await asyncio.to_thread(_sync_generate_image, api_key, prompt)
    except Exception as exc:
        raise RuntimeError(f"Hugging Face image generation error: {exc}") from exc

