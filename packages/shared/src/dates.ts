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

/** Minutes the zone is ahead of UTC at a given instant, via the platform's own tables. */
export function zoneOffsetMinutes(zone: string, at: Date): number {
  try {
    const fmt = zoneFormat(zone);
    if (!fmt) return 0;
    const parts = fmt.formatToParts(at);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
    const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
    return Math.round((asUtc - at.getTime()) / 60_000);
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

/** Free slot starts, as ISO strings, for one day. Pure, so it is tested without a server. */
export function slotsFor(input: SlotInput): string[] {
  const { date, zone, durationMin, bufferMin } = input;
  const step = Math.max(5, durationMin);
  const dayStart = zonedToUtc(date, 0, zone);
  const weekday = new Date(dayStart.getTime() + 12 * 3600_000).getUTCDay();
  const localWeekday = (() => {
    try {
      // en-US on purpose: these parts are parsed for zone maths, never shown.
      const w = new Intl.DateTimeFormat('en-US', { timeZone: zone, weekday: 'short' }).format(new Date(dayStart.getTime() + 12 * 3600_000));
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
