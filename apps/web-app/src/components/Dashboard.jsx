import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight, ArrowUpRight, Activity, Bot, Clock, Cpu, RefreshCw,
  Scale, Sparkles, Zap, History as HistoryIcon,
} from 'lucide-react';
import { Card } from './ui/Card';
import StatusBadge from './ui/StatusBadge';
import ActionButton from './ui/ActionButton';
import EmptyState from './ui/EmptyState';
import { TOOL_LIST, TOOL_META } from '../lib/toolMeta';
import { getSinLlamaHealth, getComparisonAdapters } from '../services/api';
import { getHistory } from '../lib/history';

function greeting() {
  const h = new Date().getHours();
  if (h < 5)  return 'Working late';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function StatCard({ label, value, hint, small = false }) {
  return (
    <Card className="px-4 py-3.5">
      <p className="text-[10.5px] font-bold text-ink-500 uppercase tracking-[0.12em]">{label}</p>
      <p className={`font-bold text-ink-900 mt-1 leading-tight tabular-nums truncate ${small ? 'text-[15px] pt-1' : 'text-[22px]'}`}>
        {value}
      </p>
      {hint && <p className="text-[11px] text-ink-500 mt-1.5 truncate">{hint}</p>}
    </Card>
  );
}

function StatusRow({ label, badge, detail }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-ink-100 last:border-0 last:pb-0 first:pt-0">
      <div className="min-w-0">
        <p className="text-[12.5px] font-semibold text-ink-700">{label}</p>
        {detail && <p className="text-[11px] text-ink-500 mt-0.5 truncate">{detail}</p>}
      </div>
      {badge}
    </div>
  );
}

