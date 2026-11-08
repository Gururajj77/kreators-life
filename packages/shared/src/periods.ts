import type { RelationshipKey } from './core.ts';
import type { DerivedLadder } from './pillars.ts';
import { addDays, isoWeekday } from './dates.ts';
import { shiftDay } from './api.ts';
import type { NotToDoStatus } from './api.ts';
import { nextOccurrence } from './tasks.ts';
import type { PaceStatus, Priority, Repeat } from './tasks.ts';
import type { NodeKind } from './pillars.ts';
import type { BlockColor } from './timeBlocks.ts';

// ---------------------------------------------------------------------------
// Periods and reviews: a day, a week, a month, a quarter, half a year or a year, and what you make of it
// ---------------------------------------------------------------------------

export type PeriodKind = 'day' | 'week' | 'month' | 'quarter' | 'half' | 'year';
/**
 * Every period a review can be for, shortest first. The year (2026-11-07) is the calendar year, for the yearly review of the foundations;
 * the day (2026-11-07, the founder's daily report) is one calendar day in the person's own zone, for the daily review of the tasks.
 */
export const PERIOD_KINDS: readonly PeriodKind[] = ['day', 'week', 'month', 'quarter', 'half', 'year'];
/** The periods a dashboard's "By period" filter offers: the day first, then the week to the half. Reviews offers all six. */
export const DASHBOARD_PERIODS: readonly PeriodKind[] = ['day', 'week', 'month', 'quarter', 'half'];
export const PERIOD_META: Record<PeriodKind, { name: string; short: string; blurb: string; previous: string }> = {
  day: { name: 'Daily review', short: 'Day', blurb: 'One day: your tasks, pillar by pillar, and one small step for tomorrow.', previous: 'the day before' },
  week: { name: 'Weekly review', short: 'Week', blurb: 'Seven days: your projects, pillar by pillar, and the next task.', previous: 'the week before' },
  month: { name: 'Monthly review', short: 'Month', blurb: 'A month: your goal outcomes, and what shows they are working.', previous: 'the month before' },
  quarter: { name: 'Quarterly review', short: 'Quarter', blurb: 'Three months: your value goals, and how often you felt them.', previous: 'the quarter before' },
  half: { name: 'Half-year review', short: 'Half year', blurb: 'Your guiding principles: a check-in in July, and setting the year in January.', previous: 'the half before' },
  year: { name: 'Yearly review', short: 'Year', blurb: 'A year: your foundations, what held, and the ones for the year ahead.', previous: 'the year before' },
};
/** A period is inclusive on both ends, in YYYY-MM-DD. Weeks start on Monday. */
export interface Period {
  kind: PeriodKind;
  start: string;
  end: string;
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ymd = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const lastDayOfMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** The period of that kind containing the date. */
export function periodFor(kind: PeriodKind, date: string): Period {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7));
  if (kind === 'day') return { kind, start: date, end: date };
  if (kind === 'week') {
    const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
    const start = shiftDay(date, -((dow + 6) % 7));
    return { kind, start, end: shiftDay(start, 6) };
  }
  if (kind === 'month') return { kind, start: ymd(y, m, 1), end: ymd(y, m, lastDayOfMonth(y, m)) };
  if (kind === 'year') return { kind, start: ymd(y, 1, 1), end: ymd(y, 12, 31) };
  const first = kind === 'quarter' ? Math.floor((m - 1) / 3) * 3 + 1 : m <= 6 ? 1 : 7;
  const last = first + (kind === 'quarter' ? 2 : 5);
  return { kind, start: ymd(y, first, 1), end: ymd(y, last, lastDayOfMonth(y, last)) };
}

/** The same kind of period, `by` steps later (or earlier when negative). */
export function periodShift(p: Period, by: number): Period {
  if (p.kind === 'day') return periodFor('day', shiftDay(p.start, by));
  if (p.kind === 'week') return periodFor('week', shiftDay(p.start, 7 * by));
  const months = p.kind === 'month' ? 1 : p.kind === 'quarter' ? 3 : p.kind === 'half' ? 6 : 12;
  const total = Number(p.start.slice(0, 4)) * 12 + (Number(p.start.slice(5, 7)) - 1) + months * by;
  return periodFor(p.kind, ymd(Math.floor(total / 12), (total % 12) + 1, 1));
}

