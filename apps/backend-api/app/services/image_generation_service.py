"""
Image generation service.

Calls the configured gateway endpoint using the specified model and API key.

Endpoint:
    POST {IMAGE_GATEWAY_URL}/images/generations

Auth:
    Authorization: Bearer {IMAGE_API_KEY}
"""

import httpx

from app.core.config import get_settings

REQUEST_TIMEOUT = 120.0


async def generate_image(prompt: str) -> str:
    """
    Generate an image from *prompt* using the configured image generation endpoint.

    Args:
        prompt: English image prompt (should be the visual prompt from the headline tool).

    Returns:
        An image URL or base64 data URL string.

    Raises:
        RuntimeError: If configurations are missing or the API returns an error.
    """
    settings = get_settings()
    api_key = settings.IMAGE_API_KEY or settings.OPENROUTER_IMAGE_API_KEY
    gateway_url = settings.IMAGE_GATEWAY_URL or "http://62.171.163.6:20128/v1"
    model = settings.IMAGE_MODEL or "ag/gemini-3.1-flash-image"

    if not api_key:
        raise RuntimeError(
            "IMAGE_API_KEY is not configured in apps/backend-api/.env."
        )

    # Standard OpenAI compatible generations endpoint: POST {gateway_url}/images/generations
    endpoint = f"{gateway_url.rstrip('/')}/images/generations"

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "prompt": prompt,
    }

    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        response = await client.post(endpoint, headers=headers, json=payload)

    if response.status_code != 200:
        try:
            error_body = response.json()
            error_msg = error_body.get("error", {}).get("message") or error_body.get("message") or str(error_body)
        except Exception:
            error_msg = response.text[:400] or f"HTTP {response.status_code}"
        raise RuntimeError(f"Image generation service error ({response.status_code}): {error_msg}")

    try:
        data = response.json()
    except Exception as exc:
        raise RuntimeError(
            f"Image generation service returned non-parseable JSON: {response.text[:300]}"
        ) from exc

    results = data.get("data", [])
    if not results:
        raise RuntimeError(
            f"Image generation service response is missing data array. Full response: {str(data)[:300]}"
        )

    first_result = results[0]
    image_url = first_result.get("url") or first_result.get("b64_json")

    if not image_url:
        raise RuntimeError(
            f"Image generation service response contains no image URL or base64 data. Full response: {str(data)[:300]}"
        )

    # If it's pure base64 without prefix, check and prefix it
    if not image_url.startswith("http") and not image_url.startswith("data:"):
        image_url = f"data:image/png;base64,{image_url}"

    return image_url
