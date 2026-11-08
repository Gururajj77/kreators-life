import { DATE_FORMATS, TIME_FORMATS, TIMEZONES, formatClock, formatDate, formatStamp, zoneOffsetMinutes, type DateFormat, type DatePrefs, type TimeFormat } from '@kreators/shared';
import { zoneName } from '../lib/date';
import { FIELD } from '../lib/ui';

/** What a form sends: nothing when the format is as saved. */
export const datePrefsChange = (saved: DatePrefs, date: DateFormat, time: TimeFormat): { datePrefs?: DatePrefs } => (date === saved.date && time === saved.time ? {} : { datePrefs: { date, time } });

/** The device's own zone, to offer when the account is on another; empty where the browser will not say. */
function deviceZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    return '';
  }
}

/**
 * Whether two zones read the same clock all year, on either side of a clock change. Two names can be one zone (a browser in India says
 * Asia/Calcutta), so names are not compared.
 */
function sameClock(a: string, b: string, now: Date): boolean {
  return [0, 6].every((month) => {
    const at = new Date(Date.UTC(now.getUTCFullYear(), month, 15));
    return zoneOffsetMinutes(a, at) === zoneOffsetMinutes(b, at);
  });
}

/**
 * Where every time on the person's screens comes from (lib/date.ts): the zone, which also sets when their reminders arrive, and how a date
 * and a time read. Each format's option is now in the picked zone, so the choice is its own example. It sits in the Profile tab's form, which
 * everyone can reach, and in the Public page's, where the zone always was; a form saves it with its own Save. Only what changed goes out as
 * `datePrefs`, so an ordinary save never spends the `prefs` limit (`datePrefsChange`).
 */
export function DatesAndTimes({ timezone, onZone, dateFormat, onDate, timeFormat, onTime }: { timezone: string; onZone: (z: string) => void; dateFormat: DateFormat; onDate: (f: DateFormat) => void; timeFormat: TimeFormat; onTime: (f: TimeFormat) => void }) {
  const now = new Date();
  const prefs = { date: dateFormat, time: timeFormat };
  const device = deviceZone();
  return (
    <fieldset id="dates" className="m-0 scroll-mt-[64px] border-0 p-0">
      <legend className="text-headline">Dates and times</legend>
      <div className="mt-xs grid gap-sm">
      <label className="block">
        <span className="block text-subhead font-semibold">Time zone</span>
        <select value={timezone} onChange={(e) => onZone(e.target.value)} className={FIELD}>
          {(TIMEZONES.includes(timezone as (typeof TIMEZONES)[number]) ? TIMEZONES : [timezone, ...TIMEZONES]).map((z) => (
            <option key={z} value={z}>
              {zoneName(z)}
            </option>
          ))}
        </select>
        <span className="mt-xs block text-caption text-ink-soft">Times in the app show in this zone, and your reminders arrive by it. Your availability and bookings are written in it too. Buyers see the same slots in their own.</span>
      </label>
      {device && !sameClock(device, timezone, now) && (
        <p className="m-0 flex flex-wrap items-center justify-between gap-x-sm text-caption text-ink-soft">
          <span>This device is on {zoneName(device)}.</span>
          <button type="button" onClick={() => onZone(device)} className="min-h-[44px] font-semibold text-ink underline underline-offset-4">
            Use this zone
          </button>
        </p>
      )}
      <div className="grid grid-cols-2 gap-xs">
        <label className="block min-w-0">
          <span className="block text-subhead font-semibold">Date format</span>
          <select value={dateFormat} onChange={(e) => onDate(e.target.value as DateFormat)} className={FIELD}>
            {DATE_FORMATS.map((f) => (
              <option key={f} value={f}>
                {formatDate(now, { ...prefs, date: f }, timezone)}
              </option>
            ))}
          </select>
        </label>
        <label className="block min-w-0">
          <span className="block text-subhead font-semibold">Time format</span>
          <select value={timeFormat} onChange={(e) => onTime(e.target.value as TimeFormat)} className={FIELD}>
            {TIME_FORMATS.map((f) => (
              <option key={f} value={f}>
                {formatClock(now, { ...prefs, time: f }, timezone)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="m-0 text-caption text-ink-soft" aria-live="polite">Right now that reads {formatStamp(now, prefs, timezone)}.</p>
      </div>
    </fieldset>
  );
}
