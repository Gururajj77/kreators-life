import { Hono } from 'hono';
import {
  MAX_TEAM,
  MAX_TEAM_INVITES,
  TEAM_ROLE_META,
  isTeamRole,
  parseTeamAccess,
  teamAllows,
  teamDefaults,
  type MyTeam,
  type PortalView,
  type TeamMember,
  type TeamRole,
  type TeamStatus,
} from '@kreators/shared';
import type { AppEnv } from '../env';
import { blockedEither, DELETED_NAME, liveUser, nameOf, noteStmt, notify, nowIso, newId, pageOf, paged, personBy, publicOf, str } from '../db';
import { agencyFace } from '../portalAccess';
import { requestFriend } from './bond';
import { portalClientById, portalViewFor, type PortalPending } from './agency';

/**
 * The Agency team (wave 14). `agencyTeam` is the owner's side, mounted at /agency/team (gated by the `agency` module; the team gate refuses
 * it to any member). `myTeams` is the member's side, mounted at /me/teams, which is core like /me/coach: a person can always answer an
 * invite or leave a team, even when Agency is off for them. Owner only to manage, the member only to answer, leave or (a client member)
 * read their own client's page. What a member may open is enforced by the gate in agencyTeamAccess.ts.
 */
export const agencyTeam = new Hono<AppEnv>();
export const myTeams = new Hono<AppEnv>();

const NOT_FOUND_PERSON = 'We could not find that person.';
const bodyOf = (c: { req: { json: <T>() => Promise<T> } }) => c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);

interface TeamRow {
  id: string;
  owner_id: string;
  member_id: string;
  role: TeamRole;
  status: TeamStatus;
  access_json: string;
  client_id: string | null;
  ended_by: string | null;
  invited_at: string;
  joined_at: string | null;
  removed_at: string | null;
  updated_at: string;
}

const accessOf = (r: Pick<TeamRow, 'access_json' | 'role'>) => {
  try {
    return parseTeamAccess(JSON.parse(r.access_json || '{}'), r.role);
  } catch {
    return teamDefaults(r.role);
  }
};

/** One inbox line with a fixed id: written once, and rewritten in place (back to unread, newest) when it is sent again. */
async function teamNote(db: D1Database, userId: string, id: string, title: string, body: string, link: string): Promise<void> {
  await noteStmt(db, { id, userId, kind: 'agency', title: title.slice(0, 200), body: body.slice(0, 300), link }, 'renew').run();
}

async function agencyNameOf(db: D1Database, ownerId: string): Promise<string> {
  return (await agencyFace(db, ownerId)).agencyName || 'An agency';
}

const roleWord = (r: TeamRole) => TEAM_ROLE_META[r].name;
const article = (w: string) => (/^[aeiou]/i.test(w) ? 'an' : 'a');

// ---- the owner's side

agencyTeam.get('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const ask = pageOf(c, 'tm');
  const rows = await db
    .prepare(
      `SELECT t.*, u.display_name, u.handle, u.avatar_url, ac.name AS client_name,
        EXISTS (SELECT 1 FROM friendships f WHERE f.status = 'accepted' AND ((f.requester_id = t.owner_id AND f.recipient_id = t.member_id) OR (f.requester_id = t.member_id AND f.recipient_id = t.owner_id))) AS friends
       FROM agency_team t JOIN users u ON u.id = t.member_id LEFT JOIN agency_clients ac ON ac.id = t.client_id
       WHERE t.owner_id = ? AND ${liveUser('u')}
       ORDER BY CASE t.status WHEN 'active' THEN 0 WHEN 'invited' THEN 1 ELSE 2 END, COALESCE(t.removed_at, t.joined_at, t.invited_at) DESC LIMIT ? OFFSET ?`,
    )
    .bind(user.id, ask.limit, ask.offset)
    .all<TeamRow & { display_name: string; handle: string | null; avatar_url: string; client_name: string | null; friends: number }>();
  const pg = paged(rows.results, ask);
  const members: TeamMember[] = pg.items.map((r) => ({
    id: r.id,
    role: r.role,
    status: r.status,
    access: accessOf(r),
    client: r.client_id ? { id: r.client_id, name: r.client_name ?? '' } : null,
    person: { name: nameOf(r), handle: r.handle ?? '', avatarUrl: r.avatar_url ?? '' },
    invitedAt: r.invited_at,
    joinedAt: r.joined_at,
    friends: r.friends === 1,
  }));
  return c.json({ page: pg.page, members, max: MAX_TEAM, maxInvites: MAX_TEAM_INVITES });
});

