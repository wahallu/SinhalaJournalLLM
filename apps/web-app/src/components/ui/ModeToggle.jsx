import { Sparkles, SlidersHorizontal } from 'lucide-react';

/**
 * Auto / Manual switch for how suggestions are handled.
 *
 * A two-segment control rather than a checkbox: both states are named, so
 * neither has to be inferred from an unchecked box. "Auto" alone would leave a
 * reader guessing what off means — nothing, or the opposite?
 *
 * Sits next to the character count because that is the row about the text
 * itself rather than about the tool, and because the setting changes what
 * comes back from the next run.
 */

const OPTIONS = [
  {
    value: 'manual',
    label: 'Manual',
    icon: SlidersHorizontal,
    hint: 'Suggestions are marked in the result for you to apply',
  },
  {
    value: 'auto',
    label: 'Auto',
    icon: Sparkles,
    hint: 'Spelling and grammar suggestions are applied for you — each can still be undone',
  },
];

export default function ModeToggle({
  value, onChange, disabled = false, disabledHint, className = '',
}) {
  return (
    <div
      role="radiogroup"
      aria-label="How to handle suggestions"
      aria-disabled={disabled || undefined}
      title={disabled ? disabledHint : undefined}
      className={`inline-flex items-center rounded-lg border border-ink-200 bg-ink-50/70 p-0.5
        transition-opacity ${disabled ? 'opacity-55' : ''} ${className}`}
    >
      {OPTIONS.map(({ value: option, label, icon: Icon, hint }) => {
        const selected = value === option;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            title={disabled ? disabledHint : hint}
            onClick={() => onChange(option)}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-[3px] text-[11px] font-semibold
              transition-colors ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
              ${selected
                ? 'bg-white dark:bg-ink-100 text-ink-800 shadow-[0_1px_2px_rgba(22,17,18,0.10)]'
                : `text-ink-500 ${disabled ? '' : 'hover:text-ink-700'}`}`}
          >
            <Icon size={11} strokeWidth={2.25} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
