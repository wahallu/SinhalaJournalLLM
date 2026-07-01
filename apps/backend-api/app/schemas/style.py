"""
Pydantic schemas for the Style Rewriter API.
Defines request/response shapes for style rewriting.
"""

from pydantic import BaseModel, Field


class StyleRewriteRequest(BaseModel):
    """Input payload for style rewriting."""
    text: str = Field(
        ...,
        min_length=1,
        max_length=10000,
        description="Sinhala text to rewrite",
    )
    tone: str = Field(
        default="formal",
        description="The desired tone/style for the rewritten text (e.g., formal, journalistic, casual)",
    )


class StyleRewriteResponse(BaseModel):
    """Output payload after style rewriting."""
    original: str = Field(description="Original input text")
    rewritten: str = Field(description="Rewritten text in selected style")
    tone: str = Field(description="The tone/style used")
