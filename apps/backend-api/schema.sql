-- Run this once in Supabase Studio's SQL editor (or via `psql`).
-- Safe to re-run: everything is `if not exists`.
--
-- The app talks to Supabase over PostgREST, so there is no ORM-side table
-- creation; this file is the single source of truth for the schema.

-- ── Grammar checker ──
create table if not exists grammar_corrections (
    id uuid primary key default gen_random_uuid(),
    original_text text not null,
    corrected_text text not null,
    corrections jsonb not null default '[]'::jsonb,
    correction_count integer not null default 0,
    model_provider text,
    latency_ms integer,
    created_at timestamptz not null default now()
);

-- Columns added after the first deploy (no-ops on fresh databases).
alter table grammar_corrections add column if not exists model_provider text;
alter table grammar_corrections add column if not exists latency_ms integer;
alter table grammar_corrections add column if not exists suggestions jsonb not null default '[]'::jsonb;

-- Which LoRA adapter actually served the request (server-resolved: an admin
-- override, or whatever the model server picked as newest at its own last
-- restart — the two can silently diverge, see adapters.grammar). Admin-only:
-- surfaced in the Chats view so a mismatch between what an admin *thinks* is
-- live and what a request actually used is diagnosable after the fact,
-- rather than invisible. Never returned by the grammar API to a caller.
alter table grammar_corrections add column if not exists adapter text;

-- ── Headline generator ──
create table if not exists headline_generations (
    id uuid primary key default gen_random_uuid(),
    article_text text not null,
    headlines jsonb not null default '[]'::jsonb,
    count integer not null default 0,
    model_provider text,
    latency_ms integer,
    created_at timestamptz not null default now()
);

-- Workspace state needed to reopen a headline run exactly as it appeared.
alter table headline_generations add column if not exists category text not null default 'General';
alter table headline_generations add column if not exists length text not null default 'medium';
alter table headline_generations add column if not exists adapter text;
alter table headline_generations add column if not exists requested_count integer;
alter table headline_generations add column if not exists visual_prompt text;
alter table headline_generations add column if not exists image_url text;
alter table headline_generations add column if not exists image_public_id text;
alter table headline_generations add column if not exists image_model text;

-- ── Style rewriter ──
create table if not exists style_rewrites (
    id uuid primary key default gen_random_uuid(),
    original_text text not null,
    rewritten_text text not null,
    style text not null default 'formal',
    model_provider text,
    latency_ms integer,
    created_at timestamptz not null default now()
);

-- ── Summarizer ──
create table if not exists summaries (
    id uuid primary key default gen_random_uuid(),
    original_text text not null,
    summary_text text not null,
    length text not null default 'medium',
    model_provider text,
    latency_ms integer,
    created_at timestamptz not null default now()
);

-- ── History indexes (unified feed reads newest-first from all four) ──
create index if not exists idx_grammar_corrections_created_at
    on grammar_corrections (created_at desc);
create index if not exists idx_headline_generations_created_at
    on headline_generations (created_at desc);
create index if not exists idx_style_rewrites_created_at
    on style_rewrites (created_at desc);
create index if not exists idx_summaries_created_at
    on summaries (created_at desc);

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
    newsroom_roles text[] not null default array[]::text[],
    journalism_interests text[] not null default array[]::text[],
    onboarding_completed_at timestamptz,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now(),
    last_seen_at timestamptz
);

-- Additive onboarding fields for databases created before this flow existed.
alter table profiles add column if not exists newsroom_roles text[] not null default array[]::text[];
alter table profiles add column if not exists journalism_interests text[] not null default array[]::text[];
alter table profiles add column if not exists onboarding_completed_at timestamptz;

create index if not exists idx_profiles_role     on profiles (role);
create index if not exists idx_profiles_category on profiles (category_id);

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
    adapter       text,
    created_at    timestamptz not null default now()
);

-- Added after the first deploy (no-op on fresh databases) — same field as
-- grammar_corrections.adapter above, for the per-request telemetry row.
alter table request_telemetry add column if not exists adapter text;

create index if not exists idx_telemetry_created  on request_telemetry (created_at desc);
create index if not exists idx_telemetry_user     on request_telemetry (user_id, created_at desc);
create index if not exists idx_telemetry_ip       on request_telemetry (ip_hash, created_at desc);

