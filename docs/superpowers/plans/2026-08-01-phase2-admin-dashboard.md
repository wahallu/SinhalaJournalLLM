# Phase 2 — Admin Shell & User Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** An admin dashboard at `/admin` where an administrator manages users, roles and categories, sees every user's activity, and leaves an audit trail — styled with the approved token set, scoped so the existing product UI is untouched.

**Architecture:** New admin routers under `/api/v1/admin`, every one behind `require_admin`, reading through the service-role client. A new `audit_log` table records every privileged mutation with before/after values. The frontend gains an `/admin/*` route tree with its own layout, sidebar and theme scope, guarded by `AdminRoute`.

**Tech Stack:** FastAPI, Supabase/Postgres, React 19, Vite, react-router-dom v7, Tailwind v4, recharts, pytest.

## Global Constraints

- Frontend is **JavaScript + JSX, not TypeScript**.
- All DDL goes in `apps/backend-api/schema.sql` and must be **idempotent**.
- Tests run offline. The `conftest.py` autouse fixtures already enforce this — do not modify them.
- **Every admin route requires `require_admin`.** A missing dependency on one route is a full authorization bypass.
- **Every privileged mutation writes an `audit_log` row** with actor, action, target, and before/after values.
- The new theme tokens apply **only inside `.admin-theme`**. Never use `bg-card`, `text-muted-foreground`, `border-sidebar-border` etc. on a user-facing page — the values do not resolve there.
- Non-admins get **404** on `/admin/*`, not 403 — the surface must not be discoverable.
- Never log or return a raw JWT, raw IP, or the service-role key.
- Commit after every task, conventional-commit prefixes.

**Run commands:**
- Backend tests: `cd apps/backend-api && source .venv/bin/activate && python -m pytest tests/ -v`
- Frontend: `cd apps/web-app && npm run lint && npm run build`

**Baseline at Phase 2 start:** 52 backend tests passing, 12 pre-existing frontend lint errors, build clean.

---

## Ordering note

The spec (§3.1) lists the per-request user-scoped PostgREST client as Phase 2's first item. This plan puts it **last (Task 10)**. It is a refactor across every read path; doing it before the admin read paths exist would mean doing it twice. It remains in scope and must not be dropped.

---

## File Structure

**Backend — create:**

| File | Responsibility |
|---|---|
| `app/repositories/audit_repository.py` | `audit_log` writes and paged reads |
| `app/repositories/category_repository.py` | `user_categories` CRUD |
| `app/repositories/admin_repository.py` | cross-user reads (user list, per-user stats) |
| `app/schemas/admin.py` | admin request/response models |
| `app/api/v1/admin/__init__.py` | admin router aggregation |
| `app/api/v1/admin/users.py` | list, detail, role/status/category mutations |
| `app/api/v1/admin/categories.py` | category CRUD |
| `app/api/v1/admin/overview.py` | dashboard counts |
| `tests/test_admin_auth.py` | authorization tests — every route rejects non-admins |
| `tests/test_admin_users.py` | user management behaviour |
| `tests/test_admin_categories.py` | category CRUD behaviour |

**Backend — modify:** `schema.sql`, `app/api/v1/__init__.py`, `app/repositories/profile_repository.py`

**Frontend — create:**

| File | Responsibility |
|---|---|
| `src/admin/theme.css` | the approved token set, scoped to `.admin-theme` |
| `src/admin/AdminRoute.jsx` | admin-only route guard (renders 404 for everyone else) |
| `src/admin/AdminLayout.jsx` | shell + theme scope + dark-mode toggle |
| `src/admin/AdminSidebar.jsx` | admin navigation |
| `src/admin/ConfirmDialog.jsx` | shared current → new confirmation |
| `src/admin/adminApi.js` | admin API client |
| `src/admin/pages/Overview.jsx` | KPIs |
| `src/admin/pages/Users.jsx` | searchable user table |
| `src/admin/pages/UserDetail.jsx` | one user: profile, controls, their history |
| `src/admin/pages/Categories.jsx` | category CRUD |

