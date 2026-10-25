import { useCallback } from 'react';
import { useSearchParams } from 'react-router';

/**
 * One piece of screen state kept in the URL instead of in memory: a filter, a sort, a tab. Back brings it
 * back with the page, and a link carries it. It replaces the history entry, never adds one, so Back still
 * leaves the screen in one press. The fallback value is left out of the URL.
 */
export function useParamState(key: string, fallback: string): [string, (v: string) => void] {
  const [params, setParams] = useSearchParams();
  const value = params.get(key) ?? fallback;
  const set = useCallback(
    (v: string) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (v === fallback || v === '') next.delete(key);
          else next.set(key, v);
          return next;
        },
        { replace: true },
      );
    },
    [key, fallback, setParams],
  );
  return [value, set];
}
