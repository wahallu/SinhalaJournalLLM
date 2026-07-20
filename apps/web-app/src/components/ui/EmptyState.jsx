export default function EmptyState({ icon: Icon, title, description, action, tone = 'neutral', className = '' }) {
  const iconWrap = tone === 'brand'
    ? 'bg-brand-50 text-brand-500'
    : 'bg-ink-100 text-ink-400';
  return (
    <div className={`flex flex-col items-center justify-center text-center py-10 px-6 gap-3 ${className}`}>
      {Icon && (
        <div className={`w-11 h-11 rounded-full flex items-center justify-center ${iconWrap}`}>
          <Icon size={20} strokeWidth={1.75} />
        </div>
      )}
      <div className="space-y-1">
        <p className="text-[13.5px] font-semibold text-ink-700">{title}</p>
        {description && (
          <p className="text-[12px] text-ink-500 leading-relaxed max-w-xs mx-auto text-pretty">{description}</p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
