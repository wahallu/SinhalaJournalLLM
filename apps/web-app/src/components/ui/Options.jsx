/**
 * Option pickers for the right context panel.
 *  - OptionChips: compact grid of pills for short choices (counts, lengths).
 *  - OptionCards: vertical radio-cards for choices that carry a description.
 */

export function OptionChips({ label, options, value, onChange, columns = 3 }) {
  return (
    <fieldset className="mb-5 last:mb-0">
      {label && (
        <legend className="block text-[10.5px] font-bold text-ink-500 uppercase tracking-[0.12em] mb-2.5">
          {label}
        </legend>
      )}
      <div className={`grid gap-1.5 ${columns === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
        {options.map((opt) => {
          const active = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(opt.id)}
              className={`px-2 py-2 rounded-lg text-[12.5px] font-semibold text-center cursor-pointer
                transition-all duration-150 border
                ${active
                  ? 'bg-brand-600 text-white border-brand-600 shadow-sm shadow-brand-600/20'
                  : 'bg-white text-ink-600 border-ink-200 hover:border-ink-300 hover:bg-ink-50'}`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function OptionCards({ label, options, value, onChange }) {
  return (
    <fieldset className="mb-5 last:mb-0">
      {label && (
        <legend className="block text-[10.5px] font-bold text-ink-500 uppercase tracking-[0.12em] mb-2.5">
          {label}
        </legend>
      )}
      <div className="space-y-1.5">
        {options.map((opt) => {
          const active = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(opt.id)}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl cursor-pointer
                transition-all duration-150 border
                ${active
                  ? 'bg-brand-50 border-brand-200 shadow-sm shadow-brand-600/5'
                  : 'bg-white border-ink-200/80 hover:border-ink-300 hover:bg-ink-50'}`}
            >
              <span className="flex items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 flex items-center justify-center
                    ${active ? 'border-brand-600' : 'border-ink-300'}`}
                >
                  {active && <span className="w-1.5 h-1.5 rounded-full bg-brand-600" />}
                </span>
                <span className="min-w-0">
                  <span className={`block text-[13px] font-semibold ${active ? 'text-brand-800' : 'text-ink-700'}`}>
                    {opt.label}
                  </span>
                  {opt.desc && (
                    <span className={`block text-[11px] mt-0.5 leading-snug ${active ? 'text-brand-600/80' : 'text-ink-500'}`}>
                      {opt.desc}
                    </span>
                  )}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
