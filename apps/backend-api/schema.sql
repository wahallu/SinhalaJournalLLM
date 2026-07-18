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
