import { useState } from 'react';
import {
  ArrowLeft, ArrowRight, Check, Feather, SlidersHorizontal, Sparkles,
} from 'lucide-react';
import Dialog from './ui/Dialog';
import ActionButton from './ui/ActionButton';

const STORAGE_KEY = 'sinai_headline_model_tour_v1';

const MODELS = [
  {
    id: 'headline_sinllama_v17',
    name: 'ගිරා 1.7',
    eyebrow: 'Simple and dependable',
    icon: Feather,
    summary: 'A straightforward starting model for concise Sinhala news headlines.',
    detail: (
      <>
        Trained on approximately <strong>48,000 headline examples</strong> with a fixed
        4–7-word pattern. It is well suited to quick, conventional short and medium
        headlines, but has less control when you request a longer headline.
      </>
    ),
    bestFor: 'Quick, familiar newsroom-style headlines',
  },
  {
    id: 'headline_sinllama_v18',
    name: 'සැලලිහිණි 2.0',
    eyebrow: 'Length optimized',
    icon: SlidersHorizontal,
    summary: 'A more flexible model that understands the selected headline length.',
    detail: (
      <>
        Adds learned <strong>short, medium, and long length control</strong>. It was
        measured at about 81% within the requested word band, making it a stronger
        choice when headline size and layout space matter.
      </>
    ),
    bestFor: 'Length-controlled headlines for different layouts',
  },
  {
    id: 'headline_sinllama_v19',
    name: 'හංස 3.0',
    eyebrow: 'Best overall · Recommended',
    icon: Sparkles,
    summary: 'The cleanest and most refined headline model available in this tool.',
    detail: (
      <>
        Keeps the length control from 2.0 and trains on <strong>cleaned headline
        data</strong>. Evaluation reduced unwanted media and scraper tags by about
        10× while preserving length performance, producing cleaner publication-ready
        candidates.
      </>
    ),
    bestFor: 'The best balance of control, cleanliness, and quality',
    recommended: true,
  },
];

function hasCompletedTour() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'complete';
  } catch {
    return false;
  }
}

function rememberCompletion() {
  try {
    window.localStorage.setItem(STORAGE_KEY, 'complete');
  } catch {
    // Storage can be blocked in private/restricted browser contexts. Closing
    // still works for this visit; it may be offered again next time.
  }
}

export default function HeadlineModelTour() {
  const [open, setOpen] = useState(() => !hasCompletedTour());
  const [step, setStep] = useState(0);
  const model = MODELS[step];
  const Icon = model.icon;
  const isFirst = step === 0;
  const isLast = step === MODELS.length - 1;

  const finish = () => {
    rememberCompletion();
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) finish();
      }}
      title="Meet the headline models"
      description="Three Sinhala headline models, from the simplest option to the best overall model."
      size="md"
    >
      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-1.5" role="tablist" aria-label="Headline models">
          {MODELS.map((item, index) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={step === index}
              onClick={() => setStep(index)}
              className={`min-w-0 rounded-xl border px-2 py-2.5 text-center cursor-pointer transition-colors
                ${step === index
                  ? 'border-brand-600 bg-brand-50 text-brand-800'
                  : 'border-ink-200 bg-white dark:bg-ink-50 text-ink-500 hover:border-ink-300 hover:text-ink-800'}`}
            >
              <span className="block truncate font-sinhala text-[13px] font-bold">{item.name}</span>
              <span className="mt-0.5 block text-[9.5px] font-semibold uppercase tracking-wide">
                {index === 0 ? 'Simple' : index === 1 ? 'Optimized' : 'Best'}
              </span>
            </button>
          ))}
        </div>

        <div
          role="tabpanel"
          className="relative overflow-hidden rounded-2xl border border-ink-200 bg-ink-50/60 px-5 py-5 sm:px-6"
        >
          {model.recommended && (
            <span className="absolute right-4 top-4 rounded-full bg-brand-600 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-white">
              Recommended
            </span>
          )}

          <div className="flex items-start gap-3.5 pr-20 sm:pr-24">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 border border-brand-100">
              <Icon size={20} strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-brand-700">
                {model.eyebrow}
              </p>
              <h3 className="mt-1 font-sinhala text-[22px] font-bold leading-tight text-ink-900">
                {model.name}
              </h3>
            </div>
          </div>

          <p className="mt-4 text-[14px] font-semibold leading-relaxed text-ink-800">
            {model.summary}
          </p>
          <p className="mt-2 text-[12.5px] leading-relaxed text-ink-600">
            {model.detail}
          </p>

          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-ink-200/80 bg-white dark:bg-ink-100 px-3.5 py-3">
            <Check size={15} className="mt-0.5 shrink-0 text-emerald-600" strokeWidth={2.5} />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">Best for</p>
              <p className="mt-0.5 text-[12.5px] font-medium text-ink-800">{model.bestFor}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={finish}
            className="px-1 py-2 text-[12.5px] font-semibold text-ink-400 hover:text-ink-700 cursor-pointer"
          >
            Skip tour
          </button>

          <div className="flex items-center gap-2">
            {!isFirst && (
              <ActionButton
                variant="secondary"
                size="sm"
                icon={ArrowLeft}
                onClick={() => setStep((current) => current - 1)}
              >
                Back
              </ActionButton>
            )}
            <ActionButton
              variant="primary"
              size="sm"
              icon={isLast ? Check : ArrowRight}
              onClick={() => {
                if (isLast) finish();
                else setStep((current) => current + 1);
              }}
            >
              {isLast ? 'Start generating' : 'Next model'}
            </ActionButton>
          </div>
        </div>

        <p className="text-center text-[10.5px] text-ink-400">
          Model {step + 1} of {MODELS.length} · This introduction is shown only once.
        </p>
      </div>
    </Dialog>
  );
}
