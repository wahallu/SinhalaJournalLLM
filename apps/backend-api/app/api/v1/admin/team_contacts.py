"""Admin editing of the contact links on the portfolio's team member cards."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.core.deps import require_admin
from app.core.rate_limit import client_ip, hash_ip
from app.repositories import audit_repository, team_contact_repository
from app.schemas.auth import AuthUser
from app.schemas.team_contact import TeamContactAdmin, TeamContactUpdate

router = APIRouter(prefix="/admin/portfolio-team", tags=["Admin"])


@router.get("", response_model=list[TeamContactAdmin])
async def list_team_contacts(
    _admin: AuthUser = Depends(require_admin),
) -> list[TeamContactAdmin]:
    rows = await team_contact_repository.list_all()
    return [TeamContactAdmin(**row) for row in rows]


@router.patch("/{student_id}", response_model=TeamContactAdmin)
async def update_team_contact(
    student_id: str,
    payload: TeamContactUpdate,
    request: Request,
    admin: AuthUser = Depends(require_admin),
) -> TeamContactAdmin:
    before = await team_contact_repository.get(student_id)
    if before is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team member not found.")

    changes = payload.model_dump(exclude_unset=True)
    changes["updated_at"] = datetime.now(timezone.utc).isoformat()
    after = await team_contact_repository.update(student_id, changes)
    if after is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team member not found.")

    await audit_repository.record(
        admin,
        "portfolio_team_contact.update",
        target_type="portfolio_team_contact",
        target_id=student_id,
        before=before,
        after=changes,
        ip_hash=hash_ip(client_ip(request)),
    )
    return TeamContactAdmin(**after)
