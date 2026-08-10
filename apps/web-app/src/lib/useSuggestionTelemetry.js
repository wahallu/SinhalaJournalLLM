/**
 * Report which proposed changes a journalist took.
 *
 * The point of the study's instrumentation. Stored input/output says what the
 * model did, not whether it was right, and establishing that otherwise costs
 * hand-labelling. An accept or reject click is ground truth the moment it
 * happens: a rejected dictionary flag is a measured false positive, and a
 * reverted correction is the over-correction failure v17-v18 was spent
 * removing.
 *
 * `shown` events are sent once per run so the accept rate has a denominator —
 * "3 rejections" means nothing without knowing whether 3 or 30 were offered.
 */

import { useCallback, useEffect, useRef } from 'react';

import { recordSuggestionEvents } from '../services/api';

// Clicks arrive in bursts as someone works down a list, so decisions are held
// briefly and sent together rather than one request per click.
const FLUSH_MS = 1500;

/**
 * Normalise one edit into a row, with `original -> proposed` always meaning
 * "what the text said" -> "what was proposed for it".
 *
 * The three edit kinds do not agree on that by themselves:
 *
 *   suggestion  base = as written,      alternative = the lexicon's proposal
 *   correction  the model already applied it; the pair lives on `.correction`
 *   name        base = what the MODEL wrote, alternative = what the source
 *               said — reversed, because for a name the active state means
 *               "keep the source spelling"
 *
 * That last one carries the inversion into `action` too, and it is the signal
 * most worth getting right: reverting a name is a journalist catching the
 * ගුණවර්ධන -> ගුණසේකර rename, the worst failure this tool has.
 */
function toEvent(edit, action, { runId, tool, adapter }) {
  let original = edit.base ?? null;
  let proposed = edit.alternative ?? null;
  let rule = null;
  let resolved = action;

  if (edit.kind === 'correction') {
    original = edit.correction?.original ?? edit.base ?? null;
    proposed = edit.correction?.corrected ?? edit.base ?? null;
    rule = edit.correction?.type ?? edit.correction?.rule ?? null;
  } else if (edit.kind === 'name') {
    original = edit.alternative ?? null;  // what the source actually said
    proposed = edit.base ?? null;         // what the model substituted
    rule = 'name-substitution';
    // Active means the source spelling was kept, i.e. the model's rename was
    // turned down. Flip so `action` always describes the model's proposal.
    if (action === 'accepted') resolved = 'rejected';
    else if (action === 'rejected') resolved = 'accepted';
  }

  return {
    run_id: runId ?? null,
    tool,
    // The lexicon's advisory flags are noisy by design, so their precision is
    // measured separately from edits the model actually applied.
    kind: edit.kind === 'suggestion' ? 'suggestion' : 'correction',
    action: resolved,
    original,
    proposed,
    rule,
    position: typeof edit.at === 'number' ? edit.at : null,
    adapter: adapter ?? null,
  };
}

/**
 * @param {object}   options
 * @param {string}   options.runId    id of the run these edits belong to
 * @param {Array}    options.edits    every edit offered, for the `shown` batch
 * @param {string}   [options.tool]
 * @param {string}   [options.adapter]
 * @returns {{ onDecision: (edit, accepted: boolean) => void }}
 */
export function useSuggestionTelemetry({ runId, edits, tool = 'grammar', adapter } = {}) {
  const queue = useRef([]);
  const timer = useRef(null);
  const meta = useRef({ runId, tool, adapter });
  meta.current = { runId, tool, adapter };

  const flush = useCallback(() => {
    const batch = queue.current;
    queue.current = [];
    timer.current = null;
    if (batch.length) recordSuggestionEvents(batch);
  }, []);

  const push = useCallback((event) => {
    queue.current.push(event);
    if (timer.current) return;
    timer.current = setTimeout(flush, FLUSH_MS);
  }, [flush]);

  // One `shown` batch per run. Keyed on runId rather than the edits array so a
  // re-render that rebuilds the array cannot re-send it and inflate the
  // denominator.
  const shownFor = useRef(null);
  useEffect(() => {
    if (!runId || !edits?.length || shownFor.current === runId) return;
    shownFor.current = runId;
    edits.forEach((edit) => push(toEvent(edit, 'shown', meta.current)));
  }, [runId, edits, push]);

  // Send whatever is pending before the tab goes away, otherwise the last few
  // decisions of every session — often the interesting ones — are lost.
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      if (timer.current) clearTimeout(timer.current);
      flush();
    };
  }, [flush]);

  const onDecision = useCallback((edit, accepted) => {
    push(toEvent(edit, accepted ? 'accepted' : 'rejected', meta.current));
  }, [push]);

  return { onDecision };
}
