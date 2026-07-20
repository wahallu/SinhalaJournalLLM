export function Card({ children, className = '', hover = false, ...rest }) {
  return (
    <div
      className={`bg-white rounded-2xl border border-ink-200/80 shadow-card
        ${hover ? 'transition-all duration-200 hover:shadow-card-hover hover:-translate-y-0.5 hover:border-ink-300/80' : ''}
        ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

/**
 * Context-panel card for the right column of tool workspaces.
 * Compact header (icon tile + small-caps title + optional aside) over a padded body.
 */
export function RightPanelCard({ icon: Icon, title, aside, children, className = '', bodyClassName = '' }) {
  return (
    <Card className={`overflow-hidden ${className}`}>
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-ink-100">
        {Icon && (
          <div className="w-6.5 h-6.5 rounded-md bg-brand-50 flex items-center justify-center shrink-0">
            <Icon size={13} className="text-brand-600" strokeWidth={2.25} />
          </div>
        )}
        <h2 className="text-[10.5px] font-bold text-ink-500 uppercase tracking-[0.12em] flex-1 min-w-0 truncate">
          {title}
        </h2>
        {aside}
      </div>
      <div className={`p-4 ${bodyClassName}`}>{children}</div>
    </Card>
  );
}
