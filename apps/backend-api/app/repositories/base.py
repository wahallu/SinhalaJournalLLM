"""
Shared Supabase data-access helpers.

Inference results must reach the user even when persistence is down, so
`insert_record` degrades to a synthetic (unsaved) record on failure instead
of raising — with a loud log line. Reads raise normally; a broken history
page is visible, a silently dropped inference result is not.
"""

import asyncio
import logging
import time
import uuid
from collections.abc import Awaitable, Callable
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any

import httpx

from app.core.database import get_supabase

if TYPE_CHECKING:  # avoids a cycle: research imports schemas, not repositories
    from app.core.research import Actor

logger = logging.getLogger(__name__)

# A dead Supabase host costs ~11s in DNS resolution alone on Windows, which
# would be paid on every request. Cap each attempt hard, and once the host
# looks genuinely unreachable skip it entirely for a cooldown (circuit breaker).
WRITE_TIMEOUT_SECONDS = 3.0
# Raised from 5s: on a cold Render dyno talking to a sleeping Supabase project,
# the first read routinely takes longer than 5s. That is a slow database, not a
# missing one, and timing it out used to be enough to lock every user out — see
# the failure threshold below.
READ_TIMEOUT_SECONDS = 8.0
CIRCUIT_COOLDOWN_SECONDS = 60.0

# The circuit opens only after this many CONSECUTIVE infrastructure failures.
#
# It used to open on the first exception of any kind, which made a single slow
# query a total outage: the breaker is process-wide, and authentication reads
# the `profiles` table through it. One cold-start timeout therefore produced
# exactly the symptoms reported — POST /auth/login returning 503 (login calls
# get_profile) and every authenticated GET returning 401 (deps._resolve treats
# an unreadable profile as unauthenticated) — for a full 60 seconds, for
# everybody. Trying a different account "fixing" it was the cooldown expiring,
# not anything about the account.
CIRCUIT_FAILURE_THRESHOLD = 3

_circuit_open_until: float = 0.0
_consecutive_failures: int = 0


def _circuit_is_open() -> bool:
    return time.monotonic() < _circuit_open_until


def _is_unreachable(exc: BaseException) -> bool:
    """
    True when the database could not be reached at all.

    An APIError means PostgREST answered — the row was missing, RLS refused,
    a constraint failed. The database is up, so that must never open the
    breaker no matter how often it happens; only transport-level faults count.
    """
    return isinstance(exc, (TimeoutError, asyncio.TimeoutError, httpx.TransportError, OSError))


def _record_failure(exc: BaseException) -> None:
    """Count an infrastructure failure, opening the circuit once it persists."""
    global _consecutive_failures
    if not _is_unreachable(exc):
        return
    _consecutive_failures += 1
    if _consecutive_failures >= CIRCUIT_FAILURE_THRESHOLD:
        _circuit_open()


def _record_success() -> None:
    """A completed round trip clears the run of failures."""
    global _consecutive_failures
    _consecutive_failures = 0


def _circuit_open() -> None:
    global _circuit_open_until
    _circuit_open_until = time.monotonic() + CIRCUIT_COOLDOWN_SECONDS
    logger.error(
        "Database unreachable %d times in a row — skipping it for %.0fs",
        _consecutive_failures,
        CIRCUIT_COOLDOWN_SECONDS,
    )


class DatabaseUnavailable(Exception):
    """History storage can't be reached (read path). Mapped to 503 in main."""


