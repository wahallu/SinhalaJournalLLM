/**
 * Admin API client.
 *
 * Mirrors services/api.js's bearer-token pattern. Every endpoint here is
 * gated by require_admin server-side — this module carries no authority of
 * its own, so a non-admin calling it simply gets 403.
 */

import { getAccessToken, getApiBase, refreshAccessToken } from '../auth/authClient';

async function request(endpoint, { method = 'GET', body = null } = {}) {
  const send = (token) =>
    fetch(`${getApiBase()}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body !== null ? { body: JSON.stringify(body) } : {}),
    });

  const token = getAccessToken();
  let response = await send(token);

  // Same single transparent refresh as services/api.js — an admin sitting on
  // a dashboard for longer than the access-token lifetime is normal.
  if (response.status === 401 && token) {
    const refreshed = await refreshAccessToken();
    if (refreshed) response = await send(refreshed);
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || err.message || `Request failed (${response.status})`);
  }

  // 204 No Content has no body to parse.
  return response.status === 204 ? null : response.json();
}

// ── Overview ──
export function getOverview() {
  return request('/admin/overview');
}

// ── Users ──
export function listUsers({ page = 1, pageSize = 50, search = '', role = '', status = '' } = {}) {
  const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  if (search) params.set('search', search);
  if (role) params.set('role', role);
  if (status) params.set('status', status);
  return request(`/admin/users?${params}`);
}

export function getUser(userId) {
  return request(`/admin/users/${userId}`);
}

export function getUserHistory(userId, limit = 50) {
  return request(`/admin/users/${userId}/history?limit=${limit}`);
}

export function updateUser(userId, changes) {
  return request(`/admin/users/${userId}`, { method: 'PATCH', body: changes });
}

// ── Categories ──
export function listCategories() {
  return request('/admin/categories');
}

export function createCategory(category) {
  return request('/admin/categories', { method: 'POST', body: category });
}

export function updateCategory(categoryId, category) {
  return request(`/admin/categories/${categoryId}`, { method: 'PATCH', body: category });
}

export function deleteCategory(categoryId) {
  return request(`/admin/categories/${categoryId}`, { method: 'DELETE' });
}

// ── Settings ──
export function getSettings() {
  return request('/admin/settings');
}

export function updateSetting(key, value) {
  return request(`/admin/settings/${key}`, { method: 'PATCH', body: { value } });
}

// ── Analytics & activity ──
export function getAnalytics(days = 30) {
  return request(`/admin/analytics?days=${days}`);
}

export function getAuditLog({ page = 1, pageSize = 50 } = {}) {
  return request(`/admin/activity/audit?page=${page}&page_size=${pageSize}`);
}

export function getTelemetry({ page = 1, pageSize = 50, tool = '' } = {}) {
  const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  if (tool) params.set('tool', tool);
  return request(`/admin/activity/telemetry?${params}`);
}

// Every user's tool runs with content previews and token usage. Sourced from
// the four history tables, not telemetry — telemetry has the token columns
// but none of the text.
export function getChats({ limit = 100 } = {}) {
  return request(`/admin/activity/chats?limit=${limit}`);
}

export function getChatRun(tool, id) {
  return request(`/admin/activity/chats/${encodeURIComponent(tool)}/${encodeURIComponent(id)}`);
}

// ── Adapters ──
// The model server owns this list; /comparison/adapters is already
// admin-only, so the Settings page reuses it rather than adding an endpoint.
// Returns { adapters: { grammar: [...], headline: [...], ... } }.
export function getAdapters() {
  return request('/comparison/adapters');
}
