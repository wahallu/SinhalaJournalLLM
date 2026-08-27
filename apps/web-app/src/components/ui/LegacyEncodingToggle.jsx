import { Languages } from 'lucide-react';

const OPTIONS = [
  {
    direction: 'legacy-to-unicode',
    target: 'unicode',
    label: 'Legacy → Unicode',
    hint: 'Convert FM Abhaya, DL-Manel, or Su-Nirmala encoded text into Sinhala Unicode',
  },
  {
    direction: 'unicode-to-legacy',
    target: 'legacy',
    label: 'Unicode → Legacy',
    hint: 'Convert Sinhala Unicode into the bundled Su-Nirmala/FM-compatible legacy layout',
  },
];

export default function LegacyEncodingToggle({
  encoding = 'unknown', onConvert, disabled = false, className = '',
}) {
  return (
    <div
      role="group"
      aria-label="Convert Sinhala text encoding"
      className={`inline-flex items-center rounded-lg border border-ink-200 bg-ink-50/70 p-0.5
        transition-opacity ${disabled ? 'opacity-50' : ''} ${className}`}
    >
      <span
        className="inline-flex items-center justify-center w-6 text-ink-400"
        title="FM Abhaya / DL-Manel / Su-Nirmala compatible"
        aria-hidden="true"
      >
        <Languages size={12} strokeWidth={2.2} />
      </span>
      {OPTIONS.map(({ direction, target, label, hint }) => {
        const selected = encoding === target;
        return (
          <button
            key={direction}
            type="button"
            aria-pressed={selected}
            disabled={disabled || selected}
            title={selected ? `Text is already ${target}` : hint}
            onClick={() => onConvert(direction)}
            className={`rounded-md px-2 py-[3px] text-[10.5px] font-semibold whitespace-nowrap
              transition-colors ${disabled || selected ? 'cursor-default' : 'cursor-pointer'}
              ${selected
                ? 'bg-white dark:bg-ink-100 text-ink-800 shadow-[0_1px_2px_rgba(22,17,18,0.10)]'
                : 'text-ink-500 hover:text-ink-700'}`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

