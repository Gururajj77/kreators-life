import { useCallback, useEffect, useRef, useState } from 'react';

/** The longest one countdown or stopwatch session counts for: ten hours, the same as FOCUS_MAX_MINUTES on the server. */
export const MAX_SESSION_MIN = 600;
/** A stopwatch left running in a tab hidden for longer than this asks, on the way back, whether all of it counts. */
export const LONG_AWAY_MS = 30 * 60_000;
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
export function useCountdown(initialMs: number, onDone: (ms: number, endedAt: number) => void, from?: { total: number; left: number; endsAt: number | null } | null) {
  // `from` is a clock written down before a reload (lib/focusSession.ts): it comes back as it was, and one whose end time has passed
  // ends on the first tick, the ordinary way.
  const [total, setTotal] = useState(from?.total ?? initialMs);
  const [left, setLeft] = useState(from?.left ?? initialMs);
  const [running, setRunning] = useState(Boolean(from && from.endsAt !== null));
  const ends = useRef<number | null>(from?.endsAt ?? null);
  const done = useRef(onDone);
  done.current = onDone;
  const atFull = !running && left >= total - 500;

  useTicker(running, () => {
    if (ends.current === null) return;
    const l = ends.current - Date.now();
    if (l <= 0) {
      const endedAt = ends.current;
      ends.current = null;
      setRunning(false);
      setLeft(total);
      done.current(total, endedAt);
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
  /** From the full length again, running: the "restart" a person asks for from the clock's pill on another page. */
  const restart = useCallback(() => {
    ends.current = Date.now() + total;
    setLeft(total);
    setRunning(true);
  }, [total]);
  /** Start at once with a new length (Continue on a finished session): the length and the end time are set together, so nothing reads a stale one. */
  const begin = useCallback((ms: number) => {
    const len = Math.max(60_000, Math.min(MAX_PART_MIN * 60_000, ms));
    setTotal(len);
    setLeft(len);
    ends.current = Date.now() + len;
    setRunning(true);
  }, []);
  /** The absolute end time right now, for a page that only reads this clock, never drives it (a chip shown on another page). */
  const getEndsAt = useCallback(() => ends.current, []);
  /** How long this part has run so far, right now (paused or running). */
  const elapsed = useCallback(() => total - (ends.current !== null ? Math.max(0, ends.current - Date.now()) : left), [total, left]);
  return { total, left, running, atFull, start, pause, stop, restart, sync, nudge, begin, getEndsAt, elapsed };
}

/**
 * A stopwatch on a start instant: it counts up from zero, pauses and resumes, and the time that passed while the tab slept is still counted.
 * When the tab comes back after more than LONG_AWAY_MS hidden while it ran, `away` says so (when it was hidden, what had passed by then, and
 * what has passed now), so the screen can ask whether all of it counts; `keepUpTo` keeps only the time up to when the tab was left, and pauses.
 */
export function useStopwatch(from?: { startedAt: number | null; accumMs: number } | null) {
  // `from` is a stopwatch written down before a reload: a running one keeps counting from its start instant.
  const [base, setBaseState] = useState(from?.accumMs ?? 0);
  const baseRef = useRef(from?.accumMs ?? 0);
  const setBase = (v: number) => {
    baseRef.current = v;
    setBaseState(v);
  };
  const [ms, setMs] = useState(() => (from ? from.accumMs + (from.startedAt !== null ? Math.max(0, Date.now() - from.startedAt) : 0) : 0));
  const [running, setRunning] = useState(Boolean(from && from.startedAt !== null));
  const since = useRef<number | null>(from?.startedAt ?? null);
  const at = (t: number) => baseRef.current + (since.current === null ? 0 : Math.max(0, t - since.current));
  const elapsed = () => at(Date.now());
  const [away, setAway] = useState<{ hiddenAt: number; uptoMs: number; allMs: number } | null>(null);
  const hiddenAt = useRef<number | null>(null);

  useTicker(running, () => {
    if (!document.hidden) setMs((p) => (Math.floor(p / 1000) === Math.floor(elapsed() / 1000) ? p : elapsed()));
  });
  // Note when the tab goes out of sight while the stopwatch runs, and on the way back, whether it was gone long enough to ask.
  useEffect(() => {
    const look = () => {
      if (document.visibilityState === 'hidden') {
        if (since.current !== null && hiddenAt.current === null) hiddenAt.current = Date.now();
        return;
      }
      const left = hiddenAt.current;
      hiddenAt.current = null;
      if (left !== null && since.current !== null && Date.now() - left > LONG_AWAY_MS) setAway({ hiddenAt: left, uptoMs: at(left), allMs: elapsed() });
    };
    document.addEventListener('visibilitychange', look);
    return () => document.removeEventListener('visibilitychange', look);
    // The refs carry the live values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    setAway(null);
    return e;
  };
  /** After a long time away: keep only what had passed when the tab was left, and pause there. */
  const keepUpTo = () => {
    if (!away) return;
    since.current = null;
    setBase(away.uptoMs);
    setMs(away.uptoMs);
    setRunning(false);
    setAway(null);
  };
  /** After a long time away: all of it counts, and it keeps running. */
  const keepAll = () => setAway(null);
  /** The start instant of the running stretch (null while paused) and what passed before it, to write the stopwatch down. */
  const anchor = () => ({ startedAt: since.current, accumMs: base });
  return { ms, running, start, pause, reset, anchor, away, keepUpTo, keepAll };
}

/** Whole minutes of a stopwatch or other span, nothing under one minute, never above a day. */
export const wholeMinutes = (ms: number): number => Math.min(MAX_SESSION_MIN, Math.floor(Math.max(0, ms) / 60_000));
