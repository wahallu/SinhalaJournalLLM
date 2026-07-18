import { useState } from 'react';
import { Clock, SpellCheck, Newspaper, PenLine, FileText, Trash2, ArrowLeft, Search } from 'lucide-react';

const TOOL_ICONS = {
  grammar: SpellCheck,
  headlines: Newspaper,
  rewriter: PenLine,
  summarizer: FileText,
};

const TOOL_LABELS = {
  grammar: 'Grammar Checker',
  headlines: 'Headline Generator',
  rewriter: 'Style Rewriter',
  summarizer: 'News Summarizer',
};

const TOOL_COLORS = {
  grammar: 'bg-red-50 text-red-500',
  headlines: 'bg-orange-50 text-orange-500',
  rewriter: 'bg-purple-50 text-purple-500',
  summarizer: 'bg-cyan-50 text-cyan-500',
};

function getHistory() {
  try {
    return JSON.parse(localStorage.getItem('sinai_history') || '[]');
  } catch {
    return [];
  }
}

export function saveToHistory(tool, input) {
  const history = getHistory();
  history.unshift({
    id: Date.now(),
    tool,
    input: input.slice(0, 200),
    timestamp: new Date().toISOString(),
  });
  localStorage.setItem('sinai_history', JSON.stringify(history.slice(0, 50)));
}

export function clearHistory() {
  localStorage.removeItem('sinai_history');
}

export default function HistoryPage({ onSelectTool, onBack }) {
  const [history, setHistory] = useState(getHistory);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const filtered = history
    .filter((h) => filter === 'all' || h.tool === filter)
    .filter((h) => !search || h.input.toLowerCase().includes(search.toLowerCase()));

  const handleClear = () => {
    clearHistory();
    setHistory([]);
  };

  const formatTime = (iso) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000)    return 'Just now';
    if (diff < 3600000)  return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const allFilters = [
    { id: 'all', label: 'All' },
    ...Object.entries(TOOL_LABELS).map(([id, label]) => ({ id, label })),
  ];

  return (
    <div className="max-w-2xl">
      {/* Back button header */}
      <div className="flex items-center gap-3 mb-8">
        <button
          id="history-back"
          onClick={onBack}
          className="flex items-center justify-center w-9 h-9 rounded-xl border border-gray-200 text-gray-400
            hover:text-gray-700 hover:border-gray-300 hover:bg-gray-50
            transition-all duration-150 cursor-pointer shrink-0"
          title="Back to Dashboard"
        >
          <ArrowLeft size={17} strokeWidth={2.5} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold text-gray-900 leading-tight">History</h1>
          <p className="text-sm text-gray-400 mt-0.5">{history.length} saved entries</p>
        </div>
        {history.length > 0 && (
          <button
            id="clear-history"
            onClick={handleClear}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-gray-400 rounded-xl
              hover:text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100
              transition-all duration-150 cursor-pointer"
          >
            <Trash2 size={15} />
            <span className="hidden sm:inline">Clear all</span>
          </button>
        )}
      </div>

      {/* Search bar */}
      <div className="relative mb-4">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search history…"
          className="w-full pl-9 pr-4 py-2.5 text-[14px] border border-gray-200 rounded-xl
            focus:outline-none focus:border-gray-300 focus:ring-2 focus:ring-gray-100
            placeholder-gray-300 bg-white transition-all duration-150"
        />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 mb-6 overflow-x-auto pb-1">
        {allFilters.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap cursor-pointer
              transition-all duration-150 border
              ${filter === id
                ? 'bg-gray-900 text-white border-gray-900'
                : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50 border-transparent'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* History list */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-gray-200 rounded-2xl">
          <Clock size={36} className="mx-auto text-gray-200 mb-3" />
          <p className="text-base font-medium text-gray-400">No history found</p>
          <p className="text-sm text-gray-300 mt-1">
            {search ? 'Try a different search term' : 'Run a tool to see your history here'}
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map((item) => {
            const Icon = TOOL_ICONS[item.tool] || Clock;
            const colorClass = TOOL_COLORS[item.tool] || 'bg-gray-100 text-gray-400';
            return (
              <button
                key={item.id}
                onClick={() => onSelectTool(item.tool)}
                className="w-full flex items-start gap-4 px-4 py-3.5 rounded-xl group
                  hover:bg-gray-50 border border-transparent hover:border-gray-100
                  transition-all duration-150 text-left cursor-pointer"
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${colorClass}`}>
                  <Icon size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-gray-600">
                      {TOOL_LABELS[item.tool] || item.tool}
                    </span>
                    <span className="text-xs text-gray-300 shrink-0">{formatTime(item.timestamp)}</span>
                  </div>
                  <p className="text-[14px] text-gray-700 mt-0.5 truncate group-hover:text-gray-900 transition-colors">{item.input}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
