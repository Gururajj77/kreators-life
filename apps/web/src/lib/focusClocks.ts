import { useCallback, useEffect, useRef, useState } from 'react';

/** The longest one countdown or stopwatch session counts for: a day. */
export const MAX_SESSION_MIN = 1440;
/** The longest a single countdown part can be set to, by the nudge buttons. */
export const MAX_PART_MIN = 180;

/** m:ss, or h:mm:ss from an hour. Counting down rounds up, so 0:01 is the last second. */
export const mmss = (ms: number, up = true): string => {
  const s = Math.max(0, up ? Math.ceil(ms / 1000) : Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${Math.floor(s / 60)}:${String(sec).padStart(2, '0')}`;
};

/**
 * A look at a clock a few times a second, only while `active`. The callback is read fresh each time, so it may use the latest state. When the
 * tab comes back from the background it looks once at once, since a hidden tab's timers run slowly (the clocks keep an end time, so they are right).
 */
export function useTicker(active: boolean, look: () => void, every = 250): void {
  const fn = useRef(look);
  fn.current = look;
  useEffect(() => {
    if (!active) return;
    const t = window.setInterval(() => fn.current(), every);
    const back = () => {
      if (document.visibilityState === 'visible') fn.current();
    };
    document.addEventListener('visibilitychange', back);
    return () => {
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', back);
    };
  }, [active, every]);
}

/** Show a new left-over time only when its whole second changed (and never while the tab is hidden), so a clock redraws once a second. */
const sameSecond = (a: number, b: number) => Math.ceil(a / 1000) === Math.ceil(b / 1000);
export const nextLeft = (prev: number, now: number): number => (document.hidden || sameSecond(prev, now) ? prev : now);

/**
 * One countdown on an end time (not on counted ticks, so a background tab stays right). `onDone` gets the length that ran out. Stopping early
 * calls nothing. The length can be changed while it waits, and nudged while it runs.
 */
export function useCountdown(initialMs: number, onDone: (ms: number) => void) {
  const [total, setTotal] = useState(initialMs);
  const [left, setLeft] = useState(initialMs);
  const [running, setRunning] = useState(false);
  const ends = useRef<number | null>(null);
  const done = useRef(onDone);
  done.current = onDone;
  const atFull = !running && left >= total - 500;

  useTicker(running, () => {
    if (ends.current === null) return;
    const l = ends.current - Date.now();
    if (l <= 0) {
      ends.current = null;
      setRunning(false);
      setLeft(total);
      done.current(total);
    } else setLeft((p) => nextLeft(p, l));
  });

  const start = useCallback(() => {
    ends.current = Date.now() + (left <= 0 ? total : left);
    if (left <= 0) setLeft(total);
    setRunning(true);
  }, [left, total]);
  const pause = useCallback(() => {
    setLeft(Math.max(0, (ends.current ?? 0) - Date.now()));
    ends.current = null;
    setRunning(false);
  }, []);
  const stop = useCallback(() => {
    ends.current = null;
    setRunning(false);
    setLeft(total);
  }, [total]);
  /** Set the length while it waits at the full time. */
  const sync = useCallback(
    (ms: number) => {
      if (running || left < total - 500 || ms === total) return;
      setTotal(ms);
      setLeft(ms);
    },
    [running, left, total],
  );
  const nudge = useCallback(
    (deltaMs: number) => {
      const part = Math.min(MAX_PART_MIN * 60_000, Math.max(60_000, total + deltaMs));
      const real = part - total;
      if (real === 0) return;
      setTotal(part);
      if (running && ends.current !== null) {
        ends.current += real;
        setLeft(Math.max(1000, ends.current - Date.now()));
      } else setLeft((l) => Math.max(1000, l + real));
    },
    [total, running],
  );
  /** The absolute end time right now, for a page that only reads this clock, never drives it (a chip shown on another page). */
  const getEndsAt = useCallback(() => ends.current, []);
  return { total, left, running, atFull, start, pause, stop, sync, nudge, getEndsAt };
}

/** A stopwatch on a start instant: it counts up from zero, pauses and resumes, and the time that passed while the tab slept is still counted. */
export function useStopwatch() {
  const [base, setBase] = useState(0);
  const [ms, setMs] = useState(0);
  const [running, setRunning] = useState(false);
  const since = useRef<number | null>(null);
  const elapsed = () => base + (since.current === null ? 0 : Date.now() - since.current);

  useTicker(running, () => {
    if (!document.hidden) setMs((p) => (Math.floor(p / 1000) === Math.floor(elapsed() / 1000) ? p : elapsed()));
  });

  const start = () => {
    since.current = Date.now();
    setRunning(true);
  };
  const pause = () => {
    const e = elapsed();
    since.current = null;
    setBase(e);
    setMs(e);
    setRunning(false);
  };
  /** Back to zero. Returns what had passed, for the caller that wants to keep it. */
  const reset = (): number => {
    const e = elapsed();
    since.current = null;
    setBase(0);
    setMs(0);
    setRunning(false);
    return e;
  };
  return { ms, running, start, pause, reset };
}

/** Whole minutes of a stopwatch or other span, nothing under one minute, never above a day. */
export const wholeMinutes = (ms: number): number => Math.min(MAX_SESSION_MIN, Math.floor(Math.max(0, ms) / 60_000));
