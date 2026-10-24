import { Hono } from 'hono';
import {
  CHARACTER_STAGES,
  daysSince,
  evolutionFor,
  IDENTITY_STAGES,
  levelFromXp,
  RELATIONSHIPS,
  type MeResponse,
  type RelationshipKey,
  type RelationshipState,
} from '@kreators/shared';
import type { AppEnv } from '../env';
import { computeBadges, getStats, getUser, honorKeys, nowIso, toUser } from '../db';

export const me = new Hono<AppEnv>();

me.get('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const [scores, counts, stats, honors] = await Promise.all([
    db
      .prepare('SELECT relationship, score, xp FROM relationship_scores WHERE user_id = ?')
      .bind(user.id)
      .all<{ relationship: RelationshipKey; score: number; xp: number }>(),
    db
      .prepare(
        `SELECT relationship,
          SUM(CASE WHEN kind = 'pillar' AND status != 'archived' THEN 1 ELSE 0 END) AS pillars,
          SUM(CASE WHEN kind = 'task' AND status = 'active' THEN 1 ELSE 0 END) AS active_tasks,
          SUM(CASE WHEN kind = 'task' AND status = 'done' THEN 1 ELSE 0 END) AS done_tasks,
          MIN(CASE WHEN kind = 'pillar' AND status != 'archived' THEN created_at END) AS first_pillar
         FROM nodes WHERE user_id = ? GROUP BY relationship`,
      )
      .bind(user.id)
      .all<{ relationship: RelationshipKey; pillars: number; active_tasks: number; done_tasks: number; first_pillar: string | null }>(),
    getStats(db, user.id),
    honorKeys(db, user),
  ]);

  const scoreBy = new Map(scores.results.map((s) => [s.relationship, s]));
  const countBy = new Map(counts.results.map((s) => [s.relationship, s]));

  const relationships: RelationshipState[] = RELATIONSHIPS.map((r) => {
    const s = scoreBy.get(r.key);
    const n = countBy.get(r.key);
    const xp = s?.xp ?? 0;
    const floorAgeDays = n?.first_pillar ? daysSince(n.first_pillar) : null;
    return {
      key: r.key,
      score: s?.score ?? 0,
      xp,
      level: levelFromXp(xp),
      pillars: n?.pillars ?? 0,
      activeTasks: n?.active_tasks ?? 0,
      doneTasks: n?.done_tasks ?? 0,
      stage: evolutionFor(CHARACTER_STAGES, xp, floorAgeDays ?? 0).stage.stage,
      floorAgeDays,
    };
  });

  const body: MeResponse = {
    user: toUser(user),
    relationships,
    badges: computeBadges(user, stats),
    honors,
    identity: evolutionFor(IDENTITY_STAGES, user.xp, daysSince(user.created_at)),
    stats: { tasksDone: stats.tasksDone, sparksDone: stats.sparksDone, projectsCleared: stats.projectsCleared },
  };
  return c.json(body);
});

me.patch('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req
    .json<{ displayName?: string; focus?: string; leaderboardOptIn?: boolean }>()
    .catch(() => ({}) as { displayName?: string; focus?: string; leaderboardOptIn?: boolean });
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim().slice(0, 40) : user.display_name;
  const focus = typeof body.focus === 'string' ? body.focus.trim().slice(0, 40) : user.creator_type;
  const optIn = typeof body.leaderboardOptIn === 'boolean' ? (body.leaderboardOptIn ? 1 : 0) : user.leaderboard_opt_in;
  await db
    .prepare('UPDATE users SET display_name = ?, creator_type = ?, leaderboard_opt_in = ? WHERE id = ?')
    .bind(displayName, focus, optIn, user.id)
    .run();
  const fresh = await getUser(db, user.id);
  return c.json({ user: fresh ? toUser(fresh) : null });
});

// Wipe progress but keep the device session, so the person can start over.
me.post('/reset', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  await db.batch([
    db.prepare('DELETE FROM nodes WHERE user_id = ?').bind(user.id),
    db.prepare('DELETE FROM xp_events WHERE user_id = ?').bind(user.id),
    db.prepare('DELETE FROM spark_completions WHERE user_id = ?').bind(user.id),
    db.prepare('DELETE FROM onboarding_answers WHERE user_id = ?').bind(user.id),
    db.prepare('DELETE FROM points_ledger WHERE user_id = ?').bind(user.id),
    db.prepare("DELETE FROM redemptions WHERE user_id = ? AND status = 'reserved'").bind(user.id),
    db.prepare('UPDATE relationship_scores SET score = 0, xp = 0 WHERE user_id = ?').bind(user.id),
    db
      .prepare('UPDATE users SET xp = 0, points = 0, streak = 0, best_streak = 0, last_checkin = NULL, onboarded_at = NULL WHERE id = ?')
      .bind(user.id),
  ]);
  return c.json({ ok: true, at: nowIso() });
});
