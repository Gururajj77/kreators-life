// ---------------------------------------------------------------------------
// Emerging (2026-11-04): patterns the app notices in what a person already logs, read across their apps.
// Rules only, no model and no credits, like the daily brief. Computed on read from the person's own rows (GET /insights),
// owner only, nothing stored. A pairing says what happened on the same days, with how many days on each side, and never
// what caused what. A signal with too little data is "watching": it says what it still needs and shows no number.
// ---------------------------------------------------------------------------

import { formatCount, RELATIONSHIP_BY_KEY, RELATIONSHIPS } from './core.ts';
import type { RelationshipKey } from './core.ts';
import { addDays, daysBetween, isoWeekday, zoneOffsetMinutes } from './dates.ts';
import type { Repeat } from './tasks.ts';
import { DAY_TYPES } from './dayTypes.ts';
import { money } from './money.ts';
import { MAX_NOT_TO_DO } from './api.ts';
import { DISCOVER_STRENGTHS } from './discover.ts';
import { PERIOD_META, periodLabel } from './periods.ts';
import type { PeriodKind, PeriodNumbers } from './periods.ts';

export type InsightApp =
  | 'home'
  | 'today'
  | 'tower'
  | 'pillar'
  | 'mood'
  | 'sleep'
  | 'stress'
  | 'mindful'
  | 'wellbeing'
  | 'life'
  | 'journal'
  | 'finance'
  | 'reviews'
  | 'discover'
  | 'agency'
  | 'insights';
export const INSIGHT_APPS: readonly InsightApp[] = ['home', 'today', 'tower', 'pillar', 'mood', 'sleep', 'stress', 'mindful', 'wellbeing', 'life', 'journal', 'finance', 'reviews', 'discover', 'agency', 'insights'];
export const isInsightApp = (v: unknown): v is InsightApp => typeof v === 'string' && (INSIGHT_APPS as readonly string[]).includes(v);

export type InsightKey =
  | 'habit'
  | 'habit-tie'
  | 'pillar-balance'
  | 'best-hours'
  | 'streak-weekday'
  | 'sleep-mood'
  | 'focus-tasks'
  | 'stress-calm'
  | 'daytype-done'
  | 'money-stress'
  | 'slips-sleep'
  | 'routine-tasks'
  | 'journal-mood'
  | 'review-since'
  | 'discover-strength'
  | 'agency-load';
export type InsightPart = 'tasks' | 'xp' | 'checkins' | 'wellbeing' | 'focus' | 'water' | 'journal' | 'money' | 'notToDo' | 'routine' | 'dayTypes' | 'reviews' | 'discover' | 'agency';

export interface InsightPairRow {
  label: string;
  value: number;
  /** How many days stand behind the value. */
  n: number;
  unit: string;
}
export type InsightChart =
  | { kind: 'pair'; rows: InsightPairRow[] }
  | { kind: 'week'; labels: string[]; values: number[] }
  | { kind: 'hours'; labels: string[]; values: number[] }
  | { kind: 'share'; parts: { relationship: RelationshipKey; value: number }[]; mark?: RelationshipKey }
  | { kind: 'dots'; days: { date: string; on: boolean }[] };
export interface InsightAction {
  label: string;
  to: string;
  /** `habit` opens the Make it a habit sheet, `notToDo` the Add to not to do sheet, `link` goes to `to`. */
  kind: 'link' | 'habit' | 'notToDo';
}
export interface HabitSuggestion {
  title: string;
  relationship: RelationshipKey;
  /** The active project a new repeating task goes under; null when the one it came from is done or gone. */
  projectId: string | null;
  /** An open task in the same group that does not repeat yet: "Keep" sets its repeat instead of making a new one. */
  openTaskId: string | null;
  repeat: Repeat;
  /** HH:MM in the person's zone, or null when the ticks are spread over the day. */
  time: string | null;
  firstDay: string;
  ticks: number;
  /** The local days it was ticked, oldest first. */
  days: string[];
}
/**
 * A good or bad habit (the 2026-11-04 ask): a task done again and again, or a slip on the not to do list, set against how the
 * person's own days went (mood, sleep that night, stress, other tasks, focus). Only on a ready `habit-tie`.
 */
export interface HabitTie {
  verdict: 'good' | 'bad';
  /** A task (by its words) or one item of the not to do list. */
  kind: 'task' | 'notToDo';
  title: string;
  /** The task's `taskKey`, or the not to do item's id. */
  key: string;
  relationship: RelationshipKey | null;
  /** Where the thing lives: the open task on Daily, its pillar page, or the not to do list. */
  to: string;
  toLabel: string;
  /** It repeats already (or a tick came from a repeat). */
  repeats: boolean;
  /** A task that can go on the not to do list: not on it by name yet, and the list has room. */
  canAddNotToDo: boolean;
}
export interface Insight {
  key: InsightKey;
  /** The key, or `habit:<pillar>:<taskKey>` for each habit, or `pillar-balance:<pillar>` for a pillar page. */
  id: string;
  state: 'ready' | 'watching';
  apps: InsightApp[];
  reads: InsightPart[];
  /** Reads wellbeing, journal days or money. */
  private: boolean;
  relationship: RelationshipKey | null;
  /** The number first ("5 times", "3.9 vs 2.8"); empty while watching. */
  headline: string;
  text: string;
  basis: string;
  chart: InsightChart | null;
  action: InsightAction | null;
  need: string | null;
  /** 0 to 100, for ranking. 0 means "about the same either way": listed on /insights only. */
  strength: number;
  habit?: HabitSuggestion;
  tie?: HabitTie;
}

export interface InsightTaskFact {
  id: string;
  title: string;
  relationship: RelationshipKey;
  parentId: string | null;
  /** UTC ISO. */
  completedAt: string;
  /** It repeats, or it was made by a repeat. */
  repeats: boolean;
  /** "Count it as a habit": the person's pick, or null when they made none. */
  habit?: boolean | null;
}
export interface InsightOpenTaskFact {
  id: string;
  title: string;
  relationship: RelationshipKey;
  parentId: string | null;
  repeats: boolean;
  habit?: boolean | null;
  /** The day it opens on Daily (do date, else due date); null when it has neither. */
  openDay?: string | null;
}
export interface InsightReviewFact {
  kind: PeriodKind;
  start: string;
  end: string;
  /** The numbers the review was saved with. */
  then: PeriodNumbers;
  /** The same numbers for the period after it, so far. */
  since: PeriodNumbers;
  sinceStart: string;
  sinceEnd: string;
  /** The period after it is over. */
  ended: boolean;
}
export interface InsightFacts {
  /** The person's own day (from the device). */
  today: string;
  zone: string;
  currency: string;
  /** The app keys that are on for this person. */
  apps: readonly string[];
  /** Asked for by a pillar page: adds that pillar's own line. */
  rel?: RelationshipKey | null;
  /** Ticked tasks in the window. */
  done: InsightTaskFact[];
  open: InsightOpenTaskFact[];
  /** Active projects. */
  projects: { id: string; relationship: RelationshipKey }[];
  /** The last 30 days of xp and task ticks by pillar. */
  xp30: { relationship: RelationshipKey; xp: number; ticks: number }[];
  focusPillars: RelationshipKey[];
  /** Local days with a check-in in the window, and the first one ever. */
  checkins: string[];
  firstCheckin: string | null;
  /** Never a note or an extra: the kind, the day and the number. */
  wellbeing: { kind: string; date: string; value: number }[];
  focus: { day: string; minutes: number }[];
  notToDo: { day: string; slipped: number; kept: number }[];
  /** The not to do list itself, for a bad habit's "Add to not to do". */
  notToDoItems: { id: string; title: string; relationship: RelationshipKey | null }[];
  /** One row per item per marked day in the window. */
  notToDoMarks: { itemId: string; day: string; status: 'kept' | 'slipped' }[];
  water: { day: string; ml: number }[];
  waterGoal: number | null;
  dayTypes: { day: string; kind: string }[];
  routine: { day: string; done: boolean }[];
  /** When journal entries were written (UTC ISO). Never a word of them. */
  journalAt: string[];
  /** Spending per day in the person's own currency, integer cents. */
  expenses: { date: string; cents: number }[];
  review: InsightReviewFact | null;
  discover: { growth: RelationshipKey; steps: boolean } | null;
  /** Days with an Agency piece due. */
  agencyDue: string[];
}
export interface InsightsResponse {
  day: string;
  insights: Insight[];
}

export const INSIGHT_WINDOW_DAYS = 84;
export const PAIR_WINDOW_DAYS = 56;
export const HABIT_WINDOW_DAYS = 28;
export const HABIT_MIN_TICKS = 3;
export const PAIR_MIN_DAYS = 7;
export const HOME_INSIGHTS = 3;
export const MAX_HABITS = 3;
/** A good or bad habit needs this many days with it (or slip days) and `PAIR_MIN_DAYS` without (or kept days). */
export const HABIT_TIE_MIN_DAYS = 5;
/** At most this many good and bad habits, and this many still watching. */
export const MAX_HABIT_TIES = 6;
export const MAX_HABIT_TIES_WATCHING = 2;
/** A task the person said is not a habit ("Count it as a habit" off) shows only on a strong pattern: this many days each side… */
export const HABIT_TIE_STRICT_DAYS = 10;
/** …and a gap of at least half the scale (1 point of mood or stress, 1 hour of sleep). */
export const HABIT_TIE_STRICT_NORM = 0.5;
/** How many cards each place shows. */
/** Daily's Habits section: the good and bad habits it lists, apart from its two other patterns. */
export const DAILY_HABITS_MAX = 5;
export const INSIGHT_APP_MAX: Partial<Record<InsightApp, number>> = { home: HOME_INSIGHTS, tower: 3, pillar: 2, today: 2 };
/** Words that claim a cause. No sentence here may use one. */
export const CAUSE_WORDS = ['because', 'causes', 'caused', 'makes you', 'leads to', 'due to', 'so you'] as const;
export const INSIGHT_BASIS_TAIL = 'Things that happen together, not causes.';

// ---- helpers --------------------------------------------------------------

/** A UTC time read in the person's zone: their day, the minute of that day and the weekday (1 Monday to 7 Sunday). */
export function localStamp(iso: string, zone: string): { day: string; minutes: number; weekday: number } | null {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  const local = new Date(at.getTime() + zoneOffsetMinutes(zone, at) * 60_000);
  const day = local.toISOString().slice(0, 10);
  return { day, minutes: local.getUTCHours() * 60 + local.getUTCMinutes(), weekday: isoWeekday(day) };
}

export interface SplitSide {
  n: number;
  avg: number | null;
}
export interface SplitResult {
  on: SplitSide;
  off: SplitSide;
  /** on minus off, or 0 when a side is empty. */
  gap: number;
  /** Both sides have enough days. */
  enough: boolean;
  /** Enough days, and the gap is at least the smallest worth saying. */
  ready: boolean;
}

