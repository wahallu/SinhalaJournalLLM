"""
Pydantic schemas for the AI Image Generation API (Pollinations AI).
"""

from pydantic import BaseModel, Field

POLLINATIONS_MODEL = "pollinations-ai"


class ImageGenerationRequest(BaseModel):
    """Input payload for image generation via Pollinations AI."""

    prompt: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="English image-generation prompt",
    )


class ImageGenerationResponse(BaseModel):
    """Response after image generation."""

    image_data: str = Field(
        ...,
        description="Pollinations AI image URL",
    )
    prompt: str = Field(..., description="The prompt that was used")
    model: str = Field(
        default=POLLINATIONS_MODEL,
        description="Image generation provider used",
    )
