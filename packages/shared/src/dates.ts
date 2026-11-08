import { DEFAULT_ZONE, LOCALE } from './core.ts';

// ---------------------------------------------------------------------------
// Bookings: availability maths in the creator's own zone
// ---------------------------------------------------------------------------

export interface AvailabilityOverride {
  id: string;
  /** YYYY-MM-DD in the creator's zone. */
  date: string;
  /** Empty means the whole day is blocked. */
  ranges: { startMin: number; endMin: number }[];
}

/**
 * One formatter per zone (2026-11-05): building an Intl.DateTimeFormat is the slow part (about 30 µs), and Emerging reads thousands
 * of ticks in one zone. A zone the platform does not know is remembered as null, so it answers 0 without throwing again.
 */
const ZONE_FORMATS = new Map<string, Intl.DateTimeFormat | null>();
function zoneFormat(zone: string): Intl.DateTimeFormat | null {
  const hit = ZONE_FORMATS.get(zone);
  if (hit !== undefined) return hit;
  let fmt: Intl.DateTimeFormat | null;
  try {
    // en-US on purpose: these parts are parsed for zone maths, never shown.
    fmt = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    fmt = null;
  }
  // Zone names come from people's profiles, so the cache is bounded; past the bound it starts again.
  if (ZONE_FORMATS.size >= 512) ZONE_FORMATS.clear();
  ZONE_FORMATS.set(zone, fmt);
  return fmt;
}

function exactOffset(fmt: Intl.DateTimeFormat, at: Date): number {
  const parts = fmt.formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((asUtc - at.getTime()) / 60_000);
}

/** Each UTC day's offset per zone, NaN for a day the clocks change on. A heavy account's Emerging asks thousands of times, over a few dozen days; on Workers Free a route has 10 ms of CPU (2026-11-07). */
const ZONE_DAYS = new Map<string, Map<number, number>>();
/** From here every offset is whole minutes: before it, seconds in an old local mean time can round either way, so those are worked out every time. */
const WHOLE_MINUTES_FROM = Date.UTC(1973, 0, 1);

/** Minutes the zone is ahead of UTC at a given instant, via the platform's own tables. */
export function zoneOffsetMinutes(zone: string, at: Date): number {
  try {
    const fmt = zoneFormat(zone);
    if (!fmt) return 0;
    const t = at.getTime();
    if (!(t >= WHOLE_MINUTES_FROM)) return exactOffset(fmt, at);
    const dayNumber = Math.floor(t / DAY_MS);
    let days = ZONE_DAYS.get(zone);
    if (!days) {
      if (ZONE_DAYS.size >= 512) ZONE_DAYS.clear();
      days = new Map();
      ZONE_DAYS.set(zone, days);
    }
    let offset = days.get(dayNumber);
    if (offset === undefined) {
      // The same at both ends of the UTC day means no change inside it: no zone changes its clocks twice in a day.
      const first = exactOffset(fmt, new Date(dayNumber * DAY_MS));
      const last = exactOffset(fmt, new Date((dayNumber + 1) * DAY_MS - 1));
      offset = first === last ? first : Number.NaN;
      if (days.size >= 4096) days.clear();
      days.set(dayNumber, offset);
    }
    return Number.isNaN(offset) ? exactOffset(fmt, at) : offset;
  } catch {
    return 0;
  }
}

/** The instant that a local date and minute-of-day in a zone refers to. */
export function zonedToUtc(date: string, minutes: number, zone: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const guess = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, Math.floor(minutes / 60), minutes % 60));
  const offset = zoneOffsetMinutes(zone, guess);
  const fixed = new Date(guess.getTime() - offset * 60_000);
  // A second pass catches the rare case where the offset changes between guess and answer.
  const offset2 = zoneOffsetMinutes(zone, fixed);
  if (offset2 === offset) return fixed;
  const second = new Date(guess.getTime() - offset2 * 60_000);
  if (zoneOffsetMinutes(zone, second) === offset2) return second;
  // A local time that does not exist (the clocks jumped over it) lands on the later of the two readings, an hour after the gap opens.
  return new Date(Math.max(fixed.getTime(), second.getTime()));
}

export interface SlotInput {
  /** YYYY-MM-DD in the creator's zone. */
  date: string;
  zone: string;
  rules: { weekday: number; startMin: number; endMin: number }[];
  overrides: AvailabilityOverride[];
  /** Taken intervals as ISO strings. */
  busy: { startsAt: string; endsAt: string }[];
  durationMin: number;
  bufferMin: number;
  noticeHours: number;
  maxDaysAhead: number;
  now: Date;
}

