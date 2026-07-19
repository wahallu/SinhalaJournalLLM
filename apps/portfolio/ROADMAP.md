# sinai Portfolio — Build Roadmap

Research portfolio site for **SinhalaJournal-LLM** (project codename **sinai**), built at
`apps/portfolio`.

Site name lives in `.env` (`NEXT_PUBLIC_SITE_NAME`), not hardcoded, so renaming the brand
later is a one-line change.

## Design system (locked — do not redecide per-page)

| Decision | Value |
|---|---|
| Design read | AI research portfolio, academic + technical audience, OpenAI/Anthropic-grade research-site polish |
| Dials | `DESIGN_VARIANCE 7` / `MOTION_INTENSITY 6` / `VISUAL_DENSITY 4` |
| Theme | Dark-mode-first, `dark:` variant strategy, one theme per page (no section inversion) |
| Base stack | Next.js 16 (App Router, RSC default), React 19, TypeScript, Tailwind v4 |
| Components | shadcn/ui (owned code, customized — never default state) |
| Motion (UI) | `motion` (`motion/react`) for micro-interactions, `whileInView` reveals, route crossfades |
| Motion (3D) | `@react-three/fiber` + `@react-three/drei` for the persistent `ModelCore` mascot only |
| Motion (scroll story) | GSAP + ScrollTrigger, isolated client leaves, sticky-stack / horizontal-pan patterns from taste-skill Section 5 — still reserved for the Work page's scrollytelling section (Phase E) |
| Fonts | Geist Sans + Geist Mono (`next/font/google`, already wired in `layout.tsx`) |
| Icons | `lucide-react` (already a dependency — one icon family, no mixing) |
| Accent color | Single warm amber/gold on zinc dark neutrals (explicitly avoiding AI-purple/blue) |
| Corner radius | One scale project-wide: soft (12–16px) for cards/panels, full-pill for interactive buttons/badges |
| Nav | Home · Work · Team · Papers · Play · Contact — 6 items, in the persistent nav-pill |

### Architecture pivot (this session): fuch.ai-inspired persistent shell

The site was re-architected around a **persistent app shell** (`components/shell/site-shell.tsx`,
replacing the old `SiteNav`/`SiteFooter`), styled and mechanically modeled on
**fuch.ai** (Sayandeep Bose's portfolio) — its layout/interaction system only, not its
colors/fonts/identity content (see design decisions above; sinai keeps its own brand).

The shell renders as siblings of `{children}` in `app/layout.tsx` so they never remount
across route changes:
- `IdentityCard` (top-left), `NavPill` (top-right, includes the assistant + brief-sheet
  triggers), `UtilityBar` + `StatusTicker` (bottom), `ModelCore` (centered, layout-level).
- `RouteTransition` wraps `{children}` for a crossfade between routes. **Note:** the plan
  originally called for React's native `<ViewTransition>` (per
  `node_modules/next/dist/docs/01-app/02-guides/view-transitions.md`), but the installed
  React (19.2.4) doesn't export it — confirmed at runtime. Used `motion`'s `AnimatePresence`
  keyed on `usePathname()` instead; same visual result, no canary dependency. Revisit if/when
  Next pins a React canary that exports `ViewTransition`.
- `ModelCore` is an **original** abstract 3D piece (base node + 4 adapter nodes, evolved
  from the old `hero-visual.tsx` SVG diagram) — not a copy of fuch.ai's rigged robot asset.
  Cursor-reactive tilt, idle bob, pause toggle (`UtilityBar`) + `prefers-reduced-motion` both
  freeze it via `Canvas frameloop="demand"`.
- "Ask sinai" (`AssistantDrawer`) calls the real `POST /api/v1/sinllama/chat` (raw base
  model, no system-prompt field) — grounding context is composed client-side in
  `lib/content/brief.ts#buildAssistantContext()` and prepended to every prompt. Stateless
  per the API; transcript continuity is client-side only.
- `StatusTicker` polls `GET /api/v1/meta` for live model-gateway status, degrades to an
  "unavailable" pill on fetch failure — never blocks rendering.
- Home (`/`) is now a **single non-scrolling fold** (fuch.ai's Home is one fold, not a long
  scroll) — the old Hero/ProblemTeaser/ApproachStrip/ResultsHighlight/TeamTeaser/
  PublicationsTeaser sections were **relocated**, not deleted, onto the pages they preview.

