"""Public portfolio document metadata and admin mutation payloads."""

from datetime import date, datetime
from typing import Literal
from urllib.parse import urlsplit

from pydantic import BaseModel, Field, field_validator


DocumentCategory = Literal["document", "presentation", "publication"]

MAX_LINK_LENGTH = 500


def normalize_document_link(value: str | None) -> str | None:
    """Return a clean https URL, or None for "no link yet" (pending).

    The link is shown to every visitor as an <a href>, so anything that is not
    a plain https address (javascript:, data:, http:, relative paths) is
    refused rather than stored.
    """
    if value is None:
        return None
    link = value.strip()
    if not link:
        return None
    if len(link) > MAX_LINK_LENGTH:
        raise ValueError(f"The link must be at most {MAX_LINK_LENGTH} characters.")
    if any(ch.isspace() for ch in link):
        raise ValueError("The link must not contain spaces.")
    parts = urlsplit(link)
    if parts.scheme.lower() != "https" or not parts.netloc:
        raise ValueError("The link must be a full https:// address.")
    return link


def _strip_required(value: str) -> str:
    stripped = value.strip()
    if not stripped:
        raise ValueError("This field cannot be blank.")
    return stripped


class PortfolioDocument(BaseModel):
    id: str
    title: str
    category: DocumentCategory
    document_type: str
    submitted_at: date | None = None
    description: str | None = None
    # Uploaded rows carry all four file fields; a link-only or pending row
    # carries none of them (file_url is None while the item is pending).
    file_name: str | None = None
    file_url: str | None = None
    mime_type: str | None = None
    size_bytes: int | None = None
    is_published: bool = True
    sort_order: int = 0
    created_at: datetime | None = None
    updated_at: datetime | None = None


class PortfolioDocumentLinkCreate(BaseModel):
    """A document that lives elsewhere (Drive, OneDrive, GitHub) and is linked."""

    title: str = Field(min_length=1, max_length=160)
    category: DocumentCategory
    document_type: str = Field(min_length=1, max_length=80)
    submitted_at: date | None = None
    description: str | None = Field(default=None, max_length=500)
    file_url: str | None = None
    is_published: bool = True
    sort_order: int = 0

    @field_validator("title", "document_type")
    @classmethod
    def _clean_text(cls, value: str) -> str:
        return _strip_required(value)

    @field_validator("file_url")
    @classmethod
    def _clean_link(cls, value: str | None) -> str | None:
        return normalize_document_link(value)


class PortfolioDocumentUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    category: DocumentCategory | None = None
    document_type: str | None = Field(default=None, min_length=1, max_length=80)
    submitted_at: date | None = None
    description: str | None = Field(default=None, max_length=500)
    # Set a link, change it, or send "" / null to make the item pending again.
    file_url: str | None = None
    is_published: bool | None = None
    sort_order: int | None = None

    @field_validator("file_url")
    @classmethod
    def _clean_link(cls, value: str | None) -> str | None:
        return normalize_document_link(value)
