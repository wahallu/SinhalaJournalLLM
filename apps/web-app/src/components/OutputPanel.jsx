import { AlertTriangle, CheckCircle2, FileSearch, ArrowRight } from 'lucide-react';
import { Card } from './ui/Card';
import CopyButton from './ui/CopyButton';
import { SkeletonLines } from './ui/Skeleton';

/**
 * Generic output panel for grammar, style rewriter, and summarizer tools.
 *
 * Handles the following response shapes from the backend:
 *   - Grammar:    { corrected, corrections: [{original, corrected, rule}], correction_count }
 *   - Style:      { rewritten, original, tone }
 *   - Summarizer: { summary, length }
 */

/* Wrap each applied correction in a subtle highlight so edits are scannable */
function renderCorrectedText(text, corrections) {
  if (!text || !corrections?.length) return text;
  const found = [];
  corrections.forEach((c) => {
    if (!c.corrected) return;
    const i = text.indexOf(c.corrected);
    if (i !== -1) found.push([i, c.corrected]);
  });
  if (!found.length) return text;
  found.sort((a, b) => a[0] - b[0]);

  const nodes = [];
  let cursor = 0;
  found.forEach(([i, term], k) => {
    if (i < cursor) return;
    if (i > cursor) nodes.push(text.slice(cursor, i));
    nodes.push(
      <mark key={k} className="bg-emerald-100/90 text-emerald-900 rounded-[3px] px-0.5">
        {term}
      </mark>
    );
    cursor = i + term.length;
  });
  nodes.push(text.slice(cursor));
  return nodes;
}

function splitSentences(text) {
  return text
    .split(/(?<=[.!?…])\s+/u)
    .map((s) => s.trim())
    .filter(Boolean);
}

function ResultLabel({ children }) {
  return (
    <span className="text-[10.5px] font-bold text-ink-500 uppercase tracking-[0.14em]">{children}</span>
  );
}

function TextCard({ children, muted = false, className = '' }) {
  return (
    <Card className={`px-5 py-4 ${muted ? 'bg-ink-50/60' : ''} ${className}`}>
      <p className={`text-[15px] leading-[1.85] whitespace-pre-wrap ${muted ? 'text-ink-500' : 'text-ink-800'}`}>
        {children}
      </p>
    </Card>
  );
}

