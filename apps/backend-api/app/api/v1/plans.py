"""
User-facing plan catalog.

Separate from the admin router because the audiences differ: a user may see
only visible, unarchived tiers, while admins manage the hidden and retired
ones too via /admin/plans.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.deps import optional_user, require_user
from app.core.plan_quota import quota_state
from app.repositories import plan_repository, settings_repository, upgrade_repository
from app.schemas.auth import AuthUser
from app.schemas.plan import (
    BankDetails,
    Plan,
    QuotaState,
    UpgradeRequest,
    UpgradeRequestCreate,
)

# Where the bank details live in app_settings. Not a settings_registry key:
# that registry documents its refusal to hold free-form strings, and a bank
# name and account number cannot be a closed set.
BANK_DETAILS_KEY = "payments.bank_details"

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


# ── Upgrading ─────────────────────────────────────────────────────────────
#
# No payment gateway is wired up, so an upgrade is not a purchase: the user
# pays by bank transfer, submits the reference, and an admin confirms the
# money arrived. The endpoints below never move a plan — only the admin
# review in api/v1/admin/upgrades.py does.


async def _bank_details() -> BankDetails:
    stored = await settings_repository.get_value(BANK_DETAILS_KEY)
    try:
        return BankDetails(**(stored or {}))
    except Exception:
        # Hand-edited in the SQL console. Render the empty form rather than
        # 500 the page a user is trying to pay from.
        logger.exception("Stored bank details are unreadable")
        return BankDetails()


@router.get("/payment-details", response_model=BankDetails)
async def payment_details(_user: AuthUser = Depends(require_user)) -> BankDetails:
    """Where to send the transfer. Signed in only — it is not public info."""
    return await _bank_details()


@router.get("/upgrade-requests/me", response_model=list[UpgradeRequest])
async def my_upgrade_requests(user: AuthUser = Depends(require_user)) -> list[UpgradeRequest]:
    """The caller's own requests, newest first."""
    rows = await upgrade_repository.list_for_user(user.id)
    return [UpgradeRequest(**{**row, "id": str(row["id"])}) for row in rows]


@router.post(
    "/upgrade-requests",
    response_model=UpgradeRequest,
    status_code=status.HTTP_201_CREATED,
)
async def request_upgrade(
    payload: UpgradeRequestCreate,
    user: AuthUser = Depends(require_user),
) -> UpgradeRequest:
    """
    Ask to be moved onto a plan, quoting the bank reference for the transfer.

    Deliberately does NOT change the caller's plan. It records an intent for
    an admin to confirm against the actual money — a self-service upgrade
    with no gateway behind it would just be a free plan change.
    """
    target = await plan_repository.get(payload.plan_id)
    if target is None or target.get("archived_at"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Unknown plan.",
        )
    if str(target["id"]) == str(user.plan_id or ""):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already on this plan.",
        )

    existing = await upgrade_repository.pending_for_user(user.id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have an upgrade request awaiting review.",
        )

    created = await upgrade_repository.create({
        "user_id": user.id,
        "plan_id": str(target["id"]),
        "from_plan_id": user.plan_id,
        "status": "pending",
        "payment_reference": payload.payment_reference,
        "note": payload.note,
    })
    return UpgradeRequest(**{**created, "id": str(created["id"])})


@router.post("/upgrade-requests/{request_id}/cancel", response_model=UpgradeRequest)
async def cancel_upgrade_request(
    request_id: str,
    user: AuthUser = Depends(require_user),
) -> UpgradeRequest:
    """Withdraw an open request. Scoped to the caller's own rows."""
    existing = await upgrade_repository.get(request_id)
    # The service-role client bypasses RLS, so this ownership check is the
    # only thing stopping one user cancelling another's request.
    if existing is None or str(existing["user_id"]) != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found.")
    if existing["status"] != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only a pending request can be cancelled.",
        )

    updated = await upgrade_repository.update(request_id, {"status": "cancelled"})
    return UpgradeRequest(**{**(updated or existing), "id": request_id})
