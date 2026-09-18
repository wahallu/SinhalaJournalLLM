import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import zlib from 'node:zlib'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  DEFAULT_IMAGE,
  SEO_PAGES,
  SITE_NAME,
  absoluteUrl,
  buildStructuredData,
} from './src/seo/site.js'
import { SPA_ROUTE_SOURCES } from './src/appRoutes.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function managedHead(page) {
  const canonical = absoluteUrl(page.path)
  const schema = JSON.stringify(buildStructuredData(page)).replaceAll('<', '\\u003c')

  return `<!-- seo:managed-start -->
    <meta name="description" content="${escapeHtml(page.description)}" />
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
    <meta name="googlebot" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
    <link rel="canonical" href="${canonical}" />
    <meta name="theme-color" content="#f5f4f4" />
    <meta property="og:title" content="${escapeHtml(page.title)}" />
    <meta property="og:description" content="${escapeHtml(page.description)}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${SITE_NAME}" />
    <meta property="og:locale" content="si_LK" />
    <meta property="og:image" content="${DEFAULT_IMAGE}" />
    <meta property="og:image:alt" content="SinAi Sinhala writing assistant logo" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${escapeHtml(page.title)}" />
    <meta name="twitter:description" content="${escapeHtml(page.description)}" />
    <meta name="twitter:image" content="${DEFAULT_IMAGE}" />
    <script id="sinai-structured-data" type="application/ld+json">${schema}</script>
    <title>${escapeHtml(page.title)}</title>
    <!-- seo:managed-end -->`
}

/* The swappable region inside #root, delimited in index.html by
   <!--shell-start--> / <!--shell-end-->. Comment markers rather than a match
   on the markup itself, so editing the splash cannot silently break the
   prerender. Group 1 is the untouched original, used for the app entry. */
const SHELL_SLOT = /(<!--shell-start-->[\s\S]*?<!--shell-end-->)/

/* Inline and scoped to the prerendered subtree. These pages must ship their
   copy in the HTML for crawlers, which means a human on a slow connection
   sees that copy first -- as Times New Roman at full window width unless it
   is styled here. Scoped to [data-seo-prerendered] so nothing can leak into
   the mounted app, and dropped entirely the moment React replaces the node. */
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

function staticPageMarkup(page) {
  const cards = page.items.map((item) => {
    const inner = `<h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.description)}</p>`
    return item.href
      ? `<a href="${escapeHtml(item.href)}">${inner}</a>`
      : `<article>${inner}</article>`
  }).join('')

  const faqs = page.faqs.map((faq) => (
    `<article><h2>${escapeHtml(faq.question)}</h2><p>${escapeHtml(faq.answer)}</p></article>`
  )).join('')

  return `<style>${PRERENDER_CSS}</style><div data-seo-prerendered="true">
    <header><nav aria-label="Main navigation"><a href="/">SinAi</a> <a href="${escapeHtml(page.ctaHref)}">Open tool</a></nav></header>
    <main>
      <section>
        <p lang="si">${escapeHtml(page.eyebrow)}</p>
        <h1>${escapeHtml(page.heading)}</h1>
        <p>${escapeHtml(page.intro)}</p>
        <a href="${escapeHtml(page.ctaHref)}">${escapeHtml(page.ctaLabel)}</a>
        <p>Free to try without an account. Review AI output before publishing.</p>
      </section>
      <section aria-label="SinAi features">${cards}</section>
      <section aria-label="Frequently asked questions">${faqs}</section>
    </main>
    <footer><a href="https://sin-ai.app/privacy">Privacy</a> <a href="https://sin-ai.app/terms">Terms</a></footer>
  </div>`
}

