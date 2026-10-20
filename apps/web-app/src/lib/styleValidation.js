/**
 * Pre-flight validation of a rewrite request.
 *
 * Only the Sports target is content-checked: the source article is classified
 * by the backend LLM (POST /rewrite/classify-sports) as SPORTS_RELATED,
 * NOT_SPORTS_RELATED or UNCERTAIN. Source style → target style is never a
 * reason to refuse, and Formal / Feature / Editorial / Youth are unrestricted.
 *
 * There is deliberately no keyword fallback. Keyword counting is what let
 * non-sports articles through (a politics story naming a cricketer and a
 * stadium scored as "sports"), so when the classifier cannot answer the
 * request is held for the user's confirmation rather than guessed at.
 *
 * Verdict: { status: 'ok' | 'warn' | 'block', kind?, message? }
 *   kind: 'blocked' | 'uncertain' | 'unavailable'
 */

export const SPORTS_BLOCK_MESSAGE =
  'This article does not appear to contain sports-related content. ' +
  'Please provide a sports-related article or select another writing style.';

export const SPORTS_UNCERTAIN_MESSAGE =
  'We could not clearly tell that sports is the main subject of this article. ' +
  'The result may not read like sports reporting. You can rewrite anyway, ' +
  'or select another writing style.';

export const SPORTS_UNAVAILABLE_MESSAGE =
  'We could not check whether this article is about sports right now. ' +
  'You can rewrite anyway, try again in a moment, or select another writing style.';

const OK = { status: 'ok' };
const UNAVAILABLE = { status: 'warn', kind: 'unavailable', message: SPORTS_UNAVAILABLE_MESSAGE };

/**
 * @param {string} text  Source article.
 * @param {string} targetStyle  formal | feature | sports | editorial | youth
 * @param {(text: string) => Promise<{label: string, classifier?: string}>} classify
 */
export async function validateStyleRequest(text, targetStyle, classify) {
  if (targetStyle !== 'sports') return OK;

  let result;
  try {
    result = await classify(text);
  } catch {
    // Network or server failure: never treated as "sports", never as a block.
    return UNAVAILABLE;
  }

  if (result?.classifier === 'unavailable') return UNAVAILABLE;
  switch (result?.label) {
    case 'SPORTS_RELATED':
      return OK;
    case 'NOT_SPORTS_RELATED':
      return { status: 'block', kind: 'blocked', message: SPORTS_BLOCK_MESSAGE };
    default:
      return { status: 'warn', kind: 'uncertain', message: SPORTS_UNCERTAIN_MESSAGE };
  }
}

/**
 * Serialises authorisation: while one check is in flight, further calls are
 * refused, so repeated clicks cannot trigger duplicate classification or
 * rewrite requests.
 */
export function createStyleGuard(classify) {
  let busy = false;
  return {
    /**
     * `force` is the user confirming a warning; the UI offers it only for
     * warnings, never for a block.
     * @returns {Promise<{ proceed: boolean, check?: object, busy?: boolean }>}
     */
    async authorize(text, targetStyle, { force = false } = {}) {
      if (busy) return { proceed: false, busy: true };
      if (targetStyle !== 'sports' || force) return { proceed: true };
      busy = true;
      try {
        const check = await validateStyleRequest(text, targetStyle, classify);
        return { proceed: check.status === 'ok', check };
      } finally {
        busy = false;
      }
    },
  };
}

/** A stored verdict applies only to the exact article and style it was made for. */
export function currentVerdict(verdict, text, targetStyle) {
  return verdict && verdict.input === text && verdict.style === targetStyle ? verdict.check : null;
}

/** Authorise, then call `rewrite(text, style)` only if allowed. */
export async function rewriteIfValid(guard, text, style, rewrite, options) {
  const outcome = await guard.authorize(text, style, options);
  if (!outcome.proceed) return outcome;
  return { ...outcome, result: await rewrite(text, style) };
}