/** "7 Nov 2026", "20 to 26 Oct 2026", "October 2026", "Oct to Dec 2026", "2026". */
export function periodLabel(p: Period): string {
  const y = p.start.slice(0, 4);
  if (p.kind === 'year') return y;
  const m1 = Number(p.start.slice(5, 7));
  const m2 = Number(p.end.slice(5, 7));
  if (p.kind === 'day') return `${Number(p.start.slice(8, 10))} ${MONTHS_SHORT[m1 - 1]} ${y}`;
  if (p.kind === 'week') {
    const d1 = Number(p.start.slice(8, 10));
    const d2 = Number(p.end.slice(8, 10));
    return p.start.slice(0, 7) === p.end.slice(0, 7) ? `${d1} to ${d2} ${MONTHS_SHORT[m1 - 1]} ${y}` : `${d1} ${MONTHS_SHORT[m1 - 1]} to ${d2} ${MONTHS_SHORT[m2 - 1]} ${p.end.slice(0, 4)}`;
  }
  if (p.kind === 'month') return `${MONTHS_LONG[m1 - 1]} ${y}`;
  return `${MONTHS_SHORT[m1 - 1]} to ${MONTHS_SHORT[m2 - 1]} ${y}`;
}

/** Every day of the period, oldest first. */
export function periodDays(p: Period): string[] {
  const out: string[] = [];
  for (let d = p.start; d <= p.end; d = shiftDay(d, 1)) out.push(d);
  return out;
}

// The built-in questions for each review, by the layer it walks, are in reviewPrompts.ts (`builtInTemplateFor`).
export const MAX_REVIEW_TEMPLATES = 12;
export const MAX_REVIEW_PROMPTS = 10;
export const REVIEW_NAME_MAX = 60;
export const REVIEW_PROMPT_MAX = 200;
export const REVIEW_ANSWER_MAX = 2000;
export const REVIEW_HIGHLIGHT_MAX = 200;

export interface ReviewTemplate {
  id: string;
  kind: PeriodKind;
  name: string;
  prompts: string[];
  /**
   * A built-in template's short line under each question (2026-11-07), naming the method it comes from in plain words ("From CBT: a
   * thought is not a fact."), one per prompt. Absent on a person's own template.
   */
  why?: string[];
  /** The half's part a built-in half template is for (the mid-year check-in or the start-of-year setting); absent on every other one. */
  part?: 'checkin' | 'setting';
  /** Comes with the app; cannot be edited or removed. */
  builtIn: boolean;
  createdAt: string | null;
}
/** GET /reviews/templates: every period's built-in set (the half's two parts each), then the person's own templates of every kind. */
export interface ReviewTemplatesResponse {
  builtIn: ReviewTemplate[];
  mine: ReviewTemplate[];
}

/** Trimmed, non-empty, bounded prompts. */
export function parseReviewPrompts(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === 'string')
    .map((x) => x.trim().slice(0, REVIEW_PROMPT_MAX))
    .filter(Boolean)
    .slice(0, MAX_REVIEW_PROMPTS);
}

