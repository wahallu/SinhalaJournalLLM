"""Aggregated usage analytics for the admin dashboard. Behind require_admin."""

from typing import Any

from fastapi import APIRouter, Depends, Query

from app.core.deps import require_admin
from app.repositories import analytics_repository
from app.schemas.auth import AuthUser

router = APIRouter(prefix="/admin/analytics", tags=["Admin"])


@router.get("")
async def analytics(
    days: int = Query(30, ge=1, le=365),
    _admin: AuthUser = Depends(require_admin),
) -> dict[str, Any]:
    """
    Usage over the trailing `days`.

    `source` reports whether these numbers came from the nightly rollup or a
    live scan of raw telemetry, so the dashboard can say which it is showing
    rather than leaving an operator guessing why a fresh install looks thin.
    """
    series = await analytics_repository.usage_series(days)
    return {
        "days": days,
        "source": series["source"],
        "series": series["series"],
        "by_tool": await analytics_repository.tool_breakdown(days),
        "by_provider": await analytics_repository.provider_breakdown(days),
        "top_users": await analytics_repository.top_users(days),
    }
