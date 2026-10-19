"""Contact details for the portfolio's team member cards."""

import re
from datetime import datetime
from urllib.parse import urlsplit

from pydantic import BaseModel, Field, field_validator

from app.schemas.portfolio_document import normalize_document_link

_PHONE = re.compile(r"^\+?[0-9 ()-]+$")


def normalize_phone(value: str | None) -> str | None:
    """A displayable phone number, or None to hide it."""
    if value is None:
        return None
    phone = " ".join(value.split())
    if not phone:
        return None
    if not _PHONE.match(phone):
        raise ValueError("Use digits, spaces, dashes, brackets and an optional leading +.")
    digits = sum(ch.isdigit() for ch in phone)
    if not 7 <= digits <= 15 or len(phone) > 25:
        raise ValueError("The phone number must have 7 to 15 digits.")
    return phone


def _profile_link(value: str | None, domain: str, label: str) -> str | None:
    link = normalize_document_link(value)
    if link is None:
        return None
    host = (urlsplit(link).hostname or "").lower()
    if host != domain and not host.endswith(f".{domain}"):
        raise ValueError(f"The {label} link must be a {domain} address.")
    if len(link) > 300:
        raise ValueError(f"The {label} link must be at most 300 characters.")
    return link


class TeamContact(BaseModel):
    """Public shape: what the portfolio needs to render a card's links."""

    student_id: str
    phone: str | None = None
    linkedin_url: str | None = None
    github_url: str | None = None


class TeamContactAdmin(TeamContact):
    name: str
    sort_order: int = 0
    updated_at: datetime | None = None


class TeamContactUpdate(BaseModel):
    """Send a value to set it, or "" / null to clear it."""

    phone: str | None = Field(default=None, max_length=40)
    linkedin_url: str | None = None
    github_url: str | None = None

    @field_validator("phone")
    @classmethod
    def _clean_phone(cls, value: str | None) -> str | None:
        return normalize_phone(value)

    @field_validator("linkedin_url")
    @classmethod
    def _clean_linkedin(cls, value: str | None) -> str | None:
        return _profile_link(value, "linkedin.com", "LinkedIn")

    @field_validator("github_url")
    @classmethod
    def _clean_github(cls, value: str | None) -> str | None:
        return _profile_link(value, "github.com", "GitHub")
