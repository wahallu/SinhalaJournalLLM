import { useCallback, useState } from 'react';
import { classifySportsRelevance } from '../services/api';
import { createStyleGuard, currentVerdict } from '../lib/styleValidation';

/**
 * Pre-flight check shared by every screen that can submit a rewrite
 * (the Style Rewriter and the Optimize pipeline's restyle stage).
 *
 * `authorize(text, style, { force })` resolves true when the rewrite may be
 * sent. A held request leaves a verdict in `notice`, which stops applying the
 * moment the article or style changes. `checking` is true while the classifier
 * runs, so callers can disable their run button.
 */
export function useStyleGuard() {
  const [guard] = useState(() => createStyleGuard(classifySportsRelevance));
  const [verdict, setVerdict] = useState(null);
  const [checking, setChecking] = useState(false);

  const authorize = useCallback(async (text, style, options) => {
    setChecking(true);
    const outcome = await guard.authorize(text, style, options);
    // A refused duplicate leaves the first call's spinner and verdict alone.
    if (outcome.busy) return false;
    setChecking(false);
    setVerdict(outcome.proceed ? null : { check: outcome.check, input: text, style });
    return outcome.proceed;
  }, [guard]);

  const noticeFor = useCallback(
    (text, style) => currentVerdict(verdict, text, style),
    [verdict],
  );

  return { authorize, checking, noticeFor };
}
