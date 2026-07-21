"""
Image Generation API endpoint.

POST /image/generate  —  Generate an image from a visual prompt via Cloudflare Workers AI
                         (flux-2-dev — hyper-accurate, high-fidelity model).
                         Returns a base64 PNG data URL.
"""

from fastapi import APIRouter, HTTPException

from app.schemas.image_generation import CF_MODEL, ImageGenerationRequest, ImageGenerationResponse
from app.services.image_generation_service import generate_image

router = APIRouter(prefix="/image", tags=["Image Generation"])


@router.post("/generate", response_model=ImageGenerationResponse)
async def generate_image_endpoint(payload: ImageGenerationRequest):
    """
    Generate a photorealistic image from an English text prompt.

    Designed to consume the visual prompt produced by the headline generator.
    Proxies the request to Cloudflare Workers AI (flux-2-dev) so the API
    token never leaves the backend.

    The request is sent as multipart/form-data as required by flux-2-dev.
    Returns a base64-encoded PNG as a data URL that the browser renders
    directly in an <img> src attribute.
    """
    try:
        image_data = await generate_image(
            prompt=payload.prompt,
            steps=payload.steps,
            width=payload.width,
            height=payload.height,
        )
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
        model=CF_MODEL,
    )
