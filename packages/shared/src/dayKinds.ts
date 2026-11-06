// ---------------------------------------------------------------------------
// Kinds of day over many days (2026-11-06, the founder: "how to set a particular day in daily as a type of day? so that it can be
// added to emergence and shows progress of types of days one is having"). A day's kind is its day template (docs/time-blocks.md):
// the one set for that date, else the one the weekly pattern gives its weekday. A day on the default template ("Everyday") has no kind,
// and so has a day before the account began. `kindsOfDays` is the one reading, used by Emerging's "Your kinds of day", the Reviews tile,
// the month calendar on Daily and the Time blocks page's "This month" line.
//
// A leaf on purpose: it imports only `dates.ts` and types, so it sits in the small `shared-base` chunk (vite.config.ts) and does not
// grow the main shared chunk. `templateForDate` lives here for the same reason; timeBlocks.ts passes it on.
// ---------------------------------------------------------------------------

import { addDays, isoWeekday } from './dates.ts';
import type { BlockColor, DayFrom, TemplateSlot } from './timeBlocks.ts';

/** Which template a date uses: a change to that date (while its template exists), then the pattern's weekday, then the default. */
export function templateForDate(
  date: string,
  ctx: { overrides: Readonly<Record<string, string>>; pattern: readonly (string | null)[]; defaultId: string; exists: (id: string) => boolean },
): { templateId: string; from: DayFrom } {
  const own = Object.prototype.hasOwnProperty.call(ctx.overrides, date) ? ctx.overrides[date] : undefined;
  if (own && ctx.exists(own)) return { templateId: own, from: 'date' };
  const week = ctx.pattern[isoWeekday(date) - 1];
  if (week && ctx.exists(week)) return { templateId: week, from: 'week' };
  return { templateId: ctx.defaultId, from: 'default' };
}

/** The last four weeks: the window of "Your kinds of day". */
export const KINDS_WINDOW_DAYS = 28;
/**
 * A kind needs this many days (on which the app was used) before how it went is set beside the other days, and the other days need
 * Emerging's own floor (`PAIR_MIN_DAYS`, 7) on the other side; below either the card shows the mix and the rows, never a comparison.
 */
export const KIND_MIN_DAYS = 4;

/** What a person's days are made from, as far as their kinds go. */
export interface KindFacts {
  templates: readonly { id: string; name: string }[];
  defaultId: string;
  /** Seven entries, Monday first; null follows the default. */
  pattern: readonly (string | null)[];
  /** Date to template id: the dates set to a template of their own. */
  overrides: Readonly<Record<string, string>>;
  /** The person's first day (the account's day in their zone); a date before it has no kind. */
  since?: string | null;
}
export interface KindDay {
  date: string;
  /** The day's kind, or null: the default template ("Everyday"), a deleted template, or a date before the account. */
  templateId: string | null;
  /** Where its template came from; null before the account. */
  from: DayFrom | null;
}
export interface KindCount {
  templateId: string;
  name: string;
  days: number;
}
export interface KindsOfDays {
  days: KindDay[];
  /** Each kind with its days, most first (then by name). */
  tally: KindCount[];
  /** Days with no kind (the default), from the account's first day on. */
  none: number;
  /** Days before the account began. */
  before: number;
}

/** `GET /time-blocks/month?day=`: the month so far (its first day to the device's day), each kind with its days and colour. */
export interface KindsMonthResponse {
  from: string;
  to: string;
  kinds: (KindCount & { color: BlockColor | null })[];
  /** Days on the default template (no kind), from the account's first day on. */
  none: number;
}

/** Every day from `from` to `to` (both included) with its kind, and how many days each kind had. Pure; the same facts, the same answer. */
export function kindsOfDays(f: KindFacts, from: string, to: string): KindsOfDays {
  const names = new Map(f.templates.map((t) => [t.id, t.name]));
  const ctx = { overrides: f.overrides, pattern: f.pattern, defaultId: f.defaultId, exists: (id: string) => names.has(id) };
  const days: KindDay[] = [];
  const counts = new Map<string, number>();
  let none = 0;
  let before = 0;
  for (let d = from, i = 0; d <= to && i < 400; d = addDays(d, 1), i += 1) {
    if (f.since && d < f.since) {
      before += 1;
      days.push({ date: d, templateId: null, from: null });
      continue;
    }
    const { templateId, from: src } = templateForDate(d, ctx);
    const kind = templateId !== f.defaultId && names.has(templateId) ? templateId : null;
    days.push({ date: d, templateId: kind, from: src });
    if (kind) counts.set(kind, (counts.get(kind) ?? 0) + 1);
    else none += 1;
  }
  const tally = [...counts.entries()]
    .map(([templateId, n]) => ({ templateId, name: names.get(templateId) ?? '', days: n }))
    .sort((a, b) => b.days - a.days || a.name.localeCompare(b.name) || (a.templateId < b.templateId ? -1 : 1));
  return { days, tally, none, before };
}

/**
 * A template's colour, the one rule wherever a kind of day is drawn: its own colour, picked in its form (2026-11-06, the founder's
 * choice "own colour per template"; each starting template has its own). With none picked, the colour of its longest block over the
 * day, leaving out the slots that run past midnight (the night's sleep, which most templates share); ties go to the block that starts
 * first. A template whose every slot crosses midnight takes the longest of those; one with no slots has none (drawn in the quiet ink).
 */
export function templateColor(t: { slots: readonly TemplateSlot[]; color?: BlockColor | null }, blocks: readonly { id: string; color: BlockColor }[]): BlockColor | null {
  if (t.color) return t.color;
  const crosses = (s: TemplateSlot) => s.end !== 0 && s.end < s.start;
  const day = t.slots.filter((s) => !crosses(s));
  const list = day.length ? day : t.slots;
  const by = new Map<string, { min: number; first: number }>();
  for (const s of list) {
    const cur = by.get(s.blockId) ?? { min: 0, first: s.start };
    cur.min += (s.end - s.start + 1440) % 1440;
    cur.first = Math.min(cur.first, s.start);
    by.set(s.blockId, cur);
  }
  const best = [...by.entries()].sort((a, b) => b[1].min - a[1].min || a[1].first - b[1].first || (a[0] < b[0] ? -1 : 1))[0];
  return best ? (blocks.find((b) => b.id === best[0])?.color ?? null) : null;
}

/** One kind set beside every other day: the average of `value` on its days and on the rest. A day whose value is null is left out. */
export interface KindSide {
  n: number;
  avg: number | null;
}
export function kindBeside(days: readonly KindDay[], templateId: string, value: (date: string) => number | null): { on: KindSide; off: KindSide } {
  let onN = 0;
  let onSum = 0;
  let offN = 0;
  let offSum = 0;
  for (const d of days) {
    if (d.from === null) continue;
    const v = value(d.date);
    if (v === null || !Number.isFinite(v)) continue;
    if (d.templateId === templateId) {
      onN += 1;
      onSum += v;
    } else {
      offN += 1;
      offSum += v;
    }
  }
  return { on: { n: onN, avg: onN ? onSum / onN : null }, off: { n: offN, avg: offN ? offSum / offN : null } };
}
