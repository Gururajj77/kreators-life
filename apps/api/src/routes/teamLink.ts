import { Hono } from 'hono';
import {
  AGENCY_NOTE_MAX,
  CHANGE_FROM_STAGES,
  CHANGE_TO_STAGE,
  monthBounds,
  parseTeamLinkShow,
  portalPasswordProblem,
  type DeliverableKind,
  type DeliverableStage,
  type NoteKind,
  type TeamLinkShow,
  type TeamLinkView,
} from '@kreators/shared';
import type { AppEnv } from '../env';
import { nameOf, newId, notify, nowIso, oneOf, randomCode, str } from '../db';
import { clientRow } from './agency';
import { closePasswordRequest, logStmt } from '../lifecycle';
import { agencyFace, closedLinkAnswer, newPortalPassword, passwordColumns, retirePortalLink } from '../portalAccess';
import { clearTeamLinkSessions, requireTeamLinkAccess, teamLockRowForToken, unlockTeamLink } from '../teamLinkAccess';

/**
 * The team link (2026-11-04): a second link per client for the client's own team, a junior who should see the work and none of the
 * paper. The owner's side (`teamLinkOwner`, mounted at /agency, so the Agency switch and the team gate's allowlist apply: a member never
 * reaches it) switches it on, off or fresh, says what it shows and sets its password. The team's side (`teamLinkPublic`, mounted at
 * /public/team-link) reads the page and leaves a note or, only when the owner allowed it, approves or sends a piece back.
 *
 * What it never holds is enforced here, not only hidden: the page is built only from the deliverable tables (`TeamLinkView` has no field
 * for an invoice, an agreement, a document, the retainer, the stage, onboarding, hours or money), its routes look clients up only by the
 * team token (an invoice, agreement or document token finds nothing), its sessions are its own, and the client link's and paper's routes
 * refuse any request that carries a team session (`refuseTeamSession`).
 */
export const teamLinkOwner = new Hono<AppEnv>();
export const teamLinkPublic = new Hono<AppEnv>();

const bodyOf = (c: { req: { json: <T>() => Promise<T> } }) => c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
const utcToday = () => new Date().toISOString().slice(0, 10);

/** The saved switches, read by the one reader in shared; anything unreadable is the defaults. */
export function teamShowOf(raw: string | null | undefined): TeamLinkShow {
  try {
    return parseTeamLinkShow(JSON.parse(raw || '{}'));
  } catch {
    return parseTeamLinkShow({});
  }
}

// ---- the owner's side

// Switch the team link on to make one, off to close it, ask for a fresh one when the old one got around, and say what it shows.
// Never touches the client link: its token, switches, password and sessions are the client link's own.
teamLinkOwner.post('/clients/:id/team-link', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await clientRow(db, user.id, c.req.param('id'));
  if (!row) return c.json({ error: 'not found' }, 404);
  const body = await bodyOf(c);
  // The team link never opens without a password, like a new client's own page (2026-11-05): switching it on takes one typed in the
  // same request (checked by the client link's rule), unless one is already set from before.
  const opening = body.on !== false && !row.team_link_token;
  let pass: { hash: string; salt: string } | null = null;
  if (opening && !row.team_link_pass_hash) {
    const typed = typeof body.password === 'string' ? body.password : '';
    if (!typed) return c.json({ error: 'set a password for the team link' }, 400);
    const problem = portalPasswordProblem(typed, row.name);
    if (problem) return c.json({ error: problem }, 400);
    pass = await passwordColumns(typed);
  }
  const token = body.on === false ? null : body.fresh === true || !row.team_link_token ? randomCode(16) : row.team_link_token;
  // The switches sent replace the saved ones part by part; a paper part is not a team part, so the reader drops it.
  const show = body.show && typeof body.show === 'object' ? parseTeamLinkShow({ ...teamShowOf(row.team_link_json), ...(body.show as Record<string, unknown>) }) : teamShowOf(row.team_link_json);
  const closing = body.on === false || body.fresh === true;
  const said = body.on === false ? 'The team link was switched off.' : body.fresh === true ? 'A fresh team link was made; the old one is closed.' : !row.team_link_token ? 'The team link was switched on.' : '';
  await db.batch([
    db.prepare('UPDATE agency_clients SET team_link_token = ?, team_link_json = ?, updated_at = ? WHERE id = ? AND user_id = ?').bind(token, JSON.stringify(show), nowIso(), row.id, user.id),
    ...(pass ? [db.prepare('UPDATE agency_clients SET team_link_pass_hash = ?, team_link_pass_salt = ?, team_link_pass_set_at = ? WHERE id = ? AND user_id = ?').bind(pass.hash, pass.salt, nowIso(), row.id, user.id), logStmt(db, user.id, row.id, 'me', 'password', 'A password was set for the team link.')] : []),
    ...(closing ? [clearTeamLinkSessions(db, row.id)] : []),
    // The old team link, renewed or closed, answers "this link was closed" (410) like the client link's.
    ...(row.team_link_token && token !== row.team_link_token ? [await retirePortalLink(db, row.id, user.id, row.team_link_token)] : []),
    ...(said ? [logStmt(db, user.id, row.id, 'me', 'link', said)] : []),
  ]);
  return c.json({ token, show });
});

