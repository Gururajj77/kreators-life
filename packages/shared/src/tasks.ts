import { LOCALE, RELATIONSHIP_BY_KEY } from './core.ts';
import type { PageSize, RelationshipKey } from './core.ts';
import type { LifeAreaKey } from './life.ts';
import { LIFE_AREA_ORDER, LIFE_AREAS } from './life.ts';
import { blockDayMinutes, blockOfTask, blocksInDay, slotOrder, suggestBlock, TASK_GROUP_NONE } from './timeBlocks.ts';
import type { BlockColor, GroupableTask, TaskGroup, TemplateSlot, TimeBlock } from './timeBlocks.ts';
import type { KindDay } from './dayKinds.ts';
import { addDays, asDay, DATE_PATTERN, daysBetween, daysInMonth, fromDay, isoWeekday, zonedToUtc } from './dates.ts';

// ---- repeating tasks: daily, on weekdays, weekly on chosen days, monthly, yearly; every N of them; until a day, or for ever ----

export type RepeatKind = 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly';
export interface Repeat {
  kind: RepeatKind;
  /** Every this many days, weeks, months or years. 1 to 52. Weekdays ignores it. */
  every: number;
  /** Weekly only: the days, 1 for Monday to 7 for Sunday. Empty means the day the task is on. */
  days: number[];
  /** The last day it may come back on, or null for no end. */
  until: string | null;
  /** Monthly and yearly only: the first day it was on, so a short month's clamp (the 31st on the 28th) does not become the day it keeps. */
  anchor?: string;
}
export const REPEAT_KINDS: readonly { key: RepeatKind; name: string; unit: string }[] = [
  { key: 'daily', name: 'Every day', unit: 'day' },
  { key: 'weekdays', name: 'Weekdays', unit: 'weekday' },
  { key: 'weekly', name: 'Every week', unit: 'week' },
  { key: 'monthly', name: 'Every month', unit: 'month' },
  { key: 'yearly', name: 'Every year', unit: 'year' },
];
export const MAX_REPEAT_EVERY = 52;

/** The one reader for a repeat rule, from the browser or from a column: anything that is not a clean rule is no rule. */
export function parseRepeat(raw: unknown): Repeat | null {
  let v = raw;
  if (typeof v === 'string') {
    try {
      v = JSON.parse(v);
    } catch {
      return null;
    }
  }
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const kind = REPEAT_KINDS.find((k) => k.key === o.kind)?.key;
  if (!kind) return null;
  const every = Math.min(MAX_REPEAT_EVERY, Math.max(1, Math.round(Number(o.every) || 1)));
  const days = Array.isArray(o.days) ? [...new Set(o.days.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 7))].sort((a, b) => a - b) : [];
  const real = (d: unknown): d is string => typeof d === 'string' && DATE_PATTERN.test(d) && fromDay(asDay(d)) === d;
  const until = real(o.until) ? o.until : null;
  const rule: Repeat = { kind, every: kind === 'weekdays' ? 1 : every, days: kind === 'weekly' ? days : [], until };
  if ((kind === 'monthly' || kind === 'yearly') && real(o.anchor)) rule.anchor = o.anchor;
  return rule;
}

/**
 * The first day after `after` on which the rule falls, counting from `base` (the day the task was on): daily and weekly steps are
 * counted from the base, a month keeps the same day of the month (the 31st lands on the last day of a short month) and a year the same
 * day of the year (29 February lands on 28 February in a year without one). Null when the rule has ended.
 */
export function nextOccurrence(rule: Repeat, base: string, after: string): string | null {
  const pick = (d: string | null): string | null => (d && (!rule.until || d <= rule.until) ? d : null);
  if (rule.kind === 'daily') {
    const gap = daysBetween(base, after);
    const k = gap < 0 ? 0 : Math.floor(gap / rule.every) + 1;
    return pick(addDays(base, k * rule.every));
  }
  if (rule.kind === 'weekdays') {
    let d = addDays(after, 1);
    while (isoWeekday(d) > 5) d = addDays(d, 1);
    return pick(d);
  }
  if (rule.kind === 'weekly') {
    const days = rule.days.length ? rule.days : [isoWeekday(base)];
    const weekOf = (d: string) => addDays(d, -(isoWeekday(d) - 1));
    for (let i = 1; i <= 7 * rule.every + 7; i += 1) {
      const d = addDays(after, i);
      if (days.includes(isoWeekday(d)) && (daysBetween(weekOf(base), weekOf(d)) / 7) % rule.every === 0) return pick(d);
    }
    return null;
  }
  const y0 = Number(base.slice(0, 4));
  const m0 = Number(base.slice(5, 7)) - 1;
  let day = Number(base.slice(8, 10));
  // A base that was clamped to a short month's last day goes back to the day it started on.
  const started = rule.anchor ? Number(rule.anchor.slice(8, 10)) : 0;
  if (started > day && day === daysInMonth(y0, m0)) day = started;
  for (let k = 0; k < 800; k += 1) {
    const total = rule.kind === 'monthly' ? m0 + k * rule.every : m0 + k * rule.every * 12;
    const y = y0 + Math.floor(total / 12);
    const m = ((total % 12) + 12) % 12;
    const d = fromDay(Date.UTC(y, m, Math.min(day, daysInMonth(y, m))));
    if (d > after) return pick(d);
  }
  return null;
}

