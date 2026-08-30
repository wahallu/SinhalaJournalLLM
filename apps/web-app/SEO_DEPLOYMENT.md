# SinAi search deployment checklist

The application now publishes six canonical, indexable URLs:

| Search intent | Canonical URL |
| --- | --- |
| Sinhala AI / Sinhala writing assistant | `https://chat.sin-ai.app/` |
| Sinhala AI tools | `https://chat.sin-ai.app/sinhala-ai` |
| Sinhala grammar checker | `https://chat.sin-ai.app/sinhala-grammar-checker` |
| Sinhala news headline generator | `https://chat.sin-ai.app/sinhala-headline-generator` |
| Sinhala news summarizer | `https://chat.sin-ai.app/sinhala-news-summarizer` |
| Sinhala article rewriter / tone changer | `https://chat.sin-ai.app/sinhala-style-rewriter` |

The interactive workspace URLs such as `/grammar`, `/dashboard`, account pages, and admin pages are deliberately excluded from the sitemap. They either canonicalize to a public landing page or return `noindex` so the site does not compete with duplicate, low-context pages.

## Required after deployment

1. Verify that every URL above returns its own title, canonical, visible `h1`, and JSON-LD in the raw response—not only after JavaScript runs.
2. Confirm that `https://chat.sin-ai.app/sitemap.xml` returns XML and `https://chat.sin-ai.app/robots.txt` ends with the sitemap URL.
3. In Google Search Console, add either the DNS domain property `sin-ai.app` or the URL-prefix property `https://chat.sin-ai.app/`.
4. Submit `https://chat.sin-ai.app/sitemap.xml` in the Sitemaps report.
5. Use URL Inspection → Test live URL → Request indexing for the homepage and the five landing pages.
6. Check the Page indexing and Performance reports weekly. Track impressions, clicks, average position, and the real queries that lead to each page.

Cloudflare currently prepends its managed Content Signals section to the live `robots.txt`. That is compatible with the origin file: after deployment, the custom sitemap line should appear below Cloudflare's managed section. If it does not, review **Cloudflare → Security Settings → Bot traffic → managed robots.txt**.

## Content and authority work

Technical SEO makes the pages eligible and understandable; it does not guarantee a ranking. Continue with useful, original material that a search result can cite:

- Publish tested Sinhala grammar explanations with real before/after examples and human review.
- Publish newsroom guides for headlines, summaries, and style editing, then link each guide to the matching chat landing page.
- Add links from the existing `sin-ai.app` research pages to the matching canonical chat URLs using descriptive link text.
- Seek relevant links and mentions from the university/project site, Sinhala journalism organizations, newsroom partners, and genuine product users.
- Keep claims tied to tested results. Do not create hundreds of thin keyword-variation pages or fabricate ratings, testimonials, benchmarks, or adoption figures.

When the visible page content changes substantially, update its `<lastmod>` value in `public/sitemap.xml`.

## Production smoke test

```sh
curl -sSL https://chat.sin-ai.app/sitemap.xml
curl -sSL https://chat.sin-ai.app/robots.txt
curl -sSL https://chat.sin-ai.app/sinhala-grammar-checker
```

The third response should contain the title `Free Sinhala Grammar Checker Online | SinAi`, its self-referencing canonical URL, an indexable robots meta tag, and the visible heading `Check Sinhala grammar in context`.

References: [Google Search Essentials](https://developers.google.com/search/docs/essentials), [build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap), [JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics), and [Cloudflare managed robots.txt](https://developers.cloudflare.com/bots/additional-configurations/managed-robots-txt/).
