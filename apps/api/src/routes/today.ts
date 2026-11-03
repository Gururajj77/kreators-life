import { Hono } from 'hono';
import { MONTH_RE, MONTH_TASKS_MAX, monthShift, repeatLabel, type MonthProject, type MonthTask, type TodayMonthResponse, PLAN_DAY_MINUTES, planWeek, type PlanTask, MAX_NOT_TO_DO, NOT_TO_DO_TITLE_MAX, notToDoStreak, notToDoWeek, POINTS, RELATIONSHIPS, sparkFor, XP, zonedToUtc, type CheckinResponse, type NotToDo, type NotToDoStatus, type RelationshipKey, TODAY_AGENCY_MAX, type TodayAgency, type TodayEvent, type TodayResponse } from '@kreators/shared';
import type { AppEnv } from '../env';
import { resolveAccess } from '../access';
import { DATE_RE, dateNearToday, getUser, newId, notify, nowIso, shiftDate, toNode, type NodeRow, taskGate, withSubtasks } from '../db';

export const today = new Hono<AppEnv>();

function dateParam(v: string | undefined): string {
  return v && DATE_RE.test(v) ? v : new Date().toISOString().slice(0, 10);
}

/** Where the person's day starts and ends, in UTC, from their zone (the app's default zone when none is set). */
export function dayBounds(date: string, zone: string): [string, string] {
  try {
    return [zonedToUtc(date, 0, zone || 'Asia/Kolkata').toISOString(), zonedToUtc(shiftDate(date, 1), 0, zone || 'Asia/Kolkata').toISOString()];
  } catch {
    return [`${date}T00:00:00.000Z`, `${shiftDate(date, 1)}T00:00:00.000Z`];
  }
}

export async function weakestRelationship(db: D1Database, userId: string): Promise<RelationshipKey> {
  const row = await db
    .prepare('SELECT relationship FROM relationship_scores WHERE user_id = ? ORDER BY score ASC, xp ASC, relationship ASC LIMIT 1')
    .bind(userId)
    .first<{ relationship: RelationshipKey }>();
  return row?.relationship ?? 'self';
}

interface NotToDoRow {
  id: string;
  user_id: string;
  title: string;
  relationship: string | null;
  streak: number;
  best_streak: number;
  created_at: string;
}
type DayMap = Record<string, NotToDoStatus | undefined>;

function toNotToDo(row: NotToDoRow, days: DayMap, date: string): NotToDo {
  const streak = notToDoStreak(days, date);
  return {
    id: row.id,
    title: row.title,
    relationship: (row.relationship as RelationshipKey | null) ?? null,
    streak,
    bestStreak: Math.max(row.best_streak, streak),
    today: days[date] ?? null,
    week: notToDoWeek(days, date),
    createdAt: row.created_at,
  };
}

/** Every item with its streak counted live for `date`, from enough days back to re-count the longest stored run. */
export async function notToDoList(db: D1Database, userId: string, date: string): Promise<NotToDo[]> {
  const rows = await db.prepare('SELECT * FROM not_to_do WHERE user_id = ? ORDER BY created_at ASC').bind(userId).all<NotToDoRow>();
  if (rows.results.length === 0) return [];
  const reach = Math.max(8, ...rows.results.map((r) => r.streak + 2));
  const days = await db
    .prepare('SELECT item_id, day, status FROM not_to_do_days WHERE user_id = ? AND day >= ? AND day <= ?')
    .bind(userId, shiftDate(date, -reach), date)
    .all<{ item_id: string; day: string; status: NotToDoStatus }>();
  const byItem = new Map<string, DayMap>();
  for (const d of days.results) {
    const m = byItem.get(d.item_id) ?? {};
    m[d.day] = d.status;
    byItem.set(d.item_id, m);
  }
  return rows.results.map((r) => toNotToDo(r, byItem.get(r.id) ?? {}, date));
}

