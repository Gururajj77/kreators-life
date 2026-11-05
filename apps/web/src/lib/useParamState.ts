import { useCallback } from 'react';
import { useSearchParams, type SetURLSearchParams } from 'react-router';

/**
 * Writes made in the same tick, gathered into one. React Router's `setSearchParams(prev => …)` hands each call the
 * address as it was at the last render, so two writes in one handler (a filter and the page going back to 1) would
 * each start from the old address and the second would undo the first. Every write here lands on `pending`, which
 * starts from the address as it is now, and one navigation is sent at the end of the tick with all of them.
 */
let pending: URLSearchParams | null = null;
let flushWith: SetURLSearchParams | null = null;

function currentSearch(): string {
  return typeof window === 'undefined' ? '' : window.location.search;
}

/** Set (or, with null, remove) several keys at once, composed with any other write made in the same tick. */
export function writeParams(setParams: SetURLSearchParams, changes: Record<string, string | null>) {
  if (!pending) pending = new URLSearchParams(currentSearch());
  for (const [k, v] of Object.entries(changes)) {
    if (v === null || v === '') pending.delete(k);
    else pending.set(k, v);
  }
  flushWith = setParams;
  if (pendingFlush) return;
  pendingFlush = true;
  queueMicrotask(() => {
    const next = pending;
    const set = flushWith;
    pending = null;
    flushWith = null;
    pendingFlush = false;
    // A tab, a filter or a toggle changes what is on the page, never where the person is: no jump back to the top.
    if (next && set) set(next, { replace: true, preventScrollReset: true });
  });
}
let pendingFlush = false;

/**
 * One piece of screen state kept in the URL instead of in memory: a filter, a sort, a tab. Back brings it
 * back with the page, and a link carries it. It replaces the history entry, never adds one, so Back still
 * leaves the screen in one press. The fallback value is left out of the URL. Two of these set in one handler
 * both land (see `writeParams`).
 */
export function useParamState(key: string, fallback: string): [string, (v: string) => void] {
  const [params, setParams] = useSearchParams();
  const value = params.get(key) ?? fallback;
  const set = useCallback((v: string) => writeParams(setParams, { [key]: v === fallback ? null : v }), [key, fallback, setParams]);
  return [value, set];
}
