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
    user_id: str | None = None,
    user_token: str | None = None,
) -> tuple[list[dict[str, Any]], int]:
    """Paginated summary history, newest first: (records, total)."""
    return await fetch_page(TABLE, page=page, page_size=page_size, user_id=user_id, user_token=user_token)
