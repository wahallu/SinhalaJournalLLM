/**
 * Frontend API service — all backend calls go through this module.
 * Base URL defaults to the local FastAPI server on port 8000.
 */

import {
  DEFAULT_API_BASE, getAccessToken, getApiBase, refreshAccessToken,
} from '../auth/authClient';
import { researchHeaders } from '../lib/research';

export { DEFAULT_API_BASE };

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * One API call, retried once behind a token refresh.
 *
 * The access token is deliberately short-lived, so meeting an expired one
 * mid-session is routine rather than exceptional — a single transparent
 * refresh keeps that invisible to callers. Signed-out callers send no
 * Authorization header at all: the four writing tools accept anonymous
 * requests, so a 401 here is a real failure, not a missing session.
 */
async function request(endpoint, body = null, method = 'POST') {
  const send = (token) => {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...researchHeaders(),
        ...authHeaders(token),
      },
    };
    if (body !== null && method !== 'GET') {
      options.body = JSON.stringify(body);
    }
    return fetch(`${getApiBase()}${endpoint}`, options);
  };

  const token = getAccessToken();
  let res = await send(token);

  if (res.status === 401 && token) {
    const refreshed = await refreshAccessToken();
    if (refreshed) res = await send(refreshed);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.message || `Request failed (${res.status})`);
  }

  return res.json();
}

/** Authenticated multipart request. The browser owns the Content-Type
 * boundary; setting it manually would produce an invalid upload. */
async function multipartRequest(endpoint, formData) {
  const send = (token) => fetch(`${getApiBase()}${endpoint}`, {
    method: 'POST',
    headers: {
      ...researchHeaders(),
      ...authHeaders(token),
    },
    body: formData,
  });

  const token = getAccessToken();
  let res = await send(token);
  if (res.status === 401 && token) {
    const refreshed = await refreshAccessToken();
    if (refreshed) res = await send(refreshed);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.message || `Request failed (${res.status})`);
  }
  return res.json();
}

/**
 * One API call whose body is a stream of NDJSON objects.
 *
 * Same auth and refresh behaviour as `request`, but the response is consumed
 * line by line and handed to `onEvent` as each one arrives, rather than
 * buffered and parsed at the end. Resolves once the stream closes.
 *
 * Written against fetch + a ReadableStream reader rather than EventSource:
 * EventSource is GET-only and cannot carry the article in a request body.
 */
async function streamRequest(endpoint, body, onEvent, { signal } = {}) {
  const send = (token) =>
    fetch(`${getApiBase()}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...researchHeaders(),
        ...authHeaders(token),
      },
      body: JSON.stringify(body),
      signal,
    });

  const token = getAccessToken();
  let res = await send(token);

  if (res.status === 401 && token) {
    const refreshed = await refreshAccessToken();
    if (refreshed) res = await send(refreshed);
  }

  // Errors are still ordinary JSON — the server does every check that can
  // produce a status code before it starts writing the stream.
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.message || `Request failed (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  // A chunk boundary can land mid-line and even mid-UTF-8-sequence, which
  // matters more here than usual: Sinhala is three bytes per character, so a
  // naive decode would corrupt text rather than merely split it. `stream:
  // true` holds partial sequences back, and the tail of `buffer` holds the
  // partial line.
  const drain = (flush = false) => {
    const lines = buffer.split('\n');
    buffer = flush ? '' : lines.pop();
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) onEvent(JSON.parse(trimmed));
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      drain();
    }
    buffer += decoder.decode();
    drain(true);
  } finally {
    reader.releaseLock();
  }
}

// ── Grammar ──
export function checkGrammar(text) {
  return request('/grammar/check', { text });
}

export function getGrammarHistory(page = 1, pageSize = 20) {
  return request(`/grammar/history?page=${page}&page_size=${pageSize}`, null, 'GET');
}

// ── Headlines ──
// Backend accepts { text, count, category, length, adapter }; `style` is
// still unsupported server-side, so it's accepted here but not sent.
// The response is transformed into the richer shape HeadlineOutputPanel expects.

// Word bands per length option. Only a fallback for labelling before a
// response arrives — the band a result was actually held to comes back on
// the response as `length`, and that's what the badges are scored against.
export const HEADLINE_LENGTH_BANDS = {
  short: { min_words: 3, max_words: 5 },
  medium: { min_words: 6, max_words: 7 },
  long: { min_words: 8, max_words: 10 },
};

export async function generateHeadlines(text, options = {}) {
  const {
    count = 5,
    numCandidates,
    category = 'General',
    length = 'medium',
    adapter,
  } = typeof options === 'object' && !Array.isArray(options) ? options : { count: options };

  const raw = await request('/headlines/generate', {
    text,
    count: numCandidates ?? count,
    category,
    length,
    adapter: adapter || undefined,
  });

  return hydrateHeadlineOutput(raw, length);
}