---

## Phase 0 — Foundation
- [x] `.env` / `.env.example` with `NEXT_PUBLIC_SITE_NAME=sinai` + site config module (`lib/config/site.ts`)
- [x] Install `gsap`, shadcn `init` (components.json, tailwind theme wiring) — Base UI style (`base-nova`), not Radix
- [x] Design tokens in `globals.css` (`@theme`): warm zinc neutrals + single amber accent, radius scale, no pure black/white
- [x] Content data layer: typed placeholder data (`lib/content/*.ts`) for team, publications, results, playground tools — swap-in point for real data later
- [x] Base SEO scaffolding: `metadata` export pattern, `sitemap.ts`, `robots.ts`, `opengraph-image.tsx`
- [x] **(added)** Persistent shell foundation: `three`/`@react-three/fiber`/`@react-three/drei` deps, `components/shell/*`, replaced `SiteNav`/`SiteFooter`

## Phase 1 — Home (`/`)
- [x] Rebuilt as a single non-scrolling fold: big `sinai` wordmark, tagline, chat-prompt-style
  headline, assistant suggested-chips (`HomeAssistantChips`), latest-paper badge
- [x] Verified in browser at desktop (1440px) and mobile (390px) — see Verification log below

## Phase E — Work (`/research`) — interim
- [x] Interim: carries the relocated `ProblemTeaser` + `ApproachStrip` + `ResultsHighlight` +
  `FooterCta` sections (CTAs repointed from self-referential `/research` links to `/publications`)
- [ ] fuch.ai-style top fold: left build-timeline (from this phase list), right selected-work
  cards, docked `ModelCore` pose
- [ ] Scroll-driven Problem → Methodology → Architecture → Results narrative (GSAP ScrollTrigger)

## Phase F — Team (`/team`) — interim
- [x] Interim: full team + supervisor grid, `heroStats` tiles (real data, no fabricated awards)
- [ ] Project bio/manifesto framing (fuch.ai's "About" treatment, project-voiced not personal)

## Phase G — Papers (`/publications`) — interim
- [x] Interim: full publication list (real list UI, not a bare `<ul>`)
- [ ] Abstract/citation detail view; card language matched to Work page tool cards

## Phase H — Play (`/playground`) — interim
- [x] Interim: tool descriptions only, honestly labeled "Coming soon"
- [ ] Wire to real backend-api endpoints (`/api/v1/grammar/check`, `/headlines/generate`,
  `/rewrite`, `/summarize`) — `lib/content/playground.ts` mocks are already shaped to match,
  this is a fetch-swap not a reshape
- [ ] Option pickers built from `GET /api/v1/meta`; loading/empty/error states

## Phase I — Contact (`/contact`) — interim
- [x] Interim: find-me links (GitHub, email)
- [ ] Reuse `AssistantDrawer` inline as a "message sinai" card
- [ ] Contact form (label-above-input, inline errors, WCAG AA contrast)

## Phase J — Live status ticker
- [x] `StatusTicker` wired to `GET /api/v1/meta`, graceful degradation on failure

## Deferred / optional
- [ ] Likes counter (fuch.ai's heart count) — needs a new small `apps/backend-api` endpoint
  following the existing repository graceful-degradation pattern; out of `apps/portfolio`
  scope alone, proposed as a follow-up

## Phase K — Global polish & QA
- [ ] Full Pre-Flight Check pass (taste-skill Section 14) across every page
- [ ] Accessibility pass (focus states, contrast, reduced-motion incl. `ModelCore`, keyboard nav
  through shell: nav-pill, assistant bubble, brief sheet)
- [ ] Lighthouse pass (LCP/INP/CLS targets — watch `ModelCore`'s effect on these)
- [ ] Responsive QA at sm/md/lg/xl
- [ ] Both-theme visual check (light + dark) — `ModelCore` theme-reactive colors included

## Phase L — Handoff
- [ ] Document backend integration points (where mocked data/API calls live) for later wiring
- [ ] Update README with project-specific run instructions

---

**Status legend:** unchecked = not started, "interim" = shipped with relocated/lightweight
content ahead of the full fuch.ai-styled redesign for that page. Mark `[x]` as each item
ships. Update the Design System table only if a real product decision changes it (not
per-page taste calls).
