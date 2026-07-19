# sinai Portfolio — Build Roadmap

Research portfolio site for **SinhalaJournal-LLM** (project codename **sinai**), built at
`apps/portfolio`. Frontend-only for now, placeholder content, backend wired later.

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
| Motion (UI) | `motion` (`motion/react`) for micro-interactions, `whileInView` reveals |
| Motion (scroll story) | GSAP + ScrollTrigger, isolated client leaves, sticky-stack / horizontal-pan patterns from taste-skill Section 5 |
| Fonts | Geist Sans + Geist Mono (`next/font/google`, already wired in `layout.tsx`) |
| Icons | `lucide-react` (already a dependency — one icon family, no mixing) |
| Accent color | Single warm amber/gold on zinc dark neutrals (explicitly avoiding AI-purple/blue) |
| Corner radius | One scale project-wide: soft (12–16px) for cards/panels, full-pill for interactive buttons/badges |
| Nav | Home · Research · Team · Publications · Playground · Contact — 6 items, one line, ≤72px height |

`/research` is one long-form scrollytelling page covering Problem → Methodology →
Architecture → Results as sequential sections (not 4 separate nav items) — keeps the nav
sane and gives GSAP scroll-driven storytelling an actual narrative to serve.

---

## Phase 0 — Foundation
- [x] `.env` / `.env.example` with `NEXT_PUBLIC_SITE_NAME=sinai` + site config module (`lib/config/site.ts`)
- [x] Install `gsap`, shadcn `init` (components.json, tailwind theme wiring) — Base UI style (`base-nova`), not Radix
- [x] Design tokens in `globals.css` (`@theme`): warm zinc neutrals + single amber accent, radius scale, no pure black/white
- [x] Root layout shell: `<SiteNav>` (6 items, mobile Sheet drawer), `<SiteFooter>`, metadata defaults, dark-mode-first via `next-themes`
- [x] Content data layer: typed placeholder data (`lib/content/*.ts`) for team, publications, results, playground tools — swap-in point for real data later
- [x] Base SEO scaffolding: `metadata` export pattern, `sitemap.ts`, `robots.ts`, `opengraph-image.tsx`

## Phase 1 — Home (`/`)
- [x] Hero — asymmetric split, SVG node-graph visual (base model → 4 adapters), 1 primary CTA (Playground) + 1 secondary (Research)
- [x] Problem teaser (short, links to `/research`)
- [x] Approach/architecture overview strip (4-cell bento, real bg variation, not a repeat of Research page)
- [x] Results highlight (real-feeling placeholder metrics, not fake-precise)
- [x] Team teaser (3 names, link to `/team`)
- [x] Publications teaser (top 2, link to `/publications`)
- [x] Footer CTA
- [x] Verified in browser at desktop (1440px) and mobile (390px) — hero fits viewport, mobile nav drawer works, no console errors

**Still open on Home:** the 4 destination pages it links to (`/research`, `/team`, `/publications`, `/playground`, `/contact`) don't exist yet — nav links and teasers will 404 until Phases 2-6 build them.

## Phase 2 — Research (`/research`)
- [ ] Problem section
- [ ] Methodology section
- [ ] Architecture section (diagram — generated image or real SVG, not div-fake-screenshot)
- [ ] Results section (charts/metrics, follows `dataviz` skill conventions)
- [ ] Scroll-driven narrative motion (sticky-stack or scroll-reveal, motivated not decorative)

## Phase 3 — Team (`/team`)
- [ ] Member grid with photos (generated/placeholder), roles, links
- [ ] Advisor/supervisor section if applicable

## Phase 4 — Publications (`/publications`)
- [ ] Publication list using a real list UI (cards/grouped, not a bare bulleted `<ul>`)
- [ ] Abstract/citation detail view

## Phase 5 — Playground (`/playground`)
- [ ] UI shell for the 4 tools (Grammar, Headline, Style Rewriter, Summarizer)
- [ ] Mocked responses (clearly placeholder, matches real API shapes from backend-api for easy swap-in later)
- [ ] Loading / empty / error states for each tool

## Phase 6 — Contact (`/contact`)
- [ ] Contact form (label-above-input, inline errors, WCAG AA contrast)
- [ ] Success/error states

## Phase 7 — Global polish & QA
- [ ] Full Pre-Flight Check pass (taste-skill Section 14) across every page
- [ ] Accessibility pass (focus states, contrast, reduced-motion, keyboard nav)
- [ ] Lighthouse pass (LCP/INP/CLS targets)
- [ ] Responsive QA at sm/md/lg/xl
- [ ] Both-theme visual check (light + dark)

## Phase 8 — Handoff
- [ ] Document backend integration points (where mocked data/API calls live) for later wiring
- [ ] Update README with project-specific run instructions

---

**Status legend:** unchecked = not started. Mark `[x]` as each item ships. Update the
Design System table only if a real product decision changes it (not per-page taste calls).
