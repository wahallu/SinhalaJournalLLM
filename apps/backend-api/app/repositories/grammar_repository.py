"""
Data access layer for grammar correction records.
"""

from typing import Any
from uuid import UUID

from app.repositories.base import fetch_by_id, fetch_page, insert_record

TABLE = "grammar_corrections"


async def save_correction(record: dict[str, Any]) -> dict[str, Any]:
    """Insert a new grammar correction record."""
    return await insert_record(TABLE, record)


async def get_correction_by_id(correction_id: UUID) -> dict[str, Any] | None:
    """Fetch a single correction by its UUID."""
    return await fetch_by_id(TABLE, str(correction_id))


async def get_corrections(
    *,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[dict[str, Any]], int]:
    """Paginated correction history, newest first: (records, total)."""
    return await fetch_page(TABLE, page=page, page_size=page_size)
