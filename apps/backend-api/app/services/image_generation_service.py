"""
OpenAI image generation service.

Calls the official OpenAI Image API. The model is admin-selectable at runtime
(`image.model`, see settings_registry.py); the API key is read only from the
backend environment and is never returned to the browser.

On timing: OpenAI documents image latency as reaching "up to 2 minutes". The
platform in front of this app gives a request 30 seconds to produce its first
byte, so the endpoint streams (see app/api/v1/image_generation.py) and this
module is free to take as long as the model actually needs. What it is *not*
free to do is retry indefinitely -- the platform router hangs up on the client
at its own timeouts while the dyno keeps working, so a retry can bill an image
nobody will ever receive. RETRY_BUDGET_SECONDS is the cap on that.

Endpoint:
    POST https://api.openai.com/v1/images/generations
    POST https://api.openai.com/v1/images/edits

Auth:
    Authorization: Bearer {OPENAI_API_KEY}
"""

import logging
import time
from typing import NamedTuple

import httpx

from app.core.config import get_settings
from app.schemas.image_generation import (
    DEFAULT_IMAGE_MODEL,
    IMAGE_MODELS,
    alternate_image_model,
    resolve_image_model,
)

OPENAI_IMAGE_ENDPOINT = "https://api.openai.com/v1/images/generations"
OPENAI_IMAGE_EDIT_ENDPOINT = "https://api.openai.com/v1/images/edits"
# MUST stay above OpenAI's documented image latency ("up to 2 minutes"). This
# was 24.0, which is the bug that made image generation fail every single time:
# httpx aborted the call with a ReadTimeout after 24s, before any real
# generation could finish, and the retry did the same -- producing exactly the
# reported "failed after 2 attempts. Could not reach OpenAI image generation."
# Nothing was ever wrong with the network or the key.
#
# 24s was presumably chosen to stay inside the platform's 30-second limit. That
# limit is real but it cannot be satisfied this way: no client timeout short
# enough to beat it is long enough to generate an image. It is satisfied
# instead by streaming the response (see app/api/v1/image_generation.py), which
# sends the first byte immediately and leaves this free to wait as long as the
# model actually needs. Lowering it again re-breaks image generation outright.
REQUEST_TIMEOUT = 180.0
MAX_RETRIES = 2

# Ceiling on the whole retry loop, checked before each new attempt. Without it
# MAX_RETRIES * REQUEST_TIMEOUT is six minutes of billable work on a request
# whose client may have hung up long ago -- per Heroku's documentation, "your
# application will not know that the request it is processing has reached a
# time-out, and will continue to work on the request".
RETRY_BUDGET_SECONDS = 240.0

IMAGE_SIZE = "1536x1024"
IMAGE_QUALITY = "high"

logger = logging.getLogger(__name__)


class ApiError(NamedTuple):
    message: str
    retryable: bool
    model_unavailable: bool = False


# Phrases OpenAI uses when the *account* cannot use the requested model, as
# opposed to something being wrong with the request. gpt-image-1 requires the
# organisation to have completed ID verification and gpt-image-2 requires
# access to a newer model, so an account very often has exactly one of the two
# -- which is worth failing over rather than failing.
_MODEL_UNAVAILABLE_CODES = {
    "model_not_found",
    "unsupported_model",
    "organization_must_be_verified",
}
_MODEL_UNAVAILABLE_PHRASES = (
    "must be verified",
    "does not exist",
    "do not have access",
    "does not have access",
)


def _is_model_unavailable(status: int, code: str | None, message: str) -> bool:
    if code in _MODEL_UNAVAILABLE_CODES:
        return True
    if status not in (400, 403, 404):
        return False
    lowered = message.lower()
    return any(phrase in lowered for phrase in _MODEL_UNAVAILABLE_PHRASES)


def _api_error(response: httpx.Response) -> ApiError:
    """A safe user-facing message, whether the failure is transient, and
    whether it means this account simply cannot use this model.

    OpenAI's own `error.message` is now always carried through. It used to be
    read and then dropped on 401/403/429/5xx in favour of a generic sentence,
    which is how the single most common real cause of a 403 here -- "Your
    organization must be verified to use the model gpt-image-1" -- reached
    the admin as "Check the backend OPENAI_API_KEY" and sent them to look at
    a key that was never the problem. The generic sentences are still there,
    but as context in front of the upstream text, never instead of it."""
    try:
        body = response.json()
    except Exception:
        body = {}

    error = body.get("error") if isinstance(body, dict) else None
    error = error if isinstance(error, dict) else {}
    code = error.get("code")
    upstream_message = (error.get("message") or "").strip()

    def combined(prefix: str) -> str:
        return f"{prefix} {upstream_message}".strip() if upstream_message else prefix

    if code == "moderation_blocked":
        return ApiError(
            combined(
                "This image could not be generated because it did not meet "
                "safety requirements. Try revising the visual prompt."
            ),
            False,
        )

    unavailable = _is_model_unavailable(response.status_code, code, upstream_message)

    if response.status_code in (401, 403):
        prefix = (
            "OpenAI rejected this image model for your account."
            if unavailable
            else "OpenAI image generation is not authorized "
                 "(check the backend OPENAI_API_KEY)."
        )
        return ApiError(combined(prefix), False, unavailable)
    if response.status_code == 429:
        return ApiError(
            combined("OpenAI image generation is temporarily rate limited."), True
        )
    if response.status_code >= 500:
        return ApiError(
            combined("OpenAI image generation is temporarily unavailable."), True
        )

    return ApiError(
        upstream_message
        or f"OpenAI rejected the image request ({response.status_code}).",
        False,
        unavailable,
    )


