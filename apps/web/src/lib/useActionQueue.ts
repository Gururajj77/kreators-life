import { useCallback, useRef, useState } from 'react';
import { ApiError } from './api';

/**
 * Runs actions one after another, so quick taps reach the server in order and
 * never race. A second tap on something already in flight is ignored. Errors
 * are kept per item, so they can be shown right next to what was tapped.
 */
export function useActionQueue(afterEach: () => unknown) {
  const chain = useRef<Promise<void>>(Promise.resolve());
  const inFlight = useRef(new Set<string>());
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const [hints, setHints] = useState<Record<string, string>>({});

  const setHint = useCallback((key: string, text: string | null) => {
    setHints((h) => {
      if (text === null) {
        if (!(key in h)) return h;
        const next = { ...h };
        delete next[key];
        return next;
      }
      return { ...h, [key]: text };
    });
  }, []);

  const run = useCallback(
    (key: string, fn: () => Promise<unknown>) => {
      if (inFlight.current.has(key)) return;
      inFlight.current.add(key);
      setPending(new Set(inFlight.current));
      setHint(key, null);
      chain.current = chain.current
        .then(fn)
        .then(
          () => undefined,
          (e: unknown) => {
            // 409 means it was already in the state the tap asked for. Nothing to say.
            if (e instanceof ApiError && e.status === 409) return;
            setHint(key, e instanceof Error ? e.message : 'That did not save. Try again.');
          },
        )
        .finally(() => {
          inFlight.current.delete(key);
          setPending(new Set(inFlight.current));
          void afterEach();
        });
    },
    [afterEach, setHint],
  );

  return {
    run,
    isPending: (key: string) => pending.has(key),
    hint: (key: string) => hints[key] ?? null,
    setHint,
  };
}
