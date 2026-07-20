const STATUS_STYLES = {
  online:   { wrap: 'bg-emerald-50 text-emerald-700 border-emerald-200/70', dot: 'bg-emerald-500' },
  success:  { wrap: 'bg-emerald-50 text-emerald-700 border-emerald-200/70', dot: 'bg-emerald-500' },
  offline:  { wrap: 'bg-brand-50 text-brand-700 border-brand-200/70',       dot: 'bg-brand-500' },
  error:    { wrap: 'bg-brand-50 text-brand-700 border-brand-200/70',       dot: 'bg-brand-500' },
  warning:  { wrap: 'bg-amber-50 text-amber-700 border-amber-200/70',       dot: 'bg-amber-500' },
  checking: { wrap: 'bg-ink-100 text-ink-600 border-ink-200/70',            dot: 'bg-ink-400' },
  neutral:  { wrap: 'bg-ink-100 text-ink-600 border-ink-200/70',            dot: 'bg-ink-400' },
  brand:    { wrap: 'bg-brand-50 text-brand-700 border-brand-200/70',       dot: 'bg-brand-600' },
};

export default function StatusBadge({ status = 'neutral', label, pulse = false, className = '' }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.neutral;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border
        text-[11px] font-semibold tracking-wide whitespace-nowrap ${s.wrap} ${className}`}
    >
      <span className="relative flex h-1.5 w-1.5 shrink-0">
        {pulse && (
          <span className={`absolute inline-flex h-full w-full rounded-full ${s.dot} opacity-60 animate-ping`} />
        )}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${s.dot}`} />
      </span>
      {label}
    </span>
  );
}
