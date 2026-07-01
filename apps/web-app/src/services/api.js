/**
 * Frontend API service.
 * All backend calls go through this module.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

async function request(endpoint, body, method = 'POST') {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE}${endpoint}`, options);

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.message || `Request failed (${res.status})`);
  }

  return res.json();
}

export function checkGrammar(text) {
  return request('/grammar/check', { text });
}

export function getGrammarHistory(page = 1, pageSize = 20) {
  return request(`/grammar/history?page=${page}&page_size=${pageSize}`, null, 'GET');
}

export function generateHeadlines(text, count = 5) {
  return request('/headlines/generate', { text, count });
}

export function rewriteStyle(text, tone) {
  return request('/rewrite', { text, tone });
}

export function summarizeNews(text, length) {
  return request('/summarize', { text, length });
}
