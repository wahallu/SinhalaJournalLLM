import Dropdown from '../ui/Dropdown';
import LegacyEncodingToggle from '../ui/LegacyEncodingToggle';
import ModeToggle from '../ui/ModeToggle';
import { TOOLBAR_CONTROLS } from '../../lib/toolOptions';
import { useSuggestionMode } from '../../lib/suggestionMode';

export default function EditorToolbar({
  tool, title, icon: Icon, charCount, maxChars, isOverLimit, isNearLimit,
  settings, onSettingsChange, hasResult = false, encoding = 'unknown',
  onEncodingConvert, conversionDisabled = false,
}) {
  const controls = TOOLBAR_CONTROLS[tool] ?? [];
  const [mode, setMode] = useSuggestionMode();

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

      <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-2 pr-1">
        <LegacyEncodingToggle
          encoding={encoding}
          onConvert={onEncodingConvert}
          disabled={conversionDisabled}
        />

        {/* Grammar only: the other three tools rewrite wholesale and have no
            suggestion layer for a mode to govern, so a toggle there would be a
            control that does nothing. */}
        {tool === 'grammar' && (
          <ModeToggle
            value={mode}
            onChange={setMode}
            /* Locked once a result is on screen. Flipping the mode there would
               have to re-baseline every decision already made on that result,
               silently discarding them — and the two modes differ only in
               where they start, so anything Auto would have done is still one
               click away per word. Editing the text or clearing unlocks it. */
            disabled={hasResult}
            disabledHint="Finish or clear this result to change the mode"
          />
        )}

        <span
          className={`text-[11px] font-medium tabular-nums whitespace-nowrap ${
            isOverLimit ? 'text-brand-600 font-semibold' : isNearLimit ? 'text-amber-600' : 'text-ink-400'
          }`}
          aria-live="polite"
        >
          {charCount.toLocaleString()} / {maxChars.toLocaleString()}
        </span>
      </div>
    </div>
  );
}
