/**
 * Frontend API service — all backend calls go through this module.
 * Base URL defaults to the local FastAPI server on port 8000.
 */

export const DEFAULT_API_BASE = 'https://sinhalajournalllm.onrender.com/api/v1';

// A custom base URL can be set on the Settings page; falls back to the default.
function getApiBase() {
  try {
    const settings = JSON.parse(localStorage.getItem('sinai_settings') || '{}');
    const url = (settings.apiBaseUrl || '').trim();
    return url ? url.replace(/\/+$/, '') : DEFAULT_API_BASE;
  } catch {
    return DEFAULT_API_BASE;
  }
}

async function request(endpoint, body = null, method = 'POST') {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };

  if (body !== null && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(`${getApiBase()}${endpoint}`, options);

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.message || `Request failed (${res.status})`);
  }

  return res.json();
}

// ── Grammar ──
export function checkGrammar(text) {
  return request('/grammar/check', { text });
}

export function getGrammarHistory(page = 1, pageSize = 20) {
  return request(`/grammar/history?page=${page}&page_size=${pageSize}`, null, 'GET');
}

// ── Headlines ──
// Backend only accepts { text, count } — style/maxLength aren't supported
// server-side yet, so they're accepted here but not sent.
// The response is transformed into the richer shape HeadlineOutputPanel expects.
export async function generateHeadlines(text, options = {}) {
  const {
    count = 5,
    numCandidates,
  } = typeof options === 'object' && !Array.isArray(options) ? options : { count: options };

  const raw = await request('/headlines/generate', {
    text,
    count: numCandidates ?? count,
  });

  // Transform flat { headlines: string[] } → rich output shape for HeadlineOutputPanel
  const headlines = raw.headlines || [];
  const candidates = headlines.map((headline, i) => ({
    headline,
    rank: i + 1,
    passed_validation: true,
    metrics: {
      rouge_1: 0,
      rouge_2: 0,
      rouge_l: 0,
      bleu: 0,
      semantic_similarity: 0,
      entity_coverage: 0,
      grammar_pass: true,
      length_ok: headline.split(/\s+/).length <= 10,
    },
  }));

  return {
    ...raw,
    best_headline: headlines[0] || null,
    candidates,
    source_entities: [],
    semantic_extraction: {},
    pipeline_log: [],
    regeneration_count: 0,
  };
}

export function getHeadlineHistory(page = 1, pageSize = 20) {
  return request(`/headlines/history?page=${page}&page_size=${pageSize}`, null, 'GET');
}

export function generateVisualPrompt(articleText, headline = '') {
  return request('/headlines/visual-prompt', { article_text: articleText, headline });
}

// ── Style Rewriter ──
export function rewriteStyle(text, tone = 'formal') {
  return request('/rewrite', { text, tone });
}

export function getStyleHistory(page = 1, pageSize = 20) {
  return request(`/rewrite/history?page=${page}&page_size=${pageSize}`, null, 'GET');
}

// ── Summarizer ──
export function summarizeNews(text, length = 'medium') {
  return request('/summarize', { text, length });
}

export function getSummarizeHistory(page = 1, pageSize = 20) {
  return request(`/summarize/history?page=${page}&page_size=${pageSize}`, null, 'GET');
}

// ── SinLLaMA Playground ──
// Base model only (no task adapter) — proxied through the backend so the
// inference server's address is never sent to the browser.
export function chatSinLlama(prompt) {
  return request('/sinllama/chat', { prompt });
}

export function getSinLlamaHealth() {
  return request('/sinllama/health', null, 'GET');
}

// ── Model Comparison ──
export function getComparisonAdapters() {
  return request('/comparison/adapters', null, 'GET');
}

export function runComparison(payload) {
  return request('/comparison/compare', payload);
}

// ── Image Generation (Cloudflare Workers AI — Flux 2 Dev) ──
// The backend proxies to Cloudflare and returns a base64 PNG data URL.
// flux-2-dev uses multipart/form-data and requires more steps (default 24)
// for high prompt-adherence versus the faster flux-1-schnell (was 8 steps).
export function generateImage(prompt, steps = 24, width = 1024, height = 1024) {
  return request('/image/generate', { prompt, steps, width, height });
}
