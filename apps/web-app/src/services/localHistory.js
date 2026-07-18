/**
 * Local (browser-only) activity history.
 *
 * The source of truth is the backend's unified /api/v1/history feed; this
 * localStorage copy is the offline fallback shown when the API is
 * unreachable, and doubles as a privacy-friendly record on shared machines.
 */

const STORAGE_KEY = 'sinai_history';
const MAX_ENTRIES = 50;

export function getLocalHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveToHistory(tool, input, result) {
  const history = getLocalHistory();
  let output = '';
  if (result) {
    output = result.corrected || result.rewritten || result.summary
      || (Array.isArray(result.headlines) ? result.headlines.join(' | ') : '');
  }
  history.unshift({
    id: Date.now(),
    tool,
    input: input.slice(0, 200),
    output: String(output).slice(0, 200),
    timestamp: new Date().toISOString(),
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, MAX_ENTRIES)));
}

export function clearHistory() {
  localStorage.removeItem(STORAGE_KEY);
}
