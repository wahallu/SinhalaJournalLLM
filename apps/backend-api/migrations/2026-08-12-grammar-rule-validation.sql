-- Additive persistence for the hybrid Sinhala grammar validator.
-- Safe to run repeatedly.

alter table grammar_corrections
    add column if not exists model_candidate text;

alter table grammar_corrections
    add column if not exists validation jsonb not null default '{}'::jsonb;

-- Counts, decision, and rule IDs only. Full article text is deliberately not
-- duplicated into request telemetry.
alter table request_telemetry
    add column if not exists grammar_validation jsonb;
