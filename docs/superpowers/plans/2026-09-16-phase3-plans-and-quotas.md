# Admin-Controlled Plans + Enforced Quotas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded roadmap page with an admin-owned plan catalog, assign a plan to every user, and enforce per-plan daily request quotas.

**Architecture:** A `plans` table plus `profiles.plan_id`. The catalog is public; management is admin-only and audited. Quota enforcement counts from `request_telemetry` — the same source the existing anonymous rate limiter uses — and is called at the six sites that already call `enforce_anonymous_limit`.

**Tech Stack:** FastAPI, Pydantic v2, Supabase/PostgREST, pytest + pytest-asyncio, React 19.

## Global Constraints

- Implements §5 of `docs/superpowers/specs/2026-09-16-loading-profile-plans-hardening-design.md`. Read it first.
- **No billing.** No prices, no currency, no payment. D13.
- **Admins bypass quota.** `limits.requests_per_day` of `null` or `0` means unlimited. D11.
- **Quota reads fail open.** A telemetry read error must not block the request — matches `enforce_anonymous_limit`, which documents why.
- Every admin mutation writes to `audit_log` via `audit_repository.record`, exactly as `admin/settings.py` does.
- Every route in `app/api/v1/admin/` MUST carry `Depends(require_admin)`. `tests/test_admin_auth.py` enumerates registered routes to catch omissions.
- Repositories reach the client as `base.get_supabase()`, never a direct import — the test fake patches `app.repositories.base.get_supabase`.
- Day boundary is **UTC midnight**, matching `usage_daily.day`.
- `SINLLAMA_API_URL` and every secret stay env-only. Nothing here moves one into the database.
- Run `python -m pytest` from `apps/backend-api` before every commit. It must pass.

---

## File Structure

| File | Responsibility |
|---|---|
| `migrations/2026-09-16-plans.sql` | Create — `plans` table, `profiles.plan_id`, seeds, backfill. |
| `app/schemas/plan.py` | Create — `PlanLimits`, `Plan`, `PlanCreate`, `PlanUpdate`, `QuotaState`. |
| `app/repositories/plan_repository.py` | Create — CRUD over `plans`, plus `get_for_user`. |
| `app/core/plan_quota.py` | Create — `resolve_plan`, `enforce_plan_quota`, `quota_state`. |
| `app/repositories/telemetry_repository.py` | Modify — add `count_recent_by_user`. |
| `app/api/v1/plans.py` | Create — public catalog + `/plans/me`. |
| `app/api/v1/admin/plans.py` | Create — admin CRUD + user assignment. |
| `app/api/v1/{grammar,headline,style,summarizer,optimize}.py` | Modify — six `enforce_plan_quota` calls. |
| `app/api/v1/auth.py` | Modify — `_create_profile` assigns the default plan. |
| `apps/web-app/src/components/Plans.jsx` | Modify — render from the API. |
| `apps/web-app/src/admin/pages/Plans.jsx` | Create — admin management UI. |

---

## Task 1: Migration

**Files:**
- Create: `apps/backend-api/migrations/2026-09-16-plans.sql`

**Interfaces:**
- Produces: table `plans`; column `profiles.plan_id`; three seeded rows (`free`, `plus`, `pro`) with `free.is_default = true`.

- [ ] **Step 1: Write the migration**

