import { Check, Layers, SpellCheck, Undo2 } from 'lucide-react';
import { Card } from './ui/Card';
import WordPopover from './ui/WordPopover';
import { suggestionKey } from '../lib/suggestions';

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

/* One highlight for every mark this view shows. Corrections the model already
   made and suggestions waiting on the reader used to read in three different
   registers (solid fill, dashed border, emerald once applied); collapsing
   them to one removed a legend that existed only to explain the difference. */
const MARK_CLASS =
  'bg-yellow-200/85 text-yellow-950 font-medium px-1 py-0.5 rounded-[3px] border border-yellow-300/70';

/**
 * Corrected text with every applied edit highlighted, and every dictionary
 * suggestion actionable — a single visual treatment for both, so hovering or
 * tabbing to any marked word is what tells you what kind it is, not its color.
 *
 * A name the substitution guard flagged is the one exception: it renders as
 * plain text, unmarked. The source's spelling is restored underneath (see
 * useResolvedText/buildEdits) and stays that way; a name is simply never
 * something this view calls attention to, in either mode.
 *
 * `acceptedKeys` / `onAccept` are optional. Without them a suggestion is still
 * explained on hover but cannot be applied, which is what the read-only
 * surfaces (history, comparison) want.
 */
export function CorrectedText({ marks = [], text = '', className = '', onToggle }) {
  if (!text) return null;
  if (!marks.length) return <>{text}</>;

  const nodes = [];
  let cursor = 0;

  marks.forEach((mark, i) => {
    if (mark.at > cursor) nodes.push(text.slice(cursor, mark.at));

    if (mark.kind === 'name') {
      // Plain text, on purpose — see the docstring above.
      nodes.push(mark.term);
    } else if (mark.kind === 'correction') {
      // Informational only: nothing to accept or undo, just what changed.
      nodes.push(
        <WordPopover
          key={`c-${i}`}
          ariaLabel={`Changed: ${mark.correction?.original || '—'} to ${mark.term}`}
          panel={
            <p className="text-[13px] font-sinhala">
              <span className="text-ink-400 line-through">{mark.correction?.original || '—'}</span>
              <span className="text-ink-300 mx-1.5">→</span>
              <span className="font-semibold text-ink-900">{mark.term}</span>
            </p>
          }
        >
          <mark className={`${MARK_CLASS} ${className}`}>{mark.term}</mark>
        </WordPopover>
      );
    } else {
      nodes.push(
        <WordPopover
          key={`s-${i}`}
          ariaLabel={
            mark.active
              ? `Applied: ${mark.base} changed to ${mark.alternative}`
              : `Possible misspelling: ${mark.base}. Suggested ${mark.alternative}`
          }
          panel={({ close }) => (
            <SuggestionPanel
              suggestion={mark.suggestion}
              accepted={mark.active}
              onAccept={onToggle ? () => { onToggle(mark.key); close(); } : undefined}
            />
          )}
        >
          <mark className={`${MARK_CLASS} ${className}`}>{mark.term}</mark>
        </WordPopover>
      );
    }
    cursor = mark.at + mark.term.length;
  });

  nodes.push(text.slice(cursor));
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
                      ? 'border border-ink-200 text-ink-600 hover:bg-white dark:hover:bg-ink-50'
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
  /* A name the substitution guard flagged is never applied (see
     useResolvedText), so it does not belong in a list titled "Corrections
     applied" — the text does not say what this row would claim it says. Left
     out entirely rather than shown with a warning: a name is not a thing this
     view calls attention to at all. */
  const applied = corrections.filter((c) => !c.suspicious);
  if (!applied.length) return null;

  const breakdown = {};
  applied.forEach((c) => {
    const meta = resolveRule(c);
    breakdown[meta.label] = breakdown[meta.label] || { count: 0, meta };
    breakdown[meta.label].count += 1;
  });
  const entries = Object.entries(breakdown).sort((a, b) => b[1].count - a[1].count);

  return (
    <Card className={`px-4 py-4 space-y-4 ${className}`}>
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
                    style={{ width: `${Math.round((count / applied.length) * 100)}%` }}
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
          {applied.map((c, i) => {
            const meta = resolveRule(c);
            return (
              <div key={i} className="flex items-start gap-2.5 px-3 py-2.5 bg-ink-50/70 border border-ink-100 rounded-xl">
                <div className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${meta.dot}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-sinhala text-[12px] text-ink-400 line-through decoration-brand-300">{c.original}</span>
                    <span className="text-ink-300 text-[10px]">→</span>
                    <span className="font-sinhala text-[12px] font-semibold text-ink-800">{c.corrected}</span>
                  </div>
                  <p className="text-[10px] text-ink-500 mt-0.5 uppercase tracking-wide">{meta.label}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
