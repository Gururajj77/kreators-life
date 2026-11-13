import { useCallback, useEffect, useRef, useState } from 'react';

/** How long a second tap stays asked for before the control goes back to rest. */
export const TAP_TWICE_MS = 4000;

/**
 * A small personal remove asks twice, never in a popup (the founder, 2026-11-13: "make delete task a double click button rather than
 * popup, its destructive but low priority item"): the first tap arms the control (its words read "Tap again to …" in an `aria-live`
 * span and it wears `.red-armed`), the second does it, and it lapses after about four seconds. Unlike `TapTwice` it draws nothing, so
 * each control keeps its own look at rest (a trash icon, `DELETE_BTN`, a row's link). `key` tells the rows of one list apart: only
 * one is asked at a time.
 */
export function useTapTwice<K extends string | number | boolean = true>() {
  const [armed, setArmed] = useState<K | null>(null);
  const now = useRef<K | null>(null);
  now.current = armed;
  useEffect(() => {
    if (armed === null) return;
    const t = window.setTimeout(() => setArmed(null), TAP_TWICE_MS);
    return () => window.clearTimeout(t);
  }, [armed]);
  /** The first tap on `key` arms it; a second tap on the same key, inside the wait, runs `yes`. */
  const tap = useCallback((key: K, yes: () => void) => {
    if (now.current === key) {
      setArmed(null);
      yes();
    } else setArmed(key);
  }, []);
  const disarm = useCallback(() => setArmed(null), []);
  const isArmed = useCallback((key: K) => armed === key, [armed]);
  return { armed, isArmed, tap, disarm };
}
