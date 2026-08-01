"""
Cross-user reads for the admin dashboard.

Uses the service-role client deliberately: these queries must see every
user's rows, which is exactly what Row Level Security forbids for a normal
caller. That makes `require_admin` on every consumer of this module
load-bearing — there is no second line of defence behind it.

See audit_repository's module docstring for why the client is reached as
`base.get_supabase()` rather than imported directly.
"""

from typing import Any

from app.repositories import base

PROFILES = "profiles"

# PostgREST's or() takes a comma-separated expression list, and parentheses
# and stars are its grouping and wildcard syntax. Stripping them stops a
# crafted search string from breaking out of the filter it is embedded in.
_OR_UNSAFE = ",()*"


def _sanitize_search(term: str) -> str:
    return "".join(c for c in term if c not in _OR_UNSAFE).strip()


async def list_users(
    *,
    page: int = 1,
    page_size: int = 50,
    search: str | None = None,
    role: str | None = None,
    status: str | None = None,
) -> tuple[list[dict[str, Any]], int]:
    """Paged user list with optional search and filters, newest first."""
    client = await base.get_supabase()
    query = client.table(PROFILES).select("*", count="exact")

    if search:
        safe = _sanitize_search(search)
        if safe:
            query = query.or_(f"email.ilike.*{safe}*,full_name.ilike.*{safe}*")
    if role:
        query = query.eq("role", role)
    if status:
        query = query.eq("status", status)

    offset = (page - 1) * page_size
    response = await (
        query.order("created_at", desc=True).range(offset, offset + page_size - 1).execute()
    )
    return response.data, response.count or 0


async def count_profiles(**filters: Any) -> int:
    """Exact count of profiles matching the given equality filters."""
    client = await base.get_supabase()
    query = client.table(PROFILES).select("id", count="exact")
    for column, value in filters.items():
        query = query.eq(column, value)
    response = await query.execute()
    return response.count or 0