/** What happened in one period, pulled from every app. Averages are null when nothing was logged. */
export interface PeriodNumbers {
  days: number;
  checkins: number;
  tasksDone: number;
  smallActs: number;
  xp: number;
  activeDays: number;
  notToDoKept: number;
  notToDoSlipped: number;
  moodAvg: number | null;
  sleepAvg: number | null;
  stressAvg: number | null;
  mindfulMin: number;
  moveMin: number;
  /** Days in the period with movement logged (Fitness, Kreators Run's tool and club runs). Optional: a review saved before 2026-11-07 has none. */
  moveDays?: number;
  /** How well the person ate on average (Fitness's eating check-in, 1 to 5), or null. Optional: a review saved before 2026-11-07 has none. */
  eatAvg?: number | null;
  journalEntries: number;
  journalMoodAvg: number | null;
  /** Days in the period with gratitude written on Journal (a count only, never a word). Optional: a review saved before 2026-11-07 has none. */
  gratitudeDays?: number;
  incomeCents: number;
  expenseCents: number;
  orders: number;
  salesCents: number;
  salesPoints: number;
  lessonsDone: number;
  programsDone: number;
  applications: number;
  decisions: number;
  events: number;
  posts: number;
  circles: number;
  /** Runs logged with a start code, and the metres they added up to. */
  runs: number;
  runMetres: number;
  /**
   * Kinds of day (2026-11-06): the period's days so far that had a kind (a day template set for the date or given by the weekly
   * pattern, not the default), and the kinds most used, each with its colour (`kindsOfDays`, `templateColor`). Absent on a review saved
   * before then.
   */
  kindDays?: number;
  kinds?: { name: string; days: number; color: BlockColor | null }[];
  /*
   * Fuller numbers (2026-11-07, the founder's report "based on all the data i input"). Each is absent on a review saved before then, and
   * absent while its app is off (numbersFor reads only the parts whose app is on).
   */
  /** Water (core): days with water logged, their average in ml a day (null with none), and the days the day's goal was met. Pays nothing. */
  waterDays?: number;
  waterAvgMl?: number | null;
  waterGoalDays?: number;
  /** Focus (Mindfulness): focus minutes and sessions in the period, and the average quality of the rated sessions, 1 to 5 (an unrated one is left out; null when none was rated). */
  focusMin?: number;
  focusSessions?: number;
  focusQualityAvg?: number | null;
  /** Tasks (core): habit tasks ticked (`taskIsHabit`), P0 and P1 tasks ticked, and tasks still open at the period's end whose due day had passed (as of today for the current period). */
  habitTicks?: number;
  topPriorityDone?: number;
  overdueAtEnd?: number;
  /** The routine (core, the strategy session's): days in the period with every morning step ticked. */
  routineDays?: number;
  /**
   * Finance, in the person's own currency only. Budgets: each budget checked against each month the period touches (`budgetChecks`, the
   * month's spending from its first day to the period's end) and how many of those were over (`budgetsOver`). Dues open at the period's end:
   * owed to you and by you. Savings goals: what they hold and aim for, and how many are reached, as they stand today (the app keeps no dated
   * record of each amount put in), so only a period that holds today has them.
   */
  budgetsOver?: number;
  budgetChecks?: number;
  owedToYouCents?: number;
  youOweCents?: number;
  goalSavedCents?: number;
  goalTargetCents?: number;
  goalsReached?: number;
  goalsCount?: number;
  /**
   * Supplements (Fitness, only while Track supplements is on): ticks against the doses that were due, counts only. Only Reviews' own read
   * asks for it (GET /reviews and a saved review's snapshot), never the dashboards, Emerging, a coach, the assistant or the brief.
   */
  suppTaken?: number;
  suppDue?: number;
}

