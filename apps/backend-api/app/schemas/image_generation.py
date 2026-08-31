"""Pydantic schemas for the OpenAI image generation endpoint."""

from pydantic import BaseModel, Field

# The image models an admin may select, newest first. Both are real OpenAI
# Image API models: gpt-image-1 (2025) and gpt-image-2 (released 22 Apr 2026).
# Kept here rather than in settings_registry.py so the API schema and the
# admin whitelist can never disagree about what is selectable.
IMAGE_MODELS: tuple[str, ...] = ("gpt-image-2", "gpt-image-1")

DEFAULT_IMAGE_MODEL = IMAGE_MODELS[0]


def resolve_image_model(model: str | None) -> str:
    """Map a stored/admin-supplied model name onto a known one.

    Falls back rather than raising: a stale value left in the settings table
    after this list changes must not take image generation down."""
    model = (model or "").strip()
    return model if model in IMAGE_MODELS else DEFAULT_IMAGE_MODEL


class ImageGenerationRequest(BaseModel):
    """Input payload for image generation."""
    prompt: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="English image-generation prompt (the visual prompt from the headline tool)",
    )
    history_id: str | None = Field(
        default=None,
        description="Headline generation record to attach the permanent image to",
    )


class ImageGenerationResponse(BaseModel):
    """Response after image generation."""
    image_data: str = Field(
        ...,
        description="Image URL or Base64-encoded image data URL",
    )
    prompt: str = Field(..., description="The prompt that was used")
    model: str = Field(
        default=DEFAULT_IMAGE_MODEL,
        description="Model used for generation",
    )
    stored: bool = Field(
        default=False,
        description="Whether the image was uploaded and attached to history",
    )
