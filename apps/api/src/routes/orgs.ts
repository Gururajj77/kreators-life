import { Hono } from 'hono';
import type { Organization, OrganizationMember } from '@kreators/shared';
import type { AppEnv } from '../env';
import { audit, can, nameOf, newId, notify, nowIso, oneOf, orgRole, str } from '../db';

export const orgs = new Hono<AppEnv>();

interface OrgRow { id: string; name: string; type: Organization['type']; status: Organization['status']; created_at: string; my_role?: 'owner' | 'member' | null }
const toOrg = (r: OrgRow): Organization => ({ id: r.id, name: r.name, type: r.type, status: r.status, myRole: r.my_role ?? null, createdAt: r.created_at });

orgs.get('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const all = c.req.query('all') === '1' && can(user, 'talent');
  const rows = all
    ? await db.prepare('SELECT o.*, (SELECT role FROM organization_members m WHERE m.organization_id = o.id AND m.user_id = ?) AS my_role FROM organizations o ORDER BY o.name LIMIT 200').bind(user.id).all<OrgRow>()
    : await db.prepare("SELECT o.*, m.role AS my_role FROM organizations o JOIN organization_members m ON m.organization_id = o.id WHERE m.user_id = ? AND m.status = 'active' ORDER BY o.name").bind(user.id).all<OrgRow>();
  return c.json({ organizations: rows.results.map(toOrg) });
});

// Brands self-serve: whoever creates the organization owns it.
orgs.post('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const name = str(body.name, 80);
  if (!name) return c.json({ error: 'name required' }, 400);
  const id = newId();
  const now = nowIso();
  await db.batch([
    db.prepare('INSERT INTO organizations (id, name, type, status, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(id, name, oneOf(body.type, ['brand', 'agency', 'partner'] as const, 'brand'), 'active', user.id, now),
    db.prepare("INSERT INTO organization_members (organization_id, user_id, role, status, created_at) VALUES (?, ?, 'owner', 'active', ?)").bind(id, user.id, now),
  ]);
  await audit(db, user.id, 'org.create', 'organization', id, '', name);
  const row = await db.prepare('SELECT o.*, ? AS my_role FROM organizations o WHERE o.id = ?').bind('owner', id).first<OrgRow>();
  return c.json({ organization: row ? toOrg(row) : null }, 201);
});

orgs.get('/:id/members', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const id = c.req.param('id');
  if (!(await orgRole(db, id, user.id)) && !can(user, 'talent')) return c.json({ error: 'not your organization' }, 403);
  const rows = await db.prepare("SELECT m.user_id, m.role, u.display_name, u.email FROM organization_members m JOIN users u ON u.id = m.user_id WHERE m.organization_id = ? AND m.status = 'active'").bind(id).all<{ user_id: string; role: 'owner' | 'member'; display_name: string; email: string | null }>();
  const members: OrganizationMember[] = rows.results.map((r) => ({ userId: r.user_id, name: nameOf(r), email: r.email, role: r.role }));
  return c.json({ members });
});

// Add a teammate by the email on their account.
orgs.post('/:id/members', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const id = c.req.param('id');
  const role = await orgRole(db, id, user.id);
  if (role !== 'owner' && !can(user, 'talent')) return c.json({ error: 'only the owner can add people' }, 403);
  const body = await c.req.json<{ email?: string }>().catch(() => ({}) as { email?: string });
  const email = str(body.email, 120).toLowerCase();
  const person = await db.prepare('SELECT id, display_name FROM users WHERE email = ?').bind(email).first<{ id: string; display_name: string }>();
  if (!person) return c.json({ error: 'no account with that email yet. Ask them to sign up first.' }, 404);
  await db.prepare("INSERT OR REPLACE INTO organization_members (organization_id, user_id, role, status, created_at) VALUES (?, ?, 'member', 'active', ?)").bind(id, person.id, nowIso()).run();
  const org = await db.prepare('SELECT name FROM organizations WHERE id = ?').bind(id).first<{ name: string }>();
  await notify(db, person.id, 'org', `You were added to ${org?.name ?? 'a brand'}`, 'Open Army to see its campaigns.', '/army');
  return c.json({ ok: true }, 201);
});

orgs.delete('/:id/members/:userId', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const id = c.req.param('id');
  if ((await orgRole(db, id, user.id)) !== 'owner' && !can(user, 'talent')) return c.json({ error: 'only the owner can remove people' }, 403);
  await db.prepare("DELETE FROM organization_members WHERE organization_id = ? AND user_id = ? AND role != 'owner'").bind(id, c.req.param('userId')).run();
  return c.json({ ok: true });
});