const ORDINAL = (n: number) => {
  const t = n % 100;
  if (t >= 11 && t <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
};
const WEEKDAY_NAMES_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
/** The rule in plain words: "Every day", "Every 2 weeks on Mon and Thu", "Every month on the 15th until 2027-03-01". */
/**
 * The one rule for the Habit tag (2026-11-04): the person's own pick ("Count it as a habit", `habit` 1 or 0) when they made one,
 * else the old rule, a task that repeats is a habit.
 */
export function taskIsHabit(t: { repeat: Repeat | null; habit?: boolean | null }): boolean {
  return t.habit ?? Boolean(t.repeat);
}

export function repeatLabel(rule: Repeat, base: string | null = null): string {
  const n = rule.every;
  const days = rule.days.length ? rule.days : base ? [isoWeekday(base)] : [];
  const list = days.map((d) => WEEKDAY_NAMES_SHORT[d - 1]!);
  const on = list.length ? ` on ${list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}` : list[0]}` : '';
  const head =
    rule.kind === 'daily'
      ? n === 1 ? 'Every day' : `Every ${n} days`
      : rule.kind === 'weekdays'
        ? 'On weekdays'
        : rule.kind === 'weekly'
          ? `${n === 1 ? 'Every week' : `Every ${n} weeks`}${on}`
          : rule.kind === 'monthly'
            ? `${n === 1 ? 'Every month' : `Every ${n} months`}${base ? ` on the ${ORDINAL(Number(base.slice(8, 10)))}` : ''}`
            : n === 1 ? 'Every year' : `Every ${n} years`;
  return rule.until ? `${head}, until ${rule.until}` : head;
}
/** The day a task opens: its do date, else its due date. Null for a task with no date. */
export const openDay = (t: { doDate: string | null; dueDate: string | null }): string | null => t.doDate ?? t.dueDate;

/** Month calendar on Daily: a month is YYYY-MM with a real month (01 to 12). */
export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
/** The most tasks one month answers with; past it `more` is true and the screen says so. */
export const MONTH_TASKS_MAX = 500;
/** The month `by` months from `month` (negative goes back). */
export function monthShift(month: string, by: number): string {
  const total = Number(month.slice(0, 4)) * 12 + (Number(month.slice(5, 7)) - 1) + by;
  return `${String(Math.floor(total / 12)).padStart(4, '0')}-${String((total % 12) + 1).padStart(2, '0')}`;
}
/** A month as weeks of ISO days, Monday first. The first and last week carry days of the months beside it; an unreal month gives no weeks. */
export function monthGrid(month: string): string[][] {
  if (!MONTH_RE.test(month)) return [];
  const first = `${month}-01`;
  const lead = isoWeekday(first) - 1;
  const length = daysInMonth(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1);
  const start = addDays(first, -lead);
  return Array.from({ length: Math.ceil((lead + length) / 7) }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)));
}
/** One task on the month calendar: what a cell and the day's list need, and nothing more. */
export interface MonthTask {
  id: string;
  title: string;
  relationship: RelationshipKey;
  doDate: string | null;
  dueDate: string | null;
  /** The day it sits on: the do date, else the due date. */
  day: string;
  status: 'active' | 'done';
  priority: Priority | null;
  /** The area of life it carries, or null for none. */
  lifeArea: LifeAreaKey | null;
  /** The kind of open business it carries, or null (a tag like any other). */
  openKind?: OpenKind | null;
  /** HH:MM, when the task has a time. */
  time: string | null;
  estimateMin: number | null;
  /** The repeat rule in words, or null when it does not repeat. */
  repeat: string | null;
  /** When it can first be ticked (a new task waits a few minutes). */
  readyAt: string | null;
  completedAt: string | null;
}
/** The projects a new task can go under (a task needs one). */
export interface MonthProject {
  id: string;
  title: string;
  relationship: RelationshipKey;
}
/** `GET /today/month`: the month's tasks, the person's active projects, and whether the month had more than the cap. */
export interface TodayMonthResponse {
  month: string;
  /** The device day the screen sent, echoed back. */
  today: string;
  tasks: MonthTask[];
  more: boolean;
  projects: MonthProject[];
  /**
   * Kinds of day (2026-11-06): every day of the month with its kind (`kindsOfDays`: null on the default template or before the
   * account) and where it came from, the person's templates with their colours (`templateColor`), the default and the weekly pattern,
   * so a day can show its kind's colour and its sheet can set the kind for that date.
   */
  kinds?: { days: KindDay[]; templates: { id: string; name: string; color: BlockColor | null }[]; defaultId: string; pattern: (string | null)[] };
}

/** One line in a task's checklist. */
export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

/** Priority tags, P0 the most pressing. A tag helps a person choose; it never changes what a tick pays. */
export type Priority = 0 | 1 | 2 | 3;
export const PRIORITIES: { value: Priority; tag: string; name: string; blurb: string }[] = [
  { value: 0, tag: 'P0', name: 'Do now', blurb: 'Urgent and it matters. Drop other things for it.' },
  { value: 1, tag: 'P1', name: 'Important', blurb: 'Matters this week. Do it before the normal ones.' },
  { value: 2, tag: 'P2', name: 'Normal', blurb: 'Part of the plan. Do it in its turn.' },
  { value: 3, tag: 'P3', name: 'Whenever', blurb: 'Nice to do. Fine to wait.' },
];
export function parsePriority(raw: unknown): Priority | null {
  if (typeof raw === 'string') {
    const m = /^p?([0-3])$/i.exec(raw.trim());
    return m ? (Number(m[1]) as Priority) : null;
  }
  return typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 && raw <= 3 ? (raw as Priority) : null;
}
export const priorityTag = (p: Priority | null): string => (p === null ? '' : `P${p}`);

/**
 * Close the unfinished (2026-11-07): a task can carry one kind of open business (`nodes.open_kind`, migration 0120), in this one order.
 * Their words live in the leaf `@kreators/shared/openBusiness`; here only the keys, so a sort and the server can read them.
 */
export const OPEN_KINDS = ['unfinished', 'unresolved', 'undecided'] as const;
export type OpenKind = (typeof OPEN_KINDS)[number];
const OPEN_KIND_BY_KEY: Record<string, OpenKind> = Object.assign(Object.create(null) as Record<string, OpenKind>, { unfinished: 'unfinished', unresolved: 'unresolved', undecided: 'undecided' });
/** The one reader: a key in any case, else null (null, '' and "none" clear it). A caller that must refuse an unknown value checks `openKindProblem` first. */
export function parseOpenKind(v: unknown): OpenKind | null {
  return typeof v === 'string' ? (OPEN_KIND_BY_KEY[v.trim().toLowerCase()] ?? null) : null;
}
export const OPEN_KIND_PROBLEM = 'Pick unfinished, unresolved or undecided, or none.';
export function openKindProblem(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string' && (!v.trim() || v.trim().toLowerCase() === 'none')) return null;
  return parseOpenKind(v) ? null : OPEN_KIND_PROBLEM;
}
/** Where a kind comes in the one order; an ordinary task is 0, so open business sorts after it. */
export const openRank = (k: OpenKind | null | undefined): number => (k ? OPEN_KINDS.indexOf(k) + 1 : 0);
/** The tag's word: the key with a capital. */
export const openTag = (k: OpenKind): string => `${k[0]!.toUpperCase()}${k.slice(1)}`;
/** The open-business cut Daily sends (`?open=`): any of the three kinds, or one. */
export const isOpenFilter = (v: unknown): v is OpenKind | 'any' => v === 'any' || (typeof v === 'string' && (OPEN_KINDS as readonly string[]).includes(v));

/** Done tasks are paged (2026-11-07, the founder: "this can pile up with time"): 10, 25 or 50 a page, ten by default. */
export const DONE_PAGE_SIZES = [10, 25, 50] as const;
export const DONE_PAGE_SIZE: PageSize = 10;

/** How a list of tasks can be ordered. */
export const TASK_SORTS = [
  { key: 'day', name: 'Day', blurb: 'The day to do it first, then priority.' },
  { key: 'priority', name: 'Priority', blurb: 'P0 first, then the day.' },
  { key: 'due', name: 'Due date', blurb: 'The soonest deadline first; no deadline last.' },
  { key: 'context', name: 'By context', blurb: 'P0 first; inside each priority, the pillar your kind of day leads with. Open business comes last, by kind.' },
  { key: 'block', name: 'By time block', blurb: 'Grouped by the blocks of your day; inside each, P0 first, then area, then day.' },
  { key: 'area', name: 'By area', blurb: 'Grouped by area of life; inside each, P0 first, then the block, then day.' },
] as const;
export type TaskSort = (typeof TASK_SORTS)[number]['key'];
export const isTaskSort = (v: unknown): v is TaskSort => TASK_SORTS.some((s) => s.key === v);

/** The pillars a kind of day puts first (`DAY_TYPES` in dayTypes.ts): the lead, then the second. */
export interface TaskContext {
  lead: RelationshipKey;
  second?: RelationshipKey | null;
  /** The day template's slots and the person's blocks, for the block and area sorts (`DayPlan` on GET /today). */
  slots?: readonly TemplateSlot[];
  blocks?: readonly TimeBlock[];
}

/** Where a task's block comes in the day: the day's blocks in clock order, then picked blocks with no slot that day (by their own order), then none. */
function blockRanker(context: TaskContext | null | undefined): (t: { timeBlockId?: string | null; dueTime: string | null }) => number {
  const slots = context?.slots ?? [];
  const blocks = context?.blocks ?? [];
  const inDay = blocksInDay(slots, blocks).map((b) => b.id);
  return (t) => {
    const hit = blockOfTask(t, slots);
    if (!hit) return 100_000;
    const i = inDay.indexOf(hit.blockId);
    if (i >= 0) return i;
    const known = blocks.findIndex((b) => b.id === hit.blockId);
    return known >= 0 ? 1_000 + known : 100_000;
  };
}
/** An area's place in LIFE_AREA_ORDER; none last. */
const areaRank = (t: { lifeArea?: LifeAreaKey | null }): number => (t.lifeArea ? LIFE_AREA_ORDER.indexOf(t.lifeArea) : LIFE_AREA_ORDER.length);

/**
 * The one ordering for a list of tasks. Stable: ties keep the order given. A task with no priority sorts after P3.
 * `context` ('By context'): priority first (P0, P1, P2, P3, then none), so a P0 always stays above everything else; inside one
 * priority the day's lead pillar comes first, then its second, then the rest, each in the Day order. Without a context it is the
 * priority order. Tasks that carry open business (`openKind`) come after all of that, grouped by kind in `OPEN_KINDS` order.
 */
export function sortTasks<T extends { doDate: string | null; dueDate: string | null; dueTime: string | null; priority: Priority | null; relationship?: RelationshipKey; timeBlockId?: string | null; lifeArea?: LifeAreaKey | null; openKind?: OpenKind | null }>(
  list: T[],
  by: TaskSort,
  context?: TaskContext | null,
): T[] {
  const pri = (t: T) => (t.priority === null ? 4 : t.priority);
  const block = by === 'block' || by === 'area' ? blockRanker(context) : () => 0;
  const rank = (t: T) => (!context ? 0 : t.relationship === context.lead ? 0 : context.second && t.relationship === context.second ? 1 : 2);
  const day = (t: T) => t.doDate ?? t.dueDate ?? '9999-99-99';
  const due = (t: T) => t.dueDate ?? '9999-99-99';
  const time = (t: T) => t.dueTime ?? '99:99';
  const cmp = (a: T, b: T): number => {
    if (by === 'priority') return pri(a) - pri(b) || day(a).localeCompare(day(b)) || time(a).localeCompare(time(b));
    if (by === 'due') return due(a).localeCompare(due(b)) || pri(a) - pri(b) || day(a).localeCompare(day(b));
    // Open business is its own group after every priority, its kinds in their one order (Unfinished, Unresolved, Undecided),
    // each in the same context order inside.
    if (by === 'context') return openRank(a.openKind) - openRank(b.openKind) || pri(a) - pri(b) || rank(a) - rank(b) || day(a).localeCompare(day(b)) || time(a).localeCompare(time(b));
    // Grouped views: the group first, then the priority is balanced first inside it, and the day after.
    if (by === 'block') return block(a) - block(b) || pri(a) - pri(b) || areaRank(a) - areaRank(b) || day(a).localeCompare(day(b)) || time(a).localeCompare(time(b));
    if (by === 'area') return areaRank(a) - areaRank(b) || pri(a) - pri(b) || block(a) - block(b) || day(a).localeCompare(day(b)) || time(a).localeCompare(time(b));
    return day(a).localeCompare(day(b)) || time(a).localeCompare(time(b)) || pri(a) - pri(b);
  };
  return list.map((t, i) => ({ t, i })).sort((x, y) => cmp(x.t, y.t) || x.i - y.i).map((x) => x.t);
}

/**
 * Daily's coloured boxes. By block: one group per block of the day in the order its first slot comes (empty ones too, so a box can say
 * "Nothing here yet"), then picked blocks with no slot that day (by their own order), then 'none' only when it holds tasks. By area:
 * LIFE_AREA_ORDER, then 'none' ("No area"), only the ones with tasks. Inside every group the tasks are in `sortTasks` order for that view.
 */
export function groupTasks<T extends GroupableTask>(list: T[], by: 'block' | 'area', ctx: { slots: readonly TemplateSlot[]; blocks: readonly TimeBlock[]; lead?: RelationshipKey; second?: RelationshipKey | null }): TaskGroup<T>[] {
  const sorted = sortTasks(list, by, { lead: ctx.lead ?? 'servant_leader', second: ctx.second ?? null, slots: ctx.slots, blocks: ctx.blocks });
  const est = (t: T) => t.estimateMin ?? PLAN_DEFAULT_MINUTES;
  const fill = <G extends TaskGroup<T>>(g: G, tasks: T[]): G => ({ ...g, tasks, plannedMin: tasks.reduce((n, t) => n + est(t), 0) });
  const none = (name: string): TaskGroup<T> => ({ key: TASK_GROUP_NONE, kind: 'none', name, color: null, area: null, ranges: [], inDay: true, minutes: 0, plannedMin: 0, tasks: [] });
  if (by === 'area') {
    const out: TaskGroup<T>[] = [];
    for (const key of LIFE_AREA_ORDER) {
      const tasks = sorted.filter((t) => t.lifeArea === key);
      if (tasks.length) out.push(fill({ key, kind: 'area', name: LIFE_AREAS[key].name, color: null, area: key, ranges: [], inDay: true, minutes: 0, plannedMin: 0, tasks: [] }, tasks));
    }
    const rest = sorted.filter((t) => !t.lifeArea);
    if (rest.length) out.push(fill(none('No area'), rest));
    return out;
  }
  const ordered = slotOrder(ctx.slots);
  const inDay = blocksInDay(ctx.slots, ctx.blocks);
  const byTask = new Map<T, string | null>(sorted.map((t) => [t, blockOfTask(t, ctx.slots)?.blockId ?? null]));
  const known = new Set(ctx.blocks.map((b) => b.id));
  const group = (b: TimeBlock, day: boolean): TaskGroup<T> =>
    fill(
      {
        key: b.id,
        kind: 'block',
        name: b.name,
        color: b.color,
        area: b.area,
        ranges: ordered.filter((s) => s.blockId === b.id).map((s) => ({ start: s.start, end: s.end })),
        inDay: day,
        minutes: day ? blockDayMinutes(b.id, ctx.slots) : 0,
        plannedMin: 0,
        tasks: [],
      },
      sorted.filter((t) => byTask.get(t) === b.id),
    );
  const out = inDay.map((b) => group(b, true));
  const dayIds = new Set(inDay.map((b) => b.id));
  for (const b of ctx.blocks) if (!dayIds.has(b.id) && sorted.some((t) => byTask.get(t) === b.id)) out.push(group(b, false));
  const rest = sorted.filter((t) => {
    const id = byTask.get(t);
    return !id || !known.has(id);
  });
  if (rest.length) out.push(fill(none('No block yet'), rest));
  return out;
}

// ---------------------------------------------------------------------------
// From a study of Superfocus (docs/superfocus-study.md): focus quality, a week plan with a plan strength, time blocks,
// a project's pace, and a private calendar link. Rules only: no model, no cost, nothing leaves the account.
// ---------------------------------------------------------------------------

/** How focused a finished focus session felt, one to five. A private note to yourself; it pays nothing. */
export const FOCUS_QUALITY = [
  { value: 1, name: 'Scattered' },
  { value: 2, name: 'Drifting' },
  { value: 3, name: 'Steady' },
  { value: 4, name: 'Focused' },
  { value: 5, name: 'Deep' },
] as const;
export const focusQualityName = (v: number | null): string => (v === null ? 'Not rated' : (FOCUS_QUALITY.find((q) => q.value === Math.round(v))?.name ?? 'Not rated'));

/** What a task with no time estimate counts as when a day is added up, and the default hours of planned work in a day. */
export const PLAN_DEFAULT_MINUTES = 30;
export const PLAN_DAY_MINUTES = 240;
export const WEEK_PLAN_DAYS = 7;
export const PLAN_MAX_SUGGESTIONS = 14;

export interface PlanTask {
  id: string;
  title: string;
  relationship: RelationshipKey;
  estimateMin: number | null;
  priority: Priority | null;
  doDate: string | null;
  dueDate: string | null;
  /** Made from a pillar by the strategy session or the vibe check. */
  fromPillar?: boolean;
  /** The block the person picked for it, its area of life and its time (for the block a planned task falls in). */
  timeBlockId?: string | null;
  lifeArea?: LifeAreaKey | null;
  dueTime?: string | null;
}
export interface WeekPlanDay {
  date: string;
  /** With time blocks: the day's template. */
  templateId?: string;
  templateName?: string;
  /** Minutes already on the day, and minutes the suggestions would add. */
  plannedMin: number;
  suggestedMin: number;
  tasks: number;
  overloaded: boolean;
}
export interface WeekPlanSuggestion {
  id: string;
  title: string;
  relationship: RelationshipKey;
  estimateMin: number;
  day: string;
  reason: string;
  /** The block it keeps (its own), else the block its time falls in that day, else one suggested from its area and pillar (`suggestBlock`); null without time blocks or no fit. */
  blockId: string | null;
  /** How `blockId` was found: `picked` (its own), `time` (its time falls in it, so Keep leaves the block unpinned), `suggested`; absent with no block. */
  blockHow?: 'picked' | 'time' | 'suggested';
}
export interface PlanStrength {
  score: number;
  label: 'Strong' | 'Fair' | 'Light';
  parts: { name: string; score: number; max: number }[];
}
export interface WeekPlan {
  from: string;
  capacityMin: number;
  days: WeekPlanDay[];
  suggestions: WeekPlanSuggestion[];
  /** Tasks with no day that did not fit anywhere this week. */
  noRoom: { id: string; title: string }[];
  /** The plan as it stands, and as it would be with every suggestion kept. */
  strengthNow: PlanStrength;
  strengthWith: PlanStrength;
  /** A few plain lines on what to look at, most useful first. */
  notes: string[];
  /** The same lines with what each is about, so a screen can offer the fix: the tasks to move, to size, or the days to fill. */
  attention: PlanAttention[];
}
export interface PlanTaskRef {
  id: string;
  title: string;
  relationship: RelationshipKey;
  estimateMin: number | null;
  /** The day it is on in the plan, or null when it has none. */
  day: string | null;
}
/** One thing worth a look. `kind` says what to offer: move (a heavy day or a late task), size (no estimate), fill (empty days), room (did not fit). */
export interface PlanAttention {
  kind: 'heavy' | 'late' | 'empty' | 'noRoom' | 'unsized' | 'start' | 'blockFull' | 'blockEmpty';
  text: string;
  tasks: PlanTaskRef[];
  /** For an empty-days line: the days, as dates. */
  days: string[];
}

const dayName = (date: string): string => new Date(`${date}T00:00:00Z`).toLocaleDateString(LOCALE, { weekday: 'long', timeZone: 'UTC' });
const hm = (min: number): string => (min >= 60 ? `${Math.floor(min / 60)}h${min % 60 ? ` ${min % 60}m` : ''}` : `${min}m`);
const planAddDays = (date: string, n: number): string => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** How well a week is planned, 0 to 100: days with something on them (40), days that are not overloaded (40), tasks that say how long they take (20). */
export function planStrength(load: readonly { min: number; tasks: number }[], capacityMin: number, estimated: number, total: number): PlanStrength {
  const days = load.length || 1;
  const covered = load.filter((d) => d.tasks > 0).length;
  const over = load.filter((d) => d.min > capacityMin).length;
  const coverage = Math.round((covered / days) * 40);
  const balance = covered === 0 ? 0 : Math.round((1 - over / covered) * 40);
  const estimates = total === 0 ? 0 : Math.round((estimated / total) * 20);
  const score = coverage + balance + estimates;
  return {
    score,
    label: score >= 75 ? 'Strong' : score >= 50 ? 'Fair' : 'Light',
    parts: [
      { name: 'Days with something planned', score: coverage, max: 40 },
      { name: 'Days that are not overloaded', score: balance, max: 40 },
      { name: 'Tasks that say how long they take', score: estimates, max: 20 },
    ],
  };
}

/**
 * Plans the next seven days from the open tasks. A task is already placed when it has a do date, or only a due date (it opens on that day);
 * a late one counts on today. The tasks with no day at all are the ones suggested a day: highest priority first, then ones made from a
 * pillar, each on the lightest day it fits in, so the week is spread and not packed. A day over the capacity is flagged, not filled.
 * Nothing here writes anything: the screen keeps what the person keeps, one task at a time, through the ordinary edit.
 */
/** Time blocks for the week plan: each day's template and slots, and the person's blocks. */
export interface PlanBlocking {
  days: { date: string; slots: TemplateSlot[]; templateId: string; templateName: string }[];
  blocks: TimeBlock[];
}

export function planWeek(today: string, tasks: readonly PlanTask[], capacityMin: number = PLAN_DAY_MINUTES, blocking?: PlanBlocking): WeekPlan {
  const dates = Array.from({ length: WEEK_PLAN_DAYS }, (_, i) => planAddDays(today, i));
  const last = dates[dates.length - 1]!;
  const est = (t: PlanTask) => t.estimateMin ?? PLAN_DEFAULT_MINUTES;
  const load = new Map(dates.map((d) => [d, { min: 0, tasks: 0, suggested: 0 }]));
  let estimated = 0;
  let total = 0;
  let late = 0;
  const open: PlanTask[] = [];
  const placed: { t: PlanTask; at: string; late: boolean }[] = [];
  for (const t of tasks) {
    const day = t.doDate ?? t.dueDate;
    if (!day) {
      open.push(t);
      continue;
    }
    if (day > last) continue;
    const at = day < today ? today : day;
    if (day < today) late += 1;
    placed.push({ t, at, late: day < today });
    const l = load.get(at)!;
    l.min += est(t);
    l.tasks += 1;
    total += 1;
    if (t.estimateMin) estimated += 1;
  }
  // With time blocks: what is already in each block on each day, so a suggestion goes where there is room.
  const daySlots = (d: string): TemplateSlot[] => blocking?.days.find((x) => x.date === d)?.slots ?? [];
  const used = new Map<string, Record<string, number>>(dates.map((d) => [d, {}]));
  const inBlock = new Map<string, { t: PlanTask; day: string }[]>();
  const putIn = (t: PlanTask, day: string, blockId: string | null, need: number) => {
    if (!blockId) return;
    const u = used.get(day);
    if (u) u[blockId] = (u[blockId] ?? 0) + need;
    const key = `${day}|${blockId}`;
    inBlock.set(key, [...(inBlock.get(key) ?? []), { t, day }]);
  };
  const suggestedBlock = (t: PlanTask, day: string, need: number): { blockId: string | null; blockHow?: 'picked' | 'time' | 'suggested' } => {
    const own = t.timeBlockId && blocking?.blocks.some((b) => b.id === t.timeBlockId) ? t.timeBlockId : null;
    // The block picked in its form, else the block its time falls in on that day, else one from its area and pillar.
    const byTime = own ? null : (blockOfTask({ timeBlockId: null, dueTime: t.dueTime ?? null }, daySlots(day))?.blockId ?? null);
    const guess = (own ?? byTime) ? null : suggestBlock(t, daySlots(day), blocking?.blocks ?? [], used.get(day));
    const id = own ?? byTime ?? guess;
    putIn(t, day, id, need);
    if (!id) return { blockId: null };
    return { blockId: id, blockHow: own ? 'picked' : byTime ? 'time' : 'suggested' };
  };
  if (blocking) for (const p of placed) putIn(p.t, p.at, blockOfTask({ timeBlockId: p.t.timeBlockId ?? null, dueTime: p.t.dueTime ?? null }, daySlots(p.at))?.blockId ?? null, est(p.t));
  const rank = (t: PlanTask) => (t.priority ?? 9) * 2 + (t.fromPillar ? 0 : 1);
  const sorted = [...open].sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title));
  const suggestions: WeekPlanSuggestion[] = [];
  const noRoom: { id: string; title: string }[] = [];
  let sEst = 0;
  for (const t of sorted) {
    if (suggestions.length >= PLAN_MAX_SUGGESTIONS) {
      noRoom.push({ id: t.id, title: t.title });
      continue;
    }
    const need = est(t);
    // The lightest day it fits in; the earliest on a tie.
    const fit = dates.filter((d) => load.get(d)!.min + need <= capacityMin).sort((a, b) => load.get(a)!.min - load.get(b)!.min || a.localeCompare(b))[0];
    if (!fit) {
      noRoom.push({ id: t.id, title: t.title });
      continue;
    }
    const l = load.get(fit)!;
    l.min += need;
    l.suggested += need;
    l.tasks += 1;
    suggestions.push({
      id: t.id,
      title: t.title,
      relationship: t.relationship,
      estimateMin: need,
      day: fit,
      reason: t.priority !== null && t.priority <= 1 ? `P${t.priority}, so it comes early` : t.fromPillar ? 'From your pillar' : 'It had no day yet',
      ...(blocking ? suggestedBlock(t, fit, need) : { blockId: null }),
    });
    total += 1;
    if (t.estimateMin) sEst += 1;
  }
  const days: WeekPlanDay[] = dates.map((d) => {
    const l = load.get(d)!;
    const tpl = blocking?.days.find((x) => x.date === d);
    const day: WeekPlanDay = { date: d, plannedMin: l.min - l.suggested, suggestedMin: l.suggested, tasks: l.tasks, overloaded: l.min > capacityMin };
    if (tpl) {
      day.templateId = tpl.templateId;
      day.templateName = tpl.templateName;
    }
    return day;
  });
  const withLoad = dates.map((d) => ({ min: load.get(d)!.min, tasks: load.get(d)!.tasks }));
  const nowLoad = dates.map((d) => ({ min: load.get(d)!.min - load.get(d)!.suggested, tasks: load.get(d)!.tasks - suggestions.filter((s) => s.day === d).length }));
  const nowTotal = total - suggestions.length;
  const strengthNow = planStrength(nowLoad, capacityMin, estimated, nowTotal);
  const strengthWith = planStrength(withLoad, capacityMin, estimated + sEst, total);
  const ref = (t: PlanTask, day: string | null): PlanTaskRef => ({ id: t.id, title: t.title, relationship: t.relationship, estimateMin: t.estimateMin, day });
  const attention: PlanAttention[] = [];
  const add = (kind: PlanAttention['kind'], text: string, tasks: PlanTaskRef[] = [], dayList: string[] = []) => attention.push({ kind, text, tasks, days: dayList });
  const heavy = days.filter((d) => d.overloaded).sort((a, b) => b.plannedMin + b.suggestedMin - (a.plannedMin + a.suggestedMin))[0];
  if (heavy) add('heavy', `${dayName(heavy.date)} has ${hm(heavy.plannedMin + heavy.suggestedMin)} planned, over your ${hm(capacityMin)}. Move one task to a lighter day.`, placed.filter((p) => p.at === heavy.date).slice(0, 12).map((p) => ref(p.t, p.at)));
  if (late > 0) add('late', `${late} late ${late === 1 ? 'task is' : 'tasks are'} counted on today. Finish or move ${late === 1 ? 'it' : 'them'} first.`, placed.filter((p) => p.late).slice(0, 12).map((p) => ref(p.t, p.at)));
  const empty = days.filter((d) => d.tasks === 0).map((d) => d.date);
  if (empty.length > 0 && empty.length < WEEK_PLAN_DAYS) add('empty', `Nothing is planned on ${empty.slice(0, 3).map((d) => dayName(d).slice(0, 3)).join(', ')}${empty.length > 3 ? ' and more' : ''}. Rest is fine; make it a choice.`, [], empty);
  if (noRoom.length > 0) add('noRoom', `${noRoom.length} ${noRoom.length === 1 ? 'task does' : 'tasks do'} not fit this week at ${hm(capacityMin)} a day. Leave ${noRoom.length === 1 ? 'it' : 'them'} for next week, or raise the hours.`, noRoom.slice(0, 12).map((n) => ref(open.find((o) => o.id === n.id)!, null)));
  const unsized = placed.filter((p) => !p.t.estimateMin);
  if (unsized.length > 0) add('unsized', `${unsized.length} ${unsized.length === 1 ? 'task has' : 'tasks have'} no time estimate. Add one so the days add up.`, unsized.slice(0, 12).map((p) => ref(p.t, p.at)));
  if (tasks.length === 0) add('start', 'Add a few tasks first, then plan the week around them.');
  if (blocking) {
    const short = (d: string) => dayName(d).slice(0, 3);
    const named = (id: string) => blocking.blocks.find((b) => b.id === id);
    // A block whose planned minutes on a day pass its length: the fullest one.
    let full: { day: string; id: string; min: number; len: number } | null = null;
    for (const d of dates)
      for (const [id, min] of Object.entries(used.get(d) ?? {})) {
        const len = blockDayMinutes(id, daySlots(d));
        if (len > 0 && min > len && (!full || min - len > full.min - full.len)) full = { day: d, id, min, len };
      }
    if (full && named(full.id))
      add('blockFull', `${named(full.id)!.name} on ${short(full.day)} holds ${hm(full.min)} of ${hm(full.len)}.`, (inBlock.get(`${full.day}|${full.id}`) ?? []).slice(0, 12).map((x) => ref(x.t, x.day)), [full.day]);
    // A Focus-tagged block with nothing planned in it: the first such block, on every day it is empty.
    const isFocus = (b: TimeBlock) => b.tag.trim().toLowerCase() === 'focus';
    const emptyFocus = new Map<string, string[]>();
    for (const d of dates)
      for (const b of blocksInDay(daySlots(d), blocking.blocks))
        if (isFocus(b) && !(used.get(d) ?? {})[b.id]) emptyFocus.set(b.id, [...(emptyFocus.get(b.id) ?? []), d]);
    const firstEmpty = [...emptyFocus.entries()][0];
    if (firstEmpty && named(firstEmpty[0])) {
      const [id, ds] = firstEmpty;
      const loose = open.filter((t) => !t.timeBlockId).slice(0, 5);
      const list = ds.length <= 2 ? ds.map(short).join(' and ') : `${ds.slice(0, 2).map(short).join(', ')} and ${ds.length - 2} more ${ds.length - 2 === 1 ? 'day' : 'days'}`;
      add('blockEmpty', `${named(id)!.name} is empty on ${list}.`, loose.map((t) => ref(t, null)), ds);
    }
  }
  const shown = attention.slice(0, blocking ? 6 : 4);
  return { from: today, capacityMin, days, suggestions, noRoom, strengthNow, strengthWith, notes: shown.map((a) => a.text), attention: shown };
}

/** A time of day as "9:30 am". */
export function blockTimeLabel(min: number): string {
  const h24 = Math.floor(min / 60) % 24;
  const m = min % 60;
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h24 < 12 ? 'am' : 'pm'}`;
}

