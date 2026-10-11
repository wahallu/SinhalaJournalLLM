/**
 * Link rules for portfolio documents. These mirror the backend validator
 * (apps/backend-api/app/schemas/portfolio_document.py), so the form can
 * explain a problem before the request is sent. The backend stays the
 * authority.
 */

export const MAX_LINK_LENGTH = 500;

/**
 * Empty input is valid and means "no link yet" (the item shows as Pending).
 *
 * @param {unknown} raw
 * @returns {{ value: string | null, error: string | null }}
 */
export function parseDocumentLink(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return { value: null, error: null };

  if (text.length > MAX_LINK_LENGTH) {
    return { value: null, error: `The link must be at most ${MAX_LINK_LENGTH} characters.` };
  }
  if (/\s/.test(text)) {
    return { value: null, error: 'The link must not contain spaces.' };
  }
  // A regex first: `new URL('https:example.com')` is accepted leniently.
  if (!/^https:\/\//i.test(text)) {
    return { value: null, error: 'The link must be a full https:// address.' };
  }
  try {
    const url = new URL(text);
    if (!url.hostname) throw new Error('no host');
  } catch {
    return { value: null, error: 'The link must be a full https:// address.' };
  }
  return { value: text, error: null };
}

/**
 * Host shown in the admin table, or null when there is no valid link.
 *
 * @param {unknown} raw
 * @returns {string | null}
 */
export function linkHost(raw) {
  const { value } = parseDocumentLink(raw);
  if (!value) return null;
  return new URL(value).hostname.replace(/^www\./, '');
}
