"""
Admin review of plan upgrade requests, and the bank details users pay into.

This is the ONLY place a paid upgrade moves a user's plan. The user-facing
endpoints record an intent; an admin confirms the transfer actually landed
and approves, which is what makes the change. Every decision is audited.
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app.core.deps import require_admin
from app.core.rate_limit import client_ip, hash_ip
from app.repositories import (
    audit_repository,
    base,
    plan_repository,
    profile_repository,
    settings_repository,
    upgrade_repository,
)
from app.schemas.auth import AuthUser
from app.schemas.plan import BankDetails, UpgradeRequest, UpgradeReview

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/upgrades", tags=["Admin"])

# Kept in step with api/v1/plans.py, which reads the same key.
BANK_DETAILS_KEY = "payments.bank_details"


async def _decorate(rows: list[dict]) -> list[UpgradeRequest]:
    """
    Attach the email and plan names a reviewer needs to act on a row.

    Resolved in bulk rather than per row: a pending queue of thirty would
    otherwise be ninety round trips to render one table.
    """
    plans = {str(p["id"]): p for p in await plan_repository.list_all(include_archived=True)}

    emails: dict[str, str] = {}
    user_ids = {str(r["user_id"]) for r in rows if r.get("user_id")}
    if user_ids:
        client = await base.get_supabase()
        response = await (
            client.table("profiles").select("id,email")
            .in_("id", list(user_ids)).execute()
        )
        emails = {str(r["id"]): r.get("email") for r in (response.data or [])}

    decorated = []
    for row in rows:
        plan = plans.get(str(row.get("plan_id")))
        from_plan = plans.get(str(row.get("from_plan_id"))) if row.get("from_plan_id") else None
        decorated.append(UpgradeRequest(**{
            **row,
            "id": str(row["id"]),
            "user_email": emails.get(str(row.get("user_id"))),
            "plan_name": plan.get("name") if plan else None,
            "from_plan_name": from_plan.get("name") if from_plan else None,
        }))
    return decorated


@router.get("", response_model=list[UpgradeRequest])
async def list_upgrade_requests(
    status_filter: str | None = Query(default=None, alias="status"),
    _admin: AuthUser = Depends(require_admin),
) -> list[UpgradeRequest]:
    """The review queue. Defaults to every status so history stays visible."""
    rows = await upgrade_repository.list_all(status=status_filter)
    return await _decorate(rows)


# Declared before the /{request_id} route: a literal path must be matched
# first, or a later GET /{request_id} would swallow "bank-details" as an id.
@router.get("/bank-details", response_model=BankDetails)
async def get_bank_details(_admin: AuthUser = Depends(require_admin)) -> BankDetails:
    stored = await settings_repository.get_value(BANK_DETAILS_KEY)
    try:
        return BankDetails(**(stored or {}))
    except Exception:
        logger.exception("Stored bank details are unreadable — returning blanks")
        return BankDetails()


@router.put("/bank-details", response_model=BankDetails)
async def set_bank_details(
    payload: BankDetails,
    request: Request,
    admin: AuthUser = Depends(require_admin),
) -> BankDetails:
    """
    Where users are told to send money.

    Free text, so it is stored as one validated blob under its own endpoint
    rather than through settings_registry — that registry documents why it
    accepts no free-form strings, and weakening it for this would be the
    wrong trade.
    """
    await settings_repository.upsert(
        BANK_DETAILS_KEY, payload.model_dump(), actor_id=admin.id,
    )
    await audit_repository.record(
        admin,
        "payments.bank_details.update",
        target_type="setting",
        target_id=BANK_DETAILS_KEY,
        after={"bank_name": payload.bank_name, "account_name": payload.account_name},
        ip_hash=hash_ip(client_ip(request)),
    )
    return payload


@router.patch("/{request_id}", response_model=UpgradeRequest)
async def review_upgrade_request(
    request_id: str,
    payload: UpgradeReview,
    request: Request,
    admin: AuthUser = Depends(require_admin),
) -> UpgradeRequest:
    """
    Approve or decline. Approving is what moves the user onto the plan.

    Refuses anything already decided rather than silently re-deciding it:
    two admins working the same queue would otherwise race, and the second
    approval would move a plan the first had already declined.
    """
    existing = await upgrade_repository.get(request_id)
    if existing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found.")
    if existing["status"] != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"This request was already {existing['status']}.",
        )

    changes = {
        "status": payload.status,
        "reviewer_note": payload.reviewer_note,
        "reviewed_by": admin.id,
        "reviewed_at": datetime.now(timezone.utc).isoformat(),
    }
    updated = await upgrade_repository.update(request_id, changes)

    if payload.status == "approved":
        # The plan move and the request row are two writes with no transaction
        # between them. The request is marked FIRST, so a failure here leaves
        # an approved request whose plan did not move — visible in the queue
        # and fixable — rather than a moved plan with no record of why.
        moved = await profile_repository.set_plan(
            str(existing["user_id"]), str(existing["plan_id"]),
        )
        if not moved:
            logger.error(
                "Approved upgrade %s but could not move user %s onto plan %s",
                request_id, existing["user_id"], existing["plan_id"],
            )
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=(
                    "The request was marked approved but the plan could not be "
                    "applied. Set the user's plan directly and check the logs."
                ),
            )

    await audit_repository.record(
        admin,
        f"upgrade.{payload.status}",
        target_type="upgrade_request",
        target_id=request_id,
        before={"status": existing["status"], "plan_id": str(existing.get("from_plan_id") or "")},
        after={"status": payload.status, "plan_id": str(existing["plan_id"])},
        ip_hash=hash_ip(client_ip(request)),
    )
    return (await _decorate([updated or {**existing, **changes}]))[0]
