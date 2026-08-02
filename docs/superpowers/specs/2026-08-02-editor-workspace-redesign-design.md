# Editor Workspace Redesign — Design

**Date:** 2026-08-02
**Status:** Approved, ready for implementation planning
**Scope:** `apps/web-app` only. No backend changes.

---

## 1. Goal

Rebuild the four writing-tool screens as a professional two-pane editor: a large text area with its generation controls as dropdowns in a toolbar header, and results beside it. Strip every piece of UI that presents fabricated data or unreachable functionality, so what ships is what works. Make the account surfaces (Settings, Profile, Plans) honest about what they actually persist, and make the signed-out experience a first-class one rather than a degraded one.

This is a frontend-only change. No API contract moves.

## 2. Decisions

Each records the alternative rejected, so a later reader knows the choice was deliberate.

| # | Decision | Rejected alternative |
|---|---|---|
| D1 | **Two-pane workspace** — editor left, results right, third column dissolved | Single-column document flow (loses the before/after comparison grammar and rewriter are built around) and a results drawer (modal-feeling, kills comparison). |
| D2 | **Editor toolbar carries request parameters; results header carries display options** | Putting every control in the toolbar as literally briefed. A view toggle (summarizer paragraph/bullets) does not change the request and reads wrong next to controls that do. This is a deliberate refinement, recorded here so it is not mistaken for an oversight. |
| D3 | **Fabricated headline analytics are deleted, not hidden** | Keeping the components behind an "if real values present" guard. The backend has no code path that produces them (§4.1); leaving the shell invites someone to conclude the feature exists. |
| D4 | Grammar corrections **move into the results pane**, not deleted | Deleting them along with the rest of `RightPanel`. These are genuine, derived server-side by `derive_corrections()` — the only real analysis in the product. |
| D5 | **Tool `PageHeader` removed** from the four tool screens | Keeping it above the workspace. It costs ~120px of vertical space to restate what the sidebar and toolbar already say. Retained on Settings/Profile/History. |
| D6 | Profile shows **real account data only** | Keeping the localStorage personalization fields. A page that looks like account settings and silently persists nothing to the account is worse than a smaller honest page. |
| D7 | Plans becomes a **roadmap page with no prices** | Deleting it, or keeping the prices. Prices that cannot be charged are the least production-ready thing in the app; the tier structure is still useful as a roadmap. |
| D8 | **API base URL field removed from Settings** | Keeping it as a power-user feature. A production user repointing the app at an arbitrary origin is a liability, not a feature. The `sinai_settings.apiBaseUrl` key is still honoured by `getApiBase()` for local development — only the UI goes. |
| D9 | Signed-out users get **the full editor plus a post-result sign-in cue** | A marketing landing page, or a persistent top banner. The tools already work anonymously (D11 of the dashboard spec); the moment saving becomes worth something is after the first result, not before. |
| D10 | **Client character cap raised 2,000 → 10,000** to match the backend | Leaving it. Every tool schema accepts 10,000 (§4.3); 2,000 is roughly 300 Sinhala words, far below the article lengths the summarizer and headline generator exist to handle. |
| D11 | **Custom `Dropdown` component**, not native `<select>` | Native `<select>`. Cannot be styled consistently across platforms to the standard the rest of this UI holds, and cannot show the secondary description text each option carries today. Accessibility is preserved by implementing the listbox pattern properly (§5.1). |
| D12 | Headline **Count and Category surfaced** in the toolbar | Leaving them settings-only. Both are already sent on every request and were simply never exposed — surfacing them is a capability gain, not new scope. Headline `style` stays unexposed because it is explicitly not sent. |

## 3. Architecture

### 3.1 Layout

Tool screens become full-height with independently scrolling panes; the page itself does not scroll. `App.jsx` already carries a stubbed full-height branch (`isChat`, currently hardcoded `false`) — that branch is reused and driven by whether the active route is a tool.

```
┌──────────────────────────────────────────────────────────────┐
│  ⌨ Grammar Checker    [Tone ▾] [Length ▾]     1,240 / 10,000 │  EditorToolbar
├───────────────────────────────┬──────────────────────────────┤
│                               │                              │
│  textarea                     │  ResultsPane                 │
│  flex-1, min-h-[20rem]        │  scrolls independently       │
│  fills available height       │                              │
│                               │                              │
├───────────────────────────────┤                              │
│  [Clear] [Copy]      [▶ Run]  │                              │
└───────────────────────────────┴──────────────────────────────┘
```

