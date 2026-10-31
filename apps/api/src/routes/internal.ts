import { CARD_GAMES, isRole, MODULES, roleRank, ROLES, type LogEntry, type LogsResponse, type ObservabilityResponse, type ObservedAdditions, type ObservedUser, type Role } from '@kreators/shared';
import { Hono } from 'hono';
import { accessFor, loadAccessContext } from '../access';
import { audit, getUser, pageOf, paged } from '../db';
import type { AppEnv, UserRow } from '../env';

/**
 * Internal observability for the team: who is here, which apps they have on, who holds which role.
 * Staff can look. Only an admin changes a role, and never their own, so someone is always left who can.
 * Journal and wellbeing never appear here.
 */
export const internal = new Hono<AppEnv>();

const DELETED = 'Deleted member';

internal.use('*', async (c, next) => {
  const user = c.get('user');
  if (!user || roleRank(user.role) < roleRank('sub_admin')) return c.json({ error: 'you do not have access to that' }, 403);
  await next();
});

type LightRow = Pick<UserRow, 'id' | 'display_name' | 'handle' | 'role' | 'modules' | 'created_at' | 'onboarded_at'>;

internal.get('/observability', async (c) => {
  const db = c.env.DB;
  const q = (c.req.query('q') ?? '').trim().toLowerCase().slice(0, 60);
  const ask = pageOf(c);
  const [rows, members, ctx] = await Promise.all([
    db.prepare('SELECT id, display_name, handle, role, modules, created_at, onboarded_at FROM users WHERE display_name != ? ORDER BY created_at DESC').bind(DELETED).all<LightRow>(),
    db.prepare("SELECT user_id, organization_id FROM organization_members WHERE status = 'active'").all<{ user_id: string; organization_id: string }>(),
    loadAccessContext(db),
  ]);
  const orgsOf = new Map<string, string[]>();
  for (const m of members.results) orgsOf.set(m.user_id, [...(orgsOf.get(m.user_id) ?? []), m.organization_id]);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const on = new Map<string, number>();
  const roles: Record<Role, number> = { user: 0, sub_admin: 0, admin: 0 };
  const totals = { users: 0, onboarded: 0, staff: 0, admins: 0, newThisWeek: 0 };
  const people: ObservedUser[] = [];
  for (const r of rows.results) {
    const access = accessFor(r, ctx, orgsOf.get(r.id) ?? []);
    const apps = MODULES.filter((m) => access[m.key]?.on).map((m) => m.key);
    for (const k of apps) on.set(k, (on.get(k) ?? 0) + 1);
    const role: Role = isRole(r.role) ? r.role : 'user';
    roles[role] += 1;
    totals.users += 1;
    if (r.onboarded_at) totals.onboarded += 1;
    if (role === 'sub_admin') totals.staff += 1;
    if (role === 'admin') totals.admins += 1;
    if (r.created_at >= weekAgo) totals.newThisWeek += 1;
    people.push({ id: r.id, name: r.display_name, handle: r.handle, role, createdAt: r.created_at, onboarded: Boolean(r.onboarded_at), apps });
  }
  const since24 = new Date(Date.now() - 86_400_000).toISOString();
  const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [unlocks, dz, dset, grantRows, logRows, extraRows] = await Promise.all([
    db.prepare('SELECT game_key, COUNT(*) AS n FROM card_unlocks GROUP BY game_key').all<{ game_key: string; n: number }>(),
    db.prepare("SELECT COUNT(*) AS results, COUNT(DISTINCT user_id) AS people, COALESCE(SUM(CASE WHEN result_json LIKE '%\"eq\":{%' THEN 1 ELSE 0 END), 0) AS with_eq FROM discover_results").first<{ results: number; people: number; with_eq: number }>(),
    db.prepare('SELECT COALESCE(SUM(assistant), 0) AS assistant_on, COALESCE(SUM(CASE WHEN steps = 0 THEN 1 ELSE 0 END), 0) AS steps_off, COALESCE(SUM(mind), 0) AS mind_on FROM discover_settings').first<{ assistant_on: number; steps_off: number; mind_on: number }>(),
    db.prepare("SELECT action, COUNT(*) AS n FROM audit_logs WHERE action IN ('user.xp', 'user.badge', 'user.points', 'user.honor') AND created_at >= ? GROUP BY action").bind(since30).all<{ action: string; n: number }>(),
    db.prepare('SELECT level, COUNT(*) AS n FROM app_logs WHERE at >= ? GROUP BY level').bind(since24).all<{ level: string; n: number }>(),
    // How many people finished each Discover add-on: counts only, never an answer or a result.
    db.prepare('SELECT kind, COUNT(*) AS n FROM discover_extras WHERE result_json IS NOT NULL GROUP BY kind').all<{ kind: string; n: number }>(),
  ]);
  const grant = (a: string) => grantRows.results.find((r) => r.action === a)?.n ?? 0;
  const extra = (k: string) => extraRows.results.find((r) => r.kind === k)?.n ?? 0;
  const lg = (l: string) => logRows.results.find((r) => r.level === l)?.n ?? 0;
  const additions: ObservedAdditions = {
    games: CARD_GAMES.map((g) => ({ key: g.key, name: g.name, emoji: g.emoji, unlocked: unlocks.results.find((r) => r.game_key === g.key)?.n ?? 0 })),
    discover: { results: dz?.results ?? 0, people: dz?.people ?? 0, withEq: dz?.with_eq ?? 0, assistantOn: dset?.assistant_on ?? 0, stepsOff: dset?.steps_off ?? 0, addons: { type: extra('type'), love: extra('love'), mind: extra('mind'), design: extra('design') }, mindOn: dset?.mind_on ?? 0 },
    grants: { xp: grant('user.xp'), badges: grant('user.badge'), points: grant('user.points'), honors: grant('user.honor') },
    logs: { errors: lg('error'), warnings: lg('warn'), changes: lg('info') },
  };
  const matched = q ? people.filter((p) => p.name.toLowerCase().includes(q) || (p.handle ?? '').toLowerCase().includes(q)) : people;
  const res: ObservabilityResponse = {
    totals,
    additions,
    roles,
    apps: MODULES.map((m) => ({ key: m.key, name: m.name, emoji: m.emoji, group: m.group, on: on.get(m.key) ?? 0 })),
    users: matched.slice(ask.offset, ask.offset + ask.size),
    total: matched.length,
    page: { page: ask.page, size: ask.size, more: matched.length > ask.offset + ask.size },
  };
  return c.json(res);
});

