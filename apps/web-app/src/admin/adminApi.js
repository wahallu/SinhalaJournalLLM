/**
 * Admin API client.
 *
 * Mirrors services/api.js's bearer-token pattern. Every endpoint here is
 * gated by require_admin server-side — this module carries no authority of
 * its own, so a non-admin calling it simply gets 403.
 */

import supabase from '../auth/supabaseClient';
import { DEFAULT_API_BASE } from '../services/api';

function getApiBase() {
  try {
    const settings = JSON.parse(localStorage.getItem('sinai_settings') || '{}');
    const url = (settings.apiBaseUrl || '').trim();
    return url ? url.replace(/\/+$/, '') : DEFAULT_API_BASE;
  } catch {
    return DEFAULT_API_BASE;
  }
}

async function request(endpoint, { method = 'GET', body = null } = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const response = await fetch(`${getApiBase()}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== null ? { body: JSON.stringify(body) } : {}),
  });

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