export default function Dashboard({ onSelectTool, onQuickStart }) {
  const [history] = useState(getHistory);
  const [llamaStatus, setLlamaStatus] = useState('checking');   // online | offline | checking
  const [gatewayStatus, setGatewayStatus] = useState('checking');
  const [adapterInfo, setAdapterInfo] = useState({ mode: null, count: null });
  const [refreshing, setRefreshing] = useState(false);

  const runChecks = () => Promise.allSettled([getSinLlamaHealth(), getComparisonAdapters()]);

  const applyResults = ([health, adapters]) => {
    if (health.status === 'fulfilled') {
      setLlamaStatus(health.value?.available ? 'online' : 'offline');
    } else {
      setLlamaStatus('offline');
    }

    if (adapters.status === 'fulfilled') {
      setGatewayStatus('online');
      const groups = adapters.value?.adapters || {};
      const count = Object.values(groups).reduce((n, list) => n + (list?.length || 0), 0);
      setAdapterInfo({ mode: adapters.value?.mode || 'gpu', count });
    } else if (health.status === 'fulfilled') {
      setGatewayStatus('online');
      setAdapterInfo({ mode: null, count: null });
    } else {
      setGatewayStatus('offline');
      setAdapterInfo({ mode: null, count: null });
    }
    setRefreshing(false);
  };

  const checkStatus = async () => {
    setRefreshing(true);
    setLlamaStatus('checking');
    setGatewayStatus('checking');
    applyResults(await runChecks());
  };

  useEffect(() => {
    let cancelled = false;
    runChecks().then((results) => { if (!cancelled) applyResults(results); });
    return () => { cancelled = true; };
  }, []);

  const stats = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekAgo = now.getTime() - 7 * 86400000;
    const today = history.filter((h) => new Date(h.timestamp).getTime() >= startOfDay).length;
    const week = history.filter((h) => new Date(h.timestamp).getTime() >= weekAgo).length;
    const counts = {};
    history.forEach((h) => { counts[h.tool] = (counts[h.tool] || 0) + 1; });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return {
      total: history.length,
      today,
      week,
      counts,
      topTool: top ? (TOOL_META[top[0]]?.label ?? top[0]) : '—',
    };
  }, [history]);

  const recent = history.slice(0, 5);

  return (
    <div className="space-y-5">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden rounded-2xl bg-ink-950 text-white px-6 py-8 sm:px-8 sm:py-9 shadow-pop">
        {/* Red ambient glow + Sinhala glyph watermark */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(42rem 18rem at 85% -20%, rgba(205,25,26,0.35), transparent 60%)' }}
          aria-hidden="true"
        />
        <span
          className="pointer-events-none absolute -right-4 -bottom-14 text-[13rem] leading-none font-bold text-white/[0.045] select-none"
          style={{ fontFamily: "'Noto Sans Sinhala', sans-serif" }}
          aria-hidden="true"
        >
          සි
        </span>

        <div className="relative z-10 max-w-2xl">
          <StatusBadge
            status="brand"
            label="SinLLaMA · fine-tuned for Sinhala journalism"
            className="!bg-white/10 !text-white/85 !border-white/15 mb-4"
          />
          <h1 className="text-[1.75rem] sm:text-[2rem] font-bold tracking-tight leading-tight text-balance">
            {greeting()}, Journalist
          </h1>
          <p className="text-[13.5px] text-white/60 mt-2 max-w-lg leading-relaxed">
            Draft, refine, and publish Sinhala news faster — grammar, headlines,
            style, and summaries backed by a research-grade language model.
          </p>
          <div className="flex flex-wrap items-center gap-2.5 mt-6">
            <ActionButton variant="primary" size="lg" icon={Sparkles} onClick={() => onSelectTool('grammar')}>
              Start a grammar check
            </ActionButton>
            <ActionButton
              size="lg"
              icon={Bot}
              onClick={() => onSelectTool('sinllama')}
              className="!bg-white/10 !text-white !border-white/15 hover:!bg-white/15 hover:!border-white/25 !shadow-none"
            >
              Open playground
            </ActionButton>
          </div>
        </div>
      </section>

      {/* ── Metrics ── */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5" aria-label="Usage metrics">
        <StatCard label="Total runs" value={stats.total} hint="Across all tools" />
        <StatCard label="Today" value={stats.today} hint="Runs since midnight" />
        <StatCard label="This week" value={stats.week} hint="Last 7 days" />
        <StatCard
          label="Most used"
          small={stats.topTool !== '—'}
          value={stats.topTool}
          hint={stats.topTool === '—' ? 'No runs yet' : 'Your go-to tool'}
        />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {/* ── Left: tools + activity ── */}
        <div className="lg:col-span-2 space-y-5 min-w-0">
          <section aria-label="Writing tools">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[15px] font-bold text-ink-900 tracking-tight">Writing tools</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {TOOL_LIST.map(({ id, label, shortDesc, icon: Icon }) => (
                <Card
                  key={id}
                  hover
                  className="group text-left p-5 cursor-pointer"
                  role="button"
                  tabIndex={0}
                  id={`dashboard-${id}`}
                  onClick={() => onSelectTool(id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectTool(id); } }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center shrink-0
                      transition-colors duration-200 group-hover:bg-brand-600">
                      <Icon size={18} className="text-brand-600 transition-colors duration-200 group-hover:text-white" strokeWidth={2} />
                    </div>
                    <ArrowUpRight size={16} className="text-ink-300 transition-all duration-200 group-hover:text-brand-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </div>
                  <h3 className="text-[14px] font-bold text-ink-900 mt-3.5">{label}</h3>
                  <p className="text-[12px] text-ink-500 mt-1 leading-relaxed">{shortDesc}</p>
                  <p className="text-[11px] text-ink-400 mt-3 tabular-nums">
                    {stats.counts[id] ? `${stats.counts[id]} run${stats.counts[id] !== 1 ? 's' : ''}` : 'Not used yet'}
                  </p>
                </Card>
              ))}
            </div>
          </section>

          {/* Recent activity */}
          <section aria-label="Recent activity">
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-ink-100">
                <div className="flex items-center gap-2">
                  <Activity size={14} className="text-brand-600" />
                  <h2 className="text-[13px] font-bold text-ink-900">Recent activity</h2>
                </div>
                {history.length > 0 && (
                  <button
                    onClick={() => onSelectTool('history')}
                    className="text-[11.5px] font-semibold text-ink-500 hover:text-brand-700 cursor-pointer
                      inline-flex items-center gap-1 transition-colors"
                  >
                    View all <ArrowRight size={12} />
                  </button>
                )}
              </div>

              {recent.length === 0 ? (
                <EmptyState
                  icon={HistoryIcon}
                  title="No activity yet"
                  description="Run any writing tool and your recent work will appear here."
                  action={
                    <ActionButton size="sm" variant="secondary" onClick={() => onSelectTool('grammar')}>
                      Run your first check
                    </ActionButton>
                  }
                />
              ) : (
                <ul className="divide-y divide-ink-100">
                  {recent.map((item) => {
                    const meta = TOOL_META[item.tool];
                    const Icon = meta?.icon ?? Clock;
                    return (
                      <li key={item.id}>
                        <button
                          onClick={() => onQuickStart(item.tool, item.input)}
                          className="w-full flex items-center gap-3.5 px-5 py-3 text-left cursor-pointer
                            hover:bg-ink-50 transition-colors duration-150 group"
                          title="Reopen in tool"
                        >
                          <div className="w-8 h-8 rounded-lg bg-ink-100 text-ink-500 flex items-center justify-center shrink-0
                            group-hover:bg-brand-50 group-hover:text-brand-600 transition-colors">
                            <Icon size={14} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-bold text-ink-500 uppercase tracking-wider">
                                {meta?.label ?? item.tool}
                              </span>
                              <span className="text-[11px] text-ink-400 shrink-0 tabular-nums">{timeAgo(item.timestamp)}</span>
                            </div>
                            <p className="text-[13px] text-ink-700 truncate mt-0.5">{item.input}</p>
                          </div>
                          <ArrowUpRight size={14} className="text-ink-300 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </section>
        </div>

        {/* ── Right: status + quick start ── */}
        <div className="space-y-5 min-w-0">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-ink-100">
              <div className="flex items-center gap-2">
                <Cpu size={14} className="text-brand-600" />
                <h2 className="text-[13px] font-bold text-ink-900">System status</h2>
              </div>
              <button
                onClick={checkStatus}
                disabled={refreshing}
                className="flex items-center justify-center w-7 h-7 rounded-lg text-ink-400 hover:text-ink-700 hover:bg-ink-100
                  cursor-pointer transition-colors disabled:opacity-50"
                title="Refresh status"
                aria-label="Refresh system status"
              >
                <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
              </button>
            </div>
            <div className="px-5 py-2">
              <StatusRow
                label="API gateway"
                detail="Task endpoints for all writing tools"
                badge={
                  gatewayStatus === 'checking'
                    ? <StatusBadge status="checking" label="Checking" pulse />
                    : <StatusBadge status={gatewayStatus} label={gatewayStatus === 'online' ? 'Operational' : 'Unreachable'} />
                }
              />
              <StatusRow
                label="SinLLaMA inference"
                detail="Base model server, no adapter"
                badge={
                  llamaStatus === 'checking'
                    ? <StatusBadge status="checking" label="Checking" pulse />
                    : <StatusBadge status={llamaStatus} label={llamaStatus === 'online' ? 'Online' : 'Offline'} />
                }
              />
              <StatusRow
                label="Adapter registry"
                detail={
                  adapterInfo.count != null
                    ? `${adapterInfo.count} LoRA adapter${adapterInfo.count !== 1 ? 's' : ''} available`
                    : 'Fine-tuned task adapters'
                }
                badge={
                  gatewayStatus === 'checking'
                    ? <StatusBadge status="checking" label="Checking" pulse />
                    : adapterInfo.mode
                      ? <StatusBadge
                          status={adapterInfo.mode === 'gpu' ? 'online' : 'warning'}
                          label={adapterInfo.mode === 'gpu' ? 'GPU backend' : 'Mock mode'}
                        />
                      : <StatusBadge status="neutral" label="Unknown" />
                }
              />
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-ink-100">
              <Zap size={14} className="text-brand-600" />
              <h2 className="text-[13px] font-bold text-ink-900">Quick actions</h2>
            </div>
            <div className="p-2">
              {[
                { label: 'Compare model adapters', icon: Scale, action: () => onSelectTool('comparison') },
                { label: 'Chat with the base model', icon: Bot, action: () => onSelectTool('sinllama') },
                { label: 'Review your history', icon: HistoryIcon, action: () => onSelectTool('history') },
              ].map(({ label, icon: Icon, action }) => (
                <button
                  key={label}
                  onClick={action}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left cursor-pointer
                    text-[13px] font-medium text-ink-700 hover:bg-ink-50 hover:text-ink-900
                    transition-colors duration-150 group"
                >
                  <Icon size={15} className="text-ink-400 group-hover:text-brand-600 transition-colors" />
                  <span className="flex-1">{label}</span>
                  <ArrowRight size={13} className="text-ink-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-ink-100">
              <Sparkles size={14} className="text-brand-600" />
              <h2 className="text-[13px] font-bold text-ink-900">Try a sample</h2>
            </div>
            <div className="p-3 space-y-1">
              {TOOL_LIST.map(({ id, sampleLabel, sample }) => (
                <button
                  key={id}
                  onClick={() => onQuickStart(id, sample)}
                  className="w-full text-left px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150
                    hover:bg-brand-50 group"
                >
                  <p className="text-[12.5px] font-semibold text-ink-700 group-hover:text-brand-800">{sampleLabel}</p>
                  <p className="text-[11px] text-ink-500 mt-0.5">
                    {TOOL_META[id].label} · sample loaded for you
                  </p>
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
