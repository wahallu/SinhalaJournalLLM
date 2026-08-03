/**
 * Token store and auth API client. Replaced supabaseClient.js.
 *
 * Tokens live in localStorage. That is the pragmatic choice for a SPA
 * talking to a separate API origin — and it is readable by any XSS on the
 * page, which httpOnly cookies would not be. Cookies were not chosen
 * because they need CORS credentials plus CSRF protection on every mutating
 * route; the access token is kept short-lived (30 minutes server-side) so
 * the window on a leak stays small.
 *
 * Everything here talks to this project's own /api/v1/auth endpoints.
 */

const ACCESS_KEY = 'sinai_access_token';
const REFRESH_KEY = 'sinai_refresh_token';

export const DEFAULT_API_BASE = 'https://sinhalajournalllm.onrender.com/api/v1';

/** A custom base URL can still be set in localStorage for local development. */
export function getApiBase() {
  try {
    const settings = JSON.parse(localStorage.getItem('sinai_settings') || '{}');
    const url = (settings.apiBaseUrl || '').trim();
    return url ? url.replace(/\/+$/, '') : DEFAULT_API_BASE;
  } catch {
    return DEFAULT_API_BASE;
  }
}

// ── Token store ──

export function getAccessToken() {
  try {
    return localStorage.getItem(ACCESS_KEY);
  } catch {
    return null;
  }
}

export function getRefreshToken() {
  try {
    return localStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

export function storeTokens({ access_token, refresh_token }) {
  if (access_token) localStorage.setItem(ACCESS_KEY, access_token);
  if (refresh_token) localStorage.setItem(REFRESH_KEY, refresh_token);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

// ── Requests ──

async function post(path, body) {
  const response = await fetch(`${getApiBase()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || data.message || `Request failed (${response.status})`);
  }
  return data;
}

export const signup = (email, password, fullName) =>
  post('/auth/signup', { email, password, full_name: fullName || null });

export const login = (email, password) => post('/auth/login', { email, password });

export const requestPasswordReset = (email) => post('/auth/forgot-password', { email });

export const resetPassword = (token, password) =>
  post('/auth/reset-password', { token, password });

export const verifyEmail = (token) => post('/auth/verify-email', { token });

/**
 * Exchange the refresh token for a new access token.
 *
 * Returns null rather than throwing when there is nothing to refresh or the
 * refresh token has expired — callers treat that as "signed out", which is
 * what it means.
 */
export async function refreshAccessToken() {
  const refresh_token = getRefreshToken();
  if (!refresh_token) return null;
  try {
    const data = await post('/auth/refresh', { refresh_token });
    storeTokens({ access_token: data.access_token });
    return data.access_token;
  } catch {
    clearTokens();
    return null;
  }
}

/** The signed-in account, or null when the stored token is absent/expired. */
export async function fetchMe() {
  const token = getAccessToken();
  if (!token) return null;

  const request = (bearer) =>
    fetch(`${getApiBase()}/auth/me`, {
      headers: { Authorization: `Bearer ${bearer}` },
    });

  let response = await request(token);

  // One retry behind a refresh: the access token is deliberately short-lived,
  // so an expired one on page load is the normal case, not an error.
  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) return null;
    response = await request(refreshed);
  }

  if (!response.ok) return null;
  return response.json();
}
