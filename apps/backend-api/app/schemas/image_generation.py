"""
Pydantic schemas for the AI Image Generation API (Cloudflare Workers AI).
"""

from pydantic import BaseModel, Field


class ImageGenerationRequest(BaseModel):
    """Input payload for image generation."""
    prompt: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="English image-generation prompt (the visual prompt from the headline tool)",
    )
    steps: int = Field(
        default=8,
        ge=1,
        le=20,
        description="Number of inference steps (1–20; higher = better quality but slower)",
    )


class ImageGenerationResponse(BaseModel):
    """Response after image generation."""
    image_data: str = Field(
        ...,
        description="Base64-encoded PNG image as a data URL (data:image/png;base64,...)",
    )
    prompt: str = Field(..., description="The prompt that was used")
    model: str = Field(
        default="@cf/black-forest-labs/flux-1-schnell",
        description="Cloudflare Workers AI model used for generation",
    )
