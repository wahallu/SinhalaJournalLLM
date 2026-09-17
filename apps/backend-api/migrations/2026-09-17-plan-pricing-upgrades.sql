-- Plan pricing, and a bank-transfer upgrade request workflow.
--
-- There is no payment gateway. Rather than fake a checkout, an upgrade is a
-- REQUEST: the user sees the newsroom's bank details and a reference to quote,
-- pays by transfer, and submits the reference. An admin confirms the money
-- landed and approves, which is the only thing that moves the user's plan.
-- Nothing in this schema implies a charge was taken automatically.

-- ── Pricing ──
-- Stored in minor units (cents/සත) as integers, never floats: 2500.00 is not
-- representable in binary floating point and money that drifts by a cent is
-- money an accountant has to chase.
alter table plans add column if not exists price_cents        integer;
alter table plans add column if not exists annual_price_cents integer;
alter table plans add column if not exists currency           text not null default 'LKR';
alter table plans add column if not exists billing_period     text not null default 'monthly'
    check (billing_period in ('monthly', 'yearly', 'one_off'));

-- A null price means "no price shown", which is what Free wants.
alter table plans add constraint plans_price_nonneg
    check (price_cents is null or price_cents >= 0) not valid;
alter table plans add constraint plans_annual_price_nonneg
    check (annual_price_cents is null or annual_price_cents >= 0) not valid;

-- ── Upgrade requests ──
create table if not exists plan_upgrade_requests (
    id             uuid primary key default gen_random_uuid(),
    user_id        uuid not null references auth.users(id) on delete cascade,
    plan_id        uuid not null references plans(id) on delete cascade,
    -- What they were on when they asked, so an approval that arrives after a
    -- later change is still interpretable.
    from_plan_id   uuid references plans(id) on delete set null,
    status         text not null default 'pending'
                     check (status in ('pending', 'approved', 'declined', 'cancelled')),
    -- The reference the user quotes on their bank transfer. Free text by
    -- necessity -- it is whatever their bank printed on the slip.
    payment_reference text,
    note           text,
    -- Set when an admin decides. reviewer_note is shown back to the user, so
    -- a decline can say why.
    reviewed_by    uuid references auth.users(id) on delete set null,
    reviewed_at    timestamptz,
    reviewer_note  text,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

-- One open request per user. A second "upgrade me" click while the first is
-- still pending is a duplicate, not a new intent -- and two pending rows for
-- one account is a race an admin would have to resolve by hand.
create unique index if not exists idx_upgrade_one_pending_per_user
    on plan_upgrade_requests (user_id) where status = 'pending';

create index if not exists idx_upgrade_status  on plan_upgrade_requests (status, created_at desc);
create index if not exists idx_upgrade_user    on plan_upgrade_requests (user_id, created_at desc);

alter table plan_upgrade_requests enable row level security;
-- No policy: service-role only, matching every other operational table.
-- The grant is what actually opens the door -- see schema.sql's Grants note,
-- and the 42501 outage that followed forgetting it for `plans`.
grant all on table public.plan_upgrade_requests to service_role;

-- Re-granting plans is a no-op where it already applied, and repairs a
-- database that only ran the earlier migration.
grant all on table public.plans to service_role;
