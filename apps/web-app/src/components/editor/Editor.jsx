import { useState } from 'react';
import { Eraser, Play } from 'lucide-react';
import ActionButton from '../ui/ActionButton';
import CopyButton from '../ui/CopyButton';
import Dropdown from '../ui/Dropdown';
import EditorToolbar from './EditorToolbar';
import ConfirmModal from '../ui/ConfirmModal';
import { HEADLINE_MODELS } from '../../lib/toolOptions';

// Matches max_length on every tool request schema in apps/backend-api
// (grammar.py, style.py, summarizer.py, headline.py). The client used to
// cap at 2,000 — roughly 300 Sinhala words — well below the article
// lengths the summarizer and headline generator exist to handle.
export const MAX_CHARS = 10000;

export default function Editor({
  tool, title, icon, placeholder, actionLabel = 'Run', helper,
  value, onChange, onRun, onClear, loading = false, hasResult = false,
  settings, onSettingsChange,
}) {
  const [focused, setFocused] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const charCount = value?.length ?? 0;
  const isNearLimit = charCount > MAX_CHARS * 0.85;
  const isOverLimit = charCount > MAX_CHARS;

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onRun?.();
    }
  };

  return (
    <div
      className={`
        relative flex flex-col min-h-0 flex-1 rounded-2xl border bg-white transition-all duration-200
        ${focused
          ? 'border-brand-400 shadow-[0_0_0_3px_rgba(205,25,26,0.07)]'
          : 'border-ink-200/80 shadow-card hover:border-ink-300'}
      `}
    >
      <EditorToolbar
        tool={tool}
        title={title}
        icon={icon}
        charCount={charCount}
        maxChars={MAX_CHARS}
        isOverLimit={isOverLimit}
        isNearLimit={isNearLimit}
        hasResult={hasResult}
        settings={settings}
        onSettingsChange={onSettingsChange}
      />

      <textarea
        id="input-box"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        disabled={loading}
        maxLength={MAX_CHARS + 50}
        aria-label={`${title} input`}
        className="placeholder-legacy-sinhala flex-1 min-h-[18rem] xl:min-h-[20rem] w-full
          px-4 py-3.5 text-[15px] text-ink-800 placeholder:text-ink-400
          bg-transparent border-none focus:outline-none focus:ring-0 resize-none
          leading-[1.8] font-sinhala disabled:cursor-not-allowed"
      />

      <div className="flex items-center gap-2 px-3 py-2.5 border-t border-ink-100 shrink-0">
        {helper && (
          <span className="hidden md:block text-[11px] text-ink-400 truncate pl-1">{helper}</span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <CopyButton text={value} label="Copy" className={!value ? 'opacity-40 pointer-events-none' : ''} />
          <ActionButton id="btn-clear" size="sm" variant="ghost" icon={Eraser} onClick={() => setShowClearConfirm(true)} disabled={loading || !value}>
            Clear
          </ActionButton>
          {tool === 'headlines' && (
            <Dropdown
              id="headline-model"
              label="Model"
              options={HEADLINE_MODELS}
              value={settings.headlineModel}
              onChange={(v) => onSettingsChange({ ...settings, headlineModel: v })}
            />
          )}
          <ActionButton
            id="btn-run"
            size="md"
            variant="primary"
            icon={Play}
            onClick={onRun}
            loading={loading}
            disabled={loading || !value?.trim() || isOverLimit}
            title="Ctrl+Enter"
          >
            {actionLabel}
          </ActionButton>
        </div>
      </div>
      
      <ConfirmModal
        open={showClearConfirm}
        onOpenChange={setShowClearConfirm}
        title="Clear text"
        description="Are you sure you want to clear the editor? This cannot be undone."
        confirmLabel="Clear"
        destructive
        onConfirm={() => {
          setShowClearConfirm(false);
          onClear?.();
        }}
      />
    </div>
  );
}
