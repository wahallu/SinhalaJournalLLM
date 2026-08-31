import { useState } from 'react';
import { Eraser, Play } from 'lucide-react';
import ActionButton from '../ui/ActionButton';
import CopyButton from '../ui/CopyButton';
import Dropdown from '../ui/Dropdown';
import EditorToolbar from './EditorToolbar';
import ConfirmModal from '../ui/ConfirmModal';
import HeadlineModelTour from '../HeadlineModelTour';
import { HEADLINE_MODELS } from '../../lib/toolOptions';
import { convertSinhalaEncoding, hasSinhalaUnicode } from '../../lib/sinhalaLegacy';

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
  const [encodingOverride, setEncodingOverride] = useState('unknown');
  const [conversionStatus, setConversionStatus] = useState('');

  const charCount = value?.length ?? 0;
  const isNearLimit = charCount > MAX_CHARS * 0.85;
  const isOverLimit = charCount > MAX_CHARS;
  const encoding = !value
    ? 'unknown'
    : (hasSinhalaUnicode(value) ? 'unicode' : encodingOverride);
  const isLegacy = encoding === 'legacy';

  const handleEncodingConvert = (direction) => {
    const converted = convertSinhalaEncoding(value, direction);
    onChange(converted);
    const target = direction === 'legacy-to-unicode' ? 'unicode' : 'legacy';
    setEncodingOverride(target);
    setConversionStatus(
      target === 'unicode'
        ? 'Converted legacy Sinhala to Unicode.'
        : 'Converted Unicode Sinhala to legacy FM-compatible text.',
    );
  };

  const handleEncodingChange = (target) => {
    if (target === encoding) return;

    if (encoding === 'unknown' && target === 'legacy') {
      setEncodingOverride('legacy');
      setConversionStatus('Text marked as legacy FM-compatible encoding.');
      return;
    }

    handleEncodingConvert(
      target === 'unicode' ? 'legacy-to-unicode' : 'unicode-to-legacy',
    );
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (!loading && value?.trim() && !isOverLimit && !isLegacy) onRun?.();
    }
  };

  return (
    <div
      className={`
        relative flex flex-col min-h-0 flex-1 rounded-2xl border bg-white dark:bg-ink-50 transition-all duration-200
        ${focused
          ? 'border-brand-300 shadow-[0_0_0_3px_rgba(205,25,26,0.07)]'
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
        encoding={encoding}
        onEncodingChange={handleEncodingChange}
        conversionDisabled={loading || !value}
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
        spellCheck={!isLegacy}
        autoCorrect={isLegacy ? 'off' : undefined}
        autoCapitalize={isLegacy ? 'off' : undefined}
        data-gramm={isLegacy ? 'false' : undefined}
        data-gramm_editor={isLegacy ? 'false' : undefined}
        data-enable-grammarly={isLegacy ? 'false' : undefined}
        maxLength={MAX_CHARS + 50}
        aria-label={`${title} input${isLegacy ? ', legacy FM-compatible encoding' : ''}`}
        className="placeholder-legacy-sinhala flex-1 min-h-[18rem] xl:min-h-[20rem] w-full
          px-4 py-3.5 text-[15px] text-ink-800 placeholder:text-ink-400
          bg-transparent border-none focus:outline-none focus:ring-0 resize-none
          leading-[1.8] font-sinhala disabled:cursor-not-allowed"
        style={{ fontFamily: isLegacy ? 'UBIN16S, sans-serif' : undefined }}
      />

      <span className="sr-only" role="status" aria-live="polite">
        {conversionStatus}
      </span>

      <div className="flex items-center gap-2 px-3 py-2.5 border-t border-ink-100 shrink-0">
        {helper && (
          <span className="hidden md:block text-[11px] text-ink-400 truncate pl-1">
            {isLegacy ? 'Legacy text is ready to copy; convert it to Unicode before running this tool' : helper}
          </span>
        )}
        <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
          <CopyButton text={value} label="Copy" className={!value ? 'opacity-40 pointer-events-none' : ''} />
          <ActionButton id="btn-clear" size="sm" variant="ghost" icon={Eraser} onClick={() => setShowClearConfirm(true)} disabled={loading || !value}>
            Clear
          </ActionButton>
          {tool === 'headlines' && (
            <div className="relative shrink-0">
              <HeadlineModelTour />
              <Dropdown
                id="headline-model"
                label="Model"
                options={HEADLINE_MODELS}
                value={settings.headlineModel}
                onChange={(v) => onSettingsChange({ ...settings, headlineModel: v })}
                className="min-w-[8.5rem] justify-between"
              />
            </div>
          )}
          <ActionButton
            id="btn-run"
            size="md"
            variant="primary"
            icon={Play}
            onClick={onRun}
            loading={loading}
            disabled={loading || !value?.trim() || isOverLimit || isLegacy}
            title={isLegacy ? 'Convert this text to Unicode before running the AI tool' : 'Ctrl+Enter'}
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
          setEncodingOverride('unknown');
          setConversionStatus('');
          onClear?.();
        }}
      />
    </div>
  );
}
