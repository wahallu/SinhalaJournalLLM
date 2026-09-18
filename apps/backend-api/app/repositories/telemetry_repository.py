"""
Request telemetry writes and reads.

Lands in Phase 1 because anonymous rate limiting counts from this table
rather than maintaining a separate counter — one indexed count per
anonymous call, and it stays correct across multiple server instances,
which an in-memory counter would not.

Phase 4 adds the nightly rollup into usage_daily plus retention pruning.
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from app.repositories import base
from app.repositories.base import insert_record

TABLE = "request_telemetry"

logger = logging.getLogger(__name__)


async def record_request(**fields: Any) -> None:
    """
    Fire-and-forget telemetry write. Never raises: losing a telemetry row
    must not fail a user's request.
    """
    try:
        await insert_record(TABLE, fields)
    except Exception:
        logger.exception("Telemetry write failed — continuing")


async def count_recent_by_ip(ip_hash: str, within_seconds: int) -> int:
    """How many requests this IP hash made in the trailing window."""
    since = (datetime.now(timezone.utc) - timedelta(seconds=within_seconds)).isoformat()
    # Resolved via the `base` module attribute (not a direct `from
    # app.core.database import get_supabase`) so the test suite's
    # fake_supabase fixture — which patches app.repositories.base.get_supabase
    # — covers this read path too. A direct import would bind its own name
    # at import time and silently keep hitting the real network under test.
    client = await base.get_supabase()
    response = await (
        client.table(TABLE)
        .select("id", count="exact", head=True)
        .eq("ip_hash", ip_hash)
        .gte("created_at", since)
        .execute()
    )
    return response.count or 0


async def count_recent_by_user(user_id: str, since_iso: str) -> int:
    """
    How many requests this user made at or after `since_iso`.

    Counterpart to count_recent_by_ip, used for per-plan daily quotas. Takes
    an absolute timestamp rather than a trailing window because the quota
    resets at UTC midnight, not N seconds ago.

    Resolved via the `base` module attribute for the same reason as the
    function above — see its comment.
    """
    client = await base.get_supabase()
    response = await (
        client.table(TABLE)
        .select("id", count="exact", head=True)
        .eq("user_id", user_id)
        .gte("created_at", since_iso)
        .execute()
    )
    return response.count or 0