// Ask someone to join: by email, @username or friend code. A block either way, a deleted account and nobody at all get the same words.
agencyTeam.post('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await bodyOf(c);
  const role = body.role;
  if (!isTeamRole(role)) return c.json({ error: 'pick a role' }, 400);
  const who = str(body.who, 200);
  if (!who) return c.json({ error: 'type their email, @username or friend code' }, 400);
  const target = await personBy(db, who);
  if (target && target.id === user.id) return c.json({ error: 'That is you. Ask someone else.' }, 400);
  const blocked = target ? await blockedEither(db, user.id, target.id) : false;
  if (!target || target.display_name === DELETED_NAME || blocked) return c.json({ error: NOT_FOUND_PERSON }, 404);
  let clientId: string | null = null;
  if (role === 'client') {
    const cl = typeof body.clientId === 'string' ? await db.prepare('SELECT id FROM agency_clients WHERE id = ? AND user_id = ?').bind(body.clientId, user.id).first<{ id: string }>() : null;
    if (!cl) return c.json({ error: 'pick which client they are' }, 400);
    clientId = cl.id;
  }
  const [open, counts] = await Promise.all([
    db.prepare("SELECT id FROM agency_team WHERE owner_id = ? AND member_id = ? AND status IN ('invited', 'active')").bind(user.id, target.id).first(),
    db.prepare("SELECT COUNT(*) AS n, SUM(CASE WHEN status = 'invited' THEN 1 ELSE 0 END) AS waiting FROM agency_team WHERE owner_id = ? AND status IN ('invited', 'active')").bind(user.id).first<{ n: number; waiting: number | null }>(),
  ]);
  if (open) return c.json({ error: 'They are already on your team or invited.' }, 409);
  if ((counts?.n ?? 0) >= MAX_TEAM) return c.json({ error: `A team holds up to ${MAX_TEAM} people.` }, 400);
  if ((counts?.waiting ?? 0) >= MAX_TEAM_INVITES) return c.json({ error: `Up to ${MAX_TEAM_INVITES} invites can wait at once. Resend or remove one first.` }, 400);
  const access = parseTeamAccess(body.access ?? teamDefaults(role), role);
  const id = newId();
  const now = nowIso();
  try {
    await db
      .prepare("INSERT INTO agency_team (id, owner_id, member_id, role, status, access_json, client_id, invited_at, updated_at) VALUES (?, ?, ?, ?, 'invited', ?, ?, ?, ?)")
      .bind(id, user.id, target.id, role, JSON.stringify(access), clientId, now, now)
      .run();
  } catch {
    // Two taps at once: the unique open row lets one in.
    return c.json({ error: 'They are already on your team or invited.' }, 409);
  }
  const agencyName = await agencyNameOf(db, user.id);
  const word = roleWord(role);
  await teamNote(db, target.id, `team-${id}`, `${agencyName} asked you to join their Agency as ${article(word)} ${word.toLowerCase()}`, 'Accept or decline in Agency.', `/agency?team=${id}`);
  // A friend request too, when they are not friends yet and the person takes requests. requestFriend refuses across a block and turns an
  // ask they made first into a yes. When they do not take requests, the invite still goes and nothing is said to them about it.
  const friends = await db.prepare("SELECT 1 AS x FROM friendships WHERE status = 'accepted' AND ((requester_id = ?1 AND recipient_id = ?2) OR (requester_id = ?2 AND recipient_id = ?1))").bind(user.id, target.id).first();
  let friendRequest: 'sent' | 'friends' | 'skipped' = friends ? 'friends' : 'skipped';
  if (!friends && publicOf(target).allowFriendRequests) {
    const r = await requestFriend(db, user, target.id, `${agencyName} on Agency`);
    friendRequest = r.code === 201 ? 'sent' : r.body.status === 'friends' ? 'friends' : r.code === 409 && r.body.error === 'already asked' ? 'sent' : 'skipped';
  }
  return c.json({ id, friendRequest }, 201);
});

