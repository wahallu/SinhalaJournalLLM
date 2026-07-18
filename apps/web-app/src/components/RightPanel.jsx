import {
  CheckCircle2, Lightbulb, BookOpen,
  Newspaper, BarChart3, Tag, Sparkles, ShieldCheck, Layers
} from 'lucide-react';

// ─── Settings Panels ─────────────────────────────────────────────────────────

const TONES = [
  { id: 'formal',    label: 'Formal'    },
  { id: 'editorial', label: 'Editorial' },
  { id: 'sports',    label: 'Sports'    },
  { id: 'feature',   label: 'Feature'   },
  { id: 'youth',     label: 'Youth'     },
];

const LENGTHS = [
  { id: 'short',  label: 'Short'  },
  { id: 'medium', label: 'Medium' },
];

const HEADLINE_STYLES = [
  { id: 'formal',        label: 'Formal',        desc: 'Authoritative, broadsheet tone' },
  { id: 'breaking_news', label: 'Breaking News', desc: 'Urgent, attention-grabbing' },
  { id: 'youth',         label: 'Youth',         desc: 'Casual, social media friendly' },
  { id: 'editorial',     label: 'Editorial',     desc: 'Analytical, thought-provoking' },
];

const HEADLINE_COUNTS = [
  { id: 3, label: '3 Headlines' },
  { id: 5, label: '5 Headlines' },
  { id: 7, label: '7 Headlines' },
];

const MAX_LENGTHS = [
  { id: 60,  label: 'Short (60 chars)' },
  { id: 80,  label: 'Medium (80 chars)' },
  { id: 120, label: 'Long (120 chars)' },
];

