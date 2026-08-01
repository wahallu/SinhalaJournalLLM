"""
Data access layer for headline generation records.
"""

from typing import Any

from app.repositories.base import fetch_page, insert_record

TABLE = "headline_generations"


async def save_generation(record: dict[str, Any]) -> dict[str, Any]:
    """Insert a new headline generation record."""
    return await insert_record(TABLE, record)


async def get_generations(
    *,
    page: int = 1,
    page_size: int = 20,
    user_id: str | None = None,
    user_token: str | None = None,
) -> tuple[list[dict[str, Any]], int]:
    """Paginated generation history, newest first: (records, total)."""
    return await fetch_page(TABLE, page=page, page_size=page_size, user_id=user_id, user_token=user_token)
