// A running focus clock, written down in the browser tab (sessionStorage, never the server) so a reload or a full page load picks it back
// up where it was. The founder's call: in this tab only, no service worker, no push. This file is the one reader of that record
// (`parseFocusRun`) and the one rule for how it comes back (`resumeFrom`); the web app writes it from components/FocusRounds.tsx.

export type FocusRunMode = 'breathe' | 'timer' | 'pomodoro' | 'stopwatch';
export type FocusRunPhase = 'focus' | 'short' | 'long';
export const FOCUS_RUN_MODES: readonly FocusRunMode[] = ['breathe', 'timer', 'pomodoro', 'stopwatch'];
export const FOCUS_RUN_PHASES: readonly FocusRunPhase[] = ['focus', 'short', 'long'];

/** The longest part a countdown can hold (the nudge buttons' ceiling), and the most a stopwatch keeps: a day. */
export const FOCUS_RUN_PART_MAX_MS = 180 * 60_000;
export const FOCUS_RUN_STOPWATCH_MAX_MS = 24 * 60 * 60_000;

/** One countdown: its length, what was left when it was last written, and its end time while it runs (null while it waits or is paused). */
export interface CountdownRun {
  total: number;
  left: number;
  endsAt: number | null;
}

export interface FocusRun {
  v: 1;
  /** Whose clock this is: a tag of the session, so a record left by someone else in this tab is never picked up. */
  owner: string;
  mode: FocusRunMode;
  /** Pomodoro's place: the part, the session and the run, the part's length, what is left and its end time while it runs. */
  phase: FocusRunPhase;
  round: number;
  cycle: number;
  partMs: number;
  leftMs: number;
  endsAt: number | null;
  timer: CountdownRun;
  breathe: CountdownRun;
  /** The stopwatch: the instant the running stretch began (null while paused), plus what had passed before it. */
  sw: { startedAt: number | null; accumMs: number };
  taskId: string;
  finished: boolean;
}

const int = (v: unknown, lo: number, hi: number): number | null => {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  return Math.min(hi, Math.max(lo, Math.round(v)));
};
const stamp = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.round(v) : null);

function countdown(raw: unknown): CountdownRun | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const total = int(r.total, 1000, FOCUS_RUN_PART_MAX_MS);
  if (total === null) return null;
  const left = int(r.left, 0, total) ?? total;
  return { total, left, endsAt: stamp(r.endsAt) };
}

/** The record read back from the tab, or null when it is missing, broken, from another person or another version. */
export function parseFocusRun(raw: string | null | undefined, owner: string): FocusRun | null {
  if (!raw || !owner) return null;
  let r: Record<string, unknown>;
  try {
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
    r = v as Record<string, unknown>;
  } catch {
    return null;
  }
  if (r.v !== 1 || r.owner !== owner) return null;
  const mode = FOCUS_RUN_MODES.find((m) => m === r.mode);
  const phase = FOCUS_RUN_PHASES.find((p) => p === r.phase);
  const partMs = int(r.partMs, 1000, FOCUS_RUN_PART_MAX_MS);
  const timer = countdown(r.timer);
  const breathe = countdown(r.breathe);
  if (!mode || !phase || partMs === null || !timer || !breathe) return null;
  const sw = (r.sw && typeof r.sw === 'object' ? r.sw : {}) as Record<string, unknown>;
  return {
    v: 1,
    owner,
    mode,
    phase,
    round: int(r.round, 1, 99) ?? 1,
    cycle: int(r.cycle, 1, 99) ?? 1,
    partMs,
    leftMs: int(r.leftMs, 0, partMs) ?? partMs,
    endsAt: stamp(r.endsAt),
    timer,
    breathe,
    sw: { startedAt: stamp(sw.startedAt), accumMs: int(sw.accumMs, 0, FOCUS_RUN_STOPWATCH_MAX_MS) ?? 0 },
    taskId: typeof r.taskId === 'string' && /^[\w-]{1,64}$/.test(r.taskId) ? r.taskId : '',
    finished: r.finished === true,
  };
}

/** A countdown as it stands `now`: a running one's left time comes from its end time, and `due` says it ran out while nobody looked. */
export function resumeCountdown(c: CountdownRun, now: number): CountdownRun & { running: boolean; due: boolean } {
  if (c.endsAt === null) return { ...c, running: false, due: false };
  const left = Math.max(0, Math.min(c.total, c.endsAt - now));
  return { ...c, left, running: true, due: left === 0 };
}

export interface FocusResume {
  run: FocusRun;
  pomodoro: { running: boolean; leftMs: number; due: boolean };
  timer: CountdownRun & { running: boolean; due: boolean };
  breathe: CountdownRun & { running: boolean; due: boolean };
  /** The stopwatch's time so far, counted from its start instant when it runs (never past a day). */
  stopwatch: { running: boolean; ms: number };
}

/**
 * How a written-down clock comes back at `now`. Nothing is finished here: a countdown whose end time passed while the page was gone comes
 * back running with nothing left (`due`), so the clock's own tick ends it the ordinary way, counted once (the caller guards the log with
 * its end time). A paused one stays paused with the time it had; a stopwatch keeps counting from its start.
 */
export function resumeFrom(run: FocusRun, now: number): FocusResume {
  const pom = resumeCountdown({ total: run.partMs, left: run.leftMs, endsAt: run.endsAt }, now);
  const since = run.sw.startedAt;
  const swMs = Math.min(FOCUS_RUN_STOPWATCH_MAX_MS, run.sw.accumMs + (since !== null ? Math.max(0, now - since) : 0));
  return {
    run: { ...run, leftMs: pom.left },
    pomodoro: { running: pom.running, leftMs: pom.left, due: pom.due },
    timer: resumeCountdown(run.timer, now),
    breathe: resumeCountdown(run.breathe, now),
    stopwatch: { running: since !== null, ms: swMs },
  };
}

/** Whether the record holds anything worth keeping: a clock running or paused part-way, or a Pomodoro past its first focus part. */
export function focusRunActive(run: FocusRun): boolean {
  const cd = (c: CountdownRun) => c.endsAt !== null || c.left < c.total - 500;
  switch (run.mode) {
    case 'breathe':
      return cd(run.breathe);
    case 'timer':
      return cd(run.timer);
    case 'stopwatch':
      return run.sw.startedAt !== null || run.sw.accumMs > 0;
    default:
      return run.endsAt !== null || run.leftMs < run.partMs - 500 || run.phase !== 'focus' || run.round > 1 || run.cycle > 1;
  }
}