function OptionGroup({ label, options, value, onChange }) {
  return (
    <div className="mb-6">
      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
        {label}
      </label>
      <div className="space-y-1">
        {options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            className={`
              w-full text-left px-3.5 py-2.5 rounded-lg text-[14px] font-medium
              transition-colors duration-100 cursor-pointer
              ${value === opt.id
                ? 'bg-red-50 text-accent'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }
            `}
          >
            <span>{opt.label}</span>
            {opt.desc && (
              <span className={`block text-[11px] mt-0.5 ${
                value === opt.id ? 'text-red-400' : 'text-gray-400'
              }`}>
                {opt.desc}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Grammar Suggestions Panel ────────────────────────────────────────────────

const RULE_META = {
  spelling:    { label: 'Spelling',    dot: 'bg-red-400',    badge: 'bg-red-50 text-red-700 border-red-100',    bar: 'bg-red-400'    },
  grammar:     { label: 'Grammar',     dot: 'bg-orange-400', badge: 'bg-orange-50 text-orange-700 border-orange-100', bar: 'bg-orange-400' },
  word_order:  { label: 'Word Order',  dot: 'bg-purple-400', badge: 'bg-purple-50 text-purple-700 border-purple-100', bar: 'bg-purple-400' },
  punctuation: { label: 'Punctuation', dot: 'bg-yellow-400', badge: 'bg-yellow-50 text-yellow-700 border-yellow-100', bar: 'bg-yellow-400' },
  agreement:   { label: 'Agreement',   dot: 'bg-blue-400',   badge: 'bg-blue-50 text-blue-700 border-blue-100',   bar: 'bg-blue-400'   },
  style:       { label: 'Style',       dot: 'bg-teal-400',   badge: 'bg-teal-50 text-teal-700 border-teal-100',   bar: 'bg-teal-400'   },
};

function resolveRule(rule = '') {
  const lower = rule.toLowerCase();
  if (lower.includes('spell'))                        return RULE_META.spelling;
  if (lower.includes('word_order') || lower.includes('order')) return RULE_META.word_order;
  if (lower.includes('punct'))                        return RULE_META.punctuation;
  if (lower.includes('agreement') || lower.includes('concord')) return RULE_META.agreement;
  if (lower.includes('style'))                        return RULE_META.style;
  return RULE_META.grammar;
}

function GrammarSuggestionsPanel({ output, loading, input }) {
  const corrections   = output?.corrections ?? [];
  const corrCount     = output?.correction_count ?? corrections.length;
  const isPerfect     = output && corrCount === 0;
  const hasOutput     = Boolean(output);

  // Build category breakdown
  const breakdown = {};
  corrections.forEach((c) => {
    const meta = resolveRule(c.rule);
    const key  = meta.label;
    breakdown[key] = (breakdown[key] || { count: 0, meta }) ;
    breakdown[key].count += 1;
  });
  const breakdownEntries = Object.entries(breakdown);

  return (
    <div className="space-y-4">
      <h2 className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
        Grammar Analysis
      </h2>

      {/* ── Loading skeletons ── */}
      {loading && (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-14 bg-gray-100 rounded-xl animate-subtle-pulse" />
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && !hasOutput && (
        <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center">
            <BookOpen size={18} className="text-gray-300" />
          </div>
          <div>
            <p className="text-[13px] font-medium text-gray-500">No analysis yet</p>
            <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">
              Paste Sinhala text and press Correct.
            </p>
          </div>
        </div>
      )}

      {/* ── Perfect score card ── */}
      {!loading && isPerfect && (
        <div className="flex flex-col items-center gap-2 py-6 px-4 rounded-xl bg-emerald-50 border border-emerald-100">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
            <CheckCircle2 size={20} className="text-emerald-500" />
          </div>
          <p className="text-[13px] font-semibold text-emerald-700">Text is grammatically correct</p>
          <p className="text-[11px] text-emerald-600/70 text-center leading-relaxed">
            No spelling, grammar, or style issues found.
          </p>
        </div>
      )}

      {/* ── Results ── */}
      {!loading && hasOutput && corrCount > 0 && (
        <>
          {/* Summary stat */}
          <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-gray-50 border border-gray-100">
            <div>
              <p className="text-[22px] font-bold text-gray-800 leading-none">{corrCount}</p>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mt-0.5">
                Issue{corrCount !== 1 ? 's' : ''} Found
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center">
              <ShieldCheck size={18} className="text-amber-500" />
            </div>
          </div>

          {/* Category breakdown */}
          {breakdownEntries.length > 1 && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Layers size={10} /> By Category
              </p>
              <div className="space-y-1.5">
                {breakdownEntries.map(([label, { count, meta }]) => (
                  <div key={label} className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${meta.dot}`} />
                    <span className="text-[11px] text-gray-600 flex-1">{label}</span>
                    <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${meta.bar} transition-all duration-500`}
                        style={{ width: `${Math.round((count / corrCount) * 100)}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-semibold text-gray-500 w-3 text-right">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Individual correction cards */}
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
              Corrections Applied
            </p>
            <div className="space-y-1.5">
              {corrections.map((c, i) => {
                const meta = resolveRule(c.rule);
                return (
                  <div
                    key={i}
                    className="flex items-start gap-2.5 px-3 py-2.5 bg-white border border-gray-100 rounded-xl hover:border-gray-200 hover:shadow-sm transition-all duration-150"
                  >
                    <div className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${meta.dot}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[12px] text-gray-400 line-through">{c.original}</span>
                        <span className="text-gray-300 text-[10px]">→</span>
                        <span className="text-[12px] font-semibold text-gray-800">{c.corrected}</span>
                      </div>
                      {c.rule && (
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {c.rule.replace(/_/g, ' ')}
                        </p>
                      )}
                    </div>
                    <span className={`shrink-0 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full border ${meta.badge}`}>
                      {meta.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* ── Contextual tip ── */}
      {!loading && hasOutput && (
        <div className="flex items-start gap-2 px-3 py-2.5 bg-gray-50 rounded-xl border border-gray-100">
          <Lightbulb size={12} className="text-gray-300 shrink-0 mt-0.5" />
          <p className="text-[11px] text-gray-400 leading-relaxed">
            Always review corrections in context — language models may not capture every nuance.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Headline Insights Panel ──────────────────────────────────────────────────

function HeadlineInsightsPanel({ output, loading }) {
  if (loading) {
    return (
      <>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
          Pipeline Insights
        </h2>
        <div className="flex flex-col gap-2.5">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-14 bg-gray-100 rounded-2xl animate-subtle-pulse" />
          ))}
        </div>
      </>
    );
  }

  if (!output) {
    return (
      <>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
          Pipeline Insights
        </h2>
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Newspaper size={30} className="text-gray-200 mb-3" />
          <p className="text-sm text-gray-400 leading-relaxed">
            Generate headlines to see pipeline insights here.
          </p>
        </div>
      </>
    );
  }

  const candidates = output.candidates || [];
  const passed = candidates.filter(c => c.passed_validation).length;
  const entities = output.source_entities || [];
  const semantics = output.semantic_extraction || {};
  const pipelineLog = output.pipeline_log || [];
  const totalTime = pipelineLog.reduce((sum, l) => sum + l.duration_ms, 0);

  return (
    <div className="space-y-5">
      {/* Summary stats */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
          <BarChart3 size={12} /> Pipeline Summary
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <div className="px-3 py-2.5 bg-gray-50 rounded-xl text-center">
            <p className="text-lg font-bold text-gray-800">{candidates.length}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">Candidates</p>
          </div>
          <div className="px-3 py-2.5 bg-emerald-50 rounded-xl text-center">
            <p className="text-lg font-bold text-emerald-600">{passed}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">Passed</p>
          </div>
          <div className="px-3 py-2.5 bg-blue-50 rounded-xl text-center">
            <p className="text-lg font-bold text-blue-600">{entities.length}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">Entities</p>
          </div>
          <div className="px-3 py-2.5 bg-amber-50 rounded-xl text-center">
            <p className="text-lg font-bold text-amber-600">{totalTime.toFixed(0)}<span className="text-xs font-normal">ms</span></p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">Total Time</p>
          </div>
        </div>
      </div>

      {/* Regeneration warning */}
      {output.regeneration_count > 0 && (
        <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 rounded-xl border border-amber-100">
          <AlertCircle size={14} className="text-amber-500 shrink-0 mt-0.5" />
          <p className="text-[12px] text-amber-700">
            Pipeline triggered <strong>{output.regeneration_count}</strong> regeneration{output.regeneration_count > 1 ? 's' : ''} to meet quality thresholds.
          </p>
        </div>
      )}

      {/* Top candidate metrics */}
      {candidates.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <Sparkles size={12} /> Best Headline Metrics
          </h2>
          {(() => {
            const best = candidates[0];
            const m = best.metrics;
            return (
              <div className="space-y-2">
                {[
                  ['ROUGE-1',       m.rouge_1],
                  ['ROUGE-2',       m.rouge_2],
                  ['Semantic Sim.', m.semantic_similarity],
                  ['Entity Cov.',   m.entity_coverage],
                ].map(([label, val]) => (
                  <div key={label} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-gray-500">{label}</span>
                      <span className="text-gray-600 font-semibold">{(val * 100).toFixed(1)}%</span>
                    </div>
                    <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent/70 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(val * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* Entity distribution */}
      {entities.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <Tag size={12} /> Entity Types
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(
              entities.reduce((acc, e) => {
                acc[e.label] = (acc[e.label] || 0) + 1;
                return acc;
              }, {})
            ).map(([label, count]) => (
              <span
                key={label}
                className="px-2.5 py-1 bg-gray-50 rounded-lg border border-gray-200 text-[11px] font-medium text-gray-600"
              >
                {label} <span className="text-gray-400">×{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tip */}
      <div className="flex items-start gap-2 px-3 py-3 bg-gray-50 rounded-2xl border border-gray-100">
        <Lightbulb size={14} className="text-gray-300 shrink-0 mt-0.5" />
        <p className="text-[12px] text-gray-400 leading-relaxed">
          Click on any headline candidate to expand its detailed quality metrics.
        </p>
      </div>
    </div>
  );
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export default function RightPanel({ activeTool, settings, onSettingsChange, output, loading, input }) {
  if (!['grammar', 'rewriter', 'summarizer', 'headlines'].includes(activeTool)) return null;

  const getThemeColor = () => {
    switch (activeTool) {
      case 'grammar': return 'bg-[#cd191a]';
      case 'rewriter': return 'bg-[#cd191a]';
      case 'summarizer': return 'bg-[#cd191a]';
      case 'headlines': return 'bg-[#cd191a]';
      default: return 'bg-[#cd191a]';
    }
  };

  const getTitle = () => {
    switch (activeTool) {
      case 'grammar': return 'Grammar Suggestions';
      case 'rewriter': return 'Style Settings';
      case 'summarizer': return 'Summarizer Options';
      case 'headlines': return 'Headline Insights';
      default: return 'Settings';
    }
  };

  return (
    <aside className="hidden xl:flex flex-col w-96 shrink-0 pr-8 py-8 pl-4">
      {/* Banner */}
      <div className="rounded-2xl bg-white shadow-xl overflow-hidden flex flex-col h-full border border-gray-100">
        <div className={`h-32 ${getThemeColor()} flex items-end justify-center pb-4 relative overflow-hidden shrink-0`}>
          {/* subtle background pattern in banner */}
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '16px 16px' }} />
          <h2 className="text-xl font-bold text-white relative z-10">{getTitle()}</h2>
        </div>

        <div className="p-5 flex-1 overflow-y-auto bg-gray-50/50">
          {activeTool === 'grammar' && (
            <GrammarSuggestionsPanel output={output} loading={loading} input={input} />
          )}

          {activeTool === 'rewriter' && (
            <OptionGroup
              label="Tone"
              options={TONES}
              value={settings.tone}
              onChange={(v) => onSettingsChange({ ...settings, tone: v })}
            />
          )}

          {activeTool === 'summarizer' && (
            <OptionGroup
              label="Length"
              options={LENGTHS}
              value={settings.length}
              onChange={(v) => onSettingsChange({ ...settings, length: v })}
            />
          )}

          {activeTool === 'headlines' && (
            <>
              {/* Settings section — shown when no output yet */}
              {!output && !loading && (
                <>
                  <OptionGroup
                    label="Style"
                    options={HEADLINE_STYLES}
                    value={settings.headlineStyle}
                    onChange={(v) => onSettingsChange({ ...settings, headlineStyle: v })}
                  />
                  <OptionGroup
                    label="Max Length"
                    options={MAX_LENGTHS}
                    value={settings.headlineMaxLength}
                    onChange={(v) => onSettingsChange({ ...settings, headlineMaxLength: v })}
                  />
                  <OptionGroup
                    label="Count"
                    options={HEADLINE_COUNTS}
                    value={settings.count}
                    onChange={(v) => onSettingsChange({ ...settings, count: v })}
                  />
                </>
              )}

              {/* Insights panel — shown when loading or output exists */}
              {(loading || output) && (
                <HeadlineInsightsPanel output={output} loading={loading} />
              )}
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
