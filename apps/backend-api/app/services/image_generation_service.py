"""
Cloudflare Workers AI image generation service.

Upgraded to `flux-2-dev` — a high-fidelity, prompt-adherent model that
requires multipart/form-data input instead of JSON.

Endpoint:
    POST https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/run/{MODEL}

Auth:
    Authorization: Bearer {API_TOKEN}

Request format:
    multipart/form-data with fields: prompt, steps, width, height
    (httpx sends this automatically when you use the `files=` parameter)

Response format:
    The REST API wraps the image in a JSON envelope:
        {"result": {"image": "<base64-encoded PNG>"}, "success": true, ...}
    Raw-binary fallback is also handled for forward-compatibility.

References:
    https://developers.cloudflare.com/workers-ai/models/flux-2-dev/
"""

import base64

import httpx

from app.core.config import get_settings

# Upgraded to flux-2-dev for hyper-accurate, high-fidelity image generation.
CF_MODEL = "@cf/black-forest-labs/flux-2-dev"

# flux-2-dev is more compute-intensive; allow up to 3 minutes.
REQUEST_TIMEOUT = 180.0


async def generate_image(
    prompt: str,
    steps: int = 24,
    width: int = 1024,
    height: int = 1024,
) -> str:
    """
    Generate an image from *prompt* using Cloudflare Workers AI (Flux 2 Dev).

    flux-2-dev requires multipart/form-data input (not JSON).  httpx handles
    this automatically via the ``files=`` parameter — each field is sent as a
    form part with no filename, matching ``new FormData()`` behaviour in JS.

    Args:
        prompt: English image prompt (should be the visual prompt from the headline tool).
        steps:  Diffusion steps (1–50). 24 is recommended for flux-2-dev to achieve
                high prompt-adherence while keeping generation time reasonable.
        width:  Output image width in pixels.
        height: Output image height in pixels.

    Returns:
        A base64 data URL string: ``data:image/png;base64,<data>``.

    Raises:
        RuntimeError: If credentials are missing, the API returns an error, or
                      the response body is unexpectedly empty / malformed.
    """
    settings = get_settings()

    account_id = settings.CLOUDFLARE_ACCOUNT_ID
    api_token = settings.CLOUDFLARE_API_TOKEN

    if not account_id or account_id == "your_account_id_here":
        raise RuntimeError(
            "CLOUDFLARE_ACCOUNT_ID is not set. "
            "Open apps/backend-api/.env and paste your Cloudflare account ID "
            "(visible in the dashboard URL: https://dash.cloudflare.com/<ACCOUNT_ID>/)."
        )
    if not api_token:
        raise RuntimeError(
            "CLOUDFLARE_API_TOKEN is not configured in apps/backend-api/.env."
        )

    url = (
        f"https://api.cloudflare.com/client/v4/accounts"
        f"/{account_id}/ai/run/{CF_MODEL}"
    )

    # ── Auth header only — do NOT set Content-Type manually.
    # httpx sets the correct multipart/form-data boundary automatically.
    headers = {"Authorization": f"Bearer {api_token}"}

    # ── Build multipart/form-data payload ────────────────────────────────────
    # Each tuple is (filename, value): passing None as the filename produces a
    # plain form field, equivalent to `form.append('key', value)` in JS.
    #
    # JS equivalent:
    #   const form = new FormData();
    #   form.append('prompt', prompt);
    #   form.append('steps',  steps.toString());
    #   form.append('width',  width.toString());
    #   form.append('height', height.toString());
    form_data = {
        "prompt": (None, str(prompt)),
        "steps":  (None, str(steps)),
        "width":  (None, str(width)),
        "height": (None, str(height)),
    }

    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        response = await client.post(url, headers=headers, files=form_data)

    # ── Error handling ────────────────────────────────────────────────────────
    if response.status_code != 200:
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

    # ── Response parsing ──────────────────────────────────────────────────────
    #
    # The Cloudflare Workers AI REST API wraps image data in a JSON envelope:
    #
    #   {
    #     "result":   { "image": "<base64-encoded PNG>" },
    #     "success":  true,
    #     "errors":   [],
    #     "messages": []
    #   }
    #
    # The "image" value is ALREADY base64-encoded — do NOT re-encode it.
    #
    # Raw-binary fallback handles any future model that streams bytes directly.

    content_type = response.headers.get("content-type", "")

    if "application/json" in content_type or response.content.startswith(b"{"):
        # ── JSON envelope path ────────────────────────────────────────────────
        try:
            data = response.json()
        except Exception as exc:
            raise RuntimeError(
                f"Cloudflare AI returned non-parseable JSON: {response.text[:300]}"
            ) from exc

        if not data.get("success", True) and data.get("errors"):
            errors = data["errors"]
            detail = errors[0].get("message") if errors else str(data)
            raise RuntimeError(f"Cloudflare AI reported failure: {detail}")

        b64 = (
            data.get("result", {}).get("image")   # standard path
            or data.get("image")                   # flat fallback
        )
        if not b64:
            raise RuntimeError(
                "Cloudflare AI JSON response is missing result.image. "
                f"Full response: {str(data)[:300]}"
            )

        # Already valid base64 — build the data URL and return.
        return f"data:image/png;base64,{b64}"

    else:
        # ── Raw binary path ───────────────────────────────────────────────────
        image_bytes = response.content
        if not image_bytes:
            raise RuntimeError("Cloudflare AI returned an empty response body.")
        b64 = base64.b64encode(image_bytes).decode("utf-8")
        return f"data:image/png;base64,{b64}"
