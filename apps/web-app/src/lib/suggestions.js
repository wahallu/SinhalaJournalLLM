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

/** Stable identity for a flagged name change. */
export function nameKey(correction, at) {
  return `name:${at}:${correction.original}`;
}

/**
 * Locate each flagged name change inside the server's corrected text.
 *
 * Corrections carry an offset into the ORIGINAL input, not into the corrected
 * output, so they have to be found by search. The cursor only moves forward:
 * the same surname corrected twice would otherwise resolve both onto the first
 * occurrence and leave the second unmarked.
 */
function locateNameChanges(text, corrections) {
  const spans = [];
  let cursor = 0;
  for (const correction of corrections) {
    if (!correction?.suspicious) continue;
    const term = correction.corrected;
    if (!term) continue;
    const at = text.indexOf(term, cursor);
    if (at === -1) continue;
    spans.push({
      kind: 'name',
      key: nameKey(correction, at),
      at,
      length: term.length,
      base: term,                       // what the model wrote
      alternative: correction.original, // what the source actually said
      correction,
    });
    cursor = at + term.length;
  }
  return spans;
}

/**
 * Every reversible edit in the server's text, in one coordinate system.
 *
 * Two kinds, pulling in opposite directions:
 *
 *   suggestion  the server text holds the ORIGINAL; applying shows the
 *               suggestion. Off by default in Manual, on in Auto.
 *   name        the server text holds the model's REPLACEMENT; the model has
 *               already renamed someone. "Applying" here means putting the
 *               source's name back, and it is on by default in both modes —
 *               a renamed person is a false statement of fact, so the burden
 *               of proof runs the other way from a spelling.
 *
 * A suggestion overlapping a name span is dropped. Both would rewrite the same
 * characters, and the name has to win.
 */
export function buildEdits(text, { corrections = [], suggestions = [] } = {}) {
  const names = locateNameChanges(text, corrections);

  const spellings = suggestions
    .filter((s) => isAnchored(text, s))
    .map((s) => ({
      kind: 'suggestion',
      key: suggestionKey(s),
      at: s.position,
      length: s.original.length,
      base: s.original,
      alternative: s.suggestion,
      suggestion: s,
    }))
    .filter((s) => !names.some((n) => s.at < n.at + n.length && n.at < s.at + s.length));

  return [...names, ...spellings].sort((a, b) => a.at - b.at);
}

/** Keys that should start active: every name change, plus suggestions in Auto. */
export function defaultActiveKeys(edits, autoApplySuggestions) {
  const keys = edits
    .filter((e) => e.kind === 'name' || autoApplySuggestions)
    .map((e) => e.key);
  return keys.length ? new Set(keys) : EMPTY;
}

/**
 * Apply the active edits to the server text in a single pass.
 *
 * Returns the resulting text plus, for each edit, where it sits in THAT text —
 * so a caller can mark it without recomputing the shifts that applying an
 * edit of a different length introduces.
 */
export function resolveEdits(text, edits, activeKeys = EMPTY) {
  let out = '';
  let cursor = 0;
  const marks = [];

  for (const edit of edits) {
    if (edit.at < cursor) continue; // overlaps one already consumed
    out += text.slice(cursor, edit.at);

    const active = activeKeys.has(edit.key);
    const term = active ? edit.alternative : edit.base;

    marks.push({ ...edit, active, at: out.length, term });
    out += term;
    cursor = edit.at + edit.length;
  }

  return { text: out + text.slice(cursor), marks };
}

/**
 * React state for which reversible edits are currently active.
 *
 * Keyed by edit rather than by index, so a re-fetch that reorders or trims the
 * list cannot silently transfer a decision onto a different word. The set
 * re-baselines whenever the text or the mode changes — decisions belong to the
 * result they were made against.
 *
 * Names start active in BOTH modes: active means "keep what the source wrote",
 * so the model's rename is undone by default and Auto never applies one. The
 * reader can still accept a rename per-word, which is the only way it can now
 * happen at all.
 */
export function useResolvedText(text, { corrections, suggestions, autoApply = false } = {}) {
  const edits = useMemo(
    () => buildEdits(text ?? '', { corrections, suggestions }),
    [text, corrections, suggestions]
  );

  const initial = () => defaultActiveKeys(edits, autoApply);
  const [active, setActive] = useState(initial);

  /* Re-baseline during render rather than in an effect. React's documented
     pattern for "adjust state when a prop changes": an effect would paint one
     frame with the previous run's decisions applied to the new text, which is
     a visibly wrong sentence rather than merely a late one. */
  const baseline = `${text}|${autoApply ? 'auto' : 'manual'}|${edits.length}`;
  const [seenBaseline, setSeenBaseline] = useState(baseline);
  if (seenBaseline !== baseline) {
    setSeenBaseline(baseline);
    setActive(initial);
  }

  const toggle = useCallback((key) => {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  /* Suggestions only. Names are already active and "apply all" must never be
     a route to accepting a batch of renames without looking at them. */
  const applyAllSuggestions = useCallback(() => {
    setActive((prev) => {
      const next = new Set(prev);
      edits.forEach((e) => { if (e.kind === 'suggestion') next.add(e.key); });
      return next;
    });
  }, [edits]);

  const resolved = useMemo(() => resolveEdits(text ?? '', edits, active), [text, edits, active]);

  const suggestionMarks = resolved.marks.filter((m) => m.kind === 'suggestion');

  return {
    /** Text with active edits applied — what Copy and any downstream step use. */
    text: resolved.text,
    marks: resolved.marks,
    activeKeys: active,
    toggle,
    applyAllSuggestions,
    appliedSuggestionCount: suggestionMarks.filter((m) => m.active).length,
    pendingSuggestionCount: suggestionMarks.filter((m) => !m.active).length,
    /** Names whose original spelling is being preserved. */
    keptNameCount: resolved.marks.filter((m) => m.kind === 'name' && m.active).length,
  };
}
