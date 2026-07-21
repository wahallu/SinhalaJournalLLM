"""
Cloudflare Workers AI image generation service.

Calls the Workers AI REST API using the `flux-1-schnell` model.
The endpoint returns raw PNG bytes, which we encode as a base64 data URL
so the frontend can render it directly in an <img> tag without a separate
file-serving step.

Endpoint template:
    POST https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/run/{MODEL}

Auth header:
    Authorization: Bearer {API_TOKEN}

References:
    https://developers.cloudflare.com/workers-ai/models/flux-1-schnell/
"""

import base64

import httpx

from app.core.config import get_settings

# Cloudflare Workers AI model for fast, high-quality text-to-image generation.
CF_MODEL = "@cf/black-forest-labs/flux-1-schnell"
REQUEST_TIMEOUT = 120.0  # image generation can take 30–90 s


async def generate_image(prompt: str, steps: int = 8) -> str:
    """
    Generate an image from *prompt* using Cloudflare Workers AI (Flux 1 Schnell).

    Args:
        prompt: English image prompt (should be the visual prompt from the headline tool).
        steps:  Number of diffusion steps (1–20). More steps → higher quality, slower.

    Returns:
        A base64 data URL string: ``data:image/png;base64,<data>``.

    Raises:
        RuntimeError: If credentials are missing, the API returns an error, or
                      the response body is unexpectedly empty.
    """
    settings = get_settings()

    account_id = settings.CLOUDFLARE_ACCOUNT_ID
    api_token = settings.CLOUDFLARE_API_TOKEN

    if not account_id or account_id == "your_account_id_here":
        raise RuntimeError(
            "CLOUDFLARE_ACCOUNT_ID is not set. "
            "Open apps/backend-api/.env, find the Cloudflare section, and paste "
            "your account ID (visible in your Cloudflare dashboard URL)."
        )
    if not api_token:
        raise RuntimeError(
            "CLOUDFLARE_API_TOKEN is not configured in apps/backend-api/.env."
        )

    url = (
        f"https://api.cloudflare.com/client/v4/accounts"
        f"/{account_id}/ai/run/{CF_MODEL}"
    )
    headers = {
        "Authorization": f"Bearer {api_token}",
        "Content-Type": "application/json",
    }
    payload = {
        "prompt": prompt,
        "num_steps": steps,  # CF uses num_steps for flux-1-schnell
    }

    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        response = await client.post(url, headers=headers, json=payload)

    if response.status_code != 200:
        # Try to surface a useful error from the response body
        try:
            error_body = response.json()
            errors = error_body.get("errors", [])
            detail = (
                errors[0].get("message") if errors
                else error_body.get("message", str(error_body))
            )
        except Exception:
            detail = response.text[:400] or f"HTTP {response.status_code}"
        raise RuntimeError(f"Cloudflare AI error ({response.status_code}): {detail}")

    image_bytes = response.content
    if not image_bytes:
        raise RuntimeError("Cloudflare AI returned an empty response body.")

    # Encode to base64 and build a data URL the browser can use directly.
    b64 = base64.b64encode(image_bytes).decode("utf-8")
    return f"data:image/png;base64,{b64}"
