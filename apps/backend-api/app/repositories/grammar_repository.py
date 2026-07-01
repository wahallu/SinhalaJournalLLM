"""
Data access layer for grammar correction records.
All Supabase queries for the grammar feature go here.
"""

from typing import Any
from uuid import UUID

from app.core.database import get_supabase

_TABLE = "grammar_corrections"


async def save_correction(record: dict[str, Any]) -> dict[str, Any]:
    """Insert a new grammar correction record and return it with generated fields."""
    client = await get_supabase()
    response = await client.table(_TABLE).insert(record).execute()
    return response.data[0]


async def get_correction_by_id(correction_id: UUID) -> dict[str, Any] | None:
    """Fetch a single correction by its UUID."""
    client = await get_supabase()
    response = (
        await client.table(_TABLE)
        .select("*")
        .eq("id", str(correction_id))
        .maybe_single()
        .execute()
    )
    return response.data if response is not None else None


async def get_corrections(
    *,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[dict[str, Any]], int]:
    """
    Fetch paginated correction history, ordered by newest first.

    Returns:
        (list_of_records, total_count)
    """
    client = await get_supabase()
    offset = (page - 1) * page_size
    response = (
        await client.table(_TABLE)
        .select("*", count="exact")
        .order("created_at", desc=True)
        .range(offset, offset + page_size - 1)
        .execute()
    )
    return response.data, response.count or 0
