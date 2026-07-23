import { RefreshCw, ExternalLink, ImageOff, AlertCircle } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';
import DownloadButton from './DownloadButton';
import CopyButton from './ui/CopyButton';

/**
 * ImagePreview component
 * Displays generated image responsively (Desktop: large preview, Mobile: full width),
 * handles loading state, error display (network timeout, invalid prompt, failed image load),
 * download button, regenerate button, and copy prompt button.
 */
export default function ImagePreview({
  imageUrl,
  prompt,
  loading = false,
  error = null,
  onRegenerate,
  onRetry,
  className = '',
}) {
  return (
    <div className={`space-y-3.5 ${className}`}>
      {/* ── Loading State ── */}
      {loading && (
        <div className="flex flex-col items-center justify-center p-12 bg-ink-50/80 border border-ink-200/80 rounded-2xl min-h-[320px] space-y-4 text-center">
          <LoadingSpinner size={32} />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-ink-800">Generating image via Pollinations AI...</p>
            <p className="text-xs text-ink-500">Constructing high-quality visual representation from prompt.</p>
          </div>
        </div>
      )}

      {/* ── Error State ── */}
      {!loading && error && (
        <div className="p-4 bg-brand-50 border border-brand-200 rounded-xl space-y-3">
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="text-brand-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-brand-900">Image Generation Error</h4>
              <p className="text-xs text-brand-700 mt-1 leading-relaxed">{error}</p>
            </div>
          </div>
          {onRetry && (
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                  bg-brand-600 text-white hover:bg-brand-700 cursor-pointer transition-colors"
              >
                <RefreshCw size={13} /> Try Again
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Empty Initial State ── */}
      {!loading && !error && !imageUrl && (
        <div className="flex flex-col items-center justify-center p-12 border border-dashed border-ink-300 rounded-2xl min-h-[320px] text-center bg-white/50">
          <div className="w-12 h-12 rounded-2xl bg-ink-100 flex items-center justify-center text-ink-400 mb-3">
            <ImageOff size={24} />
          </div>
          <p className="text-sm font-semibold text-ink-700">No Image Generated Yet</p>
          <p className="text-xs text-ink-400 max-w-sm mt-1">
            Enter a text prompt above and click Generate to create an image with Pollinations AI.
          </p>
        </div>
      )}

      {/* ── Image Preview Display (Responsive: Mobile full-width, Desktop large preview) ── */}
      {!loading && !error && imageUrl && (
        <div className="space-y-3 animate-in fade-in duration-300">
          {/* Action Toolbar */}
          <div className="flex items-center justify-between flex-wrap gap-2 px-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-ink-500 uppercase tracking-wider">Generated Image</span>
              {prompt && <CopyButton text={prompt} label="Copy prompt" className="!px-2" />}
            </div>

            <div className="flex items-center gap-2">
              {onRegenerate && (
                <button
                  type="button"
                  onClick={onRegenerate}
                  title="Generate another image with the same prompt"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium
                    bg-ink-100 text-ink-700 hover:bg-ink-200 cursor-pointer transition-colors"
                >
                  <RefreshCw size={13} /> Regenerate
                </button>
              )}

              <DownloadButton imageUrl={imageUrl} prompt={prompt} />

              <a
                href={imageUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="View full size image"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium
                  text-brand-600 hover:bg-brand-50 cursor-pointer transition-colors"
              >
                <ExternalLink size={13} /> Open
              </a>
            </div>
          </div>

          {/* Image Container: Desktop large preview, Mobile full width */}
          <div className="relative rounded-2xl overflow-hidden border border-ink-200 bg-ink-900 shadow-md">
            <img
              src={imageUrl}
              alt={prompt || 'Pollinations AI generated image'}
              className="w-full h-auto object-contain max-h-[600px] mx-auto block"
              loading="eager"
            />
          </div>

          <p className="text-[11px] text-ink-400 text-center">
            Generated via Pollinations AI · Free & open image generation
          </p>
        </div>
      )}
    </div>
  );
}
