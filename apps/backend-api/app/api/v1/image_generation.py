"""
Image Generation API endpoint.

POST /image/generate  —  Generate an image from a prompt via Pollinations AI.
                         Returns a Pollinations AI image URL.
"""

from fastapi import APIRouter, HTTPException

from app.schemas.image_generation import (
    POLLINATIONS_MODEL,
    ImageGenerationRequest,
    ImageGenerationResponse,
)
from app.services.image_generation_service import generate_image

router = APIRouter(prefix="/image", tags=["Image Generation"])


@router.post("/generate", response_model=ImageGenerationResponse)
async def generate_image_endpoint(payload: ImageGenerationRequest):
    """
    Generate an image URL from an English text prompt using Pollinations AI.

    No API key or authentication is required.
    """
    try:
        image_data = await generate_image(prompt=payload.prompt)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error during image generation: {exc}",
        ) from exc

    return ImageGenerationResponse(
        image_data=image_data,
        prompt=payload.prompt,
        model=POLLINATIONS_MODEL,
    )
