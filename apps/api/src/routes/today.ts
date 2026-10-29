import { Hono } from 'hono';
import { MAX_NOT_TO_DO, NOT_TO_DO_TITLE_MAX, notToDoStreak, notToDoWeek, POINTS, RELATIONSHIPS, sparkFor, XP, zonedToUtc, type CheckinResponse, type NotToDo, type NotToDoStatus, type RelationshipKey, type TodayResponse } from '@kreators/shared';
import type { AppEnv } from '../env';
import { DATE_RE, dateNearToday, getUser, newId, notify, nowIso, shiftDate, toNode, type NodeRow, taskGate } from '../db';

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

today.get('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const date = dateParam(c.req.query('date'));

  const due = await db
    .prepare(
      `SELECT * FROM nodes WHERE user_id = ? AND kind = 'task' AND status = 'active' AND due_date IS NOT NULL AND due_date <= ?
       ORDER BY due_date ASC, CASE WHEN due_time IS NULL THEN 1 ELSE 0 END, due_time ASC, created_at ASC LIMIT 6`,
    )
    .bind(user.id, date)
    .all<NodeRow>();
  // The day's time plan counts every timed task due today, not just the six shown.
  const plan = await db
    .prepare(
      `SELECT
        (SELECT COALESCE(SUM(estimate_min), 0) FROM nodes WHERE user_id = ?1 AND kind = 'task' AND status = 'active' AND due_date <= ?2 AND estimate_min IS NOT NULL) AS planned,
        (SELECT COALESCE(SUM(estimate_min), 0) FROM nodes WHERE user_id = ?1 AND kind = 'task' AND status = 'done' AND completed_at LIKE ?3 AND estimate_min IS NOT NULL) AS done,
        (SELECT COUNT(*) FROM nodes WHERE user_id = ?1 AND kind = 'task' AND status = 'active' AND due_date <= ?2 AND due_time IS NOT NULL) AS timed`,
    )
    .bind(user.id, date, `${date}%`)
    .first<{ planned: number; done: number; timed: number }>();
  let tasks = due.results;
  if (tasks.length < 3) {
    const fill = await db
      .prepare(
        `SELECT * FROM nodes WHERE user_id = ? AND kind = 'task' AND status = 'active' AND due_date IS NULL
         ORDER BY created_at ASC LIMIT ?`,
      )
      .bind(user.id, 6 - tasks.length)
      .all<NodeRow>();
    tasks = [...tasks, ...fill.results];
  }

  // What was ticked today stays in sight under the tasks still waiting, so a tick can be seen and undone.
  const [dayStart, dayEnd] = dayBounds(date, user.timezone);
  const doneToday = await db
    .prepare("SELECT * FROM nodes WHERE user_id = ? AND kind = 'task' AND status = 'done' AND completed_at >= ? AND completed_at < ? ORDER BY completed_at DESC LIMIT 20")
    .bind(user.id, dayStart, dayEnd)
    .all<NodeRow>();

  const recent = await db
    .prepare("SELECT COUNT(*) AS n FROM nodes WHERE user_id = ? AND kind = 'task' AND status = 'done' AND completed_at >= ?")
    .bind(user.id, new Date(Date.now() - 86_400_000).toISOString())
    .first<{ n: number }>();

  // A gentle nudge in the inbox, once a day, when a reminder time is set and
  // the day's check-in has not happened yet.
  if (user.reminder_time && user.last_checkin !== date) {
    const already = await db.prepare("SELECT 1 FROM notifications WHERE user_id = ? AND kind = 'reminder' AND created_at >= ?").bind(user.id, `${date}T00:00:00`).first();
    if (!already) await notify(db, user.id, 'reminder', 'Your daily three are waiting', 'Check in, do the spark, tick a task.', '/today');
  }

  const gate = await taskGate(db, user.id);
  const relationship = await weakestRelationship(db, user.id);
  const sparkDone = await db
    .prepare('SELECT relationship FROM spark_completions WHERE user_id = ? AND date = ?')
    .bind(user.id, date)
    .first<{ relationship: RelationshipKey }>();

  const res: TodayResponse = {
    date,
    checkedIn: user.last_checkin === date,
    streak: user.streak,
    tasks: tasks.map((t) => toNode(t, gate)),
    done: doneToday.results.map((t) => toNode(t, gate)),
    doneRecently: recent?.n ?? 0,
    timePlan: { plannedMin: plan?.planned ?? 0, doneMin: plan?.done ?? 0, timed: plan?.timed ?? 0 },
    spark: {
      relationship: sparkDone?.relationship ?? relationship,
      text: sparkFor(sparkDone?.relationship ?? relationship, date),
      done: Boolean(sparkDone),
    },
    notToDo: await notToDoList(db, user.id, date),
  };
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