export interface ReviewSummary {
  period: Period;
  previous: Period;
  now: PeriodNumbers;
  before: PeriodNumbers;
  /** Xp and ticked tasks per day of the period. */
  series: { date: string; xp: number; tasks: number }[];
  xpByArea: Partial<Record<RelationshipKey, number>>;
  currency: string;
  /** The tasks brought to this review: ticked in the period, or still open and planned in it. Kept with the review when it is saved. */
  flagged: ReviewFlagged[];
  /**
   * The layer of the person's own pyramids this kind of review walks (2026-11-07: a week the projects, a month the goal outcomes, a quarter
   * the value goals, half a year the guiding principles, a year the foundations), grouped by pillar. Sent with GET /reviews and kept in a
   * saved review's snapshot; GET /reviews/summary sends it only when asked (`layer=1`), so the dashboards never pay for it. Absent on a
   * review saved before then.
   */
  layer?: ReviewLayer;
}
/** The layer a review walks: the task for a day (2026-11-07), and the five above it for the longer periods. */
export type ReviewLayerKind = NodeKind;
export interface ReviewLayerItem {
  id: string;
  title: string;
  relationship: RelationshipKey;
  /** Still active, or done (a project cleared) inside the period. */
  status: 'active' | 'done';
  /** The title of what it holds up, one layer above; null for a foundation. */
  under: string | null;
  /** Tasks under it ticked in the period, and the ones still open. */
  done: number;
  open: number;
  /** How many of the layer below it are active (projects under a goal outcome, and so on); 0 for a project. */
  below: number;
  /** A project's pace as the period ended (a week's review only), else null. */
  pace: { status: PaceStatus; label: string; line: string } | null;
  /** A day's task (2026-11-07) still open whose day came before the day reviewed. Absent on every other layer. */
  late?: boolean;
}
export interface ReviewLayer {
  kind: ReviewLayerKind;
  /** All seven pillars in their order, each with its first items (`REVIEW_LAYER_PER_PILLAR`) and how many there are in all. */
  pillars: { relationship: RelationshipKey; items: ReviewLayerItem[]; total: number }[];
}
export const REVIEW_LAYER_PER_PILLAR = 6;
export interface ReviewFlagged {
  id: string;
  title: string;
  relationship: RelationshipKey;
  status: 'done' | 'open';
  /** The day it was ticked, or the day it is planned for; null when it has none yet. */
  day: string | null;
  priority: Priority | null;
}
export const MAX_REVIEW_FLAGGED = 40;