**Frontend — modify:** `src/App.jsx`, `src/index.css`, `src/components/ProfilePage.jsx`, `src/components/Sidebar.jsx`

---

### Task 1: `audit_log` schema

**Files:** Modify `apps/backend-api/schema.sql`

- [ ] **Step 1: Append the table**

```sql
-- ── Audit log — every privileged mutation ──
create table if not exists audit_log (
    id          uuid primary key default gen_random_uuid(),
    actor_id    uuid references auth.users(id) on delete set null,
    actor_email text not null,
    action      text not null,
    target_type text,
    target_id   text,
    before      jsonb,
    after       jsonb,
    ip_hash     text,
    created_at  timestamptz not null default now()
);

create index if not exists idx_audit_created on audit_log (created_at desc);
create index if not exists idx_audit_actor   on audit_log (actor_id, created_at desc);
create index if not exists idx_audit_target  on audit_log (target_type, target_id);

alter table audit_log enable row level security;
-- No policy: authenticated and anon are denied everything. Only the service
-- role writes and reads this table, via require_admin-gated endpoints.
```

`actor_email` is denormalized on purpose — the trail must stay readable after the actor's account is deleted.

- [ ] **Step 2: Validate syntax**

```bash
cd apps/backend-api && source .venv/bin/activate && pip install -q pglast && python3 -c "
import pglast; print('parsed', len(pglast.parse_sql(open('schema.sql').read())), 'statements')
" && pip uninstall -y -q pglast
```

Expected: parses cleanly, statement count higher than 54.

- [ ] **Step 3: Confirm idempotency**

Every new statement uses `if not exists`. Verify by eye, then confirm the whole file still re-runs safely.

- [ ] **Step 4: Commit**

```bash
git add apps/backend-api/schema.sql
git commit -m "feat: add audit_log table for privileged mutations"
```

- [ ] **Step 5: HUMAN STEP — apply to Supabase**

Re-run `schema.sql` in Supabase Studio, then verify:

```sql
select tablename, rowsecurity from pg_tables where schemaname='public' and tablename='audit_log';
```

Expected: one row, `rowsecurity = true`.

---

### Task 2: Admin repositories and audit helper

**Files:**
- Create: `app/repositories/audit_repository.py`, `app/repositories/category_repository.py`, `app/repositories/admin_repository.py`
- Modify: `app/repositories/profile_repository.py`

**Interfaces produced:**
- `audit_repository.record(actor, action, *, target_type=None, target_id=None, before=None, after=None, ip_hash=None) -> None`
- `audit_repository.list_entries(*, page=1, page_size=50) -> tuple[list[dict], int]`
- `category_repository.list_all(*, active_only=False) -> list[dict]`
- `category_repository.create(data) -> dict`
- `category_repository.update(category_id, data) -> dict | None`
- `category_repository.delete(category_id) -> bool`
- `category_repository.get(category_id) -> dict | None`
- `admin_repository.list_users(*, page=1, page_size=50, search=None, role=None, status=None) -> tuple[list[dict], int]`
- `profile_repository.update_profile(user_id, changes) -> dict | None`

- [ ] **Step 1: Write `audit_repository.py`**

```python
"""
Audit trail for privileged mutations.

Every admin action that changes state writes one row here with before/after
values, so "who turned off the GPU provider at 2am, and what was it before"
is answerable. actor_email is denormalized because the trail must survive
the actor's account being deleted.
"""

import logging
from typing import Any

from app.repositories.base import fetch_page, insert_record
from app.schemas.auth import AuthUser

TABLE = "audit_log"

logger = logging.getLogger(__name__)


async def record(
    actor: AuthUser,
    action: str,
    *,
    target_type: str | None = None,
    target_id: str | None = None,
    before: dict[str, Any] | None = None,
    after: dict[str, Any] | None = None,
    ip_hash: str | None = None,
) -> None:
    """
    Write one audit row.

    Never raises: a failed audit write must not roll back an admin action
    that already succeeded. It is logged loudly instead.
    """
    try:
        await insert_record(
            TABLE,
            {
                "actor_id": actor.id,
                "actor_email": actor.email,
                "action": action,
                "target_type": target_type,
                "target_id": target_id,
                "before": before,
                "after": after,
                "ip_hash": ip_hash,
            },
        )
    except Exception:
        logger.exception("Audit write failed for action=%s target=%s", action, target_id)


async def list_entries(*, page: int = 1, page_size: int = 50):
    """Newest-first page of audit entries plus the total count."""
    return await fetch_page(TABLE, page=page, page_size=page_size)
```

