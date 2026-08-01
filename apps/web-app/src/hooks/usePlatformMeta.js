/**
 * Platform capabilities from /meta — which tools are switched on, and the
 * admin-set starting values for users who have not chosen their own.
 *
 * Fails open. If /meta cannot be reached, every tool is treated as enabled:
 * a monitoring blip must not make the product look like it has been
 * dismantled. The server still enforces the flags, so an optimistic client
 * can at worst show a tool that returns 503.
 */

import { useEffect, useState } from 'react';
import { getMeta } from '../services/api';

const ALL_ENABLED = {
  grammar: true,
  headlines: true,
  rewriter: true,
  summarizer: true,
};

export function usePlatformMeta() {
  const [features, setFeatures] = useState(ALL_ENABLED);
  const [defaults, setDefaults] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const meta = await getMeta();
        if (!active) return;
        setFeatures({ ...ALL_ENABLED, ...(meta.features ?? {}) });
        setDefaults(meta.defaults ?? null);
      } catch {
        // Deliberately silent: fail open, keep the defaults above.
        if (active) setFeatures(ALL_ENABLED);
      } finally {
        if (active) setLoaded(true);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  return { features, defaults, loaded };
}

export default usePlatformMeta;