/** Rebuild the presentation-only headline fields for API and history data. */
export function hydrateHeadlineOutput(raw, fallbackLength = 'medium') {
  const lengthId = raw?.length?.id || (typeof raw?.length === 'string' ? raw.length : fallbackLength);
  const band = raw?.length?.min_words
    ? raw.length
    : (HEADLINE_LENGTH_BANDS[lengthId] || HEADLINE_LENGTH_BANDS.medium);

  // Only two derived values, both computed from text the backend actually
  // returned: the word count and whether it landed in the requested band.
  // Everything else this function used to synthesize — validation flags,
  // ROUGE/BLEU/semantic scores, entities, themes, a pipeline log — was
  // invented client-side and rendered as if the model had produced it.
  const headlines = raw.headlines || [];
  const candidates = headlines.map((headline, i) => {
    const words = headline.trim().split(/\s+/).length;
    return {
      headline,
      rank: i + 1,
      word_count: words,
      length_ok: words >= band.min_words && words <= band.max_words,
    };
  });

  return {
    ...raw,
    best_headline: headlines[0] || null,
    candidates,
  };
}

export function getHeadlineHistory(page = 1, pageSize = 20) {
  return request(`/headlines/history?page=${page}&page_size=${pageSize}`, null, 'GET');
}

export function generateVisualPrompt(articleText, headline = '') {
  return request('/headlines/visual-prompt', { article_text: articleText, headline });
}

export function generateAndSaveVisualPrompt(articleText, headline = '', historyId = null) {
  return request('/headlines/visual-prompt', {
    article_text: articleText,
    headline,
    history_id: historyId,
  });
}

export function saveHeadlineVisualPrompt(historyId, visualPrompt) {
  if (!historyId) return Promise.resolve(null);
  return request(`/headlines/${historyId}/assets`, { visual_prompt: visualPrompt }, 'PATCH');
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

// ── Optimize Article ──
/**
 * Run the full pipeline over one article, streaming each stage as it lands.
 *
 * `onEvent` receives every NDJSON line: the opening `pipeline` plan, a
 * running/done/skipped/failed event per stage, and the closing `pipeline`
 * event whose `data` is the assembled result.
 *
 * Grammar and headlines always run server-side; `restyle` and `summarize`
 * are the two opt-in stages.
 */
export function optimizeArticle(text, options = {}, onEvent, { signal } = {}) {
  const {
    restyle = false,
    tone = 'formal',
    summarize = false,
    length = 'medium',
    headlineCount = 3,
    headlineCategory = 'General',
    headlineLength = 'medium',
  } = options;

  return streamRequest(
    '/optimize',
    {
      text,
      restyle,
      tone,
      summarize,
      length,
      headline_count: headlineCount,
      headline_category: headlineCategory,
      headline_length: headlineLength,
    },
    onEvent,
    { signal }
  );
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

export function runComparison(inputOrPayload, adapters, task = 'grammar', style = null, referenceText = null) {
  let payload = inputOrPayload;
  if (typeof inputOrPayload === 'string') {
    payload = {
      input_text: inputOrPayload,
      adapters: adapters || [],
      task: task || 'grammar',
      style: style || null,
      reference_text: referenceText || null,
    };
  }
  return request('/comparison/compare', payload);
}

// ── Categories ──
// Active categories only — what a user may pick from on their profile.
export function getCategories() {
  return request('/categories', null, 'GET');
}

// Set the signed-in user's own category. This used to be written straight
// to Supabase from the browser under RLS; with auth self-hosted the browser
// has no database access and the backend scopes the update instead.
export function setMyCategory(categoryId) {
  return request('/categories/me', { category_id: categoryId || null }, 'PUT');
}

// Persist first-login newsroom personalisation as one atomic profile update.
export function saveOnboarding(profile) {
  return request('/auth/onboarding', profile, 'PUT');
}

// ── Unified history ──
// Server-side and scoped to the signed-in user; returns 401 when signed out.
// Response: { items: [{ id, tool, input_preview, output_preview, detail, created_at }] }
export function getUnifiedHistory(limit = 50) {
  return request(`/history?limit=${limit}`, null, 'GET');
}

export function getHistoryRun(tool, id) {
  return request(`/history/${encodeURIComponent(tool)}/${encodeURIComponent(id)}`, null, 'GET');
}

/**
 * Report which proposed changes the journalist took.
 *
 * The study's most valuable signal: input/output says what the model did, not
 * whether it was right, and an accept/reject click is ground truth for free.
 *
 * Deliberately swallows every error and never returns a rejected promise. This
 * is research telemetry riding along behind someone's actual work — a failed
 * analytics write must be invisible, not a console full of red or a retry
 * storm while they are mid-article.
 */
export function recordSuggestionEvents(events) {
  if (!events?.length) return Promise.resolve(null);
  return request('/events/suggestions', { events }).catch(() => null);
}

// Exact run counts for the dashboard tiles. Deliberately not derived from
// getUnifiedHistory: that returns at most `limit` rows, so counting it capped
// every figure at the page size — a user with 300 runs read "50".
// Response: { total, today, week, per_tool: {tool: n}, top_tool }
export function getHistoryStats() {
  return request('/history/stats', null, 'GET');
}

// ── Image Generation (OpenAI GPT Image 2) ──
// The authenticated backend proxy keeps OPENAI_API_KEY out of the browser and
// returns a base64 PNG data URL.
export function generateImage(prompt, historyId = null, referenceImage = null) {
  if (!referenceImage) {
    return request('/image/generate', { prompt, history_id: historyId });
  }

  const formData = new FormData();
  formData.append('prompt', prompt);
  if (historyId) formData.append('history_id', historyId);
  formData.append('image', referenceImage);
  return multipartRequest('/image/generate', formData);
}

// ── Capabilities ──
// Tasks, styles, lengths, provider status, feature flags and global defaults.
export function getMeta() {
  return request('/meta', null, 'GET');
}
