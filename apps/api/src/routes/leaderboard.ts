import { Hono } from 'hono';
import { daysSince, evolutionFor, IDENTITY_STAGES, levelFromXp, timeHonors, type LeaderboardEntry, type LeaderboardResponse, type LeaderboardSort } from '@kreators/shared';
import type { AppEnv } from '../env';
import { computeBadges } from '../db';

export const leaderboard = new Hono<AppEnv>();

interface Row {
  id: string;
  display_name: string;
  xp: number;
  streak: number;
  best_streak: number;
  is_pro: number;
  created_at: string;
  tasks_done: number;
  projects_cleared: number;
  rels_with_pillars: number;
  sparks_done: number;
  admin_honors: number;
}

const SORTS: LeaderboardSort[] = ['xp', 'streak', 'badges'];

leaderboard.get('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const q = c.req.query('by');
  const by: LeaderboardSort = SORTS.includes(q as LeaderboardSort) ? (q as LeaderboardSort) : 'xp';

  // The pool is the top 200 climbers by xp who opted in. Badge counts need the
  // same stats the profile uses, so they are computed here rather than stored.
  const rows = await db
    .prepare(
      `SELECT u.id, u.display_name, u.xp, u.streak, u.best_streak, u.is_pro, u.created_at,
        (SELECT COUNT(*) FROM nodes n WHERE n.user_id = u.id AND n.kind = 'task' AND n.status = 'done') AS tasks_done,
        (SELECT COUNT(*) FROM nodes n WHERE n.user_id = u.id AND n.kind = 'project' AND n.status = 'done') AS projects_cleared,
        (SELECT COUNT(DISTINCT relationship) FROM nodes n WHERE n.user_id = u.id AND n.kind = 'pillar' AND n.status != 'archived') AS rels_with_pillars,
        (SELECT COUNT(*) FROM spark_completions s WHERE s.user_id = u.id) AS sparks_done,
        (SELECT COUNT(*) FROM honors h WHERE h.user_id = u.id) AS admin_honors
       FROM users u
       WHERE u.leaderboard_opt_in = 1 AND u.onboarded_at IS NOT NULL
       ORDER BY u.xp DESC, u.created_at ASC
       LIMIT 200`,
    )
    .all<Row>();

  const entries: LeaderboardEntry[] = rows.results.map((r) => {
    const badges = computeBadges(r, {
      tasksDone: r.tasks_done,
      projectsCleared: r.projects_cleared,
      relationshipsWithPillars: r.rels_with_pillars,
      clubMember: false, // the board does not look up Club rows; the badge shows on the person's own page
      sparksDone: r.sparks_done,
      runsLogged: 0, // run badges likewise show on the person's own page, not the board
      runMetres: 0,
    }).length;
    return {
      rank: 0,
      userId: r.id,
      name: r.display_name || 'Anonymous climber',
      xp: r.xp,
      level: levelFromXp(r.xp),
      streak: r.streak,
      badgeCount: badges + r.admin_honors + timeHonors(r.created_at).length,
      isPro: r.is_pro === 1,
      stage: evolutionFor(IDENTITY_STAGES, r.xp, daysSince(r.created_at)).stage.stage,
      isMe: r.id === user.id,
    };
  });

  const key = by === 'badges' ? 'badgeCount' : by;
  entries.sort((a, b) => b[key] - a[key] || b.xp - a.xp);
  entries.forEach((e, i) => (e.rank = i + 1));

  const res: LeaderboardResponse = {
    by,
    entries: entries.slice(0, 20),
    me: entries.find((e) => e.isMe) ?? null,
    optedIn: user.leaderboard_opt_in === 1,
  };
  return c.json(res);
});
