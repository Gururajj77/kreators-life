import { Hono } from 'hono';
import { ACTIVITY_DAYS, activityRange, DEFAULT_ZONE, type ActivityDay, type ActivityYear } from '@kreators/shared';
import type { AppEnv } from '../env';
import { DATE_RE, shiftDate } from '../db';

/**
 * "Your year" on Profile: the xp earned and the person's own tasks ticked on each of the last 53 weeks of days, ending on the day their
 * device sent. Owner only and read only: counts, never a source, a title, the journal or a tracker. The rows are summed in SQL into
 * quarter-hour buckets (every zone's offset is a whole number of quarter hours, India's +5:30 included) and folded into the person's own
 * calendar days here, in their zone, so a tick at 00:10 in Kolkata lands on that day and not on the UTC day before.
 */
export const activity = new Hono<AppEnv>();

/** One formatter for the person's zone (India's when the zone is missing or not one); same answer as `dayInZone` in db.ts, made once a request. */
function dayFormatter(zone: string | null | undefined): Intl.DateTimeFormat {
  const opts = { year: 'numeric', month: '2-digit', day: '2-digit' } as const;
  try {
    return new Intl.DateTimeFormat('en-CA', { ...opts, timeZone: zone || DEFAULT_ZONE });
  } catch {
    return new Intl.DateTimeFormat('en-CA', { ...opts, timeZone: DEFAULT_ZONE });
  }
}

type Bucket = { h: string; q: number; n: number };

activity.get('/', async (c) => {
  const day = c.req.query('day') ?? '';
  if (!DATE_RE.test(day)) return c.json({ error: 'Send the day as YYYY-MM-DD.' }, 400);
  const db = c.env.DB;
  const user = c.get('user');
  const days = activityRange(day, ACTIVITY_DAYS);
  // A day starts as early as 14 hours before UTC's, so read from one UTC day before the first.
  const since = `${shiftDate(days[0]!, -1)}T00:00:00`;
  const [xp, ticks] = await Promise.all([
    db
      .prepare('SELECT substr(created_at, 1, 13) AS h, CAST(substr(created_at, 15, 2) AS INTEGER) / 15 AS q, SUM(amount) AS n FROM xp_events WHERE user_id = ? AND created_at >= ? GROUP BY h, q')
      .bind(user.id, since)
      .all<Bucket>(),
    db
      .prepare("SELECT substr(completed_at, 1, 13) AS h, CAST(substr(completed_at, 15, 2) AS INTEGER) / 15 AS q, COUNT(*) AS n FROM nodes WHERE user_id = ? AND kind = 'task' AND status = 'done' AND completed_at >= ? GROUP BY h, q")
      .bind(user.id, since)
      .all<Bucket>(),
  ]);

  const fmt = dayFormatter(user.timezone);
  const byDay = new Map<string, ActivityDay>(days.map((d) => [d, { day: d, xp: 0, ticks: 0 }]));
  const fold = (rows: Bucket[], key: 'xp' | 'ticks') => {
    for (const r of rows) {
      // 'YYYY-MM-DDTHH' or 'YYYY-MM-DD HH' (an older row), plus the quarter.
      const at = Date.parse(`${r.h.slice(0, 10)}T${r.h.slice(11, 13)}:${String((Number(r.q) || 0) * 15).padStart(2, '0')}:00Z`);
      if (!Number.isFinite(at)) continue;
      const slot = byDay.get(fmt.format(new Date(at)));
      if (slot) slot[key] += Math.round(Number(r.n) || 0);
    }
  };
  fold(xp.results ?? [], 'xp');
  fold(ticks.results ?? [], 'ticks');

  // Xp taken back (an untick) can leave a day below zero; the grid shows it as an empty day.
  const list = days.map((d) => { const v = byDay.get(d)!; return { ...v, xp: Math.max(0, v.xp) }; });
  const answer: ActivityYear = {
    end: day,
    days: list,
    totals: { xp: list.reduce((s, d) => s + d.xp, 0), ticks: list.reduce((s, d) => s + d.ticks, 0) },
    max: { xp: list.reduce((m, d) => Math.max(m, d.xp), 0), ticks: list.reduce((m, d) => Math.max(m, d.ticks), 0) },
  };
  return c.json(answer);
});
