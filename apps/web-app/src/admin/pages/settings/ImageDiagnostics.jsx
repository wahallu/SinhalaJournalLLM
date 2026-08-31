import { useState } from 'react';
import { Activity, CheckCircle2, XCircle } from 'lucide-react';
import { getImageDiagnostics } from '../../adminApi';

/**
 * Self-serve answer to "why is image generation failing?".
 *
 * Exists because every failure this endpoint has had looked identical from
 * the outside: a too-short client timeout, a missing key, an unverified
 * OpenAI organisation and a genuinely unreachable network all surfaced as one
 * sentence — "Could not reach OpenAI image generation" — and telling them
 * apart took a developer reading the code each time. This asks OpenAI to
 * describe the models rather than generate one, so it is fast and bills
 * nothing.
 */
function Row({ ok, label, detail }) {
  const Icon = ok ? CheckCircle2 : XCircle;
  return (
    <div className="flex items-start gap-2 py-1.5">
      <Icon
        size={15}
        className={`mt-0.5 shrink-0 ${ok ? 'text-emerald-500' : 'text-red-500'}`}
        aria-hidden="true"
      />
      <div className="min-w-0">
        <div className="text-[13px] text-foreground">{label}</div>
        {detail ? (
          <div className="text-[12px] text-muted-foreground break-words">{detail}</div>
        ) : null}
      </div>
    </div>
  );
}

export default function ImageDiagnostics() {
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      setReport(await getImageDiagnostics());
    } catch (e) {
      setError(e.message);
      setReport(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-8 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-[14px] font-medium text-foreground">OpenAI connection</h3>
          <p className="text-[12px] text-muted-foreground">
            Checks the key, reachability, and which image models this account can use.
            Generates nothing, so it costs nothing.
          </p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px]
            rounded-md border bg-background text-foreground cursor-pointer
            disabled:opacity-60 focus:outline-none focus:ring-2"
        >
          <Activity size={14} aria-hidden="true" />
          {busy ? 'Checking…' : 'Test connection'}
        </button>
      </div>

      {error ? <p className="mt-3 text-[13px] text-red-500">{error}</p> : null}

      {report ? (
        <div className="mt-3 border-t pt-3">
          <Row ok={report.api_key_configured} label="OPENAI_API_KEY configured" />
          <Row
            ok={report.reachable}
            label="api.openai.com reachable"
            detail={report.detail}
          />
          <Row
            ok={report.request_timeout_ok}
            label={`Client timeout ${report.request_timeout_seconds}s`}
            detail={
              report.request_timeout_ok
                ? 'Above OpenAI’s documented 2-minute worst case.'
                : 'Too low — generation is aborted before it can finish, which ' +
                  'is reported as a connection failure. Must be at least 120s.'
            }
          />
          {Object.entries(report.models ?? {}).map(([name, info]) => (
            <Row
              key={name}
              ok={info.available}
              label={`${name}${name === report.selected_model ? ' (selected)' : ''}`}
              detail={info.available ? null : info.detail}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
