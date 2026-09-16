"""
Admin plan management.

Every route is behind `require_admin`, and every mutation writes an audit row
with before/after values — the same contract as admin/categories.py and
admin/settings.py.

Plans are archived, never hard-deleted. `profiles.plan_id` is ON DELETE SET
NULL, so a real delete would silently strip the tier from every user on it.
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.core.deps import require_admin
from app.core.rate_limit import client_ip, hash_ip
from app.repositories import audit_repository, base, plan_repository
from app.schemas.auth import AuthUser
from app.schemas.plan import Plan, PlanAssignment, PlanCreate, PlanUpdate

router = APIRouter(prefix="/admin/plans", tags=["Admin"])


def _to_plan(row: dict) -> Plan:
    return Plan(**{**row, "id": str(row["id"]), "limits": row.get("limits") or {}})


@router.get("", response_model=list[Plan])
async def list_plans(_admin: AuthUser = Depends(require_admin)) -> list[Plan]:
    """Every plan, including hidden and archived ones."""
    rows = await plan_repository.list_all(include_archived=True)
    return [_to_plan(row) for row in rows]


@router.post("", response_model=Plan, status_code=status.HTTP_201_CREATED)
async def create_plan(
    payload: PlanCreate,
    request: Request,
    admin: AuthUser = Depends(require_admin),
) -> Plan:
    if await plan_repository.get_by_slug(payload.slug):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A plan with slug '{payload.slug}' already exists.",
        )

    data = payload.model_dump()
    data["limits"] = payload.limits.model_dump(exclude_none=True)

    # Demote the incumbent first: the partial unique index makes two defaults
    # impossible, so writing this one without clearing the other would fail
    # on a constraint the admin never set.
    if payload.is_default:
        await plan_repository.clear_default()

    created = await plan_repository.create(data)
    await audit_repository.record(
        admin,
        "plan.create",
        target_type="plan",
        target_id=str(created["id"]),
        after=data,
        ip_hash=hash_ip(client_ip(request)),
    )
    return _to_plan(created)


@router.patch("/{plan_id}", response_model=Plan)
async def update_plan(
    plan_id: str,
    payload: PlanUpdate,
    request: Request,
    admin: AuthUser = Depends(require_admin),
) -> Plan:
    existing = await plan_repository.get(plan_id)
    if existing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found.")

    changes = payload.model_dump(exclude_unset=True)
    if payload.limits is not None:
        changes["limits"] = payload.limits.model_dump(exclude_none=True)

    # Demoting the only default would leave new signups with nothing to
    # resolve to, so it has to be a promotion of something else instead.
    if changes.get("is_default") is False and existing.get("is_default"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Promote another plan to default instead of clearing this one.",
        )
    if changes.get("is_default") is True:
        await plan_repository.clear_default(except_id=plan_id)

    updated = await plan_repository.update(plan_id, changes)
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found.")

    await audit_repository.record(
        admin,
        "plan.update",
        target_type="plan",
        target_id=plan_id,
        before={k: existing.get(k) for k in changes},
        after=changes,
        ip_hash=hash_ip(client_ip(request)),
    )
    return _to_plan(updated)


@router.delete("/{plan_id}", response_model=Plan)
async def archive_plan(
    plan_id: str,
    request: Request,
    admin: AuthUser = Depends(require_admin),
) -> Plan:
    """Archive a plan. Refuses the default — new signups resolve to it."""
    existing = await plan_repository.get(plan_id)
    if existing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found.")
    if existing.get("is_default"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The default plan cannot be archived. Promote another plan first.",
        )

    archived = await plan_repository.archive(plan_id)
    await audit_repository.record(
        admin,
        "plan.archive",
        target_type="plan",
        target_id=plan_id,
        before={"archived_at": existing.get("archived_at")},
        after={"archived_at": (archived or {}).get("archived_at")},
        ip_hash=hash_ip(client_ip(request)),
    )
    return _to_plan(archived or existing)
