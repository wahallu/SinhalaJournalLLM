# Phase 4 — Telemetry, Analytics & Research Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make the telemetry already being collected usable — rolled up, pruned, and visible as charts and a searchable activity log — and move the three research tools out of the user product into the admin dashboard.

**Architecture:** A nightly `pg_cron` job aggregates `request_telemetry` into a small `usage_daily` table and prunes the raw rows past a retention window. Admin charts read the rollup so they stay fast at any range. The three research tools move under `/admin/research/*` behind `AdminRoute`.

**Tech Stack:** FastAPI, Supabase/Postgres (`pg_cron`), React 19, recharts, pytest.

## Global Constraints

- Frontend is **JavaScript + JSX, not TypeScript**.
- All DDL goes in `apps/backend-api/schema.sql` and must be **idempotent**.
- Tests run offline; do not modify the autouse fixtures beyond what a task specifies.
- **Every admin route requires `require_admin`.** The route-enumerating test in `tests/test_admin_auth.py` catches omissions — keep it passing.
- Raw IPs are never stored or returned; only `ip_hash`.
- The admin theme's tokens resolve only inside `.admin-theme`. The three migrated research components currently use the user-facing ink/brand tokens — see Task 5 for how that is handled.
- Commit after every task, conventional-commit prefixes.

**Run commands:**
- Backend: `cd apps/backend-api && source .venv/bin/activate && python -m pytest tests/ -v`
- Frontend: `cd apps/web-app && npm run lint && npm run build`

**Baseline at Phase 4 start:** 123 backend tests passing, 12 pre-existing frontend lint errors, build clean.

## What already exists

Phase 1 landed `request_telemetry` and its write path — all four tool endpoints already call `record_request` with user, tool, provider, latency, status and `ip_hash`. Phase 4 does **not** rebuild that; it adds aggregation, retention, and the UI on top.

---

### Task 1: `usage_daily` rollup table and retention

**Files:** Modify `apps/backend-api/schema.sql`

- [ ] **Step 1: Append the rollup table**

```sql
-- ── Daily usage rollup ──
-- request_telemetry is high-write and pruned; this stays small and is kept
-- indefinitely, so admin charts stay fast over any range.
create table if not exists usage_daily (
    id                  uuid primary key default gen_random_uuid(),
    day                 date not null,
    user_id             uuid references auth.users(id) on delete set null,
    tool                text,
    provider            text,
    request_count       integer not null default 0,
    error_count         integer not null default 0,
    total_latency_ms    bigint  not null default 0,
    total_input_tokens  bigint  not null default 0,
    total_output_tokens bigint  not null default 0
);

-- NULLS NOT DISTINCT (Postgres 15+, which Supabase runs) lets anonymous
-- traffic aggregate into one real row instead of needing a sentinel UUID.
create unique index if not exists idx_usage_daily_unique
    on usage_daily (day, user_id, tool, provider) nulls not distinct;
create index if not exists idx_usage_daily_day on usage_daily (day desc);

alter table usage_daily enable row level security;
-- No policy: service-role only, like the other operational tables.
```

- [ ] **Step 2: Append the rollup function**

```sql
-- Aggregate one day of raw telemetry into usage_daily. Idempotent per day:
-- re-running replaces that day's rows rather than double-counting, so a
-- retried or manually re-run job is safe.
create or replace function public.roll_up_usage(target_day date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    inserted integer;
begin
    delete from usage_daily where day = target_day;

    insert into usage_daily (
        day, user_id, tool, provider, request_count, error_count,
        total_latency_ms, total_input_tokens, total_output_tokens
    )
    select
        target_day,
        user_id,
        tool,
        provider,
        count(*),
        count(*) filter (where status_code >= 400),
        coalesce(sum(latency_ms), 0),
        coalesce(sum(input_tokens), 0),
        coalesce(sum(output_tokens), 0)
    from request_telemetry
    where created_at >= target_day
      and created_at <  target_day + 1
    group by user_id, tool, provider;

    get diagnostics inserted = row_count;
    return inserted;
end;
$$;
```

- [ ] **Step 3: Append the prune function**

