import { useEffect, useRef, useState } from 'react';
import { Eye, FlaskConical, Infinity as InfinityIcon, Play, RotateCcw } from 'lucide-react';
import { ImageGeneration } from '@/components/ui/image-generation';

export default function ImageGenerationPreview() {
  const [prompt, setPrompt] = useState('global political and economic trends in Asia and the Global South');
  const [resolution, setResolution] = useState('1536 × 1024');
  const [delay, setDelay] = useState(10);
  const [showImage, setShowImage] = useState(false);
  const [runKey, setRunKey] = useState(0);
  const [mode, setMode] = useState('spinning');
  const timerRef = useRef(null);

  const clearTimer = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  useEffect(() => () => clearTimer(), []);

  const keepSpinning = () => {
    clearTimer();
    setShowImage(false);
    setMode('spinning');
    setRunKey((value) => value + 1);
  };

  const revealImage = () => {
    clearTimer();
    setMode('revealed');
    setShowImage(true);
  };

  const runTimedPreview = () => {
    clearTimer();
    setShowImage(false);
    setMode('timed');
    setRunKey((value) => value + 1);
    timerRef.current = window.setTimeout(() => {
      setShowImage(true);
      setMode('revealed');
      timerRef.current = null;
    }, delay * 1000);
  };

  return (
    <main className="min-h-full overflow-y-auto bg-canvas px-4 py-8 text-ink-900 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <header className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-brand-700">
              <FlaskConical size={14} />
              Local development preview
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Image loader workshop</h1>
            <p className="mt-1.5 max-w-2xl text-sm text-ink-500">
              Edit and test the complete loading transition without contacting the image API.
            </p>
          </div>
          <span className="w-fit rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700">
            No API key · no network request
          </span>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_310px]">
          <section className="min-w-0">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-500">Live preview</span>
              <span className="text-[11px] text-ink-400">
                {mode === 'revealed' ? 'Sample image shown' : mode === 'timed' ? `Reveals after ${delay}s` : 'Spinning continuously'}
              </span>
            </div>

            <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-ink-200 bg-ink-100 shadow-pop">
              {!showImage && (
                <div key={runKey} className="absolute inset-0 z-10">
                  <ImageGeneration prompt={prompt} resolution={resolution} />
                </div>
              )}

              <div className={`absolute inset-0 transition-opacity duration-[1500ms] ease-out ${showImage ? 'opacity-100' : 'opacity-0'}`}>
                <img src="/loader-preview-dummy.png" alt="Dummy generated news conference" className="h-full w-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-5 pb-4 pt-16 text-white">
                  <p className="text-sm font-semibold">Dummy generated image</p>
                  <p className="mt-0.5 text-xs text-white/70">Your local PNG · used only to test the fade-in transition</p>
                </div>
              </div>
            </div>
          </section>

          <aside className="h-fit rounded-2xl border border-ink-200 bg-white p-4 shadow-card dark:bg-ink-50">
            <h2 className="text-sm font-bold">Preview controls</h2>
            <p className="mt-1 text-[11.5px] leading-relaxed text-ink-500">Changes appear immediately in the loader.</p>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold text-ink-600">Prompt</span>
                <input
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  className="w-full rounded-lg border border-ink-200 bg-ink-50 px-3 py-2 text-[12px] text-ink-800 outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold text-ink-600">Resolution label</span>
                <input
                  value={resolution}
                  onChange={(event) => setResolution(event.target.value)}
                  className="w-full rounded-lg border border-ink-200 bg-ink-50 px-3 py-2 text-[12px] text-ink-800 outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 flex items-center justify-between text-[11px] font-semibold text-ink-600">
                  Simulated generation time
                  <span className="font-mono text-brand-700">{delay}s</span>
                </span>
                <input
                  type="range"
                  min="1"
                  max="30"
                  value={delay}
                  onChange={(event) => setDelay(Number(event.target.value))}
                  className="w-full accent-brand-600"
                />
              </label>
            </div>

            <div className="mt-5 grid gap-2">
              <button
                type="button"
                onClick={runTimedPreview}
                className="flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 py-2.5 text-[12px] font-semibold text-white transition hover:bg-brand-700"
              >
                <Play size={14} /> Generate image (test)
              </button>
              <button
                type="button"
                onClick={keepSpinning}
                className="flex items-center justify-center gap-2 rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-[12px] font-semibold text-ink-700 transition hover:bg-ink-50 dark:bg-ink-100"
              >
                {showImage ? <RotateCcw size={14} /> : <InfinityIcon size={14} />}
                {showImage ? 'Restart spinner' : 'Keep spinning'}
              </button>
              <button
                type="button"
                onClick={revealImage}
                className="flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-[11.5px] font-semibold text-ink-500 transition hover:bg-ink-50 hover:text-ink-800"
              >
                <Eye size={14} /> Reveal sample image now
              </button>
            </div>
          </aside>
        </div>

        <p className="mt-6 text-center text-[11px] text-ink-400">
          Development-only page. It is not included as a reachable route in production builds.
        </p>
      </div>
    </main>
  );
}
