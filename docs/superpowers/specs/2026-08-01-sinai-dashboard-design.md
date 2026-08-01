# SinAi Admin Dashboard & User Management — Design

**Date:** 2026-08-01
**Status:** Approved, ready for implementation planning
**Scope:** `apps/web-app`, `apps/backend-api`

---

## 1. Goal

Add authentication, user management, and a production-grade admin dashboard to SinAi. Admins control application settings and see every user's activity and history. Users get persistent, cross-device history and a self-selected category. The three research tools (SinLLaMA Playground, Summarizer Lab, Model Comparison) move out of the user product into the admin dashboard.

All of it ships inside the existing two apps. No new services.

## 2. Decisions

These were settled during design. Each records the alternative rejected, so a later reader knows the choice was deliberate.

| # | Decision | Rejected alternative |
|---|---|---|
| D1 | **Supabase Auth**, not Passport.js | Passport.js was requested, but it is a Node library and the backend is Python/FastAPI. Honoring it meant adding a third runtime (Express) purely to host auth. Supabase is already a project dependency and brings RLS, which does per-user isolation at the database layer. |
| D2 | Admin lives at `/admin/*` **inside `apps/web-app`** | A separate admin SPA. Rejected: duplicates build, deploy, and the API client for no isolation benefit. |
| D3 | Research tools become **admin-only** | Keeping them user-visible, or per-category feature grants. Users get the product; admins get the lab. |
| D4 | New theme is **scoped to `/admin`** | App-wide retheme. Rejected: would rework every existing component on top of an already large change. |
| D5 | History is **server-side, RLS-enforced**; localStorage dropped | A localStorage cache layer. Rejected: cache-invalidation bugs for a marginal first-paint win. |
| D6 | **Open signup + seeded first admin** | Invite-only, or an approval queue. Both add UI before anyone can log in at all. |
| D7 | Categories are **labels + analytics segmentation** | Per-category tool defaults or quotas. Deferred — behaviour can be layered on later without a migration. |
| D8 | Admin controls **users/roles/categories, model gateway, feature flags, global defaults** | A narrower users-only admin surface. All four areas were explicitly requested. Secrets and service URLs remain env-only (§6.3). |
| D9 | **Per-tool adapter override is deferred** | The inference server's `POST /generate` takes `{prompt, task, style}` with no adapter parameter, and `serve_sinai.py` lives in the separate SinAI-Training repo. Building a half-wired feature against a contract that does not exist yet was rejected in favour of doing it once the server supports it. See §9. |
| D10 | **Full request-level telemetry**, paired with rollups + retention | Tool-history-only. Chosen for observability and GPU cost attribution; the rollup/retention design (§5.3) is what makes it sustainable. |
| D11 | 4 writing tools stay **usable anonymously**; login required to save | Login-required-for-everything. Anonymous use means unauthenticated GPU inference, so an IP rate limit is mandatory (§6.3), not optional. |

## 3. Architecture

```
apps/web-app (React 19 + Vite)
  ├─ supabase-js ──── signup/login/reset ────→ Supabase Auth (GoTrue)
  │                        ↓ issues JWT
  └─ fetch + Authorization: Bearer <jwt> ────→ apps/backend-api (FastAPI)
                                                    │
                                    ┌───────────────┴───────────────┐
                            user-scoped client              service-role client
                            (forwards caller JWT)           (bypasses RLS)
                            RLS enforced by Postgres        gated by require_admin()
                                    └───────────────┬───────────────┘
                                                    ↓
                                                Supabase Postgres
```

### 3.1 The two-client split

Today every backend query uses the service-role key, which bypasses RLS entirely. If that remains the only client, RLS is decorative. The backend therefore gains a second client:

| Client | Used for | Isolation enforced by |
|---|---|---|
| User-scoped — forwards the caller's JWT to PostgREST | all reads/writes of a user's own history | Postgres RLS (`user_id = auth.uid()`) |
| Service-role — existing | admin queries, telemetry writes, settings reads/writes | FastAPI `require_admin()` |

A missing `WHERE` clause in a user-facing path cannot leak another journalist's articles: Postgres refuses the rows. Admin power is concentrated in one auditable dependency rather than spread across every query.

### 3.2 Auth dependencies

- `require_user` → 401 when absent or invalid.
- `optional_user` → returns `None` when absent. Used by the four writing tools; this is what enables anonymous trial (D11).
- `require_admin` → 403 unless `profiles.role = 'admin'`.