Breakpoint behaviour, replacing the current `.tool-grid` rules in `index.css`:

- **≥ 80rem:** two columns, `minmax(0,1fr) minmax(0,1fr)`, both panes full height with internal scroll.
- **< 80rem:** single column, page scrolls normally. Editor `min-h-[18rem]`, results below it.

The existing `.tool-grid` / `.tg-input` / `.tg-panel` / `.tg-output` grid-area rules are replaced wholesale; `.tg-panel` has no successor.

### 3.2 Component inventory

**New**

| Component | Responsibility |
|---|---|
| `ui/Dropdown.jsx` | Accessible listbox dropdown: trigger button + popover, label/description per option. Used by the toolbar and Settings. |
| `editor/EditorToolbar.jsx` | Tool identity, request-parameter dropdowns, live character count. |
| `editor/Editor.jsx` | Toolbar + textarea + action bar. Replaces `InputBox`. |
| `editor/ResultsPane.jsx` | Wraps the per-tool result view with a shared header (label, display options, copy/apply actions). |
| `lib/toolOptions.js` | The option lists (`TONES`, `LENGTHS`, `SUMMARY_VIEWS`, `HEADLINE_LENGTHS_OPTIONS`, `HEADLINE_COUNTS`, `HEADLINE_CATEGORIES`) lifted out of the deleted `RightPanel.jsx`, so the toolbar and Settings share one source. |

**Modified**

| File | Change |
|---|---|
| `App.jsx` | `ToolRunner` rebuilt onto the two-pane shell; `TOOL_CONFIG` loses `sample`; full-height branch enabled for tool routes. |
| `components/OutputPanel.jsx` | Keeps before/after and summary rendering; gains the corrections list relocated from `RightPanel`; loses its own outer labels where `ResultsPane` now provides them. |
| `components/HeadlineOutputPanel.jsx` | Fabricated sections deleted (§4.1); `VisualPromptModule` made responsive (§6). |
| `components/Dashboard.jsx` | "Try a sample" card removed; broken quick actions fixed (§4.2). |
| `components/Sidebar.jsx` | Signed-out state gets a real sign-in affordance (§8). |
| `components/SettingsPage.jsx` | API URL field removed; tone list corrected to all five trained styles. |
| `components/ProfilePage.jsx` | Rebuilt on real account data (§7.2). |
| `components/Plans.jsx` | Roadmap treatment (§7.3). |
| `lib/toolMeta.js` | `sample` and `sampleLabel` removed. |
| `services/api.js` | `generateHeadlines()` stops fabricating metrics, entities, themes, and pipeline log (§4.1). Its `HEADLINE_LENGTH_BANDS` fallback and the real `length` echo are retained. |
| `index.css` | `.tool-grid` rules replaced. |

**Deleted**

- `components/RightPanel.jsx` — dissolved. Controls → toolbar, corrections → results pane, `TipNote`s and the fabricated insights → gone.
- `components/InputBox.jsx` — superseded by `editor/Editor.jsx`.

`ui/SamplePromptChips.jsx` is **retained**: it is consumed by `admin/research/SinLLamaPage.jsx`, which is out of scope.

## 4. What is removed and why

### 4.1 Fabricated headline analytics

`services/api.js`'s `generateHeadlines()` transforms the backend's flat `{ headlines: string[] }` into a richer shape by inventing the difference. It hardcodes `passed_validation: true`, every metric (`rouge_1`, `rouge_2`, `rouge_l`, `bleu`, `semantic_similarity`, `entity_coverage`) to `0`, and `source_entities: []`, `semantic_extraction: {}`, `pipeline_log: []`, `regeneration_count: 0`. The backend `POST /headlines/generate` returns none of these fields and has no code that computes them.

Everything downstream of that invention is therefore deleted:

- `HeadlineOutputPanel`: the `MetricBar` component, per-candidate metric expansion, the Source-entities section, `EntityTag`, Key-themes, the Pipeline-log section, and the regeneration warning badge.
- `RightPanel`: the whole `HeadlineInsightsPanel` (its Candidates/Passed/Entities/Total-time tiles read from the same invented fields — `Passed` can never differ from `Candidates`, `Entities` is always absent, `Total time` is always 0).
- The `Badge` "Passed/Failed" row on each candidate card, since `passed_validation` is a constant `true`.