```sql
-- Delete raw telemetry older than the retention window. Rolled-up totals in
-- usage_daily survive, so history is not lost — only per-request detail.
create or replace function public.prune_telemetry(retain_days integer default 30)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    removed integer;
begin
    delete from request_telemetry
    where created_at < now() - make_interval(days => retain_days);
    get diagnostics removed = row_count;
    return removed;
end;
$$;
```

- [ ] **Step 4: Validate syntax**

```bash
cd apps/backend-api && source .venv/bin/activate && pip install -q pglast && python3 -c "
import pglast; print('parsed', len(pglast.parse_sql(open('schema.sql').read())), 'statements')
" && pip uninstall -y -q pglast
```

- [ ] **Step 5: Commit**

- [ ] **Step 6: HUMAN STEP — apply and schedule**

Re-run `schema.sql` in Supabase Studio. Then enable `pg_cron` (Database → Extensions) and schedule the nightly job:

```sql
select cron.schedule(
    'sinai-nightly-rollup', '15 2 * * *',
    $$ select public.roll_up_usage((now() - interval '1 day')::date);
       select public.prune_telemetry(30); $$
);
```

Verify with `select * from cron.job;`. Until this is scheduled, `usage_daily` stays empty and the charts fall back to reading raw telemetry (Task 2).

---

### Task 2: Analytics repository and API

**Files:** Create `app/repositories/analytics_repository.py`, `app/api/v1/admin/analytics.py`, `tests/test_admin_analytics.py`; modify `app/api/v1/admin/__init__.py`

**Interfaces produced:**
- `analytics_repository.usage_series(days: int) -> list[dict]` — per-day totals
- `analytics_repository.tool_breakdown(days: int) -> dict[str, int]`
- `analytics_repository.provider_breakdown(days: int) -> dict[str, int]`
- `analytics_repository.top_users(days: int, limit: int) -> list[dict]`
- `GET /api/v1/admin/analytics?days=N`

- [ ] **Step 1: Write the failing tests** covering: the series has one entry per day in range including days with zero activity (a gap must render as zero, not vanish); the tool breakdown sums correctly; `days` is clamped to a sane maximum; a non-admin gets 403 (the route-enumerating test should pick this up — confirm it does).

- [ ] **Step 2: Implement**, reading `usage_daily` when rows exist for the range and falling back to `request_telemetry` otherwise — so the dashboard is useful before the first nightly job has ever run. Say so in the module docstring; a silent fallback is confusing otherwise.

- [ ] **Step 3: Full suite, then commit**

---

### Task 3: Activity explorer API

**Files:** Create `app/api/v1/admin/activity.py`, `tests/test_admin_activity.py`; modify `app/api/v1/admin/__init__.py`

- [ ] **Step 1: Write the failing tests** covering: audit entries return newest-first with actor, action, target and before/after; filtering by `action` and by `actor_id` works; telemetry rows can be filtered by tool and by status; **no response includes a raw IP** — only `ip_hash`; pagination returns a correct total.

- [ ] **Step 2: Implement** `GET /admin/activity/audit` and `GET /admin/activity/telemetry`, both behind `require_admin`, both paginated.

- [ ] **Step 3: Full suite, then commit**

---

### Task 4: Admin analytics and activity pages

**Files:** Create `src/admin/pages/Activity.jsx`; modify `src/admin/pages/Overview.jsx`, `src/admin/adminApi.js`, `src/admin/AdminSidebar.jsx`, `src/App.jsx`

- [ ] **Step 1: Extend `adminApi.js`** with `getAnalytics`, `getAuditLog`, `getTelemetry`.

- [ ] **Step 2: Rebuild Overview's charts** on the analytics endpoint: requests over time (line), tool mix (bar), provider mix (bar), error rate. Add a range selector (7 / 30 / 90 days). Use `--chart-1` … `--chart-5`.

- [ ] **Step 3: Build `Activity.jsx`** with two tabs — Audit log and Telemetry. The audit tab shows actor, action, target, and a readable before → after diff. The telemetry tab is filterable by tool and status.

- [ ] **Step 4: Empty and loading states.** A brand-new install has no telemetry at all; the pages must say so plainly rather than rendering an empty chart frame.

