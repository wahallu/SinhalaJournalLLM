"""
Data access for profiles.

Uses the service-role client: a caller's own profile must be readable
before we know whether they are allowed to read anything, so this lookup
cannot itself be RLS-gated on the caller's session.
"""

from typing import Any

from app.repositories import base

TABLE = "profiles"


async def get_profile(user_id: str) -> dict[str, Any] | None:
    """Fetch one profile by auth user id, or None when absent."""
    return await base.fetch_by_id(TABLE, user_id)


async def update_profile(user_id: str, changes: dict[str, Any]) -> dict[str, Any] | None:
    """
    Apply changes to a profile, returning the updated row.

    Admin endpoints may pass privileged fields here. The onboarding endpoint
    also uses this helper, but constructs its own strict allow-list of
    self-service fields rather than accepting arbitrary profile changes.
    """
    client = await base.get_supabase()
    response = await client.table(TABLE).update(changes).eq("id", user_id).execute()
    return response.data[0] if response.data else None


async def set_plan(user_id: str, plan_id: str | None) -> bool:
    """
    Move one account onto a plan. Returns whether a row was actually updated.

    The caller needs that boolean: an approved upgrade whose plan move
    silently did nothing is the one failure mode that leaves a user paying
    for a tier they are not on. None clears the assignment, which resolves
    to the default plan at request time.
    """
    client = await base.get_supabase()
    response = await (
        client.table(TABLE).update({"plan_id": plan_id}).eq("id", user_id).execute()
    )
    return bool(response.data)