/** The one comparator for every "on days when X" line. A day with `on` or `y` null is left out. */
export function splitCompare(days: readonly { on: boolean | null; y: number | null }[], minOn: number, minGap: number, minOff = minOn): SplitResult {
  let onN = 0;
  let onSum = 0;
  let offN = 0;
  let offSum = 0;
  for (const d of days) {
    if (d.on === null || d.y === null || !Number.isFinite(d.y)) continue;
    if (d.on) {
      onN += 1;
      onSum += d.y;
    } else {
      offN += 1;
      offSum += d.y;
    }
  }
  const on = { n: onN, avg: onN ? onSum / onN : null };
  const off = { n: offN, avg: offN ? offSum / offN : null };
  const gap = on.avg !== null && off.avg !== null ? on.avg - off.avg : 0;
  const enough = onN >= minOn && offN >= minOff;
  return { on, off, gap, enough, ready: enough && Math.abs(gap) >= minGap };
}

const STOP_WORDS = new Set(['a', 'an', 'the', 'to', 'for', 'my', 'of', 'on', 'in', 'at', 'with', 'and', 'do', 'go', 'get', 'some']);

function keyWords(title: string): string[] {
  const plain = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\d{4}-\d{2}-\d{2}/g, ' ')
    .replace(/\d{1,2}\/\d{1,2}(\/\d{2,4})?/g, ' ')
    .replace(/[^\p{L}\p{M}\s]/gu, ' ');
  const words = new Set<string>();
  for (const raw of plain.split(/\s+/)) {
    if (raw.length < 2 || STOP_WORDS.has(raw)) continue;
    let w = raw;
    if (w.length > 4) {
      if (w.endsWith('ing')) w = w.slice(0, -3);
      else if (w.endsWith('es')) w = w.slice(0, -2);
      else if (w.endsWith('s')) w = w.slice(0, -1);
    }
    if (w.length >= 2) words.add(w);
  }
  return [...words].sort().slice(0, 4);
}

/** The words that name a task, so "Gym session", "gym sessions" and "Gym session 3" are one: `gym|session`. Empty when none is left. */
export function taskKey(title: string): string {
  return keyWords(title).join('|');
}

/** Two keys name the same thing: they share two thirds of their words, one of them four letters or longer. */
export function sameTask(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  return sameWords(new Set(a.split('|')), new Set(b.split('|')));
}

/** `sameTask` on word sets already made, so a loop over many keys splits each key once. */
function sameWords(A: ReadonlySet<string>, B: ReadonlySet<string>): boolean {
  let both = 0;
  let long = false;
  for (const w of A) {
    if (!B.has(w)) continue;
    both += 1;
    if (w.length >= 4) long = true;
  }
  const union = A.size + B.size - both;
  return both / union >= 0.67 && long;
}

/** A key with its word set, made once. */
interface KeyWords {
  key: string;
  words: ReadonlySet<string>;
}
const keyWordsOf = (key: string): KeyWords => ({ key, words: new Set(key.split('|')) });
/** `sameTask` for two keys whose word sets are made. */
const sameKey = (a: KeyWords, b: KeyWords): boolean => Boolean(a.key) && Boolean(b.key) && (a.key === b.key || sameWords(a.words, b.words));

