import { useCallback, useEffect, useRef, useState } from 'react';
import { optimizeArticle } from '../services/api';

/* Presentation order. The server emits stages in dependency order, but
   headline and summary race each other at the end, so the pane sorts by this
   rather than by arrival — a row that jumps position as it resolves reads as
   a glitch. */
export const STAGE_ORDER = ['grammar', 'style', 'headline', 'summary'];

const EMPTY = Object.freeze({});

function initialStages() {
  return Object.fromEntries(STAGE_ORDER.map((id) => [id, { status: 'pending' }]));
}

/**
 * Drives one Optimize Article run.
 *
 * Unlike useToolProcessor, results arrive progressively: each stage is
 * exposed the moment its event lands, so the pane fills in over the run
 * instead of appearing all at once at the end.
 *
 * Returned state:
 *   stages  — { grammar|style|headline|summary: { status, data, error, reason } }
 *             status ∈ pending | running | done | skipped | failed
 *   result  — the closing pipeline payload, once the run completes
 *   error   — a request-level failure (429, 503, network), not a stage failure
 */
export function useOptimize() {
  const [stages, setStages] = useState(initialStages);
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  // A run in flight when the user navigates away would otherwise keep the
  // connection open and set state on an unmounted tree.
  useEffect(() => () => abortRef.current?.abort(), []);

  const run = useCallback(async (text, options) => {
    if (!text?.trim()) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStages(initialStages());
    setResult(null);
    setError(null);
    setRunning(true);

    try {
      await optimizeArticle(
        text.trim(),
        options,
        (event) => {
          const { stage, status, data, error: stageError, reason } = event;

          if (stage === 'pipeline') {
            if (status === 'done') setResult(data);
            // A pipeline-level failure arrives in band, because by then the
            // response is already a 200 with bytes on the wire.
            if (status === 'failed') setError(stageError || 'The run could not be completed.');
            return;
          }

          setStages((prev) => ({
            ...prev,
            [stage]: { status, data, error: stageError, reason },
          }));
        },
        { signal: controller.signal }
      );
    } catch (err) {
      if (err.name === 'AbortError') return;
      setError(err.message || 'Optimize failed. Please try again.');
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setRunning(false);
      }
    }
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setRunning(false);
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStages(initialStages());
    setResult(null);
    setError(null);
    setRunning(false);
  }, []);

  return { stages: stages ?? EMPTY, result, running, error, run, cancel, reset };
}