const WEEKDAY_FORMATS = new Map<string, Intl.DateTimeFormat>();
/** One formatter per zone; a zone the platform does not know throws, as building one always did. */
function weekdayFormat(zone: string): Intl.DateTimeFormat {
  let fmt = WEEKDAY_FORMATS.get(zone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', { timeZone: zone, weekday: 'short' });
    if (WEEKDAY_FORMATS.size >= 512) WEEKDAY_FORMATS.clear();
    WEEKDAY_FORMATS.set(zone, fmt);
  }
  return fmt;
}

/** Free slot starts, as ISO strings, for one day. Pure, so it is tested without a server. */
export function slotsFor(input: SlotInput): string[] {
  const { date, zone, durationMin, bufferMin } = input;
  const step = Math.max(5, durationMin);
  const dayStart = zonedToUtc(date, 0, zone);
  const weekday = new Date(dayStart.getTime() + 12 * 3600_000).getUTCDay();
  const localWeekday = (() => {
    try {
      // en-US on purpose: these parts are parsed for zone maths, never shown.
      const w = weekdayFormat(zone).format(new Date(dayStart.getTime() + 12 * 3600_000));
      return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(w);
    } catch {
      return weekday;
    }
  })();
  const override = input.overrides.find((o) => o.date === date);
  const ranges = override ? override.ranges : input.rules.filter((r) => r.weekday === localWeekday).map((r) => ({ startMin: r.startMin, endMin: r.endMin }));
  const earliest = input.now.getTime() + input.noticeHours * 3600_000;
  const latest = input.now.getTime() + input.maxDaysAhead * 86_400_000;
  const busy = input.busy.map((b) => ({ s: new Date(b.startsAt).getTime() - bufferMin * 60_000, e: new Date(b.endsAt).getTime() + bufferMin * 60_000 }));
  const out: string[] = [];
  for (const r of ranges) {
    for (let m = r.startMin; m + durationMin <= r.endMin; m += step) {
      const start = zonedToUtc(date, m, zone).getTime();
      const end = start + durationMin * 60_000;
      if (start < earliest || start > latest) continue;
      if (busy.some((b) => start < b.e && end > b.s)) continue;
      out.push(new Date(start).toISOString());
    }
  }
  return out;
}

export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const asDay = (d: string) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
export const fromDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const DAY_MS = 86_400_000;
export const addDays = (d: string, n: number): string => fromDay(asDay(d) + n * DAY_MS);
/** 1 for Monday to 7 for Sunday. */
export const isoWeekday = (d: string): number => ((new Date(asDay(d)).getUTCDay() + 6) % 7) + 1;
export const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
export const daysBetween = (a: string, b: string): number => Math.round((asDay(b) - asDay(a)) / DAY_MS);

// ---------------------------------------------------------------------------
// How a person's dates and times read (2026-11-07, the founder; users.date_prefs_json, migration 0109, changed under Profile)
// ---------------------------------------------------------------------------

/** The keys are stored; what each one looks like is `formatDate`, so a form's option reads as an example of now. */
export const DATE_FORMATS = ['d_mon_yy', 'd_mon_yyyy', 'dd_mm_yy', 'yyyy_mm_dd'] as const;
export type DateFormat = (typeof DATE_FORMATS)[number];
export const TIME_FORMATS = ['12h', '24h'] as const;
export type TimeFormat = (typeof TIME_FORMATS)[number];
export interface DatePrefs {
  date: DateFormat;
  time: TimeFormat;
}
/** The founder's: "7 Nov 26, 4:17am". */
export const DATE_PREFS_DEFAULT: DatePrefs = { date: 'd_mon_yy', time: '12h' };

const isDateFormat = (v: unknown): v is DateFormat => (DATE_FORMATS as readonly unknown[]).includes(v);
const isTimeFormat = (v: unknown): v is TimeFormat => (TIME_FORMATS as readonly unknown[]).includes(v);