```sql
-- Admin-owned plan catalog + per-user assignment.
--
-- Plan copy used to live in apps/web-app/src/components/Plans.jsx, which
-- meant changing a tier needed a frontend deploy. It is data now.
--
-- Deliberately no price/currency column: there is no billing integration,
-- and a price that cannot be charged is worse than no price at all.

create table if not exists plans (
    id          uuid primary key default gen_random_uuid(),
    slug        text not null unique,
    name        text not null,
    description text not null default '',
    badge       text,
    features    jsonb not null default '[]'::jsonb,
    limits      jsonb not null default '{}'::jsonb,
    sort_order  integer not null default 0,
    is_default  boolean not null default false,
    is_visible  boolean not null default true,
    archived_at timestamptz,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

-- Exactly one default, enforced by the database rather than by application
-- code a second writer can race.
create unique index if not exists idx_plans_single_default
    on plans (is_default) where is_default;

create index if not exists idx_plans_sort on plans (sort_order, created_at);

alter table plans enable row level security;
-- No policy: service-role only, matching app_settings and audit_log.

alter table profiles add column if not exists plan_id uuid
    references plans(id) on delete set null;
create index if not exists idx_profiles_plan on profiles (plan_id);

-- Seed from the copy previously hardcoded in Plans.jsx.
insert into plans (slug, name, description, badge, features, limits, sort_order, is_default)
values
  ('free', 'Free',
   'For individuals exploring AI writing tools.', null,
   '["Basic grammar checking","Standard tone rewriting","Up to 10 headlines/day","Short summaries","Community support"]'::jsonb,
   '{"requests_per_day": 50}'::jsonb,
   0, true),
  ('plus', 'Plus',
   'For professionals needing advanced capabilities.', 'Planned',
   '["Everything in Free","Advanced grammar & style","Unlimited headlines","Long-form summaries","Priority email support","Early access to new features"]'::jsonb,
   '{"requests_per_day": 500}'::jsonb,
   1, false),
  ('pro', 'Pro',
   'For newsrooms and power users requiring max performance.', null,
   '["Everything in Plus","Custom style tones","API access","Team collaboration","Dedicated account manager","24/7 phone support"]'::jsonb,
   '{"requests_per_day": null}'::jsonb,
   2, false)
on conflict (slug) do nothing;

-- Every existing profile gets the default plan, so the quota lookup has one
-- shape and no null branch to get wrong.
update profiles
   set plan_id = (select id from plans where is_default limit 1)
 where plan_id is null;
```

- [ ] **Step 2: Check it parses**

```bash
cd apps/backend-api && python -c "
import re, pathlib
sql = pathlib.Path('migrations/2026-09-16-plans.sql').read_text()
assert sql.count('(') == sql.count(')'), 'unbalanced parens'
assert 'idx_plans_single_default' in sql
print('statements:', len([s for s in sql.split(';') if s.strip()]))
"
```

Expected: `statements: 9` or similar, no assertion error.

- [ ] **Step 3: Commit**

```bash
git add apps/backend-api/migrations/2026-09-16-plans.sql
git commit -m "feat(db): plans catalog and per-user plan assignment"
```

---

## Task 2: Schemas

**Files:**
- Create: `apps/backend-api/app/schemas/plan.py`
- Test: `apps/backend-api/tests/test_plans.py`

**Interfaces:**
- Produces:
  - `TOOL_NAMES: tuple[str, ...]` = `("grammar", "headlines", "rewriter", "summarizer", "optimize")`
  - `PlanLimits(requests_per_day: int|None, tools: list[str]|None, max_headline_count: int|None)` — `extra="forbid"`.
  - `Plan`, `PlanCreate`, `PlanUpdate`, `QuotaState(used, limit, resets_at, plan_slug, plan_name)`.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_plans.py
import pytest
from pydantic import ValidationError

from app.schemas.plan import PlanLimits


def test_limits_reject_unknown_keys():
    """An admin cannot store a shape the enforcement path will later trip on."""
    with pytest.raises(ValidationError):
        PlanLimits(requests_per_dayy=50)


def test_limits_reject_unknown_tool():
    with pytest.raises(ValidationError):
        PlanLimits(tools=["grammar", "telepathy"])


def test_limits_reject_headline_count_above_registry_max():
    with pytest.raises(ValidationError):
        PlanLimits(max_headline_count=11)


