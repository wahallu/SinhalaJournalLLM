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

router = APIRouter(prefix="/image", tags=["Image Generation"])


@router.post("/generate", response_model=ImageGenerationResponse)
async def generate_image_endpoint(
    payload: ImageGenerationRequest,
    _admin: AuthUser = Depends(require_admin),
):
    """
    Generate a photorealistic image from an English text prompt via OpenAI.

    Designed to consume the visual prompt produced by the headline generator.
    Admin-only because every request bills the project's OpenAI account.
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

    return ImageGenerationResponse(
        image_data=image_data,
        prompt=payload.prompt,
        model=DEFAULT_IMAGE_MODEL,
    )
