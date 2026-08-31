"""
Image Generation API endpoint.

POST /image/generate — Generate or edit an image with the configured OpenAI
image model. Returns a base64 PNG data URL while keeping OPENAI_API_KEY on
the server.

Streamed as NDJSON, one JSON object per line, rather than returned as a
single body. This is not a progress-reporting nicety, it is what makes the
endpoint work at all: OpenAI documents image latency as reaching "up to 2
minutes", and the router in front of this app terminates any request that has
not produced its first byte within 30 seconds. Every image generation slower
than 30s was therefore killed by the platform, which answers with its own
error page carrying none of this app's CORS headers -- the browser could only
report "Failed to fetch" or an opaque 502, and the retry loop in the service
kept billing OpenAI for images nobody could receive ("your application will
not know that the request it is processing has reached a time-out, and will
continue to work on the request" -- Heroku's own documentation).

Streaming inverts that. A "working" line goes out immediately, so the first
byte lands in well under a second, and the 30-second rule is satisfied before
OpenAI has even been called. After the first byte the router allows a rolling
55 seconds between bytes, which the heartbeat below keeps refreshed for as
long as the model takes. The final line carries the image or the error.
"""

import asyncio
import json
import logging
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import ValidationError
from starlette.datastructures import UploadFile

from app.core import runtime_settings
from app.schemas.image_generation import ImageGenerationRequest, ImageGenerationResponse
from app.schemas.image_generation import resolve_image_model
from app.core.deps import require_admin
from app.schemas.auth import AuthUser
from app.services.image_generation_service import edit_image, generate_image
from app.services.cloudinary_service import is_configured, upload_history_image
from app.repositories.headline_repository import get_generation, update_generation_assets

router = APIRouter(prefix="/image", tags=["Image Generation"])

logger = logging.getLogger(__name__)

# Comfortably inside the router's rolling 55-second between-bytes window,
# with room for a heartbeat to be missed without the connection dropping.
HEARTBEAT_SECONDS = 10.0

MAX_REFERENCE_IMAGE_BYTES = 10 * 1024 * 1024
_IMAGE_SIGNATURES = (
    (b"\x89PNG\r\n\x1a\n", "image/png", "png"),
    (b"\xff\xd8\xff", "image/jpeg", "jpg"),
)


def _detected_image_type(data: bytes) -> tuple[str, str] | None:
    for signature, mime, extension in _IMAGE_SIGNATURES:
        if data.startswith(signature):
            return mime, extension
    if len(data) >= 12 and data.startswith(b"RIFF") and data[8:12] == b"WEBP":
        return "image/webp", "webp"
    return None


def _validated_payload(data: object) -> ImageGenerationRequest:
    try:
        return ImageGenerationRequest.model_validate(data)
    except ValidationError as exc:
        message = exc.errors()[0].get("msg", "Invalid image generation request.")
        raise HTTPException(status_code=422, detail=message) from exc


async def _request_parts(
    request: Request,
) -> tuple[ImageGenerationRequest, bytes | None, str | None, str | None]:
    content_type = request.headers.get("content-type", "").lower()

    if content_type.startswith("multipart/form-data"):
        form = await request.form()
        payload = _validated_payload({
            "prompt": form.get("prompt") or "",
            "history_id": form.get("history_id") or None,
        })
        upload = form.get("image")
        if upload is None:
            return payload, None, None, None
        if not isinstance(upload, UploadFile):
            raise HTTPException(status_code=422, detail="The reference image upload is invalid.")

        try:
            image_bytes = await upload.read(MAX_REFERENCE_IMAGE_BYTES + 1)
        finally:
            await upload.close()

        if not image_bytes:
            raise HTTPException(status_code=422, detail="The reference image is empty.")
        if len(image_bytes) > MAX_REFERENCE_IMAGE_BYTES:
            raise HTTPException(status_code=413, detail="Reference image must be 10 MB or smaller.")

        detected = _detected_image_type(image_bytes)
        if detected is None:
            raise HTTPException(
                status_code=415,
                detail="Reference image must be a valid PNG, JPG, JPEG, or WEBP file.",
            )
        mime, extension = detected
        return payload, image_bytes, mime, f"reference.{extension}"

    if content_type.startswith("application/json"):
        try:
            body = await request.json()
        except Exception as exc:
            raise HTTPException(status_code=422, detail="Invalid JSON request body.") from exc
        return _validated_payload(body), None, None, None

    raise HTTPException(
        status_code=415,
        detail="Use application/json or multipart/form-data for image generation.",
    )


