"""Public portfolio document metadata and admin mutation payloads."""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field


DocumentCategory = Literal["document", "presentation", "publication"]


class PortfolioDocument(BaseModel):
    id: str
    title: str
    category: DocumentCategory
    document_type: str
    submitted_at: date | None = None
    description: str | None = None
    file_name: str
    file_url: str
    mime_type: str
    size_bytes: int
    is_published: bool = True
    sort_order: int = 0
    created_at: datetime | None = None
    updated_at: datetime | None = None


class PortfolioDocumentUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    category: DocumentCategory | None = None
    document_type: str | None = Field(default=None, min_length=1, max_length=80)
    submitted_at: date | None = None
    description: str | None = Field(default=None, max_length=500)
    is_published: bool | None = None
    sort_order: int | None = None