function seoPrerenderPlugin() {
  let resolvedConfig
  return {
    name: 'sinai-seo-prerender',
    apply: 'build',
    configResolved(config) {
      resolvedConfig = config
    },
    writeBundle() {
      try {
        const outputDir = resolvedConfig?.build?.outDir
          ? path.resolve(resolvedConfig.root, resolvedConfig.build.outDir)
          : path.join(__dirname, 'dist')
        const indexPath = path.join(outputDir, 'index.html')

        if (!fs.existsSync(indexPath)) {
          console.warn(`[sinai-seo-prerender] index.html not found at ${indexPath}, skipping prerender.`)
          return
        }

        const template = fs.readFileSync(indexPath, 'utf8')

        for (const page of Object.values(SEO_PAGES)) {
          // The app's own entry document keeps the managed <head> block --
          // title, canonical, OG -- but NOT a prerendered body: whatever is
          // written into #root is painted unstyled until the bundle parses and
          // React replaces it, which is a wall of Times New Roman on the one
          // URL every real session starts at. The same copy is already
          // crawlable at /sinhala-ai, which exists for exactly that purpose,
          // so nothing is lost for search. It keeps the splash instead.
          //
          // A landing page gets its prerendered markup *in place of* the
          // splash, not alongside it. The splash is position:fixed with a high
          // z-index, so leaving both would hide the very content these pages
          // exist to serve -- permanently, for anyone whose JS never runs.
          const html = template
            .replace(/<!-- seo:managed-start -->[\s\S]*?<!-- seo:managed-end -->/, managedHead(page))
            // Function replacement, not a string: page copy is interpolated
            // into the markup, and a literal "$&" or "$1" in a description
            // would otherwise be read as a substitution pattern.
            .replace(SHELL_SLOT, (match) => (page.path === '/' ? match : staticPageMarkup(page)))

          const destination = page.path === '/'
            ? indexPath
            : path.join(outputDir, page.path.slice(1), 'index.html')

          fs.mkdirSync(path.dirname(destination), { recursive: true })
          fs.writeFileSync(destination, html)
        }

        // Routing config for `serve`, which the production start script uses.
        // Written here rather than kept in public/ so it can never disagree
        // with the set of pages this plugin just emitted.
        //
        // Deliberately NOT a single catch-all: see src/appRoutes.js. Only the
        // router's own paths are rewritten, so the prerendered landing pages
        // are found on disk instead of being swallowed by the SPA fallback.
        // Unknown paths 404, and serve-handler renders `404.html` when it
        // exists. Shipping the app shell there keeps the router's catch-all
        // redirect working for a mistyped URL, while still returning 404
        // rather than 200 for a page that genuinely is not there.
        //
        // Read back from disk rather than reusing `template`: the loop above
        // has just rewritten the entry's <head>, and the 404 shell should
        // carry the same one.
        fs.writeFileSync(path.join(outputDir, '404.html'), fs.readFileSync(indexPath, 'utf8'))

        fs.writeFileSync(
          path.join(outputDir, 'serve.json'),
          JSON.stringify({
            rewrites: SPA_ROUTE_SOURCES.map((source) => ({
              source,
              destination: '/index.html',
            })),
            // Same policy as nginx.conf and vercel.json: hashed assets are
            // immutable, everything else revalidates.
            headers: [
              {
                source: 'assets/**',
                headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
              },
              {
                source: '**/*.@(woff2|ttf|png|jpg|jpeg|webp|svg|ico)',
                headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }],
              },
            ],
          }, null, 2)
        )
      } catch (err) {
        console.warn(`[sinai-seo-prerender] Warning during SEO prerender: ${err.message}`)
      }
    },
  }
}

/* Writes .gz and .br siblings next to every compressible file in dist, so
   nginx (gzip_static / brotli_static) and CDNs that honour precompressed
   assets serve them without compressing on each request -- and at maximum
   level, which no server can afford to do per request. closeBundle rather
   than writeBundle: it runs after the prerender plugin has written its pages,
   so those get compressed too. */
const COMPRESSIBLE = /\.(js|mjs|css|html|svg|json|txt|xml|webmanifest)$/

function precompressPlugin() {
  let outDir
  return {
    name: 'sinai-precompress',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name)
        return entry.isDirectory() ? walk(full) : [full]
      })
      for (const file of walk(outDir)) {
        if (!COMPRESSIBLE.test(file)) continue
        const source = fs.readFileSync(file)
        if (source.length < 1024) continue
        fs.writeFileSync(`${file}.gz`, zlib.gzipSync(source, { level: 9 }))
        fs.writeFileSync(`${file}.br`, zlib.brotliCompressSync(source, {
          params: {
            [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
            [zlib.constants.BROTLI_PARAM_SIZE_HINT]: source.length,
          },
        }))
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), seoPrerenderPlugin(), precompressPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Both are Vite's defaults, stated so a future edit cannot quietly turn
    // minification off: oxc for JS, lightningcss for CSS.
    minify: 'oxc',
    cssMinify: 'lightningcss',
    // Evergreen targets: no down-levelling of syntax every supported browser
    // already runs, which is dead weight in the bundle.
    target: 'es2022',
    rolldownOptions: {
      output: {
        /* Vendor code in its own long-lived chunks. App code changes on
           nearly every deploy; React, the router and Radix change a few times
           a year. Split out, a deploy only invalidates the app chunk and
           returning visitors keep the rest from cache. recharts is left to
           the automatic splitter -- it is only reached from the lazy admin
           Overview route, and pinning it into a group would risk pulling it
           onto the entry path. */
        codeSplitting: {
          groups: [
            { name: 'react-vendor', test: /node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom)[\\/]/, priority: 20 },
            { name: 'radix-vendor', test: /node_modules[\\/](radix-ui|@radix-ui|@floating-ui)[\\/]/, priority: 15 },
            { name: 'icons-vendor', test: /node_modules[\\/]lucide-react[\\/]/, priority: 10 },
          ],
        },
      },
    },
  },
})
