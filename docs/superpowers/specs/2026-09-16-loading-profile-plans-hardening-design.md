# Loading, Profile, Plans, and Production Hardening — Design

**Date:** 2026-09-16
**Status:** Approved, ready for implementation planning
**Scope:** `apps/web-app` and `apps/backend-api`. New database migration.

---

## 1. Goal

Four independent pieces of work, delivered as four phases that each ship on their own:

1. **Loading** — stop the app painting unstyled text before React mounts.
2. **Profile** — collapse five tabs into three and delete the information that tells the user nothing.
3. **Plans** — turn a hardcoded marketing page into an admin-owned catalog with per-user assignment and enforced quotas.
4. **Hardening** — close the real production gaps in the app shell and the API.

Phases 1, 2 and 4 are independent. Phase 3 depends on nothing but is the largest, and is the only phase with a schema change.

## 2. Decisions

Each records the alternative rejected, so a later reader knows the choice was deliberate.

| # | Decision | Rejected alternative |
|---|---|---|
| D1 | **`/` stops being prerendered with SEO markup.** The app entry gets a branded splash instead. | Keeping the prerender and styling it. `/` is the application, not a landing page — its prerendered copy is duplicated verbatim by `/sinhala-ai`, which exists for exactly this purpose. Crawler coverage is unchanged. |
| D2 | **The five SEO landing paths keep their prerender, plus inline critical CSS.** | Removing their prerender too. These pages exist to be crawled with content in the HTML; removing it defeats them. Styling the markup is what stops a human seeing Times New Roman. |
| D3 | **Route-level code splitting via `React.lazy`.** | Leaving one 1.06 MB chunk. The admin console (14 components plus `recharts`) is in the bundle every anonymous visitor downloads before the splash can clear. |
| D4 | **The splash lives in `index.html` as inline markup and inline CSS**, removed by React on mount. | A React-rendered loader. A React loader cannot render until the bundle it is waiting for has already parsed — it solves nothing. |
| D5 | **Personalization tab is deleted, not merged.** | Merging its content into Preferences. It held no state of its own: it was a read-only mirror of Newsroom and Interests with Edit links pointing at the two tabs it is now being merged with. Mirroring a section into the section it lives in is circular. |
| D6 | **Preferences uses collapsible groups with a summary line when collapsed.** | One long expanded scroll. Three groups of which one (Interests) is a 12-chip grid — collapsed summaries keep the whole surface visible at once. |
| D7 | **`ProfilePage.jsx` splits into `components/profile/*`.** | Editing it in place. It is 534 lines holding five panels, a nav, and four presentational helpers; the panels are what changes and they should be separately readable. |
| D8 | **Plan limits live in a `jsonb` column, not in `settings_registry`.** | Adding plan keys to the registry. The registry is a fixed whitelist of global scalars — correct for `model.provider`, wrong for a variable-length catalog of tiers an admin creates and deletes at runtime. |
| D9 | **Quota counts from `request_telemetry`,** reusing the anonymous rate-limit pattern. | A dedicated counter table or an in-memory counter. `rate_limit.py` already counts this way precisely because an in-memory counter is wrong across multiple instances. A second mechanism would be a second thing to keep correct. |
| D10 | **Quota fails open** on a telemetry read error. | Failing closed. Matches `enforce_anonymous_limit`, which documents the reasoning: a storage blip must not become a total outage. |
| D11 | **Admins bypass quota; `limit` of `null` or `0` means unlimited.** | Enforcing against everyone. An admin locked out of their own console by a quota they set cannot fix it. |
| D12 | **Existing profiles are backfilled to the default plan by migration.** | Resolving `null` → default at read time. A backfill means the quota lookup has exactly one shape and no fallback branch to get wrong. |
| D13 | **No billing, no payment, no price fields.** | Adding prices now. Unchanged from the reasoning already recorded in `Plans.jsx`: a price that cannot be charged is the least production-ready thing in the product. |
| D14 | **Hardening is scoped to identified gaps only.** | A broad "production-grade" sweep. The API already has health checks, an audit log, telemetry, salted IP hashing, CORS-safe error handling, a settings whitelist and 45 test files. §6 lists what is genuinely absent. |

---

## 3. Phase 1 — Loading

### 3.1 Root cause

`vite.config.js` `seoPrerenderPlugin.writeBundle()` iterates `SEO_PAGES` and writes `staticPageMarkup(page)` into `<div id="root">`. `SEO_PAGES` includes `path: '/'`, and for that entry the destination is `dist/index.html` itself — the application's own entry document.

`staticPageMarkup` emits markup with no class attributes:

```html
<div data-seo-prerendered="true">
  <header><nav aria-label="Main navigation"><a href="/">SinAi</a> …
  <h1>Sinhala AI for news and everyday writing</h1>
  <p>SinAi brings four focused Sinhala writing tools into one browser workspace…
```

The browser paints that at first contentful paint: default serif headings, blue underlined links, full width. `createRoot(...).render()` then discards it. The window between the two is governed by `dist/assets/index-*.js`, currently **1,059,019 bytes in a single chunk**.

Two render-blocking stylesheets in `<head>` (Fontshare, Google Fonts) delay first paint further, which makes the unstyled flash land later and more visibly.

### 3.2 Changes

**`vite.config.js`** — `writeBundle` skips the entry whose `path === '/'` when writing prerendered markup, and writes the managed `<head>` block for `/` only. The five landing paths are unaffected.

**`index.html`** — `#root` ships with splash markup and an inline `<style>` block. Inline because an external stylesheet is another round trip before the splash can paint, which is the problem being solved. The splash carries the wordmark, the brand ramp's `--color-brand-600` (`#cd191a`), and a spinner. It must render correctly with no webfont loaded, so it uses the system stack and does not depend on Gwen or Satoshi.

**`main.jsx`** — removes the splash node immediately before `render()`. A `.sinai-splash-done` class on `<html>` guards against reflow.

**Route splitting** — `React.lazy` + `Suspense` for: the entire `/admin` subtree, `SeoLandingPage`, `Plans`, `HistoryPage`, `OptimizePage`, `Onboarding`. The four writing tools and `Dashboard` stay eager — they are the first thing most sessions touch. Suspense fallback is the in-app skeleton, not the splash.

**`App.jsx` `authLoading`** — currently `<div className="h-full bg-white" />`. Becomes the same branded loading surface, so a hard refresh does not blink white between splash removal and session resolution.

**SEO landing pages** — `staticPageMarkup` gains a scoped inline `<style>` covering `[data-seo-prerendered]` descendants: typeface, spacing, brand color on links, max-width. Crawlers still receive the same text content.

### 3.3 Verification

- Built `dist/index.html` contains no `data-seo-prerendered` block.
- Built `dist/sinhala-ai/index.html` still contains one, and it now carries inline styles.
- Main chunk is materially smaller; recorded as a number in the plan.
- Browser preview under network throttling shows the splash and never unstyled text.

---

## 4. Phase 2 — Profile

### 4.1 Structure

Five tabs become three.

```
Account │ Preferences │ Security

Preferences
  ▸ Newsroom roles       Reporter · Editor
  ▸ Newsroom category    Politics
  ▾ Interests            4 of 8 selected
      [Politics] [Business] [Health] [Climate]
```

A collapsed group shows its selection as a summary line. An empty group shows its empty-state text in place of the summary. Groups are `<button aria-expanded>` + region, keyboard operable, with the first group open on mount.

### 4.2 Removals

| Removed | Reason |
|---|---|
| `Account ID` InfoCard | A truncated uppercase UUID fragment. Not a support identifier anyone asks for, not actionable. |
| `Profile set up` InfoCard | Derived from `onboarding_completed_at` to the month. Tells the user nothing they can use. |
| `Email address` InfoCard on Account | The same value appears on Security as `Sign-in email`. Security keeps it. |
| `Account status` InfoCard on Security | Reads `Active` for every user who can see it — a suspended user cannot reach this page. |
| Lock-icon explanatory paragraph on Security | Explains which fields cannot be edited, on a panel that now shows only fields that cannot be edited. |
| Entire Personalization panel | D5. |

`InfoCard`, `EmptySelection` and `PanelHeading` are retained — still used by Account and Security.

### 4.3 File layout

```
components/profile/
  ProfileNav.jsx          tablist, keyboard roving tabindex (moved as-is)
  AccountPanel.jsx        avatar, display name, verification-independent identity
  PreferencesPanel.jsx    the three collapsible groups
  SecurityPanel.jsx       sign-in email, verification state
  CollapsibleGroup.jsx    shared disclosure primitive
  InfoCard.jsx            shared, moved out of ProfilePage
```

`ProfilePage.jsx` keeps form state, the dirty check, save/reset, and the footer. State stays lifted — a single Save writes roles, interests, name and category in one `Promise.all`, and that contract is unchanged.

`variant="dialog"` and the `/profile` modal route are unchanged.

### 4.4 Verification

Existing behaviour that must still hold: dirty tracking across all four fields, the 8-interest cap, `saveOnboarding` + `setMyCategory` both firing, `refreshAccount()` after save, and the dialog rendering with its `pl-16` header offset.

