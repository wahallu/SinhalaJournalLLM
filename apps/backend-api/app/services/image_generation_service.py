"""
Pixazo image generation service.

Calls the Pixazo gateway (Flux 2 Max) with the visual prompt produced by the
headline tool. Returns a URL pointing to the generated image.
"""

import httpx

from app.core.config import get_settings

# Pixazo Flux 2 Max text-to-image endpoint
PIXAZO_FLUX_ENDPOINT = "https://gateway.pixazo.ai/flux-2-max/v1/flux-2-max-request"
REQUEST_TIMEOUT = 120.0  # image generation can take time


async def generate_image(
    prompt: str,
    width: int = 1024,
    height: int = 1024,
    num_inference_steps: int = 30,
) -> str:
    """
    Generate an image from a text prompt using the Pixazo Flux 2 Max API.

    Args:
        prompt: English image prompt (should be the visual prompt from the headline tool).
        width:  Output image width in pixels.
        height: Output image height in pixels.
        num_inference_steps: Number of diffusion steps (more = higher quality but slower).

    Returns:
        A URL string for the generated image.

    Raises:
        RuntimeError: If the API key is missing, the API returns an error, or the
                      response doesn't contain an image URL.
    """
    settings = get_settings()

    api_key = settings.PIXAZO_API_KEY
    if not api_key:
        raise RuntimeError(
            "PIXAZO_API_KEY is not configured. "
            "Add it to apps/backend-api/.env to enable image generation."
        )

    headers = {
        "Ocp-Apim-Subscription-Key": api_key,
        "Content-Type": "application/json",
    }

    payload = {
        "prompt": prompt,
        "width": width,
        "height": height,
        "num_inference_steps": num_inference_steps,
    }

    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        response = await client.post(PIXAZO_FLUX_ENDPOINT, headers=headers, json=payload)

    if response.status_code != 200:
        # Try to extract a useful error message from the body
        try:
            error_body = response.json()
            detail = error_body.get("message") or error_body.get("detail") or str(error_body)
        except Exception:
            detail = response.text[:300] or f"HTTP {response.status_code}"
        raise RuntimeError(f"Pixazo API error ({response.status_code}): {detail}")

    data = response.json()

    # The Pixazo Flux endpoint returns the image URL in different possible keys
    image_url = (
        data.get("image_url")
        or data.get("output")
        or data.get("url")
        or (data.get("images", [None])[0] if isinstance(data.get("images"), list) else None)
        or (data.get("data", [{}])[0].get("url") if isinstance(data.get("data"), list) else None)
    )

    if not image_url:
        raise RuntimeError(
            f"Pixazo API returned an unexpected response structure: {str(data)[:300]}"
        )

    return image_url
