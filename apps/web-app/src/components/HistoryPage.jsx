import { useCallback, useEffect, useState } from 'react';
import { Clock, SpellCheck, Newspaper, PenLine, FileText, Trash2, CloudOff, RefreshCw } from 'lucide-react';
import { getUnifiedHistory } from '../services/api';
import { clearHistory, getLocalHistory } from '../services/localHistory';

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

export default function HistoryPage({ onSelectTool }) {
  const [items, setItems] = useState([]);
  const [source, setSource] = useState('loading'); // loading | server | local
  const [filter, setFilter] = useState('all');

  // setState only runs inside promise callbacks, never synchronously in the
  // effect body — keeps react-hooks/set-state-in-effect satisfied.
  const load = useCallback(() => {
    getUnifiedHistory(50)
      .then((data) => {
        setItems(
          data.items.map((item) => ({
            id: item.id,
            tool: item.tool,
            input: item.input_preview,
            output: item.output_preview,
            timestamp: item.created_at,
            provider: item.model_provider,
          }))
        );
        setSource('server');
      })
      .catch(() => {
        setItems(getLocalHistory());
        setSource('local');
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = () => {
    setSource('loading');
    load();
  };

  const filtered = filter === 'all' ? items : items.filter((h) => h.tool === filter);

  const handleClear = () => {
    clearHistory();
    if (source === 'local') setItems([]);
  };

  const formatTime = (iso) => {
    if (!iso) return '';
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">History</h1>
          <p className="text-base text-gray-400 mt-1 flex items-center gap-2">
            {items.length} entries
            {source === 'local' && (
              <span className="inline-flex items-center gap-1 text-xs text-amber-500 bg-amber-50 px-2 py-0.5 rounded-full">
                <CloudOff size={11} /> offline — showing local history
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            id="refresh-history"
            onClick={refresh}
            className="p-2.5 text-gray-400 rounded-lg hover:text-gray-600 hover:bg-gray-50
              transition-colors duration-100 cursor-pointer"
            title="Refresh"
          >
            <RefreshCw size={15} className={source === 'loading' ? 'animate-spin' : ''} />
          </button>
          {source === 'local' && items.length > 0 && (
            <button
              id="clear-history"
              onClick={handleClear}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-400 rounded-lg
                hover:text-red-500 hover:bg-red-50 transition-colors duration-100 cursor-pointer"
            >
              <Trash2 size={15} />
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 mb-6 overflow-x-auto flex-wrap">
        {allFilters.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap cursor-pointer
              transition-colors duration-100
              ${filter === id ? 'bg-gray-100 text-gray-800' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* History list */}
      {source === 'loading' ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-16 bg-gray-50 rounded-xl animate-subtle-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Clock size={36} className="mx-auto text-gray-200 mb-3" />
          <p className="text-base text-gray-400">No history yet</p>
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map((item) => {
            const Icon = TOOL_ICONS[item.tool] || Clock;
            return (
              <button
                key={`${item.tool}-${item.id}`}
                onClick={() => onSelectTool(item.tool)}
                className="w-full flex items-start gap-4 px-4 py-3.5 rounded-xl
                  hover:bg-gray-50 transition-colors duration-100 text-left cursor-pointer"
              >
                <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon size={16} className="text-gray-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-gray-500">
                      {TOOL_LABELS[item.tool] || item.tool}
                      {item.provider && (
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-gray-300">
                          {item.provider}
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-gray-300 shrink-0">{formatTime(item.timestamp)}</span>
                  </div>
                  <p className="text-[15px] text-gray-700 mt-0.5 truncate">{item.input}</p>
                  {item.output && (
                    <p className="text-[13px] text-gray-400 mt-0.5 truncate">→ {item.output}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
