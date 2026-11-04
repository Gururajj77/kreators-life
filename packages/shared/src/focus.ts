import type { RelationshipKey } from './core.ts';
import type { IconName } from './roles.ts';

// ---- focus rounds: pomodoro-style work in Mindfulness, with a dashboard of how the time went ----

export type FocusView = 'day' | 'week' | 'month';
export const FOCUS_VIEWS: readonly { key: FocusView; name: string; count: number; blurb: string }[] = [
  { key: 'day', name: 'Days', count: 14, blurb: 'The last two weeks, day by day.' },
  { key: 'week', name: 'Weeks', count: 8, blurb: 'The last eight weeks, Monday to Sunday.' },
  { key: 'month', name: 'Months', count: 6, blurb: 'The last six months.' },
];
export const isFocusView = (v: unknown): v is FocusView => v === 'day' || v === 'week' || v === 'month';
/** The longest one focus session can be kept as: ten hours, the same cap a mindful-minutes log has (a long stopwatch run, a nudged timer). */
export const FOCUS_MAX_MINUTES = 600;

export interface FocusTask {
  id: string;
  title: string;
  relationship: RelationshipKey;
  /** The day it is planned for: its do date, else its due date. */
  dueDate: string | null;
  /** Tagged Remember. */
  remind: boolean;
}
export interface FocusBucket {
  /** The first day of the bucket: a day, a Monday, or the first of a month. */
  key: string;
  label: string;
  minutes: number;
  rounds: number;
  /** Tasks ticked in the bucket. */
  tasksDone: number;
}
export interface FocusResponse {
  view: FocusView;
  buckets: FocusBucket[];
  totals: { minutes: number; rounds: number; tasksDone: number; activeBuckets: number; /** The average of the ratings given, to one decimal, and how many rounds were rated. */ quality: number | null; rated: number };
  /** Where the time went in this stretch, most first. `planned` is the task's own time estimate in minutes, when it has one. */
  tasks: { nodeId: string | null; title: string; minutes: number; rounds: number; planned: number | null }[];
  best: { key: string; label: string; minutes: number } | null;
  /** A plain line on how this stretch compares with the one before it. */
  trend: string;
  /** Focus minutes on each day of this stretch, oldest first, for the daily goal (focusGoalMet). */
  dayMinutes: number[];
}
/** What kind of clock a session came from; `manual` is one added by hand afterwards. Older rows have none. */
export type FocusMode = 'timer' | 'pomodoro' | 'stopwatch' | 'manual';
export const isFocusMode = (v: unknown): v is FocusMode => v === 'timer' || v === 'pomodoro' || v === 'stopwatch' || v === 'manual';
/** One finished focus session, as the day's list shows it. Owner only. */
export interface FocusRoundRow {
  id: string;
  minutes: number;
  title: string;
  nodeId: string | null;
  quality: number | null;
  mode: FocusMode | null;
  day: string;
  createdAt: string;
  /** It also counted as mindful minutes (a wellbeing log kept in step with it). */
  mindful: boolean;
}

// ---- Mindfulness timers: what a person chose, kept on their account ----

export type AmbientKind = 'off' | 'rain' | 'ocean' | 'wind' | 'hum' | 'lofi';
/** Serene background sounds, made in the browser (no files to download), played while a timer runs. */
export const AMBIENT_SOUNDS: readonly { key: AmbientKind; name: string; blurb: string; icon: IconName }[] = [
  { key: 'off', name: 'Off', blurb: 'Quiet.', icon: 'VolumeX' },
  { key: 'rain', name: 'Rain', blurb: 'Soft rain on leaves.', icon: 'CloudRain' },
  { key: 'ocean', name: 'Ocean', blurb: 'Slow waves, in and out.', icon: 'WavesHorizontal' },
  { key: 'wind', name: 'Wind', blurb: 'Wind that rises and falls.', icon: 'Wind' },
  { key: 'hum', name: 'Soft hum', blurb: 'A low, warm hum, like a singing bowl.', icon: 'BellRing' },
  { key: 'lofi', name: 'Lo-fi', blurb: 'Slow, mellow chords with a little vinyl crackle. Made in your browser, no song to license.', icon: 'Disc3' },
];
export const isAmbientKind = (v: unknown): v is AmbientKind => AMBIENT_SOUNDS.some((s) => s.key === v);