// Change a member's role, access or tied client. A new role starts from its defaults unless access comes with it.
agencyTeam.patch('/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await db.prepare("SELECT * FROM agency_team WHERE id = ? AND owner_id = ? AND status IN ('invited', 'active')").bind(c.req.param('id'), user.id).first<TeamRow>();
  if (!row) return c.json({ error: 'not found' }, 404);
  const body = await bodyOf(c);
  const role: TeamRole = 'role' in body ? (isTeamRole(body.role) ? body.role : row.role) : row.role;
  if ('role' in body && !isTeamRole(body.role)) return c.json({ error: 'pick a role' }, 400);
  let clientId: string | null = role === 'client' ? row.client_id : null;
  if (role === 'client' && ('clientId' in body || !clientId)) {
    const cl = typeof body.clientId === 'string' ? await db.prepare('SELECT id FROM agency_clients WHERE id = ? AND user_id = ?').bind(body.clientId, user.id).first<{ id: string }>() : null;
    if (!cl) return c.json({ error: 'pick which client they are' }, 400);
    clientId = cl.id;
  }
  const access = 'access' in body ? parseTeamAccess(body.access, role) : role !== row.role ? teamDefaults(role) : parseTeamAccess(JSON.parse(row.access_json || '{}'), role);
  const res = await db
    .prepare("UPDATE agency_team SET role = ?, access_json = ?, client_id = ?, updated_at = ? WHERE id = ? AND owner_id = ? AND status IN ('invited', 'active')")
    .bind(role, JSON.stringify(access), clientId, nowIso(), row.id, user.id)
    .run();
  if (!res.meta.changes) return c.json({ error: 'not found' }, 404);
  if (row.status === 'active') {
    const agencyName = await agencyNameOf(db, user.id);
    await teamNote(db, row.member_id, `team-access-${row.id}`, `Your access to ${agencyName} changed`, `You are ${article(roleWord(role))} ${roleWord(role).toLowerCase()} there now.`, `/agency?team=${row.id}`);
  }
  return c.json({ id: row.id, role, access, clientId });
});

// Send the invite again: the same inbox line back to unread, at most once a day, and no second friend request.
agencyTeam.post('/:id/resend', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await db.prepare("SELECT * FROM agency_team WHERE id = ? AND owner_id = ? AND status = 'invited'").bind(c.req.param('id'), user.id).first<TeamRow>();
  if (!row) return c.json({ error: 'not found' }, 404);
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  const res = await db.prepare("UPDATE agency_team SET updated_at = ? WHERE id = ? AND owner_id = ? AND status = 'invited' AND updated_at <= ?").bind(nowIso(), row.id, user.id, dayAgo).run();
  if (!res.meta.changes) return c.json({ error: 'You asked today already.' }, 400);
  const agencyName = await agencyNameOf(db, user.id);
  const word = roleWord(row.role);
  await teamNote(db, row.member_id, `team-${row.id}`, `${agencyName} asked you to join their Agency as ${article(word)} ${word.toLowerCase()}`, 'Accept or decline in Agency.', `/agency?team=${row.id}`);
  return c.json({ ok: true });
});

// Remove someone (or take back an invite). Their access ends on their next request, since the gate reads the row every time.
agencyTeam.delete('/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const now = nowIso();
  const row = await db.prepare("SELECT * FROM agency_team WHERE id = ? AND owner_id = ? AND status IN ('invited', 'active')").bind(c.req.param('id'), user.id).first<TeamRow>();
  if (!row) return c.json({ error: 'not found' }, 404);
  const res = await db.prepare("UPDATE agency_team SET status = 'removed', ended_by = 'owner', removed_at = ?, updated_at = ? WHERE id = ? AND owner_id = ? AND status IN ('invited', 'active')").bind(now, now, row.id, user.id).run();
  if (!res.meta.changes) return c.json({ error: 'not found' }, 404);
  const agencyName = await agencyNameOf(db, user.id);
  if (row.status === 'active') await notify(db, row.member_id, 'agency', `${agencyName} removed you from their team`, 'Their Agency is closed to you now.', '/agency');
  // A waiting invite that is taken back leaves no line to answer.
  else await db.prepare('DELETE FROM notifications WHERE id = ? AND user_id = ?').bind(`team-${row.id}`, row.member_id).run();
  return c.json({ ok: true });
});

// ---- the member's side (core)

myTeams.get('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const rows = await db
    .prepare(
      `SELECT t.*, ac.name AS client_name FROM agency_team t JOIN users u ON u.id = t.owner_id LEFT JOIN agency_clients ac ON ac.id = t.client_id
       WHERE t.member_id = ? AND t.status IN ('invited', 'active') AND ${liveUser('u')} ORDER BY CASE t.status WHEN 'invited' THEN 0 ELSE 1 END, t.invited_at DESC LIMIT 50`,
    )
    .bind(user.id)
    .all<TeamRow & { client_name: string | null }>();
  const faces = await Promise.all(rows.results.map((r) => agencyFace(db, r.owner_id)));
  const teams: MyTeam[] = rows.results.map((r, i) => ({
    id: r.id,
    agency: { name: faces[i]?.agencyName || 'An agency', logo: faces[i]?.agencyLogo ?? '' },
    role: r.role,
    status: r.status === 'active' ? 'active' : 'invited',
    access: accessOf(r),
    clientName: r.role === 'client' ? (r.client_name ?? '') : null,
    invitedAt: r.invited_at,
  }));
  return c.json({ teams });
});

