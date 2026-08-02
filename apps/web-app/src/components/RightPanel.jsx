import {
  CheckCircle2, Lightbulb, BookOpen, BarChart3, Tag, Sparkles,
  ShieldCheck, Layers, PenLine, FileText, Newspaper, AlertTriangle,
} from 'lucide-react';
import { RightPanelCard } from './ui/Card';
import { OptionCards, OptionChips } from './ui/Options';
import EmptyState from './ui/EmptyState';
import { Skeleton } from './ui/Skeleton';

// ─── Option definitions ──────────────────────────────────────────────────────

const TONES = [
  { id: 'formal', label: 'Formal', desc: 'Broadsheet news desk voice' },
  { id: 'editorial', label: 'Editorial', desc: 'Analytical opinion writing' },
  { id: 'sports', label: 'Sports', desc: 'Fast, energetic sports desk' },
  { id: 'feature', label: 'Feature', desc: 'Narrative long-form style' },
  { id: 'youth', label: 'Youth', desc: 'Casual, social-media friendly' },
];

const LENGTHS = [
  { id: 'short', label: 'Short', desc: 'Brief summary (~10% length)' },
  { id: 'medium', label: 'Medium', desc: 'Standard summary (~20% length)' },
  { id: 'long', label: 'Long', desc: 'Detailed summary (~35% length)' },
];

const SUMMARY_VIEWS = [
  { id: 'paragraph', label: 'Paragraph' },
  { id: 'bullets', label: 'Bullets' },
];

const HEADLINE_STYLES = [
  { id: 'formal', label: 'Formal', desc: 'Authoritative broadsheet tone' },
  { id: 'breaking_news', label: 'Breaking News', desc: 'Urgent, attention-grabbing' },
  { id: 'youth', label: 'Youth', desc: 'Casual, social-media friendly' },
  { id: 'editorial', label: 'Editorial', desc: 'Analytical, thought-provoking' },
];

const HEADLINE_COUNTS = [
  { id: 3, label: '3' },
  { id: 5, label: '5' },
  { id: 7, label: '7' },
];

// Word bands, mirroring HEADLINE_LENGTHS in the backend's app/core/prompts.py.
// Non-overlapping, so a headline's word count maps to exactly one band.
const HEADLINE_LENGTHS_OPTIONS = [
  { id: 'short', label: 'Short', words: '3–5 words' },
  { id: 'medium', label: 'Medium', words: '6–7 words' },
  { id: 'long', label: 'Long', words: '8–10 words' },
];

const HEADLINE_CATEGORIES = [
  { id: 'General', label: 'General' },
  { id: 'Politics', label: 'Politics' },
  { id: 'Business', label: 'Business' },
  { id: 'Sports', label: 'Sports' },
  { id: 'Entertainment', label: 'Entertainment' },
  { id: 'Tech', label: 'Tech' },
  { id: 'World', label: 'World' },
];


// ─── Grammar analysis ────────────────────────────────────────────────────────

const RULE_META = {
  spelling: { label: 'Spelling', dot: 'bg-brand-400', bar: 'bg-brand-400' },
  grammar: { label: 'Grammar', dot: 'bg-orange-400', bar: 'bg-orange-400' },
  word_order: { label: 'Word Order', dot: 'bg-purple-400', bar: 'bg-purple-400' },
  punctuation: { label: 'Punctuation', dot: 'bg-amber-400', bar: 'bg-amber-400' },
  agreement: { label: 'Agreement', dot: 'bg-blue-400', bar: 'bg-blue-400' },
  style: { label: 'Style', dot: 'bg-teal-400', bar: 'bg-teal-400' },
};

function resolveRule(rule = '') {
  const lower = rule.toLowerCase();
  if (lower.includes('spell')) return RULE_META.spelling;
  if (lower.includes('word_order') || lower.includes('order')) return RULE_META.word_order;
  if (lower.includes('punct')) return RULE_META.punctuation;
  if (lower.includes('agreement') || lower.includes('concord')) return RULE_META.agreement;
  if (lower.includes('style')) return RULE_META.style;
  return RULE_META.grammar;
}

