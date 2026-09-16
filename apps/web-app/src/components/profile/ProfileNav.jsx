/**
 * Profile tablist.
 *
 * Takes `tabs` rather than reading a module constant, so the tab set is owned
 * by ProfilePage and this stays a presentational component.
 */
export default function ProfileNav({ tabs, activeTab, onChange }) {
  const handleKeyDown = (event, currentIndex) => {
    const keys = ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();

    let nextIndex = currentIndex;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % tabs.length;
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = tabs.length - 1;
    }

    const nextTab = tabs[nextIndex];
    onChange(nextTab.id);
    requestAnimationFrame(() => document.getElementById(`profile-tab-${nextTab.id}`)?.focus());
  };

  return (
    <nav
      className="flex gap-1 overflow-x-auto px-4 pb-4 sm:flex-col sm:overflow-visible sm:px-5 sm:pb-0"
      aria-label="Profile sections"
      role="tablist"
      aria-orientation="vertical"
    >
      {tabs.map(({ id, label, icon: Icon }, index) => {
        const selected = activeTab === id;
        return (
          <button
            key={id}
            id={`profile-tab-${id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`profile-panel-${id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={`flex min-h-11 shrink-0 items-center gap-3 rounded-xl px-3.5 text-left text-[13.5px]
              font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500
              ${selected
                ? 'bg-ink-100 text-ink-900'
                : 'text-ink-500 hover:bg-ink-50 hover:text-ink-800'}`}
          >
            <Icon size={18} strokeWidth={1.9} className="shrink-0" />
            {label}
          </button>
        );
      })}
    </nav>
  );
}
