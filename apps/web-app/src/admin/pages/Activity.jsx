import { useEffect, useState } from 'react';
import { getAuditLog, getTelemetry } from '../adminApi';

const TABS = [
  { id: 'audit', label: 'Audit log' },
  { id: 'telemetry', label: 'Requests' },
];

const TOOLS = ['', 'grammar', 'headlines', 'rewriter', 'summarizer'];

/** Render a before/after jsonb pair as a readable one-line diff. */
function Diff({ before, after }) {
  const keys = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])];
  if (keys.length === 0) return <span className="text-muted-foreground">—</span>;

  return (
    <span className="font-mono text-[12px]">
      {keys.map((key, i) => (
        <span key={key}>
          {i > 0 && <span className="text-muted-foreground">, </span>}
          <span className="text-muted-foreground">{key}: </span>
          <span className="text-muted-foreground line-through">
            {JSON.stringify(before?.[key]) ?? '—'}
          </span>
          <span className="text-muted-foreground"> → </span>
          <span className="text-foreground">{JSON.stringify(after?.[key]) ?? '—'}</span>
        </span>
      ))}
    </span>
  );
}

function Empty({ children }) {
  return (
    <tr>
      <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground text-[13px]">
        {children}
      </td>
    </tr>
  );
}

export default function Activity() {
  const [tab, setTab] = useState('audit');
  const [tool, setTool] = useState('');
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;

    (async () => {
      setLoading(true);
      try {
        const data = tab === 'audit' ? await getAuditLog() : await getTelemetry({ tool });
        if (!active) return;
        setRows(data.items ?? []);
        setTotal(data.total ?? 0);
        setError(null);
      } catch (e) {
        if (active) setError(e.message);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [tab, tool]);

  return (
    <div>
      <header className="mb-5">
        <h1 className="text-[20px] font-semibold text-foreground">Activity</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          {loading ? 'Loading…' : `${total} ${total === 1 ? 'entry' : 'entries'}`}
        </p>
      </header>

      <div className="flex items-center gap-2 mb-4" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-md text-[13px] font-medium cursor-pointer transition-colors ${
              tab === t.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-foreground hover:opacity-80'
            }`}
          >
            {t.label}
          </button>
        ))}

        {tab === 'telemetry' && (
          <select
            value={tool}
            onChange={(e) => setTool(e.target.value)}
            aria-label="Filter by tool"
            className="ml-auto px-3 py-1.5 text-[13px] rounded-md border bg-background
              text-foreground cursor-pointer focus:outline-none focus:ring-2"
            style={{ borderColor: 'var(--input)' }}
          >
            {TOOLS.map((t) => (
              <option key={t || 'all'} value={t}>
                {t || 'All tools'}
              </option>
            ))}
          </select>
        )}
      </div>

      {error && (
        <p role="alert" className="text-[13px] text-destructive bg-accent rounded-md px-4 py-3 mb-4">
          {error}
        </p>
      )}

      <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-muted">
              <tr className="text-left text-muted-foreground">
                {tab === 'audit' ? (
                  <>
                    <th className="px-4 py-2.5 font-semibold">When</th>
                    <th className="px-4 py-2.5 font-semibold">Who</th>
                    <th className="px-4 py-2.5 font-semibold">Action</th>
                    <th className="px-4 py-2.5 font-semibold">Target</th>
                    <th className="px-4 py-2.5 font-semibold">Change</th>
                  </>
                ) : (
                  <>
                    <th className="px-4 py-2.5 font-semibold">When</th>
                    <th className="px-4 py-2.5 font-semibold">Tool</th>
                    <th className="px-4 py-2.5 font-semibold">Provider</th>
                    <th className="px-4 py-2.5 font-semibold">Status</th>
                    <th className="px-4 py-2.5 font-semibold">Latency</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="bg-card">
              {loading ? (
                <Empty>Loading…</Empty>
              ) : rows.length === 0 ? (
                <Empty>
                  {tab === 'audit'
                    ? 'No privileged actions recorded yet. Changes made from the admin dashboard appear here.'
                    : 'No requests recorded yet.'}
                </Empty>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                    <td className="px-4 py-2.5 text-muted-foreground tabular-nums whitespace-nowrap">
                      {row.created_at ? new Date(row.created_at).toLocaleString() : '—'}
                    </td>
                    {tab === 'audit' ? (
                      <>
                        <td className="px-4 py-2.5 text-card-foreground font-mono text-[12px]">
                          {row.actor_email}
                        </td>
                        <td className="px-4 py-2.5 text-card-foreground">{row.action}</td>
                        <td className="px-4 py-2.5 text-muted-foreground font-mono text-[12px]">
                          {row.target_type}/{String(row.target_id ?? '').slice(0, 12)}
                        </td>
                        <td className="px-4 py-2.5">
                          <Diff before={row.before} after={row.after} />
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-2.5 text-card-foreground">{row.tool ?? '—'}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{row.provider ?? '—'}</td>
                        <td className="px-4 py-2.5 tabular-nums">
                          <span className={row.status_code >= 400 ? 'text-destructive' : 'text-muted-foreground'}>
                            {row.status_code}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground tabular-nums">
                          {row.latency_ms != null ? `${row.latency_ms} ms` : '—'}
                        </td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