- [ ] **Step 5: Verify** lint ≤12 errors, build clean. **Commit.**

---

### Task 5: Move the research tools to `/admin`

The last of the original request. `SinLLamaPage`, `SummarizerPlayground` and `ModelComparison` become admin-only.

**Files:** Move `src/components/{SinLLamaPage,SummarizerPlayground,ModelComparison}.jsx` → `src/admin/research/`; modify `src/App.jsx`, `src/components/Sidebar.jsx`, `src/admin/AdminSidebar.jsx`

- [ ] **Step 1: Move the three files** with `git mv` so history is preserved.

- [ ] **Step 2: Fix their import paths** — they import from `../services/api`, `./ui/*` and `../lib/*`, which all change depth by one level. Run `npm run build` to catch every one; a missed path fails the build rather than silently rendering wrong.

- [ ] **Step 3: Decide the styling question explicitly.**

These three components are written against the **user-facing** ink/brand tokens, which do not resolve inside `.admin-theme`. Two options, and this must be a recorded decision rather than a silent one:

  - **(a)** Render them outside the `.admin-theme` scope — a nested `<div className="not-admin">` that re-declares the ink/brand tokens. Keeps the components untouched; the admin dashboard then has two visual languages side by side.
  - **(b)** Restyle all three onto the admin tokens. Visually coherent, but it is a large diff across three complex components (ModelComparison alone is ~600 lines) with real regression risk.

  **Recommended: (a) now, (b) as separate follow-up work.** The tools are research instruments whose value is their function; a restyle is cosmetic work that should not ride along with a move. Record whichever is chosen in the file's module comment.

- [ ] **Step 4: Add them to `AdminSidebar`** under a "Research" section: Playground, Summarizer Lab, Model Comparison.

- [ ] **Step 5: Register the routes** under `/admin/research/*` inside the existing `AdminRoute` + `AdminLayout` tree.

- [ ] **Step 6: Remove them from the user app** — delete the Research section from `src/components/Sidebar.jsx`, and drop `/sinllama`, `/summarizer-playground`, `/comparison` from `PATH_TO_TOOL`, `TOOL_TO_PATH`, `MAX_WIDTHS` and the route table.

- [ ] **Step 7: Redirect the old URLs.** A user with `/comparison` bookmarked should land somewhere sensible: redirect to `/dashboard` for everyone (admins can reach the new location from the admin sidebar). Do not redirect straight to the admin route — that would 302 a non-admin into a redirect loop.

- [ ] **Step 8: Verify** by hand: a normal user sees no Research section and gets bounced from the old URLs; an admin finds all three under `/admin/research/*` and they work. Lint ≤12 errors, build clean.

- [ ] **Step 9: Commit**

---

### Task 6: Documentation

**Files:** Modify `README.md`, `docs/auth-setup.md`; create `docs/operations.md`

- [ ] **Step 1: Write `docs/operations.md`** covering: the settings registry and what each key does; the nightly `pg_cron` job and how to verify it ran; the retention window and what is lost when raw rows are pruned; how to read the audit log; how to promote an admin.

- [ ] **Step 2: Update the README** — the tool table still lists the research tools as user-facing, and the architecture diagram predates auth.

- [ ] **Step 3: Full suite + build, then commit**

---

## Phase 4 Done When

- [ ] `usage_daily` exists, the nightly job is scheduled, and re-running the rollup for a day does not double-count.
- [ ] Overview shows requests over time, tool mix, provider mix and error rate, with a range selector.
- [ ] Activity shows the audit log with readable before → after, and a filterable telemetry view.
- [ ] No admin response contains a raw IP.
- [ ] The three research tools live under `/admin/research/*`, are gone from the user sidebar, and old URLs redirect without looping.
- [ ] Charts are useful before the first nightly job runs.
- [ ] Backend suite passes with zero warnings; frontend lint ≤12 errors; build clean.

## Not In Phase 4

Per-tool adapter override — still blocked on `serve_sinai.py` accepting an `adapter` field (spec §9). Restyling the research tools onto the admin token set, if option (a) is chosen in Task 5 Step 3.
