import { Hono } from 'hono';
import type { Organization, OrganizationMember } from '@kreators/shared';
import { CONNECT_ADMIN_ONLY, type OrgInvite } from '@kreators/shared/connect';
import type { AppEnv, UserRow } from '../env';
import { audit, blockedByName, can, DELETED_NAME, nameOf, newId, noteStmt, notifyMany, nowIso, objectBody, oneOf, orgRole, str } from '../db';
import { connectionsCameTrue } from '../invites';
import { adminHolds } from '../connectRank';

export const orgs = new Hono<AppEnv>();
/** The person's side of a brand's ask (2026-11-10): read it, say yes or no. Mounted at /me/org-invites, core, so Army being off never stops a no. */
export const myOrgInvites = new Hono<AppEnv>();

interface OrgRow { id: string; name: string; type: Organization['type']; status: Organization['status']; created_at: string; my_role?: 'owner' | 'member' | null }
const toOrg = (r: OrgRow): Organization => ({ id: r.id, name: r.name, type: r.type, status: r.status, myRole: r.my_role ?? null, createdAt: r.created_at });

orgs.get('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const all = c.req.query('all') === '1' && can(user, 'talent');
  // An ask still waiting is not a role: only an active membership is (2026-11-10, a brand's team is joined by a yes).
  const rows = all
    ? await db.prepare("SELECT o.*, (SELECT role FROM organization_members m WHERE m.organization_id = o.id AND m.user_id = ? AND m.status = 'active') AS my_role FROM organizations o ORDER BY o.name LIMIT 200").bind(user.id).all<OrgRow>()
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

// The team, and for its owner and talent staff the asks still waiting (so one can be taken back). Members are only those who said yes.
orgs.get('/:id/members', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const id = c.req.param('id');
  const role = await orgRole(db, id, user.id);
  if (!role && !can(user, 'talent')) return c.json({ error: 'not your organization' }, 403);
  const rows = await db
    .prepare("SELECT m.user_id, m.role, m.status, u.display_name, u.email FROM organization_members m JOIN users u ON u.id = m.user_id WHERE m.organization_id = ? AND m.status IN ('active', 'invited') ORDER BY m.created_at")
    .bind(id)
    .all<{ user_id: string; role: 'owner' | 'member'; status: string; display_name: string; email: string | null }>();
  const as = (r: (typeof rows.results)[number]): OrganizationMember => ({ userId: r.user_id, name: nameOf(r), email: r.email, role: r.role });
  const members = rows.results.filter((r) => r.status === 'active').map(as);
  const invited = role === 'owner' || can(user, 'talent') ? rows.results.filter((r) => r.status === 'invited').map(as) : [];
  return c.json({ members, invited });
});

/**
 * Ask someone onto a brand's team (2026-11-10, the founder: an ask they answer, not an add). One action, two callers: the owner's own
 * form below and Admin, Connect people (adminConnect.ts). Writes the membership as `invited`, which no reader counts as a member, and tells
 * the person, who says yes or no on their Profile tab. A block with any of the brand's owners reads as nobody, as everywhere.
 */
export async function inviteToOrg(db: D1Database, org: { id: string; name: string }, person: UserRow, by: string): Promise<{ code: 201 } | { code: 404 | 409; error: string }> {
  const row = await db
    .prepare(
      `SELECT (SELECT status FROM organization_members WHERE organization_id = ?1 AND user_id = ?2) AS status,
        EXISTS (SELECT 1 FROM organization_members o WHERE o.organization_id = ?1 AND o.role = 'owner' AND o.status = 'active' AND ${blockedByName('o.user_id', '?2')}) AS blocked`,
    )
    .bind(org.id, person.id)
    .first<{ status: string | null; blocked: number }>();
  if (row?.blocked) return { code: 404, error: 'no account with that email yet. Ask them to sign up first.' };
  if (row?.status === 'active') return { code: 409, error: 'They are on the team already.' };
  if (row?.status === 'invited') return { code: 409, error: 'They were asked already. They answer on their Profile tab.' };
  const res = await db.prepare("INSERT OR IGNORE INTO organization_members (organization_id, user_id, role, status, created_at) VALUES (?, ?, 'member', 'invited', ?)").bind(org.id, person.id, nowIso()).run();
  if (!res.meta.changes) return { code: 409, error: 'They were asked already. They answer on their Profile tab.' };
  // A fixed id, one note per brand and person, so a block that takes the ask away takes its note too (blockAsks.ts).
  await noteStmt(db, { id: `org-ask-${org.id}-${person.id}`, userId: person.id, kind: 'org', title: `${by} asked you to join ${org.name}`, body: 'Say yes or no on your Profile tab. You join its team only if you say yes.', link: '/you#org-invites' }, 'renew').run();
  return { code: 201 };
}

