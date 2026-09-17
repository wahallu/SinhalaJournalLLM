"""
Data access for plan upgrade requests.

There is no payment gateway: a request is raised by a user after a bank
transfer and confirmed by an admin, and ONLY that confirmation moves the
user's plan. Nothing in here changes profiles.plan_id — see
api/v1/admin/upgrades.py, which does it as part of an audited review.

See audit_repository's module docstring for why the client is reached as
`base.get_supabase()` rather than imported directly.
"""

from datetime import datetime, timezone
from typing import Any

from app.repositories import base

TABLE = "plan_upgrade_requests"


async def create(data: dict[str, Any]) -> dict[str, Any]:
    return await base.insert_record(TABLE, data)


async def get(request_id: str) -> dict[str, Any] | None:
    return await base.fetch_by_id(TABLE, request_id)


async def pending_for_user(user_id: str) -> dict[str, Any] | None:
    """
    The user's open request, if any.

    A partial unique index guarantees at most one, so the first row is the
    only row — and it is what stops a second "upgrade me" click creating a
    duplicate an admin would have to reconcile by hand.
    """
    client = await base.get_supabase()
    response = await (
        client.table(TABLE).select("*")
        .eq("user_id", user_id).eq("status", "pending").execute()
    )
    rows = response.data or []
    return rows[0] if rows else None


async def list_for_user(user_id: str, limit: int = 20) -> list[dict[str, Any]]:
    client = await base.get_supabase()
    response = await (
        client.table(TABLE).select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True).limit(limit).execute()
    )
    return response.data or []


async def list_all(*, status: str | None = None, limit: int = 100) -> list[dict[str, Any]]:
    """Requests for the admin queue, newest first."""
    client = await base.get_supabase()
    query = client.table(TABLE).select("*")
    if status:
        query = query.eq("status", status)
    response = await query.order("created_at", desc=True).limit(limit).execute()
    return response.data or []


async def update(request_id: str, data: dict[str, Any]) -> dict[str, Any] | None:
    client = await base.get_supabase()
    payload = {**data, "updated_at": datetime.now(timezone.utc).isoformat()}
    response = await client.table(TABLE).update(payload).eq("id", request_id).execute()
    return response.data[0] if response.data else None


async def count_pending() -> int:
    """Badge count for the admin sidebar."""
    client = await base.get_supabase()
    response = await (
        client.table(TABLE).select("id", count="exact", head=True)
        .eq("status", "pending").execute()
    )
    return response.count or 0