alter table grammar_corrections  add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table headline_generations add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table style_rewrites       add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table summaries            add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists idx_grammar_user   on grammar_corrections  (user_id, created_at desc);
create index if not exists idx_headline_user  on headline_generations (user_id, created_at desc);
create index if not exists idx_style_user     on style_rewrites       (user_id, created_at desc);
create index if not exists idx_summaries_user on summaries            (user_id, created_at desc);

-- Token counts alongside the run they belong to.
--
-- request_telemetry already had these columns but nothing ever wrote them;
-- they are populated now too. They are duplicated onto the history tables
-- because the admin "Chats" view needs tokens next to the text of the run,
-- and there is no key joining a telemetry row to the history row it
-- describes — both are independent inserts from the same request.
--
-- Only the sinllama provider reports token counts. openrouter returns just
-- the model name and mock returns nothing, so rows produced by those
-- providers keep NULL here rather than a misleading zero.
alter table grammar_corrections  add column if not exists input_tokens  integer;
alter table grammar_corrections  add column if not exists output_tokens integer;
alter table headline_generations add column if not exists input_tokens  integer;
alter table headline_generations add column if not exists output_tokens integer;
alter table style_rewrites       add column if not exists input_tokens  integer;
alter table style_rewrites       add column if not exists output_tokens integer;
alter table summaries            add column if not exists input_tokens  integer;
alter table summaries            add column if not exists output_tokens integer;

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
drop policy if exists own_profile_upd  on profiles;
drop policy if exists read_categories  on user_categories;

create policy own_profile     on profiles        for select to authenticated using (id = auth.uid());
create policy own_profile_upd on profiles        for update to authenticated using (id = auth.uid());
create policy read_categories on user_categories for select to authenticated using (is_active);

-- request_telemetry: no policy at all => authenticated and anon are denied
-- everything. Only the service role touches it.

insert into user_categories (name, slug, description, sort_order) values
    ('Journalist', 'journalist', 'Working newsroom journalist',        1),
    ('Student',    'student',    'Journalism or media student',        2),
    ('Editor',     'editor',     'Desk editor or sub-editor',          3),
    ('Researcher', 'researcher', 'Academic or language researcher',    4),
    ('Other',      'other',      'Everyone else',                      99)
on conflict (slug) do nothing;

-- ── Audit log — every privileged mutation ──
-- actor_email is denormalized on purpose: the trail must stay readable
-- after the actor's account is deleted.
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
-- role touches this table, via require_admin-gated endpoints.

-- ── Runtime application settings ──
-- Key/value so adding a knob is an INSERT, not a migration. Only keys in
-- app/core/settings_registry.py are accepted; anything else is rejected by
-- the API before it reaches this table.
create table if not exists app_settings (
    key        text primary key,
    value      jsonb not null,
    updated_by uuid references auth.users(id) on delete set null,
    updated_at timestamptz not null default now()
);

alter table app_settings enable row level security;
-- No policy: authenticated and anon are denied everything. Only the service
-- role reads and writes, via require_admin-gated endpoints.

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

-- ── Grants ──
-- RLS decides which ROWS a role may touch; grants decide whether it may
-- touch the table at all. Tables created by raw SQL do not inherit the
-- privileges Supabase attaches to tables made through its UI, so without
-- these every service-role read fails with "permission denied" — which
-- surfaced as a 500 on every anonymous request, since rate limiting reads
-- request_telemetry before any inference happens.
--
-- service_role bypasses RLS by design and needs full access.
-- authenticated gets only what a policy could then narrow; tables with no
-- policy are intentionally left ungranted, so they stay service-role only.

grant all on table public.profiles           to service_role;
grant all on table public.user_categories    to service_role;
grant all on table public.request_telemetry  to service_role;
grant all on table public.audit_log          to service_role;
grant all on table public.app_settings       to service_role;
grant all on table public.usage_daily        to service_role;
grant all on table public.grammar_corrections  to service_role;
grant all on table public.headline_generations to service_role;
grant all on table public.style_rewrites       to service_role;
grant all on table public.summaries            to service_role;

-- Row-level policies constrain these further; the grant only opens the door.
grant select, update on table public.profiles        to authenticated;
grant select          on table public.user_categories to authenticated;
grant select, insert, delete on table public.grammar_corrections  to authenticated;
grant select, insert, delete on table public.headline_generations to authenticated;
grant select, insert, delete on table public.style_rewrites       to authenticated;
grant select, insert, delete on table public.summaries            to authenticated;

