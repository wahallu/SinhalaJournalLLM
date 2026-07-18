/**
 * Frontend API service — all backend calls go through this module.
 * Base URL defaults to the local FastAPI server on port 8000.
 */

const API_BASE = 'https://sinai.onrender.com/api/v1';

async function request(endpoint, body = null, method = 'POST') {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };

  if (body !== null && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE}${endpoint}`, options);

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
export function generateHeadlines(text, options = {}) {
  const {
    count = 5,
    numCandidates,
  } = typeof options === 'object' && !Array.isArray(options) ? options : { count: options };

  return request('/headlines/generate', {
    text,
    count: numCandidates ?? count,
  });
}

export function getHeadlineHistory(page = 1, pageSize = 20) {
  return request(`/headlines/history?page=${page}&page_size=${pageSize}`, null, 'GET');
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
