import type { RelationshipKey } from './core.ts';
import type { DerivedLadder } from './pillars.ts';
import { addDays, isoWeekday } from './dates.ts';
import { shiftDay } from './api.ts';
import type { NotToDoStatus } from './api.ts';
import { nextOccurrence } from './tasks.ts';
import type { Priority, Repeat } from './tasks.ts';

// ---------------------------------------------------------------------------
// Periods and reviews: a week, a month, a quarter or half a year, and what you make of it
// ---------------------------------------------------------------------------

export type PeriodKind = 'week' | 'month' | 'quarter' | 'half';
export const PERIOD_KINDS: readonly PeriodKind[] = ['week', 'month', 'quarter', 'half'];
export const PERIOD_META: Record<PeriodKind, { name: string; short: string; blurb: string; previous: string }> = {
  week: { name: 'Weekly review', short: 'Week', blurb: 'Seven days: what moved, what slipped, one thing for next week.', previous: 'the week before' },
  month: { name: 'Monthly review', short: 'Month', blurb: 'A month: the numbers, the routines that held, what to change.', previous: 'the month before' },
  quarter: { name: 'Quarterly review', short: 'Quarter', blurb: 'Three months: progress on the big things, and the next quarter\'s focus.', previous: 'the quarter before' },
  half: { name: 'Mid-year check-in', short: 'Half year', blurb: 'Six months: where the year is going, and what the second half is for.', previous: 'the half before' },
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
  if (kind === 'week') {
    const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
    const start = shiftDay(date, -((dow + 6) % 7));
    return { kind, start, end: shiftDay(start, 6) };
  }
  if (kind === 'month') return { kind, start: ymd(y, m, 1), end: ymd(y, m, lastDayOfMonth(y, m)) };
  const first = kind === 'quarter' ? Math.floor((m - 1) / 3) * 3 + 1 : m <= 6 ? 1 : 7;
  const last = first + (kind === 'quarter' ? 2 : 5);
  return { kind, start: ymd(y, first, 1), end: ymd(y, last, lastDayOfMonth(y, last)) };
}

/** The same kind of period, `by` steps later (or earlier when negative). */
export function periodShift(p: Period, by: number): Period {
  if (p.kind === 'week') return periodFor('week', shiftDay(p.start, 7 * by));
  const months = p.kind === 'month' ? 1 : p.kind === 'quarter' ? 3 : 6;
  const total = Number(p.start.slice(0, 4)) * 12 + (Number(p.start.slice(5, 7)) - 1) + months * by;
  return periodFor(p.kind, ymd(Math.floor(total / 12), (total % 12) + 1, 1));
}

/** "20 to 26 Oct 2026", "October 2026", "Oct to Dec 2026". */
export function periodLabel(p: Period): string {
  const y = p.start.slice(0, 4);
  const m1 = Number(p.start.slice(5, 7));
  const m2 = Number(p.end.slice(5, 7));
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

/** The prompts every review starts from. A person can add templates of their own on top. */
export const REVIEW_PROMPTS: Record<PeriodKind, string[]> = {
  week: ['What went well this week?', 'What got in the way?', 'Which pillar needs you most next week?', 'One thing to do differently next week.'],
  month: ['What are you proud of this month?', 'What did you let slide?', 'Which routines held, and which did not?', 'What will you change next month?'],
  quarter: ['What moved forward in the last three months?', 'What did you learn about how you work?', 'What should stop, and what should start?', 'The one focus for the next quarter.'],
  half: ['Where is the year going so far?', 'Which of the seven pillars grew the most, and which the least?', 'What do you want the second half to be about?', 'What would make December feel like a good year?'],
};
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
  /** Comes with the app; cannot be edited or removed. */
  builtIn: boolean;
  createdAt: string | null;
}

export function builtInTemplate(kind: PeriodKind): ReviewTemplate {
  return { id: `builtin:${kind}`, kind, name: PERIOD_META[kind].name, prompts: REVIEW_PROMPTS[kind], builtIn: true, createdAt: null };
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
  journalEntries: number;
  journalMoodAvg: number | null;
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
}
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
  /** Which review it is for: a week, a month, a quarter or a half year. */
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
  written: { kind: PeriodKind; start: string; end: string }[];
}
export interface ReviewCalendarResponse {
  month: string;
  schedules: ReviewSchedule[];
  days: Record<string, ReviewCalendarDay>;
}

/**
 * The period a reminder on `day` opens. On the first day of a period (a Monday, the 1st, the start of a quarter or half) the review is of the
 * one that just ended, since that is when someone looks back; on any other day it is the period the day falls in.
 */
export function reviewPeriodFor(kind: PeriodKind, day: string): Period {
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