`generateHeadlines()` is simplified to stop fabricating: it returns the real headlines, the real `length` band echoed by the backend, and a locally computed word count per candidate (genuine — derived from the returned text, used for the length badge).

**Retained** in headline results: the top-pick hero card, the ranked candidate list with copy buttons, per-candidate word count against the requested band, and the visual-prompt module (real, backed by `/headlines/visual-prompt` and `/image/generate`).

### 4.2 Broken dashboard actions

`Dashboard.jsx` Quick actions call `onSelectTool('comparison')` and `onSelectTool('sinllama')`, and the hero calls `onSelectTool('sinllama')`. Neither id exists in `TOOL_TO_PATH`, so they navigate to `/comparison` and `/sinllama`, which `App.jsx` redirects to `/dashboard`. Clicking them appears to do nothing. Those tools moved to `/admin/research/*` in Phase 4 and the dashboard was never updated.

Fixed by replacing them with actions that work for the signed-in and signed-out user alike: open Grammar Checker, open Headline Generator, review History. The hero's secondary button becomes "Browse tools" targeting the grammar screen.

### 4.3 Examples

Removed: the `Example` button and `loadSample` in the editor, `sample`/`sampleLabel` in `lib/toolMeta.js`, `sample` in `App.jsx`'s `TOOL_CONFIG` and its `InputBox` prop, and the Dashboard "Try a sample" card. `TOOL_META` keeps `id`, `label`, `shortDesc`, `icon` — still used by the dashboard tool grid, history feed, and sidebar.

## 5. The editor

### 5.1 `ui/Dropdown.jsx`

Trigger button showing the current option's label and a chevron; popover listing options with optional description text. Requirements:

- `role="listbox"` on the popover, `role="option"` with `aria-selected` on each item, `aria-expanded` and `aria-haspopup="listbox"` on the trigger.
- Keyboard: Enter/Space/ArrowDown opens; ArrowUp/ArrowDown move; Enter/Space select; Escape closes and returns focus to the trigger; Tab closes.
- Closes on outside click. Popover is positioned below the trigger, right-aligned when it would overflow the pane.
- Compact variant for the toolbar (dense, label-only trigger) and a full variant for Settings (with descriptions).

### 5.2 Toolbar contents per tool

Request parameters only (D2). Every value listed is already accepted by the corresponding backend endpoint.

| Tool | Dropdowns | Source of options |
|---|---|---|
| Grammar | *(none)* | `POST /grammar/check` takes only `text`. |
| Headlines | Length band · Count · Category | `HEADLINE_LENGTHS_OPTIONS`, `HEADLINE_COUNTS`, `HEADLINE_CATEGORIES` — all three already defined in `RightPanel`, moved to `lib/toolOptions.js`. |
| Rewriter | Tone | `TONES` (all five trained styles). |
| Summarizer | Length | `LENGTHS`. |

Display options, rendered in the results-pane header instead:

| Tool | Control |
|---|---|
| Summarizer | Paragraph / Bullets |

Grammar's toolbar has no dropdowns; it still shows tool identity, character count, and the action bar. This is intentional and not a gap to fill.

### 5.3 Text area

- `rows` fixed height replaced by `flex-1` with `min-h-[20rem]` (≥80rem) / `min-h-[18rem]` (below), so the editor grows with the viewport.
- `MAX_CHARS` 2,000 → 10,000, matching `max_length` on all four request schemas (`grammar.py`, `style.py`, `summarizer.py`, `headline.py`). The near-limit warning threshold stays proportional (85%).
- `Ctrl/Cmd+Enter` to run is retained and additionally surfaced as the Run button's `title`.

### 5.4 Action bar

`Clear` · `Copy` · `Run` (primary). The `Example` button is gone. Run stays disabled while loading, while the input is empty, or while over the limit.

## 6. Headline results and the visual prompt

`VisualPromptModule` is restructured for the narrower results pane:

- **≥ 48rem within the pane:** prompt textarea and generated image side by side. **Below:** stacked.
- The image sits in a fixed `aspect-[16/10]` container so the layout does not jump between skeleton, loaded image, and error. `object-cover`, rounded, bordered.
- Download and Open-full-size become icon buttons in a corner overlay on the image rather than a text row above it.
- Button labels drop the bilingual doubling (`නැවත සාදන්න / Regenerate prompt` → `Regenerate`), which currently wraps to two lines in a narrow pane. Sinhala remains throughout the actual content and placeholders; this is about control labels only.
- The module stays collapsible and continues to auto-generate the prompt once per article change.

