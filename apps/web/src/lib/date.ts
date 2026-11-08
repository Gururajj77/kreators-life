import { DATE_PREFS_DEFAULT, DEFAULT_ZONE, LOCALE, formatClock, formatDate, formatMinute, formatStamp, parseDatePrefs, type DatePrefs } from '@kreators/shared';

const pad = (n: number) => String(n).padStart(2, '0');

// Whose clock the screen reads (2026-11-07, the founder). Every screen time goes through this file, and this file follows the person: their
// zone (users.timezone) and their date and time format (users.date_prefs_json), both changed under Profile. `main.tsx` calls
// `setDateDisplay` whenever the account lands. A visitor reads India's clock and the default format (LOCALE, DEFAULT_ZONE).
// A copy stays on the device so a reload, a whole-page chat and the public site read the right clock from the first paint; a sign-out
// clears it. The account is what counts: this is only ever a copy of it. Dates sent to the server never come from here but for the three
// device-day helpers below, which stay the device's: the API treats the device's day as the person's "today".
const COPY_KEY = 'kreators.dateDisplay';
let zone: string = DEFAULT_ZONE;
let prefs: DatePrefs = DATE_PREFS_DEFAULT;

/** A zone the platform can read, else the default, so a bad value can never stop a page drawing. */
function usableZone(z: unknown): string {
  if (typeof z !== 'string' || !z) return DEFAULT_ZONE;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: z });
    return z;
  } catch {
    return DEFAULT_ZONE;
  }
}

try {
  const kept = JSON.parse(localStorage.getItem(COPY_KEY) ?? 'null') as { zone?: unknown; prefs?: unknown } | null;
  if (kept) {
    zone = usableZone(kept.zone);
    prefs = parseDatePrefs(kept.prefs);
  }
} catch {
  // A private window or cleared storage: the default clock until the account lands.
}

/** Follow the signed-in account, or go back to the visitor's clock with null. */
export function setDateDisplay(account: { timezone?: string; datePrefs?: DatePrefs } | null): void {
  const nextZone = usableZone(account?.timezone);
  const nextPrefs = parseDatePrefs(account?.datePrefs);
  if (account && nextZone === zone && nextPrefs.date === prefs.date && nextPrefs.time === prefs.time) return;
  zone = nextZone;
  prefs = nextPrefs;
  try {
    if (account) localStorage.setItem(COPY_KEY, JSON.stringify({ zone, prefs }));
    else localStorage.removeItem(COPY_KEY);
  } catch {
    // The copy is a convenience; the screen already follows the new clock.
  }
}

/** The zone times on screen are in, for a line that names it. */
export const displayZone = (): string => zone;
/** A zone as words: "America/New_York" reads "America/New York". */
export const zoneName = (z: string): string => z.replace(/_/g, ' ');

/** Local calendar date as YYYY-MM-DD. The API treats this as the user's "today". */
export function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const BARE_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Any shape of a day, in LOCALE and the person's zone. A bare day (YYYY-MM-DD) is that calendar day wherever they are, never moved by a
 * zone. What is not a date gives nothing, never "Invalid Date".
 */
export function inZone(v: string, shape: Intl.DateTimeFormatOptions): string {
  const bare = BARE_DAY.test(v);
  const at = new Date(bare ? `${v}T00:00:00Z` : v);
  if (Number.isNaN(at.getTime())) return '';
  return at.toLocaleDateString(LOCALE, { ...shape, timeZone: bare ? 'UTC' : zone });
}

/** "Saturday, 24 Oct" for a bare day or an instant. */
export const prettyDate = (date: string): string => inZone(date, { weekday: 'long', month: 'short', day: 'numeric' });

export function dueLabel(due: string | null, today: string): { text: string; overdue: boolean } | null {
  if (!due) return null;
  if (due === today) return { text: 'Today', overdue: false };
  if (due < today) return { text: 'Overdue', overdue: true };
  return { text: inZone(due, { month: 'short', day: 'numeric' }), overdue: false };
}

/** The last n local calendar dates, oldest first, ending today. */
export function lastDays(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i -= 1) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() - i);
    out.push(`${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`);
  }
  return out;
}

// One set of formatters (they were copied into ~25 screens). What shows a year or a clock takes the person's format; what shows only a day
// and a month or a weekday keeps its shape. Printed paper (invoices, agreements, documents, the month sheet) keeps its own formats and
// does not come through here.

/** "24 Oct" for an instant or a bare day. */
export const shortDay = (v: string): string => inZone(v, { day: 'numeric', month: 'short' });
/** "24 Oct" for an instant or a bare day. */
export const shortDate = shortDay;
/** "24 Oct 26", in the person's date format, for an instant or a bare day. */
export const longDate = (v: string): string => formatDate(v, prefs, zone);
/** "Sat, 24 Oct" for an instant or a bare day. */
export const dayLabel = (v: string): string => inZone(v, { weekday: 'short', day: 'numeric', month: 'short' });
/** "Saturday, 24 October" for an instant or a bare day. */
export const fullDay = (v: string): string => inZone(v, { weekday: 'long', day: 'numeric', month: 'long' });
/** "Oct 2026" (or "October 2026") for an instant or a bare day. */
export const monthYear = (v: string, month: 'short' | 'long' = 'short'): string => inZone(v, { month, year: 'numeric' });
/** "6:30pm" or "18:30", in the person's zone and time format. */
export const clockTime = (iso: string): string => formatClock(iso, prefs, zone);
/** "6:30:05pm": a line in a log. */
export const clockSeconds = (iso: string): string => formatClock(iso, prefs, zone, true);
/** "24 Oct, 6:30pm": a moment something happened. */
export const dateTime = (iso: string): string => {
  const clock = clockTime(iso);
  return clock && `${shortDay(iso)}, ${clock}`;
};
/** "Sat, 24 Oct, 6:30pm": when an event starts. */
export const eventTime = (iso: string): string => {
  const clock = clockTime(iso);
  return clock && `${dayLabel(iso)}, ${clock}`;
};
/** "24 Oct 26, 6:30pm": a moment in full, in the person's date and time format (an inbox note). */
export const stamp = (iso: string): string => formatStamp(iso, prefs, zone);
/** The same in a zone of its own, for a moment that belongs to a place (where someone was born). */
export const stampIn = (iso: string, inThisZone: string): string => formatStamp(iso, prefs, inThisZone);
/** "Sat" (or "Saturday", "S") for an instant or a bare day. */
export const weekday = (v: string, style: 'long' | 'short' | 'narrow' = 'short'): string => inZone(v, { weekday: style });

// A clock time with no day and no zone in it (a task's time, a block's slot, a reminder): only the time format applies.

/** 450 as "7:30am" or "07:30". */
export const clockAt = (minute: number): string => formatMinute(minute, prefs);
/** "07:30" as "7:30am" or "07:30"; anything else stays as it is. */
export function clockOf(hhmm: string): string {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  return m ? clockAt(Number(m[1]) * 60 + Number(m[2])) : hhmm;
}
/** "10:00am to 1:00pm": a block's slot. */
export const slotRange = (s: { start: number; end: number }): string => `${clockAt(s.start)} to ${clockAt(s.end)}`;

/** A Date as the value of an <input type="datetime-local">: "2026-10-24T18:30" in the device's own zone. */
export const localDateTimeValue = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
