"""
Data access for user_categories.

Writes are admin-only and go through the service-role client. The read used
by the user-facing picker filters to active categories only — a user should
not be offered a category an admin has retired.

See audit_repository's module docstring for why the client is reached as
`base.get_supabase()` rather than imported directly.
"""

from typing import Any

from app.core.cache import TTLCache
from app.repositories import base

TABLE = "user_categories"

# Read by the onboarding picker and every profile page; written only by an
# admin. Invalidated on each write below.
_cache = TTLCache("categories", ttl_seconds=60.0, maxsize=4)


async def get(category_id: str) -> dict[str, Any] | None:
    """One category by id, or None when absent."""
    return await base.fetch_by_id(TABLE, category_id)


async def list_all(*, active_only: bool = False) -> list[dict[str, Any]]:
    """All categories in display order."""

    async def load() -> list[dict[str, Any]]:
        client = await base.get_supabase()
        query = client.table(TABLE).select("*")
        if active_only:
            query = query.eq("is_active", True)
        response = await query.order("sort_order", desc=False).execute()
        return response.data

    # A copy, so a caller mutating the list cannot corrupt the cached one.
    return list(await _cache.get_or_load(("list", active_only), load))


async def create(data: dict[str, Any]) -> dict[str, Any]:
    """Insert a category and return it with its generated id."""
    row = await base.insert_record(TABLE, data)
    _cache.invalidate()
    return row


async def update(category_id: str, data: dict[str, Any]) -> dict[str, Any] | None:
    """Apply changes and return the updated row, or None when absent."""
    client = await base.get_supabase()
    response = await client.table(TABLE).update(data).eq("id", category_id).execute()
    _cache.invalidate()
    return response.data[0] if response.data else None


async def delete(category_id: str) -> bool:
    """
    Remove a category.

    `profiles.category_id` is ON DELETE SET NULL, so users in this category
    become uncategorized rather than being deleted with it.
    """
    client = await base.get_supabase()
    response = await client.table(TABLE).delete().eq("id", category_id).execute()
    _cache.invalidate()
    return bool(response.data)
