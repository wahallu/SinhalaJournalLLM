import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

/**
 * Generic output panel for grammar, style rewriter, and summarizer tools.
 *
 * Handles the following response shapes from the backend:
 *   - Grammar:    { corrected, corrections: [{original, corrected, rule}], correction_count }
 *   - Style:      { rewritten, original, tone }
 *   - Summarizer: { summary, length }
 */

// Rule → category mapping for grammar corrections
const RULE_CATEGORY = {
  spelling:        { label: 'Spelling',     dot: 'bg-red-400',    text: 'text-red-600',    badge: 'bg-red-50 border-red-100 text-red-700' },
  grammar:         { label: 'Grammar',      dot: 'bg-orange-400', text: 'text-orange-600', badge: 'bg-orange-50 border-orange-100 text-orange-700' },
  punctuation:     { label: 'Punctuation',  dot: 'bg-yellow-400', text: 'text-yellow-600', badge: 'bg-yellow-50 border-yellow-100 text-yellow-700' },
  word_order:      { label: 'Word Order',   dot: 'bg-purple-400', text: 'text-purple-600', badge: 'bg-purple-50 border-purple-100 text-purple-700' },
  agreement:       { label: 'Agreement',    dot: 'bg-blue-400',   text: 'text-blue-600',   badge: 'bg-blue-50 border-blue-100 text-blue-700' },
  style:           { label: 'Style',        dot: 'bg-teal-400',   text: 'text-teal-600',   badge: 'bg-teal-50 border-teal-100 text-teal-700' },
};

function resolveCategory(rule = '') {
  const lower = rule.toLowerCase();
  if (lower.includes('spell'))      return RULE_CATEGORY.spelling;
  if (lower.includes('word_order') || lower.includes('order')) return RULE_CATEGORY.word_order;
  if (lower.includes('punct'))      return RULE_CATEGORY.punctuation;
  if (lower.includes('agreement') || lower.includes('concord')) return RULE_CATEGORY.agreement;
  if (lower.includes('style'))      return RULE_CATEGORY.style;
  return RULE_CATEGORY.grammar;
}

function CorrectionCard({ correction, index }) {
  const cat = resolveCategory(correction.rule);
  return (
    <div className="flex items-start gap-3 px-4 py-3 bg-white border border-gray-100 rounded-xl group hover:border-gray-200 hover:shadow-sm transition-all duration-150">
      {/* Index dot */}
      <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${cat.dot}`} />

      <div className="min-w-0 flex-1">
        {/* Before → After */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] text-gray-400 line-through">{correction.original}</span>
          <span className="text-gray-300 text-[11px]">→</span>
          <span className="text-[13px] font-semibold text-gray-800">{correction.corrected}</span>
        </div>

        {/* Rule label */}
        {correction.rule && (
          <p className={`text-[10px] font-medium mt-0.5 uppercase tracking-wider ${cat.text}`}>
            {correction.rule.replace(/_/g, ' ')}
          </p>
        )}
      </div>

      {/* Category badge */}
      <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cat.badge} uppercase tracking-wide`}>
        {cat.label}
      </span>
    </div>
  );
}

export default function OutputPanel({ output, loading, error, type }) {
  const [copied, setCopied] = useState(false);

  if (loading) {
    return (
      <div id="output-loading" className="mt-6 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-gray-300 uppercase tracking-widest">Processing…</span>
        </div>
        <div className="px-5 py-4 bg-white rounded-xl border border-gray-100 space-y-3">
          {[100, 92, 97, 88, 45].map((w, i) => (
            <div
              key={i}
              className="h-3.5 rounded-md animate-shimmer"
              style={{ width: `${w}%`, backgroundSize: '200% 100%' }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div id="output-error" className="mt-6 px-4 py-3.5 text-[14px] text-red-600 bg-red-50 rounded-xl border border-red-100 flex items-start gap-2">
        <svg className="w-4 h-4 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
        <span>{error}</span>
      </div>
    );
  }

  if (!output) return null;

  // Resolve primary display text
  const displayText =
    output.corrected   ??
    output.rewritten   ??
    output.summary     ??
    (typeof output === 'string' ? output : JSON.stringify(output, null, 2));

  const handleCopy = async () => {
    await navigator.clipboard.writeText(displayText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const corrections = output.corrections ?? [];
  const correctionCount = output.correction_count ?? corrections.length;
  const isGrammar = type === 'text' && (output.corrected !== undefined || output.corrections !== undefined);
  const isPerfect = isGrammar && correctionCount === 0;

  return (
    <div id="output-panel" className="mt-6 space-y-3">

      {/* ── Status banner (grammar only) ── */}
      {isGrammar && (
        <div className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-[13px] font-medium ${
          isPerfect
            ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
            : 'bg-amber-50 border-amber-100 text-amber-700'
        }`}>
          {isPerfect ? (
            <>
              <svg className="w-4 h-4 shrink-0 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              <span>No grammar issues detected — your text is correct.</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4 shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
              <span>
                <strong>{correctionCount}</strong> correction{correctionCount !== 1 ? 's' : ''} applied to your text.
              </span>
            </>
          )}
        </div>
      )}

      {/* ── Corrected / result text ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
            {isGrammar ? 'Corrected Text' : type === 'summarizer' ? 'Summary' : 'Result'}
          </span>
          <button
            id="copy-output"
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer text-[11px] font-medium"
            title="Copy to clipboard"
          >
            {copied
              ? <><Check size={13} className="text-emerald-500" /><span className="text-emerald-500">Copied</span></>
              : <><Copy size={13} /><span>Copy</span></>
            }
          </button>
        </div>

        <div className="px-5 py-4 bg-white rounded-xl border border-gray-100 shadow-sm">
          <p className="text-[15px] text-gray-800 leading-[1.85] whitespace-pre-wrap">{displayText}</p>
        </div>
      </div>
      
      <p className="text-center text-[11px] font-light text-gray-400 mt-4">
        Sin Ai can make mistakes. Please double-check responses.
      </p>

    </div>
  );
}
