"""
Pydantic schemas for the AI Image Generation API (OpenRouter).
"""

from pydantic import BaseModel, Field

OPENROUTER_MODEL = "krea/krea-2-large"


class ImageGenerationRequest(BaseModel):
    """Input payload for image generation via OpenRouter."""
    prompt: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="English image-generation prompt (the visual prompt from the headline tool)",
    )


class ImageGenerationResponse(BaseModel):
    """Response after image generation."""
    image_data: str = Field(
        ...,
        description="Image URL or Base64-encoded image data URL",
    )
    prompt: str = Field(..., description="The prompt that was used")
    model: str = Field(
        default=OPENROUTER_MODEL,
        description="OpenRouter model used for generation",
    )