def test_limits_all_optional():
    limits = PlanLimits()
    assert limits.requests_per_day is None
    assert limits.tools is None
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd apps/backend-api && python -m pytest tests/test_plans.py -q
```

Expected: FAIL, `ModuleNotFoundError: No module named 'app.schemas.plan'`.

- [ ] **Step 3: Write `app/schemas/plan.py`**

```python
"""
Plan catalog schemas.

`PlanLimits` is the security boundary for the one free-form column in this
feature. `plans.limits` is jsonb, so without a strict model an admin typo
("requests_per_dayy") would store silently and the quota would read as
unlimited forever. extra="forbid" turns that into a 400 at write time.
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

# The tool names passed to enforce_plan_quota. Kept here rather than imported
# from the routers to avoid a cycle; tests/test_plan_quota.py asserts the two
# stay in step.
TOOL_NAMES: tuple[str, ...] = ("grammar", "headlines", "rewriter", "summarizer", "optimize")

# Matches settings_registry's defaults.headline_count bound.
MAX_HEADLINE_COUNT = 10


class PlanLimits(BaseModel):
    """What a plan permits. Every field optional; omitted means unconstrained."""

    model_config = ConfigDict(extra="forbid")

    # None or 0 means unlimited — see D11 in the design doc.
    requests_per_day: int | None = Field(default=None, ge=0)
    tools: list[str] | None = None
    max_headline_count: int | None = Field(default=None, ge=1, le=MAX_HEADLINE_COUNT)

    @field_validator("tools")
    @classmethod
    def _known_tools(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        unknown = sorted(set(value) - set(TOOL_NAMES))
        if unknown:
            raise ValueError(
                f"unknown tool(s): {', '.join(unknown)}. "
                f"Valid: {', '.join(TOOL_NAMES)}"
            )
        return value

    @property
    def is_unlimited(self) -> bool:
        return not self.requests_per_day


class PlanBase(BaseModel):
    slug: str = Field(pattern=r"^[a-z0-9-]{1,40}$")
    name: str = Field(min_length=1, max_length=60)
    description: str = ""
    badge: str | None = Field(default=None, max_length=24)
    features: list[str] = Field(default_factory=list)
    limits: PlanLimits = Field(default_factory=PlanLimits)
    sort_order: int = 0
    is_visible: bool = True


class PlanCreate(PlanBase):
    is_default: bool = False


class PlanUpdate(BaseModel):
    """Every field optional — a PATCH changes only what it names."""

    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=60)
    description: str | None = None
    badge: str | None = Field(default=None, max_length=24)
    features: list[str] | None = None
    limits: PlanLimits | None = None
    sort_order: int | None = None
    is_visible: bool | None = None
    is_default: bool | None = None


class Plan(PlanBase):
    id: str
    is_default: bool = False
    archived_at: datetime | None = None


class QuotaState(BaseModel):
    """What the client needs to explain a 429, or show usage before one."""

    used: int
    limit: int | None
    resets_at: datetime
    plan_slug: str
    plan_name: str
```

- [ ] **Step 4: Run the tests**

```bash
cd apps/backend-api && python -m pytest tests/test_plans.py -q
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add apps/backend-api/app/schemas/plan.py apps/backend-api/tests/test_plans.py
git commit -m "feat: plan schemas with strict limits validation"
```

---

## Task 3: Repository + telemetry count

**Files:**
- Create: `apps/backend-api/app/repositories/plan_repository.py`
- Modify: `apps/backend-api/app/repositories/telemetry_repository.py`

**Interfaces:**
- Produces:
  - `plan_repository.list_all(*, visible_only=False, include_archived=False) -> list[dict]`
  - `plan_repository.get(plan_id) -> dict | None`
  - `plan_repository.get_default() -> dict | None`
  - `plan_repository.create(data) -> dict`
  - `plan_repository.update(plan_id, data) -> dict | None`
  - `plan_repository.clear_default(except_id=None) -> None`
  - `plan_repository.archive(plan_id) -> dict | None`
  - `telemetry_repository.count_recent_by_user(user_id, since_iso) -> int`

- [ ] **Step 1: Add `count_recent_by_user`**

Mirrors `count_recent_by_ip` exactly, including the `base.get_supabase()` note.

```python
async def count_recent_by_user(user_id: str, since_iso: str) -> int:
    """
    How many requests this user made at or after `since_iso`.

    Counterpart to count_recent_by_ip, used for per-plan daily quotas. Same
    reason for resolving the client through `base`: the test fake patches
    app.repositories.base.get_supabase.
    """
    client = await base.get_supabase()
    response = await (
        client.table(TABLE)
        .select("id", count="exact")
        .eq("user_id", user_id)
        .gte("created_at", since_iso)
        .execute()
    )
    return response.count or 0
```

- [ ] **Step 2: Write `plan_repository.py`**

Follow `category_repository.py`: module docstring explaining service-role access, `TABLE = "plans"`, functions reaching the client via `base.get_supabase()`.

```python
"""
Data access for the plan catalog.

Writes are admin-only and go through the service-role client. The public
catalog read filters to visible, unarchived plans — a user must not be shown
a tier an admin has hidden or retired.

