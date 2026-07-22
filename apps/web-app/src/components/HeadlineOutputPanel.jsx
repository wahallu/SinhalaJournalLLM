import { useState, useEffect } from 'react';
import {
  ChevronDown, ChevronUp, Trophy, AlertTriangle,
  CheckCircle2, XCircle, Sparkles, Tag, Eye, BarChart3,
  Camera, RefreshCw, Loader2, ImageOff, Edit3, FileSearch,
  Wand2, Download, ExternalLink, ImageIcon,
} from 'lucide-react';
import { Card } from './ui/Card';
import CopyButton from './ui/CopyButton';
import ActionButton from './ui/ActionButton';
import { Skeleton } from './ui/Skeleton';
import { generateVisualPrompt, generateImage } from '../services/api';

/* ── Metric bar ─────────────────────────────────────────────────── */
function MetricBar({ label, value, threshold }) {
  const pct = Math.min(value * 100, 100);
  const passed = value >= threshold;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[12px]">
        <span className="text-ink-500">{label}</span>
        <span className={`font-semibold tabular-nums ${passed ? 'text-emerald-600' : 'text-amber-600'}`}>
          {(value * 100).toFixed(1)}%
        </span>
      </div>
      <div className="h-1.5 bg-ink-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${passed ? 'bg-emerald-400' : 'bg-amber-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ── Validation badge ───────────────────────────────────────────── */
function Badge({ passed, label }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold border
      ${passed
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200/70'
        : 'bg-brand-50 text-brand-700 border-brand-200/70'}`}>
      {passed ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
      {label}
    </span>
  );
}

/* ── Single candidate card ──────────────────────────────────────── */
function CandidateCard({ candidate, isExpanded, onToggle }) {
  const m = candidate.metrics ?? {};
  const isBest = candidate.rank === 1;
  // The backend currently returns zeroed metrics — only offer the
  // detailed breakdown when real scores are present.
  const hasRealMetrics = Object.values(m).some((v) => typeof v === 'number' && v > 0);

  return (
    <Card className={`transition-all duration-200 ${isBest ? 'border-emerald-200/80' : 'hover:border-ink-300'}`}>
      <div
        role={hasRealMetrics ? 'button' : undefined}
        onClick={hasRealMetrics ? onToggle : undefined}
        className={`w-full flex items-start gap-3 px-4 py-3.5 text-left ${hasRealMetrics ? 'cursor-pointer' : ''}`}
      >
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 text-[12px] font-bold tabular-nums
          ${isBest ? 'bg-emerald-100 text-emerald-700' : 'bg-ink-100 text-ink-500'}`}>
          {isBest ? <Trophy size={13} /> : candidate.rank}
        </div>

        <div className="flex-1 min-w-0">
          <p className={`text-[15px] leading-relaxed ${isBest ? 'font-semibold text-ink-900' : 'text-ink-800'}`}>
            {candidate.headline}
          </p>
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <Badge passed={candidate.passed_validation} label={candidate.passed_validation ? 'Passed' : 'Failed'} />
            {m?.grammar_pass != null && <Badge passed={m.grammar_pass} label="Grammar" />}
            {m?.length_ok != null && <Badge passed={m.length_ok} label="Length" />}
          </div>
        </div>

        <div className="flex items-center gap-0.5 shrink-0 mt-0.5">
          <CopyButton text={candidate.headline} label="" className="!px-1.5" />
          {hasRealMetrics && (
            isExpanded
              ? <ChevronUp size={15} className="text-ink-400" />
              : <ChevronDown size={15} className="text-ink-400" />
          )}
        </div>
      </div>

      {isExpanded && hasRealMetrics && (
        <div className="px-4 pb-4 border-t border-ink-100">
          <div className="pt-3 space-y-3">
            <p className="text-[10.5px] font-bold text-ink-500 uppercase tracking-[0.12em] flex items-center gap-1.5">
              <BarChart3 size={11} /> Quality metrics
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
              <MetricBar label="ROUGE-1" value={m.rouge_1} threshold={0.15} />
              <MetricBar label="ROUGE-2" value={m.rouge_2} threshold={0.1} />
              <MetricBar label="ROUGE-L" value={m.rouge_l} threshold={0.1} />
              <MetricBar label="BLEU" value={m.bleu} threshold={0.01} />
              <MetricBar label="Semantic sim." value={m.semantic_similarity} threshold={0.2} />
              <MetricBar label="Entity cov." value={m.entity_coverage} threshold={0.3} />
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

/* ── Entity tag ─────────────────────────────────────────────────── */
const ENTITY_COLORS = {
  PERSON: 'bg-blue-50 text-blue-700 border-blue-200/70',
  ORG: 'bg-purple-50 text-purple-700 border-purple-200/70',
  LOC: 'bg-emerald-50 text-emerald-700 border-emerald-200/70',
  DATE: 'bg-amber-50 text-amber-700 border-amber-200/70',
  NUMBER: 'bg-rose-50 text-rose-700 border-rose-200/70',
  EVENT: 'bg-indigo-50 text-indigo-700 border-indigo-200/70',
};

function EntityTag({ entity }) {
  const colors = ENTITY_COLORS[entity.label] || 'bg-ink-50 text-ink-600 border-ink-200';
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[12px] font-medium border ${colors}`}>
      <Tag size={10} />
      <span>{entity.text}</span>
      <span className="opacity-60 text-[10px]">{entity.label}</span>
    </span>
  );
}

/* ── Visual prompt module ───────────────────────────────────────── */
function VisualPromptModule({ headline, articleText }) {
  const [open, setOpen] = useState(true);

  // Visual prompt state
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Image generation state
  const [imageData, setImageData] = useState(null);   // base64 data URL
  const [imgLoading, setImgLoading] = useState(false);
  const [imgError, setImgError] = useState(null);

  const generate = (cancelledRef) => {
    if (!articleText) return;
    setLoading(true);
    setError(null);
    setPrompt('');
    // Clear previous image when regenerating the prompt
    setImageData(null);
    setImgError(null);
    generateVisualPrompt(articleText, headline)
      .then((res) => { if (!cancelledRef?.cancelled) setPrompt(res.visual_prompt || ''); })
      .catch((err) => { if (!cancelledRef?.cancelled) setError(err.message || 'Failed to generate visual prompt'); })
      .finally(() => { if (!cancelledRef?.cancelled) setLoading(false); });
  };

  const handleGenerateImage = () => {
    if (!prompt) return;
    setImgLoading(true);
    setImgError(null);
    setImageData(null);
    generateImage(prompt)
      .then((res) => setImageData(res.image_data || ''))
      .catch((err) => setImgError(err.message || 'Image generation failed'))
      .finally(() => setImgLoading(false));
  };

  // Auto-generate once when the article changes
  useEffect(() => {
    const ref = { cancelled: false };
    generate(ref);
    return () => { ref.cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleText]);

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-ink-50/70 hover:bg-ink-50 transition-colors cursor-pointer"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-[10.5px] font-bold text-ink-600 uppercase tracking-[0.12em]">
          <Camera size={12} className="text-brand-600" />
          දෘශ්‍ය ප්‍රශ්නය / Visual prompt
        </span>
        {open ? <ChevronUp size={14} className="text-ink-400" /> : <ChevronDown size={14} className="text-ink-400" />}
      </button>

      {open && (
        <div className="p-4 space-y-3">

          {/* ── Prompt loading skeleton ── */}
          {loading && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[12px] text-ink-500">
                <Loader2 size={12} className="animate-spin" />
                <span>Generating visual prompt from article…</span>
              </div>
              <Skeleton className="h-20 rounded-lg" />
            </div>
          )}

          {/* ── Editable prompt textarea ── */}
          {!loading && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Edit3 size={11} className="text-ink-400 shrink-0" />
                  <span className="text-[11px] text-ink-500 font-medium truncate">
                    AI-generated English image prompt — edit before generating
                  </span>
                </div>
                {prompt && <CopyButton text={prompt} />}
              </div>
              <textarea
                value={prompt}
                onChange={(e) => { setPrompt(e.target.value); setImageData(null); setImgError(null); }}
                rows={4}
                className="w-full px-3 py-2.5 text-[13px] text-ink-700 bg-ink-50 border border-ink-200 rounded-lg resize-none
                  focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-300 leading-relaxed font-mono"
                placeholder={error ? 'Prompt generation failed — see error below.' : 'Visual prompt will appear here…'}
                aria-label="Visual prompt"
              />
            </div>
          )}

          {/* ── Regenerate prompt button ── */}
          {!loading && (
            <ActionButton
              variant="secondary"
              size="md"
              icon={RefreshCw}
              onClick={() => generate()}
              disabled={!articleText}
              className="w-full"
            >
              නැවත සාදන්න / Regenerate prompt
            </ActionButton>
          )}

          {/* ── Generate Image button ── */}
          {!loading && prompt && (
            <ActionButton
              variant="primary"
              size="md"
              icon={imgLoading ? Loader2 : Wand2}
              onClick={handleGenerateImage}
              disabled={imgLoading}
              className={`w-full${imgLoading ? ' opacity-80' : ''}`}
            >
              {imgLoading ? 'රූපය සාදමින්… / Generating image…' : 'රූපය සාදන්න / Generate Image'}
            </ActionButton>
          )}

          {/* ── Image loading skeleton ── */}
          {imgLoading && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[12px] text-ink-500">
                <Loader2 size={12} className="animate-spin text-brand-500" />
                <span>Generating with Hugging Face · Stable Diffusion XL…</span>
              </div>
              <Skeleton className="h-64 w-full rounded-xl" />
            </div>
          )}

          {/* ── Generated image display ── */}
          {imageData && !imgLoading && (
            <div className="space-y-2 animate-in fade-in duration-300">
              <div className="flex items-center justify-between">
                <p className="text-[10.5px] font-bold text-ink-500 uppercase tracking-[0.12em] flex items-center gap-1.5">
                  <ImageIcon size={11} className="text-brand-500" />
                  AI-generated image
                </p>
                <div className="flex items-center gap-3">
                  <a
                    href={imageData}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-brand-600 font-semibold hover:underline"
                  >
                    <ExternalLink size={11} /> Open full size
                  </a>
                  <a
                    href={imageData}
                    download="sinai-image.png"
                    className="inline-flex items-center gap-1 text-[11px] text-ink-500 font-semibold hover:text-ink-800"
                  >
                    <Download size={11} /> Download
                  </a>
                </div>
              </div>
              <div className="relative rounded-xl overflow-hidden border border-ink-200 shadow-sm bg-ink-100">
                <img
                  src={imageData}
                  alt="AI-generated news image"
                  className="w-full h-auto object-cover max-h-96 block"
                />
                {/* subtle bottom vignette */}
                <div
                  className="absolute inset-x-0 bottom-0 h-12 pointer-events-none"
                  style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.18), transparent)' }}
                />
              </div>
              <p className="text-[10px] text-ink-400 text-center">
                Generated by Hugging Face (Stable Diffusion XL) · For editorial reference only
              </p>
              {/* Re-generate image button */}
              <button
                onClick={handleGenerateImage}
                className="w-full text-[11px] text-ink-400 hover:text-ink-600 font-medium py-1 transition-colors cursor-pointer"
              >
                ↺ Generate a different image
              </button>
            </div>
          )}

          {/* ── Image generation error ── */}
          {imgError && !imgLoading && (
            <div className="p-3 bg-brand-50 rounded-lg border border-brand-200/70 flex items-start gap-2.5">
              <ImageOff size={15} className="text-brand-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] text-brand-800 font-medium">Image generation failed</p>
                <p className="text-[11px] text-brand-700/80 mt-0.5 break-words">{imgError}</p>
                <button
                  onClick={handleGenerateImage}
                  className="mt-2 text-[11px] text-brand-700 font-semibold hover:underline cursor-pointer"
                >
                  නැවත උත්සාහ කරන්න / Retry
                </button>
              </div>
            </div>
          )}

          {/* ── Prompt generation error ── */}
          {error && !loading && (
            <div className="p-3 bg-brand-50 rounded-lg border border-brand-200/70 flex items-start gap-2.5">
              <ImageOff size={15} className="text-brand-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] text-brand-800 font-medium">Visual prompt generation failed</p>
                <p className="text-[11px] text-brand-700/80 mt-0.5 break-words">{error}</p>
                <button
                  onClick={() => generate()}
                  className="mt-2 text-[11px] text-brand-700 font-semibold hover:underline cursor-pointer"
                >
                  නැවත උත්සාහ කරන්න / Retry
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

/* ── Main export ────────────────────────────────────────────────── */
export default function HeadlineOutputPanel({ output, loading, error, articleText }) {
  const [expandedIdx, setExpandedIdx] = useState(null);
  const [showEntities, setShowEntities] = useState(false);
  const [showPipeline, setShowPipeline] = useState(false);

  if (loading) {
    return (
      <div id="headline-loading" className="space-y-3">
        <span className="text-[10.5px] font-bold text-ink-500 uppercase tracking-[0.14em]">
          Generating headlines
        </span>
        <Card className="px-5 py-4 space-y-3 bg-ink-950 border-ink-950">
          <Skeleton className="h-3 w-24 !bg-white/10" style={{ background: 'rgba(255,255,255,0.08)', animation: 'none' }} />
          <Skeleton className="h-5" style={{ width: '85%', background: 'rgba(255,255,255,0.12)', animation: 'none' }} />
        </Card>
        {[1, 2, 3].map((i) => (
          <Card key={i} className="px-4 py-3.5 space-y-2">
            <div className="flex items-center gap-3">
              <Skeleton className="w-7 h-7 rounded-lg shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4" style={{ width: `${88 - i * 8}%` }} />
                <Skeleton className="h-3 w-16 rounded-full" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div
        id="headline-error"
        className="px-4 py-3.5 bg-brand-50 rounded-xl border border-brand-200/70 flex items-start gap-2.5"
        role="alert"
      >
        <AlertTriangle size={16} className="text-brand-600 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-[13.5px] font-semibold text-brand-800">Generation failed</p>
          <p className="text-[12.5px] text-brand-700/90 mt-0.5 break-words">{error}</p>
        </div>
      </div>
    );
  }

  if (!output) {
    return (
      <div className="rounded-2xl border border-dashed border-ink-300/70 px-6 py-9 text-center">
        <FileSearch size={22} className="mx-auto text-ink-300 mb-2.5" strokeWidth={1.75} />
        <p className="text-[13px] font-semibold text-ink-500">Headlines will appear here</p>
        <p className="text-[12px] text-ink-400 mt-1">
          Paste an article above and press Generate to see ranked candidates.
        </p>
      </div>
    );
  }

  const candidates = output.candidates || [];
  const entities = output.source_entities || [];
  const semantics = output.semantic_extraction || {};
  const pipelineLog = output.pipeline_log || [];

  return (
    <div id="headline-output" className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10.5px] font-bold text-ink-500 uppercase tracking-[0.14em]">
            Generated headlines
          </span>
          {output.regeneration_count > 0 && (
            <span className="text-[10.5px] px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200/70 rounded-full font-semibold tabular-nums">
              {output.regeneration_count} regen{output.regeneration_count > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <span className="text-[11.5px] text-ink-400 tabular-nums">
          {candidates.length} candidate{candidates.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Best headline — hero card */}
      {output.best_headline && (
        <div className="relative overflow-hidden px-5 py-4.5 bg-ink-950 rounded-2xl shadow-pop">
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: 'radial-gradient(24rem 10rem at 90% -30%, rgba(205,25,26,0.4), transparent 60%)' }}
            aria-hidden="true"
          />
          <div className="relative z-10">
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold text-emerald-300 uppercase tracking-[0.14em]">
                <Sparkles size={12} />
                හොඳම මාතෘකාව / Top pick
              </span>
              <CopyButton text={output.best_headline} className="!text-white/60 hover:!text-white hover:!bg-white/10" />
            </div>
            <p className="text-[18px] font-semibold text-white leading-relaxed text-balance">
              {output.best_headline}
            </p>
          </div>
        </div>
      )}

      {/* Visual prompt module */}
      <VisualPromptModule headline={output.best_headline || ''} articleText={articleText} />

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

      {/* Entities (collapsible) */}
      {entities.length > 0 && (
        <Card className="overflow-hidden">
          <button
            onClick={() => setShowEntities((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-left cursor-pointer hover:bg-ink-50 transition-colors"
            aria-expanded={showEntities}
          >
            <span className="text-[10.5px] font-bold text-ink-500 uppercase tracking-[0.12em] flex items-center gap-1.5">
              <Tag size={12} /> Source entities ({entities.length})
            </span>
            {showEntities ? <ChevronUp size={14} className="text-ink-400" /> : <ChevronDown size={14} className="text-ink-400" />}
          </button>
          {showEntities && (
            <div className="px-4 pb-4 flex flex-wrap gap-2">
              {entities.map((e, i) => <EntityTag key={i} entity={e} />)}
            </div>
          )}
        </Card>
      )}

      {/* Semantic themes */}
      {semantics.key_themes && semantics.key_themes.length > 0 && (
        <Card className="px-4 py-3 bg-ink-50/60">
          <p className="text-[10.5px] font-bold text-ink-500 uppercase tracking-[0.12em] mb-2 flex items-center gap-1.5">
            <Eye size={12} /> Key themes
          </p>
          <div className="flex flex-wrap gap-1.5">
            {semantics.key_themes.map((t, i) => (
              <span key={i} className="px-2.5 py-1 bg-white rounded-lg border border-ink-200 text-[12px] font-medium text-ink-600">
                {t}
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Pipeline log (collapsible) */}
      {pipelineLog.length > 0 && (
        <Card className="overflow-hidden">
          <button
            onClick={() => setShowPipeline((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-left cursor-pointer hover:bg-ink-50 transition-colors"
            aria-expanded={showPipeline}
          >
            <span className="text-[10.5px] font-bold text-ink-500 uppercase tracking-[0.12em] flex items-center gap-1.5">
              <BarChart3 size={12} /> Pipeline log
            </span>
            {showPipeline ? <ChevronUp size={14} className="text-ink-400" /> : <ChevronDown size={14} className="text-ink-400" />}
          </button>
          {showPipeline && (
            <div className="px-4 pb-4">
              <div className="space-y-1">
                {pipelineLog.map((log, i) => (
                  <div key={i} className="flex items-center gap-3 py-1.5 text-[12px]">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${log.status === 'success' ? 'bg-emerald-400' : log.status === 'warning' ? 'bg-amber-400' : 'bg-brand-400'
                      }`} />
                    <span className="text-ink-500 font-mono w-32 shrink-0 truncate">{log.stage}</span>
                    <span className="text-ink-400 flex-1 truncate">{log.message}</span>
                    <span className="text-ink-400 shrink-0 font-mono tabular-nums">{log.duration_ms.toFixed(1)}ms</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      <p className="text-center text-[11px] text-ink-400 pt-1">
        SinAi can make mistakes. Please double-check responses.
      </p>
    </div>
  );
}