// Set one, generate one (returned once), or clear it. Every open team session ends; the client link's sessions are left alone.
teamLinkOwner.put('/clients/:id/team-link/password', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await clientRow(db, user.id, c.req.param('id'));
  if (!row) return c.json({ error: 'not found' }, 404);
  const body = await bodyOf(c);
  const now = nowIso();
  if (body.clear === true) {
    // While the team link is on it keeps a password; switch it off first.
    if (row.team_link_token) return c.json({ error: 'switch the team link off before removing its password' }, 400);
    await db.batch([
      db.prepare('UPDATE agency_clients SET team_link_pass_hash = NULL, team_link_pass_salt = NULL, team_link_pass_set_at = NULL, updated_at = ? WHERE id = ? AND user_id = ?').bind(now, row.id, user.id),
      clearTeamLinkSessions(db, row.id),
      closePasswordRequest(db, user.id, row.id, 'team'),
      logStmt(db, user.id, row.id, 'me', 'password', 'The password on the team link was removed.'),
    ]);
    return c.json({ set: false });
  }
  const generated = body.generate === true;
  const password = generated ? newPortalPassword(row.name) : typeof body.password === 'string' ? body.password : '';
  const problem = portalPasswordProblem(password, row.name);
  if (problem) return c.json({ error: problem }, 400);
  const col = await passwordColumns(password);
  await db.batch([
    db.prepare('UPDATE agency_clients SET team_link_pass_hash = ?, team_link_pass_salt = ?, team_link_pass_set_at = ?, updated_at = ? WHERE id = ? AND user_id = ?').bind(col.hash, col.salt, now, now, row.id, user.id),
    clearTeamLinkSessions(db, row.id),
    closePasswordRequest(db, user.id, row.id, 'team'),
    logStmt(db, user.id, row.id, 'me', 'password', `A password was ${row.team_link_pass_hash ? 'changed' : 'set'} for the team link.`),
  ]);
  return c.json(generated ? { set: true, password } : { set: true });
});

// The owner dismisses their team's ask for a new password without changing it.
teamLinkOwner.post('/clients/:id/team-link/password-request/close', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await clientRow(db, user.id, c.req.param('id'));
  if (!row) return c.json({ error: 'not found' }, 404);
  const [res] = await db.batch([closePasswordRequest(db, user.id, row.id, 'team'), logStmt(db, user.id, row.id, 'me', 'password', 'The ask for a new team link password was dismissed.')]);
  return c.json({ ok: true, closed: (res?.meta.changes ?? 0) > 0 });
});

// ---- the team's side

interface TeamClient { id: string; user_id: string; name: string; pieces_per_month: number; team_link_json: string; owner_name: string; revisions_per_piece: number }
/** The client behind a team link. Only the team token is read, so a client link, invoice, agreement or document token finds nothing. */
async function teamClient(db: D1Database, token: string): Promise<TeamClient | null> {
  if (!/^[A-Z0-9]{16}$/.test(token)) return null;
  return db
    .prepare('SELECT c.id, c.user_id, c.name, c.pieces_per_month, c.team_link_json, c.revisions_per_piece, u.display_name AS owner_name FROM agency_clients c JOIN users u ON u.id = c.user_id WHERE c.team_link_token = ?')
    .bind(token)
    .first<TeamClient>();
}

