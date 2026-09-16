# Loading Fix + Profile Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the app painting unstyled SEO markup before React mounts, and collapse the Profile page from five tabs to three.

**Architecture:** Two frontend-only changes that ship together. The loading fix removes the body prerender from the app's own entry document, replaces it with an inline branded splash, and code-splits the 1.06 MB bundle so the splash clears quickly. The Profile change merges Newsroom + Interests + Personalization into one Preferences tab of collapsible groups, deletes dead information, and splits a 534-line component into focused files.

**Tech Stack:** React 19, Vite 8, React Router 7, Tailwind 4, `node --test` for unit tests.

## Global Constraints

- Scope is `apps/web-app` only. No backend changes, no migration, no API contract change.
- The five SEO landing paths (`/sinhala-ai`, `/sinhala-grammar-checker`, `/sinhala-headline-generator`, `/sinhala-news-summarizer`, `/sinhala-style-rewriter`) MUST keep their prerendered body markup. Only `/` loses it.
- `SEO_PAGES['/']` MUST keep its managed `<head>` block — title, canonical, OG tags. Only the body prerender goes.
- The splash MUST render correctly with zero webfonts loaded. System font stack only; no dependency on Gwen, Satoshi, or Noto Sans Sinhala.
- Brand red is `#cd191a` (`--color-brand-600`). Light canvas is `#f5f4f4`. Dark canvas is `#161112`.
- `ProfilePage`'s save contract is unchanged: one `Promise.all` of `saveOnboarding({full_name, newsroom_roles, journalism_interests})` and `setMyCategory(categoryId)`, then `refreshAccount()`.
- The interests cap stays at 8.
- `variant="dialog"` and the `/profile` modal route keep working, including the `pl-16` header offset that clears the dialog's close button.
- Run `npm run lint` before every commit. It must pass.

---

## File Structure

**Phase 1 — Loading**

| File | Responsibility |
|---|---|
| `vite.config.js` | Modify — `writeBundle` skips body prerender for `path === '/'`; `staticPageMarkup` gains scoped inline CSS. |
| `index.html` | Modify — inline splash markup + inline `<style>` inside `#root`. |
| `src/main.jsx` | Modify — remove splash node before `render()`. |
| `src/App.jsx` | Modify — `React.lazy` route splitting; `authLoading` uses the shared loading surface. |
| `src/components/ui/RouteFallback.jsx` | Create — Suspense fallback shared by every lazy route. |
| `src/components/ErrorBoundary.jsx` | Create — class boundary so one lazy-chunk failure does not white-screen the app. |
| `scripts/check-bundle-size.mjs` | Create — fails if the main chunk exceeds budget. |

**Phase 2 — Profile**

| File | Responsibility |
|---|---|
| `src/components/profile/ProfileNav.jsx` | Create — tablist with roving tabindex, moved from `ProfilePage`. |
| `src/components/profile/CollapsibleGroup.jsx` | Create — disclosure primitive with collapsed summary line. |
| `src/components/profile/InfoCard.jsx` | Create — moved from `ProfilePage`, used by Account and Security. |
| `src/components/profile/AccountPanel.jsx` | Create — avatar, display name, role badge. |
| `src/components/profile/PreferencesPanel.jsx` | Create — the three collapsible groups. |
| `src/components/profile/SecurityPanel.jsx` | Create — sign-in email + verification state. |
| `src/components/ProfilePage.jsx` | Modify — keeps form state, dirty check, save/reset, footer. Panels move out. |

---

## Task 1: Bundle-size budget guard

Written first so the Phase 1 win is measured, not asserted.

**Files:**
- Create: `apps/web-app/scripts/check-bundle-size.mjs`
- Modify: `apps/web-app/package.json`

**Interfaces:**
- Consumes: nothing.
- Produces: `npm run check:size` — exits 1 with a readable message when the largest `dist/assets/*.js` chunk exceeds `MAX_MAIN_CHUNK_KB`.

- [ ] **Step 1: Record the current baseline**

```bash
cd apps/web-app && npm run build && ls -l dist/assets/*.js | awk '{print $5, $9}' | sort -rn | head -3
```

Expected: largest chunk ≈ `1059019` bytes (1034 KB). Write the real number into the plan's Task 8 verification note.

- [ ] **Step 2: Write the guard**

