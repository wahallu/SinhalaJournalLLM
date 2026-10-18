# Portfolio tabs, milestones and link-based documents

**Date:** 2026-10-11
**Scope:** `apps/portfolio`, `apps/backend-api`, `apps/web-app` (admin)
**Status:** Design approved in chat; written spec awaiting review.

## 1. Goal

Make the SinAi portfolio follow the SLIIT project-website guideline
(`Website.pdf`) without changing its look or technology:

1. A header with the guideline tabs, keeping "Try SinAi".
2. A milestones timeline that reflects the real project phases.
3. Documents and presentations supplied as **links** managed from the admin
   panel, so no PDFs ship with the site.
4. Google Workspace Marketplace verification is no longer a constraint.
5. A contact phone number in the Contact section.

## 2. Decisions already made

| Topic | Decision |
|---|---|
| Technology | Keep Next.js 16 static export, GSAP timeline and current visual design. |
| Page shape | **One-page home.** Tabs scroll to sections; no new pages. |
| Documents | Links to files hosted elsewhere (Drive, OneDrive, GitHub). The backend stays connected and the admin edits the links. |
| AI Expo | Section stays exactly where it is, directly after Milestones. |
| Marketplace | Remove `/docs-addon*` pages and the exact-name rules. Keep `/privacy`, `/terms`, `/support` (the web app has accounts). |
| Contact | Add phone `0710767697`, as supplied by the project owner. |

## 3. Header (`components/Navbar.tsx`)

Desktop pill and mobile menu both become:

| Tab | Target |
|---|---|
| Home | `/` |
| Domain | Dropdown (kept). Items: Literature survey, Research gap, Research problem & solution, Research objectives, Methodology (all `/project-scope#<id>`), plus **Technologies used** (`/#technologies`). |
| Milestones | `/#milestones` |
| Documents | `/#documents` |
| Presentations | `/#presentations` |
| About us | `/#team` |
| Contact us | `/#contact` |
| Try SinAi | `SITE.appUrl`, external, unchanged |

- "Outputs" leaves the header; its section (`#achievements`) stays on the page.
- `SCOPE_SECTIONS` is shared with the `/project-scope` page chips, so
  "Technologies used" is added in the Navbar only.
- **Active tab.** The tab whose section is under the existing probe line
  (`PROBE_Y`) is highlighted. Section to tab mapping: `hero`, `about`,
  `where`, `technologies` give Home; `milestones`, `recognition` give
  Milestones; `library`, `documents` give Documents; `presentations`,
  `publications` give Presentations; `team` gives About us; `contact` gives
  Contact us; `achievements` gives no tab. On `/project-scope` the Domain tab
  is active; other routes highlight nothing.
- Visual style, pill, dark/light tone switching and the Domain dropdown
  behaviour are unchanged.

## 4. Milestones (`content/timeline.ts`, `STORYLINE`)

Replace the eleven development-log entries with nine in date order.
`STORYLINE_PERIOD` becomes "October 2025 — December 2026". The separate
`TIMELINE` array (used by `/research`) is untouched.

| `when` | `title` | `content` (source) |
|---|---|---|
| October 2025 | Initiation | The research project is initiated and its scope for R26-SE-037 set out. |
| March 2026 | Proposal | Four individual proposal reports (12–13 March) and the proposal presentation (16 March). (`content/documents.ts`) |
| April 2026 | Implementation stage | Building the four task components: grammar checker, headline generator, news summarizer and style rewriter. |
| May 2026 | Progress Presentation 1 (PP1) | Component status, architecture and the evaluation plan. (11 May, `documents.ts`) |
| September 2026 | Progress Presentation 2 (PP2) | Updated datasets, four task adapters and product progress. (`documents.ts`) |
| 3 September 2026 | Research paper completed | The SinhalaJournal-LLM research paper completed. (existing storyline entry) |
| 25 September 2026 | Top 10 finalist | University AI Innovation category, CodeBlast Hackathon Challenge 2026 (National AI Expo, Sri Lanka AI Week), SLT Auditorium; certificates received. (`components/AiExpo.tsx`) |
| October 2026 | Final presentation | Final project presentation. |
| December 2026 | Research publication | Planned publication of the research. |

The two special achievements are "Research paper completed" and "Top 10
finalist". Both are evidenced in the repo. No marks or invented detail are
added (content-honesty rule).

## 5. Documents by link

### 5.1 Database (`migrations/2026-10-11-portfolio-document-links.sql`)

Make a row able to be just a link, or a link-less "pending" row:

- `file_name`, `file_path`, `file_url`, `mime_type`, `size_bytes` become
  nullable.
- Replace the `size_bytes` check with
  `size_bytes is null or (size_bytes > 0 and size_bytes <= 26214400)`.
- `file_path` stays `unique` (Postgres allows many NULLs).

Existing uploaded rows are unaffected.

### 5.2 Backend (`apps/backend-api`)

- `schemas/portfolio_document.py`: `file_name`, `file_url`, `mime_type`,
  `size_bytes` are optional on `PortfolioDocument`. Add
  `PortfolioDocumentLinkCreate` (title, category, document_type,
  submitted_at, description, `file_url` optional, is_published, sort_order).
  `PortfolioDocumentUpdate` gains `file_url`.
- **URL validation (one shared validator):** after trimming, empty becomes
  `None` (pending); otherwise it must be `https://` with a host, at most
  500 characters, no whitespace. `http:`, `javascript:`, `data:` and relative
  paths are rejected.
