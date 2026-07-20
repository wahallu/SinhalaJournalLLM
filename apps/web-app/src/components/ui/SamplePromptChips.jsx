export default function SamplePromptChips({ prompts = [], onSelect, className = '' }) {
  if (!prompts.length) return null;
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {prompts.map((p, i) => {
        const label = typeof p === 'string' ? p : p.label;
        const value = typeof p === 'string' ? p : (p.value ?? p.label);
        return (
          <button
            key={i}
            type="button"
            onClick={() => onSelect?.(value)}
            className="px-3.5 py-1.5 rounded-full bg-white border border-ink-200 text-[12.5px] text-ink-600
              cursor-pointer transition-all duration-150
              hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50 active:scale-[0.98]"
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
