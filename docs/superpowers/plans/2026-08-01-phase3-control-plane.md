# Phase 3 — Control Plane Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Admins change how SinAi behaves — model provider, per-tool availability, global defaults, anonymous rate limit — from the dashboard, without a redeploy, with every change confirmed and audited.

**Architecture:** An `app_settings` key/value table read through a small runtime-settings layer that overlays env defaults. The model gateway and `/meta` read from that layer instead of directly from env. Secrets and service URLs stay env-only. The frontend reads feature flags from `/meta` and hides disabled tools.

**Tech Stack:** FastAPI, Supabase/Postgres, React 19, Tailwind v4, pytest.

## Global Constraints

- Frontend is **JavaScript + JSX, not TypeScript**.
- All DDL goes in `apps/backend-api/schema.sql` and must be **idempotent**.
- Tests run offline; do not modify the autouse fixtures in `conftest.py` beyond what a task specifies.
- **Every admin settings route requires `require_admin`** and **every mutation writes an `audit_log` row** with before/after.
- **Secrets and service URLs are never DB-editable.** `SINLLAMA_API_URL`, `SUPABASE_*`, `OPENROUTER_API_KEY`, `GROQ_*`, `IP_HASH_SALT` stay in env. A DB-editable inference URL would let an admin — or anyone who compromised one admin account — redirect every article to a host they control.
- **Only whitelisted keys are settable.** An open key/value write endpoint is an arbitrary-config-injection hole.
- Never log or return a raw JWT, raw IP, or the service-role key.
- Commit after every task, conventional-commit prefixes.

**Run commands:**
- Backend: `cd apps/backend-api && source .venv/bin/activate && python -m pytest tests/ -v`
- Frontend: `cd apps/web-app && npm run lint && npm run build`

**Baseline at Phase 3 start:** 87 backend tests passing, 12 pre-existing frontend lint errors, build clean.

---

## Settings registry

The single source of truth for what is settable. Anything not here is rejected.

| Key | Type | Default (from) | Effect |
|---|---|---|---|
| `model.provider` | enum `sinllama\|openrouter\|mock` | env `MODEL_PROVIDER` | Primary inference provider |
| `model.fallback_enabled` | bool | env `MODEL_FALLBACK` | Fall through the provider chain on failure |
| `features.grammar` | bool | `true` | Grammar Checker available |
| `features.headlines` | bool | `true` | Headline Generator available |
| `features.rewriter` | bool | `true` | Style Rewriter available |
| `features.summarizer` | bool | `true` | News Summarizer available |
| `defaults.tone` | enum of trained styles | `formal` | New users' rewriter default |
| `defaults.length` | enum `short\|medium\|long` | `short` | New users' summary default |
| `defaults.headline_count` | int 1–10 | `5` | New users' headline count |
| `limits.anon_per_hour` | int 0–1000 | env `ANON_REQUESTS_PER_HOUR` | Anonymous cap per IP |

---

## File Structure

**Backend — create:**

| File | Responsibility |
|---|---|
| `app/core/settings_registry.py` | The whitelist: key → type, default, validator, description |
| `app/core/runtime_settings.py` | Reads `app_settings` over env defaults, with a TTL cache |
| `app/repositories/settings_repository.py` | `app_settings` reads/writes |
| `app/api/v1/admin/settings.py` | GET/PATCH admin settings |
| `tests/test_runtime_settings.py` | Layering, caching, validation |
| `tests/test_admin_settings.py` | Endpoint behaviour + audit |
| `tests/test_feature_flags.py` | A disabled tool returns 503 |

**Backend — modify:** `schema.sql`, `app/core/model_gateway.py`, `app/api/v1/meta.py`, `app/api/v1/admin/__init__.py`, the four tool routers

**Frontend — create:** `src/admin/pages/Settings.jsx`
**Frontend — modify:** `src/admin/AdminSidebar.jsx`, `src/admin/adminApi.js`, `src/App.jsx`, `src/components/Sidebar.jsx`, `src/services/api.js`

---

### Task 1: `app_settings` schema

**Files:** Modify `apps/backend-api/schema.sql`

- [ ] **Step 1: Append the table**

