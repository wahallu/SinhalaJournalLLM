"""
Data access for user_categories.

Writes are admin-only and go through the service-role client. The read used
by the user-facing picker filters to active categories only — a user should
not be offered a category an admin has retired.

See audit_repository's module docstring for why the client is reached as
`base.get_supabase()` rather than imported directly.
"""

from typing import Any

from app.repositories import base

TABLE = "user_categories"


async def get(category_id: str) -> dict[str, Any] | None:
    """One category by id, or None when absent."""
    return await base.fetch_by_id(TABLE, category_id)


async def list_all(*, active_only: bool = False) -> list[dict[str, Any]]:
    """All categories in display order."""
    client = await base.get_supabase()
    query = client.table(TABLE).select("*")
    if active_only:
        query = query.eq("is_active", True)
    response = await query.order("sort_order", desc=False).execute()
    return response.data


async def create(data: dict[str, Any]) -> dict[str, Any]:
    """Insert a category and return it with its generated id."""
    return await base.insert_record(TABLE, data)


async def update(category_id: str, data: dict[str, Any]) -> dict[str, Any] | None:
    """Apply changes and return the updated row, or None when absent."""
    client = await base.get_supabase()
    response = await client.table(TABLE).update(data).eq("id", category_id).execute()
    return response.data[0] if response.data else None


async def delete(category_id: str) -> bool:
    """
    Remove a category.

    `profiles.category_id` is ON DELETE SET NULL, so users in this category
    become uncategorized rather than being deleted with it.
    """
    client = await base.get_supabase()
    response = await client.table(TABLE).delete().eq("id", category_id).execute()
    return bool(response.data)