/** The page: the work only, the parts switched on. No paper table is ever read here. */
async function teamLinkViewFor(db: D1Database, client: TeamClient): Promise<TeamLinkView> {
  const show = teamShowOf(client.team_link_json);
  const todayUtc = utcToday();
  const { start, end } = monthBounds(todayUtc.slice(0, 7));
  const none = <T,>() => Promise.resolve({ results: [] as T[] });
  type Waiting = { id: string; title: string; kind: DeliverableKind; platform: string; link: string; publish_date: string | null; revisions: number; allowed: number };
  type Coming = { id: string; title: string; kind: DeliverableKind; platform: string; stage: DeliverableStage; publish_date: string | null; revisions: number; allowed: number };
  type Done = { id: string; title: string; kind: DeliverableKind; platform: string; link: string; published_at: string | null };
  type Channel = { platform: string; published: number; open: number };
  const [waiting, coming, done, count, channels, face] = await Promise.all([
    show.waiting ? db.prepare("SELECT id, title, kind, platform, link, publish_date, revisions, COALESCE(revisions_allowed, ?) AS allowed FROM agency_items WHERE client_id = ? AND stage = 'review' ORDER BY COALESCE(publish_date, due_date, '9999-12-31') LIMIT 50").bind(client.revisions_per_piece, client.id).all<Waiting>() : none<Waiting>(),
    show.coming ? db.prepare("SELECT id, title, kind, platform, stage, publish_date, revisions, COALESCE(revisions_allowed, ?) AS allowed FROM agency_items WHERE client_id = ? AND stage IN ('script', 'making', 'approved') ORDER BY COALESCE(publish_date, due_date, '9999-12-31') LIMIT 30").bind(client.revisions_per_piece, client.id).all<Coming>() : none<Coming>(),
    show.published ? db.prepare("SELECT id, title, kind, platform, link, published_at FROM agency_items WHERE client_id = ? AND stage = 'published' ORDER BY published_at DESC LIMIT 20").bind(client.id).all<Done>() : none<Done>(),
    show.progress ? db.prepare("SELECT COUNT(*) AS n FROM agency_items WHERE client_id = ? AND stage = 'published' AND published_day >= ? AND published_day <= ?").bind(client.id, start, end).first<{ n: number }>() : Promise.resolve(null),
    show.channels
      ? db.prepare("SELECT platform, SUM(CASE WHEN stage = 'published' AND published_day >= ?2 AND published_day <= ?3 THEN 1 ELSE 0 END) AS published, SUM(CASE WHEN stage != 'published' THEN 1 ELSE 0 END) AS open FROM agency_items WHERE client_id = ?1 AND platform != '' GROUP BY platform ORDER BY published DESC").bind(client.id, start, end).all<Channel>()
      : none<Channel>(),
    agencyFace(db, client.user_id),
    // Opening the team link counts as a visit for the day, kept apart from the client link's. A day, nothing more.
    db.prepare("UPDATE agency_clients SET team_link_opened_day = ? WHERE id = ? AND COALESCE(team_link_opened_day, '') != ?").bind(todayUtc, client.id, todayUtc).run(),
  ]);
  const ids = waiting.results.map((w) => w.id);
  type Thread = { item_id: string; author: 'me' | 'client'; kind: NoteKind; body: string; created_at: string; via_team_link: number };
  // The shared thread, without the owner's private notes and without a note about a paid change (that is about money).
  const threads = ids.length && show.notes
    ? await db.prepare(`SELECT item_id, author, kind, body, created_at, via_team_link FROM agency_notes WHERE item_id IN (${ids.map(() => '?').join(',')}) AND author IN ('me', 'client') AND (shared = 1 OR author = 'client') AND kind != 'paid_change' ORDER BY created_at`).bind(...ids).all<Thread>()
    : { results: [] as Thread[] };
  return {
    teamView: true,
    agencyName: face.agencyName || nameOf({ display_name: client.owner_name }),
    agencyLogo: face.agencyLogo,
    agencyEmail: face.agencyEmail,
    clientName: client.name,
    show,
    waiting: waiting.results.map((w) => ({
      id: w.id,
      title: w.title,
      kind: w.kind,
      platform: w.platform,
      link: w.link,
      publishDate: w.publish_date,
      changes: { used: w.revisions, allowed: w.allowed },
      thread: threads.results.filter((t) => t.item_id === w.id).map((t) => ({ author: t.author, kind: t.kind, body: t.body, createdAt: t.created_at, ...(t.via_team_link === 1 ? { team: true } : {}) })),
    })),
    coming: coming.results.map((x) => ({ id: x.id, title: x.title, kind: x.kind, platform: x.platform, stage: x.stage, publishDate: x.publish_date, changes: { used: x.revisions, allowed: x.allowed } })),
    published: done.results.map((x) => ({ id: x.id, title: x.title, kind: x.kind, platform: x.platform, link: x.link, publishedAt: x.published_at })),
    month: show.progress ? { published: count?.n ?? 0, planned: client.pieces_per_month } : null,
    channels: channels.results.map((x) => ({ channel: x.platform, published: x.published ?? 0, open: x.open ?? 0 })),
  };
}

teamLinkPublic.get('/:token', async (c) => {
  const db = c.env.DB;
  const token = c.req.param('token');
  const client = await teamClient(db, token);
  if (!client) return (await closedLinkAnswer(c, token)) ?? c.json({ error: 'no page at this link' }, 404);
  const denied = await requireTeamLinkAccess(c, client.id);
  if (denied) return denied;
  c.header('Cache-Control', 'no-store');
  return c.json(await teamLinkViewFor(db, client));
});

