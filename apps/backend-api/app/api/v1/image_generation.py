"""
Image Generation API endpoint.

POST /image/generate  —  Generate an image from a visual prompt via OpenRouter
                         (krea/krea-2-large). Returns a base64 PNG data URL or hosted image URL.
"""

from fastapi import APIRouter, HTTPException

from app.schemas.image_generation import OPENROUTER_MODEL, ImageGenerationRequest, ImageGenerationResponse
from app.services.image_generation_service import generate_image

router = APIRouter(prefix="/image", tags=["Image Generation"])


@router.post("/generate", response_model=ImageGenerationResponse)
async def generate_image_endpoint(payload: ImageGenerationRequest):
    """
    Generate a photorealistic image from an English text prompt.

    Designed to consume the visual prompt produced by the headline generator.
    Proxies the request to OpenRouter so the API token never leaves the backend.
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
        model=OPENROUTER_MODEL,
    )
