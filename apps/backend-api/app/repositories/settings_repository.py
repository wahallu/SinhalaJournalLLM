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
    Store one override, atomically.

    A delete-then-insert pair would lose the override permanently if the
    process died between the two round-trips — and since `features.*` default
    to True, a deliberately disabled tool would silently turn back on. Two
    concurrent writes to one key could also collide on the primary key.
    `key` is the PK, so PostgREST can do this in a single statement.
    """
    client = await base.get_supabase()
    await client.table(TABLE).upsert(
        {
            "key": key,
            "value": value,
            "updated_by": actor_id,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        },
        on_conflict="key",
    ).execute()