- [ ] **Step 2: Write `category_repository.py`**

```python
"""Data access for user_categories. Admin-only; uses the service-role client."""

from typing import Any

from app.core.database import get_supabase
from app.repositories.base import fetch_by_id, insert_record

TABLE = "user_categories"


async def get(category_id: str) -> dict[str, Any] | None:
    return await fetch_by_id(TABLE, category_id)


async def list_all(*, active_only: bool = False) -> list[dict[str, Any]]:
    """All categories in display order."""
    client = await get_supabase()
    query = client.table(TABLE).select("*")
    if active_only:
        query = query.eq("is_active", True)
    response = await query.order("sort_order", desc=False).execute()
    return response.data


async def create(data: dict[str, Any]) -> dict[str, Any]:
    return await insert_record(TABLE, data)


async def update(category_id: str, data: dict[str, Any]) -> dict[str, Any] | None:
    client = await get_supabase()
    response = await client.table(TABLE).update(data).eq("id", category_id).execute()
    return response.data[0] if response.data else None


async def delete(category_id: str) -> bool:
    """
    Remove a category. profiles.category_id is ON DELETE SET NULL, so users
    in this category simply become uncategorized rather than being deleted.
    """
    client = await get_supabase()
    response = await client.table(TABLE).delete().eq("id", category_id).execute()
    return bool(response.data)
```

- [ ] **Step 3: Write `admin_repository.py`**

```python
"""
Cross-user reads for the admin dashboard.

Uses the service-role client deliberately: these queries must see every
user's rows, which is exactly what RLS forbids for normal callers. Every
caller of this module must be behind require_admin.
"""

from typing import Any

from app.core.database import get_supabase

PROFILES = "profiles"


async def list_users(
    *,
    page: int = 1,
    page_size: int = 50,
    search: str | None = None,
    role: str | None = None,
    status: str | None = None,
) -> tuple[list[dict[str, Any]], int]:
    """Paged user list with optional search and filters, newest first."""
    client = await get_supabase()
    query = client.table(PROFILES).select("*", count="exact")

    if search:
        # Escape PostgREST's or() delimiters so a crafted search string
        # cannot break out of the filter expression.
        safe = search.replace(",", "").replace("(", "").replace(")", "").replace("*", "")
        query = query.or_(f"email.ilike.*{safe}*,full_name.ilike.*{safe}*")
    if role:
        query = query.eq("role", role)
    if status:
        query = query.eq("status", status)

    offset = (page - 1) * page_size
    response = await (
        query.order("created_at", desc=True)
        .range(offset, offset + page_size - 1)
        .execute()
    )
    return response.data, response.count or 0
```

- [ ] **Step 4: Add `update_profile` to `profile_repository.py`**

```python
async def update_profile(user_id: str, changes: dict[str, Any]) -> dict[str, Any] | None:
    """
    Update a profile via the service-role client.

    role and status are guarded by a database trigger that rejects changes
    from non-service-role callers, so this is the only path that can change
    them — and it is reachable only behind require_admin.
    """
    client = await get_supabase()
    response = await client.table(TABLE).update(changes).eq("id", user_id).execute()
    return response.data[0] if response.data else None
```

Add the `get_supabase` import at the top.

- [ ] **Step 5: Extend the test fake**

`_FakeQuery` lacks `update`, `delete`, and `or_`. Add them to `tests/conftest.py`:

```python
    def update(self, record: dict):
        self._operation = "update"
        self._payload = record
        return self

    def delete(self):
        self._operation = "delete"
        return self

    def or_(self, expression: str):
        self._or = expression
        return self
```

Initialize `self._or = None` in `__init__`, and handle the new operations in `execute`:

```python
        if self._operation == "update":
            updated = []
            for row in rows:
                if all(str(row.get(c)) == str(v) for c, v in self._filters):
                    row.update(self._payload)
                    updated.append(row)
            return SimpleNamespace(data=updated, count=None)

        if self._operation == "delete":
            removed = [r for r in rows if all(str(r.get(c)) == str(v) for c, v in self._filters)]
            self._store[self._table] = [r for r in rows if r not in removed]
            return SimpleNamespace(data=removed, count=None)
```

- [ ] **Step 6: Run the suite**

```bash
cd apps/backend-api && python -m pytest tests/ -q
```

Expected: 52 passed, no regressions. No new tests yet — Task 3 covers these repositories through the endpoints.

- [ ] **Step 7: Commit**

```bash
git add apps/backend-api/app/repositories apps/backend-api/tests/conftest.py
git commit -m "feat: add admin, category and audit repositories"
```

---

### Task 3: Admin API — authorization gate first

This task establishes that **every** admin route is locked before any admin functionality exists. Writing the authorization tests first means a later route added without `require_admin` fails a test rather than shipping a bypass.

**Files:**
- Create: `app/schemas/admin.py`, `app/api/v1/admin/__init__.py`, `app/api/v1/admin/users.py`, `app/api/v1/admin/categories.py`, `app/api/v1/admin/overview.py`, `tests/test_admin_auth.py`
- Modify: `app/api/v1/__init__.py`

- [ ] **Step 1: Write the authorization test first**

`tests/test_admin_auth.py`:

```python
"""
Every admin route must reject anonymous callers with 401 and non-admin
callers with 403. This file enumerates the routes from the app itself, so a
route added later without require_admin fails here rather than shipping an
authorization bypass.
"""

import time

import jwt
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app

TEST_SECRET = "test-jwt-secret-not-a-real-one-padded-to-sixty-four-chars-ok!"
USER_ID = "11111111-1111-1111-1111-111111111111"
ADMIN_ID = "22222222-2222-2222-2222-222222222222"


def _token(sub: str) -> str:
    return jwt.encode(
        {"sub": sub, "email": f"{sub[:4]}@sinai.lk", "aud": "authenticated",
         "exp": int(time.time()) + 3600, "iat": int(time.time())},
        TEST_SECRET, algorithm="HS256",
    )


def _auth(sub: str) -> dict:
    return {"Authorization": f"Bearer {_token(sub)}"}


def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.fixture(autouse=True)
def _secret(monkeypatch):
    from app.core import auth as auth_module
    monkeypatch.setattr(auth_module, "_jwt_secret", lambda: TEST_SECRET)


@pytest.fixture(autouse=True)
def _profiles(fake_supabase):
    fake_supabase.store["profiles"] = [
        {"id": USER_ID, "email": "user@sinai.lk", "role": "user", "status": "active",
         "category_id": None, "created_at": "2026-01-01T00:00:00Z"},
        {"id": ADMIN_ID, "email": "admin@sinai.lk", "role": "admin", "status": "active",
         "category_id": None, "created_at": "2026-01-01T00:00:00Z"},
    ]
    return fake_supabase


def _admin_get_routes() -> list[str]:
    """Every registered GET route under /api/v1/admin, with params filled in."""
    paths = []
    for route in app.routes:
        path = getattr(route, "path", "")
        methods = getattr(route, "methods", set())
        if path.startswith("/api/v1/admin") and "GET" in methods:
            paths.append(path.replace("{user_id}", USER_ID).replace("{category_id}", "c1"))
    return paths


def test_admin_routes_exist():
    """Guard against this file silently passing because nothing is registered."""
    assert _admin_get_routes(), "No admin GET routes found — did registration break?"


@pytest.mark.asyncio
async def test_every_admin_get_route_rejects_anonymous():
    async with _client() as c:
        for path in _admin_get_routes():
            r = await c.get(path)
            assert r.status_code == 401, f"{path} returned {r.status_code} to anonymous"


@pytest.mark.asyncio
async def test_every_admin_get_route_rejects_non_admin():
    async with _client() as c:
        for path in _admin_get_routes():
            r = await c.get(path, headers=_auth(USER_ID))
            assert r.status_code == 403, f"{path} returned {r.status_code} to a normal user"


@pytest.mark.asyncio
async def test_admin_can_reach_admin_routes():
    async with _client() as c:
        for path in _admin_get_routes():
            r = await c.get(path, headers=_auth(ADMIN_ID))
            assert r.status_code < 400, f"{path} returned {r.status_code} to an admin"
```

