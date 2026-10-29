import { Hono } from 'hono';
import { PERMISSIONS } from '@kreators/shared';
import type { AppEnv } from '../env';
import { can, nameOf, parseList, requireRole, pageOf, paged } from '../db';

/** Guides and admins: a light view over members and the community. */
export const manage = new Hono<AppEnv>();
manage.use('*', requireRole('sub_admin'));

manage.get('/overview', async (c) => {
  const db = c.env.DB;
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const row = await db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM users WHERE onboarded_at IS NOT NULL) AS members,
        (SELECT COUNT(*) FROM users WHERE created_at >= ?1) AS new_this_week,
        (SELECT COUNT(*) FROM community_posts WHERE created_at >= ?1) AS posts_this_week,
        (SELECT COUNT(*) FROM community_posts WHERE hidden_at IS NOT NULL) AS hidden_posts,
        (SELECT COUNT(*) FROM resources WHERE published = 1) AS resources,
        (SELECT COUNT(*) FROM resources WHERE published = 0) AS drafts,
        (SELECT COUNT(*) FROM users WHERE last_checkin >= ?2) AS active_today`,
    )
    .bind(since, new Date().toISOString().slice(0, 10))
    .first<{ members: number; new_this_week: number; posts_this_week: number; hidden_posts: number; resources: number; drafts: number; active_today: number }>();
  const user = c.get('user');
  const perms = PERMISSIONS.filter((p) => can(user, p));
  const counts = await db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM campaigns WHERE status NOT IN ('reported','cancelled')) AS campaigns,
        (SELECT COUNT(*) FROM applications WHERE status = 'submitted') AS applications,
        (SELECT COUNT(*) FROM support_tickets WHERE status = 'open') AS tickets,
        (SELECT COUNT(*) FROM memberships WHERE status = 'applied') AS club_applied,
        (SELECT COUNT(*) FROM bounty_submissions WHERE status IN ('submitted','verified','disputed')) AS bounty_queue,
        (SELECT COUNT(*) FROM proposals WHERE stage IN ('submitted','review','diligence')) AS proposals,
        (SELECT COUNT(*) FROM submissions WHERE status = 'submitted') AS assignments,
        (SELECT COUNT(*) FROM coach_links WHERE coach_id = ?1 AND status = 'pending' AND asked_by = 'student') AS coach_asks`,
    )
    .bind(user.id)
    .first<{ campaigns: number; applications: number; tickets: number; club_applied: number; bounty_queue: number; proposals: number; assignments: number; coach_asks: number }>();
  return c.json({
    permissions: perms,
    queues: { campaigns: counts?.campaigns ?? 0, applications: counts?.applications ?? 0, tickets: counts?.tickets ?? 0, clubApplied: counts?.club_applied ?? 0, bountyQueue: counts?.bounty_queue ?? 0, proposals: counts?.proposals ?? 0, assignments: counts?.assignments ?? 0, coachAsks: counts?.coach_asks ?? 0 },
    members: row?.members ?? 0,
    newThisWeek: row?.new_this_week ?? 0,
    postsThisWeek: row?.posts_this_week ?? 0,
    hiddenPosts: row?.hidden_posts ?? 0,
    resources: row?.resources ?? 0,
    drafts: row?.drafts ?? 0,
    activeToday: row?.active_today ?? 0,
  });
});

manage.get('/members', async (c) => {
  const q = (c.req.query('q') ?? '').trim();
  const ask = pageOf(c);
  const rows = q
    ? await c.env.DB.prepare('SELECT id, display_name, handle, role, xp, streak, is_pro, created_at, last_checkin FROM users WHERE display_name LIKE ? OR handle LIKE ? OR email LIKE ? ORDER BY xp DESC LIMIT ? OFFSET ?').bind(`%${q}%`, `%${q}%`, `%${q}%`, ask.limit, ask.offset).all<{ id: string; display_name: string; handle: string | null; role: string; xp: number; streak: number; is_pro: number; created_at: string; last_checkin: string | null }>()
    : await c.env.DB.prepare('SELECT id, display_name, handle, role, xp, streak, is_pro, created_at, last_checkin FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?').bind(ask.limit, ask.offset).all<{ id: string; display_name: string; handle: string | null; role: string; xp: number; streak: number; is_pro: number; created_at: string; last_checkin: string | null }>();
  const pg = paged(rows.results, ask);
  return c.json({ page: pg.page, members: pg.items.map((r) => ({ id: r.id, name: nameOf(r), handle: r.handle, role: r.role, xp: r.xp, streak: r.streak, isPro: r.is_pro === 1, createdAt: r.created_at, lastCheckin: r.last_checkin })) });
  void parseList;
});
