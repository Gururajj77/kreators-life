import { Hono } from 'hono';
import { ADMIN_GUIDE_PROGRAM, PROGRAM_VISIBILITY_META, TEAM_ROLE_META, isTeamRole, type ProgramVisibility } from '@kreators/shared';
import {
  CONNECT_ADMIN_ONLY,
  CONNECT_ADMIN_ROW,
  CONNECT_KINDS,
  CONNECT_KIND_META,
  CONNECT_NOBODY,
  CONNECT_NOT_YOURSELF,
  CONNECT_PLACE_NOT_YOURS,
  CONNECT_REASON_MAX,
  connectKindsFor,
  isConnectKind,
  type ConnectKind,
  type ConnectMode,
  type ConnectPerson,
  type ConnectPlace,
  type ConnectPlaces,
  type ConnectState,
  type PersonConnection,
  type PersonConnections,
  type TeamConnection,
  type TeamSuggestion,
} from '@kreators/shared/connect';
import type { Context } from 'hono';
import type { AppEnv, UserRow } from '../env';
import { audit, blockedByName, blockedEither, can, DELETED_NAME, findPerson, getUser, liveUser, nameOf, newId, noteStmt, notify, nowIso, objectBody, pageOf, paged, parseList, publicOf, str } from '../db';
import { resolveAccess } from '../access';
import { endLink, linkById, logCoach, type LinkRow } from '../coaching';
import { linkProblem, startLink } from './coach';
import { requestFriend } from './bond';
import { inviteToTeam, removeFromTeam } from './agencyTeam';
import { cohortManagerSql, inviteToProgram, mayManageProgram, mayNameManager, PROGRAM_INVITER_ONLY, setCohortManager, uninviteFromProgram, VIS } from './school';
import { inviteToOrg, withdrawFromOrg } from './orgs';
import { COURSE_INVITER_ONLY, inviteToCourse, mayEditProduct, PRODUCT_SELECT, uninviteFromCourse, type ProductRow } from './studio';
import { nameClubManager } from './club';
import { payConnection } from '../invites';
import { madeAsOf, type MadeAs } from '../connectRank';

/**
 * Connect people (2026-11-09, the founder: "can u add ability to connect people in admin center? ... say a coach and student had to be
 * connected, and similar powers in admin are must for better management"). Mounted twice: at /admin/connect behind Admin's own door (an
 * admin's session or the admin key; admin.ts), and since 2026-11-10 (the founder: "yes to all") at /manage/connect behind Manage's
 * staff-only check, where a staff member makes, lists and ends only the kinds their permissions govern (`connectKindsFor` over
 * CONNECT_KIND_PERMISSION in shared connect.ts, checked here on every call; the screen only follows it). Every kind goes through the action the app already has for it, with
 * the team as its second caller: a coach link (startLink), an Agency team invite (inviteToTeam), a private program or course invite
 * (inviteToProgram, inviteToCourse), a Club manager (nameClubManager), a cohort's manager (setCohortManager), a brand's team (inviteToOrg);
 * and a friend suggestion, which both people answer and which makes
 * friends only through Bond's own requestFriend. Each connection is a row in team_connections (migration 0124) for the one list.
 *
 * `mySuggestions`, mounted at /me/suggestions (core), is the person's side of a friend suggestion: read it, say yes or no.
 */
export const adminConnect = new Hono<AppEnv>();
export const mySuggestions = new Hono<AppEnv>();

/** The kinds this caller may make, list and end: every kind for the admin key or an admin, a staff member's own kinds, none for anyone else. */
function kindsOf(c: Context<AppEnv>): ConnectKind[] {
  if (c.get('adminKeyOk')) return [...CONNECT_KINDS];
  const u = c.get('user');
  return u ? connectKindsFor({ role: u.role, permissions: parseList(u.permissions) }) : [];
}
const isAdminCaller = (c: Context<AppEnv>) => Boolean(c.get('adminKeyOk')) || c.get('user')?.role === 'admin';
/** The person acting, or null for the admin key, which has no person behind it and acts as the team. */
const actorOf = (c: Context<AppEnv>): UserRow | null => (c.get('adminKeyOk') ? null : (c.get('user') ?? null));
const FORBIDDEN = { error: 'That kind of connection is not yours to make.' } as const;

// Every call needs at least one kind: a staff member with no permission that governs one has nothing here.
adminConnect.use('*', async (c, next) => {
  if (!kindsOf(c).length) return c.json(FORBIDDEN, 403);
  await next();
});

const NOBODY = { error: CONNECT_NOBODY } as const;

const toPerson = (u: Pick<UserRow, 'id' | 'display_name' | 'handle' | 'avatar_url'>): ConnectPerson => ({ id: u.id, name: nameOf(u), handle: u.handle ?? '', avatarUrl: u.avatar_url ?? '' });

/**
 * The team's coach link, the one way: Admin's Life coaches route (POST /admin/coaching/links, kept for older tabs) and Connect people.
 * Ask the student (they say yes or no) or, when they agreed outside the app, link them now. The caller checked linkProblem and audits.
 */
export async function teamCoachLink(db: D1Database, actorId: string | null, coach: UserRow, student: UserRow, now: boolean): Promise<LinkRow | null> {
  // Two sends at once both pass linkProblem; the unique open link (coach_links_open) lets one in, and the other is answered as a pair asked already.
  const link = await startLink(db, { coachId: coach.id, studentId: student.id, askedBy: 'admin', createdBy: actorId, active: now }).catch(() => null);
  if (!link) return null;
  await logCoach(db, { linkId: link.id, coachId: coach.id, studentId: student.id, actorId: null, action: now ? 'link.admin' : 'link.ask', label: now ? `The team linked ${nameOf(coach)} and ${nameOf(student)}` : `The team asked ${nameOf(student)} to work with ${nameOf(coach)}` });
  await notify(db, student.id, 'coach', now ? `${nameOf(coach)} is your life coach now` : `The team suggests ${nameOf(coach)} as your life coach`, now ? 'Pick what they see on your Profile tab, or end it there.' : 'Say yes or no on your Profile tab. Nothing is shared until you say yes.', '/you#coach');
  await notify(db, coach.id, 'coach', now ? `${nameOf(student)} is your student now` : `The team asked ${nameOf(student)} to work with you`, now ? 'Open Coaching to see what they share.' : 'You hear back when they answer.', '/coaching');
  return link;
}

// ---- the form's lookups

// One person, for the preview under a field: a picture, a name and a handle, never an email, a phone or a birth date.
adminConnect.get('/person', async (c) => {
  const u = await findPerson(c.env.DB, str(c.req.query('who'), 200));
  if (!u) return c.json(NOBODY, 404);
  return c.json({ person: toPerson(u) });
});

