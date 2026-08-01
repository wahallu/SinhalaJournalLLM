"""
Image Generation API endpoint.

POST /image/generate  —  Generate an image from a visual prompt via OpenRouter
                         (krea/krea-2-large). Returns a base64 PNG data URL or hosted image URL.
"""

from fastapi import APIRouter, Depends, Request, HTTPException

from app.schemas.image_generation import ImageGenerationRequest, ImageGenerationResponse
from app.core.deps import require_user
from app.schemas.auth import AuthUser
from app.services.image_generation_service import generate_image
from app.core.config import get_settings

router = APIRouter(prefix="/image", tags=["Image Generation"])


@router.post("/generate", response_model=ImageGenerationResponse)
async def generate_image_endpoint(
    payload: ImageGenerationRequest,
    _user: AuthUser = Depends(require_user),
):
    """
    Generate a photorealistic image from an English text prompt via OpenAI.

    Designed to consume the visual prompt produced by the headline generator.
    Proxies the request to OpenAI so the API token never leaves the backend.
    """
    try:
        image_data = await generate_image(prompt=payload.prompt)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error during image generation: {exc}",
        ) from exc

    settings = get_settings()
    return ImageGenerationResponse(
        image_data=image_data,
        prompt=payload.prompt,
        model=settings.IMAGE_MODEL or "gpt-image-1",
    )
