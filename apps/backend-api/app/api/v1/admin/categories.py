"""
Admin category management.

Every route is behind `require_admin`, and every mutation writes an audit
row with before/after values.
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.core.deps import require_admin
from app.core.rate_limit import client_ip, hash_ip
from app.repositories import audit_repository, category_repository
from app.schemas.admin import Category, CategoryIn
from app.schemas.auth import AuthUser

router = APIRouter(prefix="/admin/categories", tags=["Admin"])


@router.get("", response_model=list[Category])
async def list_categories(_admin: AuthUser = Depends(require_admin)) -> list[Category]:
    """Every category, active or not — admins manage the retired ones too."""
    return [Category(**c) for c in await category_repository.list_all()]


@router.post("", response_model=Category, status_code=status.HTTP_201_CREATED)
async def create_category(
    payload: CategoryIn,
    request: Request,
    admin: AuthUser = Depends(require_admin),
) -> Category:
    created = await category_repository.create(payload.model_dump())
    await audit_repository.record(
        admin,
        "category.create",
        target_type="category",
        target_id=created["id"],
        after=payload.model_dump(),
        ip_hash=hash_ip(client_ip(request)),
    )
    return Category(**created)


@router.patch("/{category_id}", response_model=Category)
async def update_category(
    category_id: str,
    payload: CategoryIn,
    request: Request,
    admin: AuthUser = Depends(require_admin),
) -> Category:
    before = await category_repository.get(category_id)
    if before is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found.")

    after = await category_repository.update(category_id, payload.model_dump())
    await audit_repository.record(
        admin,
        "category.update",
        target_type="category",
        target_id=category_id,
        before=before,
        after=payload.model_dump(),
        ip_hash=hash_ip(client_ip(request)),
    )
    return Category(**(after or before))


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: str,
    request: Request,
    admin: AuthUser = Depends(require_admin),
) -> None:
    """
    Delete a category.

    `profiles.category_id` is ON DELETE SET NULL, so members become
    uncategorized rather than being deleted along with it.
    """
    before = await category_repository.get(category_id)
    if before is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found.")

    await category_repository.delete(category_id)
    await audit_repository.record(
        admin,
        "category.delete",
        target_type="category",
        target_id=category_id,
        before=before,
        ip_hash=hash_ip(client_ip(request)),
    )
