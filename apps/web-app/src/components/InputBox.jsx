import { useState, useRef } from 'react';

const MAX_CHARS = 2000;

export default function InputBox({ value, onChange, placeholder, onSubmit, disabled, activeTool }) {
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

  return (
    <div className="w-full">
      <div
        className={`
          relative rounded-xl border transition-all duration-200
          ${focused
            ? 'border-[#cd191a] shadow-[0_0_0_3px_rgba(205,25,26,0.08)]'
            : 'border-gray-200 shadow-sm hover:border-gray-300'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          bg-white
        `}
      >
        {/* Language badge */}
        <div className="flex items-center gap-2 px-4 pt-3 pb-1 border-b border-gray-100">
          <span className="text-[10px] font-semibold tracking-widest uppercase text-gray-400">
            සිංහල Input
          </span>
          <span className="ml-auto text-[10px] text-gray-300 font-mono">⌘↵ to run</span>
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
          className={`
            w-full px-4 py-3 text-[15px] text-gray-800 placeholder-gray-300
            bg-transparent border-none focus:outline-none focus:ring-0
            resize-none leading-relaxed font-sans
            disabled:cursor-not-allowed
          `}
        />

        {/* Footer row */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-gray-50">
          <span className="text-[11px] text-gray-300">
            {activeTool === 'grammar' && 'Paste or type Sinhala text to check grammar'}
            {activeTool === 'headlines' && 'Paste the full article to generate headlines'}
            {activeTool === 'rewriter' && 'Paste text to rewrite in a different tone'}
            {activeTool === 'summarizer' && 'Paste the article to summarize'}
          </span>
          <span
            className={`text-[11px] font-mono tabular-nums transition-colors ${
              isOverLimit
                ? 'text-red-500 font-semibold'
                : isNearLimit
                ? 'text-amber-500'
                : 'text-gray-300'
            }`}
          >
            {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}