```js
// apps/web-app/scripts/check-bundle-size.mjs
/**
 * Build-size guard.
 *
 * The app shipped a single 1.03 MB chunk, which is what made the
 * pre-mount flash last seconds instead of milliseconds. Route splitting
 * fixed it; this keeps it fixed. Raise the budget deliberately, with a
 * reason, rather than letting it drift.
 */
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ASSETS = join(import.meta.dirname, '..', 'dist', 'assets');
const MAX_MAIN_CHUNK_KB = 600;

const chunks = readdirSync(ASSETS)
  .filter((f) => f.endsWith('.js'))
  .map((f) => ({ name: f, kb: statSync(join(ASSETS, f)).size / 1024 }))
  .sort((a, b) => b.kb - a.kb);

if (chunks.length === 0) {
  console.error('check:size — no JS chunks in dist/assets. Run `npm run build` first.');
  process.exit(1);
}

const [largest] = chunks;
const total = chunks.reduce((sum, c) => sum + c.kb, 0);

console.log(`check:size — ${chunks.length} chunks, ${total.toFixed(0)} KB total`);
for (const c of chunks.slice(0, 5)) console.log(`  ${c.kb.toFixed(0).padStart(5)} KB  ${c.name}`);

if (largest.kb > MAX_MAIN_CHUNK_KB) {
  console.error(
    `\ncheck:size FAILED — largest chunk ${largest.name} is ${largest.kb.toFixed(0)} KB, ` +
    `budget is ${MAX_MAIN_CHUNK_KB} KB.\n` +
    `Split a route with React.lazy, or raise MAX_MAIN_CHUNK_KB with a reason.`
  );
  process.exit(1);
}
console.log(`\ncheck:size OK — largest ${largest.kb.toFixed(0)} KB ≤ ${MAX_MAIN_CHUNK_KB} KB`);
```

- [ ] **Step 3: Add the script**

In `apps/web-app/package.json`, add to `"scripts"`:

```json
"check:size": "node scripts/check-bundle-size.mjs"
```

- [ ] **Step 4: Run it and confirm it FAILS on the current bundle**

```bash
cd apps/web-app && npm run check:size
```

Expected: exit 1, `largest chunk index-*.js is ~1034 KB, budget is 600 KB`. This failure is the point — it proves the guard works before anything is optimized.

- [ ] **Step 5: Commit**

```bash
git add apps/web-app/scripts/check-bundle-size.mjs apps/web-app/package.json
git commit -m "build: add bundle-size guard, currently failing at 1034KB"
```

---

## Task 2: Stop prerendering the app entry

**Files:**
- Modify: `apps/web-app/vite.config.js:100-135` (`seoPrerenderPlugin.writeBundle`)

**Interfaces:**
- Consumes: `SEO_PAGES`, `managedHead`, `staticPageMarkup` from the same file.
- Produces: a `dist/index.html` with an empty `#root`; five landing `index.html` files unchanged in behaviour.

- [ ] **Step 1: Change the write loop**

In `writeBundle`, replace the body of the `for (const page of Object.values(SEO_PAGES))` loop:

```js
        for (const page of Object.values(SEO_PAGES)) {
          // The app's own entry document. It gets the managed <head> block —
          // title, canonical, OG — but NOT the prerendered body: whatever is
          // written into #root is painted unstyled until the bundle parses
          // and React replaces it, which is a wall of Times New Roman on the
          // one URL every real session starts at. The same copy is already
          // crawlable at /sinhala-ai, which exists for that purpose, so
          // nothing is lost for search.
          const isAppEntry = page.path === '/'

          const html = template
            .replace(/<!-- seo:managed-start -->[\s\S]*?<!-- seo:managed-end -->/, managedHead(page))
            .replace(
              '<div id="root">',
              isAppEntry ? '<div id="root">' : `<div id="root">${staticPageMarkup(page)}`
            )

          const destination = page.path === '/'
            ? indexPath
            : path.join(outputDir, page.path.slice(1), 'index.html')

          fs.mkdirSync(path.dirname(destination), { recursive: true })
          fs.writeFileSync(destination, html)
        }
```

Note the `.replace` target changed from `'<div id="root"></div>'` to `'<div id="root">'`. Task 3 puts splash markup inside `#root`, so the old exact-match string will no longer exist in the template.

- [ ] **Step 2: Build and verify**

```bash
cd apps/web-app && npm run build
grep -c 'data-seo-prerendered' dist/index.html || echo "ABSENT (correct)"
grep -c 'data-seo-prerendered' dist/sinhala-ai/index.html
```

Expected: `ABSENT (correct)` for the first, `1` for the second.

- [ ] **Step 3: Verify head metadata survived**

```bash
grep -o '<title>[^<]*</title>' dist/index.html
grep -o 'rel="canonical" href="[^"]*"' dist/index.html
```

Expected: `<title>SinAi — Free Sinhala AI Writing Assistant</title>` and `href="https://chat.sin-ai.app/"`.

- [ ] **Step 4: Commit**

```bash
git add apps/web-app/vite.config.js
git commit -m "fix: stop prerendering SEO body into the app entry document"
```

---

## Task 3: Branded splash

**Files:**
- Modify: `apps/web-app/index.html`
- Modify: `apps/web-app/src/main.jsx`

**Interfaces:**
- Produces: a `#sinai-splash` node inside `#root`, removed by `main.jsx` before `render()`.

- [ ] **Step 1: Add splash markup and inline CSS to `index.html`**

Replace `<div id="root"></div>` with:

```html
    <style>
      /* Inline and render-blocking-free: the splash must paint on the first
         frame, before any stylesheet or webfont arrives. An external file
         would be one more round trip, which is the problem being solved.
         System stack only — Gwen and Satoshi have not loaded yet. */
      #sinai-splash {
        position: fixed; inset: 0; z-index: 9999;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center; gap: 18px;
        background: #f5f4f4;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      #sinai-splash .sinai-splash-mark {
        font-size: 30px; font-weight: 700; letter-spacing: -0.02em; color: #1a1416;
      }
      #sinai-splash .sinai-splash-mark span { color: #cd191a; }
      #sinai-splash .sinai-splash-bar {
        width: 132px; height: 3px; border-radius: 999px;
        background: rgba(205, 25, 26, 0.16); overflow: hidden;
      }
      #sinai-splash .sinai-splash-bar::after {
        content: ''; display: block; width: 40%; height: 100%; border-radius: 999px;
        background: #cd191a; animation: sinai-splash-slide 1.1s ease-in-out infinite;
      }
      @keyframes sinai-splash-slide {
        0%   { transform: translateX(-100%); }
        100% { transform: translateX(330%); }
      }
      @media (prefers-reduced-motion: reduce) {
        #sinai-splash .sinai-splash-bar::after { animation: none; width: 100%; opacity: 0.55; }
      }
      @media (prefers-color-scheme: dark) {
        #sinai-splash { background: #161112; }
        #sinai-splash .sinai-splash-mark { color: #f8f7f7; }
      }
    </style>
    <div id="root">
      <div id="sinai-splash" role="status" aria-live="polite">
        <div class="sinai-splash-mark">Sin<span>Ai</span></div>
        <div class="sinai-splash-bar"></div>
        <span style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">
          Loading SinAi
        </span>
      </div>
    </div>
```

- [ ] **Step 2: Remove the splash in `main.jsx`**

Insert immediately before `createRoot(...)`:

```js
// The splash lives in index.html so it can paint before this bundle parses.
// Removed here rather than by React: React only owns #root's children after
// the first render, and leaving the node for it to reconcile away produces a
// visible second frame.
document.getElementById('sinai-splash')?.remove()
```

- [ ] **Step 3: Verify in the browser**

```bash
cd apps/web-app && npm run build && npx serve -s dist -l 4173
```

Open `http://localhost:4173`, hard-reload with the network throttled to Slow 3G. Expected: brand splash, then the app. No serif text at any point.

- [ ] **Step 4: Commit**

```bash
git add apps/web-app/index.html apps/web-app/src/main.jsx
git commit -m "feat: branded inline splash on the app entry"
```

---

## Task 4: Error boundary and route fallback

**Files:**
- Create: `apps/web-app/src/components/ErrorBoundary.jsx`
- Create: `apps/web-app/src/components/ui/RouteFallback.jsx`

**Interfaces:**
- Produces: `<ErrorBoundary>{children}</ErrorBoundary>` (default export) and `<RouteFallback />` (default export). Task 5 wraps lazy routes in both.

- [ ] **Step 1: Write `RouteFallback.jsx`**

```jsx
import { SkeletonLines } from './Skeleton';

/**
 * Suspense fallback for a lazily loaded route.
 *
 * Deliberately not the index.html splash: that one covers a cold start with
 * no shell. By the time a route chunk is fetching, the sidebar and header are
 * already painted, so a full-screen overlay would be a regression.
 */
export default function RouteFallback() {
  return (
    <div className="w-full py-10" role="status" aria-live="polite">
      <span className="sr-only">Loading</span>
      <SkeletonLines widths={[38, 100, 92, 97, 64]} className="max-w-3xl" />
    </div>
  );
}
```

- [ ] **Step 2: Write `ErrorBoundary.jsx`**

```jsx
import { Component } from 'react';

/**
 * Catches render errors so one failure does not white-screen the product.
 *
 * Most valuable around lazy routes: a chunk request that fails — stale
 * cache after a deploy, a dropped connection mid-navigation — throws during
 * render, and without a boundary React unmounts the entire tree.
 *
 * Must be a class. There is no hook equivalent of componentDidCatch.
 */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Unhandled render error', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center" role="alert">
        <h2 className="text-[18px] font-bold text-ink-900">Something went wrong</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-500">
          This part of the app failed to load. Reloading usually fixes it.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-5 cursor-pointer rounded-xl bg-brand-600 px-5 py-2.5 text-[13.5px]
            font-semibold text-white hover:bg-brand-700"
        >
          Reload
        </button>
      </div>
    );
  }
}
```

- [ ] **Step 3: Lint**

```bash
cd apps/web-app && npm run lint
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web-app/src/components/ErrorBoundary.jsx apps/web-app/src/components/ui/RouteFallback.jsx
git commit -m "feat: error boundary and lazy-route fallback"
```

---

## Task 5: Code-split the routes

**Files:**
- Modify: `apps/web-app/src/App.jsx`
- Modify: `apps/web-app/src/main.jsx`

