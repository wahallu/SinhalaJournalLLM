"""
OpenAI image generation service.

Calls the official OpenAI Image API using `gpt-image-2`. The API key is read
only from the backend environment and is never returned to the browser.

Endpoint:
    POST https://api.openai.com/v1/images/generations
    POST https://api.openai.com/v1/images/edits

Auth:
    Authorization: Bearer {OPENAI_API_KEY}
"""

import logging

import httpx

from app.core.config import get_settings
from app.schemas.image_generation import DEFAULT_IMAGE_MODEL

OPENAI_IMAGE_ENDPOINT = "https://api.openai.com/v1/images/generations"
OPENAI_IMAGE_EDIT_ENDPOINT = "https://api.openai.com/v1/images/edits"
REQUEST_TIMEOUT = 180.0
MAX_RETRIES = 3
IMAGE_SIZE = "1536x1024"
IMAGE_QUALITY = "high"

logger = logging.getLogger(__name__)


def _api_error(response: httpx.Response) -> tuple[str, bool]:
    """Return a safe user-facing message and whether the failure is transient."""
    try:
        body = response.json()
    except Exception:
        body = {}

    error = body.get("error") if isinstance(body, dict) else None
    error = error if isinstance(error, dict) else {}
    code = error.get("code")
    upstream_message = error.get("message")

    if code == "moderation_blocked":
        return (
            "This image could not be generated because it did not meet safety requirements. "
            "Try revising the visual prompt.",
            False,
        )
    if response.status_code in (401, 403):
        return (
            "OpenAI image generation is not authorized. Check the backend OPENAI_API_KEY.",
            False,
        )
    if response.status_code == 429:
        return ("OpenAI image generation is temporarily rate limited. Please try again.", True)
    if response.status_code >= 500:
        return ("OpenAI image generation is temporarily unavailable. Please try again.", True)

    message = upstream_message or f"OpenAI rejected the image request ({response.status_code})."
    return (message, False)


async def generate_image(prompt: str) -> str:
    """
    Generate an image from *prompt* using official OpenAI Image Generation API.
    The prompt is preserved (apart from whitespace cleanup) for best instruction
    fidelity. Only transient network, rate-limit, and server failures are retried.

    Args:
        prompt: English image prompt.

    Returns:
        An image URL or base64 data URL string.

    Raises:
        RuntimeError: If API key is missing or the API returns an error on all attempts.
    """
    settings = get_settings()
    api_key = settings.OPENAI_API_KEY

    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured on the backend.")

    sanitized_prompt = _sanitize_prompt(prompt)

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": DEFAULT_IMAGE_MODEL,
        "prompt": sanitized_prompt,
        "n": 1,
        "size": IMAGE_SIZE,
        "quality": IMAGE_QUALITY,
    }

    last_error: RuntimeError | None = None

    for attempt in range(MAX_RETRIES):
        try:
            async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
                response = await client.post(OPENAI_IMAGE_ENDPOINT, headers=headers, json=payload)
        except httpx.HTTPError as exc:
            last_error = RuntimeError("Could not reach OpenAI image generation. Please try again.")
            logger.warning("OpenAI image request failed: %s", exc)
        else:
            request_id = response.headers.get("x-request-id")
            if response.status_code != 200:
                message, retryable = _api_error(response)
                logger.warning(
                    "OpenAI image generation failed status=%s request_id=%s retryable=%s",
                    response.status_code,
                    request_id,
                    retryable,
                )
                if not retryable:
                    raise RuntimeError(message)
                last_error = RuntimeError(message)
            else:
                image_data = _response_image_data(response, request_id)
                if image_data:
                    return image_data
                last_error = RuntimeError("OpenAI returned no generated image data.")
                logger.warning("OpenAI image response had no image request_id=%s", request_id)

        if attempt < MAX_RETRIES - 1:
            await _retry_delay(2 ** attempt)

    raise RuntimeError(
        f"OpenAI image generation failed after {MAX_RETRIES} attempts. {last_error}"
    )


async def edit_image(
    prompt: str,
    image_bytes: bytes,
    image_mime: str,
    image_filename: str,
) -> str:
    """Generate an image using an uploaded image as a visual reference.

    The upload is forwarded to OpenAI directly from memory. No temporary or
    permanent local file is created, which keeps this safe on Render's
    ephemeral filesystem.
    """
    settings = get_settings()
    api_key = settings.OPENAI_API_KEY

    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured on the backend.")

    sanitized_prompt = _sanitize_prompt(prompt)
    headers = {"Authorization": f"Bearer {api_key}"}
    data = {
        "model": DEFAULT_IMAGE_MODEL,
        "prompt": sanitized_prompt,
        "n": "1",
        "size": IMAGE_SIZE,
        "quality": IMAGE_QUALITY,
    }
    # OpenAI's GPT Image edit endpoint uses image[] for one or more reference
    # images. httpx creates the multipart boundary and per-file headers.
    files = {"image[]": (image_filename, image_bytes, image_mime)}
    last_error: RuntimeError | None = None

    for attempt in range(MAX_RETRIES):
        try:
            async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
                response = await client.post(
                    OPENAI_IMAGE_EDIT_ENDPOINT,
                    headers=headers,
                    data=data,
                    files=files,
                )
        except httpx.HTTPError as exc:
            last_error = RuntimeError("Could not reach OpenAI image editing. Please try again.")
            logger.warning("OpenAI image edit request failed: %s", exc)
        else:
            request_id = response.headers.get("x-request-id")
            if response.status_code != 200:
                message, retryable = _api_error(response)
                logger.warning(
                    "OpenAI image edit failed status=%s request_id=%s retryable=%s",
                    response.status_code,
                    request_id,
                    retryable,
                )
                if not retryable:
                    raise RuntimeError(message)
                last_error = RuntimeError(message)
            else:
                image_data = _response_image_data(response, request_id)
                if image_data:
                    return image_data
                last_error = RuntimeError("OpenAI returned no edited image data.")

        if attempt < MAX_RETRIES - 1:
            await _retry_delay(2 ** attempt)

    raise RuntimeError(
        f"OpenAI image editing failed after {MAX_RETRIES} attempts. {last_error}"
    )


def _sanitize_prompt(prompt: str) -> str:
    sanitized = " ".join(prompt.splitlines()).strip()
    if (sanitized.startswith('"') and sanitized.endswith('"')) or \
       (sanitized.startswith("'") and sanitized.endswith("'")):
        sanitized = sanitized[1:-1].strip()
    return sanitized


def _response_image_data(response: httpx.Response, request_id: str | None) -> str | None:
    try:
        data = response.json()
    except Exception as exc:
        logger.warning("OpenAI image response was not JSON request_id=%s: %s", request_id, exc)
        return None

    results = data.get("data", []) if isinstance(data, dict) else []
    first_result = results[0] if results and isinstance(results[0], dict) else {}
    image_data = first_result.get("b64_json") or first_result.get("url")
    if image_data and not image_data.startswith(("http://", "https://", "data:")):
        return f"data:image/png;base64,{image_data}"
    return image_data


async def _retry_delay(seconds: float) -> None:
    """Kept as a seam so retry timing can be skipped in focused tests."""
    import asyncio

    await asyncio.sleep(seconds)
