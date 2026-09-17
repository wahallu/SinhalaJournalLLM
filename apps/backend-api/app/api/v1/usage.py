"""
Personal usage.

Distinct from api/v1/admin/analytics.py, which aggregates across every
account for the admin dashboard. This is the signed-in caller's own
history, scoped by user_id rather than by role — and reachable by any
signed-in user, not only admins.
"""

from fastapi import APIRouter, Depends

from app.core.deps import require_user
from app.core.plan_quota import quota_state
from app.repositories import analytics_repository
from app.schemas.auth import AuthUser
from app.schemas.usage import DailyUsagePoint, UsageSummary

router = APIRouter(prefix="/usage", tags=["Usage"])

# 90 days: a 13-week grid, the range chosen for the Usage tab's heatmap.
# Wider than 30 would need the nightly rollup for most of the window --
# 90 is still well inside it -- and a full year would need horizontal
# scroll on a phone for a number most accounts will not have earned yet.
SERIES_DAYS = 90


@router.get("/me", response_model=UsageSummary)
async def my_usage(user: AuthUser = Depends(require_user)) -> UsageSummary:
    """Today's count against the plan limit, plus a 90-day daily history."""
    today = await quota_state(user)
    raw_series = await analytics_repository.user_daily_series(user.id, SERIES_DAYS)
    series = [DailyUsagePoint(**point) for point in raw_series]

    last_7 = series[-7:]
    week_requests = sum(point.requests for point in last_7)
    active_days = sum(1 for point in last_7 if point.requests > 0)

    return UsageSummary(
        today=today,
        week_requests=week_requests,
        active_days=active_days,
        series=series,
    )