// The places a kind can name: private programs, private Shop courses, cohorts, brands, or one owner's Agency clients. Each place follows
// its own rule (2026-11-10): an admin and the key reach every private program and course, a staff member only the ones they made or own
// (mayManageProgram, mayEditProduct), and a cohort is listed where mayNameManager lets this caller name its manager. The SQL narrows the
// read and the predicate is the gate, the same one POST and End ask, so the list can never offer what the send would refuse.
adminConnect.get('/places', async (c) => {
  const db = c.env.DB;
  const kind = c.req.query('kind');
  const kinds = kindsOf(c);
  const want: ConnectKind | null = kind === 'client' ? 'agency' : isConnectKind(kind) ? kind : null;
  if (want && !kinds.includes(want)) return c.json(FORBIDDEN, 403);
  const all = isAdminCaller(c);
  const actor = actorOf(c);
  const me = actor?.id ?? '';
  const answer = (places: ConnectPlace[], mine = false) => c.json({ places, mine } satisfies ConnectPlaces);
  if (kind === 'cohort') {
    // The newest 100 cohorts, shown in name order (2026-11-13): cut by name, a cohort made after the hundredth name could never be picked.
    const rows = await db
      .prepare(
        `SELECT * FROM (SELECT k.id, k.name, k.manager_user_id, p.id AS program_id, p.created_by, ${VIS} AS vis, p.name AS program, u.display_name AS manager FROM cohorts k JOIN programs p ON p.id = k.program_id LEFT JOIN users u ON u.id = k.manager_user_id
         WHERE p.id != ?1 AND (?2 = 1 OR ${cohortManagerSql('?3')}) ORDER BY k.created_at DESC, k.id LIMIT 100) ORDER BY program COLLATE NOCASE, name COLLATE NOCASE`,
      )
      .bind(ADMIN_GUIDE_PROGRAM, all ? 1 : 0, me)
      .all<{ id: string; name: string; manager_user_id: string | null; program_id: string; created_by: string | null; vis: ProgramVisibility; program: string; manager: string | null }>();
    const ok = rows.results.filter((r) => all || (actor && mayNameManager(actor, { vis: r.vis, cohortId: r.id, programId: r.program_id, createdBy: r.created_by })));
    // `label` is the cohort without who runs it, for the line after a send, which names the new manager (2026-11-10, the break-it check).
    return answer(ok.map((r): ConnectPlace => ({ id: r.id, name: `${r.program}, ${r.name}${r.manager ? `, run by ${nameOf({ display_name: r.manager })}` : ''}`, label: `${r.program}, ${r.name}`, pricePoints: 0, priceCents: 0, currency: 'INR', managerId: r.manager_user_id })));
  }
  if (kind === 'org') {
    const rows = await db.prepare("SELECT id, name FROM organizations WHERE status = 'active' ORDER BY name COLLATE NOCASE LIMIT 100").all<{ id: string; name: string }>();
    return answer(rows.results.map((r): ConnectPlace => ({ id: r.id, name: r.name, pricePoints: 0, priceCents: 0, currency: 'INR' })));
  }
  if (kind === 'program') {
    const rows = await db
      .prepare(`SELECT p.id, p.name, p.price_points, p.price_cents, p.currency, p.created_by FROM programs p WHERE ${VIS} = 'private' AND p.id != ?1 AND (?2 = 1 OR p.created_by = ?3) ORDER BY p.name COLLATE NOCASE LIMIT 100`)
      .bind(ADMIN_GUIDE_PROGRAM, all ? 1 : 0, me)
      .all<{ id: string; name: string; price_points: number; price_cents: number; currency: string; created_by: string | null }>();
    const ok = rows.results.filter((r) => all || mayManageProgram(actor, r));
    return answer(ok.map((r): ConnectPlace => ({ id: r.id, name: r.name, pricePoints: r.price_points, priceCents: r.price_cents, currency: r.currency })), !all);
  }
  if (kind === 'product') {
    const rows = await db
      .prepare("SELECT id, title, price_points, price_cents, currency, owner_id FROM products WHERE kind = 'course' AND status = 'private' AND (?1 = 1 OR owner_id = ?2) ORDER BY title COLLATE NOCASE LIMIT 100")
      .bind(all ? 1 : 0, me)
      .all<{ id: string; title: string; price_points: number; price_cents: number; currency: string; owner_id: string }>();
    const ok = rows.results.filter((r) => all || mayEditProduct(actor, r));
    return answer(ok.map((r): ConnectPlace => ({ id: r.id, name: r.title, pricePoints: r.price_points, priceCents: r.price_cents, currency: r.currency })), !all);
  }
  if (kind === 'client') {
    const owner = await findPerson(db, str(c.req.query('owner'), 200));
    if (!owner) return c.json(NOBODY, 404);
    const rows = await db.prepare('SELECT id, name FROM agency_clients WHERE user_id = ? ORDER BY name COLLATE NOCASE LIMIT 100').bind(owner.id).all<{ id: string; name: string }>();
    return answer(rows.results.map((r): ConnectPlace => ({ id: r.id, name: r.name, pricePoints: 0, priceCents: 0, currency: 'INR' })));
  }
  return c.json({ error: 'Pick program, product, client, cohort or org.' }, 400);
});

// ---- make a connection

type Made = { code: 201; ref: string | null; place: string } | { code: 400 | 403 | 404 | 409; error: string };

