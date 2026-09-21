<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# SinAi (Sinhala Journal LLM) — Master Project Plan & AI Agent Blueprint

**Last Updated:** September 2026  
**Product Brand:** SinAi  
**Research Project:** Sinhala Journal LLM  
**Live Portfolio Origin:** `https://sin-ai.app`  
**Try SinAi Workspace Origin:** `https://chat.sin-ai.app`  
**Primary Monorepo Root:** `d:\SinhalaLLM\SinhalaJournalLLM`  
**Current Module:** `apps/portfolio`  

> [!IMPORTANT]
> **Identity & Research Attribution Rule**:
> - Our product is **SinAi**.
> - Our underlying research is **Sinhala Journal LLM**.
> - The base model is **SinLlama** (Aravinda et al., MERCon 2025). **Name it, with credit and a link to the paper**, wherever the base model is described. This replaces an earlier rule that said never to mention it; the project owner decided in September 2026 that the site should match the research paper, which states that the system adapts SinLlama.

---

## 1. Executive Vision & Mission

**SinAi** is a domain-adapted Artificial Intelligence ecosystem specifically engineered for the **Sinhala language** and **journalistic newsroom workflows**, developed under the **Sinhala Journal LLM** research initiative.

### The Problem it Solves
- Generic multilingual LLMs (e.g., base GPT/Claude/Llama) fail severely in morphologically complex low-resource languages like Sinhala. They exhibit high character-level token fragmentation, frequent morphological hallucinations, and failure to respect subtle grammatical rules (e.g., subject-verb honorific/gender harmony and case markers).
- Sri Lankan newsrooms face stringent deadline pressures across print, broadcast, and digital formats while working with a mixture of standard Unicode text and legacy ASCII typography (FM/UBIN font encoding).

### The SinAi Solution
SinAi delivers the **SinLlama** base model paired with specialized **Low-Rank Adaptation (LoRA)** task adapters, served across 3 unified client surfaces:
1. **SinAi Web App** (`apps/web-app`): The flagship writing studio and live workspace available at `https://chat.sin-ai.app`.
2. **SinAi Chrome Extension** (`apps/chrome-extension`): Manifest V3 browser writing assistant for CMS and web publishing.
3. **SinAi Google Docs Add-on** (`apps/docs-addon`): Google Apps Script sidebar for newsroom editorial collaboration.

*(Note: `apps/backend-api` is internal server/gateway infrastructure hosting the model pipelines and is not an open user client application).*

---

## 2. Monorepo Structure & Application Inventory