/**
 * What the person signed up for that starts on their day: Party events they are registered for, runs of clubs they belong to and circle
 * tables they are seated at. A title, a time and a link only; the person's own rows, by the session's id.
 */
export async function eventsOnDay(db: D1Database, userId: string, dayStart: string, dayEnd: string): Promise<TodayEvent[]> {
  const rows = await db
    .prepare(
      `SELECT kind, title, starts_at, path FROM (
         SELECT 'event' AS kind, e.title, e.starts_at, '/party/' || e.id AS path FROM events e JOIN event_registrations r ON r.event_id = e.id
           WHERE r.user_id = ?1 AND r.status IN ('registered', 'attended') AND e.status = 'published' AND e.starts_at >= ?2 AND e.starts_at < ?3
         UNION ALL SELECT 'circle', e.title, e.starts_at, '/circles/' || g.id FROM circle_events e JOIN circle_groups g ON g.event_id = e.id JOIN circle_members m ON m.group_id = g.id
           WHERE m.user_id = ?1 AND e.status != 'cancelled' AND e.starts_at >= ?2 AND e.starts_at < ?3
         UNION ALL SELECT 'run', r.title, r.starts_at, '/run/clubs/' || r.club_id FROM runs r JOIN run_members m ON m.club_id = r.club_id AND m.status = 'member' AND m.user_id = ?1
           WHERE r.status IN ('published', 'done') AND r.starts_at >= ?2 AND r.starts_at < ?3
       ) ORDER BY starts_at LIMIT 10`,
    )
    .bind(userId, dayStart, dayEnd)
    .all<{ kind: TodayEvent['kind']; title: string; starts_at: string; path: string }>();
  return rows.results.map((r) => ({ kind: r.kind, title: r.title, at: r.starts_at, path: r.path }));
}

/**
 * Agency work waiting on the person on their day: pieces due that day or before and not yet approved, the changes clients asked for that
 * are still in making, retainers a client chose that wait to be confirmed, and sent invoices due that day or before. Owner only (every
 * query filters by the session's id), bounded to TODAY_AGENCY_MAX rows a list, titles, numbers and client names only: never a note,
 * a fee or what a client wrote.
 */