- [ ] **Step 2: Run it — it must fail**

```bash
cd apps/backend-api && python -m pytest tests/test_admin_auth.py -v
```

Expected: `test_admin_routes_exist` FAILS — no admin routes registered yet. That failure is the point.

- [ ] **Step 3: Write the schemas**

`app/schemas/admin.py`:

```python
"""Request and response models for the admin dashboard."""

from datetime import datetime

from pydantic import BaseModel, Field


class AdminUser(BaseModel):
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
```

- [ ] **Step 4: Write the three routers**

`app/api/v1/admin/users.py`:

```python
"""Admin user management. Every route is behind require_admin."""

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
    role: str | None = None,
    user_status: str | None = Query(None, alias="status"),
    _admin: AuthUser = Depends(require_admin),
):
    items, total = await admin_repository.list_users(
        page=page, page_size=page_size, search=search, role=role, status=user_status
    )
    return AdminUserListResponse(
        items=[AdminUser(**u) for u in items], total=total, page=page, page_size=page_size
    )


@router.get("/{user_id}", response_model=AdminUser)
async def get_user(user_id: str, _admin: AuthUser = Depends(require_admin)):
    profile = await profile_repository.get_profile(user_id)
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    return AdminUser(**profile)


@router.get("/{user_id}/history")
async def get_user_history(
    user_id: str,
    limit: int = Query(50, ge=1, le=200),
    _admin: AuthUser = Depends(require_admin),
):
    """Any user's activity. Admin-only by construction — see require_admin."""
    return {"items": await list_recent(limit, user_id=user_id)}


@router.patch("/{user_id}", response_model=AdminUser)
async def update_user(
    user_id: str,
    payload: UserUpdateRequest,
    request: Request,
    admin: AuthUser = Depends(require_admin),
):
    before = await profile_repository.get_profile(user_id)
    if before is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        return AdminUser(**before)

    # An admin removing their own admin role could leave the system with no
    # administrator and no way back in without direct database access.
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
        before={k: before.get(k) for k in changes},
        after=changes,
        ip_hash=hash_ip(client_ip(request)),
    )
    return AdminUser(**(after or before))
```

`app/api/v1/admin/categories.py`:

```python
"""Admin category management. Every route is behind require_admin."""

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.core.deps import require_admin
from app.core.rate_limit import client_ip, hash_ip
from app.repositories import audit_repository, category_repository
from app.schemas.admin import Category, CategoryIn
from app.schemas.auth import AuthUser

router = APIRouter(prefix="/admin/categories", tags=["Admin"])


@router.get("", response_model=list[Category])
async def list_categories(_admin: AuthUser = Depends(require_admin)):
    return [Category(**c) for c in await category_repository.list_all()]


@router.post("", response_model=Category, status_code=status.HTTP_201_CREATED)
async def create_category(
    payload: CategoryIn, request: Request, admin: AuthUser = Depends(require_admin)
):
    created = await category_repository.create(payload.model_dump())
    await audit_repository.record(
        admin, "category.create", target_type="category",
        target_id=created["id"], after=payload.model_dump(),
        ip_hash=hash_ip(client_ip(request)),
    )
    return Category(**created)


@router.patch("/{category_id}", response_model=Category)
async def update_category(
    category_id: str, payload: CategoryIn, request: Request,
    admin: AuthUser = Depends(require_admin),
):
    before = await category_repository.get(category_id)
    if before is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found.")
    after = await category_repository.update(category_id, payload.model_dump())
    await audit_repository.record(
        admin, "category.update", target_type="category", target_id=category_id,
        before=before, after=payload.model_dump(), ip_hash=hash_ip(client_ip(request)),
    )
    return Category(**(after or before))


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: str, request: Request, admin: AuthUser = Depends(require_admin)
):
    before = await category_repository.get(category_id)
    if before is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found.")
    await category_repository.delete(category_id)
    await audit_repository.record(
        admin, "category.delete", target_type="category", target_id=category_id,
        before=before, ip_hash=hash_ip(client_ip(request)),
    )
```

`app/api/v1/admin/overview.py`:

```python
"""Admin dashboard counts. Behind require_admin."""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends

from app.core.database import get_supabase
from app.core.deps import require_admin
from app.schemas.admin import OverviewResponse
from app.schemas.auth import AuthUser

router = APIRouter(prefix="/admin/overview", tags=["Admin"])


async def _count(table: str, **filters) -> int:
    client = await get_supabase()
    query = client.table(table).select("id", count="exact")
    for column, value in filters.items():
        query = query.eq(column, value)
    response = await query.execute()
    return response.count or 0


async def _telemetry_since(hours: int) -> list[dict]:
    since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
    client = await get_supabase()
    response = await (
        client.table("request_telemetry").select("tool").gte("created_at", since).execute()
    )
    return response.data or []


@router.get("", response_model=OverviewResponse)
async def overview(_admin: AuthUser = Depends(require_admin)):
    recent = await _telemetry_since(24)
    week = await _telemetry_since(24 * 7)

    by_tool: dict[str, int] = {}
    for row in week:
        tool = row.get("tool") or "unknown"
        by_tool[tool] = by_tool.get(tool, 0) + 1

    return OverviewResponse(
        total_users=await _count("profiles"),
        admin_count=await _count("profiles", role="admin"),
        suspended_count=await _count("profiles", status="suspended"),
        requests_24h=len(recent),
        requests_7d=len(week),
        by_tool=by_tool,
    )
```

`app/api/v1/admin/__init__.py`:

```python
"""Admin routers. Every route within is behind require_admin."""

from fastapi import APIRouter

from app.api.v1.admin.categories import router as categories_router
from app.api.v1.admin.overview import router as overview_router
from app.api.v1.admin.users import router as users_router

router = APIRouter()
router.include_router(overview_router)
router.include_router(users_router)
router.include_router(categories_router)
```

- [ ] **Step 5: Register it**

In `app/api/v1/__init__.py`, add the import and `router.include_router(admin_router)`.

- [ ] **Step 6: Run the authorization tests**

```bash
cd apps/backend-api && python -m pytest tests/test_admin_auth.py -v
```

Expected: **4 passed**. If `test_admin_can_reach_admin_routes` fails, a route is broken for admins too — fix before continuing.

- [ ] **Step 7: Run the full suite**

```bash
cd apps/backend-api && python -m pytest tests/ -q
```

Expected: 56 passed, zero warnings.

- [ ] **Step 8: Commit**

```bash
git add apps/backend-api/app apps/backend-api/tests
git commit -m "feat: add admin API for users, categories and overview"
```

---

### Task 4: Admin behaviour tests

The authorization gate is covered. This task covers what the endpoints actually do.

**Files:** Create `tests/test_admin_users.py`, `tests/test_admin_categories.py`

- [ ] **Step 1: Write the user-management tests**

Reuse the token helpers from `tests/test_admin_auth.py` by importing them. Cover:

- listing returns every user with the correct total
- search filters by email substring
- filtering by `role=admin` returns only admins
- PATCH changes a user's role, and the response reflects it
- PATCH writes an `audit_log` row containing both before and after values
- an admin cannot demote themselves (400)
- an admin cannot suspend themselves (400)
- PATCH on an unknown user id returns 404
- `GET /admin/users/{id}/history` returns that user's rows, not the admin's

Each assertion must be on observable behaviour, not on a mock having been called.

- [ ] **Step 2: Write the category tests**

Cover: list, create (201 + audit row), update (audit row with before/after), delete (204 + audit row), delete of unknown id (404), and that a `slug` violating the pattern is rejected with 422.

- [ ] **Step 3: Run and confirm failures first, then implement any gaps**

If a test fails because the endpoint is wrong rather than the test, fix the endpoint. Do not weaken an assertion to match observed behaviour.

- [ ] **Step 4: Full suite**

Expected: all passing, zero warnings.

- [ ] **Step 5: Commit**

```bash
git commit -am "test: cover admin user and category management behaviour"
```

---

### Task 5: Admin theme and shell

**Files:** Create `src/admin/theme.css`, `src/admin/AdminRoute.jsx`, `src/admin/AdminLayout.jsx`, `src/admin/AdminSidebar.jsx`, `src/admin/adminApi.js`; modify `src/index.css`, `src/App.jsx`

- [ ] **Step 1: Write `src/admin/theme.css`**

Take the approved token block verbatim, with two changes: `:root` becomes `.admin-theme`, and `.dark` becomes `.dark .admin-theme, .admin-theme.dark`. Keep the `@theme inline` block as given — it registers the utility names Tailwind generates.

Import it from `src/index.css` after the existing imports.

- [ ] **Step 2: Install fonts and charts**

```bash
cd apps/web-app && npm install recharts @fontsource-variable/inter @fontsource-variable/jetbrains-mono
```

Import both fonts in `src/admin/theme.css` and apply them within `.admin-theme` only.

- [ ] **Step 3: Write `AdminRoute.jsx`**

Renders nothing while `loading`. When the visitor is not an admin — signed out or otherwise — render the app's normal not-found path rather than a 403 page, so the admin surface is not discoverable.

- [ ] **Step 4: Write `AdminLayout.jsx` and `AdminSidebar.jsx`**

`AdminLayout` wraps everything in `<div className="admin-theme ...">` so the tokens resolve, holds the dark-mode toggle, and renders `<Outlet />`. Sidebar links: Overview, Users, Categories, and a "Back to SinAi" link.

- [ ] **Step 5: Write `adminApi.js`**

Mirror `services/api.js`'s bearer-token pattern. Export `getOverview`, `listUsers`, `getUser`, `getUserHistory`, `updateUser`, `listCategories`, `createCategory`, `updateCategory`, `deleteCategory`.

- [ ] **Step 6: Register the routes in `App.jsx`**

`/admin/*` renders outside the normal sidebar shell, like the auth paths.

- [ ] **Step 7: Verify**

```bash
cd apps/web-app && npm run lint && npm run build
```

Lint must not exceed the 12 pre-existing errors. Then confirm by hand that a non-admin visiting `/admin` sees not-found, and an admin sees the shell.

- [ ] **Step 8: Commit**

---

### Task 6: Overview page

**Files:** Create `src/admin/pages/Overview.jsx`

- [ ] **Step 1: KPI cards** — total users, admins, suspended, requests 24h, requests 7d.
- [ ] **Step 2: A recharts bar chart** of `by_tool`, using `--chart-1`…`--chart-5` from the theme.
- [ ] **Step 3: Loading and error states**, matching the pattern used in `HistoryPage`.
- [ ] **Step 4: Verify** lint and build, then check the page renders with real data.
- [ ] **Step 5: Commit**

---

### Task 7: Users table and detail

**Files:** Create `src/admin/pages/Users.jsx`, `src/admin/pages/UserDetail.jsx`, `src/admin/ConfirmDialog.jsx`