// Ask a teammate by the email on their account.
orgs.post('/:id/members', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const id = c.req.param('id');
  const role = await orgRole(db, id, user.id);
  if (role !== 'owner' && !can(user, 'talent')) return c.json({ error: 'only the owner can add people' }, 403);
  const body = await c.req.json<{ email?: string }>().catch(() => ({}) as { email?: string });
  const email = str(body.email, 120).toLowerCase();
  const person = email ? await db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<UserRow>() : null;
  const org = await db.prepare('SELECT id, name FROM organizations WHERE id = ?').bind(id).first<{ id: string; name: string }>();
  if (!org) return c.json({ error: 'not found' }, 404);
  if (!person || person.display_name === DELETED_NAME) return c.json({ error: 'no account with that email yet. Ask them to sign up first.' }, 404);
  if (person.id === user.id) return c.json({ error: 'That is you.' }, 400);
  const r = await inviteToOrg(db, org, person, nameOf(user));
  if (r.code !== 201) return c.json({ error: r.error }, r.code);
  await audit(db, user.id, 'org.invite', 'organization', id, '', { user: person.id });
  return c.json({ ok: true, status: 'invited' }, 201);
});

// Remove a teammate, or take back an ask still waiting (the person is not told, as an Agency invite taken back).
orgs.delete('/:id/members/:userId', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const id = c.req.param('id');
  const owner = (await orgRole(db, id, user.id)) === 'owner';
  if (!owner && !can(user, 'talent')) return c.json({ error: 'only the owner can remove people' }, 403);
  // By rank (connectRank.ts): an ask an admin or the key made through Connect people is an admin's to take back, or the brand's own
  // owner's, never talent staff's, so Connect people's 403 is not one step from a 200 here (2026-11-10, the break-it check).
  if (!owner && user.role !== 'admin' && (await adminHolds(db, 'org', id, c.req.param('userId')))) return c.json({ error: CONNECT_ADMIN_ONLY }, 403);
  // Says whether a row went (2026-11-14, for All tables): an owner stays, and someone already off the team is not taken off twice.
  if (!(await withdrawFromOrg(db, id, c.req.param('userId'), ['active', 'invited']))) return c.json({ error: 'They are not on this team, or they own it, so nothing changed.' }, 404);
  return c.json({ ok: true });
});

/**
 * Leave a brand's team (2026-11-14, from All tables): the person's own membership, never the last owner (who would leave a brand nobody runs;
 * 409 in words), in one guarded statement, so a second send leaves nothing twice (404). The team's Connect row ends with it, and the owners
 * still on the team are told. Core, like the answer to an ask: Army being off never keeps someone on a team.
 */
orgs.delete('/:id/membership', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const id = c.req.param('id');
  const org = await db.prepare('SELECT id, name FROM organizations WHERE id = ?').bind(id).first<{ id: string; name: string }>();
  if (!org) return c.json({ error: 'not found' }, 404);
  const now = nowIso();
  const [gone] = await db.batch([
    db
      .prepare(
        "DELETE FROM organization_members WHERE organization_id = ?1 AND user_id = ?2 AND status = 'active' AND (role != 'owner' OR (SELECT COUNT(*) FROM organization_members o WHERE o.organization_id = ?1 AND o.role = 'owner' AND o.status = 'active') > 1)",
      )
      .bind(id, user.id),
    db.prepare("UPDATE team_connections SET ended_at = ? WHERE kind = 'org' AND ref_id = ? AND first_user_id = ? AND ended_at IS NULL AND changes() = 1").bind(now, id, user.id),
  ]);
  if (!gone?.meta.changes) {
    const role = await orgRole(db, id, user.id);
    return role === 'owner' ? c.json({ error: 'You are its only owner, so you stay with it.' }, 409) : c.json({ error: 'You are not on this team.' }, 404);
  }
  const owners = await db.prepare("SELECT user_id FROM organization_members WHERE organization_id = ? AND role = 'owner' AND status = 'active' LIMIT 20").bind(id).all<{ user_id: string }>();
  // One round trip for every owner (`notifyMany`), so a leave costs the same however many own the brand (a table's bulk remove sends several).
  await notifyMany(db, owners.results.map((o) => o.user_id), 'org', `${nameOf(user)} left ${org.name}`, 'They no longer see its campaigns in Army.', '/army');
  await audit(db, user.id, 'org.leave', 'organization', id, '', '');
  return c.json({ ok: true });
});