internal.post('/users/:id/role', async (c) => {
  const db = c.env.DB;
  const me = c.get('user');
  if (me.role !== 'admin') return c.json({ error: 'only an admin changes roles' }, 403);
  const body = await c.req.json<{ role?: unknown }>().catch(() => ({}) as { role?: unknown });
  if (!isRole(body.role)) return c.json({ error: `role must be one of ${ROLES.join(', ')}` }, 400);
  const target = await getUser(db, c.req.param('id'));
  if (!target) return c.json({ error: 'not found' }, 404);
  if (target.id === me.id) return c.json({ error: 'you cannot change your own role' }, 400);
  await db.prepare('UPDATE users SET role = ? WHERE id = ?').bind(body.role, target.id).run();
  await audit(db, me.id, 'user.role', 'user', target.id, target.role, body.role);
  return c.json({ user: { id: target.id, name: target.display_name, handle: target.handle, role: body.role } });
});

interface LogRow { id: number; at: string; level: LogEntry['level']; area: string; method: string; path: string; status: number; ms: number; actor_id: string | null; actor_name: string | null; message: string }

// The app's own log: what happened, where and by whom. Super admins only, because it names people. No bodies, and nothing from the
// private areas (journal, wellbeing, Companion, Discover, assistant) beyond a bare server-error line.
internal.get('/logs', async (c) => {
  const user = c.get('user');
  if (roleRank(user.role) < roleRank('admin')) return c.json({ error: 'only a super admin reads the logs' }, 403);
  const db = c.env.DB;
  const ask = pageOf(c);
  const level = c.req.query('level');
  const area = (c.req.query('area') ?? '').slice(0, 40);
  const actor = (c.req.query('actor') ?? '').slice(0, 60);
  const q = (c.req.query('q') ?? '').trim().toLowerCase().slice(0, 60);
  const where: string[] = [];
  const binds: unknown[] = [];
  if (level === 'info' || level === 'warn' || level === 'error') {
    where.push('level = ?');
    binds.push(level);
  }
  if (area) {
    where.push('area = ?');
    binds.push(area);
  }
  if (actor) {
    where.push('actor_id = ?');
    binds.push(actor);
  }
  if (q) {
    where.push("(LOWER(path) LIKE ? OR LOWER(message) LIKE ? OR LOWER(COALESCE(actor_name, '')) LIKE ? OR actor_id = ?)");
    binds.push(`%${q}%`, `%${q}%`, `%${q}%`, q);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const since24 = new Date(Date.now() - 86_400_000).toISOString();
  const week = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [rows, counts, areas, actors] = await Promise.all([
    db.prepare(`SELECT * FROM app_logs ${clause} ORDER BY id DESC LIMIT ? OFFSET ?`).bind(...binds, ask.limit, ask.offset).all<LogRow>(),
    db.prepare('SELECT level, COUNT(*) AS n FROM app_logs WHERE at >= ? GROUP BY level').bind(since24).all<{ level: string; n: number }>(),
    db.prepare('SELECT DISTINCT area FROM app_logs WHERE at >= ? ORDER BY area').bind(week).all<{ area: string }>(),
    db.prepare('SELECT actor_id, MAX(actor_name) AS actor_name, COUNT(*) AS n FROM app_logs WHERE actor_id IS NOT NULL AND at >= ? GROUP BY actor_id ORDER BY n DESC LIMIT 60').bind(week).all<{ actor_id: string; actor_name: string | null; n: number }>(),
  ]);
  const pg = paged(rows.results, ask);
  const n = (l: string) => counts.results.find((r) => r.level === l)?.n ?? 0;
  const res: LogsResponse = {
    logs: pg.items.map((r) => ({ id: r.id, at: r.at, level: r.level, area: r.area, method: r.method, path: r.path, status: r.status, ms: r.ms, actorId: r.actor_id, actorName: r.actor_name, message: r.message })),
    page: pg.page,
    last24h: { info: n('info'), warn: n('warn'), error: n('error') },
    areas: areas.results.map((r) => r.area),
    actors: actors.results.map((r) => ({ id: r.actor_id, name: r.actor_name ?? 'Unnamed', count: r.n })),
  };
  return c.json(res);
});
