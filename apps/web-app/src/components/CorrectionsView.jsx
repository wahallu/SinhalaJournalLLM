import { AlertTriangle, Check, Layers, SpellCheck, Undo2 } from 'lucide-react';
import { Card } from './ui/Card';
import WordPopover from './ui/WordPopover';
import { resolveSuggestions, suggestionKey } from '../lib/suggestions';

/* Module-level so the default prop is referentially stable — a fresh Set()
   per render would change identity every time and defeat memoisation in any
   consumer that adds it later. */
const EMPTY_SET = new Set();

/**
 * Shared rendering for grammar corrections — the marked-up corrected text and
 * the categorised list beneath it.
 *
 * Lives outside OutputPanel because the Optimize Article pane shows the same
 * two things for its grammar stage, and two copies would drift.
 */

/* Categories a correction can fall into.
   These mirror grammar_service._classify() on the backend, which is where the
   split actually happens: the model returns corrected text only, so the
   server diffs input against output word by word and labels each edit —
   punctuation-only change → punctuation, single token whose corrected form
   is a prefix/suffix extension of the original → grammar (word form),
   single token that is otherwise ≥60% similar → spelling, everything else →
   grammar. word_order / agreement / style are not emitted today; they are
   kept so an older stored correction still resolves. */
const RULE_META = {
  spelling: { label: 'Spelling', dot: 'bg-brand-400', bar: 'bg-brand-400' },
  grammar: { label: 'Grammar', dot: 'bg-orange-400', bar: 'bg-orange-400' },
  word_order: { label: 'Word Order', dot: 'bg-purple-400', bar: 'bg-purple-400' },
  punctuation: { label: 'Punctuation', dot: 'bg-amber-400', bar: 'bg-amber-400' },
  agreement: { label: 'Agreement', dot: 'bg-blue-400', bar: 'bg-blue-400' },
  style: { label: 'Style', dot: 'bg-teal-400', bar: 'bg-teal-400' },
};

/**
 * Category for one correction.
 *
 * `type` is the structured field the backend sets in _classify() and is
 * authoritative. The `rule` sniffing below is the fallback for records
 * written before `type` existed — a stored history row has no `type` at all,
 * and its rule string ("Spelling correction (අක්ෂර වින්‍යාස නිවැරදි කිරීම)")
 * is the only thing left to go on.
 */
function resolveRule(correction = {}) {
  const { type, rule = '' } = correction;
  if (type && RULE_META[type]) return RULE_META[type];

  const lower = rule.toLowerCase();
  if (lower.includes('spell')) return RULE_META.spelling;
  if (lower.includes('word_order') || lower.includes('order')) return RULE_META.word_order;
  if (lower.includes('punct')) return RULE_META.punctuation;
  if (lower.includes('agreement') || lower.includes('concord')) return RULE_META.agreement;
  if (lower.includes('style')) return RULE_META.style;
  return RULE_META.grammar;
}

/**
 * Locate each correction inside the corrected text.
 *
 * Scans forward from a moving cursor rather than restarting at 0 for every
 * correction: a word corrected twice in one article (common — the same
 * misspelling repeated) would otherwise resolve both corrections onto the
 * first occurrence and leave the second unmarked.
 */
function locate(text, corrections) {
  const spans = [];
  let cursor = 0;
  for (const correction of corrections) {
    const term = correction.corrected;
    if (!term) continue;
    const at = text.indexOf(term, cursor);
    if (at === -1) continue;
    spans.push({ at, term, correction });
    cursor = at + term.length;
  }
  return spans;
}

/**
 * Corrected text with every applied edit highlighted, and every dictionary
 * suggestion actionable.
 *
 * Marks read in three registers, deliberately distinct:
 *   yellow fill    — an edit the model already made
 *   rose fill      — an edit the substitution guard thinks replaced a word
 *   dotted underline — a suggestion nothing has acted on yet
 *
 * A red wavy underline was tried for the last one and sat too close to the
 * Sinhala glyphs' own descenders and vowel signs; the mark and the script
 * competed. A dotted underline set well below the baseline does not.
 *
 * `acceptedKeys` / `onAccept` are optional. Without them the suggestions are
 * still explained on hover but cannot be applied, which is what the read-only
 * surfaces (history, comparison) want.
 */
