"""
Per-plan daily quota enforcement for signed-in callers.

Counterpart to rate_limit.py, which caps anonymous traffic per IP. The two
stay separate on purpose: an anonymous caller is capped because they are
unattributable and still reach GPU inference, while a signed-in caller is
capped by whatever tier an admin put them on.

Counting comes from request_telemetry rather than a dedicated counter table,
for exactly the reason rate_limit.py gives: the count stays correct across
multiple server instances, which an in-memory counter would not.

Fails open. A telemetry read that errors allows the request through — a
storage blip must not lock out every signed-in user, which is a worse
outcome than briefly not enforcing a cost control.
"""

import logging
from datetime import datetime, time, timedelta, timezone

from fastapi import HTTPException, status

from app.repositories import plan_repository
from app.repositories.telemetry_repository import count_recent_by_user
from app.schemas.auth import AuthUser
from app.schemas.plan import PlanLimits, QuotaState

logger = logging.getLogger(__name__)


def day_start_utc() -> datetime:
    """
    Midnight UTC today — the window the daily quota counts over.

    UTC rather than a local zone so the boundary matches usage_daily.day,
    and so the reset time an admin sees in telemetry is the reset time a
    user actually gets.
    """
    return datetime.combine(
        datetime.now(timezone.utc).date(), time.min, tzinfo=timezone.utc
    )


def next_reset_utc() -> datetime:
    """When the current window rolls over. Reported to the client on a 429."""
    return day_start_utc() + timedelta(days=1)


async def _count_today(user_id: str, since_iso: str) -> int:
    """
    Requests this user has made since `since_iso`.

    A thin wrapper rather than a direct call so tests can replace the count
    without standing up a fake database — the decision logic is what is
    worth testing here, not the PostgREST call shape.
    """
    return await count_recent_by_user(user_id, since_iso)


async def resolve_plan(user: AuthUser) -> tuple[dict | None, PlanLimits]:
    """
    The caller's plan and its parsed limits.

    Order: the user's own plan, then the default plan, then unlimited. A
    profile pointing at an archived or deleted plan falls through to the
    default rather than being denied — the assignment going stale is an
    admin action, not the user's problem.
    """
    plan = None
    plan_id = getattr(user, "plan_id", None)
    if plan_id:
        plan = await plan_repository.get(plan_id)
    if plan is None:
        plan = await plan_repository.get_default()
    if plan is None:
        # No catalog at all — before the migration runs, for instance.
        return None, PlanLimits()

    try:
        limits = PlanLimits(**(plan.get("limits") or {}))
    except Exception:
        # A row written before validation existed, or hand-edited in the SQL
        # console. Treat as unlimited and log it: denying every request
        # because one JSON blob is malformed is the worse failure.
        logger.exception(
            "Plan %s has unreadable limits — treating as unlimited",
            plan.get("slug"),
        )
        limits = PlanLimits()
    return plan, limits


async def quota_state(user: AuthUser) -> QuotaState | None:
    """Current usage for the signed-in caller, for GET /plans/me."""
    plan, limits = await resolve_plan(user)
    if plan is None:
        return None

    try:
        used = await _count_today(user.id, day_start_utc().isoformat())
    except Exception:
        logger.exception("Quota count failed — reporting 0 used")
        used = 0

    return QuotaState(
        used=used,
        limit=None if limits.is_unlimited else limits.requests_per_day,
        resets_at=next_reset_utc(),
        plan_slug=plan.get("slug", ""),
        plan_name=plan.get("name", ""),
    )


async def enforce_plan_quota(request, user: AuthUser | None, tool: str) -> None:
    """
    Raise 429 when the caller is out of daily requests, or 403 when their
    plan does not include this tool.

    Two distinct statuses so the client can tell "come back tomorrow" from
    "this needs a different plan" — the same message would be wrong for one
    of them.

    Anonymous callers are skipped: enforce_anonymous_limit already covers
    them, and charging one request against both caps would be double
    counting. Admins are skipped outright — an admin locked out by a quota
    they configured has no way left to undo it.
    """
    if user is None or user.is_admin:
        return

    plan, limits = await resolve_plan(user)
    if plan is None:
        return

    if limits.tools is not None and tool not in limits.tools:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "detail": (
                    f"The {plan.get('name', 'current')} plan does not include this tool."
                ),
                "reason": "tool_not_in_plan",
                "plan_slug": plan.get("slug", ""),
                "plan_name": plan.get("name", ""),
            },
        )

    if limits.is_unlimited:
        return

    try:
        used = await _count_today(user.id, day_start_utc().isoformat())
    except Exception:
        logger.exception("Quota lookup failed — allowing the request")
        return

    if used >= limits.requests_per_day:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "detail": f"Daily limit reached for the {plan.get('name', 'current')} plan.",
                "reason": "quota_exceeded",
                "quota": {
                    "used": used,
                    "limit": limits.requests_per_day,
                    "resets_at": next_reset_utc().isoformat(),
                    "plan_slug": plan.get("slug", ""),
                    "plan_name": plan.get("name", ""),
                },
            },
        )
