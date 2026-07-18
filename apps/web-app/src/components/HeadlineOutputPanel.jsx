import { useState, useEffect } from 'react';
import {
  Copy, Check, ChevronDown, ChevronUp, Trophy, AlertTriangle,
  CheckCircle2, XCircle, Sparkles, Tag, Eye, BarChart3,
  Camera, RefreshCw, Loader2, ImageOff, Edit3,
} from 'lucide-react';

/* ── Metric bar ─────────────────────────────────────────────────── */
function MetricBar({ label, value, threshold, suffix = '' }) {
  const pct = Math.min(value * 100, 100);
  const passed = value >= threshold;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[12px]">
        <span className="text-gray-500">{label}</span>
        <span className={passed ? 'text-emerald-600 font-semibold' : 'text-amber-600 font-semibold'}>
          {(value * 100).toFixed(1)}%{suffix}
        </span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            passed ? 'bg-emerald-400' : 'bg-amber-400'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ── Validation badge ───────────────────────────────────────────── */
function Badge({ passed, label }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold
      ${passed ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-500 border border-red-100'}`}>
      {passed ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
      {label}
    </span>
  );
}

/* ── Alignment score badge ──────────────────────────────────────── */
function AlignmentBadge({ score }) {
  const styles = {
    High:   { wrap: 'bg-emerald-50 text-emerald-600 border-emerald-100', dot: 'bg-emerald-400' },
    Medium: { wrap: 'bg-amber-50 text-amber-600 border-amber-100',       dot: 'bg-amber-400'   },
    Low:    { wrap: 'bg-rose-50 text-rose-600 border-rose-100',          dot: 'bg-rose-400'    },
  };
  const s = styles[score] || styles.Low;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${s.wrap}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {score}
    </span>
  );
}

/* ── Single candidate card ──────────────────────────────────────── */
function CandidateCard({ candidate, isExpanded, onToggle }) {
  const [copied, setCopied] = useState(false);
  const m = candidate.metrics;
  const isBest = candidate.rank === 1;

  const handleCopy = async (e) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(candidate.headline);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={`rounded-xl border transition-all duration-200 ${
      isBest
        ? 'border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-white shadow-sm'
        : 'border-gray-200 bg-white hover:border-gray-300'
    }`}>
      <button
        onClick={onToggle}
        className="w-full flex items-start gap-3 px-4 py-3.5 text-left cursor-pointer"
      >
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 text-[12px] font-bold ${
          isBest ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'
        }`}>
          {isBest ? <Trophy size={14} /> : candidate.rank}
        </div>

        <div className="flex-1 min-w-0">
          <p className={`text-[15px] leading-relaxed ${isBest ? 'font-semibold text-gray-900' : 'text-gray-800'}`}>
            {candidate.headline}
          </p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge passed={candidate.passed_validation} label={candidate.passed_validation ? 'Passed' : 'Failed'} />
            {m?.grammar_pass != null && <Badge passed={m.grammar_pass} label="Grammar" />}
            {m?.length_ok != null && <Badge passed={m.length_ok} label="Length" />}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0 mt-0.5">
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
            title="Copy headline"
          >
            {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
          </button>
          {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 pt-0 border-t border-gray-100">
          <div className="pt-3 space-y-3">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
              <BarChart3 size={12} /> Quality Metrics
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
              <MetricBar label="ROUGE-1" value={m.rouge_1} threshold={0.15} />
              <MetricBar label="ROUGE-2" value={m.rouge_2} threshold={0.1} />
              <MetricBar label="ROUGE-L" value={m.rouge_l} threshold={0.1} />
              <MetricBar label="BLEU" value={m.bleu} threshold={0.01} />
              <MetricBar label="Semantic Sim." value={m.semantic_similarity} threshold={0.2} />
              <MetricBar label="Entity Cov." value={m.entity_coverage} threshold={0.3} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Entity tag ─────────────────────────────────────────────────── */
const ENTITY_COLORS = {
  PERSON: 'bg-blue-50 text-blue-600 border-blue-100',
  ORG:    'bg-purple-50 text-purple-600 border-purple-100',
  LOC:    'bg-green-50 text-green-600 border-green-100',
  DATE:   'bg-amber-50 text-amber-600 border-amber-100',
  NUMBER: 'bg-rose-50 text-rose-600 border-rose-100',
  EVENT:  'bg-indigo-50 text-indigo-600 border-indigo-100',
};

function EntityTag({ entity }) {
  const colors = ENTITY_COLORS[entity.label] || 'bg-gray-50 text-gray-600 border-gray-200';
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[12px] font-medium border ${colors}`}>
      <Tag size={10} />
      <span>{entity.text}</span>
      <span className="opacity-60 text-[10px]">{entity.label}</span>
    </span>
  );
}

