import { useEffect, useState } from 'react';

/**
 * `value`, but only after it has stopped changing for `delayMs`.
 *
 * For inputs that drive expensive work — filtering a long list, a network
 * search — so a burst of keystrokes costs one update instead of one per key.
 * The input itself stays bound to the live value and never lags.
 */
export function useDebouncedValue(value, delayMs = 250) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

export default useDebouncedValue;
