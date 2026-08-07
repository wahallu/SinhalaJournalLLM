import { useState } from 'react';
import {
  AlertTriangle, ArrowDownToLine, Check, ChevronDown, FileText,
  MinusCircle, Newspaper, PenLine, Sparkles, SpellCheck,
} from 'lucide-react';
import { Card } from '../ui/Card';
import CopyButton from '../ui/CopyButton';
import ActionButton from '../ui/ActionButton';
import { ShimmerDot, SkeletonLines } from '../ui/Skeleton';
import { CorrectedText, CorrectionsList, SuggestionsList } from '../CorrectionsView';
import { useAcceptedSuggestions } from '../../lib/suggestions';

/* Stable identity for the "no suggestions" case — see OutputPanel. */
const NO_SUGGESTIONS = [];
import { STAGE_ORDER } from '../../hooks/useOptimize';

const STAGE_META = {
  grammar: { label: 'Grammar', icon: SpellCheck, note: 'Corrects the article' },
  style: { label: 'Style', icon: PenLine, note: 'Rewrites the corrected text' },
  headline: { label: 'Headlines', icon: Newspaper, note: 'Written from the final text' },
  summary: { label: 'Summary', icon: FileText, note: 'Written from the final text' },
};

const SKIP_REASONS = {
  not_requested: 'Not requested',
  disabled: 'Switched off by an administrator',
};

/* Small status pill on each stage header. Skipped stays deliberately quiet —
   it is a normal outcome, not a problem to draw the eye to. */
function StageStatus({ status }) {
  if (status === 'running') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-brand-700">
        <ShimmerDot size={12} />
        Running
      </span>
    );
  }
  if (status === 'done') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
        <Check size={12} strokeWidth={3} />
        Done
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700">
        <AlertTriangle size={12} />
        Failed
      </span>
    );
  }
  if (status === 'skipped') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-ink-400">
        <MinusCircle size={12} />
        Skipped
      </span>
    );
  }
  return <span className="text-[11px] font-medium text-ink-300">Queued</span>;
}

function StageCard({ id, stage, children }) {
  const meta = STAGE_META[id];
  const Icon = meta.icon;
  const { status, reason, error } = stage;
  const muted = status === 'pending' || status === 'skipped';

  return (
    <Card className={`overflow-hidden ${muted ? 'opacity-70' : ''}`}>
      <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-ink-100">
        <div
          className={`w-6.5 h-6.5 rounded-md flex items-center justify-center shrink-0
            ${status === 'done' ? 'bg-brand-50 text-brand-600' : 'bg-ink-100 text-ink-400'}`}
        >
          <Icon size={13} strokeWidth={2.25} />
        </div>
        <h3 className="text-[12px] font-bold text-ink-800 tracking-tight">{meta.label}</h3>
        <span className="hidden sm:block text-[10.5px] text-ink-400 truncate">{meta.note}</span>
        <span className="ml-auto shrink-0">
          <StageStatus status={status} />
        </span>
      </div>

      <div className="px-4 py-3.5">
        {status === 'pending' && (
          <p className="text-[12px] text-ink-400">Waiting for the previous step.</p>
        )}
        {status === 'running' && <SkeletonLines widths={[100, 94, 88, 52]} lineClassName="h-3" />}
        {status === 'skipped' && (
          <p className="text-[12px] text-ink-500">{SKIP_REASONS[reason] ?? 'Skipped'}</p>
        )}
        {status === 'failed' && (
          <p className="text-[12px] text-brand-700 break-words">
            {error || 'This step could not be completed.'} The other steps were unaffected.
          </p>
        )}
        {status === 'done' && children}
      </div>
    </Card>
  );
}

