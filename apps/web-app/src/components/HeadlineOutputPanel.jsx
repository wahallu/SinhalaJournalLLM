import { useState, useEffect } from 'react';
import {
  ChevronDown, ChevronUp, Trophy, AlertTriangle, Sparkles,
  Camera, RefreshCw, ImageOff, Edit3, FileSearch,
  Wand2, Download, ExternalLink, ImageIcon,
} from 'lucide-react';
import { Card } from './ui/Card';
import CopyButton from './ui/CopyButton';
import ActionButton from './ui/ActionButton';
import { Skeleton } from './ui/Skeleton';
import { generateVisualPrompt, generateImage } from '../services/api';
import { useAuth } from '../auth/useAuth';

/* ── Single candidate card ──────────────────────────────────────
   Word count and band fit are the only per-candidate facts available:
   both are derived from the returned text. The quality metrics, entity
   coverage and validation badges that used to sit here were synthesized
   client-side in services/api.js and never came from the model. */
function CandidateCard({ candidate }) {
  const isBest = candidate.rank === 1;

  return (
    <Card className={`transition-all duration-200 ${isBest ? 'border-emerald-200/80' : 'hover:border-ink-300'}`}>
      <div className="w-full flex items-start gap-3 px-4 py-3.5 text-left">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 text-[12px] font-bold tabular-nums
          ${isBest ? 'bg-emerald-100 text-emerald-700' : 'bg-ink-100 text-ink-500'}`}>
          {isBest ? <Trophy size={13} /> : candidate.rank}
        </div>

        <div className="flex-1 min-w-0">
          <p className={`text-[15px] leading-relaxed ${isBest ? 'font-semibold text-ink-900' : 'text-ink-800'}`}>
            {candidate.headline}
          </p>
          <p className="text-[11px] text-ink-400 mt-1.5 tabular-nums">
            {candidate.word_count} word{candidate.word_count !== 1 ? 's' : ''}
            {candidate.length_ok ? '' : ' · outside requested band'}
          </p>
        </div>

        <CopyButton text={candidate.headline} label="" className="!px-1.5 shrink-0 mt-0.5" />
      </div>
    </Card>
  );
}

/* ── Visual prompt module ───────────────────────────────────────── */
function VisualPromptModule({ headline, articleText }) {
  const { isAdmin } = useAuth();
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
    const cleanPrompt = prompt.trim();
    if (!isAdmin || !cleanPrompt || imgLoading) return;
    setImgLoading(true);
    setImgError(null);
    setImageData(null);
    generateImage(cleanPrompt)
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
          {/* Prompt and image sit side by side when the pane is wide enough,
              and stack below md. The image box keeps a fixed aspect ratio in
              every state — placeholder, skeleton, loaded — so generating one
              never shifts the surrounding layout. */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
            {/* ── Prompt column ── */}
            <div className="space-y-2 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 min-w-0 text-[11px] text-ink-500 font-medium">
                  <Edit3 size={11} className="text-ink-400 shrink-0" />
                  <span className="truncate">English image prompt — edit before generating</span>
                </span>
                {prompt && <CopyButton text={prompt} />}
              </div>

              {loading ? (
                <Skeleton className="h-28 rounded-lg" />
              ) : (
                <textarea
                  value={prompt}
                  onChange={(e) => { setPrompt(e.target.value); setImageData(null); setImgError(null); }}
                  rows={5}
                  className="w-full px-3 py-2.5 text-[13px] text-ink-700 bg-ink-50 border border-ink-200
                    rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-brand-200
                    focus:border-brand-300 leading-relaxed font-mono"
                  placeholder={error ? 'Prompt generation failed — see below.' : 'Visual prompt will appear here…'}
                  aria-label="Visual prompt"
                />
              )}

              <div className="flex items-center gap-1.5 flex-wrap">
                <ActionButton
                  variant="secondary"
                  size="sm"
                  icon={RefreshCw}
                  onClick={() => generate()}
                  disabled={loading || !articleText}
                >
                  Regenerate
                </ActionButton>
                {prompt && !loading && (
                  <ActionButton
                    variant="primary"
                    size="sm"
                    icon={Wand2}
                    onClick={handleGenerateImage}
                    loading={imgLoading}
                    disabled={!isAdmin}
                    title={!isAdmin ? 'Image generation is available to administrators only' : undefined}
                  >
                    {imgLoading ? 'Generating image' : 'Generate image'}
                  </ActionButton>
                )}
              </div>
            </div>

            {/* ── Image column ── */}
            <div className="min-w-0">
              {imgLoading && <Skeleton className="w-full aspect-[16/10] rounded-xl" />}

              {imageData && !imgLoading && (
                <div className="relative group rounded-xl overflow-hidden border border-ink-200
                  bg-ink-100 aspect-[16/10] animate-in fade-in duration-300">
                  <img src={imageData} alt="AI-generated news image" className="w-full h-full object-cover" />
                  <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0
                    group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    <a
                      href={imageData} target="_blank" rel="noopener noreferrer" title="Open full size"
                      className="w-7 h-7 rounded-lg bg-white/90 backdrop-blur flex items-center justify-center
                        text-ink-600 hover:text-ink-900"
                    >
                      <ExternalLink size={13} />
                    </a>
                    <a
                      href={imageData} download="sinai-image.png" title="Download"
                      className="w-7 h-7 rounded-lg bg-white/90 backdrop-blur flex items-center justify-center
                        text-ink-600 hover:text-ink-900"
                    >
                      <Download size={13} />
                    </a>
                  </div>
                  <button
                    onClick={handleGenerateImage}
                    className="absolute inset-x-0 bottom-0 py-1.5 text-[11px] font-medium text-white
                      bg-ink-950/55 dark:bg-black/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    ↺ Generate a different image
                  </button>
                </div>
              )}

              {!imageData && !imgLoading && (
                <div className="w-full aspect-[16/10] rounded-xl border border-dashed border-ink-300/70
                  flex flex-col items-center justify-center gap-1.5 text-center px-4">
                  <ImageIcon size={18} className="text-ink-300" />
                  <p className="text-[11.5px] text-ink-400">
                    {prompt ? 'Generate an image from the prompt' : 'A prompt is generated from your article first'}
                  </p>
                </div>
              )}
            </div>
          </div>

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
                  Retry
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
                  Retry
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
  if (loading) {
    return (
      <div id="headline-loading" className="space-y-3">
        <span className="text-[10.5px] font-bold text-ink-500 uppercase tracking-[0.14em]">
          Generating headlines
        </span>
        <Card className="px-5 py-4 space-y-3 bg-ink-950 dark:bg-[#161112] border-ink-950 dark:border-[#161112]">
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
          Paste an article and press Generate to see ranked candidates.
        </p>
      </div>
    );
  }

  const candidates = output.candidates || [];

  return (
    <div id="headline-output" className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Best headline — hero card */}
      {output.best_headline && (
        <div className="relative overflow-hidden px-5 py-4.5 bg-ink-950 dark:bg-[#161112] rounded-2xl shadow-pop">
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
          <CandidateCard key={i} candidate={c} />
        ))}
      </div>

      <p className="text-center text-[11px] text-ink-400 pt-1">
        SinAi can make mistakes. Please double-check responses.
      </p>
    </div>
  );
}
