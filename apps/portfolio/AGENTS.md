<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# SinAi (Sinhala Journal LLM) — Master Project Plan & AI Agent Blueprint

**Last Updated:** August 2026  
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
> - **DO NOT mention or bring in SinLlama**, as SinLlama is a completely separate and unrelated external research project.

---

## 1. Executive Vision & Mission

**SinAi** is a domain-adapted Artificial Intelligence ecosystem specifically engineered for the **Sinhala language** and **journalistic newsroom workflows**, developed under the **Sinhala Journal LLM** research initiative.

### The Problem it Solves
- Generic multilingual LLMs (e.g., base GPT/Claude/Llama) fail severely in morphologically complex low-resource languages like Sinhala. They exhibit high character-level token fragmentation, frequent morphological hallucinations, and failure to respect subtle grammatical rules (e.g., subject-verb honorific/gender harmony and case markers).
- Sri Lankan newsrooms face stringent deadline pressures across print, broadcast, and digital formats while working with a mixture of standard Unicode text and legacy ASCII typography (FM/UBIN font encoding).

### The SinAi Solution
SinAi delivers a fine-tuned foundation model (**Sinhala Journal LLM Base**) paired with specialized **Low-Rank Adaptation (LoRA)** task adapters, served across 3 unified client surfaces:
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
│   ├── portfolio/                      # [THIS APP] Next.js 16 + React 19 Editorial Portfolio (https://sin-ai.app)
│   │   ├── app/
│   │   │   ├── layout.tsx              # SEO metadata (sin-ai.app), typography preconnects & root layout
│   │   │   ├── globals.css             # Tailwind v4 theme tokens, Gwen font faces & glass styles
│   │   │   ├── page.tsx                # Master landing page assembling all 12 sections
│   │   │   ├── privacy/page.tsx        # Google Workspace Marketplace compliant Privacy Policy
│   │   │   ├── terms/page.tsx          # Terms of Service & AI output review disclaimer
│   │   │   └── support/page.tsx        # Support center, Google Docs setup guide & issue reporting
│   │   ├── components/                 # Rich modular portfolio components
│   │   │   ├── Navbar.tsx              # Floating pill TopAppBar with backdrop blur & "Try SinAi" CTA
│   │   │   ├── Hero.tsx                # Architectural headline & live 2-pane workspace preview
│   │   │   ├── TrustStrip.tsx          # Dual-direction ticker of model stats & newsroom adoption
│   │   │   ├── VisualCollage.tsx       # Floating glass cards for syntax, tone, and legacy fonts
│   │   │   ├── Manifesto.tsx           # Celestial geometric vector rings & editorial philosophy
│   │   │   ├── ResearchShowcase.tsx    # Sinhala Journal LLM base model & security architecture
│   │   │   ├── InteractivePlayground.tsx # In-browser live Sinhala AI inference simulator
│   │   │   ├── EcosystemTabs.tsx       # Tabbed showcase of Web App, Extension, and Docs Add-on
│   │   │   ├── Benchmarks.tsx          # ROUGE-L, accuracy comparisons & LoRA adapter changelog
│   │   │   ├── Testimonials.tsx        # Editorial quotes from chief editors & linguists
│   │   │   ├── Updates.tsx             # Research whitepapers & release logs
│   │   │   ├── CtaSection.tsx          # High-impact CTA leading to chat.sin-ai.app and GitHub
│   │   │   └── Footer.tsx              # Obsidian black footer with legal links & attribution
│   │   ├── public/
│   │   │   ├── fonts/                  # Gwen WOFF2 font files + UBIN16S legacy Sinhala ttf
│   │   │   └── brand/                  # SinAi logos, SVGs, and visual graphics
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

### 3.1 Base Foundation Model
- **Model Path**: `SinhalaJournal-Base` / `Sinhala Journal LLM`
- **Architecture**: Domain-adapted foundation model with customized Sinhala Byte-Pair Encoding (BPE) tokenizer to minimize morpheme splitting.
- **Context Length**: Up to 10,000 characters per inference pass.

### 3.2 Specialized LoRA Adapters
| Task | Adapter Identifier | LoRA Rank | Purpose & Dataset Focus |
|---|---|---|---|
| **Grammar Checking** | `grammar_v13` | $r=32$ | Syntactic agreement, Subject-Verb honorific harmony, inflectional correction, legacy spelling fixes. |
| **Headline Generation** | `headline_v17` | $r=32$ | Journalistic click-worthy headlines, breaking news tickers, formal front-page angles, question hooks. |
| **5-Tone Style Rewriter** | `style_v07` | $r=16$ | Register transformation across 5 styles: Formal (සාම්ප්‍රදායික), Casual (සරල), Sensational (ආකර්ෂණීය), Analytical (විශ්ලේෂණාත්මක), Neutral (මධ්‍යස්ථ). |
| **News Summarization** | `summarization_v04` | $r=32$ | Length-conditioned abstractive summaries, multi-document synthesis, and 3-bullet executive briefs. |

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
