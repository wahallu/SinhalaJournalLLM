import { useState, useRef } from 'react';
import { Sparkles, Eraser, Play } from 'lucide-react';
import ActionButton from './ui/ActionButton';
import CopyButton from './ui/CopyButton';

const MAX_CHARS = 2000;

export default function InputBox({
  value,
  onChange,
  placeholder,
  onSubmit,
  disabled,
  helper,
  sample,
  actionLabel = 'Run',
  loading = false,
  onRun,
  onClear,
}) {
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef(null);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onSubmit?.();
    }
  };

  const charCount = value?.length ?? 0;
  const isNearLimit = charCount > MAX_CHARS * 0.85;
  const isOverLimit = charCount > MAX_CHARS;

  const loadSample = () => {
    if (!sample) return;
    onChange(sample);
    textareaRef.current?.focus();
  };

  return (
    <div
      className={`
        relative rounded-2xl border bg-white transition-all duration-200
        ${focused
          ? 'border-brand-400 shadow-[0_0_0_3px_rgba(205,25,26,0.07)]'
          : 'border-ink-200/80 shadow-card hover:border-ink-300'}
        ${disabled ? 'opacity-60' : ''}
      `}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-ink-100">
        <span className="text-[10.5px] font-bold tracking-[0.14em] uppercase text-ink-500">
          සිංහල Input
        </span>
        {helper && (
          <span className="hidden sm:block text-[11px] text-ink-400 truncate">· {helper}</span>
        )}
        <span className="ml-auto text-[10.5px] text-ink-400 font-medium whitespace-nowrap">
          Ctrl+Enter to run
        </span>
      </div>

      <textarea
        ref={textareaRef}
        id="input-box"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        disabled={disabled}
        rows={8}
        maxLength={MAX_CHARS + 50}
        aria-label="Sinhala input text"
        className="w-full px-4 py-3.5 text-[15px] text-ink-800 placeholder:text-ink-400
          bg-transparent border-none focus:outline-none focus:ring-0
          resize-none leading-[1.8] font-sans disabled:cursor-not-allowed"
      />

      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 border-t border-ink-100">
        <span
          className={`text-[11px] font-medium tabular-nums transition-colors pl-1 ${
            isOverLimit ? 'text-brand-600 font-semibold' : isNearLimit ? 'text-amber-600' : 'text-ink-400'
          }`}
          aria-live="polite"
        >
          {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()}
        </span>

        <div className="ml-auto flex items-center gap-1.5 flex-wrap">
          {sample && (
            <ActionButton size="sm" variant="ghost" icon={Sparkles} onClick={loadSample} disabled={loading} title="Load a sample text">
              Example
            </ActionButton>
          )}
          <CopyButton text={value} label="Copy" className={!value ? 'opacity-40 pointer-events-none' : ''} />
          <ActionButton id="btn-clear" size="sm" variant="ghost" icon={Eraser} onClick={onClear} disabled={loading || !value}>
            Clear
          </ActionButton>
          <ActionButton
            id="btn-run"
            size="md"
            variant="primary"
            icon={Play}
            onClick={onRun}
            loading={loading}
            disabled={loading || !value?.trim() || isOverLimit}
          >
            {actionLabel}
          </ActionButton>
        </div>
      </div>
    </div>
  );
}
