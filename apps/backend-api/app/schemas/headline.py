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


class HeadlineResponse(BaseModel):
    """Output payload after headline generation."""
    headlines: list[str] = Field(
        ...,
        description="Generated headlines in Sinhala, best candidate first",
    )
    id: str | None = Field(default=None, description="Generation record ID")
    model_used: str | None = Field(
        default=None,
        description="Inference provider that produced this result",
    )
    created_at: datetime | None = Field(default=None)


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
