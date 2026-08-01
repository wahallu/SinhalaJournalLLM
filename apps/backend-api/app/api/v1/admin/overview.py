"""Admin dashboard counts. Every route behind require_admin."""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends

from app.core.deps import require_admin
from app.repositories import admin_repository, base
from app.schemas.admin import OverviewResponse
from app.schemas.auth import AuthUser

router = APIRouter(prefix="/admin/overview", tags=["Admin"])

TELEMETRY = "request_telemetry"


async def _telemetry_since(hours: int) -> list[dict]:
    """Telemetry rows from the trailing window."""
    since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
    client = await base.get_supabase()
    response = await client.table(TELEMETRY).select("tool").gte("created_at", since).execute()
    return response.data or []


@router.get("", response_model=OverviewResponse)
async def overview(_admin: AuthUser = Depends(require_admin)) -> OverviewResponse:
    """Headline counts for the admin landing page."""
    day = await _telemetry_since(24)
    week = await _telemetry_since(24 * 7)

    by_tool: dict[str, int] = {}
    for row in week:
        tool = row.get("tool") or "unknown"
        by_tool[tool] = by_tool.get(tool, 0) + 1

    return OverviewResponse(
        total_users=await admin_repository.count_profiles(),
        admin_count=await admin_repository.count_profiles(role="admin"),
        suspended_count=await admin_repository.count_profiles(status="suspended"),
        requests_24h=len(day),
        requests_7d=len(week),
        by_tool=by_tool,
    )