adminConnect.post('/', async (c) => {
  const db = c.env.DB;
  const body = await objectBody(c);
  const kind = body.kind;
  if (!isConnectKind(kind)) return c.json({ error: 'Pick a kind of connection.' }, 400);
  const meta = CONNECT_KIND_META[kind];
  if (body.mode !== undefined && body.mode !== 'ask' && body.mode !== 'direct') return c.json({ error: 'Pick ask or direct.' }, 400);
  const mode: ConnectMode = body.mode === 'direct' ? 'direct' : meta.modes.includes('ask') ? 'ask' : 'direct';
  if (!meta.modes.includes(mode)) return c.json({ error: 'That kind cannot be made that way.' }, 400);
  const reason = str(body.reason, CONNECT_REASON_MAX);
  // A direct link has no yes from the person, so the team says why. It stays in the audit row, never here and never sent.
  if (mode === 'direct' && !reason) return c.json({ error: 'Say why they are linked directly. Only the team sees it.' }, 400);
  if (!kindsOf(c).includes(kind)) return c.json(FORBIDDEN, 403);
  // The key alone has no person behind it: it acts as the team.
  const actor = actorOf(c);
  const actorId = actor?.id ?? null;

  const first = await findPerson(db, str(body.first, 200));
  if (!first) return c.json(NOBODY, 404);
  let second: UserRow | null = null;
  if (meta.second) {
    second = await findPerson(db, str(body.second, 200));
    if (!second) return c.json(NOBODY, 404);
    if (second.id === first.id) return c.json({ error: 'Pick two different people.' }, 400);
    // Whoever makes a connection is never paid for it (connectPay.ts), and a friend suggestion naming yourself would be a request in
    // the team's name: that is Bond's own door (2026-11-10).
    if (kind === 'friends' && actorId && (first.id === actorId || second.id === actorId)) return c.json({ error: CONNECT_NOT_YOURSELF }, 400);
    // A block either way reads exactly as nobody, so the team's form never tells who blocked whom.
    if (await blockedEither(db, first.id, second.id)) return c.json(NOBODY, 404);
  }

  let made: Made;
  if (kind === 'coach') made = await connectCoach(db, actorId, first, second!, mode === 'direct');
  else if (kind === 'friends') made = await connectFriends(db, first, second!);
  else if (kind === 'agency') made = await connectAgency(db, first, second!, body);
  else if (kind === 'program') made = await connectProgram(db, actor, first, str(body.place, 80));
  else if (kind === 'product') made = await connectProduct(db, actor, first, str(body.place, 80));
  // The manager the form's list showed goes with it (`from`, null for none): a change made since answers 409, as on the cohort page.
  else if (kind === 'cohort') made = await connectCohort(db, actor, first, str(body.place, 80), body.from === undefined ? undefined : typeof body.from === 'string' ? body.from : null);
  else if (kind === 'org') made = await connectOrg(db, first, str(body.place, 80));
  else made = await connectClub(db, actor, first, second!);
  if (made.code !== 201) return c.json({ error: made.error }, made.code);

  const id = newId();
  const [a, b] = kind === 'friends' && second && second.id < first.id ? [second, first] : [first, second];
  try {
    await db
      .prepare('INSERT INTO team_connections (id, kind, first_user_id, second_user_id, mode, ref_id, place, status, created_by, made_as, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, kind, a.id, b?.id ?? null, mode, made.ref, made.place.slice(0, 120), kind === 'friends' ? 'asked' : mode === 'direct' ? 'accepted' : 'asked', actorId, madeAsOf(actor), nowIso())
      .run();
  } catch {
    // Two taps at once on a friend suggestion: the unique open row lets one in.
    return c.json({ error: 'They were asked already.' }, 409);
  }
  if (kind === 'friends') {
    // Fixed ids, so a block between the two takes both notes away with the suggestion (blockAsks.ts).
    for (const [me, other] of [[a, b!], [b!, a]] as const)
      await noteStmt(db, { id: `suggest-${id}-${me.id}`, userId: me.id, kind: 'bond', title: `The team thinks you and ${nameOf(other)} would get on`, body: 'Say yes or no on your Profile tab. You become friends only if you both say yes.', link: '/you#suggested' }, 'renew').run();
  }
  await audit(db, actorId, `connect.${kind}`, 'team_connection', id, '', { first: first.id, second: second?.id ?? null, mode, ref: made.ref, ...(reason ? { reason } : {}) });
  // A direct link (a coach linked now, a Club manager named) is real at once, so it pays each side now; an ask pays on its yes. A cohort's
  // manager is a job the team gives, not a connection between people, so it pays nothing.
  if (mode === 'direct' && kind !== 'friends' && kind !== 'cohort') await payConnection(db, id);
  return c.json({ id, kind, mode }, 201);
});

async function connectCoach(db: D1Database, actorId: string | null, coach: UserRow, student: UserRow, now: boolean): Promise<Made> {
  if (!can(coach, 'coach')) return { code: 400, error: 'They are not a life coach. Give them the Life coach permission under People first.' };
  const bad = await linkProblem(db, coach.id, student.id);
  if (bad) return { code: bad.status, error: bad.error };
  const link = await teamCoachLink(db, actorId, coach, student, now);
  if (!link) return { code: 409, error: 'There is already an ask waiting between them.' };
  return { code: 201, ref: link.id, place: '' };
}

async function connectFriends(db: D1Database, a: UserRow, b: UserRow): Promise<Made> {
  // Someone who takes no friend requests is not suggested either; the words are nobody's, as for a block.
  if (!publicOf(a).allowFriendRequests || !publicOf(b).allowFriendRequests) return { code: 404, error: CONNECT_NOBODY };
  const f = await db.prepare('SELECT status FROM friendships WHERE (requester_id = ?1 AND recipient_id = ?2) OR (requester_id = ?2 AND recipient_id = ?1)').bind(a.id, b.id).first<{ status: string }>();
  if (f?.status === 'accepted') return { code: 409, error: 'They are friends already.' };
  if (f?.status === 'pending') return { code: 409, error: 'There is already a friend request between them.' };
  const [lo, hi] = a.id < b.id ? [a.id, b.id] : [b.id, a.id];
  const open = await db.prepare("SELECT 1 AS x FROM team_connections WHERE kind = 'friends' AND status = 'asked' AND first_user_id = ? AND second_user_id = ?").bind(lo, hi).first();
  if (open) return { code: 409, error: 'They were asked already.' };
  return { code: 201, ref: null, place: '' };
}

async function connectAgency(db: D1Database, owner: UserRow, member: UserRow, body: Record<string, unknown>): Promise<Made> {
  if (!isTeamRole(body.role)) return { code: 400, error: 'Pick a role.' };
  const { access } = await resolveAccess(db, owner);
  if (!access.agency?.available || !access.agency.on) return { code: 400, error: 'Their Agency is off. It has to be on before the team can add to it.' };
  // Every tab starts Off (byTeam): the owner, not the team, decides what a member of their books sees.
  const r = await inviteToTeam(db, owner, member, { role: body.role, clientId: body.clientId }, { friendRequest: false, byTeam: true });
  if (r.code !== 201 || !r.body.id) return { code: r.code === 201 ? 409 : r.code, error: r.body.error ?? 'They are already on the team or invited.' };
  const role = TEAM_ROLE_META[body.role].name;
  const client = body.role === 'client' && typeof body.clientId === 'string' ? await db.prepare('SELECT name FROM agency_clients WHERE id = ?').bind(body.clientId).first<{ name: string }>() : null;
  await notify(db, owner.id, 'agency', `The team asked ${nameOf(member)} to join your Agency team`, 'They see nothing of yours until you give them access under Agency, Team. Remove the invite there if it is not right.', '/agency?tab=team');
  return { code: 201, ref: r.body.id, place: client ? `${role}, ${client.name}` : role };
}

async function connectProgram(db: D1Database, actor: UserRow | null, person: UserRow, programId: string): Promise<Made> {
  const actorId = actor?.id ?? null;
  const row = programId
    ? await db.prepare(`SELECT p.id, p.name, p.price_points, p.price_cents, p.currency, p.created_by, ${VIS} AS vis FROM programs p WHERE p.id = ?`).bind(programId).first<{ id: string; name: string; price_points: number; price_cents: number; currency: string; created_by: string | null; vis: ProgramVisibility }>()
    : null;
  if (!row) return { code: 400, error: 'Pick a private program.' };
  // The program's own rule (school.ts): its maker or an admin invites, so staff with Cohorts reach only the private programs they made.
  if (!mayManageProgram(actor, row)) return { code: 403, error: PROGRAM_INVITER_ONLY };
  if (row.created_by === person.id) return { code: 400, error: 'They made this program. They can always open it.' };
  if (row.created_by && (await blockedEither(db, row.created_by, person.id))) return { code: 404, error: CONNECT_NOBODY };
  const r = await inviteToProgram(db, row, person, { id: actorId, name: 'The team' });
  if (r.code !== 201) return { code: r.code, error: r.body.error ?? 'They are already invited.' };
  return { code: 201, ref: row.id, place: row.name };
}

async function connectProduct(db: D1Database, actor: UserRow | null, person: UserRow, productId: string): Promise<Made> {
  const actorId = actor?.id ?? null;
  const row = productId ? await db.prepare(`${PRODUCT_SELECT} WHERE p.id = ?`).bind(productId).first<ProductRow>() : null;
  if (!row || row.kind !== 'course' || row.status !== 'private') return { code: 400, error: 'Pick a private course.' };
  // The course's own rule (studio.ts): its owner or an admin invites, so staff with Cohorts reach only the private courses they own.
  if (!mayEditProduct(actor, row)) return { code: 403, error: COURSE_INVITER_ONLY };
  if (row.owner_id === person.id) return { code: 400, error: 'That is the course owner. They can always open it.' };
  if (await blockedEither(db, row.owner_id, person.id)) return { code: 404, error: CONNECT_NOBODY };
  const r = await inviteToCourse(db, row, person, actorId);
  if (!r.added) return { code: 409, error: 'They are already invited.' };
  return { code: 201, ref: row.id, place: row.title };
}

async function connectClub(db: D1Database, actor: UserRow | null, member: UserRow, manager: UserRow): Promise<Made> {
  const m = await db.prepare("SELECT id, manager_user_id FROM memberships WHERE user_id = ? AND membership_type = 'club'").bind(member.id).first<{ id: string; manager_user_id: string | null }>();
  if (!m) return { code: 400, error: 'They have no Club membership.' };
  if (manager.role === 'user') return { code: 400, error: 'A manager is someone on staff.' };
  if (m.manager_user_id === manager.id) return { code: 409, error: 'They are this member’s manager already.' };
  // Guarded on the manager just read, and by rank: a manager an admin named stays an admin's to change (club.ts, connectRank.ts).
  const r = await nameClubManager(db, actor, m.id, manager.id, m.manager_user_id);
  if (r.code !== 200) return { code: r.code, error: r.body.error ?? 'not found' };
  await notify(db, manager.id, 'club', `You are ${nameOf(member)}’s Club manager now`, 'The team named you. They can reach you through Help.', '/club');
  return { code: 201, ref: m.id, place: '' };
}

async function connectCohort(db: D1Database, actor: UserRow | null, person: UserRow, cohortId: string, from: string | null | undefined): Promise<Made> {
  if (!cohortId) return { code: 400, error: 'Pick a cohort.' };
  const r = await setCohortManager(db, actor, cohortId, person, from);
  if (r.code !== 200) return { code: r.code, error: r.error };
  return { code: 201, ref: cohortId, place: r.cohort };
}

async function connectOrg(db: D1Database, person: UserRow, orgId: string): Promise<Made> {
  const org = orgId ? await db.prepare("SELECT id, name FROM organizations WHERE id = ? AND status = 'active'").bind(orgId).first<{ id: string; name: string }>() : null;
  if (!org) return { code: 400, error: 'Pick a brand.' };
  // The same ask the brand's owner sends from Army (orgs.ts): only their yes puts them on the team.
  const r = await inviteToOrg(db, org, person, 'The team');
  if (r.code !== 201) return { code: r.code, error: r.code === 404 ? CONNECT_NOBODY : r.error };
  return { code: 201, ref: org.id, place: org.name };
}

// ---- the list: every connection the team made, newest first, with its state read from the app's own rows

interface ConnRow {
  id: string;
  kind: ConnectKind;
  first_user_id: string;
  second_user_id: string | null;
  mode: ConnectMode;
  ref_id: string | null;
  place: string;
  status: ConnectState;
  answered_at: string | null;
  first_said: number | null;
  second_said: number | null;
  created_by: string | null;
  /** How its maker stood when they made it (migration 0131): the rank End reads, never the maker's role now. */
  made_as: MadeAs;
  created_at: string;
  ended_at: string | null;
  came_true_at: string | null;
}
type ListRow = ConnRow & { first_name: string; first_handle: string | null; second_name: string | null; second_handle: string | null; by_name: string | null };

/** What End reads about a row's place for one caller: who made or owns a program, course or cohort's program, a cohort's state, and whether they own the brand. */
interface RankRow {
  place_owner: string | null;
  place_vis: ProgramVisibility | null;
  place_program: string | null;
  org_owner: number;
}
const NO_RANK: RankRow = { place_owner: null, place_vis: null, place_program: null, org_owner: 0 };
/**
 * The places of the rows asked, for a caller who is not an admin (an admin ends everything): read for a page's ids only, beside its states,
 * so the list never reads every row's place (it did for the whole table, 2026-11-10) and the read rides the same round trip.
 */
async function ranksOf(db: D1Database, ids: readonly string[], me: string): Promise<Map<string, RankRow>> {
  if (!ids.length) return new Map();
  const rows = await db
    .prepare(
      `SELECT t.id,
         CASE t.kind WHEN 'program' THEN (SELECT created_by FROM programs WHERE id = t.ref_id)
           WHEN 'product' THEN (SELECT owner_id FROM products WHERE id = t.ref_id)
           WHEN 'cohort' THEN (SELECT p.created_by FROM cohorts k JOIN programs p ON p.id = k.program_id WHERE k.id = t.ref_id) END AS place_owner,
         CASE t.kind WHEN 'cohort' THEN (SELECT ${VIS} FROM cohorts k JOIN programs p ON p.id = k.program_id WHERE k.id = t.ref_id) END AS place_vis,
         CASE t.kind WHEN 'cohort' THEN (SELECT k.program_id FROM cohorts k WHERE k.id = t.ref_id) END AS place_program,
         CASE t.kind WHEN 'org' THEN EXISTS (SELECT 1 FROM organization_members m WHERE m.organization_id = t.ref_id AND m.user_id = ?2 AND m.role = 'owner' AND m.status = 'active') ELSE 0 END AS org_owner
       FROM team_connections t WHERE t.id IN (SELECT value FROM json_each(?1))`,
    )
    .bind(JSON.stringify(ids), me)
    .all<RankRow & { id: string }>();
  return new Map(rows.results.map((r) => [r.id, r]));
}

/**
 * Why this caller may not end or take back a row, or null when they may (2026-11-10, the founder's "fix all these properly"). By rank,
 * the rule a guide's undo follows (connectRank.ts): an admin and the key end everything; a staff member ends only what staff made, so a
 * row an admin or the key made stays with admins, by how its maker stood when they made it (`made_as`), except on a place that is the
 * caller's own (a program they made, a course or brand they own), which they could undo on its own route anyway. And by place, the rule
 * each place has (school.ts, studio.ts): a private program or course invite only where they may invite, a cohort's manager only where
 * they may name one.
 */
function endRefusal(actor: UserRow | null, admin: boolean, r: ConnRow & RankRow): string | null {
  if (admin) return null;
  const own = Boolean(actor) && (r.kind === 'org' ? r.org_owner === 1 : (r.kind === 'program' || r.kind === 'product' || r.kind === 'cohort') && r.place_owner === actor?.id);
  if (r.made_as !== 'staff' && !own) return CONNECT_ADMIN_ROW;
  if (r.kind === 'program' && !mayManageProgram(actor, { created_by: r.place_owner })) return CONNECT_PLACE_NOT_YOURS;
  if (r.kind === 'product' && !mayEditProduct(actor, { owner_id: r.place_owner ?? '' })) return CONNECT_PLACE_NOT_YOURS;
  if (r.kind === 'cohort' && (!actor || !mayNameManager(actor, { vis: r.place_vis ?? 'draft', cohortId: r.ref_id ?? '', programId: r.place_program ?? '', createdBy: r.place_owner }))) return CONNECT_PLACE_NOT_YOURS;
  return null;
}

/** Each row's state, from the row it points at, read for one page at once (one round trip: the reads go together). */
async function statesOf(db: D1Database, rows: readonly ConnRow[]): Promise<Map<string, ConnectState>> {
  const of = (k: ConnectKind) => rows.filter((r) => r.kind === k && r.ref_id);
  const pairs = (k: ConnectKind) => JSON.stringify(of(k).map((r) => ({ c: r.id, p: r.ref_id, u: r.first_user_id })));
  const ids = (k: ConnectKind) => JSON.stringify(of(k).map((r) => r.ref_id));
  const none = Promise.resolve({ results: [] as never[] });
  const friendRows = rows.filter((r) => r.kind === 'friends' && r.status === 'asked' && r.second_user_id);
  const [coach, agency, program, product, club, friends, cohort, org] = await Promise.all([
    of('coach').length ? db.prepare('SELECT id, status FROM coach_links WHERE id IN (SELECT value FROM json_each(?))').bind(ids('coach')).all<{ id: string; status: string }>() : none,
    of('agency').length ? db.prepare('SELECT id, status, joined_at, ended_by FROM agency_team WHERE id IN (SELECT value FROM json_each(?))').bind(ids('agency')).all<{ id: string; status: string; joined_at: string | null; ended_by: string | null }>() : none,
    of('program').length
      ? db
          .prepare(
            `SELECT json_extract(j.value, '$.c') AS cid,
              EXISTS (SELECT 1 FROM program_invites i WHERE i.program_id = json_extract(j.value, '$.p') AND i.user_id = json_extract(j.value, '$.u')) AS invited,
              EXISTS (SELECT 1 FROM enrollments e JOIN cohorts k ON k.id = e.cohort_id WHERE k.program_id = json_extract(j.value, '$.p') AND e.learner_user_id = json_extract(j.value, '$.u') AND e.status != 'withdrawn') AS joined
             FROM json_each(?) j`,
          )
          .bind(pairs('program'))
          .all<{ cid: string; invited: number; joined: number }>()
      : none,
    of('product').length
      ? db
          .prepare(
            `SELECT json_extract(j.value, '$.c') AS cid,
              EXISTS (SELECT 1 FROM product_invites i WHERE i.product_id = json_extract(j.value, '$.p') AND i.user_id = json_extract(j.value, '$.u')) AS invited,
              EXISTS (SELECT 1 FROM orders o WHERE o.product_id = json_extract(j.value, '$.p') AND o.buyer_id = json_extract(j.value, '$.u') AND o.status IN ('paid', 'test')) AS joined
             FROM json_each(?) j`,
          )
          .bind(pairs('product'))
          .all<{ cid: string; invited: number; joined: number }>()
      : none,
    of('club').length ? db.prepare('SELECT id, manager_user_id FROM memberships WHERE id IN (SELECT value FROM json_each(?))').bind(ids('club')).all<{ id: string; manager_user_id: string | null }>() : none,
    // A suggestion still asked whose two became friends some other way (one accepted the request in Bond) reads as connected.
    friendRows.length
      ? db
          .prepare(
            `SELECT json_extract(j.value, '$.c') AS cid FROM json_each(?) j WHERE EXISTS (SELECT 1 FROM friendships f WHERE f.status = 'accepted'
               AND ((f.requester_id = json_extract(j.value, '$.a') AND f.recipient_id = json_extract(j.value, '$.b')) OR (f.requester_id = json_extract(j.value, '$.b') AND f.recipient_id = json_extract(j.value, '$.a'))))`,
          )
          .bind(JSON.stringify(friendRows.map((r) => ({ c: r.id, a: r.first_user_id, b: r.second_user_id }))))
          .all<{ cid: string }>()
      : none,
    of('cohort').length ? db.prepare('SELECT id, manager_user_id FROM cohorts WHERE id IN (SELECT value FROM json_each(?))').bind(ids('cohort')).all<{ id: string; manager_user_id: string | null }>() : none,
    of('org').length
      ? db
          .prepare(`SELECT json_extract(j.value, '$.c') AS cid, (SELECT m.status FROM organization_members m WHERE m.organization_id = json_extract(j.value, '$.p') AND m.user_id = json_extract(j.value, '$.u')) AS st FROM json_each(?) j`)
          .bind(pairs('org'))
          .all<{ cid: string; st: string | null }>()
      : none,
  ]);
  const madeFriends = new Set(friends.results.map((r) => r.cid));
  const coachBy = new Map(coach.results.map((r) => [r.id, r.status]));
  const agencyBy = new Map(agency.results.map((r) => [r.id, r]));
  const programBy = new Map(program.results.map((r) => [r.cid, r]));
  const productBy = new Map(product.results.map((r) => [r.cid, r]));
  const clubBy = new Map(club.results.map((r) => [r.id, r.manager_user_id]));
  const cohortBy = new Map(cohort.results.map((r) => [r.id, r.manager_user_id]));
  const orgBy = new Map(org.results.map((r) => [r.cid, r.st]));
  const out = new Map<string, ConnectState>();
  for (const r of rows) {
    let s: ConnectState = r.ended_at ? 'ended' : r.status;
    if (r.kind === 'friends' && madeFriends.has(r.id)) s = 'accepted';
    else if (r.kind === 'coach') {
      const st = coachBy.get(r.ref_id ?? '');
      s = st === 'pending' ? 'asked' : st === 'active' ? 'accepted' : st === 'declined' ? 'declined' : 'ended';
    } else if (r.kind === 'agency') {
      const t = agencyBy.get(r.ref_id ?? '');
      s = !t ? 'ended' : t.status === 'invited' ? 'asked' : t.status === 'active' ? 'accepted' : t.ended_by === 'member' && !t.joined_at ? 'declined' : 'ended';
    } else if (r.kind === 'program' || r.kind === 'product') {
      const t = (r.kind === 'program' ? programBy : productBy).get(r.id);
      s = t?.joined ? 'accepted' : t?.invited && !r.ended_at ? 'asked' : 'ended';
    } else if (r.kind === 'club') {
      s = clubBy.get(r.ref_id ?? '') === r.second_user_id && !r.ended_at ? 'accepted' : 'ended';
    } else if (r.kind === 'cohort') {
      s = cohortBy.get(r.ref_id ?? '') === r.first_user_id && !r.ended_at ? 'accepted' : 'ended';
    } else if (r.kind === 'org') {
      // A no takes the ask away (orgs.ts) and marks the row answered and ended, so it reads "Said no" here and nowhere the brand sees. A row
      // is read by its own answer first, never by the brand's row now, so a later ask to the same person never makes an older row read
      // "Asked" again (2026-11-10, the break-it check), and an ended row stays ended when the person joined again through a later ask.
      const st = orgBy.get(r.id);
      s = r.came_true_at ? (st === 'active' && !r.ended_at ? 'accepted' : 'ended') : r.answered_at ? 'declined' : r.ended_at ? 'ended' : st === 'invited' ? 'asked' : 'ended';
    }
    out.set(r.id, s);
  }
  return out;
}

const endable = (kind: ConnectKind, s: ConnectState) => (kind === 'coach' ? s === 'asked' || s === 'accepted' : kind === 'club' || kind === 'cohort' ? s === 'accepted' : s === 'asked');

adminConnect.get('/', async (c) => {
  const db = c.env.DB;
  const ask = pageOf(c);
  const kind = c.req.query('kind') ?? '';
  const person = str(c.req.query('person'), 64);
  // A staff member sees only the connections of their own kinds; the answer says which kinds those are, so the form offers only them.
  const kinds = kindsOf(c);
  const admin = isAdminCaller(c);
  const actor = actorOf(c);
  const me = actor?.id ?? '';
  // A staff member reads only the rows on places they may reach, by each place's own rule (2026-11-10, the break-it check: who is
  // invited to a private program or course is its maker's and an admin's to read): a private program they made (mayManageProgram), a
  // course they own (mayEditProduct), a cohort whose manager they may name (mayNameManager, cohortManagerSql). Every other kind is the
  // same for every staff member who holds it.
  const rows = await db
    .prepare(
      `SELECT t.*, a.display_name AS first_name, a.handle AS first_handle, b.display_name AS second_name, b.handle AS second_handle, s.display_name AS by_name
       FROM team_connections t JOIN users a ON a.id = t.first_user_id LEFT JOIN users b ON b.id = t.second_user_id LEFT JOIN users s ON s.id = t.created_by
       WHERE (?1 = '' OR t.kind = ?1) AND (?2 = '' OR t.first_user_id = ?2 OR t.second_user_id = ?2) AND t.kind IN (SELECT value FROM json_each(?5))
         AND (?6 = 1 OR t.kind NOT IN ('program', 'product', 'cohort')
           OR (t.kind = 'program' AND EXISTS (SELECT 1 FROM programs p WHERE p.id = t.ref_id AND p.created_by = ?7))
           OR (t.kind = 'product' AND EXISTS (SELECT 1 FROM products p WHERE p.id = t.ref_id AND p.owner_id = ?7))
           OR (t.kind = 'cohort' AND EXISTS (SELECT 1 FROM cohorts k JOIN programs p ON p.id = k.program_id WHERE k.id = t.ref_id AND ${cohortManagerSql('?7')})))
       ORDER BY t.created_at DESC, t.id LIMIT ?3 OFFSET ?4`,
    )
    .bind(isConnectKind(kind) ? kind : '', person, ask.limit, ask.offset, JSON.stringify(kinds), admin ? 1 : 0, me)
    .all<ListRow>();
  const pg = paged(rows.results, ask);
  const [states, ranks] = await Promise.all([statesOf(db, pg.items), admin ? Promise.resolve(new Map<string, RankRow>()) : ranksOf(db, pg.items.map((r) => r.id), me)]);
  const connections: TeamConnection[] = pg.items.map((r) => {
    const state = states.get(r.id) ?? 'ended';
    const open = endable(r.kind, state);
    const refused = open ? endRefusal(actor, admin, { ...r, ...(ranks.get(r.id) ?? NO_RANK) }) : null;
    return {
      id: r.id,
      kind: r.kind,
      first: { id: r.first_user_id, name: nameOf({ display_name: r.first_name }), handle: r.first_handle ?? '' },
      second: r.second_user_id ? { id: r.second_user_id, name: nameOf({ display_name: r.second_name ?? '' }), handle: r.second_handle ?? '' } : null,
      place: r.place,
      mode: r.mode,
      state,
      createdAt: r.created_at,
      endedAt: r.ended_at,
      // Who made it, by name; once their account is gone, by how they stood (the key has no name to show).
      by: r.by_name ? nameOf({ display_name: r.by_name }) : r.made_as === 'key' ? 'Admin key' : r.made_as === 'admin' ? 'An admin' : 'Someone on staff',
      canEnd: open && !refused,
      endNote: refused,
    };
  });
  return c.json({ connections, page: pg.page, kinds });
});

// ---- end one, or take it back while it waits: each through the app's own action again

adminConnect.delete('/:id', async (c) => {
  const db = c.env.DB;
  const actor = actorOf(c);
  const actorId = actor?.id ?? null;
  const admin = isAdminCaller(c);
  const id = c.req.param('id');
  // The row and, for staff, its place, read together (one round trip).
  const [found, ranks] = await Promise.all([db.prepare('SELECT * FROM team_connections WHERE id = ?').bind(id).first<ConnRow>(), admin ? Promise.resolve(new Map<string, RankRow>()) : ranksOf(db, [id], actorId ?? '')]);
  const row = found;
  // Another staff member's kind reads as nothing there, so End never tells someone about a kind that is not theirs.
  if (!row || !kindsOf(c).includes(row.kind)) return c.json({ error: 'not found' }, 404);
  // By rank and by place (endRefusal): an admin's row stays with admins, and a place that is not this staff member's is its maker's.
  const refused = endRefusal(actor, admin, { ...row, ...(ranks.get(row.id) ?? NO_RANK) });
  // A row on a place that is not theirs is not in their list either (a creator's private program, course or cohort), so it reads as nothing.
  if (refused === CONNECT_PLACE_NOT_YOURS) return c.json({ error: 'not found' }, 404);
  if (refused) return c.json({ error: CONNECT_ADMIN_ONLY }, 403);
  const state = (await statesOf(db, [row])).get(row.id) ?? 'ended';
  if (!endable(row.kind, state)) return c.json({ error: 'That one is over already.' }, 409);
  const now = nowIso();
  const second = row.second_user_id;
  if (row.kind === 'coach') {
    const link = await linkById(db, row.ref_id ?? '');
    if (!link || (link.status !== 'pending' && link.status !== 'active')) return c.json({ error: 'That one is over already.' }, 409);
    await endLink(db, link, { id: null, name: 'The team' });
  } else if (row.kind === 'friends') {
    const res = await db.prepare("UPDATE team_connections SET status = 'ended', ended_at = ? WHERE id = ? AND status = 'asked'").bind(now, row.id).run();
    if (!res.meta.changes) return c.json({ error: 'That one is over already.' }, 409);
    // A request the suggestion sent goes with it: one that came from a yes here, still waiting.
    if (row.first_said === 1) await db.prepare("DELETE FROM friendships WHERE requester_id = ? AND recipient_id = ? AND status = 'pending'").bind(row.first_user_id, second).run();
    if (row.second_said === 1) await db.prepare("DELETE FROM friendships WHERE requester_id = ? AND recipient_id = ? AND status = 'pending'").bind(second, row.first_user_id).run();
    for (const id of [row.first_user_id, second]) if (id) await notify(db, id, 'bond', 'The team took back a friend suggestion', 'Nothing changed between you and anyone.', '/you#suggested');
  } else if (row.kind === 'agency') {
    const r = await removeFromTeam(db, row.first_user_id, row.ref_id ?? '', ['invited']);
    if (r.code !== 200) return c.json({ error: 'That one is over already.' }, 409);
    await notify(db, row.first_user_id, 'agency', 'The team took back an invite to your Agency team', '', '/agency?tab=team');
  } else if (row.kind === 'program') {
    if (!(await uninviteFromProgram(db, row.ref_id ?? '', row.first_user_id, actorId))) return c.json({ error: 'That one is over already.' }, 409);
  } else if (row.kind === 'product') {
    const p = await db.prepare('SELECT id, owner_id FROM products WHERE id = ?').bind(row.ref_id ?? '').first<{ id: string; owner_id: string }>();
    if (!p || !(await uninviteFromCourse(db, p, row.first_user_id, actorId))) return c.json({ error: 'That one is over already.' }, 409);
  } else if (row.kind === 'cohort') {
    // Only while the one this row named still runs it, guarded on them in the change itself (`from`), so a naming that lands between
    // the read and the write is never the one taken off: the manager is taken off, and they are told (setCohortManager).
    const r = await setCohortManager(db, actor, row.ref_id ?? '', null, row.first_user_id);
    if (r.code === 409) return c.json({ error: 'That one is over already.' }, 409);
    if (r.code !== 200) return c.json({ error: r.error }, r.code);
  } else if (row.kind === 'org') {
    // Taking back an ask still waiting, silently, as the brand's owner does from Army.
    if (!(await withdrawFromOrg(db, row.ref_id ?? '', row.first_user_id, ['invited']))) return c.json({ error: 'That one is over already.' }, 409);
  } else {
    // Guarded on the manager this row named (`from`), so the note below goes to the one really taken off.
    const r = await nameClubManager(db, actor, row.ref_id ?? '', null, second);
    if (r.code === 403) return c.json({ error: r.body.error }, 403);
    if (r.code !== 200) return c.json({ error: 'That one is over already.' }, 409);
    await notify(db, row.first_user_id, 'club', 'You have no Club manager for now', 'The team will name someone new when it can.', '/club#mine-heading');
    if (second) await notify(db, second, 'club', 'You are no longer a Club member’s manager', '', '/club');
  }
  if (row.kind !== 'friends') await db.prepare('UPDATE team_connections SET ended_at = ? WHERE id = ? AND ended_at IS NULL').bind(now, row.id).run();
  await audit(db, actorId, `connect.${row.kind}.end`, 'team_connection', row.id, { first: row.first_user_id, second, state }, 'ended');
  return c.json({ ok: true });
});

// ---- one person's connections, for the sheet under People: what the team may manage, and a friend count, never the list

/** A program in words by its real state: "Public School program", "Private School program", "Draft …", "Archived …". */
const programLabel = (vis: ProgramVisibility) => `${PROGRAM_VISIBILITY_META[vis]?.name ?? 'Private'} School program`;

adminConnect.get('/people/:id', async (c) => {
  const db = c.env.DB;
  // People is Admin's own tab: a staff member's door (/manage/connect) has no sheet of everything about one person.
  if (!isAdminCaller(c)) return c.json(FORBIDDEN, 403);
  const u = await getUser(db, c.req.param('id'));
  if (!u || u.display_name === DELETED_NAME) return c.json(NOBODY, 404);
  const id = u.id;
  const [coach, teams, cohorts, programs, courses, club, friends, suggested, brands, runs] = await Promise.all([
    db
      .prepare(`SELECT l.coach_id, l.status, o.display_name FROM coach_links l JOIN users o ON o.id = CASE WHEN l.coach_id = ?1 THEN l.student_id ELSE l.coach_id END WHERE (l.coach_id = ?1 OR l.student_id = ?1) AND l.status IN ('pending', 'active') AND ${liveUser('o')} LIMIT 20`)
      .bind(id)
      .all<{ coach_id: string; status: string; display_name: string }>(),
    db
      .prepare(`SELECT t.owner_id, t.role, t.status, o.display_name FROM agency_team t JOIN users o ON o.id = CASE WHEN t.owner_id = ?1 THEN t.member_id ELSE t.owner_id END WHERE (t.owner_id = ?1 OR t.member_id = ?1) AND t.status IN ('invited', 'active') AND ${liveUser('o')} LIMIT 20`)
      .bind(id)
      .all<{ owner_id: string; role: keyof typeof TEAM_ROLE_META; status: string; display_name: string }>(),
    // A cohort they are in, with its program's real state (VIS), and whether they came by an invite or enrolled themselves (2026-11-10: the
    // public Onboarding program read "Private School program. Learner").
    db
      .prepare(
        `SELECT p.name AS program, k.name AS cohort, ${VIS} AS vis, EXISTS (SELECT 1 FROM program_invites i WHERE i.program_id = p.id AND i.user_id = ?1) AS invited
         FROM enrollments e JOIN cohorts k ON k.id = e.cohort_id JOIN programs p ON p.id = k.program_id WHERE e.learner_user_id = ?1 AND e.status != 'withdrawn' ORDER BY e.enrolled_at DESC LIMIT 20`,
      )
      .bind(id)
      .all<{ program: string; cohort: string; vis: ProgramVisibility; invited: number }>(),
    // An invite still waiting: one they took up shows as the cohort above instead.
    db
      .prepare(
        `SELECT p.name, ${VIS} AS vis FROM program_invites i JOIN programs p ON p.id = i.program_id WHERE i.user_id = ?1
           AND NOT EXISTS (SELECT 1 FROM enrollments e JOIN cohorts k ON k.id = e.cohort_id WHERE k.program_id = p.id AND e.learner_user_id = ?1 AND e.status != 'withdrawn')
         ORDER BY i.created_at DESC LIMIT 20`,
      )
      .bind(id)
      .all<{ name: string; vis: ProgramVisibility }>(),
    db.prepare('SELECT p.title, p.status FROM product_invites i JOIN products p ON p.id = i.product_id WHERE i.user_id = ? ORDER BY i.created_at DESC LIMIT 20').bind(id).all<{ title: string; status: string }>(),
    db.prepare("SELECT m.status, g.display_name AS manager FROM memberships m LEFT JOIN users g ON g.id = m.manager_user_id WHERE m.user_id = ? AND m.membership_type = 'club'").bind(id).first<{ status: string; manager: string | null }>(),
    db.prepare("SELECT COUNT(*) AS n FROM friendships f WHERE f.status = 'accepted' AND (f.requester_id = ?1 OR f.recipient_id = ?1)").bind(id).first<{ n: number }>(),
    db
      .prepare(`SELECT o.display_name FROM team_connections t JOIN users o ON o.id = CASE WHEN t.first_user_id = ?1 THEN t.second_user_id ELSE t.first_user_id END WHERE t.kind = 'friends' AND t.status = 'asked' AND (t.first_user_id = ?1 OR t.second_user_id = ?1) LIMIT 20`)
      .bind(id)
      .all<{ display_name: string }>(),
    db.prepare("SELECT o.name, m.role, m.status FROM organization_members m JOIN organizations o ON o.id = m.organization_id WHERE m.user_id = ? AND m.status IN ('active', 'invited') ORDER BY o.name LIMIT 20").bind(id).all<{ name: string; role: string; status: string }>(),
    db.prepare('SELECT p.name AS program, k.name AS cohort FROM cohorts k JOIN programs p ON p.id = k.program_id WHERE k.manager_user_id = ? ORDER BY p.name LIMIT 20').bind(id).all<{ program: string; cohort: string }>(),
  ]);
  const items: PersonConnection[] = [
    ...coach.results.map((r): PersonConnection => ({ kind: 'coach', with: nameOf(r), as: r.coach_id === id ? 'Life coach' : 'Student', state: r.status === 'active' ? 'accepted' : 'asked' })),
    ...teams.results.map((r): PersonConnection => ({ kind: 'agency', with: nameOf(r), as: r.owner_id === id ? `Owner, ${TEAM_ROLE_META[r.role]?.name ?? 'member'} on their team` : TEAM_ROLE_META[r.role]?.name ?? 'Member', state: r.status === 'active' ? 'accepted' : 'asked' })),
    ...cohorts.results.map((r): PersonConnection => ({ kind: 'program', label: programLabel(r.vis), with: `${r.program}, ${r.cohort}`, as: r.invited ? 'Invited, then enrolled in a cohort' : 'Enrolled in a cohort', state: 'accepted' })),
    ...programs.results.map((r): PersonConnection => ({ kind: 'program', label: programLabel(r.vis), with: r.name, as: 'Invited', state: 'asked' })),
    ...courses.results.map((r): PersonConnection => ({ kind: 'product', label: r.status === 'private' ? 'Private Shop course' : r.status === 'live' ? 'Public Shop course' : 'Shop course', with: r.title, as: 'Invited', state: 'asked' })),
    ...(club && club.manager ? [{ kind: 'club' as const, with: nameOf({ display_name: club.manager }), as: 'Their Club manager', state: 'accepted' as const }] : []),
    ...suggested.results.map((r): PersonConnection => ({ kind: 'friends', with: nameOf(r), as: 'Suggested friend', state: 'asked' })),
    ...runs.results.map((r): PersonConnection => ({ kind: 'cohort', with: `${r.program}, ${r.cohort}`, as: 'Runs it', state: 'accepted' })),
    ...brands.results.map((r): PersonConnection => ({ kind: 'org', with: r.name, as: r.status === 'invited' ? 'Asked to join' : r.role === 'owner' ? 'Owner' : 'Member', state: r.status === 'invited' ? 'asked' : 'accepted' })),
  ];
  const out: PersonConnections = { person: toPerson(u), items, friends: friends?.n ?? 0 };
  return c.json(out);
});

// ---- the person's side of a friend suggestion (core: /me/suggestions)

mySuggestions.get('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const rows = await db
    .prepare(
      `SELECT t.id, t.first_user_id, t.first_said, t.second_said, t.created_at, o.id AS other_id, o.display_name, o.handle, o.avatar_url
       FROM team_connections t JOIN users o ON o.id = CASE WHEN t.first_user_id = ?1 THEN t.second_user_id ELSE t.first_user_id END
       WHERE t.kind = 'friends' AND t.status = 'asked' AND (t.first_user_id = ?1 OR t.second_user_id = ?1) AND ${liveUser('o')}
         AND NOT ${blockedByName('?1', 'o.id')}
         AND NOT EXISTS (SELECT 1 FROM friendships f WHERE f.status = 'accepted' AND ((f.requester_id = ?1 AND f.recipient_id = o.id) OR (f.requester_id = o.id AND f.recipient_id = ?1)))
       ORDER BY t.created_at DESC LIMIT 20`,
    )
    .bind(user.id)
    .all<{ id: string; first_user_id: string; first_said: number | null; second_said: number | null; created_at: string; other_id: string; display_name: string; handle: string | null; avatar_url: string }>();
  const suggestions: TeamSuggestion[] = rows.results.map((r) => {
    const mine = r.first_user_id === user.id ? r.first_said : r.second_said;
    return { id: r.id, other: toPerson({ id: r.other_id, display_name: r.display_name, handle: r.handle, avatar_url: r.avatar_url }), createdAt: r.created_at, said: mine === null ? null : mine === 1 };
  });
  return c.json({ suggestions });
});