-- ── Hardening applied after review ──

-- guard_profile_privileges previously gated on request.jwt.claims, a GUC that
-- PostgREST sets but nothing else does. Any UPDATE from a session that does
-- not set it — the Studio table editor, a pg_cron job, direct psql — skipped
-- the guard entirely. Gate on the actual database role instead, so the check
-- is a boundary rather than a convention.
--
-- Also locks `email`: deps.py and audit_log.actor_email both trust it, so a
-- user able to rewrite their own email could forge the audit trail and
-- confuse admin search.
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if current_user not in ('service_role', 'supabase_admin', 'postgres') then
        if new.role is distinct from old.role then
            raise exception 'role may only be changed by an administrator';
        end if;
        if new.status is distinct from old.status then
            raise exception 'status may only be changed by an administrator';
        end if;
        if new.email is distinct from old.email then
            raise exception 'email is managed by authentication and cannot be edited here';
        end if;
        if new.id is distinct from old.id then
            raise exception 'profile id cannot be changed';
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

-- ─────────────────────────────────────────────────────────────────────────
-- Research instrumentation (added 2026-08-10)
--
-- The tool is being given to university journalism students via WhatsApp, so
-- almost every session is anonymous and there is no recruitment step in which
-- a participant code could be handed out. Runs are therefore grouped by a
-- device id: a UUID the browser generates on first visit and keeps in
-- localStorage, sent as the X-Anon-Id header.
--
-- Deliberately NOT grouped by IP. Sri Lankan mobile carriers use CGNAT and a
-- campus network is one NAT address, so IP both over-merges (a whole class
-- becomes one "user") and under-merges (wifi -> 4G -> home splits one student
-- into three). ip_hash stays exactly where it was, feeding rate limiting only.
--
-- A device id is not a person: it does not survive a cleared browser, and a
-- shared machine merges its users. Good enough to group a work session, and
-- the analysis must not claim more than that.
-- ─────────────────────────────────────────────────────────────────────────

alter table request_telemetry     add column if not exists anon_id    text;
alter table request_telemetry     add column if not exists session_id text;
alter table grammar_corrections   add column if not exists anon_id    text;
alter table grammar_corrections   add column if not exists session_id text;
alter table headline_generations  add column if not exists anon_id    text;
alter table headline_generations  add column if not exists session_id text;
alter table style_rewrites        add column if not exists anon_id    text;
alter table style_rewrites        add column if not exists session_id text;
alter table summaries             add column if not exists anon_id    text;
alter table summaries             add column if not exists session_id text;

create index if not exists idx_telemetry_anon on request_telemetry    (anon_id, created_at desc);
create index if not exists idx_grammar_anon   on grammar_corrections  (anon_id, created_at desc);
create index if not exists idx_headline_anon  on headline_generations (anon_id, created_at desc);
create index if not exists idx_style_anon     on style_rewrites       (anon_id, created_at desc);
create index if not exists idx_summaries_anon on summaries            (anon_id, created_at desc);

-- Which corrections and spelling suggestions a journalist actually took.
--
-- This is the point of the whole exercise. Raw input/output says what the
-- model did, not whether it was right, and finding out costs hand-labelling.
-- An accept/reject click is ground truth the moment it happens: every rejected
-- dictionary flag is a measured false positive, and every reverted correction
-- is the over-correction failure mode this project spent v17-v18 removing.
--
-- `kind` distinguishes an edit the model applied ('correction') from an
-- advisory lexicon flag ('suggestion'), because their precision is measured
-- separately and only the latter is expected to be noisy.
create table if not exists suggestion_events (
    id          uuid primary key default gen_random_uuid(),
    run_id      uuid,
    user_id     uuid references auth.users(id) on delete set null,
    anon_id     text,
    session_id  text,
    tool        text not null,
    kind        text not null check (kind in ('correction', 'suggestion')),
    action      text not null check (action in ('shown', 'accepted', 'rejected')),
    original    text,
    proposed    text,
    rule        text,
    position    integer,
    adapter     text,
    created_at  timestamptz not null default now()
);

create index if not exists idx_sugg_run     on suggestion_events (run_id);
create index if not exists idx_sugg_anon    on suggestion_events (anon_id, created_at desc);
create index if not exists idx_sugg_action  on suggestion_events (tool, kind, action);
