"""
Data access for app_settings.

Admin-only, via the service-role client. See audit_repository's module
docstring for why the client is reached as `base.get_supabase()` rather than
imported directly.
"""

from datetime import datetime, timezone
from typing import Any

from app.repositories import base

TABLE = "app_settings"


async def load_all() -> dict[str, Any]:
    """Every stored override, as {key: value}. Unset keys are simply absent."""
    client = await base.get_supabase()
    response = await client.table(TABLE).select("*").execute()
    return {row["key"]: row["value"] for row in (response.data or [])}


async def upsert(key: str, value: Any, actor_id: str | None = None) -> None:
    """
    Store one override.

    Written as delete-then-insert rather than a true upsert because the
    PostgREST fake used in tests models only the basic verbs, and the
    behaviour is identical for a single-row primary key.
    """
    client = await base.get_supabase()
    await client.table(TABLE).delete().eq("key", key).execute()
    await client.table(TABLE).insert(
        {
            "key": key,
            "value": value,
            "updated_by": actor_id,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    ).execute()
