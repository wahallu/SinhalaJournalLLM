import { useEffect, useState } from 'react';
import { Clock, ArrowLeft, Search, ArrowUpRight, History as HistoryIcon, CornerDownRight } from 'lucide-react';
import PageHeader from './ui/PageHeader';
import ActionButton from './ui/ActionButton';
import EmptyState from './ui/EmptyState';
import CopyButton from './ui/CopyButton';
import { Card } from './ui/Card';
import { TOOL_META } from '../lib/toolMeta';
import { getUnifiedHistory } from '../services/api';

function formatTime(iso) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60000)    return 'Just now';
  if (diff < 3600000)  return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function dayGroup(iso) {
  const d = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const t = d.getTime();
  if (t >= startOfToday) return 'Today';
  if (t >= startOfToday - 86400000) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export default function HistoryPage({ onRerun, onBack }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let active = true;
    getUnifiedHistory()
      .then((data) => {
        if (!active) return;
        // Server shape → the fields this page renders.
        setHistory(
          (data.items ?? []).map((item) => ({
            id: item.id,
            tool: item.tool,
            input: item.input_preview ?? '',
            result: item.output_preview ?? '',
            timestamp: item.created_at,
          }))
        );
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filtered = history
    .filter((h) => filter === 'all' || h.tool === filter)
    .filter((h) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return h.input.toLowerCase().includes(q) || (h.result || '').toLowerCase().includes(q);
    });

  // Group entries by day, preserving order
  const groups = [];
  filtered.forEach((item) => {
    const g = dayGroup(item.timestamp);
    const last = groups[groups.length - 1];
    if (last && last.label === g) last.items.push(item);
    else groups.push({ label: g, items: [item] });
  });

  const allFilters = [
    { id: 'all', label: 'All' },
    ...Object.values(TOOL_META).map(({ id, label }) => ({ id, label })),
  ];

  return (
    <div>
      <PageHeader
        icon={HistoryIcon}
        title="History"
        description={
          loading
            ? 'Loading your activity…'
            : `${history.length} saved ${history.length === 1 ? 'entry' : 'entries'} — synced to your account.`
        }
        actions={
          <ActionButton id="history-back" size="sm" variant="ghost" icon={ArrowLeft} onClick={onBack}>
            Dashboard
          </ActionButton>
        }
      />

      {/* Search */}
      <div className="relative mb-3">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search inputs and results…"
          aria-label="Search history"
          className="w-full pl-9.5 pr-4 py-2.5 text-[13.5px] border border-ink-200 rounded-xl bg-white
            placeholder:text-ink-400 transition-all duration-150
            focus:outline-none focus:border-brand-400 focus:shadow-[0_0_0_3px_rgba(205,25,26,0.07)]"
        />
      </div>

      {/* Filter chips */}
      <div className="flex gap-1.5 mb-6 overflow-x-auto pb-1" role="tablist" aria-label="Filter by tool">
        {allFilters.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            role="tab"
            aria-selected={filter === id}
            className={`px-3.5 py-1.5 rounded-full text-[12.5px] font-semibold whitespace-nowrap cursor-pointer
              transition-all duration-150 border
              ${filter === id
                ? 'bg-ink-900 text-white border-ink-900'
                : 'text-ink-500 bg-white hover:text-ink-800 hover:bg-ink-50 border-ink-200'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Feed */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div
            className="w-6 h-6 rounded-full border-2 border-ink-200 border-t-brand-600 animate-spin"
            role="status"
            aria-label="Loading history"
          />
        </div>
      ) : error ? (
        <p role="alert" className="text-[13px] text-brand-700 bg-brand-50 rounded-xl px-4 py-3">
          Could not load your history: {error}
        </p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-300/70">
          <EmptyState
            icon={Clock}
            title={search || filter !== 'all' ? 'No matching entries' : 'No history yet'}
            description={
              search
                ? 'Try a different search term or clear the filters.'
                : 'Run any writing tool while signed in and your work is saved here automatically.'
            }
          />
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(({ label, items }) => (
            <section key={label} aria-label={label}>
              <h2 className="text-[10.5px] font-bold text-ink-500 uppercase tracking-[0.14em] mb-2 px-1">
                {label}
              </h2>
              <div className="space-y-2">
                {items.map((item) => {
                  const meta = TOOL_META[item.tool];
                  const Icon = meta?.icon ?? Clock;
                  return (
                    <Card key={item.id} hover className="group px-4 py-3.5">
                      <div className="flex items-start gap-3.5">
                        <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0 mt-0.5">
                          <Icon size={15} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-ink-500 uppercase tracking-wider">
                              {meta?.label ?? item.tool}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-[11px] text-ink-400 tabular-nums mr-1">{formatTime(item.timestamp)}</span>
                              <CopyButton text={item.input} label="" className="!px-1.5 opacity-0 group-hover:opacity-100" />
                              <button
                                onClick={() => onRerun?.(item.tool, item.input)}
                                title="Reopen in tool"
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11.5px] font-semibold
                                  text-ink-500 hover:text-brand-700 hover:bg-brand-50 cursor-pointer
                                  transition-colors opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                              >
                                Reopen <ArrowUpRight size={12} />
                              </button>
                            </div>
                          </div>
                          <p className="text-[13.5px] text-ink-800 mt-1 line-clamp-2 leading-relaxed">{item.input}</p>
                          {item.result && (
                            <p className="flex items-start gap-1.5 text-[12px] text-ink-500 mt-1.5 line-clamp-1">
                              <CornerDownRight size={11} className="shrink-0 mt-0.5 text-ink-300" />
                              {item.result}
                            </p>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
