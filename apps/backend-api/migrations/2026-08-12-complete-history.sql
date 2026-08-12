-- Complete History → Reopen workspace state.
-- Safe to run more than once in Supabase SQL Editor.
--
-- All four tools are restored by GET /history/{tool}/{record_id}. Most of
-- their required full-text columns already exist in the original schema:
--
--   grammar_corrections:  original_text, corrected_text, corrections,
--                         correction_count
--   headline_generations: article_text, headlines, count
--   style_rewrites:       original_text, rewritten_text, style
--   summaries:            original_text, summary_text, length
--
-- Therefore this migration only ADDS data that was genuinely missing:
-- grammar's advisory suggestions, plus headline options and media. The
-- rewriter and summarizer need no duplicate columns or data migration—their
-- complete inputs and outputs are read directly from the existing columns.

alter table grammar_corrections
    add column if not exists suggestions jsonb not null default '[]'::jsonb;

alter table headline_generations add column if not exists category text not null default 'General';
alter table headline_generations add column if not exists length text not null default 'medium';
alter table headline_generations add column if not exists adapter text;
alter table headline_generations add column if not exists requested_count integer;
alter table headline_generations add column if not exists visual_prompt text;
alter table headline_generations add column if not exists image_url text;
alter table headline_generations add column if not exists image_public_id text;
alter table headline_generations add column if not exists image_model text;