function GrammarStage({ data }) {
  const [open, setOpen] = useState(false);
  const corrections = data.corrections ?? [];
  const count = data.correction_count ?? corrections.length;
  const suggestions = data.suggestions ?? NO_SUGGESTIONS;
  // Above the early return below: hooks cannot be called conditionally.
  const accepted = useAcceptedSuggestions(data.corrected ?? '', suggestions);

  // Only truly nothing to report — dictionary flags alone still need the text.
  if (!count && !suggestions.length) {
    return (
      <p className="text-[12.5px] text-emerald-700 flex items-center gap-1.5">
        <Check size={13} strokeWidth={3} className="shrink-0" />
        No grammar issues found — the text was already correct.
      </p>
    );
  }

  const parts = [];
  if (count) parts.push(`${count} correction${count !== 1 ? 's' : ''}`);
  if (suggestions.length) parts.push(`${suggestions.length} to check`);

  return (
    <div className="space-y-2.5">
      <p className="font-sinhala text-[15px] leading-[1.85] whitespace-pre-wrap text-ink-800">
        <CorrectedText
          text={data.corrected}
          corrections={corrections}
          suggestions={suggestions}
          acceptedKeys={accepted.acceptedKeys}
          onAccept={accepted.toggle}
        />
      </p>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-ink-500
          hover:text-brand-700 cursor-pointer transition-colors"
      >
        <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        {parts.join(', ')} — {open ? 'hide' : 'review'} details
      </button>
      {/* Review, not decoration: an editor has to be able to check what the
          model rewrote, especially inside quoted material. */}
      {open && <CorrectionsList corrections={corrections} />}
      {open && (
        <SuggestionsList
          suggestions={suggestions}
          acceptedKeys={accepted.acceptedKeys}
          onAccept={accepted.toggle}
          onAcceptAll={accepted.acceptAll}
        />
      )}
    </div>
  );
}

function StyleStage({ data }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-brand-700
          bg-brand-50 border border-brand-200/70 rounded-full px-2 py-0.5">
          {data.style || data.tone}
        </span>
        <CopyButton text={data.rewritten} className="ml-auto" />
      </div>
      <p className="font-sinhala text-[15px] leading-[1.85] whitespace-pre-wrap text-ink-800">{data.rewritten}</p>
    </div>
  );
}