function GrammarAnalysisPanel({ output, loading }) {
  const corrections = output?.corrections ?? [];
  const corrCount = output?.correction_count ?? corrections.length;
  const isPerfect = output && corrCount === 0;
  const hasOutput = Boolean(output);

  const breakdown = {};
  corrections.forEach((c) => {
    const meta = resolveRule(c.rule);
    breakdown[meta.label] = breakdown[meta.label] || { count: 0, meta };
    breakdown[meta.label].count += 1;
  });
  const breakdownEntries = Object.entries(breakdown);

  return (
    <RightPanelCard
      icon={ShieldCheck}
      title="Grammar analysis"
      aside={
        hasOutput && corrCount > 0 && (
          <span className="text-[10.5px] font-bold text-amber-700 bg-amber-50 border border-amber-200/70 rounded-full px-2 py-0.5 tabular-nums">
            {corrCount} issue{corrCount !== 1 ? 's' : ''}
          </span>
        )
      }
    >
      {loading && (
        <div className="space-y-2">
          {[1, 2, 3].map((n) => <Skeleton key={n} className="h-13 rounded-xl" />)}
        </div>
      )}

      {!loading && !hasOutput && (
        <EmptyState
          icon={BookOpen}
          title="No analysis yet"
          description="Paste Sinhala text and press Correct to see issues broken down here."
          className="py-6"
        />
      )}

      {!loading && isPerfect && (
        <div className="flex flex-col items-center gap-2 py-5 px-4 rounded-xl bg-emerald-50 border border-emerald-200/60 text-center">
          <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center">
            <CheckCircle2 size={18} className="text-emerald-600" />
          </div>
          <p className="text-[13px] font-semibold text-emerald-800">Text is grammatically correct</p>
          <p className="text-[11px] text-emerald-700/70 leading-relaxed">
            No spelling, grammar, or style issues found.
          </p>
        </div>
      )}

      {!loading && hasOutput && corrCount > 0 && (
        <div className="space-y-4">
          {/* Category breakdown */}
          {breakdownEntries.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-ink-500 uppercase tracking-[0.12em] mb-2 flex items-center gap-1.5">
                <Layers size={10} /> By category
              </p>
              <div className="space-y-1.5">
                {breakdownEntries.map(([label, { count, meta }]) => (
                  <div key={label} className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${meta.dot}`} />
                    <span className="text-[11.5px] text-ink-600 flex-1">{label}</span>
                    <div className="w-20 h-1.5 bg-ink-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${meta.bar} transition-all duration-500`}
                        style={{ width: `${Math.round((count / corrCount) * 100)}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-semibold text-ink-600 w-3 text-right tabular-nums">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Individual corrections */}
          <div>
            <p className="text-[10px] font-bold text-ink-500 uppercase tracking-[0.12em] mb-2">
              Corrections applied
            </p>
            <div className="space-y-1.5">
              {corrections.map((c, i) => {
                const meta = resolveRule(c.rule);
                return (
                  <div
                    key={i}
                    className="flex items-start gap-2.5 px-3 py-2.5 bg-ink-50/70 border border-ink-100 rounded-xl
                      hover:border-ink-200 transition-colors duration-150"
                  >
                    <div className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${meta.dot}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[12px] text-ink-400 line-through decoration-brand-300">{c.original}</span>
                        <span className="text-ink-300 text-[10px]">→</span>
                        <span className="text-[12px] font-semibold text-ink-800">{c.corrected}</span>
                      </div>
                      <p className="text-[10px] text-ink-500 mt-0.5 uppercase tracking-wide">
                        {meta.label}{c.rule ? ` · ${c.rule.replace(/_/g, ' ')}` : ''}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </RightPanelCard>
  );
}

// ─── Headline insights ───────────────────────────────────────────────────────

function HeadlineInsightsPanel({ output, loading }) {
  if (loading) {
    return (
      <RightPanelCard icon={BarChart3} title="Pipeline insights">
        <div className="space-y-2">
          {[1, 2, 3].map((n) => <Skeleton key={n} className="h-13 rounded-xl" />)}
        </div>
      </RightPanelCard>
    );
  }

  const candidates = output.candidates || [];
  const passed = candidates.filter((c) => c.passed_validation).length;
  const entities = output.source_entities || [];
  const pipelineLog = output.pipeline_log || [];
  const totalTime = pipelineLog.reduce((sum, l) => sum + l.duration_ms, 0);

  const best = candidates[0];
  const bestMetrics = best?.metrics ?? {};
  const hasRealMetrics = Object.values(bestMetrics).some((v) => typeof v === 'number' && v > 0);

  return (
    <RightPanelCard icon={BarChart3} title="Pipeline insights">
      <div className="space-y-4">
        {/* Summary stats */}
        <div className="grid grid-cols-2 gap-2">
          <div className="px-3 py-2.5 bg-ink-50 rounded-xl text-center">
            <p className="text-[17px] font-bold text-ink-800 tabular-nums">{candidates.length}</p>
            <p className="text-[9.5px] text-ink-500 uppercase tracking-wider font-semibold">Candidates</p>
          </div>
          <div className="px-3 py-2.5 bg-emerald-50 rounded-xl text-center">
            <p className="text-[17px] font-bold text-emerald-700 tabular-nums">{passed}</p>
            <p className="text-[9.5px] text-ink-500 uppercase tracking-wider font-semibold">Passed</p>
          </div>
          {entities.length > 0 && (
            <div className="px-3 py-2.5 bg-blue-50 rounded-xl text-center">
              <p className="text-[17px] font-bold text-blue-700 tabular-nums">{entities.length}</p>
              <p className="text-[9.5px] text-ink-500 uppercase tracking-wider font-semibold">Entities</p>
            </div>
          )}
          {totalTime > 0 && (
            <div className="px-3 py-2.5 bg-amber-50 rounded-xl text-center">
              <p className="text-[17px] font-bold text-amber-700 tabular-nums">
                {totalTime.toFixed(0)}<span className="text-[11px] font-medium">ms</span>
              </p>
              <p className="text-[9.5px] text-ink-500 uppercase tracking-wider font-semibold">Total time</p>
            </div>
          )}
        </div>

        {/* Regeneration warning */}
        {output.regeneration_count > 0 && (
          <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 rounded-xl border border-amber-200/70">
            <AlertTriangle size={13} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-[11.5px] text-amber-800 leading-relaxed">
              Pipeline triggered <strong>{output.regeneration_count}</strong> regeneration{output.regeneration_count > 1 ? 's' : ''} to meet quality thresholds.
            </p>
          </div>
        )}

        {/* Best candidate metrics — only when the backend returned real scores */}
        {hasRealMetrics && (
          <div>
            <p className="text-[10px] font-bold text-ink-500 uppercase tracking-[0.12em] mb-2.5 flex items-center gap-1.5">
              <Sparkles size={10} /> Best headline metrics
            </p>
            <div className="space-y-2">
              {[
                ['ROUGE-1', bestMetrics.rouge_1],
                ['ROUGE-2', bestMetrics.rouge_2],
                ['Semantic sim.', bestMetrics.semantic_similarity],
                ['Entity cov.', bestMetrics.entity_coverage],
              ].map(([label, val]) => (
                <div key={label} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-ink-500">{label}</span>
                    <span className="text-ink-700 font-semibold tabular-nums">{(val * 100).toFixed(1)}%</span>
                  </div>
                  <div className="h-1 bg-ink-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-500/80 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(val * 100, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Entity distribution */}
        {entities.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-ink-500 uppercase tracking-[0.12em] mb-2 flex items-center gap-1.5">
              <Tag size={10} /> Entity types
            </p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(
                entities.reduce((acc, e) => {
                  acc[e.label] = (acc[e.label] || 0) + 1;
                  return acc;
                }, {})
              ).map(([label, count]) => (
                <span
                  key={label}
                  className="px-2.5 py-1 bg-ink-50 rounded-lg border border-ink-200 text-[11px] font-medium text-ink-600"
                >
                  {label} <span className="text-ink-400 tabular-nums">×{count}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </RightPanelCard>
  );
}

// ─── Tip note ────────────────────────────────────────────────────────────────

function TipNote({ children }) {
  return (
    <div className="flex items-start gap-2 px-3.5 py-3 bg-white rounded-xl border border-ink-200/70">
      <Lightbulb size={13} className="text-amber-400 shrink-0 mt-0.5" />
      <p className="text-[11.5px] text-ink-500 leading-relaxed">{children}</p>
    </div>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

export default function RightPanel({ activeTool, settings, onSettingsChange, output, loading }) {
  if (!['grammar', 'rewriter', 'summarizer', 'headlines'].includes(activeTool)) return null;

  if (activeTool === 'grammar') {
    return (
      <>
        <GrammarAnalysisPanel output={output} loading={loading} />
        {output && !loading && (
          <TipNote>
            Always review corrections in context — language models may not capture every nuance.
          </TipNote>
        )}
      </>
    );
  }

  if (activeTool === 'rewriter') {
    return (
      <>
        <RightPanelCard icon={PenLine} title="Style controls">
          <OptionCards
            label="Tone"
            options={TONES}
            value={settings.tone}
            onChange={(v) => onSettingsChange({ ...settings, tone: v })}
          />
        </RightPanelCard>
        <TipNote>
          The rewriter preserves facts and names while shifting register — pick the desk you're writing for.
        </TipNote>
      </>
    );
  }

  if (activeTool === 'summarizer') {
    return (
      <>
        <RightPanelCard icon={FileText} title="Summary options">
          <OptionCards
            label="Length"
            options={LENGTHS}
            value={settings.length}
            onChange={(v) => onSettingsChange({ ...settings, length: v })}
          />
          <OptionChips
            label="Display as"
            columns={2}
            options={SUMMARY_VIEWS}
            value={settings.summaryView}
            onChange={(v) => onSettingsChange({ ...settings, summaryView: v })}
          />
        </RightPanelCard>
        <TipNote>
          Bullet view splits the summary into sentences — useful for broadcast rundowns and social posts.
        </TipNote>
      </>
    );
  }

  // headlines
  return (
    <>
      {!output && !loading ? (
        <RightPanelCard icon={Newspaper} title="Headline controls">
          <OptionChips
            label="Max length"
            options={HEADLINE_LENGTHS_OPTIONS}
            value={settings.headlineLength}
            onChange={(v) => onSettingsChange({ ...settings, headlineLength: v })}
          />
          <p className="-mt-3.5 text-[11px] text-ink-500">
            {HEADLINE_LENGTHS_OPTIONS.find((o) => o.id === settings.headlineLength)?.words}
          </p>
        </RightPanelCard>
      ) : (
        <HeadlineInsightsPanel output={output} loading={loading} />
      )}
      <TipNote>
        Generate several candidates, then copy the one that best matches your section's voice.
      </TipNote>
    </>
  );
}
