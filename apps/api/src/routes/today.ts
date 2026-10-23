import { Hono } from 'hono';
import { POINTS, sparkFor, XP, type CheckinResponse, type RelationshipKey, type TodayResponse } from '@kreators/shared';
import type { AppEnv } from '../env';
import { DATE_RE, dateNearToday, getUser, nowIso, shiftDate, toNode, type NodeRow } from '../db';

export const today = new Hono<AppEnv>();

function dateParam(v: string | undefined): string {
  return v && DATE_RE.test(v) ? v : new Date().toISOString().slice(0, 10);
}

async function weakestRelationship(db: D1Database, userId: string): Promise<RelationshipKey> {
  const row = await db
    .prepare('SELECT relationship FROM relationship_scores WHERE user_id = ? ORDER BY score ASC, xp ASC, relationship ASC LIMIT 1')
    .bind(userId)
    .first<{ relationship: RelationshipKey }>();
  return row?.relationship ?? 'self';
}

today.get('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const date = dateParam(c.req.query('date'));

  const due = await db
    .prepare(
      `SELECT * FROM nodes WHERE user_id = ? AND kind = 'task' AND status = 'active' AND due_date IS NOT NULL AND due_date <= ?
       ORDER BY due_date ASC, created_at ASC LIMIT 6`,
    )
    .bind(user.id, date)
    .all<NodeRow>();
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

  const recent = await db
    .prepare("SELECT COUNT(*) AS n FROM nodes WHERE user_id = ? AND kind = 'task' AND status = 'done' AND completed_at >= ?")
    .bind(user.id, new Date(Date.now() - 86_400_000).toISOString())
    .first<{ n: number }>();

  const relationship = await weakestRelationship(db, user.id);
  const sparkDone = await db
    .prepare('SELECT relationship FROM spark_completions WHERE user_id = ? AND date = ?')
    .bind(user.id, date)
    .first<{ relationship: RelationshipKey }>();

  const res: TodayResponse = {
    date,
    checkedIn: user.last_checkin === date,
    streak: user.streak,
    tasks: tasks.map(toNode),
    doneRecently: recent?.n ?? 0,
    spark: {
      relationship: sparkDone?.relationship ?? relationship,
      text: sparkFor(sparkDone?.relationship ?? relationship, date),
      done: Boolean(sparkDone),
    },
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
