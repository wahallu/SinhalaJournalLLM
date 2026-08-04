import { useEffect, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { getAnalytics, getOverview } from '../adminApi';
import SystemStatusPanel from '../SystemStatusPanel';
import { Skeleton } from '../../components/ui/Skeleton';

const CHART_COLORS = [
  'var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)',
];

const RANGES = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
];

const AXIS = { fontSize: 12, fill: 'var(--muted-foreground)' };
const TOOLTIP_STYLE = {
  background: 'var(--popover)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  fontSize: 12,
  color: 'var(--popover-foreground)',
};

function Stat({ label, value, hint }) {
  return (
    <div className="rounded-lg border bg-card p-4" style={{ borderColor: 'var(--border)' }}>
      <p className="text-[12px] text-muted-foreground">{label}</p>
      <p className="text-[26px] font-semibold text-card-foreground mt-1 tabular-nums">{value}</p>
      {hint && <p className="text-[11.5px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}

function Panel({ title, note, children, empty }) {
  return (
    <section className="rounded-lg border bg-card p-5" style={{ borderColor: 'var(--border)' }}>
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <h2 className="text-[14px] font-semibold text-card-foreground">{title}</h2>
        {note && <span className="text-[11.5px] text-muted-foreground">{note}</span>}
      </div>
      {empty ? (
        <p className="text-[13px] text-muted-foreground py-10 text-center">{empty}</p>
      ) : (
        <div className="h-56">{children}</div>
      )}
    </section>
  );
}

function OverviewSkeleton() {
  return (
    <div role="status" aria-label="Loading overview">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-3.5 w-56" />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-lg border bg-card p-4" style={{ borderColor: 'var(--border)' }}>
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-6 w-12 mt-2" />
          </div>
        ))}
      </div>

      <div className="space-y-5">
        <div className="rounded-lg border bg-card p-5" style={{ borderColor: 'var(--border)' }}>
          <Skeleton className="h-4 w-32 mb-4" />
          <Skeleton className="h-20 w-full" />
        </div>

        <div className="rounded-lg border bg-card p-5" style={{ borderColor: 'var(--border)' }}>
          <Skeleton className="h-4 w-40 mb-4" />
          <Skeleton className="h-56 w-full" />
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-lg border bg-card p-5" style={{ borderColor: 'var(--border)' }}>
              <Skeleton className="h-4 w-24 mb-4" />
              <Skeleton className="h-56 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Overview() {
  const [counts, setCounts] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [days, setDays] = useState(30);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [c, a] = await Promise.all([getOverview(), getAnalytics(days)]);
        if (!active) return;
        setCounts(c);
        setAnalytics(a);
        setError(null);
      } catch (e) {
        if (active) setError(e.message);
      }
    })();
    return () => {
      active = false;
    };
  }, [days]);

  if (error) {
    return (
      <p role="alert" className="text-[13px] text-destructive bg-accent rounded-md px-4 py-3">
        Could not load the overview: {error}
      </p>
    );
  }

  if (!counts || !analytics) return <OverviewSkeleton />;

  const toolData = Object.entries(analytics.by_tool ?? {}).map(([tool, count]) => ({ tool, count }));
  const providerData = Object.entries(analytics.by_provider ?? {})
    .map(([provider, count]) => ({ provider, count }));
  const totalRequests = (analytics.series ?? []).reduce((sum, d) => sum + d.requests, 0);
  const totalErrors = (analytics.series ?? []).reduce((sum, d) => sum + d.errors, 0);
  const errorRate = totalRequests ? ((totalErrors / totalRequests) * 100).toFixed(1) : '0.0';

  // Say which source the numbers came from — before the nightly rollup has
  // ever run these are a live scan, and an operator should not have to guess
  // why a fresh install looks thin.
  const sourceNote =
    analytics.source === 'usage_daily' ? 'from daily rollup' : 'live scan — rollup not yet run';

  return (
    <div>
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-semibold text-foreground">Overview</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Users and activity across the platform.
          </p>
        </div>
        <div className="flex gap-1" role="group" aria-label="Date range">
          {RANGES.map((r) => (
            <button
              key={r.days}
              onClick={() => setDays(r.days)}
              aria-pressed={days === r.days}
              className={`px-2.5 py-1 rounded-md text-[12.5px] font-medium cursor-pointer transition-colors ${
                days === r.days
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-foreground hover:opacity-80'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        <Stat label="Total users" value={counts.total_users} />
        <Stat label="Admins" value={counts.admin_count} />
        <Stat label="Suspended" value={counts.suspended_count} />
        <Stat label="Requests" value={totalRequests} hint={`last ${days} days`} />
        <Stat label="Error rate" value={`${errorRate}%`} hint={`${totalErrors} failed`} />
      </div>

      <div className="space-y-5">
        <SystemStatusPanel />

        <Panel
          title="Requests over time"
          note={sourceNote}
          empty={totalRequests === 0 ? 'No activity recorded in this range yet.' : null}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={analytics.series} margin={{ top: 4, right: 8, bottom: 4, left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="day"
                tick={AXIS}
                axisLine={{ stroke: 'var(--border)' }}
                tickLine={false}
                tickFormatter={(d) => String(d).slice(5)}
                minTickGap={24}
              />
              <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ stroke: 'var(--border)' }} />
              <Line
                type="monotone" dataKey="requests" stroke="var(--chart-1)"
                strokeWidth={2} dot={false} name="Requests"
              />
              <Line
                type="monotone" dataKey="errors" stroke="var(--chart-5)"
                strokeWidth={2} dot={false} name="Errors"
              />
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        <div className="grid gap-5 lg:grid-cols-2">
          <Panel
            title="By tool"
            empty={toolData.length === 0 ? 'Nothing recorded yet.' : null}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={toolData} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="tool" tick={AXIS} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
                <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'var(--muted)' }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {toolData.map((entry, i) => (
                    <Cell key={entry.tool} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Panel>

          <Panel
            title="By provider"
            empty={providerData.length === 0 ? 'Nothing recorded yet.' : null}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={providerData} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="provider" tick={AXIS} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
                <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'var(--muted)' }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {providerData.map((entry, i) => (
                    <Cell key={entry.provider} fill={CHART_COLORS[(i + 2) % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Panel>
        </div>
      </div>
    </div>
  );
}
