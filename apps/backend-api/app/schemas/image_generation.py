"""
Pydantic schemas for the AI Image Generation API.
Handles text-to-image requests via the Pixazo gateway.
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
    width: int = Field(default=1024, ge=256, le=2048, description="Image width in pixels")
    height: int = Field(default=1024, ge=256, le=2048, description="Image height in pixels")
    num_inference_steps: int = Field(default=30, ge=1, le=50, description="Inference steps")


class ImageGenerationResponse(BaseModel):
    """Output payload after image generation."""
    image_url: str = Field(..., description="URL of the generated image")
    prompt: str = Field(..., description="The prompt that was used")
    model: str = Field(default="flux-2-max", description="Model used for generation")
