"""
Admin user management.

Every route is behind `require_admin`, and every mutation writes an audit
row. These endpoints read through the service-role client, which bypasses
Row Level Security by design — that makes the dependency the only thing
standing between a caller and every user's data.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app.core.deps import require_admin
from app.core.rate_limit import client_ip, hash_ip
from app.repositories import admin_repository, audit_repository, profile_repository
from app.repositories.history_repository import list_recent
from app.schemas.admin import AdminUser, AdminUserListResponse, UserUpdateRequest
from app.schemas.auth import AuthUser

router = APIRouter(prefix="/admin/users", tags=["Admin"])


@router.get("", response_model=AdminUserListResponse)
async def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    search: str | None = None,
    role: str | None = Query(None, pattern="^(user|admin)$"),
    user_status: str | None = Query(None, alias="status", pattern="^(active|suspended)$"),
    _admin: AuthUser = Depends(require_admin),
) -> AdminUserListResponse:
    """Paged, searchable user list."""
    items, total = await admin_repository.list_users(
        page=page, page_size=page_size, search=search, role=role, status=user_status
    )
    return AdminUserListResponse(
        items=[AdminUser(**user) for user in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{user_id}", response_model=AdminUser)
async def get_user(user_id: str, _admin: AuthUser = Depends(require_admin)) -> AdminUser:
    profile = await profile_repository.get_profile(user_id)
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    return AdminUser(**profile)


@router.get("/{user_id}/history")
async def get_user_history(
    user_id: str,
    limit: int = Query(50, ge=1, le=200),
    _admin: AuthUser = Depends(require_admin),
) -> dict:
    """Any user's activity across all four tools."""
    return {"items": await list_recent(limit, user_id=user_id)}


@router.patch("/{user_id}", response_model=AdminUser)
async def update_user(
    user_id: str,
    payload: UserUpdateRequest,
    request: Request,
    admin: AuthUser = Depends(require_admin),
) -> AdminUser:
    """Change a user's role, status, or category. Audited."""
    before = await profile_repository.get_profile(user_id)
    if before is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        return AdminUser(**before)

    # Self-lockout guards. An admin demoting or suspending themselves could
    # leave the system with no administrator and no route back in short of
    # direct database access.
    if user_id == admin.id and changes.get("role") == "user":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot remove your own administrator role.",
        )
    if user_id == admin.id and changes.get("status") == "suspended":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot suspend your own account.",
        )

    after = await profile_repository.update_profile(user_id, changes)
    await audit_repository.record(
        admin,
        "user.update",
        target_type="user",
        target_id=user_id,
        before={key: before.get(key) for key in changes},
        after=changes,
        ip_hash=hash_ip(client_ip(request)),
    )
    return AdminUser(**(after or before))
