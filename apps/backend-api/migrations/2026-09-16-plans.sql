-- Admin-owned plan catalog + per-user assignment.
--
-- Plan copy used to live in apps/web-app/src/components/Plans.jsx, so
-- changing a tier meant a frontend deploy. It is data now.
--
-- Deliberately no price or currency column: there is no billing integration,
-- and a price that cannot be charged is worse than no price at all. That
-- reasoning is unchanged from the note already in Plans.jsx.

create table if not exists plans (
    id          uuid primary key default gen_random_uuid(),
    slug        text not null unique,
    name        text not null,
    description text not null default '',
    badge       text,
    -- Ordered list of feature bullets, shown on the pricing card.
    features    jsonb not null default '[]'::jsonb,
    -- Validated on write by app/schemas/plan.py::PlanLimits. jsonb rather
    -- than columns because the shape is expected to grow, and the quota
    -- reader tolerates absent keys by treating them as unconstrained.
    limits      jsonb not null default '{}'::jsonb,
    sort_order  integer not null default 0,
    is_default  boolean not null default false,
    is_visible  boolean not null default true,
    archived_at timestamptz,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

-- Exactly one default plan, enforced by the database rather than by
-- application code that a second concurrent writer could race.
create unique index if not exists idx_plans_single_default
    on plans (is_default) where is_default;

create index if not exists idx_plans_sort on plans (sort_order, created_at);

alter table plans enable row level security;
-- No policy: service-role only, matching app_settings and audit_log.
--
-- RLS decides which ROWS a role may touch; the grant decides whether it may
-- touch the table AT ALL. A table created by raw SQL does not inherit the
-- privileges Supabase attaches to tables made through its UI, so without
-- this every read fails with 42501 "permission denied for table plans" and
-- reaches the client as a 500. See the Grants section of schema.sql, which
-- documents the same trap.
grant all on table public.plans to service_role;

alter table profiles add column if not exists plan_id uuid
    references plans(id) on delete set null;
create index if not exists idx_profiles_plan on profiles (plan_id);

-- Seeded from the copy previously hardcoded in Plans.jsx, so the catalog
-- starts out saying exactly what the product said before this migration.
-- 'pro' has requests_per_day null, which the quota reader treats as
-- unlimited (see PlanLimits.is_unlimited).
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
