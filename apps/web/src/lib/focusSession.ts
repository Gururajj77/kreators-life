// A live snapshot of whatever focus clock is running in Mindful minutes, kept at module scope (like useSession in store.ts) so it
// survives leaving the Mindful screen. Mindful itself still owns the clock (the round, the breaks, the chime, the log): this is only a
// read of where it stands, written once a tick by FocusRounds and read by FocusPill to keep a small chip ticking on every other page and
// by FocusRounds itself on its next mount, to pick a session back up instead of starting over.
import { create } from 'zustand';

export type FocusKind = 'timer' | 'focus' | 'short' | 'long' | 'stopwatch';

export interface FocusSnapshot {
  /** Nothing running or paused at zero: the chip and the resume are both skipped. */
  active: boolean;
  kind: FocusKind;
  /** "Focus", "Mini break", "Timer", "Stopwatch"; for a Pomodoro focus part, "Session 2 of 4". */
  label: string;
  running: boolean;
  /** Pomodoro's own place: which session, and which run through the cycle (0 cycles means an open run). */
  round: number;
  cycle: number;
  /** The part's own length, for the countdown kinds. */
  totalMs: number;
  /** Absolute end time while running; the leftover time while paused. */
  endsAt: number | null;
  leftMs: number;
  /** The stopwatch's own clock: an absolute start instant while running, plus what had already passed. */
  swStartedAt: number | null;
  swAccumMs: number;
  taskTitle: string | null;
}

const EMPTY: FocusSnapshot = { active: false, kind: 'focus', label: '', running: false, round: 1, cycle: 1, totalMs: 0, endsAt: null, leftMs: 0, swStartedAt: null, swAccumMs: 0, taskTitle: null };

interface FocusSessionState {
  snap: FocusSnapshot;
  publish: (s: FocusSnapshot) => void;
  clear: () => void;
}

export const useFocusSession = create<FocusSessionState>((set) => ({
  snap: EMPTY,
  publish: (s) => set({ snap: s }),
  clear: () => set({ snap: EMPTY }),
}));

/** The milliseconds left right now for a countdown snapshot, recomputed from its absolute end time so a chip stays right without Mindful mounted. */
export function snapshotLeftMs(s: FocusSnapshot): number {
  if (s.kind === 'stopwatch') return s.swAccumMs + (s.running && s.swStartedAt !== null ? Date.now() - s.swStartedAt : 0);
  if (!s.running || s.endsAt === null) return s.leftMs;
  return Math.max(0, s.endsAt - Date.now());
}