- [ ] **Step 1: `ConfirmDialog.jsx`** — a shared dialog showing **current → new** and requiring explicit confirmation. Every privileged mutation goes through it.
- [ ] **Step 2: `Users.jsx`** — searchable, filterable table: email, name, role, category, status, created. Row click navigates to detail.
- [ ] **Step 3: `UserDetail.jsx`** — profile summary, role/status/category controls each behind `ConfirmDialog`, and the user's activity history.
- [ ] **Step 4: Handle the self-demotion 400** from the API with a clear inline message rather than a generic failure.
- [ ] **Step 5: Verify** lint, build, and by hand: promote a second account to admin, suspend it, confirm both actions appear in `audit_log`.
- [ ] **Step 6: Commit**

---

### Task 8: Categories CRUD

**Files:** Create `src/admin/pages/Categories.jsx`

- [ ] **Step 1: Table** of categories with name, slug, description, active, sort order.
- [ ] **Step 2: Create and edit forms**, with slug validation matching the API's `^[a-z0-9-]+$`.
- [ ] **Step 3: Delete behind `ConfirmDialog`**, stating plainly that users in the category become uncategorized rather than being deleted.
- [ ] **Step 4: Verify** lint, build, and a full create→edit→delete cycle by hand.
- [ ] **Step 5: Commit**

---

### Task 9: Category picker on the user profile

**Files:** Modify `src/components/ProfilePage.jsx`; create `GET /api/v1/categories` (non-admin, active only)

- [ ] **Step 1: Add a public categories endpoint** returning only `is_active` rows, behind `require_user`. Users need the list to choose from; they must not see inactive ones.
- [ ] **Step 2: Add the picker to `ProfilePage`**, saving via Supabase directly (RLS permits a user to update their own row; the trigger blocks `role`/`status`).
- [ ] **Step 3: Show the chosen category** in the sidebar user block.
- [ ] **Step 4: Verify** — a user can set their category; confirm they cannot change `role` through the same path.
- [ ] **Step 5: Commit**

---

### Task 10: Per-request user-scoped client (deferred from Phase 1)

The hardening the spec requires. Backend user-facing reads currently use the service-role client with an explicit `user_id` filter; this moves isolation into Postgres.

**Files:** Create `app/core/user_client.py`; modify `app/repositories/base.py` and every user-facing read path

- [ ] **Step 1: Probe the installed client surface**

```bash
cd apps/backend-api && python3 -c "
from postgrest import AsyncPostgrestClient
import inspect; print(inspect.signature(AsyncPostgrestClient.__init__))
"
```

- [ ] **Step 2: Write `user_client.py`** — a PostgREST client carrying the caller's JWT, so `user_id = auth.uid()` policies apply.
- [ ] **Step 3: Thread the caller's token** from `AuthUser` through the read paths.
- [ ] **Step 4: Prove it works** — a test using two real user JWTs against the policies, asserting a cross-user read returns empty **because Postgres refused it**, not because a filter matched.
- [ ] **Step 5: Keep the explicit filters** as defense in depth. Do not remove them.
- [ ] **Step 6: Full suite, then commit**

---

## Phase 2 Done When

- [ ] An admin signs in and reaches `/admin`; a non-admin gets not-found.
- [ ] Every admin route rejects anonymous (401) and non-admin (403) callers — enforced by a test that enumerates routes from the app.
- [ ] Admin can list, search and filter users; open one; see their history.
- [ ] Admin can change a user's role, status and category, each behind a current → new confirmation.
- [ ] An admin cannot demote or suspend themselves.
- [ ] Every privileged mutation writes an `audit_log` row with before/after.
- [ ] Admin can create, edit and delete categories; users pick theirs on the profile page.
- [ ] Backend user reads go through the RLS-enforcing client.
- [ ] Backend suite passes with zero warnings; frontend lint no worse than the 12 pre-existing errors; build clean.

## Not In Phase 2

`app_settings`, model gateway config, feature flags, global defaults (Phase 3). Telemetry rollups, retention, charts, the research-tool migration (Phase 4).
