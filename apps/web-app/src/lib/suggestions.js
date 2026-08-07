import { useCallback, useMemo, useState } from 'react';

/** Shared empty set: a stable identity keeps effects and memos from re-running. */
const EMPTY = new Set();

/**
 * Applying dictionary suggestions to corrected text.
 *
 * Suggestions arrive with a `position` — a character offset into the text the
 * server checked. Accepting one can change the text's length (නෑ → නැහැ is two
 * characters longer), which moves every later suggestion. Rather than patching
 * offsets after each edit and hoping they stay in sync, everything here is
 * derived from the untouched server text in a single pass: the accepted set is
 * the only state, and both the resulting text and the on-screen position of
 * every suggestion fall out of the same walk.
 *
 * That makes accepting order-independent and idempotent — accept A then B, or
 * B then A, or re-render ten times, and the result is identical.
 */

/**
 * Stable identity for a suggestion.
 *
 * Position alone is not enough: the same word can be flagged twice in one
 * article, and position+original is what distinguishes them. The server does
 * not send an id.
 */
export function suggestionKey(suggestion) {
  return `${suggestion.position}:${suggestion.original}`;
}

/**
 * Whether a suggestion still describes the text it was computed against.
 *
 * The offset indexes the text the server checked; if a client renders anything
 * else, the mark lands on the wrong word. Verified rather than trusted.
 */
export function isAnchored(text, suggestion) {
  if (!suggestion || typeof suggestion.position !== 'number') return false;
  const { position, original } = suggestion;
  return text.slice(position, position + (original?.length ?? 0)) === original;
}

/**
 * Resolve the server text against a set of accepted suggestions.
 *
 * Returns:
 *   text  — the text with accepted suggestions substituted
 *   marks — one entry per usable suggestion, carrying `at`: its offset in
 *           `text` (not in the original), so callers can highlight without
 *           recomputing shifts
 *
 * Suggestions that no longer anchor, or that overlap one already consumed, are
 * dropped: a mark that cannot be placed exactly is worse than no mark.
 */
export function resolveSuggestions(text, suggestions = [], acceptedKeys = new Set()) {
  const usable = suggestions
    .filter((s) => isAnchored(text, s))
    .sort((a, b) => a.position - b.position);

  let out = '';
  let cursor = 0;
  const marks = [];

  for (const suggestion of usable) {
    if (suggestion.position < cursor) continue; // overlaps an earlier one
    out += text.slice(cursor, suggestion.position);

    const key = suggestionKey(suggestion);
    const accepted = acceptedKeys.has(key);
    const shown = accepted ? suggestion.suggestion : suggestion.original;

    marks.push({
      key,
      at: out.length,
      length: shown.length,
      accepted,
      suggestion,
      term: shown,
    });

    out += shown;
    cursor = suggestion.position + suggestion.original.length;
  }

  return { text: out + text.slice(cursor), marks };
}

/**
 * React state for "which suggestions has the reader accepted".
 *
 * Keyed by suggestion rather than by index so a re-fetch that reorders or
 * trims the list cannot silently transfer an acceptance onto a different word.
 * The set resets whenever the underlying text changes — acceptances belong to
 * the result they were made against, and carrying them into the next run would
 * apply a ruling the reader never made.
 */
export function useAcceptedSuggestions(text, suggestions) {
  const [accepted, setAccepted] = useState(EMPTY);

  /* Reset during render rather than in an effect. React's documented pattern
     for "adjust state when a prop changes": an effect would render one frame
     with the previous run's acceptances applied to the new text, which is a
     visibly wrong sentence rather than merely a late one. Tracked in state
     rather than a ref because reading a ref during render is not safe under
     concurrent rendering. */
  const [seenText, setSeenText] = useState(text);
  if (seenText !== text) {
    setSeenText(text);
    if (accepted.size) setAccepted(EMPTY);
  }

  const toggle = useCallback((key) => {
    setAccepted((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const acceptAll = useCallback(() => {
    setAccepted(new Set((suggestions ?? []).map(suggestionKey)));
  }, [suggestions]);

  const reset = useCallback(() => setAccepted(EMPTY), []);

  const resolved = useMemo(
    () => resolveSuggestions(text ?? '', suggestions ?? [], accepted),
    [text, suggestions, accepted]
  );

  return {
    acceptedKeys: accepted,
    acceptedCount: accepted.size,
    toggle,
    acceptAll,
    reset,
    /** The text with accepted suggestions substituted — what Copy should use. */
    text: resolved.text,
  };
}
