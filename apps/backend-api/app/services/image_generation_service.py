"""
OpenRouter image generation service.

Calls the OpenRouter dedicated Image API using the `krea/krea-2-large` model.

Endpoint:
    POST https://openrouter.ai/api/v1/images

Auth:
    Authorization: Bearer {OPENROUTER_IMAGE_API_KEY}
"""

import httpx

from app.core.config import get_settings

OPENROUTER_IMAGE_ENDPOINT = "https://openrouter.ai/api/v1/images"
OPENROUTER_MODEL = "krea/krea-2-large"
REQUEST_TIMEOUT = 120.0


async def generate_image(prompt: str) -> str:
    """
    Generate an image from *prompt* using OpenRouter (Krea 2 Large).

    Args:
        prompt: English image prompt (should be the visual prompt from the headline tool).

    Returns:
        An image URL or base64 data URL string.

    Raises:
        RuntimeError: If API key is missing or the API returns an error.
    """
    settings = get_settings()
    api_key = settings.OPENROUTER_IMAGE_API_KEY

    if not api_key:
        raise RuntimeError(
            "OPENROUTER_IMAGE_API_KEY is not configured in apps/backend-api/.env."
        )

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": OPENROUTER_MODEL,
        "prompt": prompt,
    }

    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        response = await client.post(OPENROUTER_IMAGE_ENDPOINT, headers=headers, json=payload)

    if response.status_code != 200:
        try:
            error_body = response.json()
            error_msg = error_body.get("error", {}).get("message") or error_body.get("message") or str(error_body)
        except Exception:
            error_msg = response.text[:400] or f"HTTP {response.status_code}"
        raise RuntimeError(f"OpenRouter AI error ({response.status_code}): {error_msg}")

    try:
        data = response.json()
    except Exception as exc:
        raise RuntimeError(
            f"OpenRouter AI returned non-parseable JSON: {response.text[:300]}"
        ) from exc

    results = data.get("data", [])
    if not results:
        raise RuntimeError(
            f"OpenRouter AI response is missing data array. Full response: {str(data)[:300]}"
        )

    first_result = results[0]
    image_url = first_result.get("url") or first_result.get("b64_json")

    if not image_url:
        raise RuntimeError(
            f"OpenRouter AI response contains no image URL or base64 data. Full response: {str(data)[:300]}"
        )

    # If it's pure base64 without prefix, check and prefix it (though usually OpenRouter/providers return full URLs or full data URLs)
    if not image_url.startswith("http") and not image_url.startswith("data:"):
        image_url = f"data:image/png;base64,{image_url}"

    return image_url
