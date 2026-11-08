// ---------------------------------------------------------------------------
// Emerging's shape (2026-11-07): the types, the small helpers and each place's share of the list. This file is in the barrel, the file the web
// app reads. The rules that find the patterns are insights.ts, the subpath export `@kreators/shared/insights`, which only the API and the
// tests import. Rules only, no model; computed on read, nothing stored.
// ---------------------------------------------------------------------------

import type { RelationshipKey } from './core.ts';
import { isoWeekday, zoneOffsetMinutes } from './dates.ts';
import type { Repeat } from './tasks.ts';
import type { BlockColor, DayTemplate, TimeBlock } from './timeBlocks.ts';
import type { Period, PeriodKind, PeriodNumbers } from './periods.ts';

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
  | 'fitness'
  | 'insights';
export const INSIGHT_APPS: readonly InsightApp[] = ['home', 'today', 'tower', 'pillar', 'mood', 'sleep', 'stress', 'mindful', 'wellbeing', 'life', 'journal', 'finance', 'reviews', 'discover', 'agency', 'fitness', 'insights'];
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
  | 'agency-load'
  | 'block-kept'
  | 'gratitude-mood'
  | 'move-weekday'
  | 'eat-days'
  | 'water-days'
  | 'water-weekday'
  | 'budget-over'
  | 'budget-pace';
/** `move` and `eat` are Fitness's logs (minutes and how well the person ate, never a note or an extra); `gratitude` is only which days have it. */
export type InsightPart = 'tasks' | 'xp' | 'checkins' | 'wellbeing' | 'focus' | 'water' | 'journal' | 'money' | 'notToDo' | 'routine' | 'dayTypes' | 'reviews' | 'discover' | 'agency' | 'timeBlocks' | 'move' | 'eat' | 'gratitude';

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
  | { kind: 'dots'; days: { date: string; on: boolean }[] }
  /** Your kinds of day: the window's days by kind, each in its template's colour (`templateColor`), and how each group of days went. */
  | { kind: 'kinds'; parts: { templateId: string; name: string; days: number; color: BlockColor | null }[]; none: number; noneName: string; rows: KindRow[] };
/** One group of days in "Your kinds of day": a kind (or the days with none, `templateId` null), over the days the app was used. */
export interface KindRow {
  templateId: string | null;
  name: string;
  /** Days the app was used (0: the kind had days, but no app use on any of them). */
  n: number;
  /** Tasks ticked a day. */
  tasks: number;
  /** Focus minutes a day, while Mindfulness is on. */
  focus: number | null;
  /** The average mood logged on those days, while Mood is on; null with none logged. */
  mood: number | null;
}
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
  /** The period it was worked out over ("in October 2026"), when one was picked on /insights. */
  within?: string;
}
/**
 * A good or bad habit (the 2026-11-04 ask): a task done again and again, or a slip on the not to do list, set against how the
 * person's own days went (mood, sleep that night, stress, other tasks, focus). Only on a ready `habit-tie`.
 */
export interface HabitTie {
  verdict: 'good' | 'bad';
  /** A task (by its words), one item of the not to do list, or moving at all (Fitness and Kreators Run's logs; only ever a good habit). */
  kind: 'task' | 'notToDo' | 'move';
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
  /** The time block the person put it in, or null (docs/time-blocks.md). */
  timeBlockId?: string | null;
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
  /**
   * The period picked on /insights (2026-11-07): every signal is worked out over its days and each card names it in its basis line. The
   * minimum days stay as they are, so a short period shows more under Still watching. Absent: the rolling windows (eight weeks for the
   * same-days cards and good and bad habits, four for a plain habit, thirty days for the balance).
   */
  window?: Period | null;
  /** Ticked tasks in the window. */
  done: InsightTaskFact[];
  open: InsightOpenTaskFact[];
  /** Active projects. */
  projects: { id: string; relationship: RelationshipKey }[];
  /** The last 30 days of xp and task ticks by pillar (with a `window`, the period's). */
  xp30: { relationship: RelationshipKey; xp: number; ticks: number }[];
  focusPillars: RelationshipKey[];
  /** Local days with a check-in in the window, and the first one ever. */
  checkins: string[];
  firstCheckin: string | null;
  /**
   * Never a note or an extra: the kind, the day and the number. With Fitness (or Kreators Run) on it also holds `move` rows (minutes),
   * and with Fitness on `eat` rows (how well the person ate, 1 to 5).
   */
  wellbeing: { kind: string; date: string; value: number }[];
  focus: { day: string; minutes: number }[];
  notToDo: { day: string; slipped: number; kept: number }[];
  /** The not to do list itself, for a bad habit's "Add to not to do". */
  notToDoItems: { id: string; title: string; relationship: RelationshipKey | null }[];
  /** One row per item per marked day in the window. */
  notToDoMarks: { itemId: string; day: string; status: 'kept' | 'slipped' }[];
  water: { day: string; ml: number }[];
  waterGoal: number | null;
  /** Dates the person set a kind of day for (a sign they used the app that day). Which template a day uses comes from `timeBlocks`. */
  dayTypes: { day: string; kind: string }[];
  routine: { day: string; done: boolean }[];
  /** When journal entries were written (UTC ISO). Never a word of them. */
  journalAt: string[];
  /** The person's own days with gratitude written on Journal (2026-11-07), while Journal is on. Only the day, never a line. */
  gratitudeDays?: string[];
  /** Spending per day in the person's own currency, integer cents. */
  expenses: { date: string; cents: number }[];
  /** Finance's monthly budgets (2026-11-07), while Finance is on. The app keeps no history of a budget, so older months are read against it as it is now. */
  budgets?: { category: string; monthlyCents: number }[];
  /** Spending by month and category in the person's own currency, integer cents, up to the last day read (a month to date for the month it falls in). */
  budgetSpend?: { month: string; category: string; cents: number }[];
  review: InsightReviewFact | null;
  discover: { growth: RelationshipKey; steps: boolean } | null;
  /** Days with an Agency piece due. */
  agencyDue: string[];
  /** Time blocks (docs/time-blocks.md): the blocks, the day templates with their slots, the default, the weekly pattern and the date changes in the window. Absent: no block line. */
  timeBlocks?: { blocks: TimeBlock[]; templates: DayTemplate[]; defaultId: string; pattern: (string | null)[]; overrides: Record<string, string>; /** The account's first day in the person's zone: a day before it has no kind. */ since?: string | null };
}
export interface InsightsResponse {
  day: string;
  insights: Insight[];
  /** The period the list was worked out over, when one was asked for; absent for the rolling windows. */
  window?: Period;
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
/** When you move (2026-11-07): days with movement in the eight weeks before a weekday can stand out. */
export const MOVE_WEEKDAY_MIN_DAYS = 8;
/** How you eat and how you feel: eating check-ins in the eight weeks before a split is drawn. */
export const EAT_MIN_DAYS = 10;
/** The day you drink least (2026-11-07): days with water logged before a weekday can stand out, and how far under the other days it must be. */
export const WATER_WEEKDAY_MIN_DAYS = 14;
export const WATER_WEEKDAY_MIN_GAP_ML = 200;
/** Budgets (2026-11-07): the months looked back on with no period picked, the finished months with spending a budget needs before it can "keep running over", and the days of a month before its pace says anything. */
export const BUDGET_OVER_MONTHS = 6;
export const BUDGET_OVER_MIN_MONTHS = 3;
export const BUDGET_PACE_MIN_DAYS = 7;


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
