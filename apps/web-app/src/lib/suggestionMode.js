import { useSyncExternalStore } from 'react';

/**
 * Auto vs Manual: whether suggestions are applied for the reader or offered
 * to them.
 *
 *   auto    every suggestion is applied as soon as the result arrives —
 *           spellings, sentence-final forms, the lot. Each one can still be
 *           undone individually, so this is a starting position rather than a
 *           decision taken away.
 *   manual  nothing is applied. Suggestions are marked in the text and listed
 *           for review, and the reader applies the ones they agree with.
 *
 * Manual is the default. Suggestions come from corpus frequency, which is
 * evidence rather than proof, and the same layer that catches දුෂණ also has
 * opinions about names — silently rewriting a journalist's copy on that basis
 * is not a defensible default. Auto exists because for routine copy the
 * suggestions are usually right and clicking each one is friction.
 *
 * A module-level store rather than context: the toggle lives in the editor
 * toolbar and the setting is read in the results pane, two subtrees with no
 * useful common ancestor. Persisted, because it is a working preference and
 * having to set it on every visit would be its own annoyance.
 */

const KEY = 'sinai_suggestion_mode';
const MODES = new Set(['auto', 'manual']);

let current = read();
const listeners = new Set();

function read() {
  try {
    const stored = localStorage.getItem(KEY);
    return MODES.has(stored) ? stored : 'manual';
  } catch {
    // Private mode, or storage disabled. Not worth failing over.
    return 'manual';
  }
}

export function getSuggestionMode() {
  return current;
}

export function setSuggestionMode(mode) {
  if (!MODES.has(mode) || mode === current) return;
  current = mode;
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    // Preference is still honoured for this session.
  }
  listeners.forEach((fn) => fn());
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Read the mode reactively. Returns ['auto' | 'manual', setter]. */
export function useSuggestionMode() {
  const mode = useSyncExternalStore(subscribe, getSuggestionMode, () => 'manual');
  return [mode, setSuggestionMode];
}
