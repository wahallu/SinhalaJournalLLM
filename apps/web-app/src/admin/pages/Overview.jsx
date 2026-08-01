import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getOverview } from '../adminApi';

const CHART_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];

function Stat({ label, value, hint }) {
  return (
    <div className="rounded-lg border bg-card p-4" style={{ borderColor: 'var(--border)' }}>
      <p className="text-[12px] text-muted-foreground">{label}</p>
      <p className="text-[26px] font-semibold text-card-foreground mt-1 tabular-nums">{value}</p>
      {hint && <p className="text-[11.5px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}

export default function Overview() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    getOverview()
      .then((d) => active && setData(d))
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, []);

  if (error) {
    return (
      <p role="alert" className="text-[13px] text-destructive bg-accent rounded-md px-4 py-3">
        Could not load the overview: {error}
      </p>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center py-20">
        <div
          className="w-6 h-6 rounded-full border-2 animate-spin"
          style={{ borderColor: 'var(--border)', borderTopColor: 'var(--primary)' }}
          role="status"
          aria-label="Loading overview"
        />
      </div>
    );
  }

  const toolData = Object.entries(data.by_tool).map(([tool, count]) => ({ tool, count }));

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-[20px] font-semibold text-foreground">Overview</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          Users and activity across the platform.
        </p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <Stat label="Total users" value={data.total_users} />
        <Stat label="Admins" value={data.admin_count} />
        <Stat label="Suspended" value={data.suspended_count} />
        <Stat label="Requests" value={data.requests_24h} hint="last 24 hours" />
        <Stat label="Requests" value={data.requests_7d} hint="last 7 days" />
      </div>

      <section className="rounded-lg border bg-card p-5" style={{ borderColor: 'var(--border)' }}>
        <h2 className="text-[14px] font-semibold text-card-foreground mb-4">
          Requests by tool — last 7 days
        </h2>

        {toolData.length === 0 ? (
          <p className="text-[13px] text-muted-foreground py-8 text-center">
            No activity recorded yet.
          </p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={toolData} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="tool"
                  tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                  axisLine={{ stroke: 'var(--border)' }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'var(--muted)' }}
                  contentStyle={{
                    background: 'var(--popover)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    fontSize: 12,
                    color: 'var(--popover-foreground)',
                  }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {toolData.map((entry, i) => (
                    <Cell key={entry.tool} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </div>
  );
}
