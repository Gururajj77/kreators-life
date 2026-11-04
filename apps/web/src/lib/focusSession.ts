// A live snapshot of whatever focus clock is running in Mindfulness, kept at module scope (like useSession in store.ts) so it
// survives leaving the Mindful screen. Mindful itself still owns the clock (the round, the breaks, the chime, the log): this is only a
// read of where it stands, written once a tick by FocusRounds and read by FocusPill to keep a small chip ticking on every other page and
// by FocusRounds itself on its next mount, to pick a session back up instead of starting over.
import { create } from 'zustand';

export type FocusKind = 'breathe' | 'timer' | 'focus' | 'short' | 'long' | 'stopwatch';

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

/**
 * What the pill's controls ask the clock to do. The clock (FocusRounds) owns the state; the pill only sends a request. `stop` asks the way
 * the panel's own Stop does (on Mindful, a sheet to keep or throw away a part past a minute); off Mindful the pill asks first itself and
 * sends `stopKeep` or `stopDrop`.
 */
export type FocusCommand = 'restart' | 'stop' | 'stopKeep' | 'stopDrop' | 'toggle';

interface FocusSessionState {
  snap: FocusSnapshot;
  publish: (s: FocusSnapshot) => void;
  clear: () => void;
  /** The last request from a pill, stamped so the same one twice in a row still counts. */
  command: { kind: FocusCommand; at: number } | null;
  send: (kind: FocusCommand) => void;
  /** The clock's last spoken line ("Mini break.", "Timer done."), repeated by FocusRoundsHost's live region while Mindful is not showing. */
  said: string;
  say: (text: string) => void;
}

export const useFocusSession = create<FocusSessionState>((set) => ({
  snap: EMPTY,
  publish: (s) => set({ snap: s }),
  clear: () => set({ snap: EMPTY, command: null, said: '' }),
  command: null,
  send: (kind) => set({ command: { kind, at: Date.now() + Math.random() } }),
  said: '',
  say: (text) => set({ said: text }),
}));

// The live clock written down in this tab (sessionStorage only: the founder's call is in-tab, no service worker, no push), so a reload or
// a full page load picks it back up (FocusRounds reads it with parseFocusRun and resumeFrom in @kreators/shared/focusRun). Kept here, not
// in shared, so the sign-out in store.ts can forget it without pulling the shared model into the first download.
export const FOCUS_RUN_KEY = 'kreators.focusRun';
const DONE_KEY = 'kreators.focusRun.done';

/** A short tag of the session token, so a record is only ever picked up by the session that wrote it. Never the token itself. */
export function focusRunOwner(token: string | null): string {
  if (!token) return '';
  let h = 0x811c9dc5;
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}
export function readFocusRun(): string | null {
  try {
    return sessionStorage.getItem(FOCUS_RUN_KEY);
  } catch {
    return null;
  }
}
export function writeFocusRun(value: string | null): void {
  try {
    if (value === null) sessionStorage.removeItem(FOCUS_RUN_KEY);
    else sessionStorage.setItem(FOCUS_RUN_KEY, value);
  } catch {
    // not kept in this tab: a reload starts the clock over, as before
  }
}
/** Signing out forgets the written-down clock and its done mark. */
export function forgetFocusRun(): void {
  try {
    sessionStorage.removeItem(FOCUS_RUN_KEY);
    sessionStorage.removeItem(DONE_KEY);
  } catch {
    // nothing kept
  }
}
/**
 * The one guard against logging a part twice: a part is named by the end time it ran out at, marked the moment it finishes (before its
 * log is sent), so a reload that lands before the new state is written finishes it again without a second log.
 */
export function partDone(endsAt: number | null): boolean {
  if (endsAt === null) return false;
  try {
    return sessionStorage.getItem(DONE_KEY) === String(endsAt);
  } catch {
    return false;
  }
}
export function markPartDone(endsAt: number | null): void {
  if (endsAt === null) return;
  try {
    sessionStorage.setItem(DONE_KEY, String(endsAt));
  } catch {
    // not kept
  }
}

/** The milliseconds left right now for a countdown snapshot, recomputed from its absolute end time so a chip stays right without Mindful mounted. */
export function snapshotLeftMs(s: FocusSnapshot): number {
  if (s.kind === 'stopwatch') return s.swAccumMs + (s.running && s.swStartedAt !== null ? Date.now() - s.swStartedAt : 0);
  if (!s.running || s.endsAt === null) return s.leftMs;
  return Math.max(0, s.endsAt - Date.now());
}

// ---- One tab logs a part, never two. A duplicated tab copies sessionStorage, so the written-down clock (and its done mark) is in both.

/** This page load's own name, in memory only, so a duplicated tab (which copies sessionStorage, never this) is a different one. */
export const FOCUS_TAB_ID = `${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
const CLAIM_KEY = 'kreators.focusClaims';

/** The claim itself: the first tab to write the part's name in localStorage (shared by every tab of the site) logs it; the rest stand aside. */
function claimLocal(name: string): boolean {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(CLAIM_KEY) ?? '{}');
    const map = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<string, number>;
    if (Object.hasOwn(map, name)) return false;
    map[name] = Date.now();
    // Only the last thirty claims are kept; a part is claimed in the moment it ends.
    const kept = Object.entries(map)
      .filter(([, t]) => typeof t === 'number')
      .sort((x, y) => y[1] - x[1])
      .slice(0, 30);
    localStorage.setItem(CLAIM_KEY, JSON.stringify(Object.fromEntries(kept)));
    return true;
  } catch {
    // No localStorage here (a private window): this tab logs, and the server's clientRef still keeps one round.
    return true;
  }
}

/**
 * Claim a finished part (named by owner, clock and end time) before its chime and its log. Inside a Web Lock where the browser has them, so
 * two tabs ending in the same instant cannot both read "unclaimed"; a tab that finds the lock taken stands aside. Resolves to true only for
 * the one tab that should chime and log.
 */
export async function claimPart(name: string): Promise<boolean> {
  const locks = (navigator as Navigator & { locks?: LockManager }).locks;
  if (!locks?.request) return claimLocal(name);
  try {
    return await locks.request(`focus-part-${name}`, { ifAvailable: true }, async (lock) => (lock ? claimLocal(name) : false));
  } catch {
    return claimLocal(name);
  }
}

/** What tabs say to each other on the 'kreators.focus' channel: who holds a run, the holder's snapshot, and that it went. */
export type FocusTabMessage =
  | { t: 'who'; key: string; from: string }
  | { t: 'mine'; key: string; from: string; to: string }
  | { t: 'snap'; key: string; from: string; snap: FocusSnapshot }
  | { t: 'gone'; key: string; from: string };

/** The channel between this site's tabs, or null where the browser has none (then each tab runs its own copy, and the claim still holds). */
export function focusChannel(): BroadcastChannel | null {
  try {
    return typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('kreators.focus');
  } catch {
    return null;
  }
}
