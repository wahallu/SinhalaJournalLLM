import { AlertCircle, CheckCircle2, Lightbulb, BookOpen } from 'lucide-react';

// ─── Settings Panels ─────────────────────────────────────────────────────────

const TONES = [
  { id: 'formal',    label: 'Formal'    },
  { id: 'editorial', label: 'Editorial' },
  { id: 'youth',     label: 'Youth'     },
];

const LENGTHS = [
  { id: 'short',  label: 'Short'  },
  { id: 'medium', label: 'Medium' },
];

const HEADLINE_COUNTS = [
  { id: 3, label: '3 Headlines' },
  { id: 5, label: '5 Headlines' },
  { id: 7, label: '7 Headlines' },
];

function OptionGroup({ label, options, value, onChange }) {
  return (
    <div className="mb-6">
      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
        {label}
      </label>
      <div className="space-y-1">
        {options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            className={`
              w-full text-left px-3.5 py-2.5 rounded-lg text-[14px] font-medium
              transition-colors duration-100 cursor-pointer
              ${value === opt.id
                ? 'bg-red-50 text-accent'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }
            `}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Grammar Suggestions Panel ────────────────────────────────────────────────

const SUGGESTION_TYPES = {
  spelling:    { label: 'Spelling',    color: 'text-red-500',    bg: 'bg-red-50',    border: 'border-red-100'    },
  grammar:     { label: 'Grammar',     color: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-100' },
  punctuation: { label: 'Punctuation', color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-100' },
  style:       { label: 'Style',       color: 'text-blue-500',   bg: 'bg-blue-50',   border: 'border-blue-100'   },
  info:        { label: 'Info',        color: 'text-gray-500',   bg: 'bg-gray-50',   border: 'border-gray-200'   },
};

function deriveSuggestions(input, output) {
  if (!output?.corrected || !input) return [];

  // Use API-provided suggestions if present
  if (Array.isArray(output.suggestions) && output.suggestions.length > 0) {
    return output.suggestions;
  }

  // Auto-derive by word-level diff
  const inputWords  = input.trim().split(/\s+/);
  const outputWords = output.corrected.trim().split(/\s+/);
  const derived = [];

  const maxLen = Math.max(inputWords.length, outputWords.length);
  for (let i = 0; i < maxLen; i++) {
    const orig = inputWords[i];
    const corr = outputWords[i];
    if (orig !== corr && orig && corr) {
      derived.push({
        type: 'grammar',
        original: orig,
        correction: corr,
        message: `"${orig}" → "${corr}"`,
      });
    }
  }

  if (derived.length === 0 && output.corrected !== input.trim()) {
    derived.push({
      type: 'style',
      message: 'Minor stylistic improvements applied',
    });
  }

  return derived;
}

function GrammarSuggestionsPanel({ output, loading, input }) {
  const suggestions = deriveSuggestions(input, output);
  const isCorrect   = output?.corrected && output.corrected === input?.trim();

  return (
    <>
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
        Suggestions
      </h2>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col gap-2.5">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-16 bg-gray-100 rounded-2xl animate-subtle-pulse" />
          ))}
        </div>
      )}

      {/* No output yet */}
      {!loading && !output && (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <BookOpen size={30} className="text-gray-200 mb-3" />
          <p className="text-sm text-gray-400 leading-relaxed">
            Run the checker to see grammar suggestions here.
          </p>
        </div>
      )}

      {/* All correct */}
      {!loading && isCorrect && (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <CheckCircle2 size={30} className="text-green-400" />
          <p className="text-sm font-medium text-gray-700">No issues found</p>
          <p className="text-xs text-gray-400">Your text looks correct.</p>
        </div>
      )}

      {/* Suggestions list */}
      {!loading && !isCorrect && suggestions.length > 0 && (
        <div className="space-y-2.5">
          <p className="text-xs text-gray-400 mb-3">
            {suggestions.length} issue{suggestions.length !== 1 ? 's' : ''} detected
          </p>
          {suggestions.map((s, i) => {
            const typeStyle = SUGGESTION_TYPES[s.type] || SUGGESTION_TYPES.info;
            return (
              <div
                key={i}
                className={`rounded-2xl border px-4 py-3.5 ${typeStyle.bg} ${typeStyle.border}`}
              >
                <div className="flex items-start gap-2.5">
                  <AlertCircle
                    size={15}
                    className={`${typeStyle.color} shrink-0 mt-0.5`}
                  />
                  <div className="min-w-0">
                    <span className={`text-[11px] font-semibold uppercase tracking-wider ${typeStyle.color}`}>
                      {typeStyle.label}
                    </span>
                    {s.original && s.correction ? (
                      <div className="mt-1 space-y-0.5">
                        <p className="text-[13px] text-gray-500 line-through">{s.original}</p>
                        <p className="text-[13px] font-medium text-gray-800">{s.correction}</p>
                      </div>
                    ) : (
                      <p className="text-[13px] text-gray-700 mt-0.5">{s.message}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tip */}
      {!loading && output && (
        <div className="mt-5 flex items-start gap-2 px-3 py-3 bg-gray-50 rounded-2xl border border-gray-100">
          <Lightbulb size={14} className="text-gray-300 shrink-0 mt-0.5" />
          <p className="text-[12px] text-gray-400 leading-relaxed">
            Review each suggestion before applying. Context matters in journalism.
          </p>
        </div>
      )}
    </>
  );
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export default function RightPanel({ activeTool, settings, onSettingsChange, output, loading, input }) {
  if (!['grammar', 'rewriter', 'summarizer', 'headlines'].includes(activeTool)) return null;

  return (
    <aside className="hidden xl:flex flex-col w-96 shrink-0 p-4">
      <div className="flex-1 rounded-2xl border border-gray-200 bg-white p-5 overflow-y-auto">
        {activeTool === 'grammar' && (
          <GrammarSuggestionsPanel output={output} loading={loading} input={input} />
        )}

        {activeTool === 'rewriter' && (
          <OptionGroup
            label="Tone"
            options={TONES}
            value={settings.tone}
            onChange={(v) => onSettingsChange({ ...settings, tone: v })}
          />
        )}

        {activeTool === 'summarizer' && (
          <OptionGroup
            label="Length"
            options={LENGTHS}
            value={settings.length}
            onChange={(v) => onSettingsChange({ ...settings, length: v })}
          />
        )}

        {activeTool === 'headlines' && (
          <OptionGroup
            label="Count"
            options={HEADLINE_COUNTS}
            value={settings.count}
            onChange={(v) => onSettingsChange({ ...settings, count: v })}
          />
        )}
      </div>
    </aside>
  );
}
