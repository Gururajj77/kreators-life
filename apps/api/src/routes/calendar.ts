import { Hono } from 'hono';
import { buildCalendar, CIRCLE_MINUTES, icsTaskTitle, occurrencesBetween, retainerCycles, parseRepeat, PERIOD_META, type IcsTask, type PeriodKind, type Priority, type RelationshipKey } from '@kreators/shared';
import type { AppEnv } from '../env';
import { getUser, nowIso, randomCode, shiftDate } from '../db';
import { resolveAccess } from '../access';

/**
 * A private calendar link. The person switches it on and gets one secret address to subscribe to in Google, Apple or Outlook Calendar, and it
 * shows their open tasks that have a day (and a time, when they have one). It carries only a title, a pillar and a priority: never a note,
 * the journal or anything from a tracker. A fresh link closes the old one, and switching it off closes it. Owner only.
 * While Agency is on for the person (P227, 2026-11-03), the days their pieces are due and go live show too, as a title and the
 * client's name only: never a fee, a note, the retainer or what a client wrote. Switching Agency off takes them off the calendar.
 * Also (2026-11-03): sent invoices on their due days (number and client, never the amount), the days each month of a running retainer begins, and the
 * Party events, runs and circle tables the person signed up for (title and time, category Events).
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
      `SELECT id, title, relationship, COALESCE(do_date, due_date) AS day, due_time, estimate_min, priority, for_review, remind FROM nodes
       WHERE user_id = ? AND kind = 'task' AND status = 'active' AND COALESCE(do_date, due_date) >= ? AND COALESCE(do_date, due_date) <= ?
       ORDER BY COALESCE(do_date, due_date), due_time LIMIT 500`,
    )
    .bind(owner.id, shiftDate(today, -14), shiftDate(today, 180))
    .all<{ id: string; title: string; relationship: RelationshipKey; day: string; due_time: string | null; estimate_min: number | null; priority: number | null; for_review: number | null; remind: number | null }>();
  // The reviews the person scheduled show too, on their days and at their times, so a calendar says when to look back.
  const scheduled = await db.prepare('SELECT id, kind, name, anchor, time, repeat_json FROM review_schedules WHERE user_id = ? AND enabled = 1 LIMIT 20').bind(owner.id).all<{ id: string; kind: PeriodKind; name: string; anchor: string; time: string; repeat_json: string | null }>();
  const reviews: IcsTask[] = scheduled.results.flatMap((r) =>
    occurrencesBetween(r.anchor, parseRepeat(r.repeat_json), shiftDate(today, -14), shiftDate(today, 180), 80).map((day) => ({ id: `review-${r.id}-${day}`, title: r.name || PERIOD_META[r.kind].name, relationship: null, category: 'Reviews', day, dueTime: r.time, estimateMin: 30, priority: null })),
  );
  // A task carries the same tags here as on Daily: brought to a review shows in its title, and a Remember task says so in its description
  // (its time, when it has one, is the time its inbox note goes out, so the calendar and the inbox agree).
  const tasks: IcsTask[] = rows.results.map((r) => ({
    id: r.id,
    title: icsTaskTitle(r.title, r.for_review === 1),
    relationship: r.relationship,
    day: r.day,
    dueTime: r.due_time,
    estimateMin: r.estimate_min,
    priority: (r.priority as Priority | null) ?? null,
    ...(r.remind === 1 ? { description: `Tagged Remember: a note lands in your inbox ${r.due_time ? `at ${r.due_time}` : 'at 09:00'} that day.` } : {}),
  }));
  // Agency pieces, only while Agency is available and on for the owner (the same rule as the module gate on its routes).
  const ownerRow = await getUser(db, owner.id);
  const agencyOn = ownerRow ? (await resolveAccess(db, ownerRow)).access.agency?.on === true : false;
  const pieces = agencyOn
    ? await db
        .prepare(
          `SELECT i.id, i.title, i.due_date, i.publish_date, k.name AS client FROM agency_items i JOIN agency_clients k ON k.id = i.client_id AND k.user_id = i.user_id
           WHERE i.user_id = ?1 AND i.stage != 'published' AND ((i.due_date >= ?2 AND i.due_date <= ?3) OR (i.publish_date >= ?2 AND i.publish_date <= ?3))
           ORDER BY COALESCE(i.due_date, i.publish_date) LIMIT 300`,
        )
        .bind(owner.id, shiftDate(today, -14), shiftDate(today, 180))
        .all<{ id: string; title: string; due_date: string | null; publish_date: string | null; client: string }>()
    : { results: [] };
  const agency: IcsTask[] = pieces.results.flatMap((r) => [
    ...(r.due_date ? [{ id: `agency-due-${r.id}`, title: `Due: ${r.title}, ${r.client}`, relationship: null, category: 'Agency', day: r.due_date, dueTime: null, estimateMin: null, priority: null }] : []),
    ...(r.publish_date ? [{ id: `agency-live-${r.id}`, title: `Goes live: ${r.title}, ${r.client}`, relationship: null, category: 'Agency', day: r.publish_date, dueTime: null, estimateMin: null, priority: null }] : []),
  ]);
  // Invoices sent and not paid, on their due days, and the days a retainer's months begin. Number, client and the word only: never an amount.
  const [invoiceRows, cycleRows, eventRows] = await Promise.all([
    agencyOn
      ? db
          .prepare(
            `SELECT i.id, i.number, i.due_date, COALESCE(k.name, i.client_name) AS client FROM invoices i LEFT JOIN agency_clients k ON k.id = i.agency_client_id AND k.user_id = i.user_id
             WHERE i.user_id = ?1 AND i.status = 'sent' AND i.agency_client_id IS NOT NULL AND i.due_date >= ?2 AND i.due_date <= ?3 ORDER BY i.due_date LIMIT 200`,
          )
          .bind(owner.id, shiftDate(today, -14), shiftDate(today, 180))
          .all<{ id: string; number: string; due_date: string; client: string }>()
      : Promise.resolve({ results: [] as { id: string; number: string; due_date: string; client: string }[] }),
    agencyOn
      ? db
          .prepare(
            `SELECT r.id, r.start_day, r.months, k.name AS client FROM agency_retainers r JOIN agency_clients k ON k.id = r.client_id AND k.user_id = r.user_id
             WHERE r.user_id = ?1 AND r.status = 'active' AND r.start_day IS NOT NULL AND r.months > 0 LIMIT 50`,
          )
          .bind(owner.id)
          .all<{ id: string; start_day: string; months: number; client: string }>()
      : Promise.resolve({ results: [] as { id: string; start_day: string; months: number; client: string }[] }),
    // What the person signed up for: Party events they are registered for, runs of their clubs, circle tables they are seated at. Title and time only.
    db
      .prepare(
        `SELECT kind, id, title, starts_at, ends_at FROM (
           SELECT 'event' AS kind, e.id, e.title, e.starts_at, e.ends_at FROM events e JOIN event_registrations r ON r.event_id = e.id
             WHERE r.user_id = ?1 AND r.status IN ('registered', 'attended') AND e.status = 'published' AND e.starts_at >= ?2 AND e.starts_at <= ?3
           UNION ALL SELECT 'circle', g.id, e.title, e.starts_at, NULL FROM circle_events e JOIN circle_groups g ON g.event_id = e.id JOIN circle_members m ON m.group_id = g.id
             WHERE m.user_id = ?1 AND e.status != 'cancelled' AND e.starts_at >= ?2 AND e.starts_at <= ?3
           UNION ALL SELECT 'run', r.id, r.title, r.starts_at, r.ends_at FROM runs r JOIN run_members m ON m.club_id = r.club_id AND m.status = 'member' AND m.user_id = ?1
             WHERE r.status = 'published' AND r.starts_at >= ?2 AND r.starts_at <= ?3
         ) ORDER BY starts_at LIMIT 200`,
      )
      .bind(owner.id, `${shiftDate(today, -14)}T00:00:00.000Z`, `${shiftDate(today, 181)}T00:00:00.000Z`)
      .all<{ kind: 'event' | 'circle' | 'run'; id: string; title: string; starts_at: string; ends_at: string | null }>(),
  ]);
  const invoiceDays: IcsTask[] = invoiceRows.results.map((r) => ({ id: `invoice-due-${r.id}`, title: `Invoice ${r.number} due, ${r.client}`, relationship: null, category: 'Agency', day: r.due_date, dueTime: null, estimateMin: null, priority: null }));
  // Every month of a running retainer, made or still to come, on the day the repeat rule gives it (the same rule the cron makes them by).
  const cycleDays: IcsTask[] = cycleRows.results.flatMap((r) =>
    retainerCycles(r.start_day, r.months)
      .filter((m) => m.day >= shiftDate(today, -14) && m.day <= shiftDate(today, 180))
      .map((m) => ({ id: `agency-month-${r.id}-${m.n}`, title: `Month ${m.n} begins, ${r.client}`, relationship: null, category: 'Agency', day: m.day, dueTime: null, estimateMin: null, priority: null })),
  );
  const events: IcsTask[] = eventRows.results.map((r) => ({
    id: `${r.kind}-${r.id}-${r.starts_at.slice(0, 10)}`,
    title: r.title,
    relationship: null,
    category: 'Events',
    day: r.starts_at.slice(0, 10),
    dueTime: null,
    estimateMin: r.kind === 'circle' ? CIRCLE_MINUTES : 60,
    priority: null,
    startsAt: r.starts_at,
    ...(r.ends_at ? { endsAt: r.ends_at } : {}),
  }));
  return new Response(buildCalendar([...tasks, ...reviews, ...agency, ...invoiceDays, ...cycleDays, ...events], owner.timezone || 'Asia/Kolkata', new Date()), {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'private, max-age=300', 'Content-Disposition': 'inline; filename="kreators-tasks.ics"' },
  });
});
