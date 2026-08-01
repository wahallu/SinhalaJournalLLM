import { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { getAdapters, getSettings, updateSetting } from '../adminApi';
import ConfirmDialog from '../ConfirmDialog';

const CONTROL = `px-3 py-1.5 text-[13px] rounded-md border bg-background text-foreground
  cursor-pointer focus:outline-none focus:ring-2`;

/**
 * Changes that alter what users can do, rather than just a default, get the
 * destructive treatment in the confirmation — turning a tool off or moving
 * the model provider is a platform-wide change, not a preference.
 */
function isHighImpact(key) {
  return key.startsWith('features.') || key === 'model.provider';
}

function describeChange(setting, next) {
  if (setting.kind === 'bool') return next ? 'enabled' : 'disabled';
  if (setting.kind === 'adapter') return next || 'newest available';
  return String(next);
}

export default function Settings() {
  const [settings, setSettings] = useState([]);
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  // Adapter options come from the model server, not the settings registry —
  // folders can be added or removed there without this service knowing.
  const [adapters, setAdapters] = useState(null);
  const [adaptersError, setAdaptersError] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await getAdapters();
        if (active) setAdapters(data.adapters ?? {});
      } catch (e) {
        // The GPU box being down must not block the rest of the page.
        if (active) setAdaptersError(e.message);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await getSettings();
        if (active) setSettings(data);
      } catch (e) {
        if (active) setError(e.message);
      }
    })();
    return () => {
      active = false;
    };
  }, [refreshKey]);

  const commit = async () => {
    setBusy(true);
    setDialogError(null);
    try {
      await updateSetting(pending.key, pending.next);
      setPending(null);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      setDialogError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const propose = (setting, next) =>
    setPending({
      key: setting.key,
      next,
      current: describeChange(setting, setting.value),
      nextLabel: describeChange(setting, next),
      title: setting.key,
      description: setting.description,
      destructive: isHighImpact(setting.key) && (next === false || setting.kind === 'enum'),
    });

  if (error) {
    return (
      <p role="alert" className="text-[13px] text-destructive bg-accent rounded-md px-4 py-3">
        Could not load settings: {error}
      </p>
    );
  }

  // Grouped by the server-provided group so a new key appears without a
  // frontend change.
  const groups = settings.reduce((acc, s) => {
    (acc[s.group] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-[20px] font-semibold text-foreground">Settings</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          Applied immediately, without a redeploy. Every change is recorded in the audit log.
        </p>
      </header>

      <div className="space-y-5">
        {Object.entries(groups).map(([group, items]) => (
          <section
            key={group}
            className="rounded-lg border bg-card"
            style={{ borderColor: 'var(--border)' }}
          >
            <h2 className="text-[14px] font-semibold text-card-foreground px-5 pt-4 pb-2">
              {group}
            </h2>

            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {items.map((s) => (
                <div
                  key={s.key}
                  className="px-5 py-3.5 flex items-start justify-between gap-6"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <code className="text-[12.5px] font-mono text-card-foreground">{s.key}</code>
                      {s.is_overridden && (
                        <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold
                          px-1.5 py-0.5 rounded bg-accent text-accent-foreground">
                          <RotateCcw size={9} /> changed
                        </span>
                      )}
                    </div>
                    <p className="text-[12.5px] text-muted-foreground mt-1">{s.description}</p>
                    {!s.is_overridden && (
                      <p className="text-[11.5px] text-muted-foreground mt-0.5">
                        Default: <span className="font-mono">{String(s.default)}</span>
                      </p>
                    )}
                  </div>

                  <div className="shrink-0">
                    {s.kind === 'bool' && (
                      <select
                        value={s.value ? 'on' : 'off'}
                        onChange={(e) => propose(s, e.target.value === 'on')}
                        aria-label={s.key}
                        className={CONTROL}
                        style={{ borderColor: 'var(--input)' }}
                      >
                        <option value="on">Enabled</option>
                        <option value="off">Disabled</option>
                      </select>
                    )}

                    {s.kind === 'enum' && (
                      <select
                        value={s.value}
                        onChange={(e) => propose(s, e.target.value)}
                        aria-label={s.key}
                        className={CONTROL}
                        style={{ borderColor: 'var(--input)' }}
                      >
                        {s.choices.map((choice) => (
                          <option key={choice} value={choice}>
                            {choice}
                          </option>
                        ))}
                      </select>
                    )}

                    {s.kind === 'adapter' && (
                      adaptersError ? (
                        <p className="text-[12px] text-muted-foreground max-w-56 text-right">
                          Model server unreachable — cannot list adapters.
                          {s.value ? ` Currently: ${s.value}` : ' Using newest available.'}
                        </p>
                      ) : (
                        <select
                          value={s.value || ''}
                          onChange={(e) => propose(s, e.target.value)}
                          aria-label={s.key}
                          disabled={!adapters}
                          className={CONTROL}
                          style={{ borderColor: 'var(--input)' }}
                        >
                          <option value="">Newest available</option>
                          {(adapters?.[s.task] ?? []).map((name) => (
                            <option key={name} value={name}>
                              {name}
                            </option>
                          ))}
                          {/* A stored value the server no longer offers still
                              needs to be selectable, or the control would
                              silently show something else. */}
                          {s.value && !(adapters?.[s.task] ?? []).includes(s.value) && (
                            <option value={s.value}>{s.value} (not on server)</option>
                          )}
                        </select>
                      )
                    )}

                    {s.kind === 'int' && (
                      <input
                        type="number"
                        defaultValue={s.value}
                        min={s.minimum ?? undefined}
                        max={s.maximum ?? undefined}
                        aria-label={s.key}
                        onBlur={(e) => {
                          const next = Number(e.target.value);
                          if (Number.isInteger(next) && next !== s.value) propose(s, next);
                        }}
                        className={`${CONTROL} w-24`}
                        style={{ borderColor: 'var(--input)' }}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <ConfirmDialog
        open={Boolean(pending)}
        title={`Change ${pending?.title}?`}
        description={pending?.description}
        current={pending?.current}
        next={pending?.nextLabel}
        confirmLabel="Apply change"
        destructive={pending?.destructive}
        busy={busy}
        error={dialogError}
        onConfirm={commit}
        onCancel={() => {
          setPending(null);
          setDialogError(null);
          // Re-read so a cancelled control snaps back to the stored value.
          setRefreshKey((k) => k + 1);
        }}
      />
    </div>
  );
}
