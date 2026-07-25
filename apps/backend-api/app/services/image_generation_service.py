"""
OpenAI image generation service.

Calls the official OpenAI Image Generation API using `gpt-image-1` / `dall-e-3`.

Endpoint:
    POST https://api.openai.com/v1/images/generations

Auth:
    Authorization: Bearer {OPENAI_API_KEY}
"""

import asyncio
import re
import httpx

from app.core.config import get_settings

REQUEST_TIMEOUT = 120.0


def _generalize_political_names(prompt: str) -> str:
    """
    Replace specific real political figure names (e.g. 'Prime Minister Sanae Takaichi')
    with generic terms ('a government leader') to comply with AI image model safety policies.
    """
    return re.sub(
        r'(?:[A-Z][a-z]+\s+)?(?:Prime Minister|President|Minister|Governor|Chancellor)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*',
        'a government leader',
        prompt
    )


async def generate_image(prompt: str) -> str:
    """
    Generate an image from *prompt* using official OpenAI Image Generation API.
    Includes prompt sanitization, political figure generalization, and a retry loop.

    Args:
        prompt: English image prompt.

    Returns:
        An image URL or base64 data URL string.

    Raises:
        RuntimeError: If API key is missing or the API returns an error on all attempts.
    """
    settings = get_settings()
    api_key = settings.OPENAI_API_KEY or settings.IMAGE_API_KEY or settings.OPENROUTER_IMAGE_API_KEY
    gateway_url = settings.IMAGE_GATEWAY_URL or "https://api.openai.com/v1"
    model = settings.IMAGE_MODEL or "gpt-image-1"

    if not api_key:
        raise RuntimeError(
            "OPENAI_API_KEY / IMAGE_API_KEY is not configured in apps/backend-api/.env."
        )

    # Standard OpenAI generations endpoint
    endpoint = f"{gateway_url.rstrip('/')}/images/generations"

    # 1. Sanitize the prompt: convert newlines to spaces and strip leading/trailing spaces/quotes
    sanitized_prompt = " ".join(prompt.splitlines()).strip()
    if (sanitized_prompt.startswith('"') and sanitized_prompt.endswith('"')) or \
       (sanitized_prompt.startswith("'") and sanitized_prompt.endswith("'")):
        sanitized_prompt = sanitized_prompt[1:-1].strip()

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    last_error = None
    max_retries = 3

    for attempt in range(max_retries):
        current_prompt = sanitized_prompt
        if attempt > 0:
            current_prompt = _generalize_political_names(sanitized_prompt)
            if current_prompt == sanitized_prompt:
                current_prompt = f"{sanitized_prompt} {' ' * attempt}."

        payload = {
            "model": model,
            "prompt": current_prompt,
            "n": 1,
        }

        try:
            async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
                response = await client.post(endpoint, headers=headers, json=payload)

            if response.status_code != 200:
                try:
                    error_body = response.json()
                    error_msg = error_body.get("error", {}).get("message") or error_body.get("message") or str(error_body)
                except Exception:
                    error_msg = response.text[:400] or f"HTTP {response.status_code}"
                raise RuntimeError(f"OpenAI error ({response.status_code}): {error_msg}")

            try:
                data = response.json()
            except Exception as exc:
                raise RuntimeError(
                    f"OpenAI returned non-parseable JSON: {response.text[:300]}"
                ) from exc

            results = data.get("data", [])
            if not results:
                raise RuntimeError(
                    f"OpenAI response is missing data array. Full response: {str(data)[:300]}"
                )

            first_result = results[0]
            image_url = first_result.get("url") or first_result.get("b64_json")

            if not image_url or image_url == "":
                raise RuntimeError(
                    f"OpenAI response contains no image URL or base64 data. Full response: {str(data)[:300]}"
                )

            # If it's pure base64 without prefix, prefix it
            if not image_url.startswith("http") and not image_url.startswith("data:"):
                image_url = f"data:image/png;base64,{image_url}"

            return image_url

        except Exception as exc:
            last_error = exc
            print(f"OpenAI image generation attempt {attempt + 1} failed: {exc}")
            if attempt < max_retries - 1:
                await asyncio.sleep(1.0)

    raise RuntimeError(
        f"OpenAI image generation failed after {max_retries} attempts. Last error: {last_error}"
    )
