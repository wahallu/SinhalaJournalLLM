import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { getChats } from '../adminApi';

/**
 * Every user's tool runs in one feed, with token usage.
 *
 * Anonymous runs are never persisted (persist_if_owned), so this is
 * signed-in activity only — which is why there is no "anonymous" row here.
 */
const TOOLS = ['', 'grammar', 'headlines', 'rewriter', 'summarizer'];

const TOOL_LABEL = {
  grammar: 'Grammar',
  headlines: 'Headlines',
  rewriter: 'Rewriter',
  summarizer: 'Summarizer',
};

/** Token counts are null when the provider reported none — only sinllama
 *  does. Showing 0 there would claim a run cost nothing. */
function Tokens({ value }) {
  if (value == null) {
    return <span className="text-muted-foreground" title="This provider does not report token counts">—</span>;
  }
  return <span className="tabular-nums">{value.toLocaleString()}</span>;
}

function Row({ chat }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <tr className="border-t" style={{ borderColor: 'var(--border)' }}>
        <td className="px-3 py-2.5">
          <button
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? 'Hide full text' : 'Show full text'}
            className="flex items-center justify-center w-5 h-5 rounded text-muted-foreground
              hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
          >
            {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
        </td>
        <td className="px-3 py-2.5 text-muted-foreground tabular-nums whitespace-nowrap">
          {chat.created_at ? new Date(chat.created_at).toLocaleString() : '—'}
        </td>
        <td className="px-3 py-2.5 text-card-foreground font-mono text-[12px] whitespace-nowrap">
          {chat.user_email ?? <span className="text-muted-foreground">unknown</span>}
        </td>
        <td className="px-3 py-2.5 text-card-foreground whitespace-nowrap">
          {TOOL_LABEL[chat.tool] ?? chat.tool}
        </td>
        <td className="px-3 py-2.5 text-muted-foreground max-w-[22rem] truncate" title={chat.input_preview}>
          {chat.input_preview || '—'}
        </td>
        <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{chat.model_provider ?? '—'}</td>
        <td
          className="px-3 py-2.5 text-muted-foreground font-mono text-[11.5px] whitespace-nowrap max-w-40 truncate"
          title={chat.adapter ?? undefined}
        >
          {/* Only grammar rows carry this (schema.sql: adapter is a
              grammar_corrections-only column) — every other tool shows "—",
              same as a run with no override. */}
          {chat.adapter ?? '—'}
        </td>
        <td className="px-3 py-2.5 text-right text-muted-foreground"><Tokens value={chat.input_tokens} /></td>
        <td className="px-3 py-2.5 text-right text-muted-foreground"><Tokens value={chat.output_tokens} /></td>
        <td className="px-3 py-2.5 text-right font-medium text-card-foreground"><Tokens value={chat.total_tokens} /></td>
      </tr>

      {open && (
        <tr className="border-t bg-muted/40" style={{ borderColor: 'var(--border)' }}>
          <td />
          <td colSpan={9} className="px-3 py-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Input</p>
                <p className="text-[12.5px] text-card-foreground whitespace-pre-wrap leading-relaxed">
                  {chat.input_preview || '—'}
                </p>
              </div>
              <div>
                <p className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Output</p>
                <p className="text-[12.5px] text-card-foreground whitespace-pre-wrap leading-relaxed">
                  {chat.output_preview || '—'}
                </p>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2.5">
              Previews are truncated to 240 characters at the API.
              {chat.latency_ms != null && ` · ${chat.latency_ms} ms`}
            </p>
          </td>
        </tr>
      )}
    </>
  );
}

function Stat({ label, value, hint }) {
  return (
    <div className="rounded-lg border bg-card p-4" style={{ borderColor: 'var(--border)' }}>
      <p className="text-[12px] text-muted-foreground">{label}</p>
      <p className="text-[24px] font-semibold text-card-foreground mt-1 tabular-nums">{value}</p>
      {hint && <p className="text-[11.5px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}

export default function Chats() {
  const [chats, setChats] = useState([]);
  const [totalTokens, setTotalTokens] = useState(null);
  const [tool, setTool] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Mount only — `loading` already starts true, so nothing is set
  // synchronously here.
  useEffect(() => {
    let active = true;
    getChats({ limit: 200 })
      .then((data) => {
        if (!active) return;
        setChats(data.items ?? []);
        setTotalTokens(data.total_tokens ?? null);
        setError(null);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  // Filtering client-side: the endpoint returns one merged page across all
  // four tools, so re-fetching per tool would just discard three quarters of
  // the same response.
  const visible = useMemo(
    () => (tool ? chats.filter((c) => c.tool === tool) : chats),
    [chats, tool],
  );

  const reportedCount = useMemo(
    () => chats.filter((c) => c.total_tokens != null).length,
    [chats],
  );

  return (
    <div>
      <header className="mb-5">
        <h1 className="text-[20px] font-semibold text-foreground">Chats</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          {loading ? 'Loading…' : `${visible.length} of ${chats.length} runs across all users`}
        </p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Stat label="Runs" value={chats.length} hint="most recent 200" />
        <Stat
          label="Total tokens"
          value={totalTokens == null ? '—' : totalTokens.toLocaleString()}
          hint={totalTokens == null ? 'none reported' : `across ${reportedCount} runs`}
        />
        <Stat
          label="Avg per run"
          value={
            totalTokens == null || reportedCount === 0
              ? '—'
              : Math.round(totalTokens / reportedCount).toLocaleString()
          }
          hint="reporting runs only"
        />
        <Stat
          label="Without usage"
          value={chats.length - reportedCount}
          hint="mock / openrouter"
        />
      </div>

      <div className="flex items-center gap-2 mb-4">
        <select
          value={tool}
          onChange={(e) => setTool(e.target.value)}
          aria-label="Filter by tool"
          className="px-3 py-1.5 text-[13px] rounded-md border bg-background text-foreground
            cursor-pointer focus:outline-none focus:ring-2"
          style={{ borderColor: 'var(--input)' }}
        >
          {TOOLS.map((t) => (
            <option key={t || 'all'} value={t}>{t ? TOOL_LABEL[t] : 'All tools'}</option>
          ))}
        </select>
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
                <th className="px-3 py-2.5 w-8" />
                <th className="px-3 py-2.5 font-semibold">When</th>
                <th className="px-3 py-2.5 font-semibold">User</th>
                <th className="px-3 py-2.5 font-semibold">Tool</th>
                <th className="px-3 py-2.5 font-semibold">Input</th>
                <th className="px-3 py-2.5 font-semibold">Provider</th>
                <th className="px-3 py-2.5 font-semibold">Adapter</th>
                <th className="px-3 py-2.5 font-semibold text-right">In</th>
                <th className="px-3 py-2.5 font-semibold text-right">Out</th>
                <th className="px-3 py-2.5 font-semibold text-right">Total</th>
              </tr>
            </thead>
            <tbody className="bg-card">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">Loading…</td>
                </tr>
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">
                    No runs recorded yet. Only signed-in activity is stored — anonymous
                    runs are never persisted.
                  </td>
                </tr>
              ) : (
                visible.map((chat) => <Row key={`${chat.tool}-${chat.id}`} chat={chat} />)
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
