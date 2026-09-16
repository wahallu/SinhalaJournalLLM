-- Admin-controlled call-to-action on each plan card.
--
-- Every card used to render a disabled "Coming soon" button, because there
-- is no billing to point one at. That is honest but dead: three buttons on
-- the pricing page that do nothing. The label and destination are the
-- admin's to set instead — a waitlist form, a mailto, or nothing at all.
--
-- An empty cta_label renders no button, which is the right default for a
-- tier with nowhere to send people yet.

alter table plans add column if not exists cta_label text;
alter table plans add column if not exists cta_href  text;

-- The seeded tiers start with no CTA rather than a guess at one; the button
-- simply does not render until an admin sets a label at /admin/plans.

-- Grants are per-table, not per-column, so the existing grant covers these.
-- Included for a database that somehow missed it; granting twice is a no-op.
grant all on table public.plans to service_role;
