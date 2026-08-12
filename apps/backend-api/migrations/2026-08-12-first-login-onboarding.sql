-- First-login newsroom onboarding preferences.
-- Existing accounts intentionally remain incomplete and see the flow once.

alter table public.profiles
    add column if not exists newsroom_roles text[] not null default array[]::text[];

alter table public.profiles
    add column if not exists journalism_interests text[] not null default array[]::text[];

alter table public.profiles
    add column if not exists onboarding_completed_at timestamptz;
