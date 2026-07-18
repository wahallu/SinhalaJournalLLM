"""
Pydantic schemas for the Summarizer API.
Defines request/response shapes for text summarization.
"""

from datetime import datetime
from pydantic import BaseModel, Field


class SummarizerRequest(BaseModel):
    """Input payload for text summarization."""
    text: str = Field(
        ...,
        min_length=1,
        max_length=10000,
        description="Sinhala text/article to summarize",
    )
    length: str = Field(
        default="medium",
        description="The desired length of the summary: short | medium | long",
    )


class SummarizerResponse(BaseModel):
    """Output payload after text summarization."""
    original: str = Field(description="Original input text")
    summary: str = Field(description="Summarized text")
    length: str = Field(description="The summary length category used")
    id: str | None = Field(default=None, description="Summary record ID")
    model_used: str | None = Field(default=None)
    created_at: datetime | None = Field(default=None)


class SummaryHistoryItem(BaseModel):
    """One stored summary."""
    id: str
    original_text: str
    summary_text: str
    length: str
    model_provider: str | None = None
    created_at: datetime | None = None


class SummaryHistoryResponse(BaseModel):
    """Paginated list of past summaries."""
    items: list[SummaryHistoryItem]
    total: int
    page: int
    page_size: int
