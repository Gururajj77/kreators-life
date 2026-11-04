import { LOCALE } from '@kreators/shared';

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar date as YYYY-MM-DD. The API treats this as the user's "today". */
export function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function prettyDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y ?? 2000, (m ?? 1) - 1, d ?? 1);
  return dt.toLocaleDateString(LOCALE, { weekday: 'long', month: 'short', day: 'numeric' });
}

export function dueLabel(due: string | null, today: string): { text: string; overdue: boolean } | null {
  if (!due) return null;
  if (due === today) return { text: 'Today', overdue: false };
  if (due < today) return { text: 'Overdue', overdue: true };
  const [y, m, d] = due.split('-').map(Number);
  const dt = new Date(y ?? 2000, (m ?? 1) - 1, d ?? 1);
  return { text: dt.toLocaleDateString(LOCALE, { month: 'short', day: 'numeric' }), overdue: false };
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

/** "24 Oct" */
export function shortDay(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' });
}

// One set of formatters, all in LOCALE (Indian English: 24 Oct 2026, 24/10/2026); the zone stays the device's, the person's own clock.
// (they were copied into ~25 screens). A bare day (YYYY-MM-DD) is read as local midnight through `toDate`, never as
// UTC midnight, so it never shows as the day before west of UTC.

/** A Date from an ISO instant or a bare YYYY-MM-DD day (local midnight). */
export function toDate(v: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00`) : new Date(v);
}
/** "24 Oct" for an instant or a bare day. */
export const shortDate = (v: string) => toDate(v).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' });
/** "24 Oct 2026" for an instant or a bare day. */
export const longDate = (v: string) => toDate(v).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' });
/** "Sat 24 Oct" for an instant or a bare day. */
export const dayLabel = (v: string) => toDate(v).toLocaleDateString(LOCALE, { weekday: 'short', day: 'numeric', month: 'short' });
/** "24 Oct, 6:30 pm": a moment something happened. */
export const dateTime = (iso: string) => toDate(iso).toLocaleString(LOCALE, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
/** "Sat, 24 Oct, 6:30 pm": when an event starts. */
export const eventTime = (iso: string) => toDate(iso).toLocaleString(LOCALE, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
/** "6:30 pm". */
export const clockTime = (iso: string) => toDate(iso).toLocaleTimeString(LOCALE, { hour: 'numeric', minute: '2-digit' });
/** "Sat" (or "Saturday", "S") for an instant or a bare day. */
export const weekday = (v: string, style: 'long' | 'short' | 'narrow' = 'short') => toDate(v).toLocaleDateString(LOCALE, { weekday: style });
/** "24/10/2026" for an instant or a bare day. */
export const numericDate = (v: string) => toDate(v).toLocaleDateString(LOCALE, { day: '2-digit', month: '2-digit', year: 'numeric' });
/** A Date as the value of an <input type="datetime-local">: "2026-10-24T18:30" in the device's own zone. */
export const localDateTimeValue = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
