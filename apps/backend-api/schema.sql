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
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now(),
    last_seen_at timestamptz
);

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
    created_at    timestamptz not null default now()
);

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
