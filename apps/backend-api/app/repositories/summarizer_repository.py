"""
Data access layer for summary records.
"""

from typing import Any

from app.repositories.base import fetch_page, insert_record

TABLE = "summaries"


async def save_summary(record: dict[str, Any]) -> dict[str, Any]:
    """Insert a new summary record."""
    return await insert_record(TABLE, record)


async def get_summaries(
    *,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[dict[str, Any]], int]:
    """Paginated summary history, newest first: (records, total)."""
    return await fetch_page(TABLE, page=page, page_size=page_size)