export async function agencyToday(db: D1Database, userId: string, date: string): Promise<TodayAgency> {
  const fortnight = new Date(Date.now() - 14 * 86_400_000).toISOString();
  const [due, dueTotal, changes, retainers, invoices] = await Promise.all([
    db
      .prepare(
        `SELECT i.id, i.title, i.client_id, i.due_date, k.name AS client FROM agency_items i JOIN agency_clients k ON k.id = i.client_id AND k.user_id = i.user_id
         WHERE i.user_id = ? AND i.stage NOT IN ('approved', 'published') AND i.due_date IS NOT NULL AND i.due_date <= ? AND k.status != 'ended'
         ORDER BY i.due_date ASC, i.created_at ASC LIMIT ?`,
      )
      .bind(userId, date, TODAY_AGENCY_MAX)
      .all<{ id: string; title: string; client_id: string; due_date: string; client: string }>(),
    db
      .prepare("SELECT COUNT(*) AS n FROM agency_items i JOIN agency_clients k ON k.id = i.client_id AND k.user_id = i.user_id WHERE i.user_id = ? AND i.stage NOT IN ('approved', 'published') AND i.due_date IS NOT NULL AND i.due_date <= ? AND k.status != 'ended'")
      .bind(userId, date)
      .first<{ n: number }>(),
    db
      .prepare(
        "SELECT COUNT(DISTINCT i.id) AS n, COUNT(DISTINCT i.client_id) AS clients, MIN(i.client_id) AS client_id FROM agency_notes n JOIN agency_items i ON i.id = n.item_id AND i.user_id = n.user_id WHERE n.user_id = ? AND n.kind = 'change' AND n.created_at >= ? AND i.stage = 'making'",
      )
      .bind(userId, fortnight)
      .first<{ n: number; clients: number; client_id: string | null }>(),
    db
      .prepare("SELECT r.id, r.client_id, r.months, k.name AS client FROM agency_retainers r JOIN agency_clients k ON k.id = r.client_id AND k.user_id = r.user_id WHERE r.user_id = ? AND r.status = 'chosen' ORDER BY r.chosen_at ASC LIMIT ?")
      .bind(userId, TODAY_AGENCY_MAX)
      .all<{ id: string; client_id: string; months: number | null; client: string }>(),
    db
      .prepare(
        `SELECT i.id, i.number, i.agency_client_id, i.due_date, i.total_cents, i.currency, COALESCE(k.name, i.client_name) AS client FROM invoices i
         LEFT JOIN agency_clients k ON k.id = i.agency_client_id AND k.user_id = i.user_id
         WHERE i.user_id = ? AND i.status = 'sent' AND i.agency_client_id IS NOT NULL AND i.due_date IS NOT NULL AND i.due_date <= ?
         ORDER BY i.due_date ASC LIMIT ?`,
      )
      .bind(userId, date, TODAY_AGENCY_MAX)
      .all<{ id: string; number: string; agency_client_id: string | null; due_date: string; total_cents: number; currency: string; client: string }>(),
  ]);
  return {
    due: due.results.map((r) => ({ id: r.id, title: r.title, clientId: r.client_id, client: r.client, due: r.due_date, late: r.due_date < date })),
    dueTotal: dueTotal?.n ?? due.results.length,
    changeAsks: changes?.n ?? 0,
    changeClientId: changes && changes.clients === 1 ? changes.client_id : null,
    retainerToConfirm: retainers.results.map((r) => ({ id: r.id, clientId: r.client_id, client: r.client, months: r.months })),
    invoicesDue: invoices.results.map((r) => ({ id: r.id, number: r.number, clientId: r.agency_client_id, client: r.client, due: r.due_date, late: r.due_date < date, cents: r.total_cents, currency: r.currency })),
  };
}

