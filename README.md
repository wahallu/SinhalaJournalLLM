# SinhalaJournalLLM

**SinhalaJournal-LLM: A Style-Controlled Large Language Model for Diverse Sri Lankan Newspaper Writing** (R26-SE-037)

An AI writing assistant for Sinhala journalism, built on **SinLlama** (Llama-3-8B extended for Sinhala, fine-tuned with per-task LoRA adapters). Four core capabilities:

| Tool | What it does | Model adapter |
|---|---|---|
| Grammar Checker | Fixes grammar, spelling, and punctuation while preserving meaning | `grammar_sinllama_v13` |
| Headline Generator | Writes concise (≤10 word), engaging Sinhala headlines | `headline_sinllama_v13` |
| Style Rewriter | Rewrites articles in 5 newspaper styles: formal, sports, youth, editorial, feature | `style_sinllama_v02` |
| News Summarizer | Abstractive summaries at short / medium / long lengths | `summarization_sinllama_v02` |

## Repository layout

```
apps/
├── backend-api/        FastAPI service — the single API every client talks to
├── web-app/            React 19 + Vite + Tailwind web application
├── chrome-extension/   Manifest V3 extension (popup, inline assistant, context menus)
└── docs-addon/         Google Docs add-on (Apps Script sidebar)
ai/                     Model/adapters storage + training entry points
data-pipeline/          News scrapers (Ada Derana, Hiru, Mawbima, Vikalpa, ITN, Vidusara) + cleaning
infra/                  Local docker-compose + Coolify deployment notes
docs/                   Project documentation
```

Training code, datasets, and the inference server live in the separate **SinAI-Training** repo (`work/sinllama/`).

Authentication, roles, and per-user history are documented in [docs/auth-setup.md](docs/auth-setup.md).

## Architecture

```
web-app ─────┐
chrome ext ──┤                        ┌─→ SinLlama inference server (GPU)
docs addon ──┴─→ backend-api ─→ model │     serve_sinai.py  POST /generate
                     │        gateway ├─→ OpenRouter (hosted fallback)
                     ↓                └─→ mock provider (offline, rule-based)
                 Supabase
              (history storage)
```

- **Model gateway** (`apps/backend-api/app/core/model_gateway.py`): every inference goes through a provider chain — `sinllama → openrouter → mock`. If the GPU box is down the product degrades gracefully instead of failing; each response reports `model_used` so clients can badge the output.
- **Prompts** (`app/core/prompts.py`) replicate the exact Alpaca-style templates the adapters were trained on. Summary length control works by sending the model server a fully-formed prompt with a scaled word target (the server passes through any prompt containing `### Instruction:`). Headline candidate diversity comes from prompt variation hints, since the server decodes greedily.
- **Persistence**: all four tools store results in Supabase (`schema.sql`). A unified activity feed is exposed at `/api/v1/history`.
- **Capabilities discovery**: `/api/v1/meta` reports supported tasks, styles, lengths, and provider status, so client option lists never drift from what the model supports.

### API surface (`/api/v1`)

| Endpoint | Method | Purpose |
|---|---|---|
| `/grammar/check` | POST | `{text}` → corrected text + word-level corrections |
| `/grammar/history`, `/grammar/{id}` | GET | Correction history |
| `/headlines/generate` | POST | `{text, count}` → up to 10 distinct headlines |
| `/headlines/history` | GET | Generation history |
| `/rewrite` | POST | `{text, tone}` → rewrite in a trained style (legacy tones auto-mapped) |
| `/rewrite/history` | GET | Rewrite history |
| `/summarize` | POST | `{text, length}` → short/medium/long summary |
| `/summarize/history` | GET | Summary history |
| `/history` | GET | Unified newest-first activity across all tools |
| `/meta` | GET | Tasks, styles, lengths, provider status |

### Authentication

Requests carry a Supabase JWT as `Authorization: Bearer <token>`. Setup is in [docs/auth-setup.md](docs/auth-setup.md).

| Route group | Auth |
|---|---|
| `/grammar/check`, `/headlines/generate`, `/rewrite`, `/summarize` | optional — anonymous allowed, rate-limited by IP, results not saved |
| `/*/history`, `/history` | required — 401 without a valid token |
| `/meta`, `/health` | none |

Anonymous callers are capped at `ANON_REQUESTS_PER_HOUR` per hashed IP and receive 429 past that. The Chrome extension and Docs add-on use the anonymous path.
| `/health`, `/health/model` | GET | Liveness / model gateway status (root-level, no version prefix) |

## Running locally

### 1. Backend

```bash
cd apps/backend-api
cp .env.example .env        # fill in Supabase creds; MODEL_PROVIDER=mock works offline
python -m venv .venv && .venv/Scripts/activate   # (Windows) or source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Run `schema.sql` once in Supabase Studio's SQL editor.

Tests (fully offline — fake Supabase + mock provider): `python -m pytest tests/ -v`

### 2. Model server (optional, needs GPU)

From the SinAI-Training repo:

```bash
uvicorn work.sinllama.serve_sinai:app --host 0.0.0.0 --port 8001
```

Then in `apps/backend-api/.env`: `MODEL_PROVIDER=sinllama`, `SINLLAMA_API_URL=http://<gpu-host>:8001`.

### 3. Web app

```bash
cd apps/web-app
npm install
npm run dev          # http://localhost:5173, expects API at localhost:8000
```

Set `VITE_API_BASE_URL` in `.env` to point elsewhere.

### 4. Chrome extension

Chrome → `chrome://extensions` → Developer mode → **Load unpacked** → select `apps/chrome-extension/`. Set the API Base URL in the extension's Settings tab (defaults to the deployed backend).

### 5. Google Docs add-on

```bash
cd apps/docs-addon
npm install -g @google/clasp
clasp login
clasp push          # pushes to the Apps Script project in .clasp.json
```

Open a Google Doc → Extensions → SinAI Assistant. The Apps Script proxy (`UrlFetchApp`) calls the backend server-side, so no CORS setup is needed.

## Deployment

Production runs on Coolify — each app under `apps/` deploys as its own resource pointed at that app's folder (see `infra/README.md`). Supabase is self-hosted as a separate Coolify service.