/** The one reader of a person's format: a JSON string or an object; anything missing or unknown takes the default. */
export function parseDatePrefs(raw: unknown): DatePrefs {
  let v = raw;
  if (typeof v === 'string') {
    try {
      v = JSON.parse(v);
    } catch {
      v = null;
    }
  }
  const o = v && typeof v === 'object' ? (v as { date?: unknown; time?: unknown }) : {};
  return { date: isDateFormat(o.date) ? o.date : DATE_PREFS_DEFAULT.date, time: isTimeFormat(o.time) ? o.time : DATE_PREFS_DEFAULT.time };
}

/** What is wrong with a format sent to `PATCH /me`, in plain words; null when it is fine. Either part may be left out. */
export function datePrefsProblem(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return 'pick a date format and a time format';
  const o = raw as { date?: unknown; time?: unknown };
  if (o.date !== undefined && !isDateFormat(o.date)) return 'that date format is not one of the choices';
  if (o.time !== undefined && !isTimeFormat(o.time)) return 'that time format is not one of the choices';
  return null;
}

const MONTH_SHORT: string[] = [];
const monthShort = (month: number): string => (MONTH_SHORT[month] ??= new Date(Date.UTC(2000, month - 1, 1)).toLocaleDateString(LOCALE, { month: 'short', timeZone: 'UTC' }));
const two = (n: number): string => String(n).padStart(2, '0');

interface ClockParts {
  year: number;
  month: number;
  day: number;
  /** 0 to 23. */
  hour: number;
  minute: number;
  second: number;
}
/** An instant on a zone's clock (an unknown zone reads as DEFAULT_ZONE). A bare day (YYYY-MM-DD) is that day wherever the person is, never moved by a zone. Null when it is not a date. */
function clockParts(v: string | Date, zone: string): ClockParts | null {
  if (typeof v === 'string' && DATE_PATTERN.test(v)) return { year: Number(v.slice(0, 4)), month: Number(v.slice(5, 7)), day: Number(v.slice(8, 10)), hour: 0, minute: 0, second: 0 };
  const at = typeof v === 'string' ? new Date(v) : v;
  if (Number.isNaN(at.getTime())) return null;
  const fmt = zoneFormat(zone) ?? zoneFormat(DEFAULT_ZONE);
  if (!fmt) return null;
  const parts = fmt.formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour') % 24, minute: get('minute'), second: get('second') };
}

function dateWords(p: ClockParts, format: DateFormat): string {
  if (format === 'd_mon_yyyy') return `${p.day} ${monthShort(p.month)} ${p.year}`;
  if (format === 'dd_mm_yy') return `${two(p.day)}/${two(p.month)}/${two(p.year % 100)}`;
  if (format === 'yyyy_mm_dd') return `${p.year}-${two(p.month)}-${two(p.day)}`;
  return `${p.day} ${monthShort(p.month)} ${two(p.year % 100)}`;
}
function clockWords(hour: number, minute: number, second: number | null, format: TimeFormat): string {
  const tail = `${two(minute)}${second === null ? '' : `:${two(second)}`}`;
  if (format === '24h') return `${two(hour)}:${tail}`;
  return `${hour % 12 === 0 ? 12 : hour % 12}:${tail}${hour < 12 ? 'am' : 'pm'}`;
}

/** "7 Nov 26", "7 Nov 2026", "07/11/26" or "2026-11-07": the day of an instant in a zone, or a bare day as it is. Empty when it is not a date. */
export function formatDate(v: string | Date, prefs: DatePrefs, zone: string): string {
  const p = clockParts(v, zone);
  return p ? dateWords(p, prefs.date) : '';
}
/** "4:17am" or "04:17", "4:17:05am" with seconds: the time of an instant in a zone. Empty when it is not a date. */
export function formatClock(v: string | Date, prefs: DatePrefs, zone: string, withSeconds = false): string {
  const p = clockParts(v, zone);
  return p ? clockWords(p.hour, p.minute, withSeconds ? p.second : null, prefs.time) : '';
}
/** "7 Nov 26, 4:17am": a moment, in full. Empty when it is not a date. */
export function formatStamp(v: string | Date, prefs: DatePrefs, zone: string): string {
  const p = clockParts(v, zone);
  return p ? `${dateWords(p, prefs.date)}, ${clockWords(p.hour, p.minute, null, prefs.time)}` : '';
}
/** A minute of the day with no zone in it (450, a task's time, a block's slot) as "7:30am" or "07:30". */
export function formatMinute(minute: number, prefs: DatePrefs): string {
  const m = ((Math.round(minute) % 1440) + 1440) % 1440;
  return clockWords(Math.floor(m / 60), m % 60, null, prefs.time);
}
