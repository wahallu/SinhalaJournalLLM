"""
Image Generation API endpoint.

POST /image/generate — Generate an image from a visual prompt with GPT Image 2.
Returns a base64 PNG data URL while keeping OPENAI_API_KEY on the server.
"""

from fastapi import APIRouter, Depends, HTTPException

from app.schemas.image_generation import ImageGenerationRequest, ImageGenerationResponse
from app.schemas.image_generation import DEFAULT_IMAGE_MODEL
from app.core.deps import require_admin
from app.schemas.auth import AuthUser
from app.services.image_generation_service import generate_image
from app.services.cloudinary_service import is_configured, upload_history_image
from app.repositories.headline_repository import get_generation, update_generation_assets

router = APIRouter(prefix="/image", tags=["Image Generation"])


@router.post("/generate", response_model=ImageGenerationResponse)
async def generate_image_endpoint(
    payload: ImageGenerationRequest,
    admin: AuthUser = Depends(require_admin),
):
    """
    Generate a photorealistic image from an English text prompt via OpenAI.

    Designed to consume the visual prompt produced by the headline generator.
    Admin-only because every request bills the project's OpenAI account.
    Proxies the request to OpenAI so the API token never leaves the backend.
    """
    store_in_history = bool(payload.history_id and is_configured())
    if store_in_history:
        owned_generation = await get_generation(payload.history_id, user_id=admin.id)
        if owned_generation is None:
            raise HTTPException(status_code=404, detail="Headline history entry not found.")

    try:
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
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error during image generation: {exc}",
        ) from exc

    return ImageGenerationResponse(
        image_data=image_data,
        prompt=payload.prompt,
        model=DEFAULT_IMAGE_MODEL,
        stored=stored,
    )