def _line(event: dict) -> bytes:
    """One NDJSON line. `ensure_ascii=False` keeps Sinhala payloads compact."""
    return (
        json.dumps(event, ensure_ascii=False, separators=(",", ":")) + "\n"
    ).encode("utf-8")


async def _run_generation(
    payload: ImageGenerationRequest,
    reference_bytes: bytes | None,
    reference_mime: str | None,
    reference_filename: str | None,
    model: str,
    admin_id: str,
    store_in_history: bool,
) -> dict:
    """The actual work, as one awaitable the stream can heartbeat around."""
    if reference_bytes is not None:
        image_data = await edit_image(
            prompt=payload.prompt,
            image_bytes=reference_bytes,
            image_mime=reference_mime,
            image_filename=reference_filename,
            model=model,
        )
    else:
        image_data = await generate_image(prompt=payload.prompt, model=model)

    stored = False
    if store_in_history:
        image_data, public_id = await upload_history_image(image_data, payload.history_id)
        updated = await update_generation_assets(
            payload.history_id,
            {
                "visual_prompt": payload.prompt,
                "image_url": image_data,
                "image_public_id": public_id,
                "image_model": model,
            },
            user_id=admin_id,
        )
        stored = updated is not None

    return ImageGenerationResponse(
        image_data=image_data,
        prompt=payload.prompt,
        model=model,
        stored=stored,
    ).model_dump(mode="json")


@router.post("/generate")
async def generate_image_endpoint(
    request: Request,
    admin: AuthUser = Depends(require_admin),
):
    """
    Generate a photorealistic image from an English text prompt via OpenAI.

    Designed to consume the visual prompt produced by the headline generator.
    Admin-only because every request bills the project's OpenAI account.
    Proxies the request to OpenAI so the API token never leaves the backend.

    Responds with NDJSON: zero or more {"status":"working"} heartbeats, then
    exactly one terminal line -- {"status":"done", ...ImageGenerationResponse}
    or {"status":"error","detail":...}. See the module docstring for why this
    is a stream and not a plain body.
    """
    # Everything that can fail cheaply fails here, as a normal HTTP error with
    # a real status code -- validation, ownership, an unreadable upload. Only
    # the OpenAI call itself is slow enough to need the stream, and once the
    # stream starts the status code is already committed to 200.
    payload, reference_bytes, reference_mime, reference_filename = await _request_parts(request)
    store_in_history = bool(payload.history_id and is_configured())
    if store_in_history:
        owned_generation = await get_generation(payload.history_id, user_id=admin.id)
        if owned_generation is None:
            raise HTTPException(status_code=404, detail="Headline history entry not found.")

    model = resolve_image_model(await runtime_settings.get("image.model"))

    async def stream() -> AsyncIterator[bytes]:
        # Before anything slow: this is the byte the 30-second rule is about.
        yield _line({"status": "working", "model": model})

        task = asyncio.create_task(
            _run_generation(
                payload, reference_bytes, reference_mime, reference_filename,
                model, admin.id, store_in_history,
            )
        )
        try:
            while True:
                done, _ = await asyncio.wait({task}, timeout=HEARTBEAT_SECONDS)
                if done:
                    break
                # Refreshes the router's rolling between-bytes window for as
                # long as OpenAI takes.
                yield _line({"status": "working", "model": model})

            result = task.result()
        except RuntimeError as exc:
            # Same failures the endpoint used to answer with a 502; they can
            # only be reported in-band now, because the 200 is already sent.
            yield _line({"status": "error", "detail": str(exc)})
        except asyncio.CancelledError:
            # The client hung up. Stop billing OpenAI for an image nobody is
            # waiting for, and let the cancellation propagate.
            task.cancel()
            raise
        except Exception:
            logger.exception("Unexpected image generation failure")
            yield _line({
                "status": "error",
                "detail": "Unexpected error during image generation. Please try again.",
            })
        else:
            yield _line({"status": "done", **result})
        finally:
            if not task.done():
                task.cancel()

    return StreamingResponse(
        stream(),
        media_type="application/x-ndjson",
        # Proxies that buffer would defeat the entire point of streaming.
        headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"},
    )
