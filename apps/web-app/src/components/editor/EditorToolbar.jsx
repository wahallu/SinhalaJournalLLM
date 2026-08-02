import Dropdown from '../ui/Dropdown';
import { TOOLBAR_CONTROLS } from '../../lib/toolOptions';

export default function EditorToolbar({
  tool, title, icon: Icon, charCount, maxChars, isOverLimit, isNearLimit,
  settings, onSettingsChange,
}) {
  const controls = TOOLBAR_CONTROLS[tool] ?? [];

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-ink-100 flex-wrap shrink-0">
      <span className="flex items-center gap-2 pl-1 pr-1 shrink-0">
        {Icon && <Icon size={15} className="text-brand-600" strokeWidth={2.25} />}
        <span className="text-[13px] font-bold text-ink-800 tracking-tight">{title}</span>
      </span>

      {controls.length > 0 && (
        <span className="h-4 w-px bg-ink-200 mx-0.5 hidden sm:block" aria-hidden="true" />
      )}

      <div className="flex items-center gap-1.5 flex-wrap">
        {controls.map(({ key, label, options }) => (
          <Dropdown
            key={key}
            id={`toolbar-${key}`}
            label={label}
            options={options}
            value={settings[key]}
            onChange={(v) => onSettingsChange({ ...settings, [key]: v })}
          />
        ))}
      </div>

      <span
        className={`ml-auto text-[11px] font-medium tabular-nums whitespace-nowrap pr-1 ${
          isOverLimit ? 'text-brand-600 font-semibold' : isNearLimit ? 'text-amber-600' : 'text-ink-400'
        }`}
        aria-live="polite"
      >
        {charCount.toLocaleString()} / {maxChars.toLocaleString()}
      </span>
    </div>
  );
}