**Suspended users** (`status='suspended'`) are rejected by all three with 403, including `optional_user`, which treats a suspended token as invalid rather than as anonymous. A suspended user who logs out can still use the tools anonymously — that is accepted, since suspension revokes *account* privileges (saved history, identity, admin access), not access to a publicly available tool. Blocking them entirely would require the anonymous trial to go away.

### 3.3 JWT verification

Verified **locally** against Supabase key material from env — no network round-trip per request. Supabase projects use either a shared HS256 secret or asymmetric keys served via JWKS depending on project age, so the implementation tries JWKS first and falls back to HS256. JWKS responses are cached in-process with a TTL.

### 3.4 RLS knows nothing about admins

Policies say only "you may touch rows where `user_id = auth.uid()`". Admin access never passes through RLS — it uses the service-role client behind `require_admin`. This deliberately avoids the recursion trap where a policy on `profiles` must read `profiles` to decide whether the caller is an admin.

## 4. Data model

All DDL goes in `apps/backend-api/schema.sql`, which is already the single source of truth and already `if not exists`-safe.

### 4.1 Identity

```sql
profiles
  id           uuid PK → auth.users(id) ON DELETE CASCADE
  email        text not null
  full_name    text
  role         text not null default 'user'   check (role in ('user','admin'))
  status       text not null default 'active' check (status in ('active','suspended'))
  category_id  uuid → user_categories(id) ON DELETE SET NULL
  created_at, updated_at, last_seen_at  timestamptz

user_categories
  id, name, slug (unique), description, is_active bool, sort_order int, created_at, updated_at
```

A `handle_new_user()` trigger on `auth.users` INSERT creates the matching `profiles` row, so a profile can never be missing. `category_id` is nullable — a user picks theirs after signup, and deleting a category does not delete its users.

### 4.2 Control plane

```sql
app_settings   key text PK, value jsonb, updated_by uuid, updated_at
audit_log      id, actor_id, actor_email, action, target_type, target_id,
               before jsonb, after jsonb, ip_hash, created_at
```

`app_settings` is key/value so adding a knob later is an INSERT, not a migration.

Keys: `model.provider`, `model.fallback_enabled`, `features.tools` (a `{grammar: true, headlines: false, …}` map), `defaults.tone`, `defaults.length`, `defaults.headline_count`, `limits.anon_per_hour`, `telemetry.retention_days`.

`audit_log.actor_email` is denormalized on purpose — the trail must remain readable after the actor's account is gone. The `before`/`after` jsonb pair is what makes "who turned off the GPU provider at 2am, and what was it before" answerable.

### 4.3 Telemetry

```sql
request_telemetry
  id, user_id (null = anonymous), endpoint, method, tool, status_code,
  latency_ms, provider, input_tokens, output_tokens, error_code,
  ip_hash, created_at
  indexes: (created_at desc), (user_id, created_at desc), (ip_hash, created_at desc)

usage_daily
  id, day date, user_id, tool, provider,
  request_count, error_count, total_latency_ms, total_input_tokens, total_output_tokens
  unique nulls not distinct (day, user_id, tool, provider)
```

Raw telemetry is retained for `telemetry.retention_days` (default 30), rolled into `usage_daily` nightly by `pg_cron`, then pruned. `usage_daily` is small and kept indefinitely, so admin charts stay fast at any range while the high-write table never grows unbounded.

`unique nulls not distinct` (Postgres 15+, which Supabase runs) lets anonymous traffic aggregate into a real row rather than requiring a sentinel UUID.

### 4.4 Altered tables

`grammar_corrections`, `headline_generations`, `style_rewrites`, `summaries` each get:

```sql
add column if not exists user_id uuid references auth.users(id) on delete cascade;
create index if not exists ... on (user_id, created_at desc);
alter table ... enable row level security;
```

Pre-existing rows keep `user_id IS NULL` — invisible to every user, visible to admins as legacy. Anonymous-trial results are **not written at all** (that is what "login to save" means), so `NULL` stays unambiguous: it means pre-auth.

### 4.5 RLS policies

| Table | `authenticated` | `anon` | service-role |
|---|---|---|---|
| 4 history tables | select/insert/delete where `user_id = auth.uid()` | none | full |
| `profiles` | select/update **own row only**; `role` + `status` locked by a column trigger | none | full |
| `user_categories` | select where `is_active` | none | full |
| `app_settings`, `audit_log`, `request_telemetry`, `usage_daily` | **deny all** | deny all | full |