export interface Review {
  id: string;
  kind: PeriodKind;
  start: string;
  end: string;
  templateId: string | null;
  templateName: string;
  /** The prompts as they were when the review was written, so a changed template never rewrites history. */
  prompts: string[];
  answers: string[];
  /** One to five. */
  rating: number | null;
  highlight: string;
  /** The numbers as they were when the review was saved. */
  snapshot: ReviewSummary | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewListItem {
  id: string;
  kind: PeriodKind;
  start: string;
  end: string;
  rating: number | null;
  highlight: string;
  updatedAt: string;
}

export interface ReviewsResponse {
  period: Period;
  summary: ReviewSummary;
  review: Review | null;
  templates: ReviewTemplate[];
  recent: ReviewListItem[];
  /** Daily reviews come in a list of their own (2026-11-07), a page at a time (prefix `rd`), so the longer ones never drown in them. */
  recentDays?: ReviewListItem[];
}

/** The last seven days ending today, oldest first. */
export function notToDoWeek(days: Record<string, NotToDoStatus | undefined>, today: string): (NotToDoStatus | null)[] {
  return [6, 5, 4, 3, 2, 1, 0].map((back) => days[shiftDay(today, -back)] ?? null);
}

export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** "09:30" to "9:30 am". */
export function timeLabel(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  if (h === undefined || m === undefined || Number.isNaN(h)) return hhmm;
  const suffix = h < 12 ? 'am' : 'pm';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
}

export interface OnboardingAnswer {
  questionId: string;
  value: number;
}

export interface OnboardingResponse {
  scores: Record<RelationshipKey, number>;
  weakest: RelationshipKey[];
  /** Floors with answers on file. The others were skipped for now and can be answered from the Tower later. */
  answered: RelationshipKey[];
  /** One derived ladder per floor, ready to build. */
  ladders: Record<RelationshipKey, DerivedLadder>;
}

export interface CheckinResponse {
  streak: number;
  bestStreak: number;
  awarded: number;
  /** Redeemable points awarded, including any streak bonus. */
  points: number;
  streakBonus: number;
  alreadyCheckedIn: boolean;
}


// ---------------------------------------------------------------------------
// Scheduled reviews: pick a day (and a time), repeat it the way a task repeats, get a reminder in the inbox
// ---------------------------------------------------------------------------

export const MAX_REVIEW_SCHEDULES = 20;
export const REVIEW_SCHEDULE_NAME_MAX = 60;
export const REVIEW_REMINDER_TIME = '09:00';

export interface ReviewSchedule {
  id: string;
  /** Which review it is for: a day, a week, a month, a quarter, a half year or a year. */
  kind: PeriodKind;
  name: string;
  /** The first day, and the time of day to be reminded (HH:MM, in the person's zone). */
  anchor: string;
  time: string;
  repeat: Repeat | null;
  enabled: boolean;
  /** The next day the reminder falls on, or null when there is none left. */
  nextOn: string | null;
  /** The repeat in plain words, or "Once". */
  label: string;
}
/** One day on the Reviews calendar: reminders that fall on it, and reviews that were written for a period that ends on it. */
export interface ReviewCalendarDay {
  scheduled: { id: string; kind: PeriodKind; time: string; name: string }[];
  /** `name` is the review's own name (a half's part: the mid-year check-in or the start-of-year setting), worked out on the server. */
  written: { kind: PeriodKind; start: string; end: string; name?: string }[];
}
export interface ReviewCalendarResponse {
  month: string;
  schedules: ReviewSchedule[];
  days: Record<string, ReviewCalendarDay>;
}

/**
 * The half year or year a review picked on `day` is for: the one whose end is nearer. A half or a year is looked back on once it turns, so
 * from January to March the half is July to December (the start-of-year setting) and from April to June it is January to June (the mid-year
 * check-in, early); from July to September it is January to June (the check-in) and from October it is July to December (the setting, for the
 * year ahead). The year is the one just ended until June, then the one under way. Any other period is the one the day falls in.
 */
export function reviewPeriodNow(kind: PeriodKind, day: string): Period {
  const here = periodFor(kind, day);
  if (kind !== 'half' && kind !== 'year') return here;
  const monthsIn = Number(day.slice(5, 7)) - Number(here.start.slice(5, 7));
  return monthsIn < (kind === 'half' ? 3 : 6) ? periodShift(here, -1) : here;
}

/**
 * The period a reminder on `day` opens. A week, a month or a quarter: on its first day (a Monday, the 1st, the start of a quarter) the one
 * that just ended, since that is when someone looks back, and on any other day the one the day falls in. A half or a year goes by
 * `reviewPeriodNow`, so a reminder on 1 or 5 January opens the year just ended and the half July to December, the start-of-year setting.
 * A day (2026-11-07) goes by the reminder's time (HH:MM): one set before noon opens the day before, one from noon that day itself.
 */
export function reviewPeriodFor(kind: PeriodKind, day: string, time?: string): Period {
  if (kind === 'day') return periodFor('day', time && time < '12:00' ? shiftDay(day, -1) : day);
  if (kind === 'half' || kind === 'year') return reviewPeriodNow(kind, day);
  const here = periodFor(kind, day);
  return here.start === day ? periodShift(here, -1) : here;
}

/** The first day a rule really falls on: the day it starts on, unless a weekly rule names weekdays and that day is not one of them. */
function firstDay(anchor: string, rule: Repeat): string | null {
  if (rule.kind === 'weekly' && rule.days.length > 0 && !rule.days.includes(isoWeekday(anchor))) return nextOccurrence(rule, anchor, anchor);
  return !rule.until || anchor <= rule.until ? anchor : null;
}
/** Every day a repeating rule falls on between two days (both included), from the first day it started on. At most `cap`. */
export function occurrencesBetween(anchor: string, rule: Repeat | null, from: string, to: string, cap = 62): string[] {
  const out: string[] = [];
  if (!rule) return anchor >= from && anchor <= to ? [anchor] : [];
  const first = firstDay(anchor, rule);
  let d: string | null = first && first >= from ? first : first ? nextOccurrence(rule, anchor, addDays(from, -1)) : null;
  if (d && first && d < first) d = first;
  while (d && d <= to && out.length < cap) {
    out.push(d);
    d = nextOccurrence(rule, anchor, d);
  }
  return out;
}
/** The first day on or after `day` that a rule falls on, or null when it has ended (or never repeats and has passed). */
export function nextOnOrAfter(anchor: string, rule: Repeat | null, day: string): string | null {
  if (!rule) return anchor >= day ? anchor : null;
  const first = firstDay(anchor, rule);
  if (!first) return null;
  return first >= day ? first : nextOccurrence(rule, anchor, addDays(day, -1));
}
