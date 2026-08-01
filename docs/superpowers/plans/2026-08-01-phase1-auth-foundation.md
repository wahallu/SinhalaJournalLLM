# Phase 1 — Auth & Data Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Supabase Auth to SinAi so users can sign up, log in, and get persistent per-user history enforced by Postgres RLS — while the four writing tools keep working for anonymous visitors.

**Architecture:** The React app authenticates directly against Supabase Auth (GoTrue) via `supabase-js` and sends the resulting JWT as a bearer token to FastAPI. FastAPI verifies the JWT locally (no network round-trip), resolves the caller's `profiles` row, and exposes three dependencies — `require_user`, `optional_user`, `require_admin`. User history reads/writes go through a PostgREST client that carries the caller's JWT so Row Level Security applies; admin and telemetry paths keep the existing service-role client.

**Tech Stack:** FastAPI, pydantic-settings, PyJWT, supabase-py, Postgres/Supabase (RLS, triggers), React 19, Vite, react-router-dom v7, `@supabase/supabase-js`, pytest + pytest-asyncio.

## Global Constraints

- Backend Python style: module-level docstring explaining *why*, type hints on all signatures, `snake_case`. Match the existing tone in `app/core/model_gateway.py`.
- Frontend is **JavaScript + JSX, not TypeScript**. Do not introduce `.ts`/`.tsx` files.
- All schema DDL goes in `apps/backend-api/schema.sql` and must be **idempotent** (`if not exists` / `or replace`) — the file is re-run wholesale.
- Tests run offline. No test may require network, a real Supabase project, or a GPU. The `fake_supabase` autouse fixture in `tests/conftest.py` already enforces this.
- The four tool endpoints (`/grammar/check`, `/headlines/generate`, `/rewrite`, `/summarize`) **must keep returning 200 with no `Authorization` header** — `apps/chrome-extension` and `apps/docs-addon` depend on this.
- Never log or return a raw JWT, a raw IP address, or the service-role key.
- Secrets live in `.env` only. Never a literal default in `config.py`.
- Existing history rows have `user_id IS NULL` and must remain readable by admins, invisible to users.
- Commit after every task. Conventional-commit prefixes (`feat:`, `test:`, `chore:`, `docs:`).

**Run commands** (from `apps/backend-api`):
- Tests: `python -m pytest tests/ -v`
- Server: `uvicorn app.main:app --reload --port 8001`

**Run commands** (from `apps/web-app`):
- Dev: `npm run dev`
- Lint: `npm run lint`

---

## File Structure

**Backend — create:**

| File | Responsibility |
|---|---|
| `app/core/auth.py` | JWT decode + signature verification. Pure functions, no FastAPI. |
| `app/core/deps.py` | FastAPI dependencies: `require_user`, `optional_user`, `require_admin`. |
| `app/core/rate_limit.py` | Anonymous IP rate limiting + IP hashing. |
| `app/repositories/profile_repository.py` | `profiles` reads/writes. |
| `app/repositories/telemetry_repository.py` | `request_telemetry` writes + counts. |
| `app/schemas/auth.py` | `AuthUser` model passed around by dependencies. |
| `tests/test_auth.py` | JWT verification unit tests. |
| `tests/test_deps.py` | Dependency behaviour tests. |
| `tests/test_user_scoping.py` | History isolation + 401 tests. |
| `tests/test_rate_limit.py` | Anonymous limit boundary tests. |
| `scripts/seed_admin.sql` | One-off first-admin promotion. |

**Backend — modify:** `schema.sql`, `config.py`, `requirements.txt`, `.env.example`, `repositories/base.py`, the four tool routers, the four repositories, `api/v1/meta.py`.

**Frontend — create:**

| File | Responsibility |
|---|---|
| `src/auth/supabaseClient.js` | Configured `supabase-js` singleton. |
| `src/auth/AuthProvider.jsx` | Session context + `useAuth()`. |
| `src/auth/ProtectedRoute.jsx` | Redirects unauthenticated users to `/login`. |
| `src/pages/auth/Login.jsx` | Email/password sign-in. |
| `src/pages/auth/Signup.jsx` | Registration. |
| `src/pages/auth/ForgotPassword.jsx` | Reset request. |
| `src/pages/auth/ResetPassword.jsx` | New-password form. |
| `src/pages/auth/VerifyEmail.jsx` | Post-signup notice. |
| `src/pages/auth/AuthLayout.jsx` | Shared centered card shell for the five pages. |

**Frontend — modify:** `main.jsx`, `App.jsx`, `services/api.js`, `components/HistoryPage.jsx`, `components/Sidebar.jsx`, `package.json`.
**Frontend — delete:** `src/lib/history.js`.

---

### Task 1: Environment and dependencies

**Files:**
- Modify: `apps/backend-api/requirements.txt`

- [ ] **Step 1: Create a virtualenv and install**

The package set is not currently installed in this checkout.

