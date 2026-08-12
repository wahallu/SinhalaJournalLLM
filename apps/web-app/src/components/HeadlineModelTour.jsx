import { useState } from 'react';
import {
  ArrowLeft, ArrowRight, Check, Feather, SlidersHorizontal, Sparkles, X,
} from 'lucide-react';
import ActionButton from './ui/ActionButton';

const STORAGE_KEY = 'sinai_headline_model_tour_v1';

const MODELS = [
  {
    id: 'headline_sinllama_v17',
    name: 'ගිරා 1.7',
    level: 'Simple',
    icon: Feather,
    does: 'Creates quick, concise Sinhala headlines using a simple style.',
    bestFor: 'Short, familiar newsroom headlines.',
  },
  {
    id: 'headline_sinllama_v18',
    name: 'සැලලිහිණි 2.0',
    level: 'Optimized',
    icon: SlidersHorizontal,
    does: 'Creates headlines that follow your selected short, medium, or long length.',
    bestFor: 'Headlines that must fit different layouts.',
  },
  {
    id: 'headline_sinllama_v19',
    name: 'හංස 3.0',
    level: 'Best overall',
    icon: Sparkles,
    does: 'Creates the cleanest, most refined headlines with reliable length control.',
    bestFor: 'The best overall headline quality.',
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
    // Restricted/private browsers may block storage. The tour still closes
    // for this visit and can safely be offered again later.
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

  if (!open) return null;

  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-labelledby="headline-model-tour-title"
      aria-describedby="headline-model-tour-description"
      className="absolute bottom-[calc(100%+0.75rem)] right-0 z-50
        w-[min(23rem,calc(100vw-2rem))] rounded-2xl border border-ink-200
        bg-white dark:bg-ink-50 p-3 sm:p-4 shadow-pop focus:outline-none
        animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
      <span
        aria-hidden="true"
        className="absolute -bottom-2 right-14 h-4 w-4 rotate-45
          border-b border-r border-ink-200 bg-white dark:bg-ink-50"
      />

      <button
        type="button"
        onClick={finish}
        aria-label="Close model tour"
        className="absolute right-2.5 top-2.5 z-10 flex h-7 w-7 items-center justify-center
          rounded-lg text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-800
          focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 cursor-pointer"
      >
        <X size={15} strokeWidth={2} />
      </button>

      <div className="space-y-3.5">
        <div className="pr-7">
          <h2 id="headline-model-tour-title" className="text-[15px] font-bold text-ink-900">
            Headline model guide
          </h2>
          <p id="headline-model-tour-description" className="mt-0.5 text-[11px] leading-relaxed text-ink-500">
            A quick introduction to each model.
          </p>
        </div>

        <div
          className="relative rounded-xl border border-ink-200 bg-ink-50/60 px-4 py-3.5"
        >
          {model.recommended && (
            <span className="absolute right-3 top-3 rounded-full bg-brand-600 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white">
              Recommended
            </span>
          )}

          <div className="flex items-start gap-2.5 pr-20">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-brand-100 bg-brand-50 text-brand-600">
              <Icon size={17} strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <p className="text-[8.5px] font-bold uppercase tracking-[0.12em] text-brand-700">
                {model.level}
              </p>
              <h3 className="mt-0.5 font-sinhala text-[18px] font-bold leading-tight text-ink-900">
                {model.name}
              </h3>
            </div>
          </div>

          <div className="mt-3">
            <p className="text-[8.5px] font-bold uppercase tracking-wider text-ink-400">What it does</p>
            <p className="mt-1 text-[11.5px] font-medium leading-relaxed text-ink-800">{model.does}</p>
          </div>

          <div className="mt-3 flex items-start gap-2 rounded-lg border border-ink-200/80 bg-white dark:bg-ink-100 px-3 py-2">
            <Check size={13} className="mt-0.5 shrink-0 text-emerald-600" strokeWidth={2.5} />
            <div>
              <p className="text-[8.5px] font-bold uppercase tracking-wider text-ink-400">Best for</p>
              <p className="mt-0.5 text-[10.5px] font-medium text-ink-800">{model.bestFor}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={finish}
            className="px-1 py-1.5 text-[11px] font-semibold text-ink-400 hover:text-ink-700 cursor-pointer"
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

        <p className="text-center text-[9.5px] text-ink-400">
          Model {step + 1} of {MODELS.length} · This introduction is shown only once.
        </p>
      </div>
    </section>
  );
}
