"""
Pydantic schemas for the AI Image Generation API (Cloudflare Workers AI).
Upgraded to flux-2-dev for hyper-accurate, high-fidelity image generation.
"""

from pydantic import BaseModel, Field

CF_MODEL = "@cf/black-forest-labs/flux-2-dev"


class ImageGenerationRequest(BaseModel):
    """Input payload for image generation (flux-2-dev)."""
    prompt: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="English image-generation prompt (the visual prompt from the headline tool)",
    )
    steps: int = Field(
        default=24,
        ge=1,
        le=50,
        description=(
            "Number of diffusion steps (1–50). "
            "flux-2-dev requires more iterations for high prompt-adherence; "
            "24 is the recommended default."
        ),
    )
    width: int = Field(
        default=1024,
        ge=256,
        le=2048,
        description="Output image width in pixels (multiples of 64 recommended)",
    )
    height: int = Field(
        default=1024,
        ge=256,
        le=2048,
        description="Output image height in pixels (multiples of 64 recommended)",
    )


class ImageGenerationResponse(BaseModel):
    """Response after image generation."""
    image_data: str = Field(
        ...,
        description="Base64-encoded PNG image as a data URL (data:image/png;base64,...)",
    )
    prompt: str = Field(..., description="The prompt that was used")
    model: str = Field(
        default=CF_MODEL,
        description="Cloudflare Workers AI model used for generation",
    )
