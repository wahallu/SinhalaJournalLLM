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
from datetime import datetime, timezone
from typing import Any

from app.core.database import get_supabase

logger = logging.getLogger(__name__)

# A dead Supabase host costs ~11s in DNS resolution alone on Windows, which
# would be paid on every request. Cap each attempt hard, and after a failure
# skip persistence entirely for a cooldown window (circuit breaker).
WRITE_TIMEOUT_SECONDS = 3.0
READ_TIMEOUT_SECONDS = 5.0
CIRCUIT_COOLDOWN_SECONDS = 60.0

_circuit_open_until: float = 0.0


def _circuit_is_open() -> bool:
    return time.monotonic() < _circuit_open_until


def _trip_circuit() -> None:
    global _circuit_open_until
    _circuit_open_until = time.monotonic() + CIRCUIT_COOLDOWN_SECONDS


class DatabaseUnavailable(Exception):
    """History storage can't be reached (read path). Mapped to 503 in main."""


def _synthetic_record(record: dict[str, Any]) -> dict[str, Any]:
    return {
        **record,
        "id": str(uuid.uuid4()),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


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
    except Exception:
        _trip_circuit()
        logger.exception(
            "Failed to persist record to %s — returning unsaved record and "
            "skipping persistence for %.0fs",
            table,
            CIRCUIT_COOLDOWN_SECONDS,
        )
        return _synthetic_record(record)


async def fetch_by_id(table: str, record_id: str) -> dict[str, Any] | None:
    """Fetch a single row by UUID, or None when absent."""
    if _circuit_is_open():
        raise DatabaseUnavailable(f"History storage unavailable (cooldown): {table}")
    try:
        client = await get_supabase()
        response = await asyncio.wait_for(
            client.table(table)
            .select("*")
            .eq("id", record_id)
            .maybe_single()
            .execute(),
            timeout=READ_TIMEOUT_SECONDS,
        )
    except Exception as exc:
        _trip_circuit()
        raise DatabaseUnavailable(f"Failed to read {table}: {exc}") from exc
    return response.data if response is not None else None


async def fetch_page(
    table: str,
    *,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[dict[str, Any]], int]:
    """Newest-first page of rows plus the exact total count."""
    if _circuit_is_open():
        raise DatabaseUnavailable(f"History storage unavailable (cooldown): {table}")
    try:
        client = await get_supabase()
        offset = (page - 1) * page_size
        response = await asyncio.wait_for(
            client.table(table)
            .select("*", count="exact")
            .order("created_at", desc=True)
            .range(offset, offset + page_size - 1)
            .execute(),
            timeout=READ_TIMEOUT_SECONDS,
        )
    except Exception as exc:
        _trip_circuit()
        raise DatabaseUnavailable(f"Failed to read {table}: {exc}") from exc
    return response.data, response.count or 0


async def fetch_recent(table: str, limit: int) -> list[dict[str, Any]]:
    """Newest `limit` rows without a count query."""
    if _circuit_is_open():
        raise DatabaseUnavailable(f"History storage unavailable (cooldown): {table}")
    try:
        client = await get_supabase()
        response = await asyncio.wait_for(
            client.table(table)
            .select("*")
            .order("created_at", desc=True)
            .limit(limit)
            .execute(),
            timeout=READ_TIMEOUT_SECONDS,
        )
    except Exception as exc:
        _trip_circuit()
        raise DatabaseUnavailable(f"Failed to read {table}: {exc}") from exc
    return response.data