// Yes or no. The first yes sends an ordinary friend request through Bond; the second accepts it. A no closes the suggestion for both and
// takes back a request it sent; the other person is not told who said no. Guarded on the answer still being open, so two taps answer once.
mySuggestions.post('/:id/answer', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await objectBody(c);
  if (typeof body.yes !== 'boolean') return c.json({ error: 'yes or no?' }, 400);
  const row = await db.prepare("SELECT * FROM team_connections WHERE id = ?1 AND kind = 'friends' AND status = 'asked' AND (first_user_id = ?2 OR second_user_id = ?2)").bind(c.req.param('id'), user.id).first<ConnRow>();
  if (!row || !row.second_user_id) return c.json({ error: 'not found' }, 404);
  const first = row.first_user_id === user.id;
  const col = first ? 'first_said' : 'second_said';
  const otherId = first ? row.second_user_id : row.first_user_id;
  const otherSaid = first ? row.second_said : row.first_said;
  const now = nowIso();
  const other = await getUser(db, otherId);
  if (!other || other.display_name === DELETED_NAME || (await blockedEither(db, user.id, otherId))) {
    await db.prepare("UPDATE team_connections SET status = 'ended', ended_at = ? WHERE id = ? AND status = 'asked'").bind(now, row.id).run();
    return c.json({ error: 'not found' }, 404);
  }
  if (!body.yes) {
    const res = await db.prepare(`UPDATE team_connections SET ${col} = 0, status = 'declined', answered_at = ? WHERE id = ? AND status = 'asked' AND ${col} IS NULL`).bind(now, row.id).run();
    if (!res.meta.changes) return c.json({ error: 'You answered already.' }, 409);
    if (otherSaid === 1) await db.prepare("DELETE FROM friendships WHERE requester_id = ? AND recipient_id = ? AND status = 'pending'").bind(otherId, user.id).run();
    await audit(db, user.id, 'connect.friends.answer', 'team_connection', row.id, '', { yes: false });
    return c.json({ ok: true, status: 'declined' });
  }
  const res = await db.prepare(`UPDATE team_connections SET ${col} = 1, answered_at = ? WHERE id = ? AND status = 'asked' AND ${col} IS NULL`).bind(now, row.id).run();
  if (!res.meta.changes) return c.json({ error: 'You answered already.' }, 409);
  // The other's switch for friend requests holds at the answer too: switched off since the suggestion, their own yes is the only door
  // (it sends the request the other way), so this yes is kept and nothing is sent to them.
  const r = otherSaid === 1 || publicOf(other).allowFriendRequests ? await requestFriend(db, user, otherId) : { code: 200, body: {} as Record<string, unknown> };
  const friends = r.body.status === 'friends' || r.body.error === 'already friends';
  if (friends) {
    await db.prepare("UPDATE team_connections SET status = 'accepted', answered_at = ? WHERE id = ? AND status = 'asked'").bind(now, row.id).run();
    // Both said yes: the suggestion came true, and each side is paid once (invites.ts).
    await payConnection(db, row.id);
  }
  await audit(db, user.id, 'connect.friends.answer', 'team_connection', row.id, '', { yes: true });
  return c.json({ ok: true, status: friends ? 'friends' : 'asked' });
});