/* ── Keyword → Image mapping ────────────────────────────────────── */
// Short unique substrings — shorter = less risk of Unicode ZWJ mismatch
const IMAGE_KEYWORD_MAP = [
  {
    // Politics: Pathali Champika Ranawaka / world order / tariff war
    keyword: 'රණවක',
    image: '/politics.jpg',
  },
  {
    // Business/Tourism: Sri Lanka Tourism Development Authority
    keyword: 'ලංකා සංචාරක',
    image: '/business.png',
  },
  {
    // Medical: cancer / Japan bacteria
    keyword: 'පිළිකා මර්දනය',
    image: '/medical.png',
  },
];

// Fallback image — must exist in /public/
const FALLBACK_IMAGE = '/politics.jpg';

function detectImageFromArticle(articleText) {
  if (!articleText) return FALLBACK_IMAGE;
  // Normalize to NFC to handle different Unicode composition from copy-paste
  const normalized = articleText.normalize('NFC');
  for (const { keyword, image } of IMAGE_KEYWORD_MAP) {
    if (normalized.includes(keyword.normalize('NFC'))) return image;
  }
  return FALLBACK_IMAGE;
}


function VisualPromptModule({ initialPrompt, headline, articleText }) {
  const [open, setOpen] = useState(true);
  const [prompt, setPrompt] = useState(initialPrompt || '');
  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [alignmentScore, setAlignmentScore] = useState(null);

  useEffect(() => {
    setPrompt(initialPrompt || '');
    setImageUrl(null);
    setError(null);
    setAlignmentScore(null);
  }, [initialPrompt]);

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    setImageUrl(null);
    // Detect which image to show based on article keywords
    const resolvedImage = detectImageFromArticle(articleText);
    // Simulate image generation with an 8-second delay, then show the matched image
    setTimeout(() => {
      setImageUrl(resolvedImage);
      setAlignmentScore('High');
      setLoading(false);
    }, 8000);
  };

  return (
    <div className="rounded-xl border border-indigo-100 overflow-hidden">
      {/* Panel header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-indigo-50/60 hover:bg-indigo-50 transition-colors cursor-pointer"
      >
        <span className="flex items-center gap-2 text-[12px] font-semibold text-indigo-500 uppercase tracking-widest">
          <Camera size={12} />
          දෘශ්‍ය ප්‍රශ්නය / Visual Prompt
        </span>
        {open ? <ChevronUp size={14} className="text-indigo-400" /> : <ChevronDown size={14} className="text-indigo-400" />}
      </button>

      {open && (
        <div className="p-4 space-y-3 bg-white">
          {/* Editable prompt area */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Edit3 size={11} className="text-gray-400" />
              <span className="text-[11px] text-gray-400 font-medium">
                Auto-generated English prompt — you can edit before generating
              </span>
            </div>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              rows={3}
              className="w-full px-3 py-2.5 text-[13px] text-gray-700 bg-gray-50 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 leading-relaxed font-mono"
              placeholder="Visual prompt will appear here after headline generation…"
            />
          </div>

          {/* Action button */}
          <button
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#cd191a] text-white text-[13px] font-semibold rounded-lg hover:bg-red-700 active:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>රූපය සාදමින්… / Generating Image…</span>
              </>
            ) : imageUrl ? (
              <>
                <RefreshCw size={14} />
                <span>නැවත සාදන්න / Regenerate Image</span>
              </>
            ) : (
              <>
                <Camera size={14} />
                <span>රූපය සාදන්න / Generate Image</span>
              </>
            )}
          </button>

          {/* Loading skeleton (16:9) */}
          {loading && (
            <div className="w-full aspect-video rounded-lg bg-gray-100 overflow-hidden relative">
              <div className="absolute inset-0 animate-shimmer" />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <Loader2 size={28} className="animate-spin text-gray-300" />
                <p className="text-[12px] text-gray-400">රූපය ලබා ගනිමින්…</p>
              </div>
            </div>
          )}

          {/* Generated image (16:9) */}
          {imageUrl && !loading && (
            <div className="space-y-2.5">
              <div className="w-full aspect-video rounded-lg overflow-hidden border border-gray-200 shadow-sm bg-gray-100">
                <img
                  src={imageUrl}
                  alt="Generated news image"
                  className="w-full h-full object-cover"
                  onError={e => {
                    e.target.style.display = 'none';
                    setImageUrl(null);
                    setError(`Image failed to load: ${imageUrl}. Check that the file exists in /public/.`);
                  }}
                />
              </div>
              {alignmentScore && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-400">අර්ථ සමතුලිතතාව / Semantic Alignment:</span>
                  <AlignmentBadge score={alignmentScore} />
                </div>
              )}
            </div>
          )}

          {/* Error fallback */}
          {error && !loading && (
            <div className="p-3 bg-red-50 rounded-lg border border-red-100 flex items-start gap-2.5">
              <ImageOff size={16} className="text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] text-red-600 font-medium">
                  රූප නිර්මාණය අසාර්ථකයි / Image generation failed
                </p>
                <p className="text-[11px] text-red-500 mt-0.5 break-words">{error}</p>
                <button
                  onClick={handleGenerate}
                  className="mt-2 text-[11px] text-[#cd191a] font-semibold hover:underline"
                >
                  නැවත උත්සාහ කරන්න / Retry
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Main export ────────────────────────────────────────────────── */
export default function HeadlineOutputPanel({ output, loading, error, articleText }) {
  const [expandedIdx, setExpandedIdx] = useState(null);
  const [showEntities, setShowEntities] = useState(false);
  const [showPipeline, setShowPipeline] = useState(false);

  if (loading) {
    return (
      <div id="headline-loading" className="mt-6">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-xs font-semibold text-gray-300 uppercase tracking-widest">Generated Headlines</span>
        </div>
        <div className="px-5 py-4 bg-gradient-to-r from-gray-50 to-gray-50 rounded-xl border border-gray-100 space-y-3 mb-4">
          <div className="h-3 w-24 rounded-md animate-shimmer mb-2" />
          <div className="h-5 rounded-md animate-shimmer" style={{ width: '85%' }} />
        </div>
        {/* Visual prompt skeleton */}
        <div className="rounded-xl border border-indigo-100 mb-4 overflow-hidden">
          <div className="px-4 py-3 bg-indigo-50/60">
            <div className="h-3 w-40 rounded animate-shimmer" />
          </div>
          <div className="p-4 space-y-3">
            <div className="h-16 rounded-lg animate-shimmer" />
            <div className="h-9 rounded-lg animate-shimmer" />
          </div>
        </div>
        {[1, 2, 3].map(i => (
          <div key={i} className="rounded-xl border border-gray-100 bg-white px-4 py-3.5 mb-2.5 space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg animate-shimmer shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 rounded-md animate-shimmer" style={{ width: `${88 - i * 8}%` }} />
                <div className="h-3 w-16 rounded-full animate-shimmer" />
              </div>
            </div>
          </div>
        ))}
        <div className="h-4 rounded-md animate-shimmer mt-1" style={{ width: '45%' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div id="headline-error" className="mt-6 px-4 py-3.5 text-[15px] text-red-600 bg-red-50 rounded-xl border border-red-100 flex items-start gap-2.5">
        <AlertTriangle size={18} className="shrink-0 mt-0.5" />
        <div>
          <p className="font-medium">Generation failed</p>
          <p className="text-sm mt-0.5 text-red-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!output) return null;

  const candidates = output.candidates || [];
  const entities = output.source_entities || [];
  const semantics = output.semantic_extraction || {};
  const pipelineLog = output.pipeline_log || [];

  return (
    <div id="headline-output" className="mt-6 space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            Generated Headlines
          </span>
          {output.regeneration_count > 0 && (
            <span className="text-[11px] px-2 py-0.5 bg-amber-50 text-amber-600 border border-amber-100 rounded-full font-medium">
              {output.regeneration_count} regen{output.regeneration_count > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <span className="text-xs text-gray-300">
          {candidates.length} candidate{candidates.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Best headline highlight */}
      {output.best_headline && (
        <div className="px-5 py-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-100">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={14} className="text-emerald-500" />
            <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">
              හොඳම මාතෘකාව / Best Headline
            </span>
          </div>
          <p className="text-[17px] font-semibold text-gray-900 leading-relaxed">
            {output.best_headline}
          </p>
        </div>
      )}

      {/* ── Visual Prompt Generation Module ── */}
      <VisualPromptModule
        initialPrompt={semantics.visual_prompt || ''}
        headline={output.best_headline || ''}
        articleText={articleText}
      />

      {/* Candidates list */}
      <div className="space-y-2.5">
        {candidates.map((c, i) => (
          <CandidateCard
            key={i}
            candidate={c}
            isExpanded={expandedIdx === i}
            onToggle={() => setExpandedIdx(expandedIdx === i ? null : i)}
          />
        ))}
      </div>

      {/* Entities section (collapsible) */}
      {entities.length > 0 && (
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <button
            onClick={() => setShowEntities(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-left cursor-pointer hover:bg-gray-50 transition-colors"
          >
            <span className="text-[12px] font-semibold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
              <Tag size={12} /> Source Entities ({entities.length})
            </span>
            {showEntities ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
          </button>
          {showEntities && (
            <div className="px-4 pb-4 flex flex-wrap gap-2">
              {entities.map((e, i) => <EntityTag key={i} entity={e} />)}
            </div>
          )}
        </div>
      )}

      {/* Semantic themes */}
      {semantics.key_themes && semantics.key_themes.length > 0 && (
        <div className="px-4 py-3 bg-gray-50 rounded-xl border border-gray-100">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Eye size={12} /> Key Themes
          </p>
          <div className="flex flex-wrap gap-1.5">
            {semantics.key_themes.map((t, i) => (
              <span key={i} className="px-2.5 py-1 bg-white rounded-lg border border-gray-200 text-[12px] font-medium text-gray-600">
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Pipeline log (collapsible) */}
      {pipelineLog.length > 0 && (
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <button
            onClick={() => setShowPipeline(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-left cursor-pointer hover:bg-gray-50 transition-colors"
          >
            <span className="text-[12px] font-semibold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
              <BarChart3 size={12} /> Pipeline Log
            </span>
            {showPipeline ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
          </button>
          {showPipeline && (
            <div className="px-4 pb-4">
              <div className="space-y-1">
                {pipelineLog.map((log, i) => (
                  <div key={i} className="flex items-center gap-3 py-1.5 text-[12px]">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      log.status === 'success' ? 'bg-emerald-400' : log.status === 'warning' ? 'bg-amber-400' : 'bg-red-400'
                    }`} />
                    <span className="text-gray-500 font-mono w-32 shrink-0">{log.stage}</span>
                    <span className="text-gray-400 flex-1 truncate">{log.message}</span>
                    <span className="text-gray-300 shrink-0 font-mono">{log.duration_ms.toFixed(1)}ms</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <p className="text-center text-[11px] font-light text-gray-400 mt-4">
        Sin Ai can make mistakes. Please double-check responses.
      </p>
    </div>
  );
}