```sql
-- ── Runtime application settings ──
-- Key/value so adding a knob is an INSERT, not a migration. Only keys in
-- app/core/settings_registry.py are accepted; anything else is rejected by
-- the API before reaching this table.
create table if not exists app_settings (
    key        text primary key,
    value      jsonb not null,
    updated_by uuid references auth.users(id) on delete set null,
    updated_at timestamptz not null default now()
);

alter table app_settings enable row level security;
-- No policy: authenticated and anon are denied everything. Only the service
-- role reads and writes, via require_admin-gated endpoints.
```

- [ ] **Step 2: Validate syntax with pglast, then commit**

```bash
cd apps/backend-api && source .venv/bin/activate && pip install -q pglast && python3 -c "
import pglast; print('parsed', len(pglast.parse_sql(open('schema.sql').read())), 'statements')
" && pip uninstall -y -q pglast
```

- [ ] **Step 3: HUMAN STEP — re-run `schema.sql` in Supabase Studio**

Verify: `select tablename, rowsecurity from pg_tables where schemaname='public' and tablename='app_settings';` → one row, `true`.

---

### Task 2: Settings registry and runtime layer

**Files:** Create `app/core/settings_registry.py`, `app/core/runtime_settings.py`, `app/repositories/settings_repository.py`, `tests/test_runtime_settings.py`

**Interfaces produced:**
- `settings_registry.REGISTRY: dict[str, SettingSpec]`
- `settings_registry.validate(key, value) -> Any` — raises `ValueError`
- `runtime_settings.get(key) -> Any`
- `runtime_settings.get_all() -> dict[str, Any]`
- `runtime_settings.invalidate() -> None`
- `settings_repository.load_all() -> dict[str, Any]`
- `settings_repository.upsert(key, value, actor_id) -> None`

- [ ] **Step 1: Write the failing tests first**

Cover, at minimum:
- an unset key falls back to its env/registry default
- a stored value overrides the default
- `validate` rejects an unknown key
- `validate` rejects a wrong-typed value (string where bool expected)
- `validate` rejects an out-of-range int (`limits.anon_per_hour = -1`)
- `validate` rejects an enum value outside the allowed set (`model.provider = "gpt4"`)
- the cache is used within the TTL and refreshed after `invalidate()`

Each assertion must be on observable behaviour.

- [ ] **Step 2: Confirm they fail**, then implement.

- [ ] **Step 3: Registry** — each entry carries type, default source, validator, and a human description the admin UI renders. Booleans, bounded ints, and enums only; no free-form strings, because every current setting is a constrained choice and free text is where injection lives.

- [ ] **Step 4: Runtime layer** — reads all rows once, caches for `_TTL_SECONDS = 30`, overlays them on registry defaults. Both a TTL and explicit invalidation are needed: invalidation clears the local process only, and production runs multiple instances, so the TTL is what propagates a change to the others.

- [ ] **Step 5: Repository** — `load_all` and `upsert`, reaching the client as `base.get_supabase()` per the convention in `audit_repository`.

- [ ] **Step 6: Full suite, then commit**

---

### Task 3: Model gateway reads runtime settings

**Files:** Modify `app/core/model_gateway.py`; create nothing

- [ ] **Step 1: Write a failing test** asserting that setting `model.provider = "mock"` at runtime changes which provider a generation uses, without touching env.

- [ ] **Step 2: Change `_provider_chain()`** to read `runtime_settings.get("model.provider")` and `runtime_settings.get("model.fallback_enabled")` instead of `get_settings().MODEL_PROVIDER` / `.MODEL_FALLBACK`.

Keep the existing unknown-provider guard: an unrecognized value must still fall back to `mock` with a warning rather than raising.

- [ ] **Step 3: Update `gateway_status()`** to report the runtime values, so `/health/model` and `/meta` reflect what is actually in force.

- [ ] **Step 4: Confirm the existing offline fixture still wins.** `conftest.py` forces `MODEL_PROVIDER=mock` via env. Now that the gateway reads runtime settings, that fixture must still produce mock — extend it to also stub the runtime layer if it does not. The whole suite depends on this.

- [ ] **Step 5: Full suite, then commit**

---

### Task 4: Feature flags gate the tools