/** Take someone off a brand's team, or take back their ask; never an owner. Returns whether a row went. Ends the team's Connect row with it. */
export async function withdrawFromOrg(db: D1Database, orgId: string, userId: string, states: readonly ('active' | 'invited')[]): Promise<boolean> {
  const res = await db.prepare("DELETE FROM organization_members WHERE organization_id = ? AND user_id = ? AND role != 'owner' AND status IN (SELECT value FROM json_each(?))").bind(orgId, userId, JSON.stringify(states)).run();
  if (res.meta.changes) await db.prepare("UPDATE team_connections SET ended_at = ? WHERE kind = 'org' AND ref_id = ? AND first_user_id = ? AND ended_at IS NULL").bind(nowIso(), orgId, userId).run();
  return res.meta.changes > 0;
}

// ---- the person's side (/me/org-invites, core)

/** A block by name either way between this person and any of the brand's owners: an ask across it is as good as gone (2026-11-10, the break-it check). */
const ownerBlocked = (orgId: string, userId: string) =>
  `EXISTS (SELECT 1 FROM organization_members ob WHERE ob.organization_id = ${orgId} AND ob.role = 'owner' AND ob.status = 'active' AND ${blockedByName('ob.user_id', userId)})`;

myOrgInvites.get('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const rows = await db
    .prepare(`SELECT o.id, o.name, o.type, m.created_at FROM organization_members m JOIN organizations o ON o.id = m.organization_id WHERE m.user_id = ?1 AND m.status = 'invited' AND o.status = 'active' AND NOT ${ownerBlocked('o.id', '?1')} ORDER BY m.created_at DESC LIMIT 20`)
    .bind(user.id)
    .all<{ id: string; name: string; type: string; created_at: string }>();
  const invites: OrgInvite[] = rows.results.map((r) => ({ orgId: r.id, name: r.name, type: r.type, createdAt: r.created_at }));
  return c.json({ invites });
});

// Yes makes them a member and tells the owners; no takes the ask away and tells nobody who said no, as a declined friend request in Bond.
// Each is one guarded statement on the ask still waiting, so two taps answer once.
myOrgInvites.post('/:orgId/answer', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const orgId = c.req.param('orgId');
  const body = await objectBody(c);
  if (typeof body.yes !== 'boolean') return c.json({ error: 'yes or no?' }, 400);
  const org = await db.prepare('SELECT id, name FROM organizations WHERE id = ?').bind(orgId).first<{ id: string; name: string }>();
  if (!org) return c.json({ error: 'not found' }, 404);
  const now = nowIso();
  if (!body.yes) {
    const res = await db.prepare("DELETE FROM organization_members WHERE organization_id = ? AND user_id = ? AND status = 'invited'").bind(orgId, user.id).run();
    if (!res.meta.changes) return c.json({ error: 'not found' }, 404);
    // Answered and over: the row reads "Said no" in Connect people for good, and a later ask, or a yes to one, never touches it.
    await db.prepare("UPDATE team_connections SET answered_at = ?1, ended_at = ?1 WHERE kind = 'org' AND ref_id = ?2 AND first_user_id = ?3 AND ended_at IS NULL AND answered_at IS NULL").bind(now, orgId, user.id).run();
    await audit(db, user.id, 'org.invite.answer', 'organization', orgId, '', { yes: false });
    return c.json({ ok: true, status: 'declined' });
  }
  // Guarded on no block either way with an owner, made after the ask: then the ask goes, and the answer is as for no ask at all.
  const res = await db.prepare(`UPDATE organization_members SET status = 'active', created_at = ?1 WHERE organization_id = ?2 AND user_id = ?3 AND status = 'invited' AND NOT ${ownerBlocked('?2', '?3')}`).bind(now, orgId, user.id).run();
  if (!res.meta.changes) {
    await db.prepare("DELETE FROM organization_members WHERE organization_id = ? AND user_id = ? AND status = 'invited'").bind(orgId, user.id).run();
    return c.json({ error: 'not found' }, 404);
  }
  await db.prepare("UPDATE team_connections SET answered_at = ? WHERE kind = 'org' AND ref_id = ? AND first_user_id = ? AND ended_at IS NULL AND answered_at IS NULL").bind(now, orgId, user.id).run();
  const owners = await db.prepare("SELECT user_id FROM organization_members WHERE organization_id = ? AND role = 'owner' AND status = 'active' LIMIT 20").bind(orgId).all<{ user_id: string }>();
  await notifyMany(db, owners.results.map((o) => o.user_id), 'org', `${nameOf(user)} joined ${org.name}`, 'They can see its campaigns in Army now.', '/army');
  await audit(db, user.id, 'org.invite.answer', 'organization', orgId, '', { yes: true });
  // A team's ask that came true pays once (invites.ts).
  await connectionsCameTrue(db, 'org', { refId: orgId, userId: user.id });
  return c.json({ ok: true, status: 'member' });
});