export default function OutputPanel({ output, loading, error, type, input, summaryView = 'paragraph' }) {
  if (loading) {
    return (
      <div id="output-loading" className="space-y-3">
        <div className="flex items-center gap-2">
          <ResultLabel>Processing</ResultLabel>
          <span className="flex gap-1" aria-hidden="true">
            {[0, 1, 2].map((n) => (
              <span
                key={n}
                className="w-1 h-1 rounded-full bg-brand-400 animate-subtle-pulse"
                style={{ animationDelay: `${n * 0.2}s` }}
              />
            ))}
          </span>
        </div>
        <Card className="px-5 py-5">
          <SkeletonLines widths={[100, 92, 97, 88, 45]} />
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div
        id="output-error"
        className="px-4 py-3.5 bg-brand-50 rounded-xl border border-brand-200/70 flex items-start gap-2.5
          animate-in fade-in slide-in-from-bottom-1 duration-200"
        role="alert"
      >
        <AlertTriangle size={16} className="text-brand-600 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-[13.5px] font-semibold text-brand-800">Request failed</p>
          <p className="text-[12.5px] text-brand-700/90 mt-0.5 break-words">{error}</p>
        </div>
      </div>
    );
  }

  if (!output) {
    return (
      <div className="rounded-2xl border border-dashed border-ink-300/70 px-6 py-9 text-center">
        <FileSearch size={22} className="mx-auto text-ink-300 mb-2.5" strokeWidth={1.75} />
        <p className="text-[13px] font-semibold text-ink-500">Results will appear here</p>
        <p className="text-[12px] text-ink-400 mt-1">
          Add Sinhala text above and run the tool to see the output.
        </p>
      </div>
    );
  }

  // Resolve primary display text
  const displayText =
    output.corrected ??
    output.rewritten ??
    output.summary ??
    (typeof output === 'string' ? output : JSON.stringify(output, null, 2));

  const corrections = output.corrections ?? [];
  const correctionCount = output.correction_count ?? corrections.length;
  const isGrammar = type === 'text' && (output.corrected !== undefined || output.corrections !== undefined);
  const isRewrite = output.rewritten !== undefined;
  const isSummary = output.summary !== undefined;
  const isPerfect = isGrammar && correctionCount === 0;
  const originalText = output.original ?? input ?? '';

  return (
    <div id="output-panel" className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">

      {/* ── Status banner (grammar only) ── */}
      {isGrammar && (
        <div
          className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-[13px] font-medium ${
            isPerfect
              ? 'bg-emerald-50 border-emerald-200/70 text-emerald-800'
              : 'bg-amber-50 border-amber-200/70 text-amber-800'
          }`}
        >
          {isPerfect ? (
            <>
              <CheckCircle2 size={15} className="shrink-0 text-emerald-500" />
              <span>No grammar issues detected — your text is correct.</span>
            </>
          ) : (
            <>
              <AlertTriangle size={15} className="shrink-0 text-amber-500" />
              <span>
                <strong>{correctionCount}</strong> correction{correctionCount !== 1 ? 's' : ''} applied to your text.
              </span>
            </>
          )}
        </div>
      )}

      {/* ── Before / after (grammar + rewriter) ── */}
      {(isGrammar && !isPerfect) || isRewrite ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="min-w-0">
            <div className="flex items-center justify-between mb-2 h-7">
              <ResultLabel>Original</ResultLabel>
            </div>
            <TextCard muted className="h-[calc(100%-2.25rem)]">{originalText}</TextCard>
          </div>
          <div className="min-w-0">
            <div className="flex items-center justify-between mb-2 h-7">
              <span className="inline-flex items-center gap-1.5">
                <ArrowRight size={12} className="text-ink-400 md:hidden" />
                <ResultLabel>{isGrammar ? 'Corrected' : 'Rewritten'}</ResultLabel>
                {isRewrite && output.tone && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-brand-700 bg-brand-50 border border-brand-200/70 rounded-full px-2 py-0.5">
                    {output.tone}
                  </span>
                )}
              </span>
              <CopyButton id="copy-output" text={displayText} />
            </div>
            <Card className="px-5 py-4 border-emerald-200/60 h-[calc(100%-2.25rem)]">
              <p className="text-[15px] leading-[1.85] whitespace-pre-wrap text-ink-800">
                {isGrammar ? renderCorrectedText(displayText, corrections) : displayText}
              </p>
            </Card>
          </div>
        </div>
      ) : (
        /* ── Single result card (perfect grammar / summary / fallback) ── */
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <ResultLabel>{isGrammar ? 'Corrected text' : isSummary ? 'Summary' : 'Result'}</ResultLabel>
              {isSummary && output.length && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-ink-500 bg-ink-100 rounded-full px-2 py-0.5">
                  {output.length}
                </span>
              )}
            </div>
            <CopyButton id="copy-output" text={displayText} />
          </div>

          <Card className="px-5 py-4">
            {isSummary && summaryView === 'bullets' ? (
              <ul className="space-y-2.5">
                {splitSentences(displayText).map((s, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[15px] leading-[1.7] text-ink-800">
                    <span className="mt-[0.65em] w-1.5 h-1.5 rounded-full bg-brand-400 shrink-0" aria-hidden="true" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[15px] text-ink-800 leading-[1.85] whitespace-pre-wrap">{displayText}</p>
            )}
          </Card>

          {/* Compression stat for summaries */}
          {isSummary && input && displayText && input.length > displayText.length && (
            <p className="text-[11.5px] text-ink-500 mt-2 tabular-nums">
              Condensed by {Math.round((1 - displayText.length / input.length) * 100)}% —{' '}
              {input.length.toLocaleString()} → {displayText.length.toLocaleString()} characters
            </p>
          )}
        </div>
      )}

      <p className="text-center text-[11px] text-ink-400 pt-1">
        SinAi can make mistakes. Please double-check responses.
      </p>
    </div>
  );
}
