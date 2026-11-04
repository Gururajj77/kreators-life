// ---------------------------------------------------------------------------
// The year of activity on Profile ("Your year", GET /me/activity): a heatmap of what a person did each day, counts only.
// The barrel (index.ts) re-exports it like every other domain file.

/** How many days the grid covers: 53 weeks, ending on the person's own today. */
export const ACTIVITY_DAYS = 371;

/** One day on the grid: the xp earned and the person's own tasks ticked, on their own calendar day. */
export interface ActivityDay {
  /** YYYY-MM-DD, the person's day. */
  day: string;
  xp: number;
  ticks: number;
}

/** What GET /me/activity answers: every day oldest first, ending on `end`, with the totals and the busiest day of each count. */
export interface ActivityYear {
  end: string;
  days: ActivityDay[];
  totals: { xp: number; ticks: number };
  max: { xp: number; ticks: number };
}

/** The two counts the grid can show. */
export type ActivityMetric = 'xp' | 'ticks';

/**
 * The shade of a day, 0 to 4: 0 only for nothing, then the quarter of the busiest day it reaches, so the busiest day is always 4.
 * Whole numbers only (`ceil(count * 4 / max)`).
 */
export function activityLevel(count: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (!(count > 0) || !(max > 0)) return 0;
  const level = Math.ceil((Math.min(count, max) * 4) / max);
  return Math.max(1, Math.min(4, level)) as 1 | 2 | 3 | 4;
}

/** 1 for Monday to 7 for Sunday, for a YYYY-MM-DD day. */
function weekdayOf(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  const w = new Date(Date.UTC(y ?? 2000, (m ?? 1) - 1, d ?? 1)).getUTCDay();
  return w === 0 ? 7 : w;
}

/**
 * The days laid out as weeks, Monday first like `monthGrid`: each column is seven slots from Monday to Sunday. The first column is padded
 * with null before the first day and the last one after the last day, so a year that starts mid-week still lines up.
 */
export function activityWeeks<T extends { day: string }>(days: readonly T[]): (T | null)[][] {
  if (days.length === 0) return [];
  const lead = weekdayOf(days[0]!.day) - 1;
  const slots: (T | null)[] = [...Array.from({ length: lead }, () => null), ...days];
  while (slots.length % 7 !== 0) slots.push(null);
  const weeks: (T | null)[][] = [];
  for (let i = 0; i < slots.length; i += 7) weeks.push(slots.slice(i, i + 7));
  return weeks;
}

/** The days from `end` back, oldest first: the empty grid the server fills in. */
export function activityRange(end: string, count = ACTIVITY_DAYS): string[] {
  const [y, m, d] = end.split('-').map(Number);
  const base = Date.UTC(y ?? 2000, (m ?? 1) - 1, d ?? 1);
  return Array.from({ length: count }, (_, i) => new Date(base - (count - 1 - i) * 86_400_000).toISOString().slice(0, 10));
}