The `profiles` column trigger is load-bearing: without it a user could `PATCH /profiles?id=eq.<self> {"role":"admin"}` directly through PostgREST using their own anon-key session and self-promote. The trigger rejects any `role` or `status` change not made by the service role.

### 4.6 Account deletion

Suspension (`status='suspended'`) is the normal admin action — reversible, history preserved. Hard delete cascades and destroys the user's history with them; the confirm dialog states this explicitly.

## 5. Privacy

IP addresses are never stored raw. `ip_hash = sha256(ip + server-side salt)`, with the salt in env. Sufficient to rate-limit and investigate abuse; not a plaintext record of who read what.

## 6. Backend changes

### 6.1 New modules

- `app/core/auth.py` — JWT verification, `require_user` / `optional_user` / `require_admin`.
- `app/core/supabase_user.py` — per-request RLS-honoring client factory.
- `app/core/runtime_settings.py` — layers `app_settings` values over env defaults, with a short TTL cache invalidated on write.
- `app/core/telemetry.py` — middleware writing `request_telemetry`.
- `app/repositories/{profile,category,settings,audit,telemetry}_repository.py`
- `app/api/v1/admin/` — users, categories, settings, activity routers, all behind `require_admin`.

### 6.2 Changed behaviour

- The four tool endpoints take `optional_user` and attach `user_id` on write when present.
- `/api/v1/history` and the four `/history` endpoints take `require_user` and return **401 when unauthenticated**, filtering to the caller otherwise. **Note:** this changes semantics — the endpoint currently returns every row to every caller. Verified during design that neither `apps/chrome-extension` nor `apps/docs-addon` calls it (both keep local history via `chrome.storage` / user properties and only call the four tool endpoints), so nothing downstream breaks.
- `model_gateway._provider_chain()` reads from `runtime_settings` instead of env.
- `/api/v1/meta` additionally reports tool feature flags and global defaults.

### 6.3 Anonymous rate limiting

Anonymous requests to the four tool endpoints are limited by `ip_hash` against `limits.anon_per_hour`. The counter is derived from `request_telemetry` (`count where ip_hash = ? and created_at > now() - interval '1 hour'`) rather than a separate table — one indexed count per anonymous call, no extra write path, and it works correctly across multiple FastAPI instances, which an in-memory counter would not.

Env stays authoritative for all secrets and service URLs. `SINLLAMA_API_URL` in particular is **not** DB-editable: a bad value there would send article text to an arbitrary host.

## 7. Frontend changes

### 7.1 Structure

```
src/
  auth/           supabaseClient.js, AuthProvider.jsx, ProtectedRoute.jsx, AdminRoute.jsx
  pages/auth/     Login, Signup, ForgotPassword, ResetPassword, VerifyEmail
  admin/
    theme.css     the approved token block, scoped
    AdminLayout.jsx, AdminSidebar.jsx
    pages/        Overview, Users, UserDetail, Categories, Settings, Activity
    research/     SinLLamaPage, SummarizerPlayground, ModelComparison   (moved)
```

### 7.2 Routes

Public: `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email`.

User:

| Route | Access |
|---|---|
| `/dashboard`, `/grammar`, `/headlines`, `/rewriter`, `/summarizer` | anonymous OK — results not saved, IP rate-limited |
| `/history`, `/settings`, `/profile`, `/plans` | session required |
| `/sinllama`, `/summarizer-playground`, `/comparison` | removed → redirect to `/admin` equivalents |

Admin (`role='admin'`; returns 404 rather than 403 so the surface is not discoverable):

| Route | Contents |
|---|---|
| `/admin` | Overview — KPIs, requests over time, tool mix, provider mix, error rate, top users. Reads `usage_daily`. |
| `/admin/users` | Searchable table: email, name, role, category, status, last seen, request count. Filters on role/category/status. |
| `/admin/users/:id` | One user: profile, category, role/status controls, full tool history, telemetry. |
| `/admin/categories` | CRUD with active toggle and sort order. |
| `/admin/settings` | Model gateway, feature flags, global defaults, anon rate limit, telemetry retention. |
| `/admin/activity` | Audit log (before → after) + filterable telemetry explorer. |
| `/admin/research/playground` | SinLLaMA Playground — moved |
| `/admin/research/summarizer-lab` | Summarizer Lab — moved |
| `/admin/research/comparison` | Model Comparison — moved |

### 7.3 Confirmation gates

Each of these opens a confirm dialog showing **current → new** and writes an `audit_log` row on commit: change model provider · toggle fallback · disable a tool · promote/demote admin · suspend/reactivate a user · delete a category (forces reassignment of its users) · hard-delete a user (states that history is destroyed) · change retention window.

