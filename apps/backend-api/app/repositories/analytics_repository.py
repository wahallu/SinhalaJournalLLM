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

from app.core.cache import TTLCache
from app.repositories import base

ROLLUP = "usage_daily"
RAW = "request_telemetry"

# Only the columns the aggregations below read. request_telemetry rows carry
# far more than this, and a 365-day raw scan was transferring all of it.
_ROLLUP_COLUMNS = "day,user_id,tool,provider,request_count,error_count"
_RAW_COLUMNS = "created_at,user_id,tool,provider,status_code"

# The admin analytics page asks for the series, tool, provider and user
# breakdowns of the SAME window — four identical scans per page load before
# this. One cached read serves all four, and a dashboard refresh within the
# TTL costs nothing. Admin-only and aggregate, so a minute of staleness is
# invisible.
_rows_cache = TTLCache("analytics_rows", ttl_seconds=60.0, maxsize=16)

# A range wider than this would scan an unbounded amount of raw telemetry on
# a fresh install where the rollup is still empty.
MAX_DAYS = 365


def _clamp(days: int) -> int:
    return max(1, min(days, MAX_DAYS))


def _day_range(days: int) -> list[date]:
    today = datetime.now(timezone.utc).date()
    return [today - timedelta(days=offset) for offset in range(days - 1, -1, -1)]


async def _rollup_rows(days: int, *, user_id: str | None = None) -> list[dict[str, Any]]:
    since = (datetime.now(timezone.utc).date() - timedelta(days=days - 1)).isoformat()
    client = await base.get_supabase()
    query = client.table(ROLLUP).select(_ROLLUP_COLUMNS).gte("day", since)
    if user_id:
        query = query.eq("user_id", user_id)
    response = await query.execute()
    return response.data or []


async def _raw_rows(days: int, *, user_id: str | None = None) -> list[dict[str, Any]]:
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    client = await base.get_supabase()
    query = client.table(RAW).select(_RAW_COLUMNS).gte("created_at", since)
    if user_id:
        query = query.eq("user_id", user_id)
    response = await query.execute()
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

    async def load() -> tuple[list[dict[str, Any]], str]:
        rolled = await _rollup_rows(days)
        if rolled:
            return rolled, "usage_daily"
        return await _raw_rows(days), "request_telemetry"

    return await _rows_cache.get_or_load(days, load)


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

async def user_daily_series(user_id: str, days: int = 90) -> list[dict[str, Any]]:
    """
    Per-day request counts for one account, most recent `days` days
    including today. Powers the Usage tab's heatmap.

    Same rollup-with-raw-fallback shape as usage_series (see its docstring),
    scoped to one user by filtering on user_id rather than reading every
    account's traffic.

    Today is always read live from request_telemetry, regardless of which
    source supplied the rest of the window. The nightly rollup writes a day
    only once it has fully elapsed, so usage_daily never has a row for the
    day still in progress — reading today from the rollup would show it as
    empty seconds after a request actually landed.
    """
    days = _clamp(days)
    today_key = datetime.now(timezone.utc).date().isoformat()

    rolled = await _rollup_rows(days, user_id=user_id)
    if rolled:
        rows, source = rolled, "usage_daily"
    else:
        rows, source = await _raw_rows(days, user_id=user_id), "request_telemetry"

    requests: dict[str, int] = defaultdict(int)
    for row in rows:
        requests[_day_of(row)] += _weight(row)

    if source == "usage_daily":
        todays_rows = await _raw_rows(1, user_id=user_id)
        requests[today_key] = sum(_weight(row) for row in todays_rows)

    return [
        {"day": day.isoformat(), "requests": requests.get(day.isoformat(), 0)}
        for day in _day_range(days)
    ]
