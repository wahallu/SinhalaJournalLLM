"""
Pydantic schemas for the Headline Generator API.
Defines request/response shapes for news headlines.
"""

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
        description="Generated headlines in Sinhala",
    )