**Interfaces:**
- Consumes: `ErrorBoundary`, `RouteFallback` from Task 4.
- Produces: a main chunk under the 600 KB budget from Task 1.

- [ ] **Step 1: Convert the admin subtree and heavy routes to `lazy`**

In `App.jsx`, delete these static imports and replace them with lazy ones. Keep `Dashboard`, `Sidebar`, `Editor`, `ResultsPane`, `OutputPanel`, `HeadlineOutputPanel` eager — they are the first paint of most sessions.

```jsx
import { lazy, Suspense } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import RouteFallback from './components/ui/RouteFallback';

// The admin console pulls in recharts and 14 pages. No ordinary session
// needs a byte of it.
const AdminRoute       = lazy(() => import('./admin/AdminRoute'));
const AdminLayout      = lazy(() => import('./admin/AdminLayout'));
const Overview         = lazy(() => import('./admin/pages/Overview'));
const AdminUsers       = lazy(() => import('./admin/pages/Users'));
const UserDetail       = lazy(() => import('./admin/pages/UserDetail'));
const Chats            = lazy(() => import('./admin/pages/Chats'));
const Categories       = lazy(() => import('./admin/pages/Categories'));
const AdminSettings    = lazy(() => import('./admin/pages/Settings'));
const GrammarSettings  = lazy(() => import('./admin/pages/settings/GrammarSettings'));
const HeadlineSettings = lazy(() => import('./admin/pages/settings/HeadlineSettings'));
const RewriterSettings = lazy(() => import('./admin/pages/settings/RewriterSettings'));
const SummarizerSettings = lazy(() => import('./admin/pages/settings/SummarizerSettings'));
const Activity         = lazy(() => import('./admin/pages/Activity'));
const SinLLamaPage     = lazy(() => import('./admin/research/SinLLamaPage'));
const ModelComparison  = lazy(() => import('./admin/research/ModelComparison'));

const OptimizePage   = lazy(() => import('./components/optimize/OptimizePage'));
const HistoryPage    = lazy(() => import('./components/HistoryPage'));
const SettingsPage   = lazy(() => import('./components/SettingsPage'));
const ProfilePage    = lazy(() => import('./components/ProfilePage'));
const Plans          = lazy(() => import('./components/Plans'));
const Onboarding     = lazy(() => import('./components/onboarding/Onboarding'));
const SeoLandingPage = lazy(() => import('./components/seo/SeoLandingPage'));
```

- [ ] **Step 2: Wrap each `<Routes>` block in Suspense**

There are three return points that render routes. Each needs its own boundary — the admin one returns early, so a single wrapper at the bottom would not cover it.

Admin branch:

```jsx
  if (location.pathname.startsWith('/admin')) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            {/* ...unchanged route table... */}
          </Routes>
        </Suspense>
      </ErrorBoundary>
    );
  }
```

The SEO branch and the onboarding branch:

```jsx
  if (seoLandingPage) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<RouteFallback />}>
          <SeoLandingPage page={seoLandingPage} />
        </Suspense>
      </ErrorBoundary>
    );
  }
```

```jsx
  if (user && !user.onboarding_completed_at) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<RouteFallback />}>
          <Onboarding user={user} onComplete={updateAccount} />
        </Suspense>
      </ErrorBoundary>
    );
  }
```

Main route table — wrap the `<Routes location={backgroundLocation}>` element:

```jsx
            <ErrorBoundary>
              <Suspense fallback={<RouteFallback />}>
                <Routes location={backgroundLocation}>
                  {/* ...unchanged... */}
                </Routes>
              </Suspense>
            </ErrorBoundary>
```

Modal route table — wrap `<Routes location={location}>` the same way. Its fallback is `null`, not `RouteFallback`: a skeleton has nowhere to render before the dialog exists.

```jsx
      <ErrorBoundary>
        <Suspense fallback={null}>
          <Routes location={location}>
            {/* ...unchanged... */}
          </Routes>
        </Suspense>
      </ErrorBoundary>
```

- [ ] **Step 3: Replace the `authLoading` white div**

```jsx
  if (authLoading) {
    return (
      <div
        className="h-full bg-canvas flex flex-col items-center justify-center gap-4"
        role="status"
        aria-live="polite"
      >
        <span className="sr-only">Loading your workspace</span>
        <img src="/logored.svg" alt="" className="w-9 h-9 object-contain" />
        <div className="w-28 h-[3px] rounded-full bg-brand-600/15 overflow-hidden">
          <div className="h-full w-2/5 rounded-full bg-brand-600 animate-shimmer" />
        </div>
      </div>
    );
  }
```

- [ ] **Step 4: Wrap the app root in `main.jsx`**

```jsx
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
```

Add `import ErrorBoundary from './components/ErrorBoundary'`.

- [ ] **Step 5: Build and check the budget**

```bash
cd apps/web-app && npm run build && npm run check:size
```

Expected: PASS, largest chunk well under 600 KB, and several new chunks listed.

- [ ] **Step 6: Smoke-test every split route in the browser**