/** How often a task done on these local days could come back: daily, on weekdays, or weekly on its usual days. Every 1, no end. */
export function suggestRepeat(localDays: readonly string[], today: string): Repeat {
  const from = addDays(today, -(HABIT_WINDOW_DAYS - 1));
  const days = [...new Set(localDays.filter((d) => d >= from && d <= today))].sort();
  if (days.length >= 16) return { kind: 'daily', every: 1, days: [], until: null };
  const weekdays = days.map(isoWeekday);
  if (days.length && weekdays.every((w) => w <= 5) && new Set(weekdays).size >= 4) return { kind: 'weekdays', every: 1, days: [], until: null };
  const count = new Map<number, number>();
  for (const w of weekdays) count.set(w, (count.get(w) ?? 0) + 1);
  const ranked = [...count.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  const twice = ranked.filter(([, n]) => n >= 2).slice(0, 3).map(([w]) => w);
  const picked = twice.length ? twice : ranked.slice(0, 1).map(([w]) => w);
  return { kind: 'weekly', every: 1, days: picked.sort((a, b) => a - b), until: null };
}

/** The usual time, the median rounded to half an hour, only when the middle half of the ticks sits inside two hours. */
export function suggestTime(minutes: readonly number[]): string | null {
  if (!minutes.length) return null;
  const s = [...minutes].sort((a, b) => a - b);
  const n = s.length;
  const q1 = s[Math.floor((n - 1) / 4)] ?? 0;
  const q3 = s[Math.ceil((3 * (n - 1)) / 4)] ?? 0;
  if (q3 - q1 > 120) return null;
  const mid = n % 2 ? (s[(n - 1) / 2] ?? 0) : ((s[n / 2 - 1] ?? 0) + (s[n / 2] ?? 0)) / 2;
  const r = (Math.round(mid / 30) * 30) % (24 * 60);
  return `${String(Math.floor(r / 60)).padStart(2, '0')}:${String(r % 60).padStart(2, '0')}`;
}

const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const pillarName = (k: RelationshipKey) => RELATIONSHIP_BY_KEY[k].name;
const one = (n: number) => (Math.round(n * 10) / 10).toFixed(1);
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
const plural = (n: number, word: string, many = `${word}s`) => `${formatCount(n)} ${n === 1 ? word : many}`;
function listWords(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
/** 7 → "7 am", 13 → "1 pm", 0 → "12 am". */
function hourWord(h: number): string {
  const hh = ((h % 24) + 24) % 24;
  return `${hh % 12 || 12} ${hh < 12 ? 'am' : 'pm'}`;
}
function clockWord(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const base = hourWord(h ?? 0);
  return m ? base.replace(' ', `:${String(m).padStart(2, '0')} `) : base;
}
function dayRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}
const basisOf = (a: number, b: number) => `From ${plural(a, 'day')} and ${plural(b, 'day')}. ${INSIGHT_BASIS_TAIL}`;

function watching(key: InsightKey, apps: InsightApp[], reads: InsightPart[], priv: boolean, text: string, need: string, relationship: RelationshipKey | null = null): Insight {
  return { key, id: key, state: 'watching', apps, reads, private: priv, relationship, headline: '', text, basis: '', chart: null, action: null, need, strength: 0 };
}

interface PairSpec {
  key: InsightKey;
  apps: InsightApp[];
  reads: InsightPart[];
  priv: boolean;
  /** What the line is about, for a watching row ("Sleep and mood"). */
  title: string;
  days: { on: boolean | null; y: number | null }[];
  minOn: number;
  minOff?: number;
  /** The smallest gap worth saying, or a function of the two averages. */
  minGap: number | ((on: number, off: number) => number);
  /** The size of a big gap, for ranking. */
  scale: number | ((on: number, off: number) => number);
  fmt: (v: number) => string;
  unit: string;
  onLabel: string;
  offLabel: string;
  sentence: (on: string, off: string) => string;
  same: (on: string, off: string) => string;
  needLine: (more: number) => string;
  action: InsightAction | null;
}

function pairInsight(p: PairSpec): Insight {
  const minOff = p.minOff ?? p.minOn;
  const s = splitCompare(p.days, p.minOn, 0, minOff);
  if (!s.enough || s.on.avg === null || s.off.avg === null) {
    const more = Math.max(0, p.minOn - s.on.n) + Math.max(0, minOff - s.off.n);
    return watching(p.key, p.apps, p.reads, p.priv, p.title, p.needLine(Math.max(1, more)));
  }
  const onV = s.on.avg;
  const offV = s.off.avg;
  const minGap = typeof p.minGap === 'function' ? p.minGap(onV, offV) : p.minGap;
  const scale = Math.max(1e-9, typeof p.scale === 'function' ? p.scale(onV, offV) : p.scale);
  const a = p.fmt(onV);
  const b = p.fmt(offV);
  const big = Math.abs(s.gap) >= minGap && a !== b;
  const strength = big ? Math.max(1, Math.min(85, Math.round(40 + 40 * (Math.abs(s.gap) / scale))) - (s.on.n < 10 || s.off.n < 10 ? 10 : 0)) : 0;
  return {
    key: p.key,
    id: p.key,
    state: 'ready',
    apps: p.apps,
    reads: p.reads,
    private: p.priv,
    relationship: null,
    headline: `${a} vs ${b}`,
    text: big ? p.sentence(a, b) : p.same(a, b),
    basis: basisOf(s.on.n, s.off.n),
    chart: {
      kind: 'pair',
      rows: [
        { label: p.onLabel, value: Math.round(onV * 10) / 10, n: s.on.n, unit: p.unit },
        { label: p.offLabel, value: Math.round(offV * 10) / 10, n: s.off.n, unit: p.unit },
      ],
    },
    action: big ? p.action : null,
    need: null,
    strength,
  };
}

// ---- the signals ---------------------------------------------------------

interface Ctx {
  f: InsightFacts;
  on: (k: string) => boolean;
  yesterday: string;
  pairFrom: string;
  /** Local day of each tick, and its minute. */
  ticks: { day: string; minutes: number; relationship: RelationshipKey }[];
  ticksByDay: Map<string, number>;
  activeDays: Set<string>;
  wb: (kind: string) => Map<string, number>;
  /** Every ticked task read once: its local stamp and its key (2026-11-05: each was worked out again per signal). */
  stamped: StampedTick[];
  /** Open tasks by pillar, each with its key, in the order they came. */
  openByRel: (rel: RelationshipKey) => { o: InsightOpenTaskFact; k: KeyWords }[];
}

interface StampedTick {
  t: InsightTaskFact;
  at: { day: string; minutes: number; weekday: number } | null;
  key: string;
}

interface TickCluster {
  rel: RelationshipKey;
  key: string;
  ticks: { day: string; minutes: number; title: string; parentId: string | null; at: string; repeats: boolean; habit: boolean | null }[];
}

/**
 * Ticks between two local days grouped into the tasks they name: by pillar and exact key first, then keys that name the same
 * thing are joined, biggest first, so the answer never depends on order.
 */
function clusterTicks(stamped: readonly StampedTick[], from: string, to: string, withRepeats: boolean): TickCluster[] {
  const recent = stamped
    .filter((x): x is { t: InsightTaskFact; at: { day: string; minutes: number; weekday: number }; key: string } => (withRepeats || !x.t.repeats) && x.at !== null && x.key !== '' && x.at.day >= from && x.at.day <= to)
    .sort((a, b) => (a.t.completedAt < b.t.completedAt ? -1 : a.t.completedAt > b.t.completedAt ? 1 : a.t.id < b.t.id ? -1 : 1));
  const exact = new Map<string, TickCluster>();
  for (const x of recent) {
    const id = `${x.t.relationship}:${x.key}`;
    const cl = exact.get(id) ?? { rel: x.t.relationship, key: x.key, ticks: [] };
    cl.ticks.push({ day: x.at.day, minutes: x.at.minutes, title: x.t.title.trim(), parentId: x.t.parentId, at: x.t.completedAt, repeats: x.t.repeats, habit: x.t.habit ?? null });
    exact.set(id, cl);
  }
  const clusters: (TickCluster & { words: KeyWords })[] = [];
  const ordered = [...exact.values()].sort((a, b) => b.ticks.length - a.ticks.length || (a.rel + a.key < b.rel + b.key ? -1 : 1));
  for (const cl of ordered) {
    const words = keyWordsOf(cl.key);
    const into = clusters.find((k) => k.rel === cl.rel && sameKey(k.words, words));
    if (into) into.ticks.push(...cl.ticks);
    else clusters.push({ rel: cl.rel, key: cl.key, ticks: [...cl.ticks], words });
  }
  for (const cl of clusters) cl.ticks.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  return clusters;
}

/** What "Make it a habit" fills in for a group of ticks: the open task or the project, the repeat, the time and the first day. */
function suggestionFor(f: InsightFacts, cl: TickCluster, mates: readonly InsightOpenTaskFact[]): HabitSuggestion {
  const activeProjects = new Set(f.projects.map((p) => p.id));
  const days = [...new Set(cl.ticks.map((t) => t.day))].sort();
  const last = cl.ticks[cl.ticks.length - 1]!;
  const openTask = mates[0] ?? null;
  const projectId = openTask?.parentId && activeProjects.has(openTask.parentId) ? openTask.parentId : last.parentId && activeProjects.has(last.parentId) ? last.parentId : null;
  let repeat = suggestRepeat(days, f.today);
  // Ticks older than four weeks leave no weekday to go on: the day of the last one.
  if (repeat.kind === 'weekly' && !repeat.days.length) repeat = { ...repeat, days: [isoWeekday(last.day)] };
  const time = suggestTime(cl.ticks.map((t) => t.minutes));
  let firstDay = days.includes(f.today) ? addDays(f.today, 1) : f.today;
  for (let i = 0; i < 8; i += 1) {
    const w = isoWeekday(firstDay);
    if (repeat.kind === 'daily' || (repeat.kind === 'weekdays' && w <= 5) || (repeat.kind === 'weekly' && repeat.days.includes(w))) break;
    firstDay = addDays(firstDay, 1);
  }
  return { title: last.title, relationship: cl.rel, projectId, openTaskId: openTask?.id ?? null, repeat, time, firstDay, ticks: cl.ticks.length, days };
}

function habits(c: Ctx): Insight[] {
  const { f } = c;
  const apps: InsightApp[] = ['today', 'tower', 'pillar', 'home', 'insights'];
  const from = addDays(f.today, -(HABIT_WINDOW_DAYS - 1));
  const clusters = clusterTicks(c.stamped, from, f.today, false);
  const found: Insight[] = [];
  for (const cl of clusters) {
    const days = [...new Set(cl.ticks.map((t) => t.day))].sort();
    if (cl.ticks.length < HABIT_MIN_TICKS || days.length < HABIT_MIN_TICKS) continue;
    const words = keyWordsOf(cl.key);
    const mates = c.openByRel(cl.rel).filter((x) => sameKey(words, x.k)).map((x) => x.o);
    if (mates.some((o) => o.repeats)) continue;
    const habit = suggestionFor(f, cl, mates);
    const { repeat, time } = habit;
    const n = cl.ticks.length;
    // "Mostly on" only when those weekdays hold at least 60% of the days; a spread is said as a spread.
    const onPicked = repeat.kind === 'weekly' ? days.filter((d) => repeat.days.includes(isoWeekday(d))).length : days.length;
    const when =
      repeat.kind === 'daily'
        ? ', most days'
        : repeat.kind === 'weekdays'
          ? ', on weekdays'
          : onPicked / days.length >= 0.6
            ? `, mostly on ${listWords(repeat.days.map((w) => `${WEEKDAY_NAMES[w - 1]}s`))}`
            : ', on different days of the week';
    const at = time ? ` around ${clockWord(time)}` : '';
    const dotFrom = addDays(f.today, -(HABIT_WINDOW_DAYS - 1));
    const daySet = new Set(days);
    found.push({
      key: 'habit',
      id: `habit:${cl.rel}:${cl.key}`,
      state: 'ready',
      apps,
      reads: ['tasks'],
      private: false,
      relationship: cl.rel,
      headline: `${formatCount(n)} times`,
      text: `You ticked “${habit.title}” ${formatCount(n)} times in 4 weeks${when}${at}. It does not repeat yet.`,
      basis: `From ${plural(n, 'tick')} on ${plural(days.length, 'day')} in 4 weeks.`,
      chart: { kind: 'dots', days: dayRange(dotFrom, f.today).map((d) => ({ date: d, on: daySet.has(d) })) },
      action: habit.projectId || habit.openTaskId ? { label: 'Make it a habit', to: `/realm/${cl.rel}`, kind: 'habit' } : { label: 'Open the pillar', to: `/realm/${cl.rel}`, kind: 'link' },
      need: null,
      strength: Math.min(90, 70 + 5 * Math.max(0, n - HABIT_MIN_TICKS)),
      habit,
    });
  }
  found.sort((a, b) => (b.habit!.ticks - a.habit!.ticks) || (a.id < b.id ? -1 : 1));
  if (!found.length) return [watching('habit', apps, ['tasks'], false, 'Tasks you keep doing', 'Tick the same task on 3 different days in 4 weeks and it shows here.')];
  return found.slice(0, MAX_HABITS);
}

/** The overall balance line, and a line of its own for each pillar in `pillarRels` (a pillar page shows its own). */
function pillarBalance(c: Ctx, pillarRels: readonly RelationshipKey[]): Insight[] {
  const { f } = c;
  const apps: InsightApp[] = ['home', 'tower', 'life', 'reviews', 'insights'];
  const reads: InsightPart[] = ['xp', 'tasks'];
  const byRel = new Map(f.xp30.map((r) => [r.relationship, r]));
  const totalXp = f.xp30.reduce((s, r) => s + Math.max(0, r.xp), 0);
  const totalTicks = f.xp30.reduce((s, r) => s + Math.max(0, r.ticks), 0);
  if (totalTicks < 10 && totalXp < 100) {
    return [watching('pillar-balance', apps, reads, false, 'Where your xp goes', `Tick a few more tasks: ${formatCount(totalTicks)} of 10 so far in 30 days.`)];
  }
  const parts = RELATIONSHIPS.map((r) => ({ relationship: r.key, value: Math.max(0, byRel.get(r.key)?.xp ?? 0) }));
  const share = (k: RelationshipKey) => pct(Math.max(0, byRel.get(k)?.xp ?? 0), totalXp);
  const out: Insight[] = [];
  const focus = f.focusPillars.filter((k) => RELATIONSHIP_BY_KEY[k]);
  let text: string;
  let headline: string;
  let strength = 30;
  let mark: RelationshipKey | undefined;
  let action: InsightAction | null = null;
  if (focus.length) {
    const low = [...focus].sort((a, b) => share(a) - share(b) || (a < b ? -1 : 1))[0]!;
    mark = low;
    headline = `${share(low)}%`;
    text = `${pillarName(low)} got ${share(low)}% of your xp in 30 days. It is one of your focus pillars.`;
    if (share(low) < 10) strength = 60;
    action = { label: `Add a task to ${pillarName(low)}`, to: `/realm/${low}?add=1`, kind: 'link' };
  } else {
    const top = [...parts].sort((a, b) => b.value - a.value || (a.relationship < b.relationship ? -1 : 1))[0]!;
    const none = parts.filter((p) => p.value === 0).map((p) => p.relationship);
    mark = top.relationship;
    headline = `${share(top.relationship)}%`;
    const noneLine = none.length === 1 ? ` ${pillarName(none[0]!)} got none.` : none.length > 1 ? ` ${formatCount(none.length)} pillars got none.` : '';
    text = `${pillarName(top.relationship)} got ${share(top.relationship)}% of your xp in 30 days.${noneLine}`;
    if (none.length) action = { label: `Add a task to ${pillarName(none[0]!)}`, to: `/realm/${none[0]}?add=1`, kind: 'link' };
  }
  out.push({
    key: 'pillar-balance',
    id: 'pillar-balance',
    state: 'ready',
    apps,
    reads,
    private: false,
    relationship: null,
    headline,
    text,
    basis: `From ${plural(totalTicks, 'tick')} and ${formatCount(totalXp)} xp in 30 days.`,
    chart: { kind: 'share', parts, ...(mark ? { mark } : {}) },
    action,
    need: null,
    strength,
  });
  for (const rel of pillarRels) {
    if (!RELATIONSHIP_BY_KEY[rel]) continue;
    const r = byRel.get(rel);
    out.push({
      key: 'pillar-balance',
      id: `pillar-balance:${rel}`,
      state: 'ready',
      apps: ['pillar'],
      reads,
      private: false,
      relationship: rel,
      headline: `${share(rel)}%`,
      text: `${pillarName(rel)}: ${plural(Math.max(0, r?.ticks ?? 0), 'tick')} and ${formatCount(Math.max(0, r?.xp ?? 0))} xp in 30 days, ${share(rel)}% of the total.`,
      basis: `From ${plural(totalTicks, 'tick')} and ${formatCount(totalXp)} xp in 30 days.`,
      chart: { kind: 'share', parts, mark: rel },
      action: null,
      need: null,
      strength: share(rel) < 10 ? 50 : 30,
    });
  }
  return out;
}

const PARTS_OF_DAY: { name: string; from: number; to: number }[] = [
  { name: 'morning', from: 5, to: 12 },
  { name: 'afternoon', from: 12, to: 17 },
  { name: 'evening', from: 17, to: 22 },
  { name: 'night', from: 22, to: 29 },
];
const partOf = (hour: number) => PARTS_OF_DAY.findIndex((p) => (hour < 5 ? hour + 24 : hour) >= p.from && (hour < 5 ? hour + 24 : hour) < p.to);

function bestHours(c: Ctx): Insight {
  const apps: InsightApp[] = ['today', 'mindful', 'insights'];
  const ticks = c.ticks.filter((t) => t.day >= c.pairFrom && t.day <= c.f.today);
  const days = new Set(ticks.map((t) => t.day)).size;
  if (ticks.length < 15 || days < 7) {
    return watching('best-hours', apps, ['tasks'], false, 'When your ticks land', `Tick a few more tasks: ${formatCount(ticks.length)} of 15 so far, on ${formatCount(days)} of 7 days.`);
  }
  const values = [0, 0, 0, 0];
  const byHour = new Array<number>(24).fill(0);
  for (const t of ticks) {
    const h = Math.floor(t.minutes / 60);
    byHour[h] = (byHour[h] ?? 0) + 1;
    const p = partOf(h);
    if (p >= 0) values[p] = (values[p] ?? 0) + 1;
  }
  const top = values.indexOf(Math.max(...values));
  const part = PARTS_OF_DAY[top]!;
  let bestH = part.from;
  let bestN = -1;
  for (let h = part.from; h < part.to - 1; h += 1) {
    const n = (byHour[h % 24] ?? 0) + (byHour[(h + 1) % 24] ?? 0);
    if (n > bestN) {
      bestN = n;
      bestH = h;
    }
  }
  const share = pct(values[top] ?? 0, ticks.length);
  const lead = share >= 50 ? `Most of your ticks land in the ${part.name}` : `Your ticks land most often in the ${part.name}`;
  return {
    key: 'best-hours',
    id: 'best-hours',
    state: 'ready',
    apps,
    reads: ['tasks'],
    private: false,
    relationship: null,
    headline: `${share}%`,
    text: `${lead}: ${share}% of ${formatCount(ticks.length)}, most between ${hourWord(bestH)} and ${hourWord(bestH + 2)}.`,
    basis: `From ${plural(ticks.length, 'tick')} on ${plural(days, 'day')} in 8 weeks.`,
    chart: { kind: 'hours', labels: PARTS_OF_DAY.map((p) => p.name[0]!.toUpperCase() + p.name.slice(1)), values },
    action: { label: 'Plan my week', to: '/today?plan=week', kind: 'link' },
    need: null,
    strength: 35,
  };
}

function streakWeekday(c: Ctx): Insight | null {
  const { f } = c;
  const apps: InsightApp[] = ['today', 'home', 'insights'];
  const first = f.firstCheckin;
  if (!first || daysBetween(first, f.today) < 28) {
    const have = first ? Math.max(0, daysBetween(first, f.today)) : 0;
    return watching('streak-weekday', apps, ['checkins'], false, 'The days you miss', `Check in on Daily for ${formatCount(28 - have)} more days.`);
  }
  // The same first day the route reads check-ins from (today less 83), so a day it never read is never counted as missed.
  const windowStart = addDays(f.today, -(INSIGHT_WINDOW_DAYS - 1));
  const from = first > windowStart ? first : windowStart;
  const have = new Set(f.checkins);
  const span = dayRange(from, c.yesterday);
  const missed = span.filter((d) => !have.has(d));
  if (missed.length < 4) return null;
  const values = [0, 0, 0, 0, 0, 0, 0];
  for (const d of missed) values[isoWeekday(d) - 1] = (values[isoWeekday(d) - 1] ?? 0) + 1;
  const top = values.indexOf(Math.max(...values));
  const n = values[top] ?? 0;
  const weeks = Math.max(1, Math.round(span.length / 7));
  // A tie at the top is a spread, never a day picked by order.
  const tied = values.filter((v) => v === n).length > 1;
  const even = n < 3 || n / missed.length < 0.3 || tied;
  const share = n / missed.length;
  const topLine =
    n === missed.length
      ? `In ${plural(weeks, 'week')}, all ${formatCount(n)} days you missed were ${WEEKDAY_NAMES[top]}s.`
      : share >= 0.5
        ? `Most days you missed are ${WEEKDAY_NAMES[top]}s: ${formatCount(n)} of your ${formatCount(missed.length)} in ${plural(weeks, 'week')}.`
        : `You miss ${WEEKDAY_NAMES[top]}s more than any other day: ${formatCount(n)} of your ${formatCount(missed.length)} missed days in ${plural(weeks, 'week')}.`;
  return {
    key: 'streak-weekday',
    id: 'streak-weekday',
    state: 'ready',
    apps,
    reads: ['checkins'],
    private: false,
    relationship: null,
    headline: even ? `${formatCount(missed.length)} missed` : `${formatCount(n)} of ${formatCount(missed.length)}`,
    text: even
      ? `You missed ${plural(missed.length, 'day')} in ${plural(weeks, 'week')}, with no one day standing out.`
      : topLine,
    basis: `From ${plural(span.length, 'day')} since your first check-in, up to 12 weeks.`,
    chart: { kind: 'week', labels: WEEKDAY_SHORT, values },
    action: even ? null : { label: `Remind me on ${WEEKDAY_NAMES[top]}s`, to: `/today?remind=${top + 1}#reminders`, kind: 'link' },
    need: null,
    strength: even ? 0 : Math.min(80, 50 + 5 * Math.max(0, n - 3)),
  };
}

function pairDays(c: Ctx, from: string, onOf: (d: string) => boolean | null, yOf: (d: string) => number | null): { on: boolean | null; y: number | null }[] {
  return dayRange(from, c.yesterday).map((d) => ({ on: onOf(d), y: yOf(d) }));
}
const ticksOn = (c: Ctx) => (d: string) => (c.activeDays.has(d) ? (c.ticksByDay.get(d) ?? 0) : null);
const tasksFmt = (v: number) => one(v);
const tasksScale = (a: number, b: number) => Math.max(a, b, 1);

function sleepMood(c: Ctx): Insight {
  const sleep = c.wb('sleep');
  const mood = c.wb('mood');
  const both = [...sleep.entries()].filter(([d]) => d >= c.pairFrom && d <= c.yesterday && mood.has(d)).map(([, v]) => v).sort((a, b) => a - b);
  const median = both.length ? (both.length % 2 ? both[(both.length - 1) / 2]! : (both[both.length / 2 - 1]! + both[both.length / 2]!) / 2) : 7;
  const cut = Math.round(median * 2) / 2;
  const cutWord = Number.isInteger(cut) ? String(cut) : cut.toFixed(1);
  return pairInsight({
    key: 'sleep-mood',
    apps: ['sleep', 'mood', 'wellbeing', 'insights'],
    reads: ['wellbeing'],
    priv: true,
    title: 'Sleep and mood',
    days: pairDays(c, c.pairFrom, (d) => (sleep.has(d) ? (sleep.get(d) ?? 0) >= cut : null), (d) => mood.get(d) ?? null),
    minOn: PAIR_MIN_DAYS,
    minGap: 0.5,
    scale: 2,
    fmt: one,
    unit: '',
    onLabel: `Mood after ${cutWord} h or more`,
    offLabel: 'Mood after less',
    sentence: (a, b) => `On days after ${cutWord} hours of sleep or more, your mood was ${a} on average. On other days, ${b}.`,
    same: (a, b) => `Your mood was about the same either way: ${a} after ${cutWord} hours of sleep or more, ${b} after less.`,
    needLine: (k) => `Log sleep and mood on ${plural(k, 'more day')}.`,
    action: { label: 'Log last night', to: '/sleep', kind: 'link' },
  });
}

function focusTasks(c: Ctx): Insight {
  const focus = new Map<string, number>();
  for (const r of c.f.focus) focus.set(r.day, (focus.get(r.day) ?? 0) + Math.max(0, r.minutes));
  return pairInsight({
    key: 'focus-tasks',
    apps: ['mindful', 'today', 'insights'],
    reads: ['focus', 'tasks'],
    priv: false,
    title: 'Focus and tasks',
    days: pairDays(
      c,
      c.pairFrom,
      (d) => {
        const m = focus.get(d) ?? 0;
        return m >= 25 ? true : m === 0 ? false : null;
      },
      ticksOn(c),
    ),
    minOn: 5,
    minGap: 0.5,
    scale: tasksScale,
    fmt: tasksFmt,
    unit: 'tasks',
    onLabel: 'With a focus session',
    offLabel: 'Without',
    sentence: (a, b) => `On days with a focus session, you ticked ${a} tasks. On other days, ${b}.`,
    same: (a, b) => `You ticked about the same either way: ${a} tasks with a focus session, ${b} without.`,
    needLine: (k) => `Have ${plural(k, 'more day')} with and without a focus session of 25 minutes.`,
    action: { label: 'Start focus', to: '/mindful', kind: 'link' },
  });
}

function stressCalm(c: Ctx): Insight | null {
  const { f } = c;
  const apps: InsightApp[] = ['stress', 'mindful', 'wellbeing', 'insights'];
  const reads: InsightPart[] = ['wellbeing', 'water'];
  const stress = c.wb('stress');
  const logged = [...stress.keys()].filter((d) => d >= c.pairFrom && d <= c.yesterday).length;
  if (logged < 10) return watching('stress-calm', apps, reads, true, 'Stress and calm', `Log stress on ${plural(10 - logged, 'more day')}.`);
  const mindful = c.wb('mindful');
  const water = new Map<string, number>();
  for (const w of f.water) water.set(w.day, (water.get(w.day) ?? 0) + Math.max(0, w.ml));
  const splits: { name: 'mindful' | 'water'; r: Insight }[] = [];
  const common = { reads, priv: true, title: 'Stress and calm', minOn: 5, minGap: 0.5, scale: 2, fmt: one, unit: '' } as const;
  if (c.on('mindful')) {
    splits.push({
      name: 'mindful',
      r: pairInsight({
        ...common,
        key: 'stress-calm',
        apps,
        days: pairDays(c, c.pairFrom, (d) => (stress.has(d) ? (mindful.get(d) ?? 0) >= 10 : null), (d) => stress.get(d) ?? null),
        onLabel: 'Stress with 10 mindful minutes',
        offLabel: 'Stress on other days',
        sentence: (a, b) => `On days with 10 mindful minutes or more, your stress was ${a} on average. On other days, ${b}.`,
        same: (a, b) => `Your stress was about the same either way: ${a} with 10 mindful minutes, ${b} without.`,
        needLine: (k) => `Log stress on ${plural(k, 'more day')}, some with 10 mindful minutes and some without.`,
        action: { label: 'Breathe for 3 minutes', to: '/mindful', kind: 'link' },
      }),
    });
  }
  if (f.waterGoal && f.waterGoal > 0) {
    const goal = f.waterGoal;
    splits.push({
      name: 'water',
      r: pairInsight({
        ...common,
        key: 'stress-calm',
        apps,
        days: pairDays(c, c.pairFrom, (d) => (stress.has(d) ? (water.get(d) ?? 0) >= goal : null), (d) => stress.get(d) ?? null),
        onLabel: 'Stress on water goal days',
        offLabel: 'Stress on other days',
        sentence: (a, b) => `On days you met your water goal, your stress was ${a} on average. On other days, ${b}.`,
        same: (a, b) => `Your stress was about the same either way: ${a} on water goal days, ${b} on others.`,
        needLine: (k) => `Log stress on ${plural(k, 'more day')}, some with your water goal met and some without.`,
        action: { label: 'Add a glass', to: '/today#water', kind: 'link' },
      }),
    });
  }
  if (!splits.length) return null;
  const ready = splits.filter((s) => s.r.state === 'ready');
  if (!ready.length) return splits[0]!.r;
  ready.sort((a, b) => b.r.strength - a.r.strength || (a.name < b.name ? -1 : 1));
  // The card shows the split its sentence talks about, and only that one.
  return ready[0]!.r;
}

function daytypeDone(c: Ctx): Insight {
  const { f } = c;
  const apps: InsightApp[] = ['today', 'insights'];
  const from = addDays(f.today, -(INSIGHT_WINDOW_DAYS - 1));
  const kindOf = new Map(f.dayTypes.filter((d) => d.day >= from && d.day <= c.yesterday).map((d) => [d.day, d.kind]));
  const counts = new Map<string, number>();
  for (const k of kindOf.values()) counts.set(k, (counts.get(k) ?? 0) + 1);
  const used = [...counts.entries()].filter(([k, n]) => n >= 4 && DAY_TYPES.some((t) => t.key === k)).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 3);
  const offDays = dayRange(from, c.yesterday).filter((d) => !kindOf.has(d) && c.activeDays.has(d));
  if (!used.length || offDays.length < 7) {
    const most = Math.max(0, ...counts.values());
    const need = !used.length ? `Pick a kind of day on Daily on ${plural(4 - Math.min(3, most), 'more day')}.` : `Have ${plural(7 - offDays.length, 'more day')} with no kind of day picked.`;
    return watching('daytype-done', apps, ['dayTypes', 'tasks'], false, 'Kinds of day', need);
  }
  const offAvg = offDays.reduce((s, d) => s + (c.ticksByDay.get(d) ?? 0), 0) / offDays.length;
  const rows: InsightPairRow[] = [];
  let best: { kind: string; avg: number; n: number; gap: number } | null = null;
  for (const [kind, n] of used) {
    const days = [...kindOf.entries()].filter(([, k]) => k === kind).map(([d]) => d);
    const avg = days.reduce((s, d) => s + (c.ticksByDay.get(d) ?? 0), 0) / days.length;
    const name = DAY_TYPES.find((t) => t.key === kind)!.name;
    rows.push({ label: `${name} days`, value: Math.round(avg * 10) / 10, n, unit: 'tasks' });
    const gap = avg - offAvg;
    if (!best || Math.abs(gap) > Math.abs(best.gap)) best = { kind, avg, n, gap };
  }
  rows.push({ label: 'Other days', value: Math.round(offAvg * 10) / 10, n: offDays.length, unit: 'tasks' });
  const b = best!;
  const name = DAY_TYPES.find((t) => t.key === b.kind)!.name;
  const big = Math.abs(b.gap) >= 0.5 && one(b.avg) !== one(offAvg);
  const kindDays = new Set([...kindOf.entries()].filter(([, k]) => k === b.kind).map(([d]) => d));
  const relCount = new Map<RelationshipKey, number>();
  for (const t of c.ticks) if (kindDays.has(t.day)) relCount.set(t.relationship, (relCount.get(t.relationship) ?? 0) + 1);
  const totalOn = [...relCount.values()].reduce((s, n) => s + n, 0);
  const lead = [...relCount.entries()].sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1))[0];
  const leadLine = lead && totalOn ? `, ${pct(lead[1], totalOn)}% of them ${pillarName(lead[0])}` : '';
  return {
    key: 'daytype-done',
    id: 'daytype-done',
    state: 'ready',
    apps,
    reads: ['dayTypes', 'tasks'],
    private: false,
    relationship: null,
    headline: `${one(b.avg)} vs ${one(offAvg)}`,
    text: big ? `On ${name} days you ticked ${one(b.avg)} tasks${leadLine}. On other days, ${one(offAvg)}.` : `You ticked about the same on ${name} days as on others: ${one(b.avg)} and ${one(offAvg)} tasks.`,
    basis: basisOf(b.n, offDays.length),
    chart: { kind: 'pair', rows },
    action: big ? { label: "Pick today's kind of day", to: '/today#day-type', kind: 'link' } : null,
    need: null,
    strength: big ? Math.max(1, Math.min(85, Math.round(40 + 40 * (Math.abs(b.gap) / Math.max(b.avg, offAvg, 1)))) - (b.n < 10 ? 10 : 0)) : 0,
  };
}

