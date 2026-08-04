import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { getSinLlamaHealth, getComparisonAdapters } from '../services/api';
import { ShimmerDot } from '../components/ui/Skeleton';

/**
 * Inference-stack health, on the admin console.
 *
 * Moved off the user dashboard: whether the GPU box is reachable and how
 * many adapters it has loaded is an operator's concern, and a journalist
 * could do nothing with the answer. Both endpoints are public reads
 * (GET /sinllama/health, GET /comparison/adapters) — no admin token needed,
 * they simply belong here.
 */
const DOT = {
  online: 'bg-emerald-500',
  offline: 'bg-destructive',
  checking: 'bg-muted-foreground animate-pulse',
  warning: 'bg-amber-500',
};

function Row({ label, detail, state, value }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b last:border-0 last:pb-0 first:pt-0"
      style={{ borderColor: 'var(--border)' }}>
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-card-foreground">{label}</p>
        {detail && <p className="text-[11.5px] text-muted-foreground mt-0.5 truncate">{detail}</p>}
      </div>
      <span className="flex items-center gap-2 shrink-0">
        <span className={`w-2 h-2 rounded-full ${DOT[state] ?? DOT.checking}`} aria-hidden="true" />
        <span className="text-[12.5px] text-muted-foreground tabular-nums">{value}</span>
      </span>
    </div>
  );
}

export default function SystemStatusPanel() {
  const [llama, setLlama] = useState('checking');
  const [gateway, setGateway] = useState('checking');
  const [adapters, setAdapters] = useState({ mode: null, count: null });
  const [refreshing, setRefreshing] = useState(false);

  const apply = useCallback(([health, adapterList]) => {
    setLlama(health.status === 'fulfilled' && health.value?.available ? 'online' : 'offline');

    if (adapterList.status === 'fulfilled') {
      setGateway('online');
      const groups = adapterList.value?.adapters || {};
      setAdapters({
        mode: adapterList.value?.mode || 'gpu',
        count: Object.values(groups).reduce((n, list) => n + (list?.length || 0), 0),
      });
    } else {
      // The adapter listing is the only signal for the registry; a reachable
      // health probe still means the gateway itself is up.
      setGateway(health.status === 'fulfilled' ? 'online' : 'offline');
      setAdapters({ mode: null, count: null });
    }
    setRefreshing(false);
  }, []);

  const check = useCallback(() => {
    setRefreshing(true);
    setLlama('checking');
    setGateway('checking');
    Promise.allSettled([getSinLlamaHealth(), getComparisonAdapters()]).then(apply);
  }, [apply]);

  // Initial probe. State already starts at "checking", so nothing is set
  // synchronously here — only inside the promise callback.
  useEffect(() => {
    let active = true;
    Promise.allSettled([getSinLlamaHealth(), getComparisonAdapters()]).then((results) => {
      if (active) apply(results);
    });
    return () => { active = false; };
  }, [apply]);

  return (
    <section className="rounded-lg border bg-card p-5" style={{ borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-[14px] font-semibold text-card-foreground">System status</h2>
        <button
          onClick={check}
          disabled={refreshing}
          aria-label="Refresh system status"
          title="Refresh"
          className="flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground
            hover:text-foreground hover:bg-muted cursor-pointer transition-colors disabled:opacity-50"
        >
          {refreshing ? <ShimmerDot size={13} /> : <RefreshCw size={13} />}
        </button>
      </div>

      <Row
        label="API gateway"
        detail="Task endpoints for all writing tools"
        state={gateway}
        value={gateway === 'checking' ? 'Checking' : gateway === 'online' ? 'Operational' : 'Unreachable'}
      />
      <Row
        label="SinLLaMA inference"
        detail="Base model server, no adapter"
        state={llama}
        value={llama === 'checking' ? 'Checking' : llama === 'online' ? 'Online' : 'Offline'}
      />
      <Row
        label="Adapter registry"
        detail={
          adapters.count != null
            ? `${adapters.count} LoRA adapter${adapters.count !== 1 ? 's' : ''} available`
            : 'Fine-tuned task adapters'
        }
        state={gateway === 'checking' ? 'checking' : adapters.mode === 'gpu' ? 'online' : adapters.mode ? 'warning' : 'checking'}
        value={
          gateway === 'checking'
            ? 'Checking'
            : adapters.mode === 'gpu'
              ? 'GPU backend'
              : adapters.mode
                ? 'Mock mode'
                : 'Unknown'
        }
      />
    </section>
  );
}
