-- Indexes for the read paths that were still scanning.
--
-- Each one matches a query the backend actually issues; the comment above it
-- names the query. Every statement is idempotent, so re-running this file is
-- harmless.
--
-- On a large request_telemetry table, run the two telemetry/usage indexes
-- by hand with CREATE INDEX CONCURRENTLY instead (outside a transaction —
-- the Supabase SQL editor wraps a whole script in one, which CONCURRENTLY
-- refuses). Plain CREATE INDEX takes a write lock for the duration of the
-- build, and telemetry is written on every tool request.

-- Admin → Users: `order by created_at desc` with offset paging
-- (admin_repository.list_users). Without it every page sorts the table.
create index if not exists idx_profiles_created
    on profiles (created_at desc);

-- Admin → Users search: `email ilike '%term%' or full_name ilike '%term%'`.
-- A leading wildcard cannot use a btree at all; trigram GIN indexes can.
create extension if not exists pg_trgm with schema extensions;
create index if not exists idx_profiles_email_trgm
    on profiles using gin (email extensions.gin_trgm_ops);
create index if not exists idx_profiles_full_name_trgm
    on profiles using gin (full_name extensions.gin_trgm_ops);

-- Admin overview "suspended" count. Partial, because suspended accounts
-- are a sliver of the table and active ones are never counted this way.
create index if not exists idx_profiles_suspended
    on profiles (id) where status = 'suspended';

-- Admin → Activity → Telemetry filtered by tool, newest first
-- (api/v1/admin/activity.telemetry). idx_telemetry_created alone makes that
-- a walk of the whole time index discarding other tools.
create index if not exists idx_telemetry_tool_created
    on request_telemetry (tool, created_at desc);

-- Profile → Usage heatmap: one user's usage_daily rows over a day range
-- (analytics_repository.user_daily_series). The unique index leads with
-- `day`, so it cannot serve a per-user lookup.
create index if not exists idx_usage_daily_user_day
    on usage_daily (user_id, day desc);

-- Onboarding / profile category picker: active categories in display order
-- (category_repository.list_all(active_only=True)).
create index if not exists idx_user_categories_active_sort
    on user_categories (sort_order) where is_active;

-- Refresh planner statistics so the new indexes are considered immediately
-- rather than after the next autovacuum.
analyze profiles;
analyze request_telemetry;
analyze usage_daily;
analyze user_categories;
