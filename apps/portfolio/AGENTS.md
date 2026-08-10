<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# SinAi (SinhalaJournalLLM) — Master Project Plan & AI Agent Blueprint

**Last Updated:** August 2026  
**Project Ecosystem:** SinAi (Sinhala AI Newsroom & Writing Intelligence Platform)  
**Primary Repository:** `d:\SinhalaLLM\SinhalaJournalLLM`  
**Current Module:** `apps/portfolio` (Modern Portfolio & Ecosystem Landing Page)  
**Live Playground Surface:** `apps/web-app` (Two-Pane Editorial Workspace & Admin Research Suite)  

---

## 1. Executive Vision & Mission

**SinAi** is a domain-adapted Artificial Intelligence ecosystem specifically engineered for the **Sinhala language** and **journalistic newsroom workflows**.

### The Problem it Solves
- Generic multilingual LLMs (e.g., base GPT/Claude/Llama) fail severely in morphologically complex low-resource languages like Sinhala. They exhibit high character-level token fragmentation, frequent morphological hallucinations, and failure to respect subtle grammatical rules (e.g., subject-verb honorific/gender harmony and case markers).
- Sri Lankan newsrooms face stringent deadline pressures across print, broadcast, and digital formats while working with a mixture of standard Unicode text and legacy ASCII typography (FM/UBIN font encoding).

### The SinAi Solution
SinAi delivers a fine-tuned foundation model (**SinLLaMA**) paired with specialized **Low-Rank Adaptation (LoRA)** task adapters, served across 3 unified client surfaces:
1. **SinAi Web App** (`apps/web-app`): The primary live interactive Playground and workspace.
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
│   ├── portfolio/                      # [THIS APP] Next.js 16 + React 19 Editorial Portfolio Website
│   │   ├── app/
│   │   │   ├── layout.tsx              # SEO metadata, typography preconnects & root layout
│   │   │   ├── globals.css             # Tailwind v4 theme tokens, Gwen font faces & glass styles
│   │   │   └── page.tsx                # Master landing page assembling all sections
│   │   ├── components/                 # Rich modular portfolio components
│   │   │   ├── Navbar.tsx              # Floating pill TopAppBar with backdrop blur & Playground CTA
│   │   │   ├── Hero.tsx                # Architectural headline & live 2-pane workspace preview
│   │   │   ├── TrustStrip.tsx          # Dual-direction ticker of model stats & newsroom adoption
│   │   │   ├── VisualCollage.tsx       # Floating glass cards for syntax, tone, and legacy fonts
│   │   │   ├── Manifesto.tsx           # Celestial geometric vector rings & editorial philosophy
│   │   │   ├── ResearchShowcase.tsx    # SinLLaMA base model & enterprise security architecture
│   │   │   ├── InteractivePlayground.tsx # In-browser live Sinhala AI inference simulator
│   │   │   ├── EcosystemTabs.tsx       # Tabbed showcase of Web App, Extension, and Docs Add-on
│   │   │   ├── Benchmarks.tsx          # ROUGE-L, accuracy comparisons & LoRA adapter changelog
│   │   │   ├── Testimonials.tsx        # Editorial quotes from chief editors & linguists
│   │   │   ├── Updates.tsx             # Research whitepapers & release logs
│   │   │   ├── CtaSection.tsx          # Mega call to action leading to playground and GitHub
│   │   │   └── Footer.tsx              # Obsidian black footer with structured links & attribution
│   │   ├── public/
│   │   │   ├── fonts/                  # Gwen WOFF2 font files + UBIN16S legacy Sinhala ttf
│   │   │   └── brand/                  # SinAi logos, SVGs, and visual graphics
│   │   └── AGENTS.md                   # This master blueprint file
│   │
│   ├── web-app/                        # [PLAYGROUND] React 19 + Vite Two-Pane Writing Workspace
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

### 3.1 Base Foundation Model
- **Model Path**: `SinLLaMA-merged-base`
- **Architecture**: Domain-adapted LLaMA with customized Sinhala Byte-Pair Encoding (BPE) tokenizer to minimize morpheme splitting.
- **Context Length**: Up to 10,000 characters per inference pass.

### 3.2 Specialized LoRA Adapters
| Task | Adapter Identifier | LoRA Rank | Purpose & Dataset Focus |
|---|---|---|---|
| **Grammar Checking** | `grammar_sinllama_v13` | $r=32$ | Syntactic agreement, Subject-Verb honorific harmony, inflectional correction, legacy spelling fixes. |
| **Headline Generation** | `headline_sinllama_v17` | $r=32$ | Journalistic click-worthy headlines, breaking news tickers, formal front-page angles, question hooks. |
| **5-Tone Style Rewriter** | `style_sinllama_v07` | $r=16$ | Register transformation across 5 styles: Formal (සාම්ප්‍රදායික), Casual (සරල), Sensational (ආකර්ෂණීය), Analytical (විශ්ලේෂණාත්මක), Neutral (මධ්‍යස්ථ). |
| **News Summarization** | `summarization_sinllama_v04` | $r=32$ | Length-conditioned abstractive summaries, multi-document synthesis, and 3-bullet executive briefs. |

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
- **Sinhala Typography**: **Noto Sans Sinhala / Inter Variable** for authentic Unicode Sinhala rendering.
- **Legacy Typography**: **UBIN16S** (TTF) for decoding legacy ASCII newsroom print font codepoints.