export function CorrectedText({
  text,
  corrections = [],
  suggestions = [],
  acceptedKeys = EMPTY_SET,
  onAccept,
  className = '',
}) {
  if (!text) return null;

  /* One pass produces both the text to show and where each suggestion sits in
     it. Accepting a suggestion can change the text's length, so anything that
     tracked offsets separately would drift after the first acceptance. */
  const { text: shownText, marks } = resolveSuggestions(text, suggestions, acceptedKeys);

  const applied = locate(shownText, corrections).map((s) => ({ ...s, kind: 'applied' }));

  // An applied edit wins any overlap: the text there has already changed, so a
  // suggestion about the old spelling is stale.
  const flagged = marks
    .map((m) => ({ at: m.at, term: m.term, mark: m, kind: 'suggested' }))
    .filter((s) => !applied.some((a) => s.at < a.at + a.term.length && a.at < s.at + s.term.length));

  const spans = [...applied, ...flagged].sort((a, b) => a.at - b.at);
  if (!spans.length) return <>{shownText}</>;

  const nodes = [];
  let cursor = 0;

  spans.forEach(({ at, term, correction, mark, kind }, i) => {
    if (at > cursor) nodes.push(shownText.slice(cursor, at));

    if (kind === 'applied') {
      const suspicious = correction.suspicious;
      nodes.push(
        <WordPopover
          key={`c-${i}`}
          ariaLabel={`${suspicious ? 'Flagged change' : 'Change'}: ${correction.original || '—'} to ${term}`}
          panel={
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink-500">
                {suspicious ? 'Check this change' : 'Changed'}
              </p>
              <p className="text-[13px] font-sinhala">
                <span className="text-ink-400 line-through">{correction.original || '—'}</span>
                <span className="text-ink-300 mx-1.5">→</span>
                <span className={`font-semibold ${suspicious ? 'text-rose-900' : 'text-ink-900'}`}>{term}</span>
              </p>
              {suspicious && (
                <p className="text-[11px] leading-snug text-rose-700">
                  {correction.suspicious_reason || 'Possible word replacement — verify against your source.'}
                </p>
              )}
            </div>
          }
        >
          <mark
            className={
              suspicious
                ? `bg-rose-200/90 text-rose-950 font-semibold px-1 py-0.5 rounded-[3px]
                   border border-rose-400/80 ${className}`
                : `bg-yellow-200/85 text-yellow-950 font-medium px-1 py-0.5 rounded-[3px]
                   border border-yellow-300/70 ${className}`
            }
          >
            {term}
          </mark>
        </WordPopover>
      );
    } else {
      const { suggestion, accepted, key } = mark;
      nodes.push(
        <WordPopover
          key={`s-${i}`}
          ariaLabel={
            accepted
              ? `Applied: ${suggestion.original} changed to ${suggestion.suggestion}`
              : `Possible misspelling: ${suggestion.original}. Suggested ${suggestion.suggestion}`
          }
          panel={({ close }) => (
            <SuggestionPanel
              suggestion={suggestion}
              accepted={accepted}
              onAccept={onAccept ? () => { onAccept(key); close(); } : undefined}
            />
          )}
        >
          <span
            className={
              accepted
                ? // Applied by the reader, not the model — emerald keeps it
                  // distinct from the model's own yellow edits.
                  `bg-emerald-100 text-emerald-950 font-medium px-1 py-0.5 rounded-[3px]
                   border border-emerald-300 ${className}`
                : `underline decoration-dotted decoration-2 decoration-sky-500/80
                   underline-offset-[5px] ${className}`
            }
          >
            {term}
          </span>
        </WordPopover>
      );
    }
    cursor = at + term.length;
  });

  nodes.push(shownText.slice(cursor));
  return <>{nodes}</>;
}

/** Body of a suggestion popover: the evidence, then the action. */
function SuggestionPanel({ suggestion, accepted, onAccept }) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink-500">
        {accepted ? 'Applied' : 'Possible misspelling'}
      </p>
      <p className="text-[13px] font-sinhala">
        <span className={accepted ? 'text-ink-400 line-through' : 'text-ink-600'}>
          {suggestion.original}
        </span>
        <span className="text-ink-300 mx-1.5">→</span>
        <span className="font-semibold text-ink-900">{suggestion.suggestion}</span>
      </p>
      {/* The counts are the whole argument for the suggestion — it is evidence
          from a 215k-article corpus, not a dictionary ruling. Showing them
          lets an editor overrule it on sight for a name or a rare-but-correct
          word. */}
      <p className="text-[10.5px] text-ink-500 tabular-nums">
        seen {Number(suggestion.seen ?? 0).toLocaleString()}× vs{' '}
        {Number(suggestion.suggestion_seen ?? 0).toLocaleString()}× in the news corpus
      </p>
      {onAccept && (
        <button
          type="button"
          onClick={onAccept}
          className={`w-full inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5
            text-[12px] font-semibold cursor-pointer transition-colors
            ${accepted
              ? 'border border-ink-200 text-ink-600 hover:bg-ink-50'
              : 'bg-brand-600 text-white hover:bg-brand-700'}`}
        >
          {accepted ? (<><Undo2 size={12} /> Undo</>) : (<><Check size={12} /> Apply</>)}
        </button>
      )}
    </div>
  );
}