export interface FocusSettings {
  /** Minutes of focus in a round, of a mini break, and of the long break. */
  focus: number;
  short: number;
  long: number;
  /** Rounds of focus before the long break. The mini breaks between them are one fewer. */
  every: number;
  /** How many times the whole run goes round before it stops. Zero means until you stop. */
  cycles: number;
  /** Start the next part by itself. Off until the person says. */
  auto: boolean;
  /** A finished break counts as mindful minutes. Off until the person says. */
  logBreaks: boolean;
  /** A finished focus round counts as mindful minutes. On to start with. */
  logFocus: boolean;
  /** Every sound and alarm, in one switch. Off means the timers are silent, whatever the options below say. */
  sound: boolean;
  /** One soft beat when a mini break starts, and three when the long break starts. */
  soundShort: boolean;
  soundLong: boolean;
  /** A buzz on a phone when a part ends. */
  vibrate: boolean;
  /** A background sound while a timer runs, and how loud, 0 to 100. */
  ambient: AmbientKind;
  ambientVolume: number;
  /** The breathing pattern Breathe and the breaks follow (BREATH_PATTERNS key), and what marks each step. */
  breath: string;
  breathCue: BreathCue;
  /** How long one count of the breathing pattern lasts, in seconds: 1.0 to 5.0 in tenths (1 is the pattern as written). */
  breathPace: number;
  /** A daily focus goal in minutes (15 to 480, in steps of 15), or null for none. Off until the person sets one; it never makes a streak or a penalty. */
  goalMinutes: number | null;
  /** A daily nudge to focus, as HH:MM in the person's zone, or null for none (off until set). Skipped on a day that already has a session. */
  reminderTime: string | null;
  /** The days the nudge goes out, 1 for Monday to 7 for Sunday. */
  reminderDays: number[];
}
/** One step of a breathing pattern: breathe in, hold full, breathe out, or hold empty, for a whole number of seconds. */
export type BreathStepKind = 'in' | 'hold' | 'out' | 'rest';
export interface BreathStep {
  kind: BreathStepKind;
  seconds: number;
}
export interface BreathPattern {
  key: string;
  name: string;
  /** The counts, as people say them: "4 · 4 · 6 · 2". */
  counts: string;
  /** One plain line on what it is. Never a health claim. */
  line: string;
  steps: readonly BreathStep[];
}
/**
 * Breathing patterns people widely use, each a loop of steps. The words are ours and plain; nothing here promises an effect. The first
 * is the default. A sigh is two breaths in (a long one, then a short top-up) and one long breath out.
 */
