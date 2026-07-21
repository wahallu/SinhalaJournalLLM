"""
Image Generation API endpoint.

POST /image/generate  — Generate an image from the visual prompt using Pixazo Flux 2 Max
"""

from fastapi import APIRouter, HTTPException

from app.schemas.image_generation import ImageGenerationRequest, ImageGenerationResponse
from app.services.image_generation_service import generate_image

router = APIRouter(prefix="/image", tags=["Image Generation"])


@router.post("/generate", response_model=ImageGenerationResponse)
async def generate_image_endpoint(payload: ImageGenerationRequest):
    """
    Generate a photorealistic image from an English text prompt.

    Designed to be used with the visual prompt produced by the headline generator.
    Calls the Pixazo Flux 2 Max model via the Pixazo API gateway.
    """
    try:
        image_url = await generate_image(
            prompt=payload.prompt,
            width=payload.width,
            height=payload.height,
            num_inference_steps=payload.num_inference_steps,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Unexpected error during image generation: {exc}"
        ) from exc

    return ImageGenerationResponse(
        image_url=image_url,
        prompt=payload.prompt,
        model="flux-2-max",
    )
