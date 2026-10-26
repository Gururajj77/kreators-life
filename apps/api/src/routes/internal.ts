import { isRole, MODULES, roleRank, ROLES, type ObservabilityResponse, type ObservedUser, type Role } from '@kreators/shared';
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
  const matched = q ? people.filter((p) => p.name.toLowerCase().includes(q) || (p.handle ?? '').toLowerCase().includes(q)) : people;
  const res: ObservabilityResponse = {
    totals,
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
