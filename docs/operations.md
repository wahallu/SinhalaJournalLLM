# Operating SinAi

Everything an administrator needs after the app is deployed. Setup is in
[auth-setup.md](auth-setup.md).

## The admin dashboard

`/admin`, visible only to accounts with `profiles.role = 'admin'`. A non-admin
who navigates there is redirected to `/dashboard` rather than shown a
"forbidden" page — a 403 would advertise that the surface exists.

| Page | What it is for |
|---|---|
| Overview | User counts, requests over time, tool and provider mix, error rate. 7/30/90-day range. |
| Users | Search and filter accounts; open one to change role, status or category and read their history. |
| Categories | Create, edit and retire the categories users pick from. |
| Activity | The audit log, and a filterable view of individual requests. |
| Settings | Model provider, tool availability, global defaults, anonymous rate limit. |
| Research | SinLLaMA Playground, Summarizer Lab, Model Comparison. |

## Settings

Changes apply immediately in the instance that made them and reach other
instances within **30 seconds** — values are cached rather than read per
request, since the model gateway consults them on every inference call.

| Key | Effect |
|---|---|
| `model.provider` | Which provider runs inference: `sinllama`, `openrouter`, `mock`. |
| `model.fallback_enabled` | Fall through the chain on failure instead of returning 503. |
| `features.*` | Turn a tool off. Its endpoint returns 503 and it disappears from the sidebar; **its history stays readable**. |
| `defaults.*` | Starting values for users who have not chosen their own. A user's own choice always wins. |
| `limits.anon_per_hour` | Requests an unauthenticated visitor may make per hour, per IP. |

**What is deliberately not settable:** every secret and service URL, including
`SINLLAMA_API_URL`. Those live in `.env` and change only by redeploy. A
DB-editable inference endpoint would let one compromised admin account
redirect every article to a host they control.

Adding a key means adding it to `app/core/settings_registry.py`; the admin UI
builds itself from what the API returns, so no frontend change is needed.

## Rate limiting

Anonymous callers are capped per hour per IP. The client IP is taken from the
**right-hand** end of `X-Forwarded-For`, using `TRUSTED_PROXY_COUNT` (default
1, for Render's load balancer). This matters: proxies *append*, so the
leftmost entry is whatever the caller sent. Reading it left-first let anyone
rotate the header and bypass the cap entirely.

Set `TRUSTED_PROXY_COUNT` to the real chain length if you add a CDN. Too high
and callers can spoof again; too low and everyone behind the proxy shares one
bucket.

IPs are never stored raw — only `sha256(ip + IP_HASH_SALT)`.

## Telemetry, rollups and retention

Every tool request writes a row to `request_telemetry`. That table is
high-write, so it is aggregated nightly into `usage_daily` and then pruned.

Schedule the job once, after applying `schema.sql`:

```sql
select cron.schedule(
    'sinai-nightly-rollup', '15 2 * * *',
    $$ select public.roll_up_usage((now() - interval '1 day')::date);
       select public.prune_telemetry(30); $$
);
```

Verify it exists and check when it last ran:

```sql
select jobname, schedule, active from cron.job;
select status, start_time, return_message
from cron.job_run_details order by start_time desc limit 5;
```

`roll_up_usage` deletes the target day before reinserting, so re-running it
for a day is safe and does not double-count. Backfill a specific day with
`select public.roll_up_usage('2026-07-30');`.

**What pruning costs you:** per-request detail older than the retention window
is gone — you can no longer see individual latencies or which IP hash made a
call. The daily totals in `usage_daily` survive indefinitely, so charts keep
working over any range. Until the job has run at least once, Overview scans
raw telemetry directly and labels itself "live scan".

## The audit log

Every privileged change writes a row: who, what, before, after. Readable in
Activity, or directly:

```sql
select created_at, actor_email, action, target_id, before, after
from audit_log order by created_at desc limit 50;
```

`actor_email` is denormalized so the trail stays readable after an account is
deleted, and `profiles.email` is locked by a database trigger so it cannot be
rewritten to forge an entry.

## Promoting an administrator

The first admin is set by hand — any in-app path to it would be a
self-promotion hole:

```sql
update profiles set role = 'admin' where email = 'you@example.com';
```

After that, promote from Users → open the account → Role. An admin cannot
demote or suspend **themselves**, which is what stops you locking every
administrator out.

## Suspending an account

Suspension is the reversible action and preserves everything. A suspended
account is rejected with 403 on every authenticated route. They can still use
the four writing tools signed out — suspension revokes account privileges, not
access to a publicly available tool.

Hard-deleting a user cascades and destroys their history with them.

## When something looks wrong

| Symptom | Where to look |
|---|---|
| Blank page after deploy | The container needs `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` as **build args** — Vite inlines them at build time. |
| `permission denied for table …` | `schema.sql` grants have not been applied. Re-run the whole file. |
| Anonymous requests failing | Check `request_telemetry` is readable by `service_role`; rate limiting reads it before inference. |
| Overview empty | Expected before the first nightly rollup — it should say "live scan". If it still shows nothing, there is no telemetry yet. |
| A tool vanished for users | Check Settings → Tools. A disabled tool is hidden and its endpoint returns 503. |
| Setting change not taking effect | Up to 30 seconds on other instances. Confirm it in the audit log. |