today.get('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const date = dateParam(c.req.query('date'));

  // None of these reads waits on another, so they run together: one round trip of waiting instead of a dozen.
  const [dayStart, dayEnd] = dayBounds(date, user.timezone);
  const [due, plan, back, backTotal, doneToday, recent, gate, relationship, sparkDone, notToDo, events, access] = await Promise.all([
    db
      .prepare(
        `SELECT * FROM nodes WHERE user_id = ? AND kind = 'task' AND status = 'active' AND COALESCE(do_date, due_date) IS NOT NULL AND COALESCE(do_date, due_date) <= ?
       ORDER BY COALESCE(do_date, due_date) ASC, CASE WHEN due_time IS NULL THEN 1 ELSE 0 END, due_time ASC, created_at ASC LIMIT 6`,
      )
      .bind(user.id, date)
      .all<NodeRow>(),
    // The day's time plan counts every timed task due today, not just the six shown.
    db
      .prepare(
        `SELECT
        (SELECT COALESCE(SUM(estimate_min), 0) FROM nodes WHERE user_id = ?1 AND kind = 'task' AND status = 'active' AND COALESCE(do_date, due_date) <= ?2 AND estimate_min IS NOT NULL) AS planned,
        (SELECT COALESCE(SUM(estimate_min), 0) FROM nodes WHERE user_id = ?1 AND kind = 'task' AND status = 'done' AND completed_at LIKE ?3 AND estimate_min IS NOT NULL) AS done,
        (SELECT COUNT(*) FROM nodes WHERE user_id = ?1 AND kind = 'task' AND status = 'active' AND COALESCE(do_date, due_date) <= ?2 AND due_time IS NOT NULL) AS timed`,
      )
      .bind(user.id, date, `${date}%`)
      .first<{ planned: number; done: number; timed: number }>(),
    // The main list is only what has a day that has come. A task with no date at all (no do date and no due date) waits in the not scheduled list below it until either is picked.
    db
      .prepare(
        `SELECT * FROM nodes WHERE user_id = ? AND kind = 'task' AND status = 'active' AND do_date IS NULL AND due_date IS NULL
       ORDER BY remind DESC, created_at DESC LIMIT 60`,
      )
      .bind(user.id)
      .all<NodeRow>(),
    db
      .prepare("SELECT COUNT(*) AS n FROM nodes WHERE user_id = ? AND kind = 'task' AND status = 'active' AND do_date IS NULL AND due_date IS NULL")
      .bind(user.id)
      .first<{ n: number }>(),
    // What was ticked today stays in sight under the tasks still waiting, so a tick can be seen and undone.
    db
      .prepare("SELECT * FROM nodes WHERE user_id = ? AND kind = 'task' AND status = 'done' AND completed_at >= ? AND completed_at < ? ORDER BY completed_at DESC LIMIT 20")
      .bind(user.id, dayStart, dayEnd)
      .all<NodeRow>(),
    db
      .prepare("SELECT COUNT(*) AS n FROM nodes WHERE user_id = ? AND kind = 'task' AND status = 'done' AND completed_at >= ?")
      .bind(user.id, new Date(Date.now() - 86_400_000).toISOString())
      .first<{ n: number }>(),
    taskGate(db, user.id),
    weakestRelationship(db, user.id),
    db
      .prepare('SELECT relationship FROM spark_completions WHERE user_id = ? AND date = ?')
      .bind(user.id, date)
      .first<{ relationship: RelationshipKey }>(),
    notToDoList(db, user.id, date),
    eventsOnDay(db, user.id, dayStart, dayEnd),
    resolveAccess(db, user).then((r) => r.access),
    // A gentle nudge in the inbox, once a day, when a reminder time is set and
    // the day's check-in has not happened yet.
    (async () => {
      if (user.reminder_time && user.last_checkin !== date) {
        const already = await db.prepare("SELECT 1 FROM notifications WHERE user_id = ? AND kind = 'reminder' AND created_at >= ?").bind(user.id, `${date}T00:00:00`).first();
        if (!already) await notify(db, user.id, 'reminder', 'Your daily three are waiting', 'Check in, do your small act, tick a task.', '/today');
      }
    })(),
  ]);
  const tasks = due.results;

  // The three lists share one subtask count query (the lists never hold the same task twice).
  const shown = await withSubtasks(db, user.id, [...tasks, ...back.results, ...doneToday.results].map((t) => toNode(t, gate)));
  const res: TodayResponse = {
    date,
    checkedIn: user.last_checkin === date,
    streak: user.streak,
    tasks: shown.slice(0, tasks.length),
    backlog: shown.slice(tasks.length, tasks.length + back.results.length),
    backlogTotal: backTotal?.n ?? 0,
    done: shown.slice(tasks.length + back.results.length),
    doneRecently: recent?.n ?? 0,
    timePlan: { plannedMin: plan?.planned ?? 0, doneMin: plan?.done ?? 0, timed: plan?.timed ?? 0 },
    spark: {
      relationship: sparkDone?.relationship ?? relationship,
      text: sparkFor(sparkDone?.relationship ?? relationship, date),
      done: Boolean(sparkDone),
    },
    notToDo,
    events,
  };
  // Agency's work for the day is read only while Agency is on for the person; with it off the field is absent.
  if (access.agency?.on === true) res.agency = await agencyToday(db, user.id, date);
  return c.json(res);
});

