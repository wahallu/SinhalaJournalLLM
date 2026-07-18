"""
Pydantic schemas for the Style Rewriter API.
Defines request/response shapes for style rewriting.
"""

from datetime import datetime
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
        description=(
            "Target style: formal | sports | youth | editorial | feature. "
            "Legacy values (journalistic, casual) are mapped automatically."
        ),
    )


class StyleRewriteResponse(BaseModel):
    """Output payload after style rewriting."""
    original: str = Field(description="Original input text")
    rewritten: str = Field(description="Rewritten text in selected style")
    tone: str = Field(description="The tone value the client requested")
    style: str | None = Field(
        default=None,
        description="The trained style the request resolved to",
    )
    id: str | None = Field(default=None, description="Rewrite record ID")
    model_used: str | None = Field(default=None)
    created_at: datetime | None = Field(default=None)


class StyleHistoryItem(BaseModel):
    """One stored style rewrite."""
    id: str
    original_text: str
    rewritten_text: str
    style: str
    model_provider: str | None = None
    created_at: datetime | None = None


class StyleHistoryResponse(BaseModel):
    """Paginated list of past rewrites."""
    items: list[StyleHistoryItem]
    total: int
    page: int
    page_size: int
