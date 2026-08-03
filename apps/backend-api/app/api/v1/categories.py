"""
User-facing category list.

Separate from the admin router because the audiences differ: a user may see
only the active categories, to choose one on their profile. Admins manage
the retired ones too, via /admin/categories.
"""

from fastapi import APIRouter, Body, Depends, HTTPException, status

from app.core.deps import require_user
from app.repositories import base
from app.repositories import category_repository
from app.schemas.admin import Category
from app.schemas.auth import AuthUser

router = APIRouter(prefix="/categories", tags=["Categories"])


@router.get("", response_model=list[Category])
async def list_active_categories(_user: AuthUser = Depends(require_user)) -> list[Category]:
    """Active categories, in display order — what a user may pick from."""
    return [Category(**c) for c in await category_repository.list_all(active_only=True)]


@router.put("/me")
async def set_my_category(
    category_id: str | None = Body(default=None, embed=True),
    user: AuthUser = Depends(require_user),
) -> dict[str, str | None]:
    """
    Set the caller's own category.

    The web app used to write profiles.category_id straight from the browser
    with the Supabase anon key, relying on RLS to confine the update to the
    caller's own row. With authentication self-hosted there is no RLS and no
    browser-side database access, so the write moves here — and scoping is
    now the explicit `.eq("id", user.id)` below.

    Only this one column is written, which is what keeps the endpoint from
    becoming a way to self-assign a role: role and status are not touched.
    """
    if category_id:
        active = await category_repository.list_all(active_only=True)
        if not any(str(c["id"]) == category_id for c in active):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Unknown or inactive category.",
            )

    client = await base.get_supabase()
    await (
        client.table("profiles")
        .update({"category_id": category_id or None})
        .eq("id", user.id)
        .execute()
    )
    return {"category_id": category_id or None}