function moneyStress(c: Ctx): Insight {
  const { f } = c;
  const stress = c.wb('stress');
  const spent = new Map<string, number>();
  for (const e of f.expenses) spent.set(e.date, (spent.get(e.date) ?? 0) + Math.max(0, Math.round(e.cents)));
  const spendDays = [...spent.entries()].filter(([d, v]) => d >= c.pairFrom && d <= c.yesterday && v > 0).length;
  const apps: InsightApp[] = ['finance', 'stress', 'insights'];
  if (spendDays < 10) return watching('money-stress', apps, ['money', 'wellbeing'], true, 'Spending and stress', `Log spending on ${plural(10 - spendDays, 'more day')}.`);
  // Whole rupees (or the person's whole unit) for the line, kept as integer cents.
  const whole = (v: number) => Math.round(v / 100) * 100;
  return pairInsight({
    key: 'money-stress',
    apps,
    reads: ['money', 'wellbeing'],
    priv: true,
    title: 'Spending and stress',
    days: pairDays(c, c.pairFrom, (d) => (stress.has(d) ? (stress.get(d) ?? 0) >= 4 : null), (d) => (stress.has(d) ? (spent.get(d) ?? 0) : null)),
    minOn: 5,
    minOff: 10,
    minGap: (a, b) => Math.max(100, 0.2 * Math.min(a, b)),
    scale: (a, b) => Math.max(a, b, 100),
    fmt: (v) => money(whole(v), f.currency),
    unit: f.currency,
    onLabel: 'Spent on Stressed days',
    offLabel: 'Spent on calmer days',
    sentence: (a, b) => `On days you logged Stressed or more, you spent ${a} on average. On other days, ${b}.`,
    same: (a, b) => `You spent about the same either way: ${a} on Stressed days, ${b} on calmer ones.`,
    needLine: (k) => `Log stress on ${plural(k, 'more day')}, with your spending.`,
    action: { label: "See this month's spending", to: '/finance', kind: 'link' },
  });
}