async def resolve_client():
    """
    The database client to use for one operation.

    Always the service-role client, and per-user scoping is the explicit
    `user_id` filter every read below applies — the design the self-hosted
    auth migration moved to (migrations/2026-08-02-self-hosted-auth.sql).

    This used to build a PostgREST client from the caller's JWT so Row Level
    Security could decide what they could see. That stopped working the
    moment auth was self-hosted, and it took every user's history down with
    it: the RLS policies keyed off `auth.uid()`, which is populated from a
    SUPABASE-issued JWT, and the migration dropped them precisely because
    our tokens can never satisfy them. RLS is still ENABLED with no policies
    at all, so a non-service-role client now reads exactly zero rows —
    the dashboard's "no activity yet" was RLS denying everything, not an
    empty account.

    It could not even get that far in practice: the token client read
    `settings.SUPABASE_ANON_KEY`, a field that does not exist on Settings
    (the key is PUBLIC_SUPABASE_ANON_KEY), so every call raised
    AttributeError before a request was made. The tests missed it because
    they monkeypatched the client factory out, which replaced the broken
    call with a working fake.

    Restoring the token client is therefore not the fix — it is the bug.
    """
    return await get_supabase()


def _synthetic_record(record: dict[str, Any]) -> dict[str, Any]:
    return {
        **record,
        "id": str(uuid.uuid4()),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


async def persist_if_owned(
    save: Callable[[dict[str, Any]], Awaitable[dict[str, Any]]],
    record: dict[str, Any],
    user_id: str | None,
    actor: "Actor | None" = None,
) -> dict[str, Any]:
    """
    Persist `record` against whoever made the request, or return an unsaved
    response-shaped record when there is nobody to attribute it to.

    Originally this saved for signed-in callers only — "login to save", with
    anonymous runs leaving no row at all. The research study changed that: the
    tool reaches journalism students through a WhatsApp group, so almost every
    run is anonymous, and dropping those rows would discard the entire dataset
    the study exists to collect. An anonymous run is now saved against its
    device id (see core/research.py).

    `user_id IS NULL AND anon_id IS NULL` therefore still means "pre-auth
    legacy data" and nothing else, which keeps the older rows interpretable.

    The returned shape is identical in every case — clients cannot tell
    whether a row was written.
    """
    if actor is not None and actor.is_known:
        return await save({**record, **actor.stamp()})
    if user_id is None:
        return _synthetic_record(record)
    return await save({**record, "user_id": user_id})


async def insert_record(table: str, record: dict[str, Any]) -> dict[str, Any]:
    """
    Insert and return the row with generated fields (id, created_at).
    Falls back to a synthetic record if Supabase is unreachable.
    """
    if _circuit_is_open():
        return _synthetic_record(record)
    try:
        client = await get_supabase()
        response = await asyncio.wait_for(
            client.table(table).insert(record).execute(),
            timeout=WRITE_TIMEOUT_SECONDS,
        )
        return response.data[0]
    except Exception as exc:
        _record_failure(exc)
        logger.exception(
            "Failed to persist record to %s — returning unsaved record and "
            "skipping persistence for %.0fs",
            table,
            CIRCUIT_COOLDOWN_SECONDS,
        )
        return _synthetic_record(record)


async def fetch_by_id(
    table: str,
    record_id: str,
    *,
    user_id: str | None = None,
) -> dict[str, Any] | None:
    """
    Fetch a single row by UUID, scoped to `user_id` when given.

    Omitting `user_id` returns the row whoever owns it. That is correct for
    admin paths and wrong for anything user-facing: this runs as service
    role, so the filter is the only thing isolating one account from
    another.
    """
    if _circuit_is_open():
        raise DatabaseUnavailable(f"History storage unavailable (cooldown): {table}")
    try:
        client = await resolve_client()
        query = client.table(table).select("*").eq("id", record_id)
        if user_id is not None:
            query = query.eq("user_id", user_id)
        response = await asyncio.wait_for(
            query.maybe_single().execute(),
            timeout=READ_TIMEOUT_SECONDS,
        )
    except Exception as exc:
        _record_failure(exc)
        raise DatabaseUnavailable(f"Failed to read {table}: {exc}") from exc
    _record_success()
    return response.data if response is not None else None


async def update_record(
    table: str,
    record_id: str,
    changes: dict[str, Any],
    *,
    user_id: str | None = None,
) -> dict[str, Any] | None:
    """Update one row, optionally scoped to its owner, and return it.

    User-facing callers must always pass ``user_id``. The service-role client
    bypasses RLS, so this explicit filter is the account boundary.
    """
    if _circuit_is_open():
        raise DatabaseUnavailable(f"History storage unavailable (cooldown): {table}")
    try:
        client = await resolve_client()
        query = client.table(table).update(changes).eq("id", record_id)
        if user_id is not None:
            query = query.eq("user_id", user_id)
        response = await asyncio.wait_for(
            query.execute(), timeout=WRITE_TIMEOUT_SECONDS
        )
    except Exception as exc:
        _record_failure(exc)
        raise DatabaseUnavailable(f"Failed to update {table}: {exc}") from exc
    _record_success()
    rows = response.data or []
    return rows[0] if rows else None


async def fetch_page(
    table: str,
    *,
    page: int = 1,
    page_size: int = 20,
    user_id: str | None = None,
) -> tuple[list[dict[str, Any]], int]:
    """
    Newest-first page plus exact total, scoped to `user_id` when given.

    Omitting `user_id` pages over every user's rows — see fetch_by_id.
    """
    if _circuit_is_open():
        raise DatabaseUnavailable(f"History storage unavailable (cooldown): {table}")
    try:
        client = await resolve_client()
        offset = (page - 1) * page_size
        query = client.table(table).select("*", count="exact")
        if user_id is not None:
            query = query.eq("user_id", user_id)
        response = await asyncio.wait_for(
            query.order("created_at", desc=True)
                 .range(offset, offset + page_size - 1)
                 .execute(),
            timeout=READ_TIMEOUT_SECONDS,
        )
    except Exception as exc:
        _record_failure(exc)
        raise DatabaseUnavailable(f"Failed to read {table}: {exc}") from exc
    _record_success()
    return response.data, response.count or 0


async def count_rows(
    table: str,
    *,
    user_id: str | None = None,
    since: str | None = None,
) -> int:
    """
    Exact row count, scoped to `user_id` and optionally to rows created at or
    after `since` (an ISO timestamp).

    Omitting `user_id` counts every user's rows — see fetch_by_id.

    Counting server-side rather than measuring a fetched page: the dashboard
    used to derive "Total runs" from `len(history)` over a 50-row request, so
    every number it showed silently saturated at 50. `head=True` asks PostgREST
    for the count without transferring any rows.
    """
    if _circuit_is_open():
        raise DatabaseUnavailable(f"History storage unavailable (cooldown): {table}")
    try:
        client = await resolve_client()
        query = client.table(table).select("id", count="exact", head=True)
        if user_id is not None:
            query = query.eq("user_id", user_id)
        if since is not None:
            query = query.gte("created_at", since)
        response = await asyncio.wait_for(
            query.execute(), timeout=READ_TIMEOUT_SECONDS
        )
    except Exception as exc:
        _record_failure(exc)
        raise DatabaseUnavailable(f"Failed to count {table}: {exc}") from exc
    _record_success()
    return response.count or 0


async def fetch_recent(
    table: str,
    limit: int,
    *,
    user_id: str | None = None,
) -> list[dict[str, Any]]:
    """
    Newest `limit` rows without a count query, scoped when given.

    Omitting `user_id` returns every user's rows — see fetch_by_id.
    """
    if _circuit_is_open():
        raise DatabaseUnavailable(f"History storage unavailable (cooldown): {table}")
    try:
        client = await resolve_client()
        query = client.table(table).select("*")
        if user_id is not None:
            query = query.eq("user_id", user_id)
        response = await asyncio.wait_for(
            query.order("created_at", desc=True).limit(limit).execute(),
            timeout=READ_TIMEOUT_SECONDS,
        )
    except Exception as exc:
        _record_failure(exc)
        raise DatabaseUnavailable(f"Failed to read {table}: {exc}") from exc
    _record_success()
    return response.data