```bash
cd apps/backend-api
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

- [ ] **Step 2: Confirm the existing suite passes before you change anything**

```bash
python -m pytest tests/ -v
```

Expected: all pass. If anything already fails, fix or record that first — you need a clean baseline to attribute later failures to your own changes.

- [ ] **Step 3: Pin PyJWT**

Add to `requirements.txt`:

```
PyJWT[crypto]>=2.8.0
```

- [ ] **Step 4: Install and verify the import**

```bash
pip install -r requirements.txt
python3 -c "import jwt; from jwt import PyJWKClient; print('PyJWT', jwt.__version__)"
```

Expected: a version ≥ 2.8.0 printed, no ImportError.

- [ ] **Step 5: Commit**

```bash
git add requirements.txt
git commit -m "chore: pin PyJWT for Supabase JWT verification"
```

---

### Task 2: Database schema — identity, telemetry, RLS

**Files:**
- Modify: `apps/backend-api/schema.sql`
- Create: `apps/backend-api/scripts/seed_admin.sql`

**Interfaces:**
- Produces: tables `profiles`, `user_categories`, `request_telemetry`; `user_id` column on the four history tables. Later tasks read `profiles.role`, `profiles.status`, and write `request_telemetry`.

- [ ] **Step 1: Append the identity tables to `schema.sql`**

```sql
-- ── User categories (Student, Journalist, …) ──
create table if not exists user_categories (
    id          uuid primary key default gen_random_uuid(),
    name        text not null,
    slug        text not null unique,
    description text,
    is_active   boolean not null default true,
    sort_order  integer not null default 0,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

-- ── Profiles — one row per auth.users row ──
create table if not exists profiles (
    id           uuid primary key references auth.users(id) on delete cascade,
    email        text not null,
    full_name    text,
    role         text not null default 'user'   check (role in ('user','admin')),
    status       text not null default 'active' check (status in ('active','suspended')),
    category_id  uuid references user_categories(id) on delete set null,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now(),
    last_seen_at timestamptz
);

create index if not exists idx_profiles_role     on profiles (role);
create index if not exists idx_profiles_category on profiles (category_id);
```

- [ ] **Step 2: Append the profile-creation trigger**

```sql
-- Every auth.users insert gets a matching profiles row, so a profile
-- can never be missing for a valid session.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (id, email, full_name)
    values (
        new.id,
        new.email,
        coalesce(new.raw_user_meta_data->>'full_name', '')
    )
    on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();
```

- [ ] **Step 3: Append the privilege-escalation guard**

This is load-bearing. Without it a user can `PATCH /profiles?id=eq.<self>` through PostgREST with their own anon-key session and set `role='admin'`.

```sql
-- role and status may only be changed by the service role. A normal
-- authenticated session editing its own profile cannot self-promote.
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if current_setting('request.jwt.claims', true) is not null
       and coalesce(current_setting('request.jwt.claims', true)::jsonb->>'role', '') <> 'service_role'
    then
        if new.role is distinct from old.role then
            raise exception 'role may only be changed by an administrator';
        end if;
        if new.status is distinct from old.status then
            raise exception 'status may only be changed by an administrator';
        end if;
    end if;
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists on_profile_update on profiles;
create trigger on_profile_update
    before update on profiles
    for each row execute function public.guard_profile_privileges();
```

- [ ] **Step 4: Append the telemetry table**

Lands in Phase 1 because anonymous rate limiting counts from it. Phase 4 adds rollups and retention.

```sql
create table if not exists request_telemetry (
    id            uuid primary key default gen_random_uuid(),
    user_id       uuid references auth.users(id) on delete set null,
    endpoint      text not null,
    method        text not null default 'POST',
    tool          text,
    status_code   integer not null,
    latency_ms    integer,
    provider      text,
    input_tokens  integer,
    output_tokens integer,
    error_code    text,
    ip_hash       text,
    created_at    timestamptz not null default now()
);

create index if not exists idx_telemetry_created  on request_telemetry (created_at desc);
create index if not exists idx_telemetry_user     on request_telemetry (user_id, created_at desc);
create index if not exists idx_telemetry_ip       on request_telemetry (ip_hash, created_at desc);
```

- [ ] **Step 5: Append the `user_id` columns on the four history tables**

```sql
alter table grammar_corrections  add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table headline_generations add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table style_rewrites       add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table summaries            add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists idx_grammar_user   on grammar_corrections  (user_id, created_at desc);
create index if not exists idx_headline_user  on headline_generations (user_id, created_at desc);
create index if not exists idx_style_user     on style_rewrites       (user_id, created_at desc);
create index if not exists idx_summaries_user on summaries            (user_id, created_at desc);
```

- [ ] **Step 6: Append the RLS policies**

Policies deliberately say nothing about admins — admin access uses the service-role client, which bypasses RLS. This avoids the recursion trap where a `profiles` policy must read `profiles`.

```sql
alter table grammar_corrections  enable row level security;
alter table headline_generations enable row level security;
alter table style_rewrites       enable row level security;
alter table summaries            enable row level security;
alter table profiles             enable row level security;
alter table user_categories      enable row level security;
alter table request_telemetry    enable row level security;

drop policy if exists own_grammar   on grammar_corrections;
drop policy if exists own_headlines on headline_generations;
drop policy if exists own_styles    on style_rewrites;
drop policy if exists own_summaries on summaries;

create policy own_grammar   on grammar_corrections  for all to authenticated
    using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_headlines on headline_generations for all to authenticated
    using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_styles    on style_rewrites       for all to authenticated
    using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_summaries on summaries            for all to authenticated
    using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists own_profile      on profiles;
drop policy if exists read_categories  on user_categories;

create policy own_profile     on profiles        for select to authenticated using (id = auth.uid());
create policy own_profile_upd on profiles        for update to authenticated using (id = auth.uid());
create policy read_categories on user_categories for select to authenticated using (is_active);

-- request_telemetry: no policy at all => authenticated and anon are denied
-- everything. Only the service role touches it.
```

- [ ] **Step 7: Seed the default categories**

```sql
insert into user_categories (name, slug, description, sort_order) values
    ('Journalist', 'journalist', 'Working newsroom journalist',        1),
    ('Student',    'student',    'Journalism or media student',        2),
    ('Editor',     'editor',     'Desk editor or sub-editor',          3),
    ('Researcher', 'researcher', 'Academic or language researcher',    4),
    ('Other',      'other',      'Everyone else',                      99)
on conflict (slug) do nothing;
```

- [ ] **Step 8: Write the first-admin seed script**

Create `apps/backend-api/scripts/seed_admin.sql`:

```sql
-- One-off: promote a registered account to admin.
-- Run in Supabase Studio's SQL editor AFTER signing up through the app.
-- There is no automated alternative that is not a self-promotion hole.
--
-- Replace the email, then run.

update profiles
set role = 'admin', updated_at = now()
where email = 'REPLACE_WITH_YOUR_EMAIL';

select id, email, role, status from profiles where role = 'admin';
```

- [ ] **Step 9: Apply the schema and verify**

Paste all of `schema.sql` into Supabase Studio's SQL editor and run it. Then run this verification query:

```sql
select tablename, rowsecurity from pg_tables
where schemaname = 'public'
  and tablename in ('grammar_corrections','headline_generations','style_rewrites',
                    'summaries','profiles','user_categories','request_telemetry')
order by tablename;
```

Expected: **7 rows, `rowsecurity = true` for every one.** If any row shows `false`, RLS did not apply and every later isolation guarantee is void — fix before continuing.

- [ ] **Step 10: Verify the schema is re-runnable**

Run the entire `schema.sql` a second time. Expected: no errors. If anything raises "already exists", it is not idempotent — fix it.

- [ ] **Step 11: Commit**

```bash
git add apps/backend-api/schema.sql apps/backend-api/scripts/seed_admin.sql
git commit -m "feat: add profiles, categories, telemetry tables and RLS policies"
```

---

### Task 3: JWT verification

**Files:**
- Create: `apps/backend-api/app/core/auth.py`
- Create: `apps/backend-api/tests/test_auth.py`
- Modify: `apps/backend-api/app/core/config.py`
- Modify: `apps/backend-api/.env.example`

**Interfaces:**
- Produces:
  - `class InvalidToken(Exception)`
  - `def decode_token(token: str) -> dict` — returns verified claims, raises `InvalidToken`.
  - `def extract_bearer(header: str | None) -> str | None`

- [ ] **Step 1: Add the config fields**

In `app/core/config.py`, after the `SUPABASE_SERVICE_ROLE_KEY` block:

```python
    # Shared secret used to verify Supabase-issued JWTs (HS256 projects).
    # Newer projects sign asymmetrically; those use SUPABASE_JWKS_URL instead.
    SUPABASE_JWT_SECRET: str = ""
    SUPABASE_JWKS_URL: str = ""
    # Anon (publishable) key — safe to expose; used by the user-scoped client.
    SUPABASE_ANON_KEY: str = ""
    # Salt for hashing client IPs. Raw IPs are never stored.
    IP_HASH_SALT: str = ""
```

- [ ] **Step 2: Document them in `.env.example`**

```
# ── Auth ──
# Supabase Settings → API → JWT Settings → JWT Secret (HS256 projects)
SUPABASE_JWT_SECRET=
# Asymmetric projects instead expose a JWKS endpoint:
#   https://<project>.supabase.co/auth/v1/.well-known/jwks.json
SUPABASE_JWKS_URL=
# Supabase Settings → API → Project API keys → anon / public
SUPABASE_ANON_KEY=
# Any long random string. Changing it resets anonymous rate-limit buckets.
IP_HASH_SALT=
```

- [ ] **Step 3: Write the failing tests**

Create `apps/backend-api/tests/test_auth.py`:

```python
"""
JWT verification unit tests. Tokens are minted locally with a test secret —
no Supabase project and no network involved.
"""

import time

import jwt
import pytest

from app.core.auth import InvalidToken, decode_token, extract_bearer

TEST_SECRET = "test-jwt-secret-not-a-real-one"


def _token(**overrides) -> str:
    claims = {
        "sub": "11111111-1111-1111-1111-111111111111",
        "email": "reporter@sinai.lk",
        "aud": "authenticated",
        "role": "authenticated",
        "exp": int(time.time()) + 3600,
        "iat": int(time.time()),
    }
    claims.update(overrides)
    return jwt.encode(claims, TEST_SECRET, algorithm="HS256")


@pytest.fixture(autouse=True)
def _secret(monkeypatch):
    """Point the verifier at the test secret."""
    from app.core import auth as auth_module
    monkeypatch.setattr(auth_module, "_jwt_secret", lambda: TEST_SECRET)


def test_decode_valid_token():
    claims = decode_token(_token())
    assert claims["sub"] == "11111111-1111-1111-1111-111111111111"
    assert claims["email"] == "reporter@sinai.lk"


def test_expired_token_rejected():
    with pytest.raises(InvalidToken):
        decode_token(_token(exp=int(time.time()) - 10))


def test_wrong_signature_rejected():
    forged = jwt.encode({"sub": "x", "aud": "authenticated"}, "wrong-secret", algorithm="HS256")
    with pytest.raises(InvalidToken):
        decode_token(forged)


def test_wrong_audience_rejected():
    with pytest.raises(InvalidToken):
        decode_token(_token(aud="something-else"))


def test_malformed_token_rejected():
    with pytest.raises(InvalidToken):
        decode_token("not.a.jwt")


def test_none_algorithm_rejected():
    """An unsigned 'alg: none' token must never be accepted."""
    forged = jwt.encode({"sub": "x", "aud": "authenticated"}, None, algorithm="none")
    with pytest.raises(InvalidToken):
        decode_token(forged)


@pytest.mark.parametrize("header,expected", [
    ("Bearer abc.def.ghi", "abc.def.ghi"),
    ("bearer abc.def.ghi", "abc.def.ghi"),
    ("Basic abc", None),
    ("", None),
    (None, None),
    ("Bearer", None),
])
def test_extract_bearer(header, expected):
    assert extract_bearer(header) == expected
```

- [ ] **Step 4: Run the tests to verify they fail**

```bash
cd apps/backend-api && python -m pytest tests/test_auth.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'app.core.auth'`

- [ ] **Step 5: Implement `app/core/auth.py`**

```python
"""
Supabase JWT verification.

Tokens are verified locally against project key material rather than by
calling Supabase on every request — an auth round-trip per API call would
double the latency of every endpoint.

Supabase projects sign either with a shared HS256 secret (older projects)
or asymmetrically with keys published at a JWKS endpoint (newer ones).
Both are supported: JWKS is tried when configured, HS256 otherwise.

Note: the `role` claim inside the JWT is the *Postgres* role
("authenticated") — NOT the application role. Application role lives in
profiles.role and is resolved separately in deps.py.
"""

import logging

import jwt
from jwt import PyJWKClient

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_ALGORITHMS = ["HS256", "ES256", "RS256"]
_AUDIENCE = "authenticated"

_jwks_client: PyJWKClient | None = None


class InvalidToken(Exception):
    """Token is absent, malformed, expired, or fails signature verification."""


def _jwt_secret() -> str:
    return get_settings().SUPABASE_JWT_SECRET


def _get_jwks_client() -> PyJWKClient | None:
    """Cached JWKS client; None when the project uses a shared secret."""
    global _jwks_client
    url = get_settings().SUPABASE_JWKS_URL
    if not url:
        return None
    if _jwks_client is None:
        _jwks_client = PyJWKClient(url, cache_keys=True)
    return _jwks_client


def extract_bearer(header: str | None) -> str | None:
    """Pull the token out of an `Authorization: Bearer <token>` header."""
    if not header:
        return None
    parts = header.split(None, 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    token = parts[1].strip()
    return token or None


def decode_token(token: str) -> dict:
    """
    Verify signature, expiry, and audience; return the claims.

    Raises:
        InvalidToken: on any verification failure. The underlying reason is
            logged at debug level but never surfaced — telling a caller
            *why* their token failed is an information leak.
    """
    try:
        jwks = _get_jwks_client()
        if jwks is not None:
            key = jwks.get_signing_key_from_jwt(token).key
        else:
            key = _jwt_secret()
            if not key:
                raise InvalidToken("No JWT key material configured")

        return jwt.decode(
            token,
            key,
            algorithms=_ALGORITHMS,
            audience=_AUDIENCE,
            options={"require": ["exp", "sub"]},
        )
    except InvalidToken:
        raise
    except Exception as exc:
        logger.debug("JWT verification failed: %s", exc)
        raise InvalidToken("Invalid or expired token") from exc
```

- [ ] **Step 6: Run the tests to verify they pass**

```bash
cd apps/backend-api && python -m pytest tests/test_auth.py -v
```

Expected: **7 passed** (the parametrized `extract_bearer` counts as 6 of them, so the total line reads `12 passed`).

- [ ] **Step 7: Commit**

```bash
git add apps/backend-api/app/core/auth.py apps/backend-api/tests/test_auth.py \
        apps/backend-api/app/core/config.py apps/backend-api/.env.example
git commit -m "feat: verify Supabase JWTs locally with HS256/JWKS support"
```

---

### Task 4: Auth dependencies

**Files:**
- Create: `apps/backend-api/app/schemas/auth.py`
- Create: `apps/backend-api/app/repositories/profile_repository.py`
- Create: `apps/backend-api/app/core/deps.py`
- Create: `apps/backend-api/tests/test_deps.py`

**Interfaces:**
- Consumes: `decode_token`, `extract_bearer`, `InvalidToken` from Task 3.
- Produces:
  - `class AuthUser(BaseModel)` with fields `id: str`, `email: str`, `role: str`, `status: str`, `category_id: str | None`
  - `async def optional_user(request: Request) -> AuthUser | None`
  - `async def require_user(request: Request) -> AuthUser`
  - `async def require_admin(request: Request) -> AuthUser`
  - `async def get_profile(user_id: str) -> dict | None`

- [ ] **Step 1: Write the schema**

Create `apps/backend-api/app/schemas/auth.py`:

```python
"""The authenticated caller, as resolved from a verified JWT plus profiles."""

from pydantic import BaseModel


class AuthUser(BaseModel):
    """A verified caller. Never constructed from unverified input."""

    id: str
    email: str
    role: str = "user"
    status: str = "active"
    category_id: str | None = None

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"
```

- [ ] **Step 2: Write the profile repository**

Create `apps/backend-api/app/repositories/profile_repository.py`:

```python
"""
Data access for profiles.

Uses the service-role client: a caller's own profile must be readable
before we know whether they are allowed to read anything, so this lookup
cannot itself be RLS-gated on the caller's session.
"""

from typing import Any

from app.repositories.base import fetch_by_id

TABLE = "profiles"


async def get_profile(user_id: str) -> dict[str, Any] | None:
    """Fetch one profile by auth user id, or None when absent."""
    return await fetch_by_id(TABLE, user_id)
```

- [ ] **Step 3: Write the failing tests**

Create `apps/backend-api/tests/test_deps.py`:

```python
"""
Auth dependency behaviour. Uses a throwaway FastAPI app so the tests
describe the dependencies themselves, not any particular product route.
"""

import time

import jwt
import pytest
from fastapi import Depends, FastAPI
from httpx import ASGITransport, AsyncClient

from app.core.deps import optional_user, require_admin, require_user
from app.schemas.auth import AuthUser

TEST_SECRET = "test-jwt-secret-not-a-real-one"
USER_ID = "11111111-1111-1111-1111-111111111111"
ADMIN_ID = "22222222-2222-2222-2222-222222222222"


def _token(sub=USER_ID, email="reporter@sinai.lk", **overrides) -> str:
    claims = {
        "sub": sub, "email": email, "aud": "authenticated",
        "exp": int(time.time()) + 3600, "iat": int(time.time()),
    }
    claims.update(overrides)
    return jwt.encode(claims, TEST_SECRET, algorithm="HS256")


@pytest.fixture(autouse=True)
def _secret(monkeypatch):
    from app.core import auth as auth_module
    monkeypatch.setattr(auth_module, "_jwt_secret", lambda: TEST_SECRET)


@pytest.fixture
def app_with_deps():
    app = FastAPI()

    @app.get("/anon")
    async def anon(user: AuthUser | None = Depends(optional_user)):
        return {"user": user.id if user else None}

    @app.get("/private")
    async def private(user: AuthUser = Depends(require_user)):
        return {"user": user.id}

    @app.get("/admin")
    async def admin(user: AuthUser = Depends(require_admin)):
        return {"user": user.id}

    return app


def _client(app) -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.fixture
def seed_profiles(fake_supabase):
    fake_supabase.store["profiles"] = [
        {"id": USER_ID,  "email": "reporter@sinai.lk", "role": "user",
         "status": "active", "category_id": None, "created_at": "2026-01-01T00:00:00Z"},
        {"id": ADMIN_ID, "email": "boss@sinai.lk", "role": "admin",
         "status": "active", "category_id": None, "created_at": "2026-01-01T00:00:00Z"},
    ]
    return fake_supabase


@pytest.mark.asyncio
async def test_optional_user_allows_anonymous(app_with_deps, seed_profiles):
    async with _client(app_with_deps) as c:
        r = await c.get("/anon")
    assert r.status_code == 200
    assert r.json()["user"] is None


@pytest.mark.asyncio
async def test_optional_user_resolves_token(app_with_deps, seed_profiles):
    async with _client(app_with_deps) as c:
        r = await c.get("/anon", headers={"Authorization": f"Bearer {_token()}"})
    assert r.status_code == 200
    assert r.json()["user"] == USER_ID


@pytest.mark.asyncio
async def test_require_user_401_without_token(app_with_deps, seed_profiles):
    async with _client(app_with_deps) as c:
        r = await c.get("/private")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_require_user_401_with_bad_token(app_with_deps, seed_profiles):
    async with _client(app_with_deps) as c:
        r = await c.get("/private", headers={"Authorization": "Bearer garbage"})
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_require_user_allows_valid_token(app_with_deps, seed_profiles):
    async with _client(app_with_deps) as c:
        r = await c.get("/private", headers={"Authorization": f"Bearer {_token()}"})
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_require_admin_403_for_normal_user(app_with_deps, seed_profiles):
    async with _client(app_with_deps) as c:
        r = await c.get("/admin", headers={"Authorization": f"Bearer {_token()}"})
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_require_admin_allows_admin(app_with_deps, seed_profiles):
    token = _token(sub=ADMIN_ID, email="boss@sinai.lk")
    async with _client(app_with_deps) as c:
        r = await c.get("/admin", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_suspended_user_rejected_everywhere(app_with_deps, fake_supabase):
    """A suspended account is 403 on both require_user and optional_user."""
    fake_supabase.store["profiles"] = [
        {"id": USER_ID, "email": "reporter@sinai.lk", "role": "user",
         "status": "suspended", "category_id": None, "created_at": "2026-01-01T00:00:00Z"},
    ]
    headers = {"Authorization": f"Bearer {_token()}"}
    async with _client(app_with_deps) as c:
        assert (await c.get("/private", headers=headers)).status_code == 403
        assert (await c.get("/anon", headers=headers)).status_code == 403


@pytest.mark.asyncio
async def test_valid_token_without_profile_is_401(app_with_deps, fake_supabase):
    """A token whose profile row is gone must not authenticate."""
    fake_supabase.store["profiles"] = []
    async with _client(app_with_deps) as c:
        r = await c.get("/private", headers={"Authorization": f"Bearer {_token()}"})
    assert r.status_code == 401
```

- [ ] **Step 4: Run the tests to verify they fail**

```bash
cd apps/backend-api && python -m pytest tests/test_deps.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'app.core.deps'`

- [ ] **Step 5: Implement `app/core/deps.py`**

```python
"""
FastAPI auth dependencies.

Three levels, matching the three kinds of route in this product:

    optional_user  the four writing tools — usable anonymously, but a
                   signed-in caller gets their results saved
    require_user   anything personal (history, profile, settings)
    require_admin  the admin dashboard

A suspended account is rejected by all three, including optional_user —
a suspended token is treated as invalid, not as anonymous. Such a user can
still use the tools logged out, which is intended: suspension revokes
account privileges, not access to a publicly available tool.
"""

import logging

from fastapi import HTTPException, Request, status

from app.core.auth import InvalidToken, decode_token, extract_bearer
from app.repositories.base import DatabaseUnavailable
from app.repositories.profile_repository import get_profile
from app.schemas.auth import AuthUser

logger = logging.getLogger(__name__)

_UNAUTHENTICATED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Authentication required.",
    headers={"WWW-Authenticate": "Bearer"},
)
_SUSPENDED = HTTPException(
    status_code=status.HTTP_403_FORBIDDEN,
    detail="This account has been suspended.",
)
_NOT_ADMIN = HTTPException(
    status_code=status.HTTP_403_FORBIDDEN,
    detail="Administrator access required.",
)


async def _resolve(request: Request) -> AuthUser | None:
    """Verify the bearer token and load the matching profile, or None."""
    token = extract_bearer(request.headers.get("Authorization"))
    if token is None:
        return None

    try:
        claims = decode_token(token)
    except InvalidToken:
        return None

    user_id = claims.get("sub")
    if not user_id:
        return None

    try:
        profile = await get_profile(user_id)
    except DatabaseUnavailable:
        # Failing open here would let anyone through whenever the database
        # blips, so a profile we cannot read is a profile we do not trust.
        logger.warning("Profile lookup failed for %s — treating as unauthenticated", user_id)
        return None

    if profile is None:
        return None

    user = AuthUser(
        id=user_id,
        email=profile.get("email") or claims.get("email", ""),
        role=profile.get("role", "user"),
        status=profile.get("status", "active"),
        category_id=profile.get("category_id"),
    )
    if user.status == "suspended":
        raise _SUSPENDED
    return user


async def optional_user(request: Request) -> AuthUser | None:
    """Resolved caller, or None when unauthenticated. Never raises 401."""
    return await _resolve(request)


async def require_user(request: Request) -> AuthUser:
    """Resolved caller. 401 when absent or unverifiable."""
    user = await _resolve(request)
    if user is None:
        raise _UNAUTHENTICATED
    return user


async def require_admin(request: Request) -> AuthUser:
    """Resolved caller with role='admin'. 401 when absent, 403 when not admin."""
    user = await require_user(request)
    if not user.is_admin:
        raise _NOT_ADMIN
    return user
```

- [ ] **Step 6: Run the tests to verify they pass**

```bash
cd apps/backend-api && python -m pytest tests/test_deps.py -v
```

Expected: **9 passed**

- [ ] **Step 7: Run the whole suite to check for regressions**

```bash
cd apps/backend-api && python -m pytest tests/ -v
```

Expected: all pass. Nothing existing consumes these dependencies yet.

- [ ] **Step 8: Commit**

```bash
git add apps/backend-api/app/core/deps.py apps/backend-api/app/schemas/auth.py \
        apps/backend-api/app/repositories/profile_repository.py apps/backend-api/tests/test_deps.py
git commit -m "feat: add require_user, optional_user and require_admin dependencies"
```

---

### Task 5: User-scoped data access

> **Design note — read before implementing.** The spec (§3.1) describes a per-request PostgREST client carrying the caller's JWT, so that Postgres RLS enforces isolation on backend reads. Phase 1 deliberately ships the **documented fallback** instead: the service-role client with `user_id` filtering enforced in `base.py`, which every user-facing read already funnels through.
>
> Why: threading a JWT from the request through the router → service → repository → `base.py` layers touches every call site in the codebase, and doing that at the same time as introducing auth makes both changes harder to review. The isolation guarantee is instead pinned by `test_history_is_isolated_between_users` in Task 6, which fails loudly if a filter is dropped.
>
> **RLS is still doing real work**, not decoration: `AuthProvider.jsx` queries `profiles` directly from the browser with the anon key, and that path is guarded only by the policies from Task 2. The `role`/`status` escalation guard is likewise pure Postgres.
>
> Moving backend reads onto the per-request client is recorded as the first hardening item of Phase 2. Do not skip it silently.

**Files:**
- Modify: `apps/backend-api/app/repositories/base.py`
- Modify: `apps/backend-api/tests/conftest.py`

**Interfaces:**
- Consumes: `AuthUser` from Task 4.
- Produces:
  - `base.fetch_page(table, *, page, page_size, user_id: str | None = None)`
  - `base.fetch_recent(table, limit, *, user_id: str | None = None)`
  - `base.fetch_by_id(table, record_id, *, user_id: str | None = None)`

- [ ] **Step 1: Write the failing test**

Append to `apps/backend-api/tests/test_deps.py`:

```python
@pytest.mark.asyncio
async def test_fetch_page_filters_by_user(fake_supabase):
    """A user_id filter must exclude other users' rows."""
    from app.repositories.base import fetch_page

    fake_supabase.store["summaries"] = [
        {"id": "a", "user_id": USER_ID,  "summary_text": "mine",
         "created_at": "2026-01-02T00:00:00Z"},
        {"id": "b", "user_id": ADMIN_ID, "summary_text": "theirs",
         "created_at": "2026-01-01T00:00:00Z"},
    ]

    rows, total = await fetch_page("summaries", page=1, page_size=20, user_id=USER_ID)

    assert total == 1
    assert [r["summary_text"] for r in rows] == ["mine"]
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd apps/backend-api && python -m pytest tests/test_deps.py::test_fetch_page_filters_by_user -v
```

Expected: FAIL — `TypeError: fetch_page() got an unexpected keyword argument 'user_id'`

- [ ] **Step 3: Add the `user_id` parameter to `base.py`**

In `apps/backend-api/app/repositories/base.py`, replace `fetch_page`, `fetch_recent`, and `fetch_by_id` with these versions. The `user_id` filter is applied server-side by PostgREST; RLS is the second line of defence, not the only one.

```python
async def fetch_by_id(
    table: str,
    record_id: str,
    *,
    user_id: str | None = None,
) -> dict[str, Any] | None:
    """Fetch a single row by UUID, scoped to `user_id` when given."""
    if _circuit_is_open():
        raise DatabaseUnavailable(f"History storage unavailable (cooldown): {table}")
    try:
        client = await get_supabase()
        query = client.table(table).select("*").eq("id", record_id)
        if user_id is not None:
            query = query.eq("user_id", user_id)
        response = await asyncio.wait_for(
            query.maybe_single().execute(),
            timeout=READ_TIMEOUT_SECONDS,
        )
    except Exception as exc:
        _trip_circuit()
        raise DatabaseUnavailable(f"Failed to read {table}: {exc}") from exc
    return response.data if response is not None else None


async def fetch_page(
    table: str,
    *,
    page: int = 1,
    page_size: int = 20,
    user_id: str | None = None,
) -> tuple[list[dict[str, Any]], int]:
    """Newest-first page plus exact total, scoped to `user_id` when given."""
    if _circuit_is_open():
        raise DatabaseUnavailable(f"History storage unavailable (cooldown): {table}")
    try:
        client = await get_supabase()
        offset = (page - 1) * page_size
        query = client.table(table).select("*", count="exact")
        if user_id is not None:
            query = query.eq("user_id", user_id)
        response = await asyncio.wait_for(
            query.order("created_at", desc=True)
                 .range(offset, offset + page_size - 1)
                 .execute(),
            timeout=READ_TIMEOUT_SECONDS,
        )
    except Exception as exc:
        _trip_circuit()
        raise DatabaseUnavailable(f"Failed to read {table}: {exc}") from exc
    return response.data, response.count or 0


async def fetch_recent(
    table: str,
    limit: int,
    *,
    user_id: str | None = None,
) -> list[dict[str, Any]]:
    """Newest `limit` rows without a count query, scoped when given."""
    if _circuit_is_open():
        raise DatabaseUnavailable(f"History storage unavailable (cooldown): {table}")
    try:
        client = await get_supabase()
        query = client.table(table).select("*")
        if user_id is not None:
            query = query.eq("user_id", user_id)
        response = await asyncio.wait_for(
            query.order("created_at", desc=True).limit(limit).execute(),
            timeout=READ_TIMEOUT_SECONDS,
        )
    except Exception as exc:
        _trip_circuit()
        raise DatabaseUnavailable(f"Failed to read {table}: {exc}") from exc
    return response.data
```

- [ ] **Step 4: Fix the fake's count semantics**

The fake in `tests/conftest.py` computes `total` **after** filtering already, so no change is needed there — verify by running the test. If `total` comes back as 2 rather than 1, the fake is counting pre-filter; fix `_FakeQuery.execute` so `total = len(result)` is computed after the filter loop.

- [ ] **Step 5: Run the test to verify it passes**

```bash
cd apps/backend-api && python -m pytest tests/test_deps.py::test_fetch_page_filters_by_user -v
```

Expected: PASS

- [ ] **Step 6: Run the whole suite**

```bash
cd apps/backend-api && python -m pytest tests/ -v
```

Expected: all pass. `user_id` defaults to `None`, so existing callers are unaffected.

- [ ] **Step 7: Commit**

```bash
git add apps/backend-api/app/repositories/base.py apps/backend-api/tests/test_deps.py \
        apps/backend-api/tests/conftest.py
git commit -m "feat: scope repository reads by user_id"
```

---

### Task 6: Attach `user_id` on the write path

**Files:**
- Modify: `apps/backend-api/app/api/v1/grammar.py`, `headline.py`, `style.py`, `summarizer.py`
- Modify: `apps/backend-api/app/services/grammar/grammar_service.py`, `headline/headline_service.py`, `style/style_service.py`, `summarizer/summarizer_service.py`
- Create: `apps/backend-api/tests/test_user_scoping.py`

**Interfaces:**
- Consumes: `optional_user`, `AuthUser` from Task 4.
- Produces: rows in the four history tables carrying `user_id`, or `NULL` for anonymous callers.

- [ ] **Step 1: Read the current service signatures**

```bash
cd apps/backend-api && grep -n "async def" app/services/*/*.py
```

Note each service's entry-point signature — the next step threads an optional `user_id` through each one.

- [ ] **Step 2: Write the failing tests**

Create `apps/backend-api/tests/test_user_scoping.py`:

```python
"""
Per-user history isolation.

Two guarantees are asserted here:
  1. anonymous tool calls still work (the Chrome extension and Docs add-on
     depend on this) and are NOT persisted;
  2. an authenticated call is persisted against that user and is invisible
     to everyone else.
"""

import time

import jwt
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app

TEST_SECRET = "test-jwt-secret-not-a-real-one"
USER_A = "11111111-1111-1111-1111-111111111111"
USER_B = "22222222-2222-2222-2222-222222222222"

_ARTICLE = (
    "ශ්‍රී ලංකා ක්‍රිකට් කණ්ඩායම ඊයේ පැවති තරඟයෙන් විශිෂ්ට ජයග්‍රහණයක් වාර්තා කළේය. "
    "මෙම ජයග්‍රහණයත් සමඟ ඔවුන් තරඟාවලියේ පෙරමුණ ගැනීමට සමත් විය."
)


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
        {"id": USER_A, "email": "a@sinai.lk", "role": "user", "status": "active",
         "category_id": None, "created_at": "2026-01-01T00:00:00Z"},
        {"id": USER_B, "email": "b@sinai.lk", "role": "user", "status": "active",
         "category_id": None, "created_at": "2026-01-01T00:00:00Z"},
    ]
    return fake_supabase


@pytest.mark.asyncio
async def test_anonymous_summarize_still_works(fake_supabase):
    """No Authorization header must still return 200 — extension depends on it."""
    async with _client() as c:
        r = await c.post("/api/v1/summarize", json={"text": _ARTICLE, "length": "short"})
    assert r.status_code == 200
    assert r.json()["summary"]


@pytest.mark.asyncio
async def test_anonymous_result_is_not_persisted(fake_supabase):
    """'Login to save' means anonymous runs leave no row."""
    async with _client() as c:
        await c.post("/api/v1/summarize", json={"text": _ARTICLE, "length": "short"})
    assert fake_supabase.store.get("summaries", []) == []


@pytest.mark.asyncio
async def test_authenticated_result_is_persisted_with_user_id(fake_supabase):
    async with _client() as c:
        r = await c.post(
            "/api/v1/summarize",
            json={"text": _ARTICLE, "length": "short"},
            headers=_auth(USER_A),
        )
    assert r.status_code == 200
    rows = fake_supabase.store["summaries"]
    assert len(rows) == 1
    assert rows[0]["user_id"] == USER_A


@pytest.mark.asyncio
async def test_history_is_isolated_between_users(fake_supabase):
    async with _client() as c:
        await c.post("/api/v1/summarize",
                     json={"text": _ARTICLE, "length": "short"}, headers=_auth(USER_A))
        await c.post("/api/v1/summarize",
                     json={"text": _ARTICLE, "length": "short"}, headers=_auth(USER_B))

        a = await c.get("/api/v1/summarize/history", headers=_auth(USER_A))
        b = await c.get("/api/v1/summarize/history", headers=_auth(USER_B))

    assert a.json()["total"] == 1
    assert b.json()["total"] == 1
    assert a.json()["items"][0]["id"] != b.json()["items"][0]["id"]


@pytest.mark.asyncio
async def test_history_requires_auth(fake_supabase):
    async with _client() as c:
        r = await c.get("/api/v1/summarize/history")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_unified_history_requires_auth(fake_supabase):
    async with _client() as c:
        r = await c.get("/api/v1/history")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_legacy_rows_invisible_to_users(fake_supabase):
    """Pre-auth rows (user_id NULL) must not appear in anyone's history."""
    fake_supabase.store["summaries"] = [
        {"id": "legacy", "user_id": None, "original_text": "old", "summary_text": "old",
         "length": "short", "created_at": "2025-01-01T00:00:00Z"},
    ]
    async with _client() as c:
        r = await c.get("/api/v1/summarize/history", headers=_auth(USER_A))
    assert r.json()["total"] == 0
```

- [ ] **Step 3: Run the tests to verify they fail**

```bash
cd apps/backend-api && python -m pytest tests/test_user_scoping.py -v
```

Expected: several FAIL — anonymous results are currently persisted, and history returns 200 without auth.

- [ ] **Step 4: Thread `user_id` through the summarizer route**

In `apps/backend-api/app/api/v1/summarizer.py`, add the dependency and pass it down:

```python
from fastapi import APIRouter, Depends

from app.core.deps import optional_user, require_user
from app.schemas.auth import AuthUser
```

On the POST handler, add the parameter `user: AuthUser | None = Depends(optional_user)` and pass `user_id=user.id if user else None` into the service call.

On the history handler, change the dependency to `user: AuthUser = Depends(require_user)` and pass `user_id=user.id` into the repository call.

- [ ] **Step 5: Add the shared persistence guard**

All four services need the same decision — persist when the caller is known, return a response-shaped record when not. Write it once. Anonymous responses must keep the exact shape authenticated ones have, because the Chrome extension reads `id` off every response.

In `apps/backend-api/app/repositories/base.py`, add below `_synthetic_record`:

```python
async def persist_if_owned(
    save: Callable[[dict[str, Any]], Awaitable[dict[str, Any]]],
    record: dict[str, Any],
    user_id: str | None,
) -> dict[str, Any]:
    """
    Persist `record` against `user_id`, or return an unsaved response-shaped
    record when the caller is anonymous.

    "Login to save": anonymous runs leave no row, so `user_id IS NULL` in the
    history tables keeps meaning "pre-auth legacy data" and nothing else.
    The returned shape is identical either way — clients cannot tell.
    """
    if user_id is None:
        return _synthetic_record(record)
    return await save({**record, "user_id": user_id})
```

Add to the imports at the top of `base.py`:

```python
from collections.abc import Awaitable, Callable
```

- [ ] **Step 6: Use the guard in the summarizer service**

In `app/services/summarizer/summarizer_service.py`, add `user_id: str | None = None` to the entry-point signature. `record` here is the dict already being passed to `save_summary` — keep its fields as they are:

```python
from app.repositories.base import persist_if_owned

    saved = await persist_if_owned(save_summary, record, user_id)
```

Then use `saved` wherever the old `save_summary(...)` return value was used.

- [ ] **Step 7: Run the summarizer tests**

```bash
cd apps/backend-api && python -m pytest tests/test_user_scoping.py -v
```

Expected: the four summarizer tests pass. `test_history_requires_auth` and `test_unified_history_requires_auth` still fail — they are fixed in Steps 8–9.

- [ ] **Step 8: Apply the same change to grammar**

`app/api/v1/grammar.py` — add to the POST handler signature:

```python
user: AuthUser | None = Depends(optional_user),
```

and pass `user_id=user.id if user else None` into the service call. On the history handler, change to `user: AuthUser = Depends(require_user)` and pass `user_id=user.id` into `get_corrections(...)`.

`app/services/grammar/grammar_service.py` — add `user_id: str | None = None` to the entry point and use the shared guard from Step 5:

```python
from app.repositories.base import persist_if_owned

    saved = await persist_if_owned(save_correction, record, user_id)
```

`app/repositories/grammar_repository.py` — thread the filter through:

```python
async def get_corrections(
    *,
    page: int = 1,
    page_size: int = 20,
    user_id: str | None = None,
) -> tuple[list[dict[str, Any]], int]:
    """Paginated correction history, newest first: (records, total)."""
    return await fetch_page(TABLE, page=page, page_size=page_size, user_id=user_id)
```

- [ ] **Step 9: Apply the same change to headline and style**

`app/api/v1/headline.py` + `app/services/headline/headline_service.py` + `app/repositories/headline_repository.py`, and `app/api/v1/style.py` + `app/services/style/style_service.py` + `app/repositories/style_repository.py`.

The edit is identical in shape to Step 8 — three changes per tool:

1. Router POST handler gains `user: AuthUser | None = Depends(optional_user)`, passes `user_id=user.id if user else None`.
2. Router history handler gains `user: AuthUser = Depends(require_user)`, passes `user_id=user.id`.
3. Service gains `user_id: str | None = None` and calls `persist_if_owned(<save_fn>, record, user_id)` from Step 5; repository read function gains `user_id: str | None = None` forwarded to `fetch_page`.

The save functions are `save_generation` (headline) and `save_rewrite` (style); the read functions are `get_generations` and `get_rewrites`. Confirm the exact names first:

```bash
cd apps/backend-api && grep -n "async def" app/repositories/headline_repository.py app/repositories/style_repository.py
```

- [ ] **Step 10: Scope the unified history feed**

Find where `/history` is registered:

```bash
cd apps/backend-api && grep -rn '"/history"' app/api/
```

On that handler add `user: AuthUser = Depends(require_user)`, and forward `user_id=user.id` into every `fetch_recent` call inside `app/repositories/history_repository.py`. Each of those functions needs the same `user_id: str | None = None` keyword added and passed straight through, exactly as in Step 8.

- [ ] **Step 11: Update the pre-existing history tests**

`tests/test_endpoints.py` has history tests written before auth existed; they will now get 401. Add an auth header to each, and a comment recording why:

```python
# History is per-user since Phase 1 — these calls need a signed-in caller.
```

Reuse the `_token` / `_auth` helpers from `tests/test_user_scoping.py` by importing them, rather than duplicating the JWT minting logic.

- [ ] **Step 12: Run the whole suite**

```bash
cd apps/backend-api && python -m pytest tests/ -v
```

Expected: all pass, including `test_endpoints.py`.

- [ ] **Step 13: Commit**

```bash
git add apps/backend-api/app apps/backend-api/tests
git commit -m "feat: scope tool history to the authenticated user"
```

---

### Task 7: Anonymous rate limiting

**Files:**
- Create: `apps/backend-api/app/core/rate_limit.py`
- Create: `apps/backend-api/app/repositories/telemetry_repository.py`
- Create: `apps/backend-api/tests/test_rate_limit.py`
- Modify: the four tool routers

**Interfaces:**
- Consumes: `optional_user` from Task 4.
- Produces:
  - `def hash_ip(ip: str) -> str`
  - `def client_ip(request: Request) -> str`
  - `async def enforce_anonymous_limit(request: Request, user: AuthUser | None) -> None` — raises 429.
  - `async def record_request(**fields) -> None`
  - `async def count_recent_by_ip(ip_hash: str, within_seconds: int) -> int`

- [ ] **Step 1: Add the limit to config**

In `app/core/config.py`:

```python
    # Anonymous requests allowed per hour per client IP. Anonymous use means
    # unauthenticated GPU inference, so this is a cost control, not a nicety.
    ANON_REQUESTS_PER_HOUR: int = 20
```

And in `.env.example`:

```
# Anonymous (logged-out) tool requests allowed per hour per IP.
ANON_REQUESTS_PER_HOUR=20
```

- [ ] **Step 2: Write the failing tests**

Create `apps/backend-api/tests/test_rate_limit.py`:

```python
"""Anonymous IP rate limiting. Authenticated callers are never limited here."""

import time

import jwt
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app

TEST_SECRET = "test-jwt-secret-not-a-real-one"
USER_A = "11111111-1111-1111-1111-111111111111"
_TEXT = "ශ්‍රී ලංකා ක්‍රිකට් කණ්ඩායම ඊයේ පැවති තරඟයෙන් ජයග්‍රහණයක් වාර්තා කළේය."


def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.fixture(autouse=True)
def _secret(monkeypatch):
    from app.core import auth as auth_module
    monkeypatch.setattr(auth_module, "_jwt_secret", lambda: TEST_SECRET)


@pytest.fixture(autouse=True)
def _small_limit(monkeypatch):
    """Drop the limit to 2 so the test does not need 20 requests."""
    from app.core import rate_limit
    monkeypatch.setattr(rate_limit, "_limit", lambda: 2)


@pytest.fixture(autouse=True)
def _profiles(fake_supabase):
    fake_supabase.store["profiles"] = [
        {"id": USER_A, "email": "a@sinai.lk", "role": "user", "status": "active",
         "category_id": None, "created_at": "2026-01-01T00:00:00Z"},
    ]
    return fake_supabase


def test_hash_ip_is_stable_and_not_reversible():
    from app.core.rate_limit import hash_ip
    assert hash_ip("203.0.113.7") == hash_ip("203.0.113.7")
    assert hash_ip("203.0.113.7") != hash_ip("203.0.113.8")
    assert "203.0.113.7" not in hash_ip("203.0.113.7")


@pytest.mark.asyncio
async def test_anonymous_blocked_after_limit(fake_supabase):
    headers = {"X-Forwarded-For": "203.0.113.7"}
    async with _client() as c:
        assert (await c.post("/api/v1/summarize",
                json={"text": _TEXT, "length": "short"}, headers=headers)).status_code == 200
        assert (await c.post("/api/v1/summarize",
                json={"text": _TEXT, "length": "short"}, headers=headers)).status_code == 200
        third = await c.post("/api/v1/summarize",
                json={"text": _TEXT, "length": "short"}, headers=headers)
    assert third.status_code == 429


@pytest.mark.asyncio
async def test_limit_is_per_ip(fake_supabase):
    async with _client() as c:
        for _ in range(2):
            await c.post("/api/v1/summarize", json={"text": _TEXT, "length": "short"},
                         headers={"X-Forwarded-For": "203.0.113.7"})
        other = await c.post("/api/v1/summarize", json={"text": _TEXT, "length": "short"},
                             headers={"X-Forwarded-For": "198.51.100.4"})
    assert other.status_code == 200


@pytest.mark.asyncio
async def test_authenticated_callers_are_not_limited(fake_supabase):
    token = jwt.encode(
        {"sub": USER_A, "email": "a@sinai.lk", "aud": "authenticated",
         "exp": int(time.time()) + 3600, "iat": int(time.time())},
        TEST_SECRET, algorithm="HS256")
    headers = {"X-Forwarded-For": "203.0.113.7", "Authorization": f"Bearer {token}"}
    async with _client() as c:
        for _ in range(4):
            r = await c.post("/api/v1/summarize",
                             json={"text": _TEXT, "length": "short"}, headers=headers)
            assert r.status_code == 200
```

- [ ] **Step 3: Run the tests to verify they fail**

```bash
cd apps/backend-api && python -m pytest tests/test_rate_limit.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'app.core.rate_limit'`

- [ ] **Step 4: Implement the telemetry repository**

Create `apps/backend-api/app/repositories/telemetry_repository.py`:

```python
"""
Request telemetry writes and reads.

Lands in Phase 1 because anonymous rate limiting counts from this table
rather than maintaining a separate counter — one indexed count per
anonymous call, and it stays correct across multiple server instances,
which an in-memory counter would not.

Phase 4 adds the nightly rollup into usage_daily plus retention pruning.
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from app.core.database import get_supabase
from app.repositories.base import insert_record

TABLE = "request_telemetry"

logger = logging.getLogger(__name__)


async def record_request(**fields: Any) -> None:
    """
    Fire-and-forget telemetry write. Never raises: losing a telemetry row
    must not fail a user's request.
    """
    try:
        await insert_record(TABLE, fields)
    except Exception:
        logger.exception("Telemetry write failed — continuing")


async def count_recent_by_ip(ip_hash: str, within_seconds: int) -> int:
    """How many requests this IP hash made in the trailing window."""
    since = (datetime.now(timezone.utc) - timedelta(seconds=within_seconds)).isoformat()
    client = await get_supabase()
    response = await (
        client.table(TABLE)
        .select("id", count="exact")
        .eq("ip_hash", ip_hash)
        .gte("created_at", since)
        .execute()
    )
    return response.count or 0
```

- [ ] **Step 5: Add `gte` to the test fake**

`_FakeQuery` has no `gte`. In `tests/conftest.py`, add to the builders section:

```python
    def gte(self, column: str, value):
        self._gte_filters.append((column, value))
        return self
```

Initialize `self._gte_filters: list[tuple[str, object]] = []` in `__init__`, and apply it in `execute` right after the `eq` filter loop:

```python
        for column, value in self._gte_filters:
            result = [r for r in result if str(r.get(column) or "") >= str(value)]
```

- [ ] **Step 6: Implement the rate limiter**

Create `apps/backend-api/app/core/rate_limit.py`:

```python
"""
Anonymous request rate limiting.

The four writing tools are usable without an account, which means
unauthenticated traffic reaches GPU inference. This caps that per client
IP. Authenticated callers are exempt — they are attributable, and abuse by
a known account is handled by suspension instead.

IPs are never stored raw. Only sha256(ip + IP_HASH_SALT) is persisted:
enough to rate-limit and investigate abuse, not a plaintext record of who
read what.
"""

import hashlib

from fastapi import HTTPException, Request, status

from app.core.config import get_settings
from app.repositories.telemetry_repository import count_recent_by_ip
from app.schemas.auth import AuthUser

_WINDOW_SECONDS = 3600


def _limit() -> int:
    return get_settings().ANON_REQUESTS_PER_HOUR


def hash_ip(ip: str) -> str:
    """One-way, salted hash of a client IP."""
    salt = get_settings().IP_HASH_SALT
    return hashlib.sha256(f"{ip}{salt}".encode()).hexdigest()


def client_ip(request: Request) -> str:
    """
    Caller's IP. Render terminates TLS at a proxy, so X-Forwarded-For's
    first entry is the real client; fall back to the socket peer.
    """
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def enforce_anonymous_limit(request: Request, user: AuthUser | None) -> None:
    """Raise 429 when an anonymous caller has exceeded the hourly cap."""
    if user is not None:
        return

    ip_hash = hash_ip(client_ip(request))
    used = await count_recent_by_ip(ip_hash, _WINDOW_SECONDS)
    if used >= _limit():
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                "Anonymous usage limit reached. "
                "Sign in to keep going and to save your history."
            ),
        )
```

- [ ] **Step 7: Wire it into the four tool routers**

In each of `api/v1/summarizer.py`, `grammar.py`, `headline.py`, `style.py`, at the top of the POST handler body:

```python
    await enforce_anonymous_limit(request, user)
```

Add `request: Request` to the handler signature and import `enforce_anonymous_limit`. Then, after the inference call completes, record telemetry:

```python
    await record_request(
        user_id=user.id if user else None,
        endpoint="/api/v1/summarize",
        method="POST",
        tool="summarizer",
        status_code=200,
        latency_ms=result.latency_ms,
        provider=result.provider,
        ip_hash=hash_ip(client_ip(request)),
    )
```

- [ ] **Step 8: Run the rate-limit tests**

```bash
cd apps/backend-api && python -m pytest tests/test_rate_limit.py -v
```

Expected: **4 passed**

- [ ] **Step 9: Run the whole suite**

```bash
cd apps/backend-api && python -m pytest tests/ -v
```

Expected: all pass. Anonymous tests in `test_user_scoping.py` make ≤2 calls per IP, under the default limit of 20.

- [ ] **Step 10: Commit**

```bash
git add apps/backend-api/app apps/backend-api/tests
git commit -m "feat: rate-limit anonymous tool requests by hashed client IP"
```

---

### Task 8: Frontend auth client and session context

**Files:**
- Create: `apps/web-app/src/auth/supabaseClient.js`
- Create: `apps/web-app/src/auth/AuthProvider.jsx`
- Create: `apps/web-app/.env.example`
- Modify: `apps/web-app/package.json`, `apps/web-app/src/main.jsx`, `apps/web-app/.gitignore`

**Interfaces:**
- Produces:
  - `supabase` — configured client, default export of `supabaseClient.js`
  - `<AuthProvider>` — wraps the app
  - `useAuth()` → `{ user, profile, session, loading, signIn, signUp, signOut, resetPassword, updatePassword }`

- [ ] **Step 1: Install the dependency**

```bash
cd apps/web-app && npm install @supabase/supabase-js
```

- [ ] **Step 2: Create the env template**

`apps/web-app/.env.example`:

```
# Supabase Settings → API. Both values are safe in a browser bundle:
# the anon key is constrained by Row Level Security.
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

- [ ] **Step 3: Confirm `.env` is ignored**

```bash
cd apps/web-app && grep -q "^\.env$\|^\*\.env\|^\.env\*" .gitignore && echo "ignored" || echo ".env NOT ignored"
```

If it prints `.env NOT ignored`, append `.env` to `apps/web-app/.gitignore` before continuing.

- [ ] **Step 4: Create the client**

`apps/web-app/src/auth/supabaseClient.js`:

```javascript
/**
 * Supabase client singleton.
 *
 * The anon key is meant to ship in the browser bundle — it grants nothing
 * on its own, because every table is guarded by Row Level Security. The
 * service-role key must never appear here.
 */

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill them in.'
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export default supabase;
```

- [ ] **Step 5: Create the provider**

`apps/web-app/src/auth/AuthProvider.jsx`:

```jsx
/**
 * Session context.
 *
 * `loading` starts true and only flips once Supabase has restored any
 * persisted session. Route guards must wait for it — rendering a redirect
 * before the session is known would bounce a signed-in user to /login on
 * every hard refresh.
 */

import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import supabase from './supabaseClient';

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      return;
    }
    const { data } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, status, category_id')
      .eq('id', userId)
      .maybeSingle();
    setProfile(data ?? null);
  }, []);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await loadProfile(data.session?.user?.id);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, next) => {
      if (!active) return;
      setSession(next);
      await loadProfile(next?.user?.id);
      setLoading(false);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const value = useMemo(() => ({
    session,
    user: session?.user ?? null,
    profile,
    loading,
    isAdmin: profile?.role === 'admin',
    signIn: (email, password) =>
      supabase.auth.signInWithPassword({ email, password }),
    signUp: (email, password, fullName) =>
      supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      }),
    signOut: () => supabase.auth.signOut(),
    resetPassword: (email) =>
      supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      }),
    updatePassword: (password) => supabase.auth.updateUser({ password }),
  }), [session, profile, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
```

- [ ] **Step 6: Wrap the app**

In `apps/web-app/src/main.jsx`, wrap `<App />`:

```jsx
import { AuthProvider } from './auth/AuthProvider.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
```

- [ ] **Step 7: Verify it boots**

```bash
cd apps/web-app && npm run dev
```

Open http://localhost:5173. Expected: the dashboard renders as before. If the "Missing VITE_SUPABASE_URL" error appears, create `.env` from `.env.example` with real values.

- [ ] **Step 8: Commit**

```bash
git add apps/web-app/src/auth apps/web-app/src/main.jsx apps/web-app/package.json \
        apps/web-app/package-lock.json apps/web-app/.env.example apps/web-app/.gitignore
git commit -m "feat: add Supabase auth client and session provider"
```

---

### Task 9: Auth pages

**Files:**
- Create: `apps/web-app/src/pages/auth/formStyles.js`, `AuthLayout.jsx`, `Login.jsx`, `Signup.jsx`, `ForgotPassword.jsx`, `ResetPassword.jsx`, `VerifyEmail.jsx`

**Interfaces:**
- Consumes: `useAuth()` from Task 8; `ActionButton` from `components/ui/ActionButton`.
- Produces: `INPUT` and `LABEL` class constants from `formStyles.js`; five route components, default-exported.

These pages use the **existing** SinAi ink/brand styling, not the admin theme — the admin theme arrives in Phase 2 and is scoped to `/admin`.

- [ ] **Step 1: Create the shared form styles**

Four of these pages need identical field styling. Define it once.

`apps/web-app/src/pages/auth/formStyles.js`:

```javascript
/** Field styling shared by the auth screens. */

export const INPUT = `w-full px-3.5 py-2.5 text-[14px] text-ink-800 border border-ink-200 rounded-xl bg-white
  placeholder:text-ink-400 transition-all duration-150
  focus:outline-none focus:border-brand-400 focus:shadow-[0_0_0_3px_rgba(205,25,26,0.07)]`;

export const LABEL = 'block text-[12.5px] font-semibold text-ink-700 mb-1.5';

export const ERROR = 'text-[12.5px] text-brand-700 bg-brand-50 rounded-lg px-3 py-2';
```

Every page below imports these instead of redeclaring them:

```javascript
import { INPUT, LABEL, ERROR } from './formStyles';
```

and renders errors as `<p role="alert" className={ERROR}>{error}</p>`.

- [ ] **Step 2: Create the shared shell**

`apps/web-app/src/pages/auth/AuthLayout.jsx`:

```jsx
/** Centered card shell shared by the five auth screens. */

export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 justify-center mb-6">
          <img src="/logored.svg" alt="" className="w-8 h-8 object-contain" />
          <span
            className="text-[24px] text-ink-900 tracking-tight"
            style={{ fontFamily: "'Gwen', 'Satoshi', sans-serif" }}
          >
            SinAi
          </span>
        </div>

        <div className="bg-white border border-ink-200/80 rounded-2xl shadow-card p-6">
          <h1 className="text-[17px] font-bold text-ink-900">{title}</h1>
          {subtitle && <p className="text-[12.5px] text-ink-500 mt-1 mb-5">{subtitle}</p>}
          {children}
        </div>

        {footer && <p className="text-center text-[12.5px] text-ink-500 mt-4">{footer}</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create the login page**

`apps/web-app/src/pages/auth/Login.jsx`:

```jsx
import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import AuthLayout from './AuthLayout';
import ActionButton from '../../components/ui/ActionButton';
import { INPUT, LABEL, ERROR } from './formStyles';


export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await signIn(email, password);
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    navigate(location.state?.from ?? '/dashboard', { replace: true });
  };

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Continue to your SinAi workspace."
      footer={<>No account? <Link to="/signup" className="text-brand-600 font-semibold">Create one</Link></>}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className={LABEL}>Email</label>
          <input id="email" type="email" required autoComplete="email"
            value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT} />
        </div>
        <div>
          <label htmlFor="password" className={LABEL}>Password</label>
          <input id="password" type="password" required autoComplete="current-password"
            value={password} onChange={(e) => setPassword(e.target.value)} className={INPUT} />
        </div>

        {error && (
          <p role="alert" className={ERROR}>
            {error}
          </p>
        )}

        <ActionButton type="submit" variant="primary" size="lg" loading={busy} className="w-full">
          {busy ? 'Signing in…' : 'Sign in'}
        </ActionButton>

        <Link to="/forgot-password" className="block text-center text-[12.5px] text-ink-500 hover:text-brand-600">
          Forgot your password?
        </Link>
      </form>
    </AuthLayout>
  );
}
```

- [ ] **Step 4: Verify `ActionButton` supports `type` and `loading`**

```bash
cd apps/web-app && grep -n "type\|loading\|disabled" src/components/ui/ActionButton.jsx | head -20
```

If `ActionButton` does not forward a `type` prop, a submit button inside a form will not submit. Add `type = 'button'` to its props and pass it through to the underlying `<button>`. Do this now — Steps 4–6 depend on it.

- [ ] **Step 5: Create the signup page**

`apps/web-app/src/pages/auth/Signup.jsx` — same structure as Login, with an added `full_name` field, a password field with `autoComplete="new-password"` and `minLength={8}`, and on success `navigate('/verify-email')`:

```jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import AuthLayout from './AuthLayout';
import ActionButton from '../../components/ui/ActionButton';
import { INPUT, LABEL, ERROR } from './formStyles';


export default function Signup() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await signUp(email, password, fullName);
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    navigate('/verify-email', { replace: true });
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Save your work and pick up where you left off."
      footer={<>Already registered? <Link to="/login" className="text-brand-600 font-semibold">Sign in</Link></>}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className={LABEL}>Full name</label>
          <input id="name" type="text" required autoComplete="name"
            value={fullName} onChange={(e) => setFullName(e.target.value)} className={INPUT} />
        </div>
        <div>
          <label htmlFor="email" className={LABEL}>Email</label>
          <input id="email" type="email" required autoComplete="email"
            value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT} />
        </div>
        <div>
          <label htmlFor="password" className={LABEL}>Password</label>
          <input id="password" type="password" required minLength={8} autoComplete="new-password"
            value={password} onChange={(e) => setPassword(e.target.value)} className={INPUT} />
          <p className="text-[11.5px] text-ink-500 mt-1.5">At least 8 characters.</p>
        </div>

        {error && (
          <p role="alert" className={ERROR}>
            {error}
          </p>
        )}

        <ActionButton type="submit" variant="primary" size="lg" loading={busy} className="w-full">
          {busy ? 'Creating…' : 'Create account'}
        </ActionButton>
      </form>
    </AuthLayout>
  );
}
```

- [ ] **Step 6: Create `ForgotPassword.jsx`**

Single email field; on submit calls `resetPassword(email)` and then renders a confirmation panel instead of the form. Show the same confirmation whether or not the email exists — revealing which addresses are registered is an account-enumeration leak.

```jsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import AuthLayout from './AuthLayout';
import ActionButton from '../../components/ui/ActionButton';
import { INPUT, LABEL, ERROR } from './formStyles';


export default function ForgotPassword() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    await resetPassword(email);
    setBusy(false);
    // Always the same outcome — a different message for unknown addresses
    // would let anyone test which emails have accounts.
    setSent(true);
  };

  return (
    <AuthLayout
      title="Reset your password"
      subtitle={sent ? undefined : 'We will email you a reset link.'}
      footer={<Link to="/login" className="text-brand-600 font-semibold">Back to sign in</Link>}
    >
      {sent ? (
        <p className="text-[13px] text-ink-600">
          If an account exists for <span className="font-semibold text-ink-900">{email}</span>,
          a reset link is on its way. Check your inbox and spam folder.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className={LABEL}>Email</label>
            <input id="email" type="email" required autoComplete="email"
              value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT} />
          </div>
          <ActionButton type="submit" variant="primary" size="lg" loading={busy} className="w-full">
            {busy ? 'Sending…' : 'Send reset link'}
          </ActionButton>
        </form>
      )}
    </AuthLayout>
  );
}
```

- [ ] **Step 7: Create `ResetPassword.jsx`**

Two password fields (new + confirm), calls `updatePassword(password)`, then navigates to `/dashboard`. Supabase puts the recovery session in the URL fragment and `detectSessionInUrl: true` consumes it, so the user is already authenticated when this page loads. Guard against mismatched confirmations before calling.

```jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import AuthLayout from './AuthLayout';
import ActionButton from '../../components/ui/ActionButton';
import { INPUT, LABEL, ERROR } from './formStyles';


export default function ResetPassword() {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await updatePassword(password);
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    navigate('/dashboard', { replace: true });
  };

  return (
    <AuthLayout title="Choose a new password">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="password" className={LABEL}>New password</label>
          <input id="password" type="password" required minLength={8} autoComplete="new-password"
            value={password} onChange={(e) => setPassword(e.target.value)} className={INPUT} />
        </div>
        <div>
          <label htmlFor="confirm" className={LABEL}>Confirm password</label>
          <input id="confirm" type="password" required minLength={8} autoComplete="new-password"
            value={confirm} onChange={(e) => setConfirm(e.target.value)} className={INPUT} />
        </div>

        {error && (
          <p role="alert" className={ERROR}>
            {error}
          </p>
        )}

        <ActionButton type="submit" variant="primary" size="lg" loading={busy} className="w-full">
          {busy ? 'Saving…' : 'Update password'}
        </ActionButton>
      </form>
    </AuthLayout>
  );
}
```

- [ ] **Step 8: Create `VerifyEmail.jsx`**

```jsx
import { Link } from 'react-router-dom';
import AuthLayout from './AuthLayout';

export default function VerifyEmail() {
  return (
    <AuthLayout
      title="Check your email"
      footer={<Link to="/login" className="text-brand-600 font-semibold">Back to sign in</Link>}
    >
      <p className="text-[13px] text-ink-600">
        We sent you a confirmation link. Click it to activate your account, then sign in.
      </p>
    </AuthLayout>
  );
}
```

- [ ] **Step 9: Verify the pages render**

Routes are wired in Task 10, so check them by temporarily importing `Login` into `App.jsx`'s route table, or run `npm run lint`:

```bash
cd apps/web-app && npm run lint
```

Expected: no errors in `src/pages/auth/`.

- [ ] **Step 10: Commit**

```bash
git add apps/web-app/src/pages/auth apps/web-app/src/components/ui/ActionButton.jsx
git commit -m "feat: add sign-in, sign-up and password reset screens"
```

---

### Task 10: Route guards and app wiring

**Files:**
- Create: `apps/web-app/src/auth/ProtectedRoute.jsx`
- Modify: `apps/web-app/src/App.jsx`, `apps/web-app/src/components/Sidebar.jsx`

**Interfaces:**
- Consumes: `useAuth()` from Task 8; the five auth pages from Task 9.
- Produces: `<ProtectedRoute>` wrapper component.

- [ ] **Step 1: Create the guard**

`apps/web-app/src/auth/ProtectedRoute.jsx`:

```jsx
/**
 * Gate for routes that require a session.
 *
 * Renders nothing while the session is still being restored — redirecting
 * during that window would bounce a signed-in user to /login on every
 * hard refresh.
 */

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 rounded-full border-2 border-ink-200 border-t-brand-600 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
```

- [ ] **Step 2: Register the auth routes**

In `apps/web-app/src/App.jsx`, import the five pages and `ProtectedRoute`. The auth pages render **outside** the sidebar shell, so add an early return before the main layout:

```jsx
const AUTH_PATHS = ['/login', '/signup', '/forgot-password', '/reset-password', '/verify-email'];

// … inside App(), before the main return:
if (AUTH_PATHS.includes(location.pathname)) {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
    </Routes>
  );
}
```

- [ ] **Step 3: Guard the personal routes**

In the main `<Routes>` block, wrap the four personal routes. The tool routes stay unwrapped — anonymous use is intended.

```jsx
<Route path="/history" element={
  <ProtectedRoute>
    <HistoryPage onSelectTool={handleSelectTool} onRerun={handleQuickStart} onBack={() => navigate('/dashboard')} />
  </ProtectedRoute>
} />
<Route path="/settings" element={
  <ProtectedRoute><SettingsPage onBack={() => navigate('/dashboard')} onDefaultsChange={handleDefaultsChange} /></ProtectedRoute>
} />
<Route path="/profile" element={
  <ProtectedRoute><ProfilePage onBack={() => navigate('/dashboard')} /></ProtectedRoute>
} />
<Route path="/plans" element={<ProtectedRoute><Plans /></ProtectedRoute>} />
```

- [ ] **Step 4: Replace the hardcoded sidebar user**

`Sidebar.jsx` lines 211–223 hardcode "Journalist / journalist@sinai.lk / Free". Replace with real session data, and swap the menu's third item for sign-in or sign-out depending on state.

```jsx
import { useAuth } from '../auth/AuthProvider';

// inside Sidebar():
const { user, profile, signOut } = useAuth();
const displayName = profile?.full_name || user?.email?.split('@')[0] || 'Guest';
const displayEmail = user?.email || 'Not signed in';
const initial = displayName.charAt(0).toUpperCase();
```

Replace the hardcoded block at lines 211–223 with:

```jsx
<div className="w-8.5 h-8.5 rounded-lg bg-gradient-to-br from-brand-500 to-brand-800 flex items-center justify-center shrink-0 text-white text-[12px] font-bold">
  {initial}
</div>
{!collapsed && (
  <div className="text-left min-w-0 flex-1">
    <div className="flex items-center gap-1.5">
      <p className="text-[12.5px] font-semibold text-white truncate">{displayName}</p>
      {profile?.role === 'admin' && (
        <span className="text-[8.5px] font-bold text-white/50 bg-white/10 px-1.5 py-px rounded uppercase tracking-wider">
          Admin
        </span>
      )}
    </div>
    <p className="text-[10.5px] text-white/40 truncate">{displayEmail}</p>
  </div>
)}
```

Then replace the popover's item array so it depends on session state:

```jsx
{(user
  ? [
      { id: 'profile-view-btn', label: 'View profile', icon: User, tool: 'profile' },
      { id: 'profile-upgrade-btn', label: 'Plans', icon: Zap, tool: 'plans' },
      { id: 'profile-settings-btn', label: 'Settings', icon: Settings, tool: 'settings' },
      { id: 'profile-signout-btn', label: 'Sign out', icon: LogOut, action: 'signout' },
    ]
  : [{ id: 'profile-signin-btn', label: 'Sign in', icon: LogIn, action: 'signin' }]
).map(({ id, label, icon: Icon, tool, action }) => (
  <button
    key={id}
    id={id}
    onClick={async () => {
      setProfileOpen(false);
      if (action === 'signout') {
        await signOut();
        navigate('/login');
      } else if (action === 'signin') {
        navigate('/login');
      } else {
        select(tool);
      }
    }}
    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[12.5px] font-medium text-ink-700
      hover:bg-ink-50 hover:text-brand-700 cursor-pointer transition-colors"
  >
    <Icon size={15} strokeWidth={2} className="text-ink-400" />
    <span>{label}</span>
  </button>
))}
```

Add `LogOut` and `LogIn` to the existing `lucide-react` import at the top of the file.

- [ ] **Step 5: Verify the flows by hand**

```bash
cd apps/web-app && npm run dev
```

Check each, in order:
1. Visit `/history` signed out → redirects to `/login`.
2. Sign up → lands on `/verify-email`; confirm via the emailed link.
3. Sign in → lands on `/dashboard`; sidebar shows your real name and email.
4. Visit `/history` signed in → renders, no redirect.
5. Hard-refresh on `/history` → stays put, does **not** bounce to `/login`. (This is the `loading` guard working.)
6. Visit `/summarizer` signed out → renders and runs. (Anonymous trial.)
7. Sign out → sidebar shows "Guest"; `/history` redirects again.

- [ ] **Step 6: Lint**

```bash
cd apps/web-app && npm run lint
```

Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web-app/src
git commit -m "feat: guard personal routes and show the signed-in user in the sidebar"
```

---

### Task 11: Send the token and cut history over to the server

**Files:**
- Modify: `apps/web-app/src/services/api.js`, `src/components/HistoryPage.jsx`, `src/App.jsx`
- Delete: `apps/web-app/src/lib/history.js`

**Interfaces:**
- Consumes: `supabase` from Task 8; the user-scoped `/api/v1/history` from Task 6.
- Produces: `getUnifiedHistory(page, pageSize)` in `services/api.js`.

- [ ] **Step 1: Attach the bearer token to every request**

In `apps/web-app/src/services/api.js`, import the client and make `request` async-aware:

```javascript
import supabase from '../auth/supabaseClient';

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
```

Then, inside `request`, replace the headers line:

```javascript
  const options = {
    method,
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
  };
```

`getSession()` refreshes an expired token automatically, so this never sends a stale one.

- [ ] **Step 2: Add the unified history call**

Append to `services/api.js`:

```javascript
// ── Unified history ──
// Server-side and scoped to the signed-in user; returns 401 when signed out.
export function getUnifiedHistory(page = 1, pageSize = 20) {
  return request(`/history?page=${page}&page_size=${pageSize}`, null, 'GET');
}
```

- [ ] **Step 3: Read the current HistoryPage**

```bash
cd apps/web-app && cat src/components/HistoryPage.jsx
```

Note which fields it renders from each localStorage entry (`tool`, `input`, `result`, `timestamp`) — the server shape must be mapped onto those, or the render code updated to match.

- [ ] **Step 4: Rewrite HistoryPage to read from the server**

Replace the `getHistory()`/`clearHistory()` imports with a fetch effect:

```jsx
import { useState, useEffect } from 'react';
import { getUnifiedHistory } from '../services/api';

// inside HistoryPage():
const [items, setItems] = useState([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);

useEffect(() => {
  let active = true;
  getUnifiedHistory()
    .then((data) => { if (active) setItems(data.items ?? []); })
    .catch((err) => { if (active) setError(err.message); })
    .finally(() => { if (active) setLoading(false); });
  return () => { active = false; };
}, []);
```

Then replace the list-rendering block with these four branches, in this order:

```jsx
if (loading) {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-6 h-6 rounded-full border-2 border-ink-200 border-t-brand-600 animate-spin" />
    </div>
  );
}

if (error) {
  return (
    <p role="alert" className="text-[13px] text-brand-700 bg-brand-50 rounded-lg px-4 py-3">
      Could not load your history: {error}
    </p>
  );
}

if (items.length === 0) {
  return <EmptyState title="No history yet" description="Runs you make while signed in show up here." />;
}

// …existing list markup, mapping over `items` instead of the localStorage array
```

Two shape differences to map, since the server rows are not the old localStorage entries:

| Old localStorage field | Server field |
|---|---|
| `entry.timestamp` | `entry.created_at` |
| `entry.input` | `entry.original_text` (or `article_text` for headlines) |
| `entry.result` | `entry.corrected_text` / `summary_text` / `rewritten_text` / `headlines[0]` |

Confirm the exact server shape before writing the mapping:

```bash
cd apps/backend-api && grep -n "def to_activity\|tool\|preview" app/repositories/history_repository.py
```

Remove the "Clear history" button. Deleting server-side history needs its own endpoint, which is Phase 2 — a button that silently does nothing is worse than no button.

- [ ] **Step 5: Remove the localStorage write path**

In `App.jsx`, delete the `import { saveToHistory } from './lib/history';` line and the `saveToHistory(activeTool, text, result);` call inside `wrappedProcess`. The backend already persists — this was a redundant parallel store.

```bash
cd apps/web-app && rm src/lib/history.js
grep -rn "lib/history\|saveToHistory\|getHistory\|clearHistory" src/ || echo "no references remain"
```

Expected: `no references remain`. If anything is listed, fix it before continuing.

- [ ] **Step 6: Verify end to end**

```bash
cd apps/web-app && npm run dev
```

1. Signed out, run the summarizer → result appears; `/history` still redirects to `/login`.
2. Sign in, run the summarizer → result appears.
3. Visit `/history` → the run from step 2 is listed, the one from step 1 is **not**.
4. Open a different browser profile, sign in as a second user, visit `/history` → empty. This is the isolation guarantee holding end to end.

- [ ] **Step 7: Lint**

```bash
cd apps/web-app && npm run lint
```

Expected: no new errors.

- [ ] **Step 8: Commit**

```bash
git add -A apps/web-app/src
git commit -m "feat: read history from the server and drop the localStorage store"
```

---

### Task 12: Documentation and first-admin setup

**Files:**
- Modify: `README.md`, `apps/backend-api/.env.example`, `apps/web-app/README.md`
- Create: `docs/auth-setup.md`

- [ ] **Step 1: Write the setup guide**

Create `docs/auth-setup.md`:

```markdown
# Auth setup

## 1. Supabase dashboard

**Authentication → Providers → Email**
- Enable Email provider
- Enable "Confirm email"

**Authentication → URL Configuration**
- Site URL: `http://localhost:5173` (dev) / your deployed origin (prod)
- Redirect URLs: add `http://localhost:5173/reset-password` and the deployed equivalent

**Settings → API** — copy these:
| Value | Goes to |
|---|---|
| Project URL | `PUBLIC_SUPABASE_URL` (backend), `VITE_SUPABASE_URL` (frontend) |
| `anon` / public key | `SUPABASE_ANON_KEY` (backend), `VITE_SUPABASE_ANON_KEY` (frontend) |
| `service_role` key | `SUPABASE_SERVICE_ROLE_KEY` (backend **only**) |
| JWT Secret | `SUPABASE_JWT_SECRET` (backend) |

The service-role key bypasses RLS. It must never appear in the frontend
bundle or in any committed file.

## 2. Apply the schema

Paste `apps/backend-api/schema.sql` into Supabase Studio's SQL editor and run it.
Verify RLS is on:

```sql
select tablename, rowsecurity from pg_tables
where schemaname = 'public' order by tablename;
```

Every application table must show `rowsecurity = true`.

## 3. Create the first admin

Sign up through the app normally, then run `apps/backend-api/scripts/seed_admin.sql`
with your email substituted in. This step is manual by design: any in-app path
to the first admin role is a self-promotion hole.

## 4. Local env

```bash
cp apps/backend-api/.env.example apps/backend-api/.env   # fill in
cp apps/web-app/.env.example      apps/web-app/.env      # fill in
```

Generate a salt for `IP_HASH_SALT`:

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```
```

- [ ] **Step 2: Link it from the main README**

In `README.md`, under "Repository layout", add:

```markdown
Authentication, roles, and per-user history are documented in
[docs/auth-setup.md](docs/auth-setup.md).
```

- [ ] **Step 3: Document the API auth contract**

In `README.md`, under the API surface table, add:

```markdown
### Authentication

Requests carry a Supabase JWT as `Authorization: Bearer <token>`.

| Route group | Auth |
|---|---|
| `/grammar/check`, `/headlines/generate`, `/rewrite`, `/summarize` | optional — anonymous allowed, rate-limited by IP, results not saved |
| `/*/history`, `/history` | required — 401 without a valid token |
| `/meta`, `/health` | none |

Anonymous callers are capped at `ANON_REQUESTS_PER_HOUR` per IP and receive
429 past that. The Chrome extension and Docs add-on use the anonymous path.
```

- [ ] **Step 4: Run the full suite one final time**

```bash
cd apps/backend-api && python -m pytest tests/ -v
```

Expected: everything passes. Record the count.

```bash
cd apps/web-app && npm run lint && npm run build
```

Expected: lint clean, build succeeds.

- [ ] **Step 5: Commit**

```bash
git add README.md docs/auth-setup.md apps/backend-api/.env.example apps/web-app/README.md
git commit -m "docs: document auth setup, first-admin seeding and the API auth contract"
```

---

## Phase 1 Done When

- [ ] A new user can sign up, verify email, sign in, and sign out.
- [ ] `schema.sql` runs twice with no error, and all seven tables report `rowsecurity = true`.
- [ ] Two different users see only their own history, verified in two browser profiles.
- [ ] `/history` returns 401 signed out.
- [ ] The four tool endpoints return 200 with no `Authorization` header, and those runs create no history row.
- [ ] An anonymous caller is 429'd past the hourly cap; an authenticated caller is not.
- [ ] `src/lib/history.js` is gone and nothing references it.
- [ ] A suspended account is 403'd on every authenticated route.
- [ ] The backend suite passes and the frontend builds clean.

## Not In Phase 1

Admin dashboard UI, the `/admin` theme, categories CRUD, the category picker on the profile, `app_settings`, feature flags, audit log, telemetry rollups and retention, and the research-tool migration. Those are Phases 2–4 in the spec.
