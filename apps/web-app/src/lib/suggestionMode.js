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
 * The Auto / Manual toggle (components/ui/ModeToggle.jsx) is currently hidden,
 * so every session uses DEFAULT_MODE. A preference saved while the toggle was
 * visible is deliberately ignored: honouring it would leave a reader stuck in
 * Auto with no control to leave it. To bring the toggle back, render
 * ModeToggle in EditorToolbar and restore reading the stored preference.
 */

const MODES = new Set(['auto', 'manual']);
export const DEFAULT_MODE = 'manual';

let current = DEFAULT_MODE;
const listeners = new Set();

export function getSuggestionMode() {
  return current;
}

export function setSuggestionMode(mode) {
  if (!MODES.has(mode) || mode === current) return;
  current = mode;
  listeners.forEach((fn) => fn());
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Read the mode reactively. Returns ['auto' | 'manual', setter]. */
export function useSuggestionMode() {
  const mode = useSyncExternalStore(subscribe, getSuggestionMode, () => DEFAULT_MODE);
  return [mode, setSuggestionMode];
}