## 7. Account surfaces

### 7.1 Settings

- **Removed:** the API base URL section (D8).
- **Fixed:** the default-tone select currently offers only formal/editorial/youth while the rewriter supports five styles — sports and feature are added.
- Retained: default summary length, default headline count, Save/Reset, and the existing `touched`-set save semantics (which deliberately avoid converting displayed fallbacks into explicit overrides — this logic is correct and stays).
- Selects are swapped for `ui/Dropdown` full variant.

### 7.2 Profile

Rebuilt around what actually persists:

- **Account** (read-only): email and role from `useAuth()`. No editing — role is admin-controlled and guarded by the `guard_profile_privileges` trigger.
- **Category** (editable): kept exactly as-is. It already writes to Supabase `profiles.category_id` under RLS and is the one real field on the page.
- **Removed:** the localStorage `name` / `email` / `role` / `organization` fields, `DEFAULT_PROFILE` with its fake `journalist@sinai.lk`, `getProfile`/`saveProfile`, the Save-profile button, and the non-functional avatar camera button. The avatar itself stays as a read-only initial derived from the account email.
- The `sinai_profile` localStorage key is no longer read or written. No migration needed — nothing else consumes it.

### 7.3 Plans

- Prices and the `/month` period removed.
- `Upgrade` buttons become a disabled "Coming soon" state; the Free tier shows "Current plan".
- Tier names, descriptions, and feature lists retained as a roadmap.
- A short line under the heading states that paid plans are not yet available, so the page does not read as a broken checkout.

## 8. Signed-out experience

- The four tool routes already render for anonymous visitors and stay that way.
- **Post-result cue:** after a successful result, the results pane shows an unobtrusive inline prompt — "Sign in to save this to your history" with a link to `/login`. Rendered only when `useAuth()` reports no user, and only when a result is present. Not a modal, not a blocking gate.
- **Sidebar:** the signed-out footer currently renders "Guest / Not signed in" as dead text behind a menu. It becomes a direct "Sign in" button routing to `/login`.
- **Dashboard:** for anonymous visitors the metric tiles (which can only ever read 0, since `/history` 401s) are replaced with a short introduction to the four tools. The System-status card and tool grid are unchanged.
- History, Settings, and Profile keep redirecting to `/login` via `ProtectedRoute`.

## 9. Usability fixes folded in

Three items are in scope because they touch the same files and are small:

1. **Apply to editor.** A button on the results header that replaces the editor content with the result. Currently a user must copy the corrected text and paste it back by hand — the loop is open for a writing tool. Applies to grammar, rewriter, and summarizer (not headlines, where the result is not a replacement for the input).
2. **Character cap corrected** — D10, §5.3.
3. **Shortcut surfaced** — `Ctrl+Enter` added to the Run button's tooltip.

## 10. Testing

The web app has no test runner configured. Verification for this change is therefore manual plus build:

- `npm run build` clean, and `npm run lint` no worse than the pre-existing baseline (12 known errors as recorded in the Phase 4 plan).
- Manual matrix, signed in and signed out, at ≥80rem and <80rem: each of the four tools runs end to end; every toolbar dropdown changes the request and the result reflects it; Apply replaces the editor content; results pane scrolls independently of the editor at the wide breakpoint.
- Keyboard-only pass over `ui/Dropdown` (open, arrow, select, Escape) and tab order through the editor.
- Headline screen with a generated image at both breakpoints, plus prompt-failure and image-failure states.

Establishing a frontend test runner is out of scope here and is noted in §11.

## 11. Deferred

- **Per-correction accept/reject.** The backend already returns each correction with `position`, `original`, `corrected` — enough to build a Grammarly-style review flow. Genuinely valuable, but it is a feature in its own right, not a redesign, and would expand this change substantially.
- **Draft autosave** to localStorage so a refresh mid-article does not lose work.
- **Frontend test runner** (Vitest + Testing Library). Would let the dropdown's keyboard behaviour and the tool wiring be covered properly rather than manually.
- **Real headline metrics.** If the backend later computes ROUGE/entity coverage on `/headlines/generate`, the results pane can grow a metrics section again — this time backed by real values.
