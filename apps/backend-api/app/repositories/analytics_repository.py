"""
Aggregated usage for the admin dashboard.

Reads `usage_daily` when the nightly rollup has produced rows for the range,
and falls back to scanning `request_telemetry` otherwise — so the dashboard
is useful immediately after install, before `pg_cron` has ever run. Without
that fallback a fresh deployment would show empty charts for a day and look
broken.

See audit_repository's module docstring for why the client is reached as
`base.get_supabase()` rather than imported directly.
"""

from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Any

from app.repositories import base

ROLLUP = "usage_daily"
RAW = "request_telemetry"

# A range wider than this would scan an unbounded amount of raw telemetry on
# a fresh install where the rollup is still empty.
MAX_DAYS = 365


def _clamp(days: int) -> int:
    return max(1, min(days, MAX_DAYS))


def _day_range(days: int) -> list[date]:
    today = datetime.now(timezone.utc).date()
    return [today - timedelta(days=offset) for offset in range(days - 1, -1, -1)]


async def _rollup_rows(days: int) -> list[dict[str, Any]]:
    since = (datetime.now(timezone.utc).date() - timedelta(days=days - 1)).isoformat()
    client = await base.get_supabase()
    response = await client.table(ROLLUP).select("*").gte("day", since).execute()
    return response.data or []


async def _raw_rows(days: int) -> list[dict[str, Any]]:
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    client = await base.get_supabase()
    response = await client.table(RAW).select("*").gte("created_at", since).execute()
    return response.data or []


def _day_of(row: dict[str, Any]) -> str:
    """The calendar day a row belongs to, whether rolled up or raw."""
    if row.get("day"):
        return str(row["day"])[:10]
    return str(row.get("created_at") or "")[:10]


async def _rows(days: int) -> tuple[list[dict[str, Any]], str]:
    """
    Rows for the range plus which source they came from.

    The source is reported so the API can tell the dashboard whether it is
    looking at rolled-up totals or a live scan.
    """
    rolled = await _rollup_rows(days)
    if rolled:
        return rolled, "usage_daily"
    return await _raw_rows(days), "request_telemetry"


def _weight(row: dict[str, Any]) -> int:
    """One raw row counts once; one rollup row counts its request_count."""
    return int(row.get("request_count") or 1)


def _errors(row: dict[str, Any]) -> int:
    if "error_count" in row:
        return int(row.get("error_count") or 0)
    return 1 if int(row.get("status_code") or 200) >= 400 else 0


async def usage_series(days: int = 30) -> dict[str, Any]:
    """
    Per-day request and error totals across the range.

    Every day in the window is present, including days with no activity — a
    gap must render as zero rather than vanishing and distorting the shape of
    the line.
    """
    days = _clamp(days)
    rows, source = await _rows(days)

    requests: dict[str, int] = defaultdict(int)
    errors: dict[str, int] = defaultdict(int)
    for row in rows:
        day = _day_of(row)
        requests[day] += _weight(row)
        errors[day] += _errors(row)

    series = [
        {
            "day": day.isoformat(),
            "requests": requests.get(day.isoformat(), 0),
            "errors": errors.get(day.isoformat(), 0),
        }
        for day in _day_range(days)
    ]
    return {"series": series, "source": source}


async def tool_breakdown(days: int = 30) -> dict[str, int]:
    """Request counts per tool."""
    rows, _ = await _rows(_clamp(days))
    totals: dict[str, int] = defaultdict(int)
    for row in rows:
        totals[row.get("tool") or "unknown"] += _weight(row)
    return dict(totals)


async def provider_breakdown(days: int = 30) -> dict[str, int]:
    """Request counts per inference provider."""
    rows, _ = await _rows(_clamp(days))
    totals: dict[str, int] = defaultdict(int)
    for row in rows:
        totals[row.get("provider") or "unknown"] += _weight(row)
    return dict(totals)


async def top_users(days: int = 30, limit: int = 10) -> list[dict[str, Any]]:
    """
    Busiest accounts in the range. Anonymous traffic is excluded — it has no
    account to attribute to, and lumping it in would make it look like one
    very heavy user.
    """
    rows, _ = await _rows(_clamp(days))
    totals: dict[str, int] = defaultdict(int)
    for row in rows:
        user_id = row.get("user_id")
        if user_id:
            totals[str(user_id)] += _weight(row)

    ranked = sorted(totals.items(), key=lambda kv: kv[1], reverse=True)[:limit]
    return [{"user_id": user_id, "requests": count} for user_id, count in ranked]
