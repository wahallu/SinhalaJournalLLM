"""Admin dashboard counts. Every route behind require_admin."""

import asyncio
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends

from app.core.deps import require_admin
from app.repositories import admin_repository, base
from app.schemas.admin import OverviewResponse
from app.schemas.auth import AuthUser

router = APIRouter(prefix="/admin/overview", tags=["Admin"])

TELEMETRY = "request_telemetry"


async def _telemetry_since(hours: int) -> list[dict]:
    """The `tool` column of every telemetry row in the trailing window."""
    since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
    client = await base.get_supabase()
    response = await client.table(TELEMETRY).select("tool").gte("created_at", since).execute()
    return response.data or []


async def _telemetry_count_since(hours: int) -> int:
    """How many requests landed in the trailing window, counted server-side."""
    since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
    client = await base.get_supabase()
    response = await (
        client.table(TELEMETRY).select("id", count="exact", head=True)
        .gte("created_at", since).execute()
    )
    return response.count or 0


@router.get("", response_model=OverviewResponse)
async def overview(_admin: AuthUser = Depends(require_admin)) -> OverviewResponse:
    """Headline counts for the admin landing page."""
    # Six independent reads, issued together rather than one after another:
    # the page used to pay their round trips in series. The 24h figure is a
    # server-side count — it was the length of a downloaded row list.
    week, requests_24h, total_users, admin_count, suspended_count = await asyncio.gather(
        _telemetry_since(24 * 7),
        _telemetry_count_since(24),
        admin_repository.count_profiles(),
        admin_repository.count_profiles(role="admin"),
        admin_repository.count_profiles(status="suspended"),
    )

    by_tool: dict[str, int] = {}
    for row in week:
        tool = row.get("tool") or "unknown"
        by_tool[tool] = by_tool.get(tool, 0) + 1

    return OverviewResponse(
        total_users=total_users,
        admin_count=admin_count,
        suspended_count=suspended_count,
        requests_24h=requests_24h,
        requests_7d=len(week),
        by_tool=by_tool,
    )
