"""
Pydantic schemas for the AI Image Generation API (Hugging Face).
"""

from pydantic import BaseModel, Field

HUGGINGFACE_MODEL = "stabilityai/stable-diffusion-xl-base-1.0"


class ImageGenerationRequest(BaseModel):
    """Input payload for image generation via Hugging Face."""
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
        default=HUGGINGFACE_MODEL,
        description="Hugging Face model used for generation",
    )
