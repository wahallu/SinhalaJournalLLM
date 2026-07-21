/** Local history storage — entries live in this browser's localStorage. */

const STORAGE_KEY = 'sinai_history';

export function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

/* Pull a short, human-readable result snippet out of any tool response */
function extractResultPreview(result) {
  if (!result || typeof result !== 'object') return null;
  const text = result.corrected ?? result.rewritten ?? result.summary ?? result.best_headline ?? null;
  return typeof text === 'string' ? text.slice(0, 280) : null;
}

export function saveToHistory(tool, input, result) {
  const history = getHistory();
  history.unshift({
    id: Date.now(),
    tool,
    input: input.slice(0, 240),
    result: extractResultPreview(result),
    timestamp: new Date().toISOString(),
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, 50)));
}

export function clearHistory() {
  localStorage.removeItem(STORAGE_KEY);
}