function slipsSleep(c: Ctx): Insight {
  const sleep = c.wb('sleep');
  const byDay = new Map(c.f.notToDo.map((r) => [r.day, r]));
  return pairInsight({
    key: 'slips-sleep',
    apps: ['today', 'sleep', 'insights'],
    reads: ['notToDo', 'wellbeing'],
    priv: true,
    title: 'Not to do and sleep',
    days: pairDays(
      c,
      c.pairFrom,
      (d) => {
        const r = byDay.get(d);
        if (!r) return null;
        return r.slipped > 0 ? true : r.kept > 0 ? false : null;
      },
      (d) => sleep.get(d) ?? null,
    ),
    minOn: 4,
    minOff: PAIR_MIN_DAYS,
    minGap: 0.5,
    scale: 2,
    fmt: one,
    unit: 'h',
    onLabel: 'Sleep on slip days',
    offLabel: 'Sleep on kept days',
    sentence: (a, b) => `On days you slipped on your not to do list, you had slept ${a} hours. On other days, ${b}.`,
    same: (a, b) => `You had slept about the same either way: ${a} hours on slip days, ${b} on kept days.`,
    needLine: (k) => `Mark your not to do list and log sleep on ${plural(k, 'more day')}.`,
    action: { label: 'Set a lights-out reminder', to: '/today?remind=1#reminders', kind: 'link' },
  });
}

function routineTasks(c: Ctx): Insight | null {
  if (!c.f.routine.length) return null;
  const byDay = new Map(c.f.routine.map((r) => [r.day, r.done]));
  return pairInsight({
    key: 'routine-tasks',
    apps: ['today', 'tower', 'insights'],
    reads: ['routine', 'tasks'],
    priv: false,
    title: 'Morning routine and tasks',
    days: pairDays(c, c.pairFrom, (d) => (byDay.has(d) ? Boolean(byDay.get(d)) : null), (d) => c.ticksByDay.get(d) ?? 0),
    minOn: 5,
    minGap: 0.5,
    scale: tasksScale,
    fmt: tasksFmt,
    unit: 'tasks',
    onLabel: 'Routine done',
    offLabel: 'Routine not done',
    sentence: (a, b) => `On days you finished your morning routine, you ticked ${a} tasks. On other days, ${b}.`,
    same: (a, b) => `You ticked about the same either way: ${a} tasks with your routine done, ${b} without.`,
    needLine: (k) => `Open your routine on Daily on ${plural(k, 'more day')}.`,
    action: { label: "Open today's routine", to: '/today#routine', kind: 'link' },
  });
}

function journalMood(c: Ctx): Insight {
  const mood = c.wb('mood');
  const wrote = new Set(c.f.journalAt.map((iso) => localStamp(iso, c.f.zone)?.day).filter((d): d is string => Boolean(d)));
  return pairInsight({
    key: 'journal-mood',
    apps: ['journal', 'mood', 'insights'],
    reads: ['journal', 'wellbeing'],
    priv: true,
    title: 'Journal and mood',
    days: pairDays(c, c.pairFrom, (d) => (mood.has(d) ? wrote.has(d) : null), (d) => mood.get(d) ?? null),
    minOn: 5,
    minGap: 0.5,
    scale: 2,
    fmt: one,
    unit: '',
    onLabel: 'Mood on journal days',
    offLabel: 'Mood on other days',
    sentence: (a, b) => `On days you wrote in your journal, your mood was ${a} on average. On other days, ${b}.`,
    same: (a, b) => `Your mood was about the same either way: ${a} on journal days, ${b} on others.`,
    needLine: (k) => `Log your mood on ${plural(k, 'more day')}, some with a journal entry and some without.`,
    action: { label: 'Write today', to: '/journal?new=1', kind: 'link' },
  });
}

interface Mover {
  key: string;
  then: number;
  now: number;
  /** "24 tasks, up from 18" */
  line: (now: string, then: string, up: boolean) => string;
  delta: (d: number) => string;
  fmt: (v: number) => string;
  label: string;
  unit: string;
}