```
SinhalaJournalLLM/
├── docs/
│   ├── auth-setup.md                   # Complete Supabase Auth, JWT verification & RLS setup
│   ├── operations.md                   # Admin dashboard ops, telemetry rollups & retention
│   ├── serve_sinai.py                  # PyTorch/vLLM GPU server with hot LoRA adapter swapping
│   └── superpowers/specs/              # Historical architectural design specifications
│
├── apps/
│   ├── portfolio/                      # [THIS APP] Next.js 16 + React 19: product site + research case study (https://sin-ai.app)
│   │   ├── app/
│   │   │   ├── layout.tsx              # Marketplace-verified metadata (title, JSON-LD), fonts, root layout
│   │   │   ├── globals.css             # Tailwind v4 tokens, Gwen font faces (ligatures off, see 4.2), reduced-motion
│   │   │   ├── page.tsx                # Homepage: the plain-language product story (10 sections)
│   │   │   ├── research/page.tsx       # Research & engineering case study (data, architecture, results, evaluation...)
│   │   │   ├── research/<tool>/page.tsx  # Four tool deep dives, all rendered by components/research/ToolDeepDive.tsx
│   │   │   └── privacy/ terms/ support/ docs-addon/   # Google Workspace Marketplace pages. Do not edit casually.
│   │   ├── content/                    # Typed data. ALL copy and every published number lives here, with sources
│   │   │   ├── site.ts  tools.ts  demo.ts  research.ts  evaluation.ts
│   │   │   └── testimonials.ts  team.ts  timeline.ts  stack.ts  toolPages.ts
│   │   ├── components/                 # Navbar, Footer, Hero, WhatIsIt, ToolCards, ExampleDemo, Surfaces, HowItWorks,
│   │   │   │                           # Feedback, ResearchTeaser, Team, CtaSection, ui.tsx, RatingBar, DiffText
│   │   │   └── research/               # DataSection, ArchitectureDiagram, EngineChallenges, Evidence, Build, ToolDeepDive
│   │   ├── public/
│   │   │   ├── fonts/                  # Gwen WOFF2 font files + UBIN16S legacy Sinhala ttf
│   │   │   └── brand/                  # SinAi logos and graphics
│   │   └── AGENTS.md                   # This master blueprint file
│   │
│   ├── web-app/                        # [WORKSPACE] React 19 + Vite Two-Pane Writing Workspace (chat.sin-ai.app)
│   │   ├── src/
│   │   │   ├── App.jsx                 # Full routing, two-pane editor & auth integration
│   │   │   ├── components/             # Editor, ResultsPane, OutputPanel, HeadlineOutputPanel
│   │   │   ├── admin/                  # Admin overview, users, audit log & research lab
│   │   │   └── index.css               # SinAi brand tokens & font declarations
│   │   └── package.json                # React 19, Tailwind v4, Lucide, Radix UI
│   │
│   ├── backend-api/                    # Internal FastAPI Model Gateway & Security Perimeter
│   │   ├── app/                        # Routers for /grammar, /headlines, /rewrite, /summarize
│   │   ├── schema.sql                  # Supabase Postgres schema with RLS & telemetry triggers
│   │   └── requirements.txt            # FastAPI, Uvicorn, PyTorch, Supabase
│   │
│   ├── chrome-extension/               # Manifest V3 Browser Writing Assistant
│   │   ├── manifest.json               # Context menus, activeTab, and background service worker
│   │   └── background.js               # Background inference caller & content script injector
│   │
│   └── docs-addon/                     # Google Docs Apps Script Integration
│       ├── Code.js                     # Apps Script backend calling SinAi gateway
│       ├── Sidebar.html                # Newsroom sidebar UI inside Google Docs
│       └── .clasp.json                 # Google clasp CLI deployment config
```

---

## 3. Core Research & Model Specifications

Model and dataset facts live in `content/research.ts`, sourced from the paper (`Research/paper.tex`). **Do not copy numbers into this file**; they go stale.

### 3.1 Base model
SinAi adapts **SinLlama**: Llama 3 8B extended with Sinhala vocabulary and continual pretraining (Aravinda et al., MERCon 2025, DOI 10.1109/MERCon67903.2025.11217094). We did not repeat its tokenizer extension or pretraining. The merged checkpoint is loaded in 4-bit NF4 with BF16 compute.

### 3.2 Task adapters
One LoRA adapter per tool: grammar, headline, summary, style. The versions evaluated in the paper are grammar v27, headline v19, summary v06/v07 and style v13. **They are not necessarily what is deployed**: `docs/serve_sinai.py` picks adapters from disk. The site therefore labels results "evaluated adapter" and never claims a version is live.

### 3.3 The five styles
`formal`, `sports`, `youth`, `editorial`, `feature`. Source: `apps/backend-api/app/core/prompts.py`. Earlier versions of this file and of the site listed "Formal, Casual, Sensational, Analytical, Neutral"; that was wrong.

---

## 4. Design System & Responsive Guidelines

The portfolio website adapts the **"Quiet Luxury" and Editorial Minimalism** design language from Google Stitch's **Remix of Lumio SaaS Landing Page**, unified with **SinAi's authentic brand tokens**:

### 4.1 Color Palette
- **Canvas & Backgrounds**:
  - `page-bg`: `#FAF9F5` (Warm editorial eggshell canvas)
  - `panel-bg`: `#F0EFEB` (Soft neutral panel background)
  - `soft-card`: `#E9E8E4` / `#F4F3EF`
  - `white-card`: `#FFFDF8` / `#FFFFFF` (Pristine elevated surface)
- **Obsidians & Darks**:
  - `black`: `#181818` / `#151515` (Deep high-contrast obsidian)
  - `footer-bg`: `#121212` (Obsidian with subtle hairline borders)
