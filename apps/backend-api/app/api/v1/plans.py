"""
User-facing plan catalog.

Separate from the admin router because the audiences differ: a user may see
only visible, unarchived tiers, while admins manage the hidden and retired
ones too via /admin/plans.
"""

import logging

from fastapi import APIRouter, Depends

from app.core.deps import optional_user, require_user
from app.core.plan_quota import quota_state
from app.repositories import plan_repository
from app.schemas.auth import AuthUser
from app.schemas.plan import Plan, QuotaState

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/plans", tags=["Plans"])


def _to_plan(row: dict) -> Plan:
    """Build the response model from a stored row."""
    return Plan(**{**row, "id": str(row["id"]), "limits": row.get("limits") or {}})


@router.get("", response_model=list[Plan])
async def list_plans(_user: AuthUser | None = Depends(optional_user)) -> list[Plan]:
    """
    The visible catalog, in display order.

    Public on purpose — /plans has to render for a signed-out visitor, and
    the contents are marketing copy, not anybody's data.
    """
    rows = await plan_repository.list_all(visible_only=True)
    plans: list[Plan] = []
    for row in rows:
        try:
            plans.append(_to_plan(row))
        except Exception:
            # One malformed row must not empty the pricing page.
            logger.exception("Skipping unrenderable plan %s", row.get("slug"))
    return plans


@router.get("/me", response_model=QuotaState | None)
async def my_plan(user: AuthUser = Depends(require_user)) -> QuotaState | None:
    """
    The caller's plan and today's usage against it.

    None when no catalog exists yet — before the migration has been applied,
    for instance. The client treats that as "unlimited, nothing to show".
    """
    return await quota_state(user)