teamLinkPublic.post('/:token/unlock', async (c) => {
  const token = c.req.param('token');
  const client = await teamLockRowForToken(c.env.DB, token);
  if (!client) {
    const closed = await closedLinkAnswer(c, token);
    if (closed) return closed;
  }
  return unlockTeamLink(c, client, client?.id ?? token);
});

// A note, or (only when the owner allowed it) an approval or a change, from the client's team. Each is recorded as from their team:
// the note is a client note marked `via_team_link`, and the owner's inbox line says "<client>'s team". A paid change is about money, so
// it is never asked from here; with no change left the team is told to ask the client.
teamLinkPublic.post('/:token/items/:id', async (c) => {
  const db = c.env.DB;
  const token = c.req.param('token');
  const client = await teamClient(db, token);
  if (!client) return (await closedLinkAnswer(c, token)) ?? c.json({ error: 'no page at this link' }, 404);
  const denied = await requireTeamLinkAccess(c, client.id);
  if (denied) return denied;
  const show = teamShowOf(client.team_link_json);
  const item = await db.prepare('SELECT id, title, stage, revisions, COALESCE(revisions_allowed, ?) AS allowed FROM agency_items WHERE id = ? AND client_id = ?').bind(client.revisions_per_piece, c.req.param('id'), client.id).first<{ id: string; title: string; stage: DeliverableStage; revisions: number; allowed: number }>();
  if (!item) return c.json({ error: 'not found' }, 404);
  const body = await bodyOf(c);
  const decision = oneOf(body.decision, ['approve', 'changes', 'comment'] as const, 'comment');
  if (decision === 'comment' ? !show.canComment : !show.canApprove) return c.json({ error: 'this link is for looking only' }, 403);
  const where = str(body.where, 60);
  const typed = str(body.note, AGENCY_NOTE_MAX);
  const note = decision === 'changes' && where && typed ? `${where}: ${typed}`.slice(0, AGENCY_NOTE_MAX) : typed;
  if (decision !== 'approve' && !note) return c.json({ error: decision === 'comment' ? 'write something' : 'say what to change' }, 400);
  if (decision === 'approve' && item.stage !== 'review') return c.json({ error: 'this one is not waiting for you' }, 400);
  const now = nowIso();
  const team = `${client.name}'s team`;
  const addNote = (kind: NoteKind) => db.prepare("INSERT INTO agency_notes (id, user_id, item_id, author, kind, shared, body, created_at, via_team_link) VALUES (?, ?, ?, 'client', ?, 1, ?, ?, 1)").bind(newId(), client.user_id, item.id, kind, note, now);
  let title = '';
  if (decision === 'approve') {
    const [moved] = await db.batch([
      db.prepare("UPDATE agency_items SET stage = 'approved', approved_at = ?, approved_day = ?, updated_at = ? WHERE id = ? AND stage = 'review'").bind(now, now.slice(0, 10), now, item.id),
      ...(note ? [db.prepare("INSERT INTO agency_notes (id, user_id, item_id, author, kind, shared, body, created_at, via_team_link) SELECT ?, ?, ?, 'client', 'comment', 1, ?, ?, 1 WHERE changes() > 0").bind(newId(), client.user_id, item.id, note, now)] : []),
    ]);
    if (!moved?.meta.changes) return c.json({ error: 'this piece moved on; look again' }, 409);
    title = `${team} approved ${item.title}`;
  } else if (decision === 'changes') {
    if (!(CHANGE_FROM_STAGES as readonly string[]).includes(item.stage)) return c.json({ error: 'a change can be asked for once the piece is in review' }, 400);
    // One statement spends the change and moves the piece, and only if one is left; two taps cannot spend the same one.
    const [moved] = await db.batch([
      db.prepare(`UPDATE agency_items SET stage = ?, revisions = revisions + 1, approved_at = NULL, approved_day = NULL, updated_at = ? WHERE id = ? AND client_id = ? AND stage IN ('review', 'approved') AND revisions < COALESCE(revisions_allowed, ?)`).bind(CHANGE_TO_STAGE, now, item.id, client.id, client.revisions_per_piece),
      db.prepare("INSERT INTO agency_notes (id, user_id, item_id, author, kind, shared, body, created_at, via_team_link) SELECT ?, ?, ?, 'client', 'change', 1, ?, ?, 1 WHERE changes() > 0").bind(newId(), client.user_id, item.id, note, now),
    ]);
    if (!moved?.meta.changes) return c.json({ error: item.revisions >= item.allowed ? `no changes are left on this piece; ask ${client.name}` : 'this piece moved on; look again', over: item.revisions >= item.allowed }, 409);
    title = `${team} sent back ${item.title} with a change`;
  } else {
    await addNote('comment').run();
    title = `${team} wrote on ${item.title}`;
  }
  await notify(db, client.user_id, 'agency', title, note.slice(0, 160), `/agency/${client.id}`);
  return c.json({ ok: true });
});
