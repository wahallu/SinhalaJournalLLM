-- Run this once in Supabase Studio's SQL editor (or via `psql`).
-- The app no longer auto-creates tables on startup (that was SQLAlchemy's
-- Base.metadata.create_all, which doesn't apply now that the app talks to
-- Supabase over PostgREST instead of a direct SQLAlchemy connection).

create table if not exists grammar_corrections (
    id uuid primary key default gen_random_uuid(),
    original_text text not null,
    corrected_text text not null,
    corrections jsonb not null default '[]'::jsonb,
    correction_count integer not null default 0,
    created_at timestamptz not null default now()
);
