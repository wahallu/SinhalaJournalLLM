import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  DEFAULT_IMAGE,
  SEO_PAGES,
  SITE_NAME,
  absoluteUrl,
  buildStructuredData,
} from './src/seo/site.js'

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

  return `<div data-seo-prerendered="true">
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
          const html = template
            .replace(/<!-- seo:managed-start -->[\s\S]*?<!-- seo:managed-end -->/, managedHead(page))
            .replace('<div id="root"></div>', `<div id="root">${staticPageMarkup(page)}</div>`)

          const destination = page.path === '/'
            ? indexPath
            : path.join(outputDir, page.path.slice(1), 'index.html')

          fs.mkdirSync(path.dirname(destination), { recursive: true })
          fs.writeFileSync(destination, html)
        }
      } catch (err) {
        console.warn(`[sinai-seo-prerender] Warning during SEO prerender: ${err.message}`)
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), seoPrerenderPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
