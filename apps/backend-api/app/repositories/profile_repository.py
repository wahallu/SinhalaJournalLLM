"""
Data access for profiles.

Uses the service-role client: a caller's own profile must be readable
before we know whether they are allowed to read anything, so this lookup
cannot itself be RLS-gated on the caller's session.
"""

from typing import Any

from app.repositories.base import fetch_by_id

TABLE = "profiles"


async def get_profile(user_id: str) -> dict[str, Any] | None:
    """Fetch one profile by auth user id, or None when absent."""
    return await fetch_by_id(TABLE, user_id)
