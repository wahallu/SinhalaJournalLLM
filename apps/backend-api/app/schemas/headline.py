"""
Pydantic schemas for the Headline Generator API.
Defines request/response shapes for news headlines.
"""

from datetime import datetime
from pydantic import BaseModel, Field


class HeadlineRequest(BaseModel):
    """Input payload for headline generation."""
    text: str = Field(
        ...,
        min_length=1,
        max_length=10000,
        description="Sinhala article or text context to generate headlines for",
    )
    count: int = Field(
        default=5,
        ge=1,
        le=10,
        description="Number of headlines to generate",
    )
    category: str = Field(
        default="General",
        description="News category for the headline generation (e.g. General, Politics, Business, Sports)",
    )
    length: str | None = Field(
        default=None,
        description=(
            "Target headline length band: short (3-5 words), medium (6-7), "
            "long (8-10). Unknown or omitted values resolve to medium."
        ),
    )


class HeadlineLengthInfo(BaseModel):
    """The word band a generation was held to. Returned so clients can flag
    an out-of-band headline without keeping their own copy of the bounds."""
    id: str = Field(description="short | medium | long")
    min_words: int
    max_words: int


class HeadlineResponse(BaseModel):
    """Output payload after headline generation."""
    headlines: list[str] = Field(
        ...,
        description="Generated headlines in Sinhala, best candidate first",
    )
    id: str | None = Field(default=None, description="Generation record ID")
    length: HeadlineLengthInfo | None = Field(
        default=None,
        description="The resolved length band these headlines were held to",
    )
    model_used: str | None = Field(
        default=None,
        description="Inference provider that produced this result",
    )
    created_at: datetime | None = Field(default=None)
    input_tokens: int | None = Field(
        default=None,
        description="Prompt tokens reported by the provider; null when it reports none",
    )
    output_tokens: int | None = Field(
        default=None,
        description="Generated tokens reported by the provider; null when it reports none",
    )

class HeadlineHistoryItem(BaseModel):
    """One stored headline generation."""
    id: str
    article_text: str
    headlines: list[str]
    count: int
    model_provider: str | None = None
    created_at: datetime | None = None


class HeadlineHistoryResponse(BaseModel):
    """Paginated list of past headline generations."""
    items: list[HeadlineHistoryItem]
    total: int
    page: int
    page_size: int


class VisualPromptRequest(BaseModel):
    """Input for visual prompt generation."""
    article_text: str = Field(
        ...,
        min_length=1,
        max_length=10000,
        description="Sinhala article text the image prompt should be based on",
    )
    headline: str = Field(
        default="",
        max_length=300,
        description="The selected headline (used to sharpen the prompt)",
    )


class VisualPromptResponse(BaseModel):
    """A detailed English image-generation prompt produced from the article."""
    visual_prompt: str = Field(
        ...,
        description="Detailed English prompt ready to feed into an image generation model",
    )