// The week ahead, planned from the open tasks: a suggested day for each task that has none, how strong the plan is, and a few plain notes.
// It writes nothing. The screen keeps what the person keeps, one task at a time, through the ordinary edit.
today.get('/week-plan', async (c) => {
  const user = c.get('user');
  const date = dateParam(c.req.query('date'));
  const hours = Math.max(1, Math.min(12, Math.round(Number(c.req.query('hours')) || PLAN_DAY_MINUTES / 60)));
  const rows = await c.env.DB
    .prepare("SELECT id, title, relationship, estimate_min, priority, do_date, due_date, origin FROM nodes WHERE user_id = ? AND kind = 'task' AND status = 'active' ORDER BY created_at LIMIT 600")
    .bind(user.id)
    .all<{ id: string; title: string; relationship: RelationshipKey; estimate_min: number | null; priority: number | null; do_date: string | null; due_date: string | null; origin: string | null }>();
  const tasks: PlanTask[] = rows.results.map((r) => ({ id: r.id, title: r.title, relationship: r.relationship, estimateMin: r.estimate_min, priority: (r.priority as PlanTask['priority']) ?? null, doDate: r.do_date, dueDate: r.due_date, fromPillar: r.origin === 'build' }));
  return c.json({ plan: planWeek(date, tasks, hours * 60) });
});

// The month calendar on Daily: every task whose day (do date, else due date) falls in the month, ticked ones included, and the projects a new task can go under.
// Bounded: at most MONTH_TASKS_MAX tasks (one extra row is read so `more` is true); the person's own, filtered by the session user.
today.get('/month', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const month = c.req.query('month') ?? '';
  if (!MONTH_RE.test(month)) return c.json({ error: 'month must be a real month like 2026-11' }, 400);
  const dayAsked = c.req.query('day');
  if (dayAsked !== undefined && !DATE_RE.test(dayAsked)) return c.json({ error: 'day must be a real day like 2026-11-02' }, 400);
  const start = `${month}-01`;
  const end = `${monthShift(month, 1)}-01`;
  const [gate, rows, projects] = await Promise.all([
    taskGate(db, user.id),
    db
      .prepare(
        `SELECT * FROM nodes WHERE user_id = ? AND kind = 'task' AND status IN ('active', 'done')
         AND COALESCE(do_date, due_date) >= ? AND COALESCE(do_date, due_date) < ?
         ORDER BY COALESCE(do_date, due_date) ASC, CASE WHEN due_time IS NULL THEN 1 ELSE 0 END, due_time ASC, CASE WHEN priority IS NULL THEN 1 ELSE 0 END, priority ASC, created_at ASC LIMIT ?`,
      )
      .bind(user.id, start, end, MONTH_TASKS_MAX + 1)
      .all<NodeRow>(),
    db
      .prepare("SELECT id, title, relationship FROM nodes WHERE user_id = ? AND kind = 'project' AND status = 'active' ORDER BY relationship ASC, sort_order ASC, created_at ASC LIMIT 100")
      .bind(user.id)
      .all<MonthProject>(),
  ]);
  const more = rows.results.length > MONTH_TASKS_MAX;
  const tasks: MonthTask[] = rows.results.slice(0, MONTH_TASKS_MAX).map((r) => {
    const n = toNode(r, gate);
    const day = n.doDate ?? n.dueDate ?? start;
    return {
      id: n.id,
      title: n.title,
      relationship: n.relationship,
      doDate: n.doDate,
      dueDate: n.dueDate,
      day,
      status: n.status === 'done' ? 'done' : 'active',
      priority: n.priority,
      time: n.dueTime,
      estimateMin: n.estimateMin,
      repeat: n.repeat ? repeatLabel(n.repeat, day) : null,
      readyAt: n.readyAt,
      completedAt: n.completedAt,
    };
  });
  const res: TodayMonthResponse = { month, today: dayAsked ?? dateParam(undefined), tasks, more, projects: projects.results };
  return c.json(res);
});