/**
 * Words the dictionary thinks are misspelled but nothing changed.
 *
 * Kept visually and structurally apart from CorrectionsList because the
 * epistemic status is different: those are edits the model already made, these
 * are guesses a human has to rule on. The model memorises word forms and so
 * misses words it was never trained on; this layer catches about 23% of that
 * residue by asking whether a near-identical spelling is far commoner in 106k
 * news articles — which is evidence, not proof, hence the corpus counts on
 * every row rather than a bare assertion.
 */
export function SuggestionsList({
  suggestions = [],
  acceptedKeys = EMPTY_SET,
  onAccept,
  onAcceptAll,
  className = '',
}) {
  if (!suggestions.length) return null;

  const pending = suggestions.filter((s) => !acceptedKeys.has(suggestionKey(s)));
  const canAct = Boolean(onAccept);

  return (
    <Card className={`px-4 py-4 ${className}`}>
      <div className="flex items-start justify-between gap-3 mb-1">
        <p className="text-[10px] font-bold text-ink-500 uppercase tracking-[0.12em] flex items-center gap-1.5">
          <SpellCheck size={10} /> Possible misspellings
        </p>
        {/* Bulk accept only appears when there is more than one left to act
            on — for a single row the per-row button is right there, and a
            second control that does the same thing is just noise. */}
        {canAct && onAcceptAll && pending.length > 1 && (
          <button
            type="button"
            onClick={onAcceptAll}
            className="text-[11px] font-semibold text-brand-700 hover:underline cursor-pointer shrink-0"
          >
            Apply all {pending.length}
          </button>
        )}
      </div>
      <p className="text-[10.5px] text-ink-400 mb-2.5 leading-snug">
        {canAct
          ? 'Not changed automatically — the checker only flags them. Apply the ones you agree with.'
          : 'Not changed — these are rare spellings the checker noticed. Your call.'}
      </p>
      <div className="space-y-1.5">
        {suggestions.map((s, i) => {
          const key = suggestionKey(s);
          const accepted = acceptedKeys.has(key);
          return (
            <div
              key={key || i}
              className={`flex items-start gap-2.5 px-3 py-2.5 rounded-xl border ${
                accepted
                  ? 'bg-emerald-50/70 border-emerald-200'
                  : 'bg-sky-50/60 border-sky-100'
              }`}
            >
              <div className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${accepted ? 'bg-emerald-500' : 'bg-sky-400'}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`font-sinhala text-[12px] ${
                    accepted
                      ? 'text-ink-400 line-through'
                      : 'text-ink-500 underline decoration-dotted decoration-sky-400 underline-offset-[3px]'
                  }`}>
                    {s.original}
                  </span>
                  <span className="text-ink-300 text-[10px]">→</span>
                  <span className="font-sinhala text-[12px] font-semibold text-ink-800">{s.suggestion}</span>
                </div>
                <p className="text-[10px] text-ink-500 mt-0.5 tabular-nums">
                  seen {Number(s.seen ?? 0).toLocaleString()}× vs {Number(s.suggestion_seen ?? 0).toLocaleString()}× in the news corpus
                </p>
              </div>
              {canAct && (
                <button
                  type="button"
                  onClick={() => onAccept(key)}
                  aria-label={accepted
                    ? `Undo ${s.original} to ${s.suggestion}`
                    : `Apply ${s.suggestion} in place of ${s.original}`}
                  className={`shrink-0 inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px]
                    font-semibold cursor-pointer transition-colors ${
                    accepted
                      ? 'border border-ink-200 text-ink-600 hover:bg-white'
                      : 'bg-brand-600 text-white hover:bg-brand-700'
                  }`}
                >
                  {accepted ? (<><Undo2 size={11} /> Undo</>) : (<><Check size={11} /> Apply</>)}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/**
 * Per-category breakdown plus the full list of edits.
 *
 * The breakdown is what answers "how many spelling mistakes versus grammar
 * mistakes" at a glance; the list below it is the review surface — an editor
 * has to be able to see what the model changed, especially inside quoted
 * material, rather than take the corrected text on trust.
 */
export function CorrectionsList({ corrections = [], className = '' }) {
  if (!corrections.length) return null;

  const breakdown = {};
  corrections.forEach((c) => {
    const meta = resolveRule(c);
    breakdown[meta.label] = breakdown[meta.label] || { count: 0, meta };
    breakdown[meta.label].count += 1;
  });
  const entries = Object.entries(breakdown).sort((a, b) => b[1].count - a[1].count);
  const flaggedCount = corrections.filter((c) => c.suspicious).length;

  return (
    <Card className={`px-4 py-4 space-y-4 ${className}`}>
      {/* Sits above the category breakdown, not inside the list, because the
          list is scrollable and a renamed person must not be something an
          editor can scroll past. The model swaps one real surname for another
          in roughly 1.5-2% of articles and does it fluently, so nothing in the
          text itself signals the error. */}
      {flaggedCount > 0 && (
        <div className="flex items-start gap-2.5 px-3 py-2.5 bg-rose-50 border border-rose-200 rounded-xl">
          <AlertTriangle size={13} className="mt-0.5 shrink-0 text-rose-600" />
          <div className="min-w-0">
            <p className="text-[11.5px] font-semibold text-rose-800">
              {flaggedCount === 1
                ? '1 change may have replaced a word'
                : `${flaggedCount} changes may have replaced words`}
            </p>
            <p className="text-[10.5px] text-rose-700/90 leading-snug mt-0.5">
              Marked in red below and in the text. These look like a different
              word rather than a corrected spelling — often a name. Check them
              against your source before publishing.
            </p>
          </div>
        </div>
      )}

      {entries.length > 1 && (
        <div>
          <p className="text-[10px] font-bold text-ink-500 uppercase tracking-[0.12em] mb-2 flex items-center gap-1.5">
            <Layers size={10} /> By category
          </p>
          <div className="space-y-1.5">
            {entries.map(([label, { count, meta }]) => (
              <div key={label} className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full shrink-0 ${meta.dot}`} />
                <span className="text-[11.5px] text-ink-600 flex-1">{label}</span>
                <div className="w-20 h-1.5 bg-ink-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${meta.bar}`}
                    style={{ width: `${Math.round((count / corrections.length) * 100)}%` }}
                  />
                </div>
                <span className="text-[11px] font-semibold text-ink-600 w-3 text-right tabular-nums">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-[10px] font-bold text-ink-500 uppercase tracking-[0.12em] mb-2">
          Corrections applied
        </p>
        <div className="space-y-1.5">
          {corrections.map((c, i) => {
            const meta = resolveRule(c);
            return (
              <div
                key={i}
                className={
                  c.suspicious
                    ? 'flex items-start gap-2.5 px-3 py-2.5 bg-rose-50 border border-rose-200 rounded-xl'
                    : 'flex items-start gap-2.5 px-3 py-2.5 bg-ink-50/70 border border-ink-100 rounded-xl'
                }
              >
                {c.suspicious ? (
                  <AlertTriangle size={12} className="mt-1 shrink-0 text-rose-600" />
                ) : (
                  <div className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${meta.dot}`} />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-sinhala text-[12px] text-ink-400 line-through decoration-brand-300">{c.original}</span>
                    <span className="text-ink-300 text-[10px]">→</span>
                    <span
                      className={
                        c.suspicious
                          ? 'font-sinhala text-[12px] font-semibold text-rose-900'
                          : 'font-sinhala text-[12px] font-semibold text-ink-800'
                      }
                    >
                      {c.corrected}
                    </span>
                  </div>
                  {c.suspicious ? (
                    /* The reason, verbatim from the guard, rather than a generic
                       "check this" — it names what triggered the flag, which is
                       what lets an editor dismiss it in one read when it is a
                       false alarm. */
                    <p className="text-[10px] text-rose-700 mt-0.5 leading-snug">
                      {c.suspicious_reason || 'Possible word replacement — verify against your source.'}
                    </p>
                  ) : (
                    <p className="text-[10px] text-ink-500 mt-0.5 uppercase tracking-wide">{meta.label}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
