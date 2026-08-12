import { Select } from 'radix-ui';
import { Check, ChevronDown } from 'lucide-react';

/**
 * Styled wrapper over Radix Select.
 *
 * Radix supplies the listbox pattern, keyboard navigation, focus return,
 * outside-click dismissal and collision-aware positioning; this file adds
 * only SinAi styling and the { id, label, desc } option shape used across
 * the app. Content is portalled so the popover escapes the editor pane's
 * overflow instead of being clipped by it.
 *
 * Radix works in strings, so numeric ids (headline count) are stringified
 * on the way in and mapped back to their original type on the way out —
 * callers keep receiving the number they put in.
 */
export default function Dropdown({
  id,
  label,
  value,
  onChange,
  options,
  variant = 'compact',
  className = '',
}) {
  const compact = variant === 'compact';
  const selected = options.find((o) => String(o.id) === String(value));

  const handleChange = (next) => {
    const match = options.find((o) => String(o.id) === next);
    onChange(match ? match.id : next);
  };

  return (
    <Select.Root value={value == null ? undefined : String(value)} onValueChange={handleChange}>
      <Select.Trigger
        id={id}
        aria-label={label}
        className={`
          inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-ink-200 bg-white dark:bg-ink-50
          text-ink-700 font-medium cursor-pointer transition-colors duration-150
          hover:border-ink-300 hover:text-ink-900
          focus:outline-none focus:border-brand-400 focus:shadow-[0_0_0_3px_rgba(205,25,26,0.07)]
          data-[state=open]:border-brand-400
          ${compact ? 'px-2.5 py-1.5 text-[12px]' : 'w-full justify-between px-3.5 py-2.5 text-[14px]'}
          ${className}
        `}
      >
        {compact && (
          <span className="text-ink-400 font-semibold uppercase tracking-wider text-[9.5px]">
            {label}
          </span>
        )}
        <Select.Value className="whitespace-nowrap" placeholder={label}>{selected?.label}</Select.Value>
        <Select.Icon className="shrink-0 text-ink-400">
          <ChevronDown size={13} />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={6}
          className="z-50 min-w-[var(--radix-select-trigger-width)] max-h-[18rem] overflow-hidden
            rounded-xl border border-ink-200/80 bg-white dark:bg-ink-50 shadow-pop
            animate-in fade-in slide-in-from-top-1 duration-150"
        >
          <Select.Viewport className="p-1">
            {options.map((option) => (
              <Select.Item
                key={option.id}
                value={String(option.id)}
                className="relative flex flex-col gap-0.5 rounded-lg px-3 py-2 pr-8 cursor-pointer
                  text-[13px] text-ink-700 select-none outline-none
                  data-[highlighted]:bg-ink-50 data-[highlighted]:text-ink-900
                  data-[state=checked]:text-brand-700 data-[state=checked]:font-semibold"
              >
                <Select.ItemText>{option.label}</Select.ItemText>
                {!compact && option.desc && (
                  <span className="text-[11px] text-ink-400 font-normal">{option.desc}</span>
                )}
                <Select.ItemIndicator className="absolute right-2.5 top-2.5 text-brand-600">
                  <Check size={13} strokeWidth={3} />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
