import { Layers, SpellCheck } from 'lucide-react';
import { Card } from './ui/Card';

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
 * Corrected text with every applied edit highlighted in yellow.
 *
 * Same treatment the admin Model Comparison pane uses for its verbatim-match
 * marks, so a changed word reads identically in both places. A red wavy
 * underline sat too close to the Sinhala glyphs' own descenders and vowel
 * signs — the mark and the script competed; a background fill does not.
 */
export function CorrectedText({ text, corrections = [], suggestions = [], className = '' }) {
  if (!text) return null;

  const applied = locate(text, corrections).map((s) => ({ ...s, kind: 'applied' }));

  /* Suggestions carry an exact offset from the backend rather than needing to
     be searched for, but it is verified before use: the offset is into the
     text the server checked, and a client showing anything else would mark the
     wrong word. An applied edit wins any overlap — the text there has already
     changed, so a suggestion about the old spelling is stale. */
  const flagged = suggestions
    .filter((s) => text.slice(s.position, s.position + s.original.length) === s.original)
    .map((s) => ({ at: s.position, term: s.original, suggestion: s, kind: 'suggested' }))
    .filter((s) => !applied.some((a) => s.at < a.at + a.term.length && a.at < s.at + s.term.length));

  const spans = [...applied, ...flagged].sort((a, b) => a.at - b.at);
  if (!spans.length) return <>{text}</>;

  const nodes = [];
  let cursor = 0;
  spans.forEach(({ at, term, correction, suggestion, kind }, i) => {
    if (at > cursor) nodes.push(text.slice(cursor, at));
    nodes.push(
      kind === 'applied' ? (
        <mark
          key={i}
          title={`${correction.original || '—'} → ${term}`}
          className={`bg-yellow-200/85 text-yellow-950 font-medium px-1 py-0.5 rounded-[3px]
            border border-yellow-300/70 ${className}`}
        >
          {term}
        </mark>
      ) : (
        /* Deliberately not a fill. Nothing was changed here, so it must not
           read like the yellow marks above it — a dotted underline says "worth
           a look" where a highlight would say "done". */
        <span
          key={i}
          title={`Possible misspelling — did you mean ${suggestion.suggestion}?`}
          className={`underline decoration-dotted decoration-2 decoration-sky-500/80
            underline-offset-[5px] cursor-help ${className}`}
        >
          {term}
        </span>
      )
    );
    cursor = at + term.length;
  });
  nodes.push(text.slice(cursor));
  return <>{nodes}</>;
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
export function SuggestionsList({ suggestions = [], className = '' }) {
  if (!suggestions.length) return null;

  return (
    <Card className={`px-4 py-4 ${className}`}>
      <p className="text-[10px] font-bold text-ink-500 uppercase tracking-[0.12em] mb-1 flex items-center gap-1.5">
        <SpellCheck size={10} /> Possible misspellings
      </p>
      <p className="text-[10.5px] text-ink-400 mb-2.5 leading-snug">
        Not changed — these are rare spellings the checker noticed. Your call.
      </p>
      <div className="space-y-1.5">
        {suggestions.map((s, i) => (
          <div key={i} className="flex items-start gap-2.5 px-3 py-2.5 bg-sky-50/60 border border-sky-100 rounded-xl">
            <div className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 bg-sky-400" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-sinhala text-[12px] text-ink-500 underline decoration-dotted decoration-sky-400 underline-offset-[3px]">
                  {s.original}
                </span>
                <span className="text-ink-300 text-[10px]">→</span>
                <span className="font-sinhala text-[12px] font-semibold text-ink-800">{s.suggestion}</span>
              </div>
              <p className="text-[10px] text-ink-500 mt-0.5 tabular-nums">
                seen {s.seen.toLocaleString()}× vs {s.suggestion_seen.toLocaleString()}× in the news corpus
              </p>
            </div>
          </div>
        ))}
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