function reviewSince(c: Ctx): Insight | null {
  const r = c.f.review;
  const apps: InsightApp[] = ['reviews', 'home', 'insights'];
  if (!r) return watching('review-since', apps, ['reviews'], false, 'Since your last review', 'Save a review and the period after it shows here.');
  if (r.sinceStart > c.f.today) return null;
  const sign = (d: number, f: (v: number) => string) => `${d > 0 ? '+' : d < 0 ? '−' : ''}${f(Math.abs(d))}`;
  const daysSoFar = Math.max(1, daysBetween(r.sinceStart, r.sinceEnd < c.f.today ? r.sinceEnd : c.f.today) + 1);
  const thenDays = Math.max(1, r.then.days);
  // A count is compared as a whole only over two spans of the same length; a period still running (or a month of
  // another length) is compared per day, so three days are never set against a whole week.
  const whole = r.ended && daysSoFar === thenDays;
  const pctWord = (v: number) => `${Math.round(v)}%`;
  const cand: Mover[] = whole
    ? [
        { key: 'tasks', then: r.then.tasksDone, now: r.since.tasksDone, line: (n, t, up) => `${n} tasks, ${up ? 'up' : 'down'} from ${t}`, delta: (d) => `${sign(d, formatCount)} tasks`, fmt: formatCount, label: 'Tasks', unit: 'tasks' },
        { key: 'active', then: r.then.activeDays, now: r.since.activeDays, line: (n, t, up) => `${n} active days, ${up ? 'up' : 'down'} from ${t}`, delta: (d) => `${sign(d, formatCount)} days`, fmt: formatCount, label: 'Active days', unit: 'days' },
        { key: 'kept', then: r.then.notToDoKept, now: r.since.notToDoKept, line: (n, t, up) => `${n} kept on your not to do list, ${up ? 'up' : 'down'} from ${t}`, delta: (d) => `${sign(d, formatCount)} kept`, fmt: formatCount, label: 'Not to do kept', unit: 'days' },
      ]
    : [
        { key: 'tasks', then: r.then.tasksDone / thenDays, now: r.since.tasksDone / daysSoFar, line: (n, t, up) => `${n} tasks a day, ${up ? 'up' : 'down'} from ${t}`, delta: (d) => `${sign(d, one)} a day`, fmt: one, label: 'Tasks a day', unit: 'tasks' },
        { key: 'active', then: (100 * r.then.activeDays) / thenDays, now: (100 * r.since.activeDays) / daysSoFar, line: (n, t, up) => `active on ${n} of days, ${up ? 'up' : 'down'} from ${t}`, delta: (d) => `${sign(d, pctWord)} active`, fmt: pctWord, label: 'Days active', unit: '%' },
        { key: 'kept', then: (100 * r.then.notToDoKept) / thenDays, now: (100 * r.since.notToDoKept) / daysSoFar, line: (n, t, up) => `not to do kept on ${n} of days, ${up ? 'up' : 'down'} from ${t}`, delta: (d) => `${sign(d, pctWord)} kept`, fmt: pctWord, label: 'Not to do kept', unit: '%' },
      ];
  const priv = { sleep: c.on('sleep'), mood: c.on('mood'), mindful: c.on('mindful') };
  if (priv.sleep && r.then.sleepAvg !== null && r.since.sleepAvg !== null)
    cand.push({ key: 'sleep', then: r.then.sleepAvg, now: r.since.sleepAvg, line: (n, t, up) => `sleep ${n} h, ${up ? 'up' : 'down'} from ${t}`, delta: (d) => `${sign(d, one)} h sleep`, fmt: one, label: 'Sleep', unit: 'h' });
  if (priv.mood && r.then.moodAvg !== null && r.since.moodAvg !== null)
    cand.push({ key: 'mood', then: r.then.moodAvg, now: r.since.moodAvg, line: (n, t, up) => `mood ${n}, ${up ? 'up' : 'down'} from ${t}`, delta: (d) => `${sign(d, one)} mood`, fmt: one, label: 'Mood', unit: '' });
  if (priv.mindful && whole)
    cand.push({ key: 'mindful', then: r.then.mindfulMin, now: r.since.mindfulMin, line: (n, t, up) => `${n} mindful minutes, ${up ? 'up' : 'down'} from ${t}`, delta: (d) => `${sign(d, formatCount)} minutes`, fmt: formatCount, label: 'Mindful minutes', unit: 'min' });
  else if (priv.mindful)
    cand.push({ key: 'mindful', then: r.then.mindfulMin / thenDays, now: r.since.mindfulMin / daysSoFar, line: (n, t, up) => `${n} mindful minutes a day, ${up ? 'up' : 'down'} from ${t}`, delta: (d) => `${sign(d, formatCount)} min a day`, fmt: (v) => formatCount(Math.round(v)), label: 'Mindful a day', unit: 'min' });
  const movers = cand
    .filter((m) => m.fmt(m.now) !== m.fmt(m.then))
    .sort((a, b) => Math.abs(b.now - b.then) / Math.max(Math.abs(b.then), 1) - Math.abs(a.now - a.then) / Math.max(Math.abs(a.then), 1) || (a.key < b.key ? -1 : 1))
    .slice(0, 2);
  const isPriv = movers.some((m) => m.key === 'sleep' || m.key === 'mood' || m.key === 'mindful');
  const kindWord = PERIOD_META[r.kind].short.toLowerCase();
  const label = periodLabel({ kind: r.kind, start: r.start, end: r.end } as Parameters<typeof periodLabel>[0]);
  const lead = `Since your ${kindWord} review of ${label}${r.ended ? '' : ', so far'}`;
  const daysIn = Math.max(1, daysBetween(r.sinceStart, r.sinceEnd < c.f.today ? r.sinceEnd : c.f.today) + 1);
  const fresh = !r.ended && daysIn <= 3;
  if (!movers.length) {
    return {
      key: 'review-since',
      id: 'review-since',
      state: 'ready',
      apps,
      reads: ['reviews'],
      private: false,
      relationship: null,
      headline: 'Steady',
      text: `${lead}: your numbers are about the same as then.`,
      basis: `From your saved ${kindWord} review and ${plural(daysIn, 'day')} since.`,
      chart: null,
      action: { label: 'Write a review', to: `/reviews?kind=${r.kind}`, kind: 'link' },
      need: null,
      strength: 0,
    };
  }
  const parts = movers.map((m) => m.line(m.fmt(m.now), m.fmt(m.then), m.now > m.then));
  // One mover in the sentence, the one the card draws first, so the card stays short.
  const sentence = `${lead}: ${parts[0]}.`;
  return {
    key: 'review-since',
    id: 'review-since',
    state: 'ready',
    apps,
    reads: isPriv ? ['reviews', 'wellbeing'] : ['reviews'],
    private: isPriv,
    relationship: null,
    // Per day, both numbers ("33% vs 57%"), so a share is never read as a change of a share.
    headline: whole ? movers[0]!.delta(movers[0]!.now - movers[0]!.then) : `${movers[0]!.fmt(movers[0]!.now)} vs ${movers[0]!.fmt(movers[0]!.then)}`,
    text: sentence,
    basis: `From your saved ${kindWord} review and ${plural(daysIn, 'day')} since.`,
    chart: {
      kind: 'pair',
      rows: movers.flatMap((m) => [
        { label: `${m.label} then`, value: Math.round(m.then * 10) / 10, n: r.then.days, unit: m.unit },
        { label: `${m.label} since`, value: Math.round(m.now * 10) / 10, n: daysIn, unit: m.unit },
      ]),
    },
    action: { label: `Write this ${kindWord}'s review`, to: `/reviews?kind=${r.kind}`, kind: 'link' },
    need: null,
    strength: fresh ? 55 : 25,
  };
}

function discoverStrength(c: Ctx): Insight | null {
  const d = c.f.discover;
  if (!d || !d.steps || !RELATIONSHIP_BY_KEY[d.growth]) return null;
  const apps: InsightApp[] = ['discover', 'pillar', 'insights'];
  const ticks = c.f.xp30.reduce((s, r) => s + Math.max(0, r.ticks), 0);
  if (ticks < 10) return watching('discover-strength', apps, ['discover', 'tasks'], false, 'Your quietest strength', `Tick a few more tasks: ${formatCount(ticks)} of 10 so far in 30 days.`, d.growth);
  const by = new Map(c.f.xp30.map((r) => [r.relationship, Math.max(0, r.ticks)]));
  const mine = by.get(d.growth) ?? 0;
  const share = pct(mine, ticks);
  const min = Math.min(...RELATIONSHIPS.map((r) => by.get(r.key) ?? 0));
  const strength = DISCOVER_STRENGTHS[d.growth].name;
  const pillar = pillarName(d.growth);
  const lead = `Your quietest strength is ${strength}, the ${pillar} pillar.`;
  const quiet = share < 10;
  const text = quiet
    ? `${lead} ${pillar} got ${share}% of your ticks in 30 days${mine === min ? ', the fewest of any pillar' : ''}.`
    : `${lead} You already give ${pillar} ${share}% of your ticks.`;
  return {
    key: 'discover-strength',
    id: 'discover-strength',
    state: 'ready',
    apps,
    reads: ['discover', 'tasks'],
    private: false,
    relationship: d.growth,
    headline: `${share}%`,
    text,
    basis: `From your Discover result and ${plural(ticks, 'tick')} in 30 days.`,
    chart: { kind: 'share', parts: RELATIONSHIPS.map((r) => ({ relationship: r.key, value: by.get(r.key) ?? 0 })), mark: d.growth },
    action: { label: `Add a task to ${pillar}`, to: `/realm/${d.growth}?add=1`, kind: 'link' },
    need: null,
    strength: quiet ? 45 : 20,
  };
}

function agencyLoad(c: Ctx): Insight {
  const due = new Set(c.f.agencyDue);
  return pairInsight({
    key: 'agency-load',
    apps: ['agency', 'today', 'insights'],
    reads: ['agency', 'tasks'],
    priv: false,
    title: 'Client work and your tasks',
    days: pairDays(c, c.pairFrom, (d) => (c.activeDays.has(d) || due.has(d) ? due.has(d) : null), (d) => c.ticksByDay.get(d) ?? 0),
    minOn: 5,
    minOff: PAIR_MIN_DAYS,
    minGap: 0.5,
    scale: tasksScale,
    fmt: tasksFmt,
    unit: 'tasks',
    onLabel: 'A client piece due',
    offLabel: 'Nothing due',
    sentence: (a, b) => `On days a client piece was due, you ticked ${a} of your own tasks. On other days, ${b}.`,
    same: (a, b) => `You ticked about the same either way: ${a} tasks with a client piece due, ${b} without.`,
    needLine: (k) => `Give client pieces due days on ${plural(k, 'more day')}.`,
    action: { label: 'Plan my week', to: '/today?plan=week', kind: 'link' },
  });
}

// ---- good and bad habits (2026-11-04) --------------------------------------
// A task done again and again, or a slip on the not to do list, set against the person's own days: on days with it, how did the
// day go next to days without it. How the day felt (mood, sleep that night, stress) decides first; other tasks and focus decide
// only when no feeling is clear, and back a verdict up only when they agree. Every line says what went together, never a cause.

/** What a habit is set against: mood, sleep that night, stress (lower is calmer), other tasks ticked and focus minutes. */
export type TieSignalName = 'mood' | 'sleep' | 'calm' | 'tasks' | 'focus';
const TIE_ORDER: TieSignalName[] = ['mood', 'sleep', 'calm', 'tasks', 'focus'];
export interface TieSignal {
  name: TieSignalName;
  /** How the day felt (wellbeing): private, and it decides first. */
  feel: boolean;
  apps: InsightApp[];
  reads: InsightPart[];
  /** The day's number, or null when there is none; `own` is how many of the habit's own ticks fell that day. */
  y: (d: string, own: number) => number | null;
  /** 1 when higher is a better day, -1 when lower is (stress). */
  better: 1 | -1;
  minGap: number;
  scale: (a: number, b: number) => number;
  fmt: (v: number) => string;
  unit: string;
  label: string;
  /** "your mood was 0.8 higher": `up` means higher on the days with it. */
  said: (gap: number, up: boolean) => string;
}

function tieSignals(c: Ctx, kind: 'task' | 'notToDo'): TieSignal[] {
  const out: TieSignal[] = [];
  const twoScale = () => 2;
  if (c.on('mood')) {
    const mood = c.wb('mood');
    out.push({ name: 'mood', feel: true, apps: ['mood', 'wellbeing'], reads: ['wellbeing'], y: (d) => mood.get(d) ?? null, better: 1, minGap: 0.5, scale: twoScale, fmt: one, unit: '', label: 'Mood', said: (g, up) => `your mood was ${one(g)} ${up ? 'higher' : 'lower'}` });
  }
  if (c.on('sleep')) {
    // Sleep is logged on the morning after ("last night"), so the night after a day is the next day's log.
    const sleep = c.wb('sleep');
    out.push({ name: 'sleep', feel: true, apps: ['sleep', 'wellbeing'], reads: ['wellbeing'], y: (d) => sleep.get(addDays(d, 1)) ?? null, better: 1, minGap: 0.5, scale: twoScale, fmt: one, unit: 'h', label: 'Sleep that night', said: (g, up) => `you slept ${one(g)} hours ${up ? 'more' : 'less'} that night` });
  }
  if (c.on('stress')) {
    const stress = c.wb('stress');
    out.push({ name: 'calm', feel: true, apps: ['stress', 'wellbeing'], reads: ['wellbeing'], y: (d) => stress.get(d) ?? null, better: -1, minGap: 0.5, scale: twoScale, fmt: one, unit: '', label: 'Stress', said: (g, up) => `your stress was ${one(g)} ${up ? 'higher' : 'lower'}` });
  }
  const other = kind === 'task' ? 'other tasks' : 'tasks';
  out.push({
    name: 'tasks',
    feel: false,
    apps: [],
    reads: ['tasks'],
    y: (d, own) => (c.activeDays.has(d) ? Math.max(0, (c.ticksByDay.get(d) ?? 0) - own) : null),
    better: 1,
    minGap: 0.5,
    scale: tasksScale,
    fmt: tasksFmt,
    unit: 'tasks',
    label: kind === 'task' ? 'Other tasks' : 'Tasks',
    said: (g, up) => `you ticked ${one(g)} ${up ? 'more' : 'fewer'} ${other}`,
  });
  if (c.on('mindful')) {
    const focus = new Map<string, number>();
    for (const r of c.f.focus) focus.set(r.day, (focus.get(r.day) ?? 0) + Math.max(0, r.minutes));
    out.push({
      name: 'focus',
      feel: false,
      apps: ['mindful'],
      reads: ['focus'],
      y: (d) => (c.activeDays.has(d) ? (focus.get(d) ?? 0) : null),
      better: 1,
      minGap: 10,
      scale: (a, b) => Math.max(a, b, 25),
      fmt: (v) => formatCount(Math.round(v)),
      unit: 'min',
      label: 'Focus',
      said: (g, up) => `you focused ${formatCount(Math.round(g))} minutes ${up ? 'more' : 'less'}`,
    });
  }
  return out;
}

