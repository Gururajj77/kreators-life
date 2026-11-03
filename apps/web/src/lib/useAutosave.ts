import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from './api';

export type AutosaveState = 'idle' | 'saving' | 'saved' | 'error' | 'conflict';

/** The quiet line beside a document's status: what saving as you go is doing now. Empty when there is nothing to say. */
export const AUTOSAVE_WORDS: Record<AutosaveState, string> = {
  idle: '',
  saving: 'Saving',
  saved: 'Saved',
  error: 'Not saved. Check your connection; it tries again on your next change.',
  conflict: 'Changed somewhere else. Reloaded.',
};

/**
 * Saving as you go, for paper edited in place (an agreement, a document, an invoice, a house template). The page keeps the paper in
 * its own state and this hook sends the whole of it in one PATCH 800 ms after the last change, with the version it last read, so the
 * server can refuse a save that would write over another tab's (409 `changed`): then the page reloads and the line says so. One save
 * runs at a time; a change made during it is saved right after. Undo puts back the paper as it was before the last save and saves that.
 *
 * `reset` tells the hook what the server holds (after a load, a reload or a status change) without saving it.
 */
export function useAutosave<T>({
  value,
  save,
  restore,
  onConflict,
  enabled,
  delay = 800,
}: {
  value: T | null;
  /** Sends the paper with the version it was read at; resolves to the new version. */
  save: (value: T, version: string) => Promise<string>;
  /** Puts an earlier paper back into the page (Undo). */
  restore: (value: T) => void;
  /** The server has a newer version: the page refetches and calls `reset`. */
  onConflict: () => void;
  enabled: boolean;
  delay?: number;
}) {
  const [state, setState] = useState<AutosaveState>('idle');
  const [canUndo, setCanUndo] = useState(false);
  const version = useRef('');
  const savedJson = useRef<string | null>(null);
  const before = useRef<T | null>(null);
  const latest = useRef<T | null>(value);
  const busy = useRef(false);
  const again = useRef(false);
  latest.current = value;

  const reset = useCallback((v: T, ver: string) => {
    savedJson.current = JSON.stringify(v);
    version.current = ver;
    before.current = null;
    setCanUndo(false);
  }, []);

  const run = useCallback(async (): Promise<void> => {
    const v = latest.current;
    if (v === null || savedJson.current === null) return;
    const json = JSON.stringify(v);
    if (json === savedJson.current) return;
    if (busy.current) {
      again.current = true;
      return;
    }
    busy.current = true;
    setState('saving');
    try {
      const next = await save(v, version.current);
      before.current = JSON.parse(savedJson.current) as T;
      savedJson.current = json;
      version.current = next;
      setCanUndo(true);
      setState('saved');
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setState('conflict');
        onConflict();
      } else setState('error');
    } finally {
      busy.current = false;
      if (again.current) {
        again.current = false;
        void run();
      }
    }
  }, [save, onConflict]);

  useEffect(() => {
    if (!enabled || value === null || savedJson.current === null) return;
    if (JSON.stringify(value) === savedJson.current) return;
    const t = window.setTimeout(() => void run(), delay);
    return () => window.clearTimeout(t);
  }, [value, enabled, delay, run]);

  // A tab closed or a page left within the 800 ms still saves what was typed.
  useEffect(() => {
    const leave = () => void run();
    window.addEventListener('pagehide', leave);
    return () => {
      window.removeEventListener('pagehide', leave);
      void run();
    };
  }, [run]);

  const undo = useCallback(() => {
    const prev = before.current;
    if (!prev) return;
    before.current = null;
    setCanUndo(false);
    restore(prev);
  }, [restore]);

  return { state, words: AUTOSAVE_WORDS[state], canUndo, undo, reset, flush: run, version };
}
