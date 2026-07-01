import { useState, useCallback } from 'react';

export function useToolProcessor() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const process = useCallback(async (apiCall) => {
    if (!input.trim()) return;
    setLoading(true);
    setError(null);
    setOutput(null);
    try {
      const result = await apiCall(input.trim());
      setOutput(result);
    } catch (err) {
      setError(err.message || 'Processing failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [input]);

  const clear = useCallback(() => {
    setInput('');
    setOutput(null);
    setError(null);
  }, []);

  return { input, setInput, output, loading, error, process, clear };
}
