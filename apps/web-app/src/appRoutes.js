/**
 * Every path the React router owns.
 *
 * Read by two consumers, which is the whole point of the file existing:
 *
 *   - `App.jsx`, for the modal-route list.
 *   - `vite.config.js`, to generate `dist/serve.json` at build time.
 *
 * The production start script serves `dist` with `serve`. Its `--single`
 * flag rewrites EVERY extensionless request to `/index.html` — including
 * the five prerendered SEO landing pages, whose whole reason for existing
 * is to be served with their copy already in the HTML. serve-handler's
 * `findRelated` consults only the rewritten path when a rewrite matches, so
 * `dist/sinhala-ai/index.html` was never reachable.
 *
 * A catch-all rewrite cannot fix this either: `applyRewrites` re-applies the
 * remaining rules to its own output, so a `/(.*)` fallback listed after the
 * landing pages immediately recaptures them. Listing the app's own routes
 * explicitly, with no catch-all, is what actually works — anything not
 * named here falls through to a real file on disk.
 *
 * Adding a route to the router means adding it here.
 */

/** Full-page routes. */
export const PAGE_ROUTES = [
  '/dashboard',
  '/optimize',
  '/grammar',
  '/headlines',
  '/rewriter',
  '/summarizer',
  '/history',
  '/plans',
];

/** Routes that render as a dialog over the page behind them. */
export const MODAL_ROUTES = [
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/profile',
];

/** Kept reachable so old bookmarks hit the router's redirects, not a 404. */
export const LEGACY_ROUTES = [
  '/sinllama',
  '/summarizer-playground',
  '/comparison',
];

/**
 * path-to-regexp sources for `serve.json`.
 *
 * serve-handler pins path-to-regexp 3.3.0, NOT the 8.x at the project root,
 * so the wildcard is `:path*` — 8.x's `*path` is parsed as a literal there.
 *
 * `/admin` is listed separately from `/admin/:path*` because serve-handler
 * rewrites `*` to `(.*)` before compiling, making the source
 * `/admin/:path(.*)` — which still requires the separating slash and so
 * never matches a bare `/admin`.
 *
 * Anything genuinely unknown is not listed here on purpose: it 404s, and
 * serve-handler renders `dist/404.html` — a copy of the app shell — so the
 * router's own catch-all redirect still runs, with a truthful status code
 * rather than a 200 for a page that does not exist.
 */
export const SPA_ROUTE_SOURCES = [
  ...PAGE_ROUTES,
  ...MODAL_ROUTES,
  ...LEGACY_ROUTES,
  '/admin',
  '/admin/:path*',
];
