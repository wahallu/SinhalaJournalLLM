-- Migrate authentication off Supabase Auth and into this backend.
--
-- Supabase stays as Postgres + PostgREST. Only the identity layer moves:
-- credentials come out of auth.users and into app_users, which this app
-- owns and writes.
--
-- RUN THIS ONCE, in the Supabase SQL editor, as a single transaction.
-- Take a backup first — step 3 rewrites foreign keys on every table that
-- references a user.
--
-- ── What happens to existing users ──
-- Their bcrypt hashes are copied verbatim. Supabase/GoTrue writes $2a$
-- bcrypt and this backend verifies that format, so everyone keeps their
-- current password and nobody is forced to reset.
--
-- The exception is anyone who signed up through an OAuth provider rather
-- than email+password: those rows have no encrypted_password, so they get
-- NULL and cannot log in until they use "forgot password" to set one.
-- Step 1 reports how many that is before you commit.

begin;

-- ── 0. Who cannot be migrated ────────────────────────────────────────────
-- Read this notice before committing. A non-zero count means that many
-- people must set a password via the reset flow.
do $$
declare
    oauth_only integer;
begin
    select count(*) into oauth_only
    from auth.users
    where encrypted_password is null or encrypted_password = '';
    raise notice 'Users without a password hash (OAuth-only, must reset): %', oauth_only;
end $$;

-- ── 1. Credentials table ─────────────────────────────────────────────────
-- Email is stored lowercased with a unique index rather than using citext,
-- so this does not depend on an extension being enabled. The application
-- lowercases on the way in; the constraint is what actually guarantees it.
create table if not exists app_users (
    id             uuid primary key default gen_random_uuid(),
    email          text not null,
    password_hash  text,
    email_verified boolean not null default false,
    created_at     timestamptz not null default now(),
    constraint app_users_email_lowercase check (email = lower(email))
);

create unique index if not exists idx_app_users_email on app_users (email);

-- ── 2. Copy existing identities across ───────────────────────────────────
-- ids are preserved, which is what keeps every existing profiles row,
-- history row and telemetry row pointing at the right person.
insert into app_users (id, email, password_hash, email_verified, created_at)
select
    u.id,
    lower(u.email),
    nullif(u.encrypted_password, ''),
    u.email_confirmed_at is not null,
    u.created_at
from auth.users u
where u.email is not null
on conflict (id) do nothing;

-- ── 3. Repoint every foreign key at app_users ────────────────────────────
-- Constraint names are Postgres defaults (<table>_<column>_fkey). If any
-- were renamed by hand, adjust the drops.
alter table profiles              drop constraint if exists profiles_id_fkey;
alter table profiles              add  constraint profiles_id_fkey
    foreign key (id) references app_users(id) on delete cascade;

alter table grammar_corrections   drop constraint if exists grammar_corrections_user_id_fkey;
alter table grammar_corrections   add  constraint grammar_corrections_user_id_fkey
    foreign key (user_id) references app_users(id) on delete cascade;

alter table headline_generations  drop constraint if exists headline_generations_user_id_fkey;
alter table headline_generations  add  constraint headline_generations_user_id_fkey
    foreign key (user_id) references app_users(id) on delete cascade;

alter table style_rewrites        drop constraint if exists style_rewrites_user_id_fkey;
alter table style_rewrites        add  constraint style_rewrites_user_id_fkey
    foreign key (user_id) references app_users(id) on delete cascade;

alter table summaries             drop constraint if exists summaries_user_id_fkey;
alter table summaries             add  constraint summaries_user_id_fkey
    foreign key (user_id) references app_users(id) on delete cascade;

alter table request_telemetry     drop constraint if exists request_telemetry_user_id_fkey;
alter table request_telemetry     add  constraint request_telemetry_user_id_fkey
    foreign key (user_id) references app_users(id) on delete set null;

alter table audit_log             drop constraint if exists audit_log_actor_id_fkey;
alter table audit_log             add  constraint audit_log_actor_id_fkey
    foreign key (actor_id) references app_users(id) on delete set null;

alter table app_settings          drop constraint if exists app_settings_updated_by_fkey;
alter table app_settings          add  constraint app_settings_updated_by_fkey
    foreign key (updated_by) references app_users(id) on delete set null;

alter table usage_daily           drop constraint if exists usage_daily_user_id_fkey;
alter table usage_daily           add  constraint usage_daily_user_id_fkey
    foreign key (user_id) references app_users(id) on delete set null;

-- ── 4. Single-use email tokens ───────────────────────────────────────────
-- Only the SHA-256 of the token is stored, so a leaked row cannot be
-- replayed as a working link. used_at makes a token single-use.
create table if not exists auth_email_tokens (
    id         uuid primary key default gen_random_uuid(),
    user_id    uuid not null references app_users(id) on delete cascade,
    token_hash text not null,
    purpose    text not null check (purpose in ('verify', 'reset')),
    expires_at timestamptz not null,
    used_at    timestamptz,
    created_at timestamptz not null default now()
);

create index if not exists idx_auth_email_tokens_hash on auth_email_tokens (token_hash);
create index if not exists idx_auth_email_tokens_user on auth_email_tokens (user_id, purpose);

alter table auth_email_tokens enable row level security;

-- ── 5. Stop mirroring auth.users into profiles ───────────────────────────
-- This backend now creates the profiles row itself, inside the same signup
-- request that creates the app_users row.
drop trigger  if exists on_auth_user_created on auth.users;
drop function if exists handle_new_user();

-- ── 6. Drop the RLS policies that keyed off Supabase Auth ────────────────
-- They read auth.uid(), which is populated from a Supabase-issued JWT.
-- Tokens are ours now, so those policies can never match again and would
-- silently deny everything.
--
-- Row level security stays ENABLED with no policies. That is deliberate and
-- is stricter than before: the anon and authenticated roles can now read
-- nothing at all, and the browser no longer talks to PostgREST. Only the
-- backend's service-role key reaches this data, and per-user scoping is
-- enforced by the explicit user_id filters every repository already passes.
drop policy if exists own_grammar     on grammar_corrections;
drop policy if exists own_headlines   on headline_generations;
drop policy if exists own_styles      on style_rewrites;
drop policy if exists own_summaries   on summaries;
drop policy if exists own_profile     on profiles;
drop policy if exists own_profile_upd on profiles;
drop policy if exists read_categories on user_categories;

alter table app_users enable row level security;

commit;

-- ── After committing ─────────────────────────────────────────────────────
-- Verify before pointing traffic at it:
--
--   select count(*) from auth.users;
--   select count(*) from app_users;                      -- should match
--   select count(*) from app_users where password_hash is null;  -- OAuth-only
--   select count(*) from profiles p
--     left join app_users u on u.id = p.id where u.id is null;   -- must be 0
--
-- auth.users is left in place untouched. Once the new sign-in is confirmed
-- working, it can be ignored; Supabase Auth is simply no longer consulted.