```bash
cd apps/web-app && npx serve -s dist -l 4173
```

Visit `/dashboard`, `/grammar`, `/history`, `/settings`, `/plans`, `/profile`, `/optimize`, `/sinhala-ai`, and `/admin`. Each must render, with no console errors.

- [ ] **Step 7: Lint and commit**

```bash
cd apps/web-app && npm run lint
git add apps/web-app/src/App.jsx apps/web-app/src/main.jsx
git commit -m "perf: code-split admin, SEO, and account routes"
```

---

## Task 6: Style the SEO landing prerender

**Files:**
- Modify: `apps/web-app/vite.config.js` (`staticPageMarkup`)

**Interfaces:**
- Consumes: nothing new.
- Produces: landing `index.html` files whose prerendered markup is branded rather than browser-default.

- [ ] **Step 1: Add a scoped style block**

Add above `staticPageMarkup`:

```js
/* Inline, scoped to the prerendered subtree, and dropped the moment React
   mounts. These pages must ship their copy in the HTML for crawlers, which
   means a human on a slow connection sees that copy first — as Times New
   Roman at full window width unless it is styled here. Scoped to
   [data-seo-prerendered] so it cannot leak into the mounted app. */
const PRERENDER_CSS = `
[data-seo-prerendered]{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
color:#1a1416;background:#f5f4f4;max-width:56rem;margin:0 auto;padding:2rem 1.25rem 4rem;line-height:1.6}
[data-seo-prerendered] nav{display:flex;gap:1rem;align-items:center;margin-bottom:3rem;font-weight:600}
[data-seo-prerendered] a{color:#cd191a;text-decoration:none}
[data-seo-prerendered] h1{font-size:2.1rem;line-height:1.15;letter-spacing:-.02em;margin:.5rem 0 1rem}
[data-seo-prerendered] h2{font-size:1.05rem;margin:0 0 .35rem}
[data-seo-prerendered] p{color:#5b5153;margin:0 0 .75rem}
[data-seo-prerendered] section{margin-bottom:2.5rem}
[data-seo-prerendered] section[aria-label] a,[data-seo-prerendered] article{
display:block;border:1px solid #e7e4e4;border-radius:14px;padding:1rem 1.15rem;margin-bottom:.75rem;background:#fff}
[data-seo-prerendered] footer{border-top:1px solid #e7e4e4;padding-top:1.25rem;display:flex;gap:1rem}
@media(prefers-color-scheme:dark){
[data-seo-prerendered]{background:#161112;color:#f8f7f7}
[data-seo-prerendered] p{color:#a9a0a2}
[data-seo-prerendered] section[aria-label] a,[data-seo-prerendered] article{background:#1f1819;border-color:#2e2527}
[data-seo-prerendered] footer{border-color:#2e2527}}
`.replace(/\n/g, '')
```

- [ ] **Step 2: Emit it**

In `staticPageMarkup`, change the opening of the returned string:

```js
  return `<style>${PRERENDER_CSS}</style><div data-seo-prerendered="true">
```

- [ ] **Step 3: Build and verify**

```bash
cd apps/web-app && npm run build
grep -c 'data-seo-prerendered{font-family' dist/sinhala-ai/index.html
grep -c 'data-seo-prerendered' dist/index.html || echo "ABSENT (correct)"
```

Expected: `1` for the landing page, `ABSENT (correct)` for the entry.

- [ ] **Step 4: Commit**

```bash
git add apps/web-app/vite.config.js
git commit -m "fix: style the prerendered SEO landing markup"
```

---

## Task 7: Profile — extract shared pieces

Pure moves, no behaviour change. Kept as its own task so a reviewer can confirm nothing changed before the restructure lands.

**Files:**
- Create: `apps/web-app/src/components/profile/InfoCard.jsx`
- Create: `apps/web-app/src/components/profile/ProfileNav.jsx`
- Modify: `apps/web-app/src/components/ProfilePage.jsx`

**Interfaces:**
- Produces:
  - `InfoCard({ icon, label, value, valueClassName, children })` — default export.
  - `ProfileNav({ tabs, activeTab, onChange })` — default export. **Note the new `tabs` prop**: the tab list is no longer a module constant, because Task 8 changes it from five entries to three.

- [ ] **Step 1: Create `InfoCard.jsx`**

Move the existing component verbatim, adding the import:

```jsx
export default function InfoCard({ icon: Icon, label, value, valueClassName = '', children }) {
  return (
    <div className="flex min-h-[88px] items-center gap-4 rounded-2xl border border-ink-200 bg-white p-4 dark:bg-ink-50">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink-100 text-ink-500">
        <Icon size={19} strokeWidth={1.9} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-medium text-ink-500">{label}</p>
        {children ?? (
          <p className={`mt-1 truncate text-[14px] font-semibold text-ink-900 ${valueClassName}`} title={value}>
            {value}
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `ProfileNav.jsx`**

Move the existing component, replacing every `PROFILE_TABS` reference with the `tabs` prop:

```jsx
export default function ProfileNav({ tabs, activeTab, onChange }) {
  const handleKeyDown = (event, currentIndex) => {
    const keys = ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();

    let nextIndex = currentIndex;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % tabs.length;
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = tabs.length - 1;
    }

    const nextTab = tabs[nextIndex];
    onChange(nextTab.id);
    requestAnimationFrame(() => document.getElementById(`profile-tab-${nextTab.id}`)?.focus());
  };

  return (
    <nav
      className="flex gap-1 overflow-x-auto px-4 pb-4 sm:flex-col sm:overflow-visible sm:px-5 sm:pb-0"
      aria-label="Profile sections"
      role="tablist"
      aria-orientation="vertical"
    >
      {tabs.map(({ id, label, icon: Icon }, index) => {
        const selected = activeTab === id;
        return (
          <button
            key={id}
            id={`profile-tab-${id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`profile-panel-${id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={`flex min-h-11 shrink-0 items-center gap-3 rounded-xl px-3.5 text-left text-[13.5px]
              font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500
              ${selected
                ? 'bg-ink-100 text-ink-900'
                : 'text-ink-500 hover:bg-ink-50 hover:text-ink-800'}`}
          >
            <Icon size={18} strokeWidth={1.9} className="shrink-0" />
            {label}
          </button>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 3: Update `ProfilePage.jsx`**

Delete the two moved component definitions. Import them, and pass `tabs={PROFILE_TABS}` at the call site. `PROFILE_TABS` stays in `ProfilePage.jsx` for now — Task 8 rewrites it.

- [ ] **Step 4: Verify nothing changed**

```bash
cd apps/web-app && npm run lint && npm run build
npx serve -s dist -l 4173
```

Open `/profile`. All five tabs present, keyboard arrows still move between them, save still works.

- [ ] **Step 5: Commit**

```bash
git add apps/web-app/src/components/profile apps/web-app/src/components/ProfilePage.jsx
git commit -m "refactor: extract InfoCard and ProfileNav from ProfilePage"
```

---

## Task 8: Profile — three tabs and the Preferences panel

**Files:**
- Create: `apps/web-app/src/components/profile/CollapsibleGroup.jsx`
- Create: `apps/web-app/src/components/profile/AccountPanel.jsx`
- Create: `apps/web-app/src/components/profile/PreferencesPanel.jsx`
- Create: `apps/web-app/src/components/profile/SecurityPanel.jsx`
- Modify: `apps/web-app/src/components/ProfilePage.jsx`

**Interfaces:**
- Consumes: `InfoCard`, `ProfileNav` from Task 7.
- Produces:
  - `CollapsibleGroup({ id, title, summary, defaultOpen, children })`
  - `AccountPanel({ displayName, initials, accountRole, roleLabels, name, onNameChange })`
  - `PreferencesPanel({ roles, onToggleRole, interests, onToggleInterest, categories, categoryId, onCategoryChange })`
  - `SecurityPanel({ email, emailVerified })`

- [ ] **Step 1: Write `CollapsibleGroup.jsx`**

```jsx
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Disclosure with a collapsed summary line.
 *
 * The summary is the point: three groups on one panel only beats three tabs
 * if a glance still tells you what is selected in each.
 */
export default function CollapsibleGroup({ id, title, summary, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="rounded-2xl border border-ink-200 bg-white dark:bg-ink-50">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`profile-group-${id}`}
          onClick={() => setOpen((v) => !v)}
          className="flex w-full cursor-pointer items-center gap-3 rounded-2xl px-4 py-3.5 text-left
            focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/15 sm:px-5"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[13.5px] font-bold text-ink-900">{title}</span>
            <span className="mt-0.5 block truncate text-[12px] text-ink-500">{summary}</span>
          </span>
          <ChevronDown
            size={17}
            className={`shrink-0 text-ink-400 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>
      </h3>
      {open && (
        <div id={`profile-group-${id}`} className="border-t border-ink-200/70 px-4 py-4 sm:px-5 sm:py-5">
          {children}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Write `AccountPanel.jsx`**

Account ID, Profile set up, and the Email InfoCard are all gone — only Display name remains as a card.

```jsx
import { ShieldCheck, UserRound } from 'lucide-react';
import InfoCard from './InfoCard';

export default function AccountPanel({
  displayName, initials, accountRole, roleLabels, name, onNameChange,
}) {
  return (
    <div className="p-5 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex h-[76px] w-[76px] shrink-0 items-center justify-center rounded-[22px] bg-ink-950 text-[27px] font-bold text-white shadow-sm">
          {initials || 'S'}
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-[22px] font-bold tracking-tight text-ink-950">{displayName}</h3>
          <p className="mt-0.5 truncate text-[13.5px] text-ink-500">
            {roleLabels.length ? roleLabels.join(' · ') : 'SinAi newsroom workspace'}
          </p>
          <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-ink-50 px-2.5 py-1 text-[11px] font-semibold text-ink-700">
            <ShieldCheck size={12} /> {accountRole}
          </span>
        </div>
      </div>

      <div className="mt-8">
        <InfoCard icon={UserRound} label="Display name">
          <input
            id="profile-name"
            className="mt-0.5 w-full border-0 bg-transparent p-0 text-[14px] font-semibold text-ink-900 outline-none placeholder:text-ink-400 focus:ring-0"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="Add your name"
            aria-label="Display name"
            autoComplete="nickname"
            maxLength={60}
            required
          />
        </InfoCard>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write `PreferencesPanel.jsx`**

```jsx
import { Check } from 'lucide-react';
import CollapsibleGroup from './CollapsibleGroup';
import { JOURNALISM_INTERESTS, NEWSROOM_ROLES } from '../onboarding/options';

const INPUT_CLASS = `w-full min-h-12 px-3.5 rounded-xl border border-ink-200 bg-white dark:bg-ink-50 text-[14px]
  text-ink-900 placeholder:text-ink-400 transition-colors outline-none hover:border-ink-300
  focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10`;

const MAX_INTERESTS = 8;

export default function PreferencesPanel({
  roles, onToggleRole,
  interests, onToggleInterest,
  categories, categoryId, onCategoryChange,
}) {
  const roleLabels = roles
    .map((id) => NEWSROOM_ROLES.find((r) => r.id === id)?.label)
    .filter(Boolean);
  const categoryName = categories.find((c) => c.id === categoryId)?.name;
  const interestLabels = interests
    .map((id) => JOURNALISM_INTERESTS.find((i) => i.id === id)?.label)
    .filter(Boolean);

  return (
    <div className="space-y-3 p-5 sm:p-8">
      <CollapsibleGroup
        id="roles"
        title="Newsroom roles"
        defaultOpen
        summary={roleLabels.length ? roleLabels.join(' · ') : 'None selected yet'}
      >
        <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2" aria-label="Your newsroom roles">
          {NEWSROOM_ROLES.map((role) => {
            const selected = roles.includes(role.id);
            return (
              <button
                key={role.id}
                type="button"
                aria-pressed={selected}
                onClick={() => onToggleRole(role.id)}
                className={`group flex min-h-[66px] cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 text-left
                  transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/15
                  ${selected
                    ? 'border-brand-600 bg-brand-50 shadow-sm'
                    : 'border-ink-200 bg-white hover:border-brand-300 hover:bg-brand-50/50 dark:bg-ink-50'}`}
              >
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors
                  ${selected ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-300 text-transparent group-hover:border-brand-300'}`}
                >
                  <Check size={12} strokeWidth={3} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-bold leading-tight text-ink-900">{role.label}</span>
                  <span className="mt-1 block text-[11px] leading-snug text-ink-500">{role.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </CollapsibleGroup>

      <CollapsibleGroup
        id="category"
        title="Newsroom category"
        summary={categoryName ?? 'Not specified'}
      >
        <div className="relative max-w-md">
          <label htmlFor="profile-category" className="mb-1.5 block text-[12px] font-semibold text-ink-700">
            Choose the community closest to your work
          </label>
          <select
            id="profile-category"
            className={`${INPUT_CLASS} cursor-pointer appearance-none pr-10`}
            value={categoryId}
            onChange={(event) => onCategoryChange(event.target.value)}
          >
            <option value="">Not specified</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-3.5 top-[2.9rem] text-ink-400">⌄</span>
        </div>
      </CollapsibleGroup>

      <CollapsibleGroup
        id="interests"
        title="Interests"
        summary={
          interestLabels.length
            ? `${interestLabels.length} of ${MAX_INTERESTS} · ${interestLabels.join(', ')}`
            : 'None selected yet'
        }
      >
        <p className="mb-4 text-[12.5px] leading-relaxed text-ink-500">
          Choose up to {MAX_INTERESTS} topics you report on or follow most closely.
        </p>
        <div className="flex flex-wrap gap-2.5" aria-label="Your journalism interests">
          {JOURNALISM_INTERESTS.map((interest) => {
            const selected = interests.includes(interest.id);
            const unavailable = !selected && interests.length >= MAX_INTERESTS;
            return (
              <button
                key={interest.id}
                type="button"
                aria-pressed={selected}
                disabled={unavailable}
                onClick={() => onToggleInterest(interest.id)}
                className={`min-h-11 cursor-pointer rounded-full border px-4 text-[12.5px] font-semibold transition-colors
                  focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/15
                  disabled:cursor-not-allowed disabled:opacity-40
                  ${selected
                    ? 'border-brand-600 bg-brand-50 text-brand-800'
                    : 'border-ink-200 bg-white text-ink-700 hover:border-brand-300 hover:bg-brand-50/60 dark:bg-ink-50'}`}
              >
                {interest.label}
              </button>
            );
          })}
        </div>
      </CollapsibleGroup>
    </div>
  );
}
```

- [ ] **Step 4: Write `SecurityPanel.jsx`**

Account status and the lock paragraph are gone.

```jsx
import { AtSign, BadgeCheck } from 'lucide-react';
import InfoCard from './InfoCard';

export default function SecurityPanel({ email, emailVerified }) {
  return (
    <div className="space-y-4 p-5 sm:p-8">
      <InfoCard icon={AtSign} label="Sign-in email" value={email || 'Not available'} />
      <InfoCard
        icon={BadgeCheck}
        label="Email verification"
        value={emailVerified ? 'Verified' : 'Verification pending'}
        valueClassName={emailVerified ? 'text-emerald-700' : 'text-amber-700'}
      />
    </div>
  );
}
```

- [ ] **Step 5: Rewrite `ProfilePage.jsx`**

Replace `PROFILE_TABS`:

```jsx
const PROFILE_TABS = [
  { id: 'account', label: 'Account', icon: UserRound },
  { id: 'preferences', label: 'Preferences', icon: SlidersHorizontal },
  { id: 'security', label: 'Security', icon: LockKeyhole },
];
```

Imports become `{ ArrowLeft, CheckCircle2, LockKeyhole, Save, SlidersHorizontal, UserRound }` from `lucide-react` — `AtSign`, `BadgeCheck`, `Brain`, `BriefcaseBusiness`, `CalendarDays`, `Check`, `Fingerprint`, `Heart`, `Mail`, `ShieldCheck` all move to the panels or are unused. Delete the now-unused `INPUT_CLASS`, `EmptySelection`, `shortAccountId`, `profileSetUp`, and the `categoryName` local.

`PanelHeading` stays. Panel rendering becomes:

```jsx
{activeTab === 'account' && (
  <>
    <PanelHeading title="Account" description="Your identity and account information." />
    <AccountPanel
      displayName={displayName}
      initials={initials}
      accountRole={accountRole}
      roleLabels={roleLabels}
      name={name}
      onNameChange={(value) => { setName(value); setSaveState('idle'); }}
    />
  </>
)}

{activeTab === 'preferences' && (
  <>
    <PanelHeading
      title="Preferences"
      description="The newsroom context SinAi uses to tailor your workspace."
    />
    <PreferencesPanel
      roles={roles}
      onToggleRole={toggleRole}
      interests={interests}
      onToggleInterest={toggleInterest}
      categories={categories}
      categoryId={categoryId}
      onCategoryChange={(value) => { setCategoryId(value); setSaveState('idle'); }}
    />
  </>
)}

{activeTab === 'security' && (
  <>
    <PanelHeading title="Security" description="Account access and verification details." />
    <SecurityPanel email={email} emailVerified={profile?.email_verified} />
  </>
)}
```

And the nav call site: `<ProfileNav tabs={PROFILE_TABS} activeTab={activeTab} onChange={setActiveTab} />`.

Keep unchanged: `user`/`profile`/`refreshAccount`, the `categories` fetch, `original`, `dirty`, `roleLabels`, `toggleRole`, `toggleInterest`, `reset`, `save`, and the entire footer.

- [ ] **Step 6: Lint and build**

```bash
cd apps/web-app && npm run lint && npm run build && npm run check:size
```

Expected: all pass.

- [ ] **Step 7: Verify behaviour in the browser**

```bash
cd apps/web-app && npx serve -s dist -l 4173
```

Sign in, open `/profile`, and confirm:
- Three tabs: Account, Preferences, Security.
- Preferences shows three collapsible groups; Newsroom roles is open on load.
- Collapsed summaries reflect the current selection.
- Toggling a role marks the form dirty; "You have unsaved changes" appears.
- The 9th interest is disabled.
- Save writes and the success line appears; reload shows the saved values.
- Discard restores.
- No Account ID, no Profile set up, no duplicate email, no Account status card, no Personalization tab.

- [ ] **Step 8: Commit**

```bash
git add apps/web-app/src/components/profile apps/web-app/src/components/ProfilePage.jsx
git commit -m "feat: collapse Profile to three tabs, drop dead account info"
```

---

## Self-Review Notes

**Spec coverage.** §3.2 → Tasks 2, 3, 5, 6. §3.3 → Tasks 1, 3, 5, 6. §4.1 → Task 8. §4.2 → Task 8 Steps 2, 4, 5. §4.3 → Tasks 7, 8. §6.1 error boundary and build-size guard → Tasks 4, 1. §6.1's `usePlatformMeta` admin surfacing belongs to the Phase 4 plan, not this one.

**Deliberate ordering.** Task 1 lands a *failing* guard before any optimization, so Task 5 has an objective pass/fail rather than a claimed improvement. Task 7 is a pure move committed separately from Task 8's restructure, so a reviewer can diff them independently.

**Known coupling.** Task 2 changes the `.replace` target to `'<div id="root">'` because Task 3 puts markup inside `#root`. If Task 3 is skipped, Task 2 still works — the replacement is a prefix match either way.