- **Brand Crimson Ramp**:
  - Primary Red: `#cd191a` / `#b01e1f` (brand-600 / brand-700)
  - Glow Gradients: `linear-gradient(135deg, #cd191a 0%, #ff4b2b 100%)`
  - Tints: `#fdf3f2`, `#fce5e4`

### 4.2 Typography Hierarchy
- **Display Serif**: **Gwen** (WOFF2) for the SinAi wordmark, heroic headlines, and architectural section titles.
- **Sans-Serif UI & Body**: **Plus Jakarta Sans / Inter** for metadata, button labels, and body text.
- **Sinhala Typography**: **Noto Sans Sinhala** (loaded in `layout.tsx`) with system Sinhala fonts as fallback. Wrap Sinhala text in `<Sinhala>` from `components/ui.tsx` so it gets `lang="si"`.
- **Gwen caveats** (verified in the browser): the trial font's standard `liga` feature draws "fi", "fl" and "ff" as a broken "|" glyph, so `.font-display` turns ligatures off in `globals.css`. Only `.wordmark` (the product name, which contains none of those pairs) keeps them. Gwen's decimal point is a diamond, so **data figures use the sans font** with `tabular-nums`.
- **Legacy Typography**: **UBIN16S** (TTF) for decoding legacy ASCII newsroom print font codepoints.

---

## 5. Live URLs & Access

- **Public Portfolio**: `https://sin-ai.app`
- **Try SinAi (Writing Studio & Playground)**: `https://chat.sin-ai.app`
- **Privacy Policy**: `https://sin-ai.app/privacy`
- **Terms of Service**: `https://sin-ai.app/terms`
- **Support & Setup Guide**: `https://sin-ai.app/support`

---

## 6. How AI Agents Should Continue & Maintain This Project

### Running & Building
1. **Portfolio Development**:
   ```bash
   cd apps/portfolio
   npm run dev
   ```
2. **Production Build Verification**:
   ```bash
   cd apps/portfolio
   npm run build
   ```
3. **Running the Web App Playground**:
   ```bash
   cd apps/web-app
   npm run dev
   ```
4. **Running the Backend API**:
   ```bash
   cd apps/backend-api
   source .venv/bin/activate
   uvicorn app.main:app --reload --port 8001
   ```

---

## 7. Content & Honesty Rules

These exist because the previous version of the site contained invented content. Keep them.

1. **Every number comes from `content/research.ts` or `content/evaluation.ts`, with a `source`.** No source, no number.
2. **No invented testimonials, benchmarks, latency, or adoption claims.** Testimonials are verbatim comments from real respondents (`content/testimonials.ts`), attributed by role and never by name.
3. **Demo examples are illustrative.** They are hand-written and labelled "Illustrative example — not a live result". Have a native Sinhala speaker review the Sinhala text before publishing.
4. **The user evaluation** (13 respondents, 27-31 August 2026) always states its sample size and that it is a small, self-selected pilot. The counts in `content/evaluation.ts` must match the team's spreadsheet.
5. **Google Workspace Marketplace items. Do not change without re-checking verification:**
   - the homepage `<h1>` and `<title>` read exactly "SinAI Document Assistant";
   - the visible "Application purpose and overview" statement (`SITE.purposeRest` in `content/site.ts`);
   - links to `/docs-addon`, `/docs-addon/privacy` and `/docs-addon/terms` on the first screen;
   - the product name and the privacy / terms / support links in the Navbar and Footer, which every legal page shares.
6. **Name SinLlama with credit** wherever the base model is described (see the identity rule at the top).
7. **Team credits** live in `content/team.ts`, with names verbatim as supplied by the team.

### Previewing
`npm run build`, then use the `portfolio-out` preview entry (serves `out/` on port 4174 with plain `serve`, never `serve -s`). The preview tool reads `Research/.claude/launch.json`, the outer directory. Browsers cache the HTML across rebuilds, so hard-reload before judging a change.

### Known stale documentation
Authentication has been self-hosted (bcrypt + signed JWTs; Supabase is only the database) since 2026-08-03, but the root `README.md` and `docs/auth-setup.md` still describe Supabase Auth. Follow the code (`apps/backend-api/app/core/security.py`), not those docs.