export interface DayBlock {
  id: string;
  title: string;
  start: number;
  end: number;
  /** It starts before the one before it ends. */
  overlaps: boolean;
}
export interface DayBlocks {
  blocks: DayBlock[];
  /** Free stretches between blocks that are at least `FREE_MIN` long, in minutes from midnight. */
  free: { start: number; end: number }[];
  /** Tasks for the day that have no time yet, so they are not on the line. */
  untimed: number;
}
export const FREE_MIN = 15;
/** Lays a day's tasks out as blocks: the ones with a time, as long as their estimate (30 minutes when it has none), and the free gaps between. */
export function dayBlocks(tasks: readonly { id: string; title: string; dueTime: string | null; estimateMin: number | null }[]): DayBlocks {
  const timed = tasks
    .filter((t) => t.dueTime && /^([01]\d|2[0-3]):[0-5]\d$/.test(t.dueTime))
    .map((t) => {
      const [h, m] = t.dueTime!.split(':').map(Number) as [number, number];
      const start = h * 60 + m;
      return { id: t.id, title: t.title, start, end: Math.min(24 * 60, start + (t.estimateMin ?? PLAN_DEFAULT_MINUTES)) };
    })
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const blocks: DayBlock[] = [];
  const free: { start: number; end: number }[] = [];
  let reach = 0;
  timed.forEach((b, i) => {
    const overlaps = i > 0 && b.start < reach;
    if (i > 0 && b.start - reach >= FREE_MIN) free.push({ start: reach, end: b.start });
    blocks.push({ ...b, overlaps });
    reach = Math.max(reach, b.end);
  });
  return { blocks, free, untimed: tasks.length - timed.length };
}

