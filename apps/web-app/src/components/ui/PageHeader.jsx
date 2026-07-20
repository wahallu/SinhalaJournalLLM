export default function PageHeader({ icon: Icon, title, description, badge, actions, className = '' }) {
  return (
    <header className={`flex flex-wrap items-start justify-between gap-4 mb-6 ${className}`}>
      <div className="flex items-start gap-3.5 min-w-0">
        {Icon && (
          <div className="w-11 h-11 rounded-xl bg-white border border-ink-200/80 shadow-card flex items-center justify-center shrink-0">
            <Icon size={20} className="text-brand-600" strokeWidth={2} />
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 id="tool-title" className="text-[1.35rem] font-bold text-ink-900 tracking-tight leading-tight text-balance">
              {title}
            </h1>
            {badge}
          </div>
          {description && (
            <p className="text-[13px] text-ink-500 mt-1 max-w-xl leading-relaxed">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </header>
  );
}
