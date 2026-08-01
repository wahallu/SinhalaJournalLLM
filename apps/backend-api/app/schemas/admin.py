"""Request and response models for the admin dashboard."""

from datetime import datetime

from pydantic import BaseModel, Field


class AdminUser(BaseModel):
    """A user as the admin dashboard sees them."""

    id: str
    email: str
    full_name: str | None = None
    role: str
    status: str
    category_id: str | None = None
    created_at: datetime | None = None
    last_seen_at: datetime | None = None


class AdminUserListResponse(BaseModel):
    items: list[AdminUser]
    total: int
    page: int
    page_size: int


class UserUpdateRequest(BaseModel):
    """Any subset may be sent; omitted fields are left unchanged."""

    role: str | None = Field(default=None, pattern="^(user|admin)$")
    status: str | None = Field(default=None, pattern="^(active|suspended)$")
    category_id: str | None = None


class CategoryIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    slug: str = Field(min_length=1, max_length=60, pattern="^[a-z0-9-]+$")
    description: str | None = None
    is_active: bool = True
    sort_order: int = 0


class Category(CategoryIn):
    id: str


class OverviewResponse(BaseModel):
    total_users: int
    admin_count: int
    suspended_count: int
    requests_24h: int
    requests_7d: int
    by_tool: dict[str, int]