export type PaceStatus = 'on' | 'slipping' | 'behind' | 'none';
export interface ProjectPace {
  status: PaceStatus;
  label: string;
  /** Day X of Y between the day the project was made and its due day. */
  day: number;
  of: number;
  /** Tasks done out of all of them, and how much of the time has gone, as whole percents. */
  donePct: number;
  timePct: number;
  /** One plain line for the screen. */
  line: string;
}
/**
 * Whether a project is moving as fast as its due day needs. The share of its tasks done is set against the share of the time gone: within ten
 * points is on track, within thirty is slipping, further is behind. A project with no due day or no tasks has no pace to judge.
 */
export function projectPace(created: string, dueDate: string | null, done: number, total: number, today: string): ProjectPace {
  const none = (line: string): ProjectPace => ({ status: 'none', label: 'No pace yet', day: 0, of: 0, donePct: 0, timePct: 0, line });
  if (!dueDate) return none('Add a due day to see the pace.');
  const start = created.slice(0, 10);
  const span = Math.round((Date.parse(`${dueDate}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1;
  if (span < 1) return none('The due day is before the start.');
  if (total === 0) return none('Add tasks to see the pace.');
  const gone = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1;
  const day = Math.max(1, Math.min(span, gone));
  const donePct = Math.round((done / total) * 100);
  const timePct = Math.round((day / span) * 100);
  const finished = done >= total;
  const late = today > dueDate && !finished;
  const gap = timePct - donePct;
  const status: PaceStatus = finished || (!late && gap <= 10) ? 'on' : !late && gap <= 30 ? 'slipping' : 'behind';
  const label = status === 'on' ? 'On track' : status === 'slipping' ? 'Slipping' : 'Behind';
  const line = finished ? 'Every task is done.' : late ? `Past its due day with ${total - done} left.` : `Day ${day} of ${span}, ${donePct}% of the tasks done.`;
  return { status, label, day, of: span, donePct, timePct, line };
}

// ---- a private calendar link: the person's tasks as a calendar Google, Apple or Outlook can subscribe to ----

export interface IcsTask {
  id: string;
  title: string;
  /** The pillar it belongs to, or null for something that is not a task (a scheduled review). */
  relationship: RelationshipKey | null;
  /** Used instead of the pillar's name as the calendar category, when there is no pillar. */
  category?: string;
  /** The day it opens (do date, else due date), YYYY-MM-DD. */
  day: string;
  dueTime: string | null;
  estimateMin: number | null;
  priority: Priority | null;
  /** The calendar's description line, when it is not a pillar task: a short plain line, never a note, an amount or what anyone wrote. */
  description?: string;
  /** For something with a fixed instant (an event someone signed up for): its UTC start and end, used instead of `day` and `dueTime`. */
  startsAt?: string;
  endsAt?: string;
}
/** Text for a calendar file: backslash, semicolon, comma and line breaks escaped. */
export const icsEscape = (t: string): string => t.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r\n|\r|\n/g, '\\n');
/** A line folded before 75 bytes, each continuation starting with one space, as the calendar format asks. A character is never split. */
export function icsFold(line: string): string {
  const utf8 = (ch: string) => { const c = ch.codePointAt(0) ?? 0; return c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4; };
  const parts: string[] = [];
  let cur = '';
  let bytes = 0;
  for (const ch of line) {
    const n = utf8(ch);
    // The continuation's leading space counts toward its 75 bytes.
    if (bytes + n > (parts.length === 0 ? 75 : 74)) {
      parts.push(cur);
      cur = '';
      bytes = 0;
    }
    cur += ch;
    bytes += n;
  }
  parts.push(cur);
  return parts.join('\r\n ');
}
/** The description a calendar shows for each kind of entry that is not a pillar task. */
export const ICS_CATEGORY_LINE: Record<string, string> = {
  Reviews: 'A review you scheduled in kreators.app',
  Agency: 'Client work from Agency in kreators.app',
  Events: 'Something you signed up for in kreators.app',
};
/** A task's calendar title: its own words, marked when it was brought to a review, so the calendar and the review say the same thing. */
export const icsTaskTitle = (title: string, forReview: boolean): string => (forReview ? `${title} (for review)` : title);
const icsStamp = (d: Date): string => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsDay = (day: string): string => day.replace(/-/g, '');
/**
 * The tasks with a day as calendar events: a timed one at its time in the person's zone for as long as its estimate (30 minutes when it
 * has none), the rest as all-day events. Only the title, the pillar and the priority leave: never a note, a journal line or a number from
 * a tracker. Pure, so the same tasks always give the same file.
 */
export function buildCalendar(tasks: readonly IcsTask[], zone: string, now: Date): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//kreators.app//Tasks//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:kreators.app tasks', 'REFRESH-INTERVAL;VALUE=DURATION:PT1H'];
  for (const t of tasks) {
    const pillar = t.relationship ? (RELATIONSHIP_BY_KEY[t.relationship]?.name ?? '') : '';
    lines.push('BEGIN:VEVENT', `UID:${t.id}@kreators.app`, `DTSTAMP:${icsStamp(now)}`);
    const m = t.dueTime ? /^([01]\d|2[0-3]):([0-5]\d)$/.exec(t.dueTime) : null;
    const fixed = t.startsAt && !Number.isNaN(Date.parse(t.startsAt)) ? new Date(t.startsAt) : null;
    if (fixed) {
      const until = t.endsAt && Date.parse(t.endsAt) > fixed.getTime() ? new Date(t.endsAt) : new Date(fixed.getTime() + (t.estimateMin ?? 60) * 60_000);
      lines.push(`DTSTART:${icsStamp(fixed)}`, `DTEND:${icsStamp(until)}`);
    } else if (m) {
      const start = zonedToUtc(t.day, Number(m[1]) * 60 + Number(m[2]), zone);
      const end = new Date(start.getTime() + (t.estimateMin ?? PLAN_DEFAULT_MINUTES) * 60_000);
      lines.push(`DTSTART:${icsStamp(start)}`, `DTEND:${icsStamp(end)}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${icsDay(t.day)}`, `DTEND;VALUE=DATE:${icsDay(planAddDays(t.day, 1))}`);
    }
    lines.push(`SUMMARY:${icsEscape(t.title)}`);
    if (pillar) lines.push(`CATEGORIES:${icsEscape(pillar)}`, `DESCRIPTION:${icsEscape(t.description ?? `From your ${pillar} pillar`)}`);
    else if (t.category) lines.push(`CATEGORIES:${icsEscape(t.category)}`, `DESCRIPTION:${icsEscape(t.description ?? ICS_CATEGORY_LINE[t.category] ?? 'From kreators.app')}`);
    if (t.priority !== null) lines.push(`PRIORITY:${t.priority === 0 ? 1 : t.priority === 1 ? 3 : t.priority === 2 ? 5 : 9}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return `${lines.map(icsFold).join('\r\n')}\r\n`;
}