### 4.3 Mobile Responsiveness Directives
- **Fluid Font Sizing**: Use responsive steps across all viewports (mobile 320px-375px: `text-2xl` to `text-3xl`, tablet: `text-4xl` to `text-5xl`, desktop: `text-6xl` to `text-[84px]`).
- **Dynamic Button Scaling**: Use `px-4 py-2.5 text-xs` on mobile scaling to `px-8 py-4 text-sm` on desktop.
- **Touch Targets**: Minimum 44px height for interactive tap targets.
- **Flex & Grid Wrapping**: Always prevent horizontal overflows by setting `max-w-full`, `overflow-x-auto` on chip containers, and single-column collapse on `< lg` screens.

---

## 5. Playground Integration Strategy

`apps/web-app` serves as the primary **Interactive Playground Application**:
1. **Local Development**: Runs at `http://localhost:5173` via Vite.
2. **Portfolio Links**: All "Launch Playground" and "Full Workspace" CTAs across the portfolio link directly to `http://localhost:5173` (or production origin).
3. **In-Page Interactive Simulator**: `InteractivePlayground.tsx` provides an embedded instant demo on the portfolio itself, allowing users to test Sinhala inputs without logging in, then transitioning seamlessly into the full web app.

---

## 6. Current Implementation Progress & Milestone Log

### Milestone 1: Architecture & Design System Setup (COMPLETED)
- Analyzed all project modules (`docs`, `apps/web-app`, `apps/backend-api`, `apps/chrome-extension`, `apps/docs-addon`).
- Integrated Google Stitch Lumio SaaS design language into Next.js 16 + React 19 + Tailwind v4.
- Copied Gwen WOFF2 display fonts and SinAi SVG/PNG brand assets into `apps/portfolio/public/`.

### Milestone 2: Complete Portfolio Component Suite (COMPLETED)
- Built 12 modular components:
  1. `Navbar.tsx` (Floating pill with backdrop blur & Playground CTA)
  2. `Hero.tsx` (Architectural headline & live 2-pane workspace preview)
  3. `TrustStrip.tsx` (Dual marquee stats & newsroom adoption ticker)
  4. `VisualCollage.tsx` (Floating cards for grammar, style, and legacy fonts)
  5. `Manifesto.tsx` (Celestial geometric orbit vector artwork)
  6. `ResearchShowcase.tsx` (SinLLaMA base model & security deep dive)
  7. `InteractivePlayground.tsx` (In-browser live Sinhala AI inference simulator)
  8. `EcosystemTabs.tsx` (Tabbed showcase of Web App, Extension, and Docs Add-on)
  9. `Benchmarks.tsx` (ROUGE-L, accuracy comparisons & LoRA adapter changelog)
  10. `Testimonials.tsx` (Editorial quotes from chief editors & linguists)
  11. `Updates.tsx` (Research whitepapers & release logs)
  12. `CtaSection.tsx` & `Footer.tsx` (Mega CTA & obsidian black footer)

### Milestone 3: Client Scope Hardening (COMPLETED)
- Removed all public mentions of `backend-api` from client lists across the portfolio.
- Framed client applications strictly around the 3 user-facing interfaces: Web App Workspace, Chrome Extension, and Google Docs Add-on.

### Milestone 4: Cross-Device Mobile Responsiveness (COMPLETED)
- Implemented fluid typography (`text-2xl` to `text-[84px]`), dynamic button padding, touch-friendly tap targets, and wrapping chip selectors.
- Tested and verified on 390px (iPhone 14/15) and 375px viewports with zero horizontal overflow.
- Cleanly verified via `npm run build` with zero TypeScript or style errors.

---

## 7. How AI Agents Should Continue & Maintain This Project

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

### Code Modification Guidelines
- **Preserve Design Integrity**: Do not revert to generic bright primaries. Always utilize `--color-page-bg (#FAF9F5)`, `--color-crimson (#cd191a)`, and Gwen serif display typography for headlines.
- **Maintain Monorepo Boundaries**: Keep shared assets in `public/fonts` and `public/brand`. Ensure relative links between applications remain accurate.
- **Keep AGENTS.md Updated**: Any major new LoRA adapter release (e.g., `grammar_v14` or new task) or architectural change must be appended to this document.