- `POST /api/v1/admin/portfolio-documents/link` (JSON) creates a row with no
  stored file. The existing multipart upload endpoint is left as is.
- `PATCH .../{id}` accepts `file_url` (set, change, or clear to pending).
- `DELETE .../{id}` removes the stored object only when `file_path` is not
  null; link rows just delete the row.
- Audit log entries reuse the existing `portfolio_document.*` actions.
- Public `GET /api/v1/portfolio/documents` is unchanged apart from nullable
  fields.

### 5.3 Admin UI (`apps/web-app/src/admin`)

- `adminApi.js`: add `createPortfolioDocumentLink(body)`.
- `PortfolioDocuments.jsx`:
  - The file picker becomes a **Link** field (URL input; empty means
    "pending") with helper text about Drive/OneDrive sharing links.
  - Rows get an **Edit** action that reuses the form to change title,
    section, link, date, order and description (PATCH).
  - A "Link" column shows the host, or a "Pending" badge.
  - The delete dialog says the linked file is not touched.
  - The header copy changes from "Upload" to "Add".

### 5.4 Portfolio (`components/DocumentLibrary.tsx`, `content/documents.ts`)

- Remove `BUNDLED_DOCUMENTS`; the backend is the single source.
- `PortfolioDocument.file_url` becomes `string | null`.
- A card with a valid link (`https://`) shows one **Open** button (new tab,
  `rel="noopener noreferrer"`). The Download button goes: browsers ignore
  `download` on cross-origin links. A card without a link shows a
  **Pending** chip. Any other URL scheme is treated as no link
  (defence in depth).
- The Documents and Presentations groups always render, with a short
  empty-state line, so `#documents` and `#presentations` always exist.
  Publications still hides when empty.
- States: loading ("Loading documents…"), error ("Documents are temporarily
  unavailable."), ready.
- A missing date shows nothing instead of "Date not specified".

### 5.5 Rollout order

1. Apply the migration in Supabase, deploy backend and admin.
2. Upload the PDFs to Drive (or similar) and add each link in admin; add
   link-less rows for Project Charter, Checklist documents, Final document
   and Final presentation as needed.
3. Deploy the portfolio.
4. Then, and only after the owner confirms, delete `public/documents/*.pdf`
   and the unreferenced raw images in `public/assets/aiexpo/` and
   `public/supervisors & team members/`.

## 6. Marketplace cleanup (`apps/portfolio`)

- Delete `app/docs-addon/` (page, layout, `privacy/`, `terms/`).
- `app/layout.tsx`: title becomes "SinAi: AI Writing Assistant for Sinhala
  Journalism"; description, `applicationName`, OpenGraph and JSON-LD name
  become "SinAi" with a description built from existing site copy.
- `content/site.ts`: `name` becomes "SinAi"; remove the Marketplace comments
  and `purposeLead/Rest/Detail` if nothing else reads them (confirm by grep).
  Add `docsAddonUrl` (repo tree for `apps/docs-addon`, same pattern as
  `extensionUrl`).
- Re-point every `/docs-addon` link to `SITE.docsAddonUrl` or remove it:
  `components/Footer.tsx`, `content/tools.ts` (CTA),
  `components/research/Build.tsx`, `app/privacy/page.tsx`,
  `app/terms/page.tsx`, `app/support/page.tsx`.
- Footer comment about the Marketplace review is removed.
- `AGENTS.md`: delete rule 5 (Marketplace) and rewrite the identity note;
  update the stale references to `/docs-addon`.
- The support and terms copy about installing from the Marketplace is left
  (it describes distribution, not verification).

## 7. Contact (`components/ContactSection.tsx`, `content/site.ts`)

Add `SITE.contactPhone = "0710767697"` (shown as `071 076 7697`,
`tel:+94710767697`) and a third card, same style as the email and repository
cards, with the lucide `Phone` icon.

## 8. Out of scope

- Splitting the home into separate pages.
- Marks per assessment, a milestone drop-down, a general e-mail template.
- Changing the visual design, fonts or colours.
- Removing the multipart upload endpoint.
- Moving the Technologies logo cloud off Home.

## 9. Verification

- **Backend:** extend `tests/test_portfolio_documents.py` to cover link
  create (https accepted, pending accepted, `http:` / `javascript:` rejected),
  PATCH `file_url`, delete of a link row without a storage call, and the
  public list returning link and pending rows. Run
  `./.venv/bin/python -m pytest -q` from `apps/backend-api`.
- **Admin:** `npm run build` and lint in `apps/web-app`; exercise the add and
  edit form against a local backend if one can be started.
- **Portfolio:** `npm run lint`, `npm run build`, then preview `portfolio-out`
  and check the following:
  - Each tab scrolls to its section and the active tab follows scroll.
  - The nine milestones render in order.
  - The phone card appears.
  - `out/` has no `docs-addon` routes.
  - Documents show loading, error, link and Pending states (fetch stubbed in
    the browser).

## 10. Risks and notes

- Removing `/docs-addon/privacy` and `/docs-addon/terms` makes those URLs 404.
  If the Google Cloud OAuth consent screen or a Marketplace listing still
  references them, update those first.
- PP2's exact day is not recorded; it is ordered by month only.
- Milestone copy is deliberately minimal; edit `content/timeline.ts` to add
  detail the team can stand behind.
- The phone number is published as given; confirm it is the right public
  contact number.
- The migration is not reversible without losing link-only rows; take a
  backup if the table holds data you care about.
