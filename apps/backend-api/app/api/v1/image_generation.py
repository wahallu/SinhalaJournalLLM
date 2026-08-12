"""
Image Generation API endpoint.

POST /image/generate — Generate or edit an image with GPT Image 2.
Returns a base64 PNG data URL while keeping OPENAI_API_KEY on the server.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import ValidationError
from starlette.datastructures import UploadFile

from app.schemas.image_generation import ImageGenerationRequest, ImageGenerationResponse
from app.schemas.image_generation import DEFAULT_IMAGE_MODEL
from app.core.deps import require_admin
from app.schemas.auth import AuthUser
from app.services.image_generation_service import edit_image, generate_image
from app.services.cloudinary_service import is_configured, upload_history_image
from app.repositories.headline_repository import get_generation, update_generation_assets

router = APIRouter(prefix="/image", tags=["Image Generation"])

logger = logging.getLogger(__name__)

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


@router.post("/generate", response_model=ImageGenerationResponse)
async def generate_image_endpoint(
    request: Request,
    admin: AuthUser = Depends(require_admin),
):
    """
    Generate a photorealistic image from an English text prompt via OpenAI.

    Designed to consume the visual prompt produced by the headline generator.
    Admin-only because every request bills the project's OpenAI account.
    Proxies the request to OpenAI so the API token never leaves the backend.
    """
    payload, reference_bytes, reference_mime, reference_filename = await _request_parts(request)
    store_in_history = bool(payload.history_id and is_configured())
    if store_in_history:
        owned_generation = await get_generation(payload.history_id, user_id=admin.id)
        if owned_generation is None:
            raise HTTPException(status_code=404, detail="Headline history entry not found.")

    try:
        if reference_bytes is not None:
            image_data = await edit_image(
                prompt=payload.prompt,
                image_bytes=reference_bytes,
                image_mime=reference_mime,
                image_filename=reference_filename,
            )
        else:
            image_data = await generate_image(prompt=payload.prompt)
        stored = False
        if store_in_history:
            image_data, public_id = await upload_history_image(image_data, payload.history_id)
            updated = await update_generation_assets(
                payload.history_id,
                {
                    "visual_prompt": payload.prompt,
                    "image_url": image_data,
                    "image_public_id": public_id,
                    "image_model": DEFAULT_IMAGE_MODEL,
                },
                user_id=admin.id,
            )
            stored = updated is not None
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Unexpected image generation failure")
        raise HTTPException(
            status_code=500,
            detail="Unexpected error during image generation. Please try again.",
        ) from exc

    return ImageGenerationResponse(
        image_data=image_data,
        prompt=payload.prompt,
        model=DEFAULT_IMAGE_MODEL,
        stored=stored,
    )
