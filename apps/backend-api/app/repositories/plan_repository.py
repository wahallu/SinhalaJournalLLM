"""
Data access for the plan catalog.

Writes are admin-only and go through the service-role client. The read used
by the public catalog filters to visible, unarchived plans — a user must not
be offered a tier an admin has hidden or retired.

See audit_repository's module docstring for why the client is reached as
`base.get_supabase()` rather than imported directly.
"""

from datetime import datetime, timezone
from typing import Any

from app.repositories import base

TABLE = "plans"


async def list_all(
    *,
    visible_only: bool = False,
    include_archived: bool = False,
) -> list[dict[str, Any]]:
    """Plans in display order."""
    client = await base.get_supabase()
    query = client.table(TABLE).select("*")
    if visible_only:
        query = query.eq("is_visible", True)
    if not include_archived:
        query = query.is_("archived_at", "null")
    response = await query.order("sort_order", desc=False).execute()
    return response.data or []


async def get(plan_id: str) -> dict[str, Any] | None:
    """One plan by id, or None when absent."""
    return await base.fetch_by_id(TABLE, plan_id)


async def get_default() -> dict[str, Any] | None:
    """
    The plan a user falls back to.

    A partial unique index guarantees at most one row has is_default, so the
    first result is the only result.
    """
    client = await base.get_supabase()
    response = await client.table(TABLE).select("*").eq("is_default", True).execute()
    rows = response.data or []
    return rows[0] if rows else None


async def get_by_slug(slug: str) -> dict[str, Any] | None:
    client = await base.get_supabase()
    response = await client.table(TABLE).select("*").eq("slug", slug).execute()
    rows = response.data or []
    return rows[0] if rows else None


async def create(data: dict[str, Any]) -> dict[str, Any]:
    """Insert a plan and return it with its generated id."""
    return await base.insert_record(TABLE, data)


async def update(plan_id: str, data: dict[str, Any]) -> dict[str, Any] | None:
    """Apply changes and return the updated row, or None when absent."""
    client = await base.get_supabase()
    payload = {**data, "updated_at": datetime.now(timezone.utc).isoformat()}
    response = await client.table(TABLE).update(payload).eq("id", plan_id).execute()
    return response.data[0] if response.data else None


async def clear_default(except_id: str | None = None) -> None:
    """
    Unset is_default on every other plan.

    The partial unique index makes two defaults impossible, so promoting a
    plan has to demote the incumbent FIRST — relying on the write to fail
    would just surface a constraint violation to the admin.
    """
    client = await base.get_supabase()
    query = client.table(TABLE).update({"is_default": False}).eq("is_default", True)
    if except_id:
        query = query.neq("id", except_id)
    await query.execute()


async def archive(plan_id: str) -> dict[str, Any] | None:
    """
    Soft delete.

    `profiles.plan_id` is ON DELETE SET NULL, so a hard delete would silently
    strip the plan from everyone on it. Archiving keeps those assignments
    readable while removing the tier from the catalog.
    """
    return await update(plan_id, {"archived_at": datetime.now(timezone.utc).isoformat()})


async def count_users_on(plan_id: str) -> int:
    """How many profiles are assigned this plan — shown before archiving."""
    client = await base.get_supabase()
    response = await (
        client.table("profiles").select("id", count="exact", head=True)
        .eq("plan_id", plan_id).execute()
    )
    return response.count or 0
