"""
Pydantic schemas for the Summarizer API.
Defines request/response shapes for text summarization.
"""

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
        description="The desired length of the summary (e.g., short, medium, long)",
    )


class SummarizerResponse(BaseModel):
    """Output payload after text summarization."""
    original: str = Field(description="Original input text")
    summary: str = Field(description="Summarized text")
    length: str = Field(description="The summary length category used")