// Yes or no to an invite. Guarded on the invite still waiting, so two taps answer once.
myTeams.post('/:id/answer', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await bodyOf(c);
  if (typeof body.yes !== 'boolean') return c.json({ error: 'yes or no?' }, 400);
  const row = await db.prepare("SELECT * FROM agency_team WHERE id = ? AND member_id = ? AND status = 'invited'").bind(c.req.param('id'), user.id).first<TeamRow>();
  if (!row) return c.json({ error: 'not found' }, 404);
  const now = nowIso();
  const res = body.yes
    ? await db.prepare("UPDATE agency_team SET status = 'active', joined_at = ?, updated_at = ? WHERE id = ? AND member_id = ? AND status = 'invited'").bind(now, now, row.id, user.id).run()
    : await db.prepare("UPDATE agency_team SET status = 'removed', ended_by = 'member', removed_at = ?, updated_at = ? WHERE id = ? AND member_id = ? AND status = 'invited'").bind(now, now, row.id, user.id).run();
  if (!res.meta.changes) return c.json({ error: 'You answered already.' }, 409);
  await db.prepare('UPDATE notifications SET read_at = COALESCE(read_at, ?) WHERE id = ? AND user_id = ?').bind(now, `team-${row.id}`, user.id).run();
  await notify(db, row.owner_id, 'agency', body.yes ? `${nameOf(user)} joined your team` : `${nameOf(user)} said no to joining your team`, body.yes ? `As ${article(roleWord(row.role))} ${roleWord(row.role).toLowerCase()}.` : '', '/agency?tab=team');
  return c.json({ ok: true, status: body.yes ? 'active' : 'removed' });
});

// Leave a team. Guarded on still being on it.
myTeams.post('/:id/leave', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await db.prepare("SELECT * FROM agency_team WHERE id = ? AND member_id = ? AND status = 'active'").bind(c.req.param('id'), user.id).first<TeamRow>();
  if (!row) return c.json({ error: 'not found' }, 404);
  const now = nowIso();
  const res = await db.prepare("UPDATE agency_team SET status = 'removed', ended_by = 'member', removed_at = ?, updated_at = ? WHERE id = ? AND member_id = ? AND status = 'active'").bind(now, now, row.id, user.id).run();
  if (!res.meta.changes) return c.json({ error: 'not found' }, 404);
  await notify(db, row.owner_id, 'agency', `${nameOf(user)} left your team`, '', '/agency?tab=team');
  return c.json({ ok: true });
});

/**
 * A client member's page: the client link's own view of their client, built by the same code (portalViewFor), then narrowed by their tabs.
 * Read only: approving, sending back, asking for a change and the onboarding form stay at the client link. Their own account is the key,
 * so the link's password is not asked; the owner tied this account to that client on purpose.
 */
myTeams.get('/:id/client-view', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await db
    .prepare(`SELECT t.* FROM agency_team t JOIN users u ON u.id = t.owner_id WHERE t.id = ? AND t.member_id = ? AND t.status = 'active' AND t.role = 'client' AND ${liveUser('u')}`)
    .bind(c.req.param('id'), user.id)
    .first<TeamRow>();
  if (!row || !row.client_id) return c.json({ error: 'You are no longer on that team.', reason: 'gone' }, 403);
  const client = await portalClientById(db, row.owner_id, row.client_id);
  if (!client) return c.json({ error: 'You are no longer on that team.', reason: 'gone' }, 403);
  const view = await portalViewFor(db, client, { visit: false });
  return c.json({ view: narrowView(view, accessOf(row)), access: accessOf(row) });
});

/** A client member's view, cut to their tabs: Overview the stage, what waits on them and progress; Pipeline the pieces; Paperwork the paper. */
function narrowView(view: PortalView | PortalPending, access: ReturnType<typeof accessOf>): PortalView | PortalPending {
  if (!('show' in view)) return view;
  const out: PortalView = { ...view };
  if (!teamAllows(access, 'overview', 'view')) {
    out.waitingOn = [];
    out.month = null;
    out.strategy = null;
    out.trial = null;
    out.pilot = null;
    out.retainer = null;
  }
  if (!teamAllows(access, 'pipeline', 'view')) {
    out.waiting = [];
    out.coming = [];
    out.published = [];
    out.channels = [];
    out.hours = null;
  }
  if (!teamAllows(access, 'paperwork', 'view')) {
    out.invoices = [];
    out.contracts = [];
    out.docs = [];
    // What waits on them links to paper only when they can see paper.
    out.waitingOn = out.waitingOn.map((w) => (w.href && /^\/[ikd]\//.test(w.href) ? { ...w, href: null } : w));
  }
  return out;
}
