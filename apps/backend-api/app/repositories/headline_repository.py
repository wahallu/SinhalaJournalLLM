"""
Data access layer for headline generation records.
"""

from typing import Any

from app.repositories.base import fetch_by_id, fetch_page, insert_record, update_record

TABLE = "headline_generations"


async def save_generation(record: dict[str, Any]) -> dict[str, Any]:
    """Insert a new headline generation record."""
    return await insert_record(TABLE, record)


async def get_generations(
    *,
    page: int = 1,
    page_size: int = 20,
    user_id: str | None = None,
) -> tuple[list[dict[str, Any]], int]:
    """Paginated generation history, newest first: (records, total)."""
    return await fetch_page(TABLE, page=page, page_size=page_size, user_id=user_id)


async def update_generation_assets(
    generation_id: str,
    changes: dict[str, Any],
    *,
    user_id: str,
) -> dict[str, Any] | None:
    """Persist visual prompt/image fields on a caller-owned generation."""
    return await update_record(TABLE, generation_id, changes, user_id=user_id)


async def get_generation(
    generation_id: str,
    *,
    user_id: str,
) -> dict[str, Any] | None:
    """Return a caller-owned headline generation, if it exists."""
    return await fetch_by_id(TABLE, generation_id, user_id=user_id)
