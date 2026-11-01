import { useEffect, useState } from 'react';

/**
 * A value that follows `value` only after it has stopped changing for `ms`. The typed text stays instant in the
 * box; only the request waits. The request's query key carries the debounced value, so an answer for an older
 * word is a different query and can never replace the answer for the newer one.
 */
export function useDebounced<T>(value: T, ms = 300): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setSettled(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return settled;
}