function listOr(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}`;
}
const FEEL_WORDS: Record<TieSignalName, string> = { mood: 'mood', sleep: 'sleep', calm: 'stress', tasks: 'tasks', focus: 'focus' };

interface TieCandidate {
  kind: 'task' | 'notToDo';
  id: string;
  key: string;
  title: string;
  rel: RelationshipKey | null;
  /** Each day from the first one it could count to yesterday: with it (or a slip), without it (or kept), or not known. */
  days: { d: string; on: boolean | null; own: number }[];
  repeats: boolean;
  to: string;
  toLabel: string;
  canAddNotToDo: boolean;
  suggestion: HabitSuggestion | null;
  /** The person's own "Count it as a habit": true lowers the floor, false asks for a strong pattern. */
  habit: boolean | null;
}

/**
 * The one classifier: a clear lift on how the days went is a good habit, a clear dip a bad one, and too few days, no gap or a
 * mix is still watching. A slip on the not to do list is the bad side, so it can only be a bad habit. Pure.
 */
export function classifyHabitTie(days: readonly { on: boolean | null; ys: Partial<Record<TieSignalName, number | null>> }[], signals: readonly Pick<TieSignal, 'name' | 'feel' | 'better' | 'minGap' | 'scale' | 'fmt'>[], slip: boolean, minOn = HABIT_TIE_MIN_DAYS, minOff = PAIR_MIN_DAYS, minNorm = 0): {
  verdict: 'good' | 'bad' | 'watching';
  /** Why it is still watching. */
  reason: 'days' | 'same' | 'mixed' | null;
  /** The signals behind the verdict, the strongest first (at most two). */
  shown: { name: TieSignalName; split: SplitResult; norm: number }[];
  /** The fewest more days any signal needs. */
  more: number;
} {
  const splits = signals.map((s) => ({ s, split: splitCompare(days.map((d) => ({ on: d.on, y: d.ys[s.name] ?? null })), minOn, s.minGap, minOff) }));
  const more = Math.max(1, Math.min(...splits.map(({ split }) => Math.max(0, minOn - split.on.n) + Math.max(0, minOff - split.off.n)), Number.MAX_SAFE_INTEGER));
  const clear = splits
    .filter(({ s, split }) => split.ready && split.on.avg !== null && split.off.avg !== null && s.fmt(split.on.avg) !== s.fmt(split.off.avg))
    .map(({ s, split }) => ({ s, split, dir: Math.sign(split.gap) * s.better, norm: Math.abs(split.gap) / Math.max(1e-9, s.scale(split.on.avg!, split.off.avg!)) }));
  if (!splits.some(({ split }) => split.enough)) return { verdict: 'watching', reason: 'days', shown: [], more };
  // How the day felt decides; tasks and focus only when no feeling is clear.
  const feel = clear.filter((x) => x.s.feel);
  const pool = feel.length ? feel : clear;
  const ups = pool.filter((x) => x.dir > 0);
  const downs = pool.filter((x) => x.dir < 0);
  if (!pool.length) return { verdict: 'watching', reason: 'same', shown: [], more: 0 };
  if (ups.length && downs.length) return { verdict: 'watching', reason: 'mixed', shown: [], more: 0 };
  // A better day after a slip is no verdict: the not to do list only ever names a bad habit.
  if (slip && ups.length) return { verdict: 'watching', reason: 'same', shown: [], more: 0 };
  const verdict: 'good' | 'bad' = ups.length ? 'good' : 'bad';
  const dir = verdict === 'good' ? 1 : -1;
  const agree = clear.filter((x) => x.dir === dir).sort((a, b) => Number(b.s.feel) - Number(a.s.feel) || b.norm - a.norm || TIE_ORDER.indexOf(a.s.name) - TIE_ORDER.indexOf(b.s.name));
  // Only a strong pattern when one is asked for (a task the person said is not a habit).
  if ((agree[0]?.norm ?? 0) < minNorm) return { verdict: 'watching', reason: 'same', shown: [], more: 0 };
  return { verdict, reason: null, shown: agree.slice(0, 2).map((x) => ({ name: x.s.name, split: x.split, norm: x.norm })), more: 0 };
}

function tieInsight(c: Ctx, cand: TieCandidate, signals: TieSignal[]): Insight | null {
  const slip = cand.kind === 'notToDo';
  const days = cand.days.map((d) => ({ on: d.on, ys: Object.fromEntries(signals.map((s) => [s.name, d.on === null ? null : s.y(d.d, d.own)])) as Partial<Record<TieSignalName, number | null>> }));
  const strict = cand.habit === false;
  const r = strict ? classifyHabitTie(days, signals, slip, HABIT_TIE_STRICT_DAYS, HABIT_TIE_STRICT_DAYS, HABIT_TIE_STRICT_NORM) : classifyHabitTie(days, signals, slip);
  // Not a habit by the person's own word: only a strong pattern is said, and nothing waits under Still watching.
  if (strict && r.verdict === 'watching') return null;
  const baseApps: InsightApp[] = cand.kind === 'task' ? ['home', 'today', 'tower', 'pillar', 'insights'] : ['home', 'today', 'pillar', 'insights'];
  const baseReads: InsightPart[] = [cand.kind === 'task' ? 'tasks' : 'notToDo'];
  const quoted = `“${cand.title}”`;
  if (r.verdict === 'watching') {
    const feelOn = signals.filter((s) => s.feel).map((s) => FEEL_WORDS[s.name]);
    const logged = feelOn.length ? `, with your ${listOr(feelOn)} logged` : '';
    const need =
      r.reason === 'days'
        ? slip
          ? `Mark it kept or slipped on ${plural(r.more, 'more day')}${logged}.`
          : `Have ${plural(r.more, 'more day')} with it and without${logged}.`
        : r.reason === 'mixed'
          ? 'Mixed so far: some days went better with it, some worse.'
          : slip
            ? 'Nothing clear yet between slip days and kept days.'
            : 'About the same so far on days with it and without.';
    const w = watching('habit-tie', ['insights'], baseReads, false, slip ? `Slips on ${quoted} and how your days go` : `${quoted} and how your days go`, need, cand.rel);
    return { ...w, id: `habit-tie:${cand.id}` };
  }
  const byName = new Map(signals.map((s) => [s.name, s]));
  const shown = r.shown.map((x) => ({ ...x, s: byName.get(x.name)! }));
  const lead = shown[0]!;
  const a = lead.s.fmt(lead.split.on.avg!);
  const b = lead.s.fmt(lead.split.off.avg!);
  const clauses = shown.map((x) => x.s.said(Math.abs(x.split.gap), x.split.gap > 0));
  const text = `On days you ${slip ? 'slipped on' : 'ticked'} ${quoted}, ${clauses.join(' and ')}, on average.`;
  const onN = Math.min(...shown.map((x) => x.split.on.n));
  const offN = Math.min(...shown.map((x) => x.split.off.n));
  const basis = slip
    ? `From ${plural(lead.split.on.n, 'slip day')} and ${plural(lead.split.off.n, 'kept day')} in 8 weeks. ${INSIGHT_BASIS_TAIL}`
    : `From ${plural(lead.split.on.n, 'day')} with it and ${plural(lead.split.off.n, 'day')} without, in 8 weeks. ${INSIGHT_BASIS_TAIL}`;
  const rows: InsightPairRow[] = shown.flatMap((x) => [
    { label: slip ? `${x.s.label} on slip days` : `${x.s.label} with it`, value: Math.round(x.split.on.avg! * 10) / 10, n: x.split.on.n, unit: x.s.unit },
    { label: slip ? `${x.s.label} on kept days` : `${x.s.label} without`, value: Math.round(x.split.off.avg! * 10) / 10, n: x.split.off.n, unit: x.s.unit },
  ]);
  const priv = shown.some((x) => x.s.feel);
  const apps = [...new Set<InsightApp>([...baseApps, ...shown.flatMap((x) => x.s.apps)])];
  const reads = [...new Set<InsightPart>([...baseReads, ...shown.flatMap((x) => x.s.reads)])];
  const verdict = r.verdict;
  const open: InsightAction = { label: cand.toLabel, to: cand.to, kind: 'link' };
  const action: InsightAction =
    verdict === 'good'
      ? cand.suggestion && !cand.repeats && (cand.suggestion.projectId || cand.suggestion.openTaskId)
        ? { label: 'Make it a habit', to: cand.rel ? `/realm/${cand.rel}` : '/today', kind: 'habit' }
        : open
      : cand.kind === 'task' && cand.canAddNotToDo
        ? { label: 'Add to not to do', to: '/today#ntd-heading', kind: 'notToDo' }
        : open;
  const strength = Math.max(1, Math.min(90, Math.round(40 + 40 * Math.min(1, lead.norm)) - (onN < 10 || offN < 10 ? 10 : 0) + (shown.length > 1 ? 5 : 0)));
  return {
    key: 'habit-tie',
    id: `habit-tie:${cand.id}`,
    state: 'ready',
    apps,
    reads,
    private: priv,
    relationship: cand.rel,
    headline: `${a} vs ${b}`,
    text,
    basis,
    chart: { kind: 'pair', rows },
    action,
    need: null,
    strength,
    ...(action.kind === 'habit' && cand.suggestion ? { habit: cand.suggestion } : {}),
    tie: { verdict, kind: cand.kind, title: cand.title, key: cand.key, relationship: cand.rel, to: cand.to, toLabel: cand.toLabel, repeats: cand.repeats, canAddNotToDo: cand.canAddNotToDo },
  };
}

function habitTies(c: Ctx): Insight[] {
  const { f } = c;
  const to = c.yesterday;
  const candidates: TieCandidate[] = [];
  const listKeys = f.notToDoItems.map((i) => keyWordsOf(taskKey(i.title)));
  const onList = (key: string) => {
    const words = keyWordsOf(key);
    return listKeys.some((k) => sameKey(k, words));
  };
  const listRoom = f.notToDoItems.length < MAX_NOT_TO_DO;
  // Tasks: every group ticked on at least 3 days in 8 weeks, repeating or not, the most days first. A task the person counts as a
  // habit is one from its first tick, and comes first.
  // The person's own pick on an open task in the group wins (the first such task, in the order they came), then the newest tick's.
  // Only open tasks that carry a pick are looked at here; the whole group of mates is found for the twelve kept below.
  const habitOf = (cl: TickCluster): boolean | null => {
    const words = keyWordsOf(cl.key);
    const set = c.openByRel(cl.rel).find((x) => (x.o.habit === true || x.o.habit === false) && sameKey(words, x.k));
    if (set) return set.o.habit ?? null;
    for (let k = cl.ticks.length - 1; k >= 0; k -= 1) if (cl.ticks[k]!.habit !== null) return cl.ticks[k]!.habit;
    return null;
  };
  const matesOf = (cl: TickCluster) => {
    const words = keyWordsOf(cl.key);
    return c.openByRel(cl.rel).filter((x) => sameKey(words, x.k)).map((x) => x.o);
  };
  const clusters = clusterTicks(c.stamped, c.pairFrom, to, true)
    .map((cl) => ({ cl, days: [...new Set(cl.ticks.map((t) => t.day))].sort(), habit: habitOf(cl) }))
    .filter((x) => x.days.length >= (x.habit === true ? 1 : HABIT_MIN_TICKS))
    .sort((a, b) => Number(b.habit === true) - Number(a.habit === true) || b.days.length - a.days.length || (a.cl.rel + a.cl.key < b.cl.rel + b.cl.key ? -1 : 1))
    .slice(0, 12);
  for (const { cl, days, habit } of clusters) {
    const mates = matesOf(cl);
    const repeats = cl.ticks.some((t) => t.repeats) || mates.some((o) => o.repeats);
    const onDaily = mates.find((o) => o.openDay && o.openDay <= f.today);
    const own = new Map<string, number>();
    for (const t of cl.ticks) own.set(t.day, (own.get(t.day) ?? 0) + 1);
    const span = dayRange(days[0]!, to);
    const suggestion = suggestionFor(f, cl, mates.filter((o) => !o.repeats));
    candidates.push({
      kind: 'task',
      id: `task:${cl.rel}:${cl.key}`,
      key: cl.key,
      title: cl.ticks[cl.ticks.length - 1]!.title,
      rel: cl.rel,
      days: span.map((d) => ({ d, on: own.has(d), own: own.get(d) ?? 0 })),
      repeats,
      to: onDaily ? `/today?task=${onDaily.id}` : `/realm/${cl.rel}`,
      toLabel: 'Open the task',
      canAddNotToDo: listRoom && !onList(cl.key),
      suggestion,
      habit,
    });
  }
  // The not to do list: a slip is the day with it, a kept day the day without; a day with no mark is not counted.
  for (const item of f.notToDoItems) {
    const marks = new Map(f.notToDoMarks.filter((m) => m.itemId === item.id && m.day >= c.pairFrom && m.day <= to).map((m) => [m.day, m.status]));
    if (![...marks.values()].includes('slipped')) continue;
    const first = [...marks.keys()].sort()[0]!;
    candidates.push({
      kind: 'notToDo',
      id: `ntd:${item.id}`,
      key: item.id,
      title: item.title.trim(),
      rel: item.relationship,
      days: dayRange(first, to).map((d) => ({ d, on: marks.has(d) ? marks.get(d) === 'slipped' : null, own: 0 })),
      repeats: false,
      to: '/today#ntd-heading',
      toLabel: 'Open your not to do list',
      canAddNotToDo: false,
      suggestion: null,
      habit: null,
    });
  }
  const signals = { task: tieSignals(c, 'task'), notToDo: tieSignals(c, 'notToDo') };
  const all = candidates.map((cand) => tieInsight(c, cand, signals[cand.kind])).filter((x): x is Insight => x !== null);
  const ready = all.filter((i) => i.state === 'ready').sort((a, b) => b.strength - a.strength || (a.id < b.id ? -1 : 1)).slice(0, MAX_HABIT_TIES);
  const wait = all.filter((i) => i.state === 'watching').slice(0, MAX_HABIT_TIES_WATCHING);
  if (!ready.length && !wait.length) {
    const feelOn = (['mood', 'sleep', 'stress'] as const).filter((k) => c.on(k));
    const log = feelOn.length ? ` and log your ${listOr([...feelOn])}` : '';
    return [watching('habit-tie', ['insights'], ['tasks', 'notToDo'], false, 'Good and bad habits', `Tick the same task on ${HABIT_TIE_MIN_DAYS} days or mark your not to do list${log}.`)];
  }
  return [...ready, ...wait];
}

const KEY_ORDER: InsightKey[] = ['habit', 'habit-tie', 'pillar-balance', 'best-hours', 'streak-weekday', 'sleep-mood', 'focus-tasks', 'stress-calm', 'daytype-done', 'money-stress', 'slips-sleep', 'routine-tasks', 'journal-mood', 'review-since', 'discover-strength', 'agency-load'];

/**
 * The one rule: every signal whose apps are on, from the person's own facts. Ready ones by strength, then the ones still
 * watching in a fixed order. Pure: the same facts give the same answer.
 */
export function insightsFor(f: InsightFacts): Insight[] {
  return computeInsights(f, f.rel ? [f.rel] : []);
}

/**
 * Everything at once (2026-11-05), for the one GET /insights every place shares: the whole list with each of the seven pillars'
 * own balance line, so a pillar page needs no request of its own. Each place picks its share with `insightsForPlace`.
 */
export function insightsForEvery(f: InsightFacts): Insight[] {
  return computeInsights({ ...f, rel: null }, RELATIONSHIPS.map((r) => r.key));
}

/** A pillar page's own balance line (`pillar-balance:<pillar>`), which only that pillar page shows. */
export const isPillarLine = (i: Pick<Insight, 'id'>): boolean => i.id.startsWith('pillar-balance:');

/**
 * What one place shows from `insightsForEvery`'s list: the same as `insightsForApp` on a list made for that place alone. /insights
 * (or none) is everything but the pillar pages' own lines.
 */
export function insightsForPlace(list: readonly Insight[], app: InsightApp | null, rel: RelationshipKey | null = null): Insight[] {
  if (!app || app === 'insights') return list.filter((i) => !isPillarLine(i));
  return insightsForApp(list, app, rel);
}

function computeInsights(f: InsightFacts, pillarRels: readonly RelationshipKey[]): Insight[] {
  const apps = new Set(f.apps);
  const on = (k: string) => apps.has(k);
  const yesterday = addDays(f.today, -1);
  const pairFrom = addDays(f.today, -PAIR_WINDOW_DAYS);
  // Each tick is read in the person's zone and keyed once, here, for every signal below.
  const stamped: StampedTick[] = f.done.map((t) => ({ t, at: localStamp(t.completedAt, f.zone), key: taskKey(t.title) }));
  const ticks = stamped.flatMap((x) => (x.at ? [{ day: x.at.day, minutes: x.at.minutes, relationship: x.t.relationship }] : []));
  const openCache = new Map<RelationshipKey, { o: InsightOpenTaskFact; k: KeyWords }[]>();
  const openByRel = (rel: RelationshipKey) => {
    const hit = openCache.get(rel);
    if (hit) return hit;
    const list = f.open.filter((o) => o.relationship === rel).map((o) => ({ o, k: keyWordsOf(taskKey(o.title)) }));
    openCache.set(rel, list);
    return list;
  };
  const ticksByDay = new Map<string, number>();
  for (const t of ticks) ticksByDay.set(t.day, (ticksByDay.get(t.day) ?? 0) + 1);
  const wbCache = new Map<string, Map<string, number>>();
  const wb = (kind: string) => {
    const hit = wbCache.get(kind);
    if (hit) return hit;
    const sums = new Map<string, { s: number; n: number }>();
    for (const r of f.wellbeing) {
      if (r.kind !== kind || !Number.isFinite(r.value)) continue;
      const cur = sums.get(r.date) ?? { s: 0, n: 0 };
      cur.s += r.value;
      cur.n += 1;
      sums.set(r.date, cur);
    }
    // Minutes add up over a day; a score (mood, sleep, stress) is the day's average.
    const add = kind === 'mindful' || kind === 'move';
    const out = new Map([...sums.entries()].map(([d, v]) => [d, add ? v.s : v.s / v.n]));
    wbCache.set(kind, out);
    return out;
  };
  const activeDays = new Set<string>([
    ...ticksByDay.keys(),
    ...f.checkins,
    ...f.wellbeing.map((w) => w.date),
    ...f.focus.map((r) => r.day),
    ...f.water.map((w) => w.day),
    ...f.notToDo.map((r) => r.day),
    ...f.routine.map((r) => r.day),
    ...f.dayTypes.map((r) => r.day),
  ]);
  const c: Ctx = { f, on, yesterday, pairFrom, ticks, ticksByDay, activeDays, wb, stamped, openByRel };
  // A task that is a good or bad habit is said once, on that card (which offers Make it a habit when it fits).
  const ties = habitTies(c);
  const tiedTasks = ties.filter((t) => t.state === 'ready' && t.tie?.kind === 'task');
  const plainHabits = habits(c).filter((h) => !(h.state === 'ready' && h.habit && tiedTasks.some((t) => t.relationship === h.relationship && sameTask(t.tie!.key, h.id.split(':').slice(2).join(':')))));
  const all: (Insight | null)[] = [
    ...plainHabits,
    ...ties,
    ...pillarBalance(c, pillarRels),
    bestHours(c),
    streakWeekday(c),
    on('sleep') && on('mood') ? sleepMood(c) : null,
    on('mindful') ? focusTasks(c) : null,
    on('stress') ? stressCalm(c) : null,
    daytypeDone(c),
    on('finance') && on('stress') ? moneyStress(c) : null,
    on('sleep') ? slipsSleep(c) : null,
    routineTasks(c),
    on('journal') && on('mood') ? journalMood(c) : null,
    on('reviews') ? reviewSince(c) : null,
    on('discover') ? discoverStrength(c) : null,
    on('agency') ? agencyLoad(c) : null,
  ];
  const list = all.filter((x): x is Insight => x !== null);
  const ready = list.filter((i) => i.state === 'ready').sort((a, b) => b.strength - a.strength || (a.id < b.id ? -1 : 1));
  const wait = list.filter((i) => i.state === 'watching').sort((a, b) => KEY_ORDER.indexOf(a.key) - KEY_ORDER.indexOf(b.key));
  return [...ready, ...wait];
}

/**
 * What one place shows: for `insights` (or none) everything; for an app only the ready lines that touch it and are worth
 * saying, the pillar page only its own pillar's. Home never shows two of one key (good and bad habits up to two) nor more than one
 * private pairing besides them.
 */
export function insightsForApp(list: readonly Insight[], app: InsightApp | null, rel: RelationshipKey | null = null): Insight[] {
  if (!app || app === 'insights') return [...list];
  const out: Insight[] = [];
  const keys = new Set<InsightKey>();
  let privatePairs = 0;
  for (const i of list) {
    if (i.state !== 'ready' || i.strength <= 0 || !i.apps.includes(app)) continue;
    if (app === 'pillar' && (!rel || i.relationship !== rel)) continue;
    if (app === 'home') {
      // One of each key, except good and bad habits, which take up to two.
      const tie = i.key === 'habit-tie';
      if (keys.has(i.key) && !(tie && out.filter((x) => x.key === 'habit-tie').length < 2)) continue;
      if (i.private && i.chart?.kind === 'pair') {
        // Good and bad habits (up to two) may read how the day felt; any other private pairing still needs the one place free.
        if (privatePairs >= 1 && !tie) continue;
        privatePairs += 1;
      }
    }
    keys.add(i.key);
    out.push(i);
  }
  if (app === 'today') {
    // Daily lists good and bad habits in a section of their own (2026-11-05), so they take their own room beside the two patterns.
    const ties = out.filter((i) => i.key === 'habit-tie').slice(0, DAILY_HABITS_MAX);
    return [...ties, ...out.filter((i) => i.key !== 'habit-tie').slice(0, INSIGHT_APP_MAX.today ?? 2)];
  }
  return out.slice(0, INSIGHT_APP_MAX[app] ?? 2);
}
