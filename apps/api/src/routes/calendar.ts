import { Hono } from 'hono';
import { buildCalendar, occurrencesBetween, parseRepeat, PERIOD_META, type IcsTask, type PeriodKind, type Priority, type RelationshipKey } from '@kreators/shared';
import type { AppEnv } from '../env';
import { nowIso, randomCode, shiftDate } from '../db';

/**
 * A private calendar link. The person switches it on and gets one secret address to subscribe to in Google, Apple or Outlook Calendar, and it
 * shows their open tasks that have a day (and a time, when they have one). It carries only a title, a pillar and a priority: never a note,
 * the journal or anything from a tracker. A fresh link closes the old one, and switching it off closes it. Owner only.
 */
export const calendarMe = new Hono<AppEnv>();
/** What a calendar app fetches. The token is the only key, so it is long and is never listed anywhere. Mounted at /public/calendar. */
export const calendarPublic = new Hono<AppEnv>();

calendarMe.get('/', async (c) => {
  const row = await c.env.DB.prepare('SELECT token, enabled FROM calendar_feeds WHERE user_id = ?').bind(c.get('user').id).first<{ token: string; enabled: number }>();
  return c.json({ enabled: row?.enabled === 1, token: row?.enabled === 1 ? row.token : null });
});

calendarMe.post('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<{ on?: boolean; fresh?: boolean }>().catch(() => ({}) as { on?: boolean; fresh?: boolean });
  const prev = await db.prepare('SELECT token, enabled FROM calendar_feeds WHERE user_id = ?').bind(user.id).first<{ token: string; enabled: number }>();
  const on = body.on !== false;
  const token = !prev || body.fresh ? randomCode(24) : prev.token;
  await db
    .prepare('INSERT INTO calendar_feeds (user_id, token, enabled, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET token = excluded.token, enabled = excluded.enabled')
    .bind(user.id, token, on ? 1 : 0, nowIso())
    .run();
  return c.json({ enabled: on, token: on ? token : null });
});

calendarPublic.get('/:file', async (c) => {
  const db = c.env.DB;
  const token = c.req.param('file').replace(/\.ics$/i, '');
  if (!/^[A-Z2-9]{24}$/.test(token)) return c.text('No calendar at this link.', 404);
  const owner = await db
    .prepare('SELECT u.id AS id, u.timezone AS timezone FROM calendar_feeds f JOIN users u ON u.id = f.user_id WHERE f.token = ? AND f.enabled = 1')
    .bind(token)
    .first<{ id: string; timezone: string | null }>();
  if (!owner) return c.text('No calendar at this link.', 404);
  const today = new Date().toISOString().slice(0, 10);
  const rows = await db
    .prepare(
      `SELECT id, title, relationship, COALESCE(do_date, due_date) AS day, due_time, estimate_min, priority FROM nodes
       WHERE user_id = ? AND kind = 'task' AND status = 'active' AND COALESCE(do_date, due_date) >= ? AND COALESCE(do_date, due_date) <= ?
       ORDER BY COALESCE(do_date, due_date), due_time LIMIT 500`,
    )
    .bind(owner.id, shiftDate(today, -14), shiftDate(today, 180))
    .all<{ id: string; title: string; relationship: RelationshipKey; day: string; due_time: string | null; estimate_min: number | null; priority: number | null }>();
  // The reviews the person scheduled show too, on their days and at their times, so a calendar says when to look back.
  const scheduled = await db.prepare('SELECT id, kind, name, anchor, time, repeat_json FROM review_schedules WHERE user_id = ? AND enabled = 1 LIMIT 20').bind(owner.id).all<{ id: string; kind: PeriodKind; name: string; anchor: string; time: string; repeat_json: string | null }>();
  const reviews: IcsTask[] = scheduled.results.flatMap((r) =>
    occurrencesBetween(r.anchor, parseRepeat(r.repeat_json), shiftDate(today, -14), shiftDate(today, 180), 80).map((day) => ({ id: `review-${r.id}-${day}`, title: r.name || PERIOD_META[r.kind].name, relationship: null, category: 'Reviews', day, dueTime: r.time, estimateMin: 30, priority: null })),
  );
  const tasks: IcsTask[] = rows.results.map((r) => ({ id: r.id, title: r.title, relationship: r.relationship, day: r.day, dueTime: r.due_time, estimateMin: r.estimate_min, priority: (r.priority as Priority | null) ?? null }));
  return new Response(buildCalendar([...tasks, ...reviews], owner.timezone || 'Asia/Kolkata', new Date()), {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'private, max-age=300', 'Content-Disposition': 'inline; filename="kreators-tasks.ics"' },
  });
});