**Files:** Modify the four tool routers, `app/api/v1/meta.py`; create `tests/test_feature_flags.py`

- [ ] **Step 1: Write the failing tests** — with `features.summarizer = false`, `POST /api/v1/summarize` returns **503** with a clear message, while the other three still return 200. Disabling a tool must not affect its history endpoint (a user can still read what they already produced).

- [ ] **Step 2: Add a shared dependency** `require_tool_enabled(tool)` that raises 503 when the flag is off. One helper, used by all four routers — not four copies of the check.

- [ ] **Step 3: Surface the flags in `/meta`** so the frontend can hide disabled tools rather than letting a user click into a 503.

- [ ] **Step 4: Full suite, then commit**

---

### Task 5: Admin settings API

**Files:** Create `app/api/v1/admin/settings.py`, `tests/test_admin_settings.py`; modify `app/api/v1/admin/__init__.py`

- [ ] **Step 1: Write the failing tests** — covering: GET returns every registry key with its current value, default, type and description; PATCH updates a value and invalidates the cache; PATCH writes an audit row with before/after; PATCH of an unknown key is 400; PATCH of an invalid value is 400; non-admins get 403 (the existing route-enumerating test in `test_admin_auth.py` should pick the new routes up automatically — confirm it does).

- [ ] **Step 2: Implement**, calling `runtime_settings.invalidate()` after every successful write so the change takes effect in-process immediately.

- [ ] **Step 3: Full suite, then commit**

---

### Task 6: Admin settings page

**Files:** Create `src/admin/pages/Settings.jsx`; modify `src/admin/adminApi.js`, `src/admin/AdminSidebar.jsx`, `src/App.jsx`

- [ ] **Step 1: Add the API client functions** `getSettings`, `updateSetting`.

- [ ] **Step 2: Build the page**, grouped into Model gateway / Tools / Defaults / Limits, driven by the registry the API returns rather than a hardcoded list — so a key added server-side appears without a frontend change.

- [ ] **Step 3: Route every change through `ConfirmDialog`** showing current → new. Changing the model provider and disabling a tool are user-visible platform changes; they get the destructive styling.

- [ ] **Step 4: Show which values are overridden** versus sitting at their default, so an admin can tell what has been changed from baseline.

- [ ] **Step 5: Verify** lint at ≤12 errors, build clean, and by hand: flip a flag, confirm the audit row appears, confirm the tool disappears from the user sidebar.

- [ ] **Step 6: Commit**

---

### Task 7: Frontend consumes flags and defaults

**Files:** Modify `src/components/Sidebar.jsx`, `src/services/api.js`, `src/App.jsx`

- [ ] **Step 1: Fetch `/meta` once** at app level and expose flags and defaults.

- [ ] **Step 2: Hide disabled tools** from the user sidebar, and redirect a direct visit to a disabled tool's route back to the dashboard — hiding the nav item alone still leaves the URL reachable.

- [ ] **Step 3: Seed tool defaults** from `/meta` when the user has no saved preference of their own, keeping the user's own choice as the higher precedence.

- [ ] **Step 4: Degrade gracefully.** If `/meta` fails, assume every tool is enabled rather than hiding the whole product — a monitoring blip must not look like an outage.

- [ ] **Step 5: Verify** lint, build, and by hand. **Commit.**

---

## Phase 3 Done When

- [ ] An admin changes the model provider from the dashboard and the next generation uses it, with no redeploy.
- [ ] Disabling a tool returns 503 from its endpoint, hides it in the sidebar, and redirects direct navigation.
- [ ] A disabled tool's history remains readable.
- [ ] Global defaults seed new users' tool settings.
- [ ] Every settings change is confirmed with current → new and written to `audit_log`.
- [ ] An unknown key or invalid value is rejected with 400.
- [ ] Secrets and `SINLLAMA_API_URL` remain env-only and are absent from the settings API.
- [ ] Backend suite passes with zero warnings; frontend lint ≤12 errors; build clean.

## Not In Phase 3

Telemetry rollups, retention pruning, the activity/audit explorer UI, and moving the three research tools into `/admin` — all Phase 4. Per-tool adapter override remains deferred pending inference-server support.
