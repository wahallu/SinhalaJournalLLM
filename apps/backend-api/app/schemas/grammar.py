"""
Pydantic schemas for the Grammar Checker API.
Defines request/response shapes independently of ORM models.
"""

from datetime import datetime
from pydantic import BaseModel, Field


# ── Request ──

class GrammarCheckRequest(BaseModel):
    """Input payload for grammar checking."""
    text: str = Field(
        ...,
        min_length=1,
        max_length=10000,
        description="Sinhala text to check for grammar errors",
    )


# ── Nested detail ──

class CorrectionDetail(BaseModel):
    """A single correction applied to the text."""
    position: int = Field(description="Character offset in original text")
    original: str = Field(description="Original incorrect fragment")
    corrected: str = Field(description="Corrected fragment")
    rule: str = Field(description="Rule or pattern that triggered the correction")


# ── Response ──

class GrammarCheckResponse(BaseModel):
    """Output payload after grammar checking."""
    id: str = Field(description="Unique correction record ID")
    corrected: str = Field(description="Full corrected text")
    corrections: list[CorrectionDetail] = Field(
        default_factory=list,
        description="List of individual corrections applied",
    )
    correction_count: int = Field(description="Total number of corrections made")
    created_at: datetime | None = Field(
        default=None,
        description="Timestamp of the correction",
    )


class GrammarHistoryResponse(BaseModel):
    """Paginated list of past grammar corrections."""
    items: list[GrammarCheckResponse]
    total: int
    page: int
    page_size: int
