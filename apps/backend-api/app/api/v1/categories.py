"""
User-facing category list.

Separate from the admin router because the audiences differ: a user may see
only the active categories, to choose one on their profile. Admins manage
the retired ones too, via /admin/categories.
"""

from fastapi import APIRouter, Depends

from app.core.deps import require_user
from app.repositories import category_repository
from app.schemas.admin import Category
from app.schemas.auth import AuthUser

router = APIRouter(prefix="/categories", tags=["Categories"])


@router.get("", response_model=list[Category])
async def list_active_categories(_user: AuthUser = Depends(require_user)) -> list[Category]:
    """Active categories, in display order — what a user may pick from."""
    return [Category(**c) for c in await category_repository.list_all(active_only=True)]