async def generate_image(prompt: str, model: str | None = None) -> str:
    """
    Generate an image from *prompt* using official OpenAI Image Generation API.
    The prompt is preserved (apart from whitespace cleanup) for best instruction
    fidelity. Only transient network, rate-limit, and server failures are retried.

    Args:
        prompt: English image prompt.
        model:  OpenAI image model; falls back to the default when unknown
                or omitted, so a stale admin setting can't take this down.

    Returns:
        An image URL or base64 data URL string.

    Raises:
        RuntimeError: If API key is missing or the API returns an error on all attempts.
    """
    settings = get_settings()
    api_key = settings.OPENAI_API_KEY

    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured on the backend.")

    model = resolve_image_model(model)
    sanitized_prompt = _sanitize_prompt(prompt)

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": model,
        "prompt": sanitized_prompt,
        "n": 1,
        "size": IMAGE_SIZE,
        "quality": IMAGE_QUALITY,
    }

    last_error: RuntimeError | None = None
    deadline = time.monotonic() + RETRY_BUDGET_SECONDS
    attempts = 0
    tried_alternate = False

    for attempt in range(MAX_RETRIES + 1):
        # The +1 slot exists only so a model failover isn't paid for out of the
        # retry budget -- switching models is a different attempt at a
        # different problem. Without this guard it would silently hand every
        # ordinary failure an extra retry as well.
        if attempts >= MAX_RETRIES + (1 if tried_alternate else 0):
            break
        if attempt and time.monotonic() >= deadline:
            logger.warning("OpenAI image retry budget spent after %s attempt(s)", attempt)
            break
        attempts += 1
        try:
            async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
                response = await client.post(OPENAI_IMAGE_ENDPOINT, headers=headers, json=payload)
        except httpx.HTTPError as exc:
            # The exception class is the whole diagnosis and it used to be
            # thrown away: a DNS/TLS failure (ConnectError), a slow model
            # (ReadTimeout) and the router cancelling us mid-flight
            # (RemoteProtocolError) all produced the same opaque "Could not
            # reach OpenAI" and left nothing to act on. Naming it costs
            # nothing and leaks nothing.
            last_error = RuntimeError(
                f"Could not reach OpenAI image generation ({type(exc).__name__})."
            )
            logger.warning(
                "OpenAI image request failed model=%s error=%s: %s",
                model, type(exc).__name__, exc,
            )
        else:
            request_id = response.headers.get("x-request-id")
            if response.status_code != 200:
                failure = _api_error(response)
                logger.warning(
                    "OpenAI image generation failed model=%s status=%s request_id=%s "
                    "retryable=%s model_unavailable=%s: %s",
                    model, response.status_code, request_id,
                    failure.retryable, failure.model_unavailable, failure.message,
                )
                # An account that cannot use this model will never be able to,
                # so retrying it is pointless -- but the other model may work,
                # and failing over is better than handing the user an error
                # they can only fix by finding the admin setting themselves.
                if failure.model_unavailable and not tried_alternate:
                    fallback = alternate_image_model(model)
                    if fallback:
                        logger.warning(
                            "Falling back from unavailable image model %s to %s",
                            model, fallback,
                        )
                        tried_alternate = True
                        model = fallback
                        payload["model"] = model
                        last_error = RuntimeError(failure.message)
                        continue
                if not failure.retryable:
                    raise RuntimeError(failure.message)
                last_error = RuntimeError(failure.message)
            else:
                image_data = _response_image_data(response, request_id)
                if image_data:
                    return image_data
                last_error = RuntimeError("OpenAI returned no generated image data.")
                logger.warning("OpenAI image response had no image request_id=%s", request_id)

        if attempt < MAX_RETRIES - 1:
            await _retry_delay(2 ** attempt)

    raise RuntimeError(
        f"OpenAI image generation failed after {attempts} attempt(s). {last_error}"
    )