See audit_repository's module docstring for why the client is reached as
`base.get_supabase()` rather than imported directly.
"""

from typing import Any

from app.repositories import base

TABLE = "plans"


async def list_all(*, visible_only: bool = False, include_archived: bool = False) -> list[dict[str, Any]]:
    client = await base.get_supabase()
    query = client.table(TABLE).select("*")
    if visible_only:
        query = query.eq("is_visible", True)
    if not include_archived:
        query = query.is_("archived_at", "null")
    response = await query.order("sort_order", desc=False).execute()
    return response.data or []


async def get(plan_id: str) -> dict[str, Any] | None:
    return await base.fetch_by_id(TABLE, plan_id)


async def get_default() -> dict[str, Any] | None:
    client = await base.get_supabase()
    response = await client.table(TABLE).select("*").eq("is_default", True).execute()
    rows = response.data or []
    return rows[0] if rows else None


async def get_by_slug(slug: str) -> dict[str, Any] | None:
    client = await base.get_supabase()
    response = await client.table(TABLE).select("*").eq("slug", slug).execute()
    rows = response.data or []
    return rows[0] if rows else None


async def create(data: dict[str, Any]) -> dict[str, Any]:
    return await base.insert_record(TABLE, data)


async def update(plan_id: str, data: dict[str, Any]) -> dict[str, Any] | None:
    client = await base.get_supabase()
    response = await client.table(TABLE).update(data).eq("id", plan_id).execute()
    return response.data[0] if response.data else None


async def clear_default(except_id: str | None = None) -> None:
    """
    Unset is_default everywhere else.

    The partial unique index makes two defaults impossible, so promoting a
    plan has to demote the incumbent first rather than relying on the write
    to fail.
    """
    client = await base.get_supabase()
    query = client.table(TABLE).update({"is_default": False}).eq("is_default", True)
    if except_id:
        query = query.neq("id", except_id)
    await query.execute()


async def archive(plan_id: str) -> dict[str, Any] | None:
    """Soft delete. profiles.plan_id is ON DELETE SET NULL, but a hard delete
    would silently strip the plan from every user on it; archiving keeps the
    assignment readable while hiding the tier from the catalog."""
    from datetime import datetime, timezone
    return await update(plan_id, {"archived_at": datetime.now(timezone.utc).isoformat()})
```

- [ ] **Step 3: Run the suite for regressions**

```bash
cd apps/backend-api && python -m pytest -q
```

Expected: all existing tests still pass.

- [ ] **Step 4: Commit**

```bash
git add apps/backend-api/app/repositories/
git commit -m "feat: plan repository and per-user telemetry count"
```

---

## Task 4: Quota enforcement

**Files:**
- Create: `apps/backend-api/app/core/plan_quota.py`
- Test: `apps/backend-api/tests/test_plan_quota.py`

**Interfaces:**
- Consumes: `plan_repository`, `telemetry_repository.count_recent_by_user`, `PlanLimits`.
- Produces:
  - `async resolve_plan(user) -> tuple[dict | None, PlanLimits]`
  - `async quota_state(user) -> QuotaState | None`
  - `async enforce_plan_quota(request, user, tool) -> None`
  - `def day_start_utc() -> datetime`

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_plan_quota.py
import pytest
from fastapi import HTTPException

from app.core import plan_quota
from app.schemas.auth import AuthUser
from app.schemas.plan import TOOL_NAMES


def _user(role="user", user_id="u-1"):
    return AuthUser(id=user_id, email="a@b.c", role=role, status="active", token="t")


@pytest.mark.asyncio
async def test_admin_bypasses_quota(monkeypatch):
    """An admin locked out by a quota they set cannot fix it."""
    async def _boom(*a, **k):
        raise AssertionError("must not look up a plan for an admin")
    monkeypatch.setattr(plan_quota, "resolve_plan", _boom)
    await plan_quota.enforce_plan_quota(None, _user(role="admin"), "grammar")


@pytest.mark.asyncio
async def test_anonymous_is_not_checked(monkeypatch):
    """Anonymous traffic is already capped by enforce_anonymous_limit."""
    async def _boom(*a, **k):
        raise AssertionError("must not look up a plan for an anonymous caller")
    monkeypatch.setattr(plan_quota, "resolve_plan", _boom)
    await plan_quota.enforce_plan_quota(None, None, "grammar")


@pytest.mark.asyncio
async def test_under_limit_passes(monkeypatch):
    monkeypatch.setattr(plan_quota, "_count_today", _fake_count(10))
    monkeypatch.setattr(plan_quota, "resolve_plan", _fake_plan({"requests_per_day": 50}))
    await plan_quota.enforce_plan_quota(None, _user(), "grammar")


@pytest.mark.asyncio
async def test_at_limit_raises_429_with_quota_payload(monkeypatch):
    monkeypatch.setattr(plan_quota, "_count_today", _fake_count(50))
    monkeypatch.setattr(plan_quota, "resolve_plan", _fake_plan({"requests_per_day": 50}))
    with pytest.raises(HTTPException) as excinfo:
        await plan_quota.enforce_plan_quota(None, _user(), "grammar")
    assert excinfo.value.status_code == 429
    assert excinfo.value.detail["quota"]["used"] == 50
    assert excinfo.value.detail["quota"]["limit"] == 50
    assert "resets_at" in excinfo.value.detail["quota"]


@pytest.mark.asyncio
@pytest.mark.parametrize("limit", [None, 0])
async def test_null_and_zero_are_unlimited(monkeypatch, limit):
    monkeypatch.setattr(plan_quota, "_count_today", _fake_count(10_000))
    monkeypatch.setattr(plan_quota, "resolve_plan", _fake_plan({"requests_per_day": limit}))
    await plan_quota.enforce_plan_quota(None, _user(), "grammar")


@pytest.mark.asyncio
async def test_tool_not_in_plan_raises_403(monkeypatch):
    monkeypatch.setattr(plan_quota, "_count_today", _fake_count(0))
    monkeypatch.setattr(plan_quota, "resolve_plan", _fake_plan({"tools": ["grammar"]}))
    with pytest.raises(HTTPException) as excinfo:
        await plan_quota.enforce_plan_quota(None, _user(), "summarizer")
    assert excinfo.value.status_code == 403


@pytest.mark.asyncio
async def test_telemetry_failure_fails_open(monkeypatch):
    """A storage blip must not become an outage — matches the anonymous path."""
    async def _explode(*a, **k):
        raise RuntimeError("telemetry down")
    monkeypatch.setattr(plan_quota, "_count_today", _explode)
    monkeypatch.setattr(plan_quota, "resolve_plan", _fake_plan({"requests_per_day": 1}))
    await plan_quota.enforce_plan_quota(None, _user(), "grammar")


def test_tool_names_match_the_call_sites():
    """Guards the one thing a grep cannot: the names passed at each call site."""
    from app.api.v1 import grammar, headline, optimize, style, summarizer  # noqa: F401
    assert set(TOOL_NAMES) == {"grammar", "headlines", "rewriter", "summarizer", "optimize"}
```

Helpers at the top of the file:

```python
def _fake_count(n):
    async def _count(user_id, since_iso):
        return n
    return _count


def _fake_plan(limits_dict):
    from app.schemas.plan import PlanLimits
    async def _resolve(user):
        return {"slug": "free", "name": "Free"}, PlanLimits(**limits_dict)
    return _resolve
```

- [ ] **Step 2: Run to verify failure**

```bash
cd apps/backend-api && python -m pytest tests/test_plan_quota.py -q
```

Expected: FAIL, `ModuleNotFoundError: No module named 'app.core.plan_quota'`.

- [ ] **Step 3: Write `app/core/plan_quota.py`**

```python
"""
Per-plan daily quota enforcement for signed-in callers.