export const BREATH_PATTERNS: readonly BreathPattern[] = [
  { key: 'calm', name: 'Calm exhale', counts: '4 · 4 · 6 · 2', line: 'In for 4, hold for 4, out for 6, rest for 2. The breath out is the longest.', steps: [{ kind: 'in', seconds: 4 }, { kind: 'hold', seconds: 4 }, { kind: 'out', seconds: 6 }, { kind: 'rest', seconds: 2 }] },
  { key: 'box', name: 'Box', counts: '4 · 4 · 4 · 4', line: 'Four even sides: in, hold, out, hold, each for 4.', steps: [{ kind: 'in', seconds: 4 }, { kind: 'hold', seconds: 4 }, { kind: 'out', seconds: 4 }, { kind: 'rest', seconds: 4 }] },
  { key: '478', name: '4-7-8', counts: '4 · 7 · 8', line: 'In for 4, hold for 7, out slowly for 8.', steps: [{ kind: 'in', seconds: 4 }, { kind: 'hold', seconds: 7 }, { kind: 'out', seconds: 8 }] },
  { key: 'even', name: 'Even', counts: '5 · 5', line: 'In for 5, out for 5: about six slow breaths a minute.', steps: [{ kind: 'in', seconds: 5 }, { kind: 'out', seconds: 5 }] },
  { key: 'triangle', name: 'Triangle', counts: '4 · 4 · 4', line: 'In for 4, hold for 4, out for 4.', steps: [{ kind: 'in', seconds: 4 }, { kind: 'hold', seconds: 4 }, { kind: 'out', seconds: 4 }] },
  { key: 'longout', name: 'Longer out', counts: '4 · 6', line: 'In for 4, out for 6. No holding.', steps: [{ kind: 'in', seconds: 4 }, { kind: 'out', seconds: 6 }] },
  { key: 'sigh', name: 'Sigh', counts: '2 + 1 · 6', line: 'Breathe in, then a little more on top, then a long breath out.', steps: [{ kind: 'in', seconds: 2 }, { kind: 'in', seconds: 1 }, { kind: 'out', seconds: 6 }] },
];
export const BREATH_BY_KEY: Record<string, BreathPattern> = Object.fromEntries(BREATH_PATTERNS.map((p) => [p.key, p]));
export const breathPatternFor = (key: string | null | undefined): BreathPattern => (key && Object.hasOwn(BREATH_BY_KEY, key) ? BREATH_BY_KEY[key]! : BREATH_PATTERNS[0]!);
/** A pattern timed at a pace: every count lasts `pace` seconds (1.0 to 5.0), so 4 · 4 · 6 · 2 at 1.5 takes 6 · 6 · 9 · 3 seconds. The counts
 * shown stay 4 · 4 · 6 · 2 (BreathFour divides by the pace); only how long each count is held changes. */
export function breathAtPace(pattern: BreathPattern, pace: number): BreathPattern {
  const p = Math.min(5, Math.max(1, Math.round(pace * 10) / 10));
  if (p === 1) return pattern;
  return { ...pattern, steps: pattern.steps.map((s) => ({ ...s, seconds: Math.round(s.seconds * p * 10) / 10 })) };
}
/** What marks each step: nothing, a soft chime, a bell, or a voice saying "In", "Hold", "Out" (the browser's own speech, no service). */
export type BreathCue = 'off' | 'chime' | 'bell' | 'voice';
export const BREATH_CUES: readonly { key: BreathCue; name: string }[] = [
  { key: 'chime', name: 'Soft chime' },
  { key: 'bell', name: 'Bell' },
  { key: 'voice', name: 'Voice' },
  { key: 'off', name: 'No cue' },
];
const isBreathCue = (v: unknown): v is BreathCue => v === 'off' || v === 'chime' || v === 'bell' || v === 'voice';
/** The word a voice cue says. */
export const BREATH_SAY: Record<BreathStepKind, string> = { in: 'In', hold: 'Hold', out: 'Out', rest: 'Hold' };
/** Whole rounds of a pattern in a length of time. */
export const breathRounds = (pattern: BreathPattern, ms: number): number => Math.floor(Math.max(0, ms) / pattern.steps.reduce((t, x) => t + x.seconds * 1000, 0));
/** The words a step shows. */
export const BREATH_WORDS: Record<BreathStepKind, string> = { in: 'Breathe in', hold: 'Hold', out: 'Breathe out', rest: 'Hold' };

/** Where a breath stands after `elapsedMs`: which step, how far through it (0 to 1), and the whole seconds left in it (counting down). */
export function breathAt(pattern: BreathPattern, elapsedMs: number): { index: number; step: BreathStep; progress: number; secondsLeft: number; loop: number } {
  const cycleMs = pattern.steps.reduce((t, s) => t + s.seconds * 1000, 0);
  const e = Math.max(0, elapsedMs);
  const loop = Math.floor(e / cycleMs);
  let t = e - loop * cycleMs;
  for (let i = 0; i < pattern.steps.length; i += 1) {
    const step = pattern.steps[i]!;
    const ms = step.seconds * 1000;
    if (t < ms) return { index: i, step, progress: t / ms, secondsLeft: Math.ceil((ms - t) / 1000), loop };
    t -= ms;
  }
  const last = pattern.steps.length - 1;
  return { index: last, step: pattern.steps[last]!, progress: 1, secondsLeft: 0, loop };
}