---

## 5. Phase 3 — Plans

### 5.1 Schema

New migration `migrations/2026-09-16-plans.sql`.

```sql
create table if not exists plans (
    id          uuid primary key default gen_random_uuid(),
    slug        text not null unique,
    name        text not null,
    description text not null default '',
    badge       text,
    features    jsonb not null default '[]'::jsonb,   -- ordered string[]
    limits      jsonb not null default '{}'::jsonb,   -- see §5.2
    sort_order  integer not null default 0,
    is_default  boolean not null default false,
    is_visible  boolean not null default true,
    archived_at timestamptz,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

-- Exactly one default plan, enforced by the database rather than by
-- application code that can be bypassed by a second writer.
create unique index if not exists idx_plans_single_default
    on plans (is_default) where is_default;

alter table plans enable row level security;
-- No policy: service-role only, matching app_settings and audit_log.

alter table profiles add column if not exists plan_id uuid
    references plans(id) on delete set null;
create index if not exists idx_profiles_plan on profiles (plan_id);
```

Seeds `free`, `plus`, `pro` from the copy currently hardcoded in `Plans.jsx`, with `free` as `is_default`. Then backfills (D12):

```sql
update profiles set plan_id = (select id from plans where is_default)
 where plan_id is null;
```

New signups resolve to `is_default` in **`app/api/v1/auth.py::_create_profile`**, which is what actually inserts the profiles row on both password and Google signup. The `handle_new_user()` trigger in `schema.sql` is *not* extended: it is a leftover from the Supabase-Auth era, fires on `auth.users`, and is not on the current signup path. Touching it would create a second, divergent source of truth.

### 5.2 `limits` shape

```json
{
  "requests_per_day": 50,
  "tools": ["grammar", "headlines", "rewriter", "summarizer", "optimize"],
  "max_headline_count": 5
}
```

- `requests_per_day`: `null` or `0` means unlimited (D11).
- `tools`: omitted or `null` means all tools. A tool absent from a *present* list is refused with 403. Valid members are exactly the six call-site tool names in §5.4, deduplicated to five: `grammar`, `headlines`, `rewriter`, `summarizer`, `optimize`.
- `max_headline_count`: clamps `num_candidates` down, never up. Omitted or `null` means no plan-level clamp, leaving the registry's existing `defaults.headline_count` bound of 1–10 as the only constraint. A value above 10 is rejected on write rather than silently capped.

Validated by a Pydantic model on write, so an admin cannot store a shape the enforcement path will later trip over. Unknown keys are rejected rather than silently stored.

### 5.3 API

| Method | Path | Auth |
|---|---|---|
| `GET` | `/api/v1/plans` | public — visible, unarchived plans ordered by `sort_order` |
| `GET` | `/api/v1/plans/me` | user — their plan plus live `used` / `limit` / `resets_at` |
| `GET` | `/api/v1/admin/plans` | admin — all plans including hidden and archived |
| `POST` | `/api/v1/admin/plans` | admin |
| `PATCH` | `/api/v1/admin/plans/{id}` | admin |
| `DELETE` | `/api/v1/admin/plans/{id}` | admin — sets `archived_at`; refuses the default plan |
| `PATCH` | `/api/v1/admin/users/{id}/plan` | admin |

Every admin mutation writes to `audit_log`, matching the settings endpoints.

`GET /api/v1/plans` is public because `/plans` must render for signed-out visitors, and the catalog is marketing copy.

### 5.4 Enforcement

`app/core/plan_quota.py`, alongside `rate_limit.py`:

```python
async def enforce_plan_quota(request, user, tool) -> None:
    if user is None:      return   # anonymous path already handled
    if user.is_admin:     return   # D11
    plan = await resolve_plan(user)
    ...
```

Resolution order for the limit: the user's plan → the default plan → unlimited. `count_recent_by_user(user_id, since_midnight_utc)` is added to `telemetry_repository`, mirroring `count_recent_by_ip`. The day boundary is UTC midnight, matching `usage_daily.day`.

On exceed:

```
HTTP 429
{"detail": "Daily limit reached for the Free plan.",
 "quota": {"used": 50, "limit": 50, "resets_at": "2026-09-17T00:00:00Z"}}
```

Tool refused by plan is `403` with a distinct detail, so the client can tell "come back tomorrow" from "this needs a different plan".

**Call sites.** There is no shared dependency to hook: each endpoint calls `await enforce_anonymous_limit(request, user)` inline in its handler body. `enforce_plan_quota` is added the same way, immediately after it, at all **six** existing sites:

| File | Line | Tool |
|---|---|---|
| `api/v1/grammar.py` | 68 | `grammar` |
| `api/v1/headline.py` | 50 | `headlines` |
| `api/v1/headline.py` | 122 | `headlines` (visual prompt) |
| `api/v1/style.py` | 40 | `rewriter` |
| `api/v1/summarizer.py` | 43 | `summarizer` |
| `api/v1/optimize.py` | 76 | `optimize` |

Six explicit calls rather than a dependency, because the tool name has to come from the call site regardless — a dependency cannot know which tool it is guarding without being parameterised per route anyway. This also keeps the two limits visibly adjacent, which is where a future reader will look.

`optimize` runs the other tools internally as pipeline stages. It is charged **once**, as `optimize`, at its own entry point; the stages do not re-check. Double-charging a single user action would make the quota unpredictable.

### 5.5 Frontend

- `Plans.jsx` fetches `GET /api/v1/plans`, renders from the response, and badges the user's current plan from `GET /api/v1/plans/me`. The three hardcoded `PLANS` objects are deleted. Icons map from `slug` with a neutral fallback, since an admin can create a slug the icon map does not know.
- `admin/pages/Plans.jsx` — list, create, edit, archive, reorder. Follows the existing admin page shape.
- `admin/pages/UserDetail.jsx` gains a plan selector.
- `services/api.js` surfaces the 429 `quota` payload so the tool UI can show usage and link to `/plans`.

### 5.6 Verification

New tests in `apps/backend-api/tests/`:

- `test_plans.py` — catalog CRUD, single-default constraint, archive refusing the default plan, `limits` validation rejecting unknown keys.
- `test_plan_quota.py` — under limit passes; at limit 429s with the quota payload; admin bypasses; `null` and `0` are unlimited; telemetry read failure fails open; tool-not-in-plan 403s.

---

## 6. Phase 4 — Hardening

Gaps confirmed absent from the current code, not a generic checklist.

### 6.1 Frontend

| Gap | Change |
|---|---|
| No error boundary anywhere | `ErrorBoundary` wrapping the router in `main.jsx` and each lazy route. Today one render error white-screens the app with nothing in the UI. |
| `usePlatformMeta` swallows errors silently | Keep failing open — that is deliberate and documented — but surface the degraded state to the admin `SystemStatusPanel`. |
| No build-size guard | `scripts/check-bundle-size.mjs` fails the build if the main chunk exceeds a recorded budget, so Phase 1's win does not quietly regress. |

### 6.2 Backend

| Gap | Change |
|---|---|
| No request correlation | `X-Request-ID` middleware: honour an inbound header or generate one, bind it into a `contextvars` log field, echo it on the response. A 500 in the logs currently cannot be tied to a user report. |
| Unstructured logs | JSON formatter when `APP_ENV == "production"`, human-readable otherwise. |
| No readiness probe | `/health/ready` — checks database reachability and returns 503 when it is down. `/health` stays a pure liveness probe. A deploy can currently go live against a dead database. |
| No security headers | Middleware adding `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, and HSTS in production. |
| Gateway does not retry | `model_generate` falls through providers on failure but never retries a transient one. Bounded retry (2 attempts, exponential backoff with jitter) on connect errors and 5xx only — never on a 4xx, and never extending past `SINLLAMA_TIMEOUT_SECONDS`. |

`SINLLAMA_API_URL` stays env-only. Nothing in this phase moves a secret or a service URL into the database — the reasoning in `settings_registry.py` still holds.

### 6.3 Verification

- `test_request_id.py` — inbound header honoured, generated when absent, echoed on both success and error responses.
- `test_health.py` — `/health` stays up when the database is down; `/health/ready` returns 503.
- `test_security_headers.py` — headers present, HSTS only in production.
- `test_gateway_retry.py` — retries a connect error, does not retry a 400, respects the attempt ceiling.

---

## 7. Out of scope

Recorded so the boundary is explicit:

- Billing, payment processing, prices, currency, invoices.
- Plan self-service. A user cannot change their own plan; only an admin assigns.
- Monthly or rolling quota windows. Daily, UTC, only.
- Quota enforcement for anonymous traffic — `enforce_anonymous_limit` already covers it and is unchanged.
- Server-side rendering. The prerender stays a build-time string write.
- Chrome extension and Docs add-on. They use the anonymous path, which is untouched.

## 8. Sequencing

Phase 1 → Phase 2 → Phase 3 → Phase 4.

1 and 2 are frontend-only and carry no migration, so they ship first and independently. 3 is the only phase requiring a database change and is the largest. 4 touches both sides but nothing in 1–3 depends on it, so it lands last without blocking anything.