### 7.4 Theme scoping

The approved token block ships as `src/admin/theme.css` with `:root` → `.admin-theme` and `.dark` → `.dark .admin-theme, .admin-theme.dark`. `AdminLayout` renders `<div className="admin-theme …">`, so tokens resolve only inside `/admin` and SinAi's existing ink/brand system is untouched.

**Known caveat:** the `@theme inline` block registers utility names (`bg-card`, `text-muted-foreground`, `border-sidebar-border`) app-wide in Tailwind v4, even though their values resolve only inside `.admin-theme`. Using one of those utilities on a user-facing page would render incorrectly. This is a discipline boundary, not an enforced one; it will be documented in the admin README.

### 7.5 History cutover

The backend already persists all four tools to Supabase; the frontend simply never reads it, maintaining a parallel 50-entry localStorage list instead. So this work is mostly deletion: `src/lib/history.js` and the `saveToHistory()` call in `App.jsx` are removed, and `HistoryPage` reads the now-user-scoped `/api/v1/history`. The write path changes only by attaching `user_id`.

### 7.6 New dependencies

| Package | App | Reason |
|---|---|---|
| `@supabase/supabase-js` | web-app | auth client |
| `recharts` | web-app | Overview/Activity charts — no charting library exists today |
| `@fontsource-variable/inter`, `@fontsource-variable/jetbrains-mono` | web-app | the approved theme specifies both; neither is installed |
| `PyJWT[crypto]` | backend-api | local JWT signature verification |

New frontend env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
New backend env: `SUPABASE_JWT_SECRET` (or JWKS URL), `IP_HASH_SALT`.

## 8. Phasing

Four phases, each independently shippable. **Phase 1 is a hard dependency for the rest**; phases 2–4 may be reordered.

**Phase 1 — Auth & data foundation.** Supabase Auth wiring, `profiles` + trigger, `user_id` + RLS on the four tables, two-client backend split, the three auth dependencies, auth pages, route guards, anonymous rate limiting, history cutover. Seed script for the first admin.
*Visible outcome: you can log in, and history follows you across devices.*

**Phase 2 — Admin shell & user management.** `/admin` layout, theme, sidebar; Overview with basic counts; Users table; User detail; Categories CRUD; category picker on the user profile; `audit_log` plus writes on every privileged action.

**Phase 3 — Control plane.** `app_settings` and the runtime-settings layer; model gateway config; feature flags surfaced through `/meta` and gating the user sidebar; global defaults; all confirm dialogs.

**Phase 4 — Telemetry & research migration.** Telemetry middleware; `pg_cron` rollup and prune; real Overview/Activity charts; the three research tools relocated to `/admin/research/*` and removed from the user sidebar.

## 9. Deferred

**Per-tool adapter override (D9).** Requires `POST /generate` on the inference server to accept an `adapter` field. That server is `serve_sinai.py` in the separate SinAI-Training repo. When it supports the field, the work here is: an `adapters.<tool>` key in `app_settings`, a picker in `/admin/settings` with the confirm-on-change dialog, and passing the value through `model_gateway._via_sinllama`. The `/compare` endpoint already accepts an explicit adapter list and remains the way Model Comparison works.

**Per-category tool defaults and quotas (D7).** Additive to the category model; no migration needed to adopt later.

## 10. Manual steps

1. **First admin.** After Phase 1, run a one-off SQL statement against Supabase setting `role='admin'` on your account. There is no automated alternative that is not a self-promotion hole.
2. **Supabase dashboard.** Enable email confirmations and set the redirect URLs for password reset and verification per environment.
3. **`pg_cron`.** Enable the extension in Supabase before Phase 4 and schedule the nightly rollup/prune job.

## 11. Testing

- **Backend:** the existing `pytest` suite is extended. Auth dependency unit tests (valid/expired/absent/malformed token, non-admin hitting an admin route). Repository tests asserting the user-scoped client cannot read another user's rows — this is the test that proves RLS is actually on, and it must fail if RLS is dropped. Rate-limit boundary tests.
- **RLS:** direct PostgREST tests using two real user JWTs, asserting cross-user reads return empty and that a `role` self-promotion PATCH is rejected.
- **Frontend:** route guard tests (anonymous → tool OK, anonymous → `/history` redirects, user → `/admin` 404s, admin → `/admin` renders).
- **Regression:** the four tool endpoints must keep working with no `Authorization` header, since the Chrome extension and Docs add-on depend on that.