function HeadlineStage({ data, onUse }) {
  const headlines = data.headlines ?? [];
  const band = data.length;

  if (!headlines.length) {
    return <p className="text-[12px] text-ink-500">No headline candidates were returned.</p>;
  }

  return (
    <ol className="space-y-1.5">
      {headlines.map((headline, i) => {
        const words = headline.trim().split(/\s+/).length;
        const inBand = !band || (words >= band.min_words && words <= band.max_words);
        return (
          <li
            key={i}
            className="group flex items-start gap-2.5 px-3 py-2.5 rounded-xl border border-ink-100
              bg-ink-50/60 hover:border-ink-200 transition-colors"
          >
            <span className="mt-0.5 text-[10px] font-bold text-ink-400 tabular-nums w-3 shrink-0">
              {i + 1}
            </span>
            <span className="font-sinhala text-[13.5px] text-ink-800 leading-snug flex-1 min-w-0">{headline}</span>
            <span
              className={`text-[10px] tabular-nums shrink-0 mt-0.5 ${inBand ? 'text-ink-400' : 'text-amber-600 font-semibold'}`}
              title={
                inBand
                  ? `${words} words`
                  : `${words} words — outside the requested ${band.min_words}–${band.max_words} band`
              }
            >
              {words}w
            </span>
            <CopyButton
              text={headline}
              label=""
              size={12}
              className="shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
            />
            {onUse && (
              <button
                onClick={() => onUse(headline)}
                title="Put this headline at the top of the editor"
                className="shrink-0 text-[11px] font-semibold text-ink-400 hover:text-brand-700
                  opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all cursor-pointer"
              >
                Use
              </button>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function SummaryStage({ data, articleLength }) {
  const summary = data.summary ?? '';
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-ink-500
          bg-ink-100 rounded-full px-2 py-0.5">
          {data.length}
        </span>
        <CopyButton text={summary} className="ml-auto" />
      </div>
      <p className="font-sinhala text-[15px] leading-[1.85] whitespace-pre-wrap text-ink-800">{summary}</p>
      {articleLength > summary.length && (
        <p className="text-[11px] text-ink-400 tabular-nums">
          Condensed by {Math.round((1 - summary.length / articleLength) * 100)}% —{' '}
          {articleLength.toLocaleString()} → {summary.length.toLocaleString()} characters
        </p>
      )}
    </div>
  );
}

/**
 * The Optimize Article results pane.
 *
 * One card per stage, always all four, in dependency order — a stage that was
 * skipped still shows, because "we did not do this" is information the user
 * needs as much as the results themselves.
 */
export default function OptimizeResults({
  stages, result, running, error, articleText, onApply, onUseHeadline,
}) {
  const started = running || result || Object.values(stages).some((s) => s.status !== 'pending');

  if (error) {
    return (
      <div
        className="px-4 py-3.5 bg-brand-50 rounded-xl border border-brand-200/70 flex items-start gap-2.5
          animate-in fade-in slide-in-from-bottom-1 duration-200"
        role="alert"
      >
        <AlertTriangle size={16} className="text-brand-600 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-[13.5px] font-semibold text-brand-800">Optimize failed</p>
          <p className="text-[12.5px] text-brand-700/90 mt-0.5 break-words">{error}</p>
        </div>
      </div>
    );
  }

  if (!started) {
    return (
      <div className="rounded-2xl border border-dashed border-ink-300/70 px-6 py-9 text-center">
        <Sparkles size={22} className="mx-auto text-ink-300 mb-2.5" strokeWidth={1.75} />
        <p className="text-[13px] font-semibold text-ink-500">Ready to optimize</p>
        <p className="text-[12px] text-ink-400 mt-1 max-w-sm mx-auto leading-relaxed">
          Paste an article and run Optimize. Each step appears here as it finishes,
          in the order it runs.
        </p>
      </div>
    );
  }

  const changed = result && result.final_text !== result.original_text;

  return (
    <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* The one action that matters once the run is done: the final text is
          what the article should become, and it is the corrected text or the
          restyled text depending on which stages ran. */}
      {result && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 rounded-xl
          bg-ink-950 text-white">
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-semibold">
              {changed ? 'Final text ready' : 'No changes were needed'}
            </p>
            <p className="text-[11px] text-white/55 mt-0.5">
              {result.stages_run.length} of 4 steps ran
              {Object.keys(result.stages_failed).length > 0 &&
                ` · ${Object.keys(result.stages_failed).length} failed`}
            </p>
          </div>
          <CopyButton
            text={result.final_text}
            label="Copy"
            className="!text-white/70 hover:!text-white hover:!bg-white/10"
          />
          <ActionButton
            id="optimize-apply"
            size="sm"
            icon={ArrowDownToLine}
            onClick={() => onApply?.(result.final_text)}
            disabled={!changed}
            title={changed ? 'Replace the editor content with the final text' : 'Nothing to apply'}
            className="!bg-white !text-ink-900 !border-transparent hover:!bg-white/90"
          >
            Apply
          </ActionButton>
        </div>
      )}

      {STAGE_ORDER.map((id) => {
        const stage = stages[id] ?? { status: 'pending' };
        return (
          <StageCard key={id} id={id} stage={stage}>
            {stage.data && id === 'grammar' && <GrammarStage data={stage.data} />}
            {stage.data && id === 'style' && <StyleStage data={stage.data} />}
            {stage.data && id === 'headline' && (
              <HeadlineStage data={stage.data} onUse={onUseHeadline} />
            )}
            {stage.data && id === 'summary' && (
              <SummaryStage data={stage.data} articleLength={articleText?.length ?? 0} />
            )}
          </StageCard>
        );
      })}

      <p className="text-center text-[11px] text-ink-400 pt-1">
        SinAi can make mistakes. Please double-check responses.
      </p>
    </div>
  );
}
