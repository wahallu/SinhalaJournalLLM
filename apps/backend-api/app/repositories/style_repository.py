"""
Data access layer for style rewrite records.
"""

from typing import Any

from app.repositories.base import fetch_page, insert_record

TABLE = "style_rewrites"


async def save_rewrite(record: dict[str, Any]) -> dict[str, Any]:
    """Insert a new style rewrite record."""
    return await insert_record(TABLE, record)


async def get_rewrites(
    *,
    page: int = 1,
    page_size: int = 20,
    user_id: str | None = None,
) -> tuple[list[dict[str, Any]], int]:
    """Paginated rewrite history, newest first: (records, total)."""
    return await fetch_page(TABLE, page=page, page_size=page_size, user_id=user_id)