today.post('/checkin', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<{ date?: string }>().catch(() => ({}) as { date?: string });
  const date = dateParam(body.date);
  if (!dateNearToday(date)) return c.json({ error: 'That date is not today. Check-ins only count on the day itself.' }, 400);
  if (user.last_checkin && date < user.last_checkin) return c.json({ error: 'You already checked in for a later day.' }, 400);

  if (user.last_checkin === date) {
    const res: CheckinResponse = { streak: user.streak, bestStreak: user.best_streak, awarded: 0, points: 0, streakBonus: 0, alreadyCheckedIn: true };
    return c.json(res);
  }
  const streak = user.last_checkin === shiftDate(date, -1) ? user.streak + 1 : 1;
  const best = Math.max(streak, user.best_streak);
  const now = nowIso();
  const streakBonus = streak % POINTS.streakBonusEvery === 0 ? POINTS.streakBonus : 0;
  const points = POINTS.checkin + streakBonus;
  const stmts = [
    db
      .prepare('UPDATE users SET streak = ?, best_streak = ?, last_checkin = ?, xp = xp + ?, points = points + ? WHERE id = ?')
      .bind(streak, best, date, XP.checkin, points, user.id),
    db
      .prepare('INSERT INTO xp_events (user_id, relationship, source, source_id, amount, created_at) VALUES (?, NULL, ?, ?, ?, ?)')
      .bind(user.id, 'checkin', date, XP.checkin, now),
    db
      .prepare('INSERT INTO points_ledger (user_id, amount, reason, ref, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(user.id, POINTS.checkin, 'checkin', date, now),
  ];
  if (streakBonus > 0) {
    stmts.push(
      db
        .prepare('INSERT INTO points_ledger (user_id, amount, reason, ref, created_at) VALUES (?, ?, ?, ?, ?)')
        .bind(user.id, streakBonus, 'streak_bonus', String(streak), now),
    );
  }
  await db.batch(stmts);
  const res: CheckinResponse = { streak, bestStreak: best, awarded: XP.checkin, points, streakBonus, alreadyCheckedIn: false };
  return c.json(res);
});

today.post('/spark', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<{ date?: string }>().catch(() => ({}) as { date?: string });
  const date = dateParam(body.date);
  if (!dateNearToday(date)) return c.json({ error: 'That date is not today. Sparks only count on the day itself.' }, 400);
  const existing = await db
    .prepare('SELECT relationship FROM spark_completions WHERE user_id = ? AND date = ?')
    .bind(user.id, date)
    .first<{ relationship: RelationshipKey }>();
  if (existing) return c.json({ awarded: 0, relationship: existing.relationship, alreadyDone: true });

  const relationship = await weakestRelationship(db, user.id);
  const now = nowIso();
  await db.batch([
    db.prepare('INSERT INTO spark_completions (user_id, date, relationship, created_at) VALUES (?, ?, ?, ?)').bind(user.id, date, relationship, now),
    db.prepare('UPDATE relationship_scores SET xp = xp + ? WHERE user_id = ? AND relationship = ?').bind(XP.spark, user.id, relationship),
    db.prepare('UPDATE users SET xp = xp + ? WHERE id = ?').bind(XP.spark, user.id),
    db
      .prepare('INSERT INTO xp_events (user_id, relationship, source, source_id, amount, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(user.id, relationship, 'spark', date, XP.spark, now),
  ]);
  const fresh = await getUser(db, user.id);
  return c.json({ awarded: XP.spark, relationship, alreadyDone: false, xp: fresh?.xp ?? user.xp });
});

// The not-to-do list: things to stay away from. Each item keeps its own streak of kept days.
today.post('/not-to-do', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<{ title?: unknown; relationship?: unknown }>().catch(() => ({}) as { title?: unknown; relationship?: unknown });
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, NOT_TO_DO_TITLE_MAX) : '';
  if (!title) return c.json({ error: 'Say what you are staying away from.' }, 400);
  const relationship = typeof body.relationship === 'string' && RELATIONSHIPS.some((r) => r.key === body.relationship) ? (body.relationship as RelationshipKey) : null;
  const count = await db.prepare('SELECT COUNT(*) AS n FROM not_to_do WHERE user_id = ?').bind(user.id).first<{ n: number }>();
  if ((count?.n ?? 0) >= MAX_NOT_TO_DO) return c.json({ error: `${MAX_NOT_TO_DO} is plenty. Remove one to add another.` }, 400);
  const id = newId();
  const now = nowIso();
  await db.prepare('INSERT INTO not_to_do (id, user_id, title, relationship, streak, best_streak, created_at) VALUES (?, ?, ?, ?, 0, 0, ?)').bind(id, user.id, title, relationship, now).run();
  const item: NotToDo = { id, title, relationship, streak: 0, bestStreak: 0, today: null, week: [null, null, null, null, null, null, null], createdAt: now };
  return c.json({ item }, 201);
});