Counterpart to rate_limit.py, which caps anonymous traffic per IP. The two
are deliberately separate: anonymous callers are capped because they are
unattributable and reach GPU inference; signed-in callers are capped by
whatever tier an admin put them on.

Counting comes from request_telemetry rather than a dedicated counter, for
the same reason rate_limit.py does it: the count stays correct across
multiple server instances, which an in-memory counter would not.

Fails open. A telemetry read that errors allows the request — a storage blip
must not lock out every signed-in user, which is strictly worse than briefly
not enforcing a limit.
"""

import logging
from datetime import datetime, time, timedelta, timezone

from fastapi import HTTPException, status

from app.repositories import plan_repository
from app.repositories.telemetry_repository import count_recent_by_user
from app.schemas.auth import AuthUser
from app.schemas.plan import PlanLimits, QuotaState

logger = logging.getLogger(__name__)


def day_start_utc() -> datetime:
    """Midnight UTC today — the window the daily quota counts over."""
    return datetime.combine(datetime.now(timezone.utc).date(), time.min, tzinfo=timezone.utc)


def next_reset_utc() -> datetime:
    return day_start_utc() + timedelta(days=1)


async def _count_today(user_id: str, since_iso: str) -> int:
    """Seam for tests; production delegates straight to telemetry."""
    return await count_recent_by_user(user_id, since_iso)


async def resolve_plan(user: AuthUser) -> tuple[dict | None, PlanLimits]:
    """
    The caller's plan and its parsed limits.

    Order: the user's own plan, then the default plan, then unlimited. A
    profile whose plan was archived or deleted falls through to the default
    rather than being denied.
    """
    plan = None
    plan_id = getattr(user, "plan_id", None)
    if plan_id:
        plan = await plan_repository.get(plan_id)
    if plan is None:
        plan = await plan_repository.get_default()
    if plan is None:
        return None, PlanLimits()
    try:
        limits = PlanLimits(**(plan.get("limits") or {}))
    except Exception:
        # A row written before validation existed, or hand-edited in the SQL
        # console. Treat as unlimited and say so, rather than denying.
        logger.exception("Plan %s has unreadable limits — treating as unlimited", plan.get("slug"))
        limits = PlanLimits()
    return plan, limits


async def quota_state(user: AuthUser) -> QuotaState | None:
    """Current usage for the signed-in caller, for GET /plans/me."""
    plan, limits = await resolve_plan(user)
    if plan is None:
        return None
    try:
        used = await _count_today(user.id, day_start_utc().isoformat())
    except Exception:
        logger.exception("Quota count failed — reporting 0 used")
        used = 0
    return QuotaState(
        used=used,
        limit=None if limits.is_unlimited else limits.requests_per_day,
        resets_at=next_reset_utc(),
        plan_slug=plan.get("slug", ""),
        plan_name=plan.get("name", ""),
    )


async def enforce_plan_quota(request, user: AuthUser | None, tool: str) -> None:
    """
    Raise 429 when the caller is out of daily requests, 403 when their plan
    does not include this tool.

    Anonymous callers are skipped — enforce_anonymous_limit already covers
    them. Admins are skipped outright: an admin locked out by a quota they
    configured has no way to undo it.
    """
    if user is None or user.is_admin:
        return

    plan, limits = await resolve_plan(user)
    if plan is None:
        return

    if limits.tools is not None and tool not in limits.tools:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "detail": f"The {plan.get('name', 'current')} plan does not include this tool.",
                "reason": "tool_not_in_plan",
                "plan_slug": plan.get("slug", ""),
            },
        )

    if limits.is_unlimited:
        return

    try:
        used = await _count_today(user.id, day_start_utc().isoformat())
    except Exception:
        logger.exception("Quota lookup failed — allowing the request")
        return

    if used >= limits.requests_per_day:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "detail": f"Daily limit reached for the {plan.get('name', 'current')} plan.",
                "reason": "quota_exceeded",
                "quota": {
                    "used": used,
                    "limit": limits.requests_per_day,
                    "resets_at": next_reset_utc().isoformat(),
                    "plan_slug": plan.get("slug", ""),
                    "plan_name": plan.get("name", ""),
                },
            },
        )
```

- [ ] **Step 4: Run the tests**

```bash
cd apps/backend-api && python -m pytest tests/test_plan_quota.py -q
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add apps/backend-api/app/core/plan_quota.py apps/backend-api/tests/test_plan_quota.py
git commit -m "feat: per-plan daily quota enforcement"
```

---

## Task 5: Wire the six call sites + signup default

**Files:**
- Modify: `app/api/v1/grammar.py:68`, `headline.py:50`, `headline.py:122`, `style.py:40`, `summarizer.py:43`, `optimize.py:76`
- Modify: `app/api/v1/auth.py` (`_create_profile`)
- Modify: `app/schemas/auth.py` (`AuthUser.plan_id`)
- Modify: `app/core/deps.py` (populate `plan_id`)

- [ ] **Step 1: Add `plan_id` to `AuthUser`**

```python
    plan_id: str | None = None
```

- [ ] **Step 2: Populate it in `deps._resolve`**

```python
        plan_id=profile.get("plan_id"),
```

- [ ] **Step 3: Add the enforcement call at each site**

Immediately after the existing `await enforce_anonymous_limit(request, user)`:

```python
    await enforce_plan_quota(request, user, "grammar")
```

with the tool name per the table in the design doc §5.4. Import at the top of each file:

```python
from app.core.plan_quota import enforce_plan_quota
```

`optimize.py` passes `"optimize"` and its internal stages do NOT re-check — one user action is charged once.

- [ ] **Step 4: Assign the default plan on signup**

In `auth.py::_create_profile`, before the insert:

```python
    # Resolve the default tier here rather than in the schema.sql trigger:
    # handle_new_user() fires on auth.users and is a leftover from the
    # Supabase-Auth era, not the current signup path.
    default_plan = await plan_repository.get_default()
    if default_plan:
        record["plan_id"] = default_plan["id"]
```

- [ ] **Step 5: Run the whole suite**

```bash
cd apps/backend-api && python -m pytest -q
```

Expected: all pass, including `test_admin_auth.py` and `test_endpoint_coverage.py`.

- [ ] **Step 6: Commit**

```bash
git add apps/backend-api/app
git commit -m "feat: enforce plan quota at the six tool entry points"
```

---

## Task 6: Public + admin API

**Files:**
- Create: `app/api/v1/plans.py`, `app/api/v1/admin/plans.py`
- Modify: `app/api/v1/__init__.py`, `app/api/v1/admin/__init__.py`

**Interfaces:** the seven routes from design §5.3.

- [ ] **Step 1: Write the public router**

`GET /api/v1/plans` → `list_all(visible_only=True)`. Public: `/plans` must render signed-out.
`GET /api/v1/plans/me` → `require_user`, returns `quota_state(user)`.

- [ ] **Step 2: Write the admin router**

Every route carries `Depends(require_admin)`. Every mutation calls `audit_repository.record(...)` with `before`/`after`, exactly as `admin/settings.py` does.

`DELETE` archives and **refuses the default plan** with 400 — archiving the default leaves new signups with nothing to resolve to.
Promoting a plan to default calls `clear_default(except_id=...)` first.

- [ ] **Step 3: Register both routers**

- [ ] **Step 4: Extend `tests/test_plans.py`** with catalog CRUD, the single-default rule, and archive-refuses-default.

- [ ] **Step 5: Run the suite and commit**

```bash
cd apps/backend-api && python -m pytest -q
git add apps/backend-api
git commit -m "feat: public plan catalog and admin plan management API"
```

---

## Task 7: Frontend

**Files:**
- Modify: `apps/web-app/src/components/Plans.jsx`, `src/services/api.js`
- Create: `apps/web-app/src/admin/pages/Plans.jsx`
- Modify: `apps/web-app/src/App.jsx` (admin route), `src/admin/AdminSidebar.jsx`

- [ ] **Step 1:** `api.js` — `getPlans()`, `getMyPlan()`, admin CRUD calls, and surface the 429 `quota` payload on thrown errors.
- [ ] **Step 2:** `Plans.jsx` — fetch the catalog, delete the hardcoded `PLANS` array, badge the user's current tier, show usage from `/plans/me`. Icons map from `slug` with a neutral fallback, since an admin can create a slug the map does not know.
- [ ] **Step 3:** `admin/pages/Plans.jsx` — list, create, edit, archive, reorder, set default.
- [ ] **Step 4:** Register `/admin/plans` (lazy, per Phase 1) and add the sidebar entry.
- [ ] **Step 5:** `npm run lint && npm run build && npm run check:size`, verify in the browser, commit.

---

## Self-Review Notes

**Spec coverage.** §5.1 → Task 1. §5.2 → Task 2. §5.3 → Task 6. §5.4 → Tasks 3, 4, 5. §5.5 → Task 7. §5.6 → Tasks 2, 4, 6.

**Deliberate.** `_count_today` exists purely as a monkeypatch seam — quota logic is worth testing without a fake database, and the alternative is asserting on PostgREST call shapes. `resolve_plan` returning `(plan, limits)` rather than just limits is what lets the 429 name the plan, which is the difference between a useful error and a wall.

**Migration is not run by this plan.** It is written and committed; applying it to Supabase is the operator's call.