export const FOCUS_PRESETS: readonly { name: string; focus: number; short: number; long: number; every: number }[] = [
  { name: 'Classic', focus: 25, short: 5, long: 30, every: 4 },
  { name: 'Deep', focus: 50, short: 10, long: 30, every: 3 },
  { name: 'Light', focus: 15, short: 3, long: 15, every: 4 },
];
export const FOCUS_DEFAULTS: FocusSettings = {
  focus: FOCUS_PRESETS[0]!.focus,
  short: FOCUS_PRESETS[0]!.short,
  long: FOCUS_PRESETS[0]!.long,
  every: FOCUS_PRESETS[0]!.every,
  cycles: 0,
  auto: false,
  logBreaks: false,
  logFocus: true,
  sound: true,
  soundShort: true,
  soundLong: true,
  vibrate: true,
  ambient: 'off',
  ambientVolume: 40,
  breath: 'calm',
  breathCue: 'chime',
  breathPace: 1,
  goalMinutes: null,
  reminderTime: null,
  reminderDays: [1, 2, 3, 4, 5, 6, 7],
};
const clampWhole = (v: unknown, lo: number, hi: number, fallback: number): number => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
};
/** The one reader for a person's timer settings, from the browser or a column. Anything missing or unclean takes its default. */
export function parseFocusSettings(raw: unknown): FocusSettings {
  let v = raw;
  if (typeof v === 'string') {
    try {
      v = JSON.parse(v);
    } catch {
      v = {};
    }
  }
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const flag = (k: keyof FocusSettings, d: boolean) => (typeof o[k] === 'boolean' ? (o[k] as boolean) : d);
  const d = FOCUS_DEFAULTS;
  return {
    focus: clampWhole(o.focus, 1, 120, d.focus),
    short: clampWhole(o.short, 1, 60, d.short),
    long: clampWhole(o.long, 1, 120, d.long),
    every: clampWhole(o.every, 1, 12, d.every),
    cycles: clampWhole(o.cycles, 0, 12, d.cycles),
    auto: flag('auto', d.auto),
    logBreaks: flag('logBreaks', d.logBreaks),
    logFocus: flag('logFocus', d.logFocus),
    sound: flag('sound', d.sound),
    soundShort: flag('soundShort', d.soundShort),
    soundLong: flag('soundLong', d.soundLong),
    vibrate: flag('vibrate', d.vibrate),
    ambient: isAmbientKind(o.ambient) ? o.ambient : d.ambient,
    ambientVolume: clampWhole(o.ambientVolume, 0, 100, d.ambientVolume),
    breath: typeof o.breath === 'string' && Object.hasOwn(BREATH_BY_KEY, o.breath) ? o.breath : d.breath,
    breathCue: isBreathCue(o.breathCue) ? o.breathCue : d.breathCue,
    breathPace: Number.isFinite(Number(o.breathPace)) ? Math.min(5, Math.max(1, Math.round(Number(o.breathPace) * 10) / 10)) : d.breathPace,
    goalMinutes: o.goalMinutes === null || o.goalMinutes === undefined || !Number.isFinite(Number(o.goalMinutes)) ? null : Math.min(480, Math.max(15, Math.round(Number(o.goalMinutes) / 15) * 15)),
    reminderTime: typeof o.reminderTime === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(o.reminderTime) ? o.reminderTime : null,
    reminderDays: Array.isArray(o.reminderDays) ? [...new Set(o.reminderDays.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 7))].sort((x, y) => x - y) : [...d.reminderDays],
  };
}
/** How many of these days met the daily focus goal (each a day's focus minutes). No goal means none; it is a count, never a streak. */
export function focusGoalMet(days: readonly number[], goal: number | null): number {
  if (goal === null || !Number.isFinite(goal) || goal <= 0) return 0;
  return days.filter((m) => Number.isFinite(m) && m >= goal).length;
}
/** How many soft beats mark the start of a break: one for a mini break, three for the long one. */
export const BREAK_BEATS = { short: 1, long: 3 } as const;
