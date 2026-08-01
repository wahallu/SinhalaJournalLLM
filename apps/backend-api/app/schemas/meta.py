"""
Schemas for the /meta capability-discovery endpoint and the unified
/history activity feed.
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class StyleOption(BaseModel):
    """One selectable rewrite style."""
    id: str
    label_en: str
    label_si: str


class LengthOption(BaseModel):
    """One selectable summary length."""
    id: str
    label_en: str
    label_si: str


class MetaResponse(BaseModel):
    """
    Capabilities of this API instance. Clients (web app, extension, docs
    add-on) render their pickers from this so option lists never drift from
    what the model actually supports.
    """
    tasks: list[str]
    styles: list[StyleOption]
    default_style: str
    lengths: list[LengthOption]
    default_length: str
    headline_counts: list[int]
    model: dict[str, Any] = Field(description="Model gateway provider status")
    features: dict[str, bool] = Field(
        default_factory=dict,
        description="Per-tool availability. Clients hide tools that are off "
                    "rather than letting a user click into a 503.",
    )
    defaults: dict[str, Any] = Field(
        default_factory=dict,
        description="Admin-set starting values for users with no saved preference.",
    )


class HistoryItem(BaseModel):
    """One entry in the unified cross-tool activity feed."""
    id: str
    tool: str = Field(description="grammar | headlines | rewriter | summarizer")
    input_preview: str
    output_preview: str
    detail: dict[str, Any] = Field(default_factory=dict)
    model_provider: str | None = None
    created_at: datetime | None = None


class UnifiedHistoryResponse(BaseModel):
    """Newest activity across every tool."""
    items: list[HistoryItem]
