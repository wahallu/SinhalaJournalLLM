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

    `role` and `status` are guarded by the `guard_profile_privileges`
    database trigger, which rejects changes from any caller that is not the
    service role. This function is therefore the only path that can change
    them — and it is reachable only from endpoints behind `require_admin`.
    """
    client = await base.get_supabase()
    response = await client.table(TABLE).update(changes).eq("id", user_id).execute()
    return response.data[0] if response.data else None