async def edit_image(
    prompt: str,
    image_bytes: bytes,
    image_mime: str,
    image_filename: str,
    model: str | None = None,
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

    model = resolve_image_model(model)
    sanitized_prompt = _sanitize_prompt(prompt)
    headers = {"Authorization": f"Bearer {api_key}"}
    data = {
        "model": model,
        "prompt": sanitized_prompt,
        "n": "1",
        "size": IMAGE_SIZE,
        "quality": IMAGE_QUALITY,
    }
    # OpenAI's GPT Image edit endpoint uses image[] for one or more reference
    # images. httpx creates the multipart boundary and per-file headers.
    files = {"image[]": (image_filename, image_bytes, image_mime)}
    last_error: RuntimeError | None = None
    deadline = time.monotonic() + RETRY_BUDGET_SECONDS
    attempts = 0
    tried_alternate = False

    for attempt in range(MAX_RETRIES + 1):
        # The +1 slot exists only so a model failover isn't paid for out of the
        # retry budget -- switching models is a different attempt at a
        # different problem. Without this guard it would silently hand every
        # ordinary failure an extra retry as well.
        if attempts >= MAX_RETRIES + (1 if tried_alternate else 0):
            break
        if attempt and time.monotonic() >= deadline:
            logger.warning("OpenAI image retry budget spent after %s attempt(s)", attempt)
            break
        attempts += 1
        try:
            async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
                response = await client.post(
                    OPENAI_IMAGE_EDIT_ENDPOINT,
                    headers=headers,
                    data=data,
                    files=files,
                )
        except httpx.HTTPError as exc:
            last_error = RuntimeError(
                f"Could not reach OpenAI image editing ({type(exc).__name__})."
            )
            logger.warning(
                "OpenAI image edit request failed model=%s error=%s: %s",
                model, type(exc).__name__, exc,
            )
        else:
            request_id = response.headers.get("x-request-id")
            if response.status_code != 200:
                failure = _api_error(response)
                logger.warning(
                    "OpenAI image edit failed model=%s status=%s request_id=%s "
                    "retryable=%s model_unavailable=%s: %s",
                    model, response.status_code, request_id,
                    failure.retryable, failure.model_unavailable, failure.message,
                )
                if failure.model_unavailable and not tried_alternate:
                    fallback = alternate_image_model(model)
                    if fallback:
                        logger.warning(
                            "Falling back from unavailable image model %s to %s",
                            model, fallback,
                        )
                        tried_alternate = True
                        model = fallback
                        data["model"] = model
                        last_error = RuntimeError(failure.message)
                        continue
                if not failure.retryable:
                    raise RuntimeError(failure.message)
                last_error = RuntimeError(failure.message)
            else:
                image_data = _response_image_data(response, request_id)
                if image_data:
                    return image_data
                last_error = RuntimeError("OpenAI returned no edited image data.")

        if attempt < MAX_RETRIES - 1:
            await _retry_delay(2 ** attempt)

    raise RuntimeError(
        f"OpenAI image editing failed after {attempts} attempt(s). {last_error}"
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


OPENAI_MODEL_ENDPOINT = "https://api.openai.com/v1/models"
# Diagnostics only ever ask OpenAI to describe a model, never to generate one,
# so this is fast and unbillable and can afford a short timeout.
DIAGNOSTIC_TIMEOUT = 10.0


async def diagnostics(selected_model: str) -> dict:
    """Answer, without generating (or billing) anything: is the key present,
    can this backend reach OpenAI at all, and which image models may this
    account actually use?

    This exists because every failure mode this endpoint has had was
    indistinguishable from the outside. A 24-second client timeout, a missing
    key, an unverified organisation and a genuinely unreachable network all
    surfaced to the admin as one sentence -- "Could not reach OpenAI image
    generation" -- and answering which one it was took a code read each time.
    """
    settings = get_settings()
    api_key = settings.OPENAI_API_KEY

    report: dict = {
        "api_key_configured": bool(api_key),
        "selected_model": selected_model,
        # Surfaced because a too-short value here silently breaks generation
        # outright: it must stay above OpenAI's documented "up to 2 minutes".
        "request_timeout_seconds": REQUEST_TIMEOUT,
        "request_timeout_ok": REQUEST_TIMEOUT >= 120.0,
        "reachable": False,
        "models": {},
    }
    if not api_key:
        report["detail"] = "OPENAI_API_KEY is not configured on the backend."
        return report

    headers = {"Authorization": f"Bearer {api_key}"}
    try:
        async with httpx.AsyncClient(timeout=DIAGNOSTIC_TIMEOUT) as client:
            for name in IMAGE_MODELS:
                response = await client.get(
                    f"{OPENAI_MODEL_ENDPOINT}/{name}", headers=headers
                )
                report["reachable"] = True
                if response.status_code == 200:
                    report["models"][name] = {"available": True, "detail": "ok"}
                else:
                    failure = _api_error(response)
                    report["models"][name] = {
                        "available": False,
                        "detail": failure.message,
                    }
    except httpx.HTTPError as exc:
        report["detail"] = (
            f"Could not reach {OPENAI_MODEL_ENDPOINT} ({type(exc).__name__}): {exc}"
        )
        logger.warning("OpenAI diagnostics failed: %s: %s", type(exc).__name__, exc)

    return report
