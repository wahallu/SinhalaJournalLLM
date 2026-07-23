import { Wand2 } from 'lucide-react';
import ActionButton from './ui/ActionButton';
import CopyButton from './ui/CopyButton';
import LoadingSpinner from './LoadingSpinner';

const MAX_PROMPT_LENGTH = 2000;

/**
 * PromptInput component
 * Handles prompt input text area up to 2000 characters,
 * line break preservation conversion, copy prompt button,
 * character count, and generate button states.
 */
export default function PromptInput({
  value,
  onChange,
  onGenerate,
  disabled = false,
  loading = false,
  maxLength = MAX_PROMPT_LENGTH,
  placeholder = 'Describe the image you want to generate (e.g., A futuristic cyberpunk city at sunset with neon reflections)...',
}) {
  const currentLength = value ? value.length : 0;
  const isOverLimit = currentLength > maxLength;
  const canGenerate = value && value.trim().length > 0 && !isOverLimit && !loading && !disabled;

  const handleKeyDown = (e) => {
    // Generate on Cmd/Ctrl + Enter
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (canGenerate) {
        onGenerate();
      }
    }
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor="prompt-textbox" className="text-xs font-semibold text-ink-700 uppercase tracking-wider">
          Prompt Input
        </label>
        <div className="flex items-center gap-2">
          {value && <CopyButton text={value} label="Copy prompt" />}
          <span
            className={`text-xs tabular-nums font-medium ${
              isOverLimit ? 'text-brand-600 font-bold' : 'text-ink-400'
            }`}
          >
            {currentLength} / {maxLength}
          </span>
        </div>
      </div>

      <div className="relative">
        <textarea
          id="prompt-textbox"
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
          onKeyDown={handleKeyDown}
          disabled={disabled || loading}
          rows={4}
          maxLength={maxLength}
          placeholder={placeholder}
          className={`w-full px-3.5 py-3 text-[14px] text-ink-900 bg-white border rounded-xl shadow-xs resize-y
            focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500
            disabled:bg-ink-50 disabled:text-ink-400 font-sans leading-relaxed transition-all
            ${isOverLimit ? 'border-brand-500' : 'border-ink-200'}`}
        />
      </div>

      <div className="flex items-center justify-between gap-3 pt-1">
        <p className="text-xs text-ink-400">
          Supports up to 2000 chars, emojis, quotes, commas & line breaks. Press <kbd className="px-1.5 py-0.5 text-[10px] bg-ink-100 border rounded text-ink-600 font-mono">⌘+Enter</kbd> to generate.
        </p>
        <ActionButton
          variant="primary"
          size="md"
          icon={loading ? undefined : Wand2}
          onClick={onGenerate}
          disabled={!canGenerate}
          className="shrink-0 font-semibold"
        >
          {loading ? <LoadingSpinner size={16} label="Generating..." className="!text-white" /> : 'Generate'}
        </ActionButton>
      </div>
    </div>
  );
}