// Mark a day: kept, slipped, or nothing (an unticked box). Today or yesterday only.
today.post('/not-to-do/:id/day', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await db.prepare('SELECT * FROM not_to_do WHERE id = ? AND user_id = ?').bind(c.req.param('id'), user.id).first<NotToDoRow>();
  if (!row) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<{ date?: string; today?: string; status?: unknown }>().catch(() => ({}) as { date?: string; today?: string; status?: unknown });
  const date = dateParam(body.date);
  if (!dateNearToday(date)) return c.json({ error: 'Only today or yesterday can be marked.' }, 400);
  // The streak is counted as of the person's today, which is the marked day or the day after it.
  const today = body.today && DATE_RE.test(body.today) && body.today >= date && dateNearToday(body.today) ? body.today : date;
  const status: NotToDoStatus | null | undefined = body.status === 'kept' || body.status === 'slipped' ? body.status : body.status === null || body.status === undefined ? null : undefined;
  if (status === undefined) return c.json({ error: 'status must be kept, slipped or null' }, 400);
  const now = nowIso();
  const stmts = status
    ? [db.prepare('INSERT INTO not_to_do_days (item_id, user_id, day, status, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(item_id, day) DO UPDATE SET status = excluded.status').bind(row.id, user.id, date, status, now)]
    : [db.prepare('DELETE FROM not_to_do_days WHERE item_id = ? AND day = ?').bind(row.id, date)];
  // A kept day pays once, however many times the box is ticked and unticked, and is never clawed back.
  let awarded = 0;
  if (status === 'kept') {
    const paid = await db.prepare("SELECT 1 FROM xp_events WHERE user_id = ? AND source = 'not_to_do' AND source_id = ?").bind(user.id, `${row.id}:${date}`).first();
    if (!paid) {
      awarded = XP.notToDo;
      stmts.push(db.prepare('UPDATE users SET xp = xp + ? WHERE id = ?').bind(awarded, user.id));
      if (row.relationship) stmts.push(db.prepare('UPDATE relationship_scores SET xp = xp + ? WHERE user_id = ? AND relationship = ?').bind(awarded, user.id, row.relationship));
      stmts.push(
        db
          .prepare('INSERT INTO xp_events (user_id, relationship, source, source_id, amount, created_at) VALUES (?, ?, ?, ?, ?, ?)')
          .bind(user.id, row.relationship, 'not_to_do', `${row.id}:${date}`, awarded, now),
      );
    }
  }
  await db.batch(stmts);
  const all = await db.prepare('SELECT day, status FROM not_to_do_days WHERE item_id = ? ORDER BY day DESC LIMIT 2000').bind(row.id).all<{ day: string; status: NotToDoStatus }>();
  const days: DayMap = {};
  for (const d of all.results) days[d.day] = d.status;
  const streak = notToDoStreak(days, today);
  const best = Math.max(row.best_streak, streak);
  await db.prepare('UPDATE not_to_do SET streak = ?, best_streak = ? WHERE id = ?').bind(streak, best, row.id).run();
  return c.json({ item: toNotToDo({ ...row, streak, best_streak: best }, days, today), awarded });
});

today.delete('/not-to-do/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const r = await db.prepare('DELETE FROM not_to_do WHERE id = ? AND user_id = ?').bind(c.req.param('id'), user.id).run();
  if (!r.meta.changes) return c.json({ error: 'not found' }, 404);
  return c.json({ ok: true });
});
