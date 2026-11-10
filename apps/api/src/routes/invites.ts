import { Hono } from 'hono';
import {
  INVITE_BATCH_MAX,
  INVITE_EXPIRY_CHOICES,
  INVITE_EXPIRY_DEFAULT,
  INVITE_LABEL_MAX,
  INVITE_STATES,
  inviteStateOf,
  MAX_OPEN_INVITES,
  normalizeInviteCode,
  WAITLIST_DONE,
  WAITLIST_NAME_MAX,
  WAITLIST_NOTE_MAX,
  WAITLIST_STATUSES,
  type AdminInvite,
  type AdminInvitesResponse,
  type InviteExpiry,
  type InviteState,
  type MyInvite,
  type MyInvitesResponse,
  type WaitlistEntry,
  type WaitlistResponse,
  type WaitlistStatus,
} from '@kreators/shared/invites';
import type { AppEnv } from '../env';
import { actorOf, adminIds, audit, canInvite, inBatches, likeFit, nameOf, newId, noteStmt, nowIso, objectBody, pageOf, paged, str, TEN_A_PAGE } from '../db';
import { sendEmail } from '../ops';
import { inviteLink, inviteOnly, inviteWorks, makeCodes, OPEN_SQL, siteBase, type InviteRow } from '../invites';

/**
 * Joining by invite (2026-11-10). Three doors:
 * - `invitesPublic` at /public: whether joining needs a code, whether a code works (the same answer for every reason it does not), and
 *   the waitlist (the same answer for every email). Core, no session.
 * - `myInvites` at /me/invites (core): the codes of someone who may make them (`canInvite`: an admin, staff, or Inviter).
 * - `adminInvites` at /admin/invites, behind Admin's own door (an admin's session or the key): every code, the switch and the waitlist.
 * The gate itself is in routes/auth.ts (`inviteGate` in ../invites.ts). Every write here is in ROUTE_LIMITS.
 */
export const invitesPublic = new Hono<AppEnv>();
export const myInvites = new Hono<AppEnv>();
export const adminInvites = new Hono<AppEnv>();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** The two mails the waitlist sends, named once: a removed row takes them out of the outbox by these. */
const WAITLIST_MAIL_SUBJECT = 'You are on the kreators.app waitlist';
const INVITE_MAIL_SUBJECT = 'Your invite to kreators.app';

/** A code row as its maker sees it. */
const toMine = (r: InviteRow, base: string, now: string): MyInvite => ({
  id: r.id,
  code: r.code,
  link: inviteLink(base, r.code),
  label: r.label,
  state: inviteStateOf({ usedAt: r.used_at, revokedAt: r.revoked_at, expiresAt: r.expires_at }, now),
  createdAt: r.created_at,
  expiresAt: r.expires_at,
  usedAt: r.used_at,
});

/** The body of a make: how many, a label, how long. Null with the words when it is not right. */
function makeBody(body: Record<string, unknown>): { count: number; label: string; days: InviteExpiry } | { error: string } {
  const count = body.count === undefined ? 1 : Number(body.count);
  if (!Number.isInteger(count) || count < 1 || count > INVITE_BATCH_MAX) return { error: `Make between 1 and ${INVITE_BATCH_MAX} codes at a time.` };
  let days: InviteExpiry = INVITE_EXPIRY_DEFAULT;
  if (body.days === null) days = null;
  else if (body.days !== undefined) {
    const d = Number(body.days);
    const pick = INVITE_EXPIRY_CHOICES.find((x) => x === d);
    if (pick === undefined) return { error: 'Pick 7, 30 or 90 days, or never.' };
    days = pick;
  }
  return { count, label: str(body.label, INVITE_LABEL_MAX), days };
}

/** The SQL for each state, at ?1 (now). Only invite_codes has these columns, so the open one needs no alias. */
const STATE_SQL: Record<InviteState, string> = {
  open: OPEN_SQL('?1'),
  used: 'i.used_by IS NOT NULL',
  revoked: 'i.used_by IS NULL AND i.revoked_at IS NOT NULL',
  expired: 'i.used_by IS NULL AND i.revoked_at IS NULL AND i.expires_at IS NOT NULL AND i.expires_at <= ?1',
};
const isState = (v: unknown): v is InviteState => typeof v === 'string' && (INVITE_STATES as readonly string[]).includes(v);
const isWaitStatus = (v: unknown): v is WaitlistStatus => typeof v === 'string' && (WAITLIST_STATUSES as readonly string[]).includes(v);

// ---- public: no session

// Whether a new account needs a code right now. One read.
invitesPublic.get('/join', async (c) => c.json({ inviteOnly: await inviteOnly(c.env.DB) }));

// Whether a code works. Unknown, used, taken back and past its day all answer the same, and nothing about who made it.
invitesPublic.get('/invite/:code', async (c) => {
  const code = normalizeInviteCode(c.req.param('code'));
  if (!code) return c.json({ ok: false });
  return c.json({ ok: await inviteWorks(c.env.DB, code) });
});

// The waitlist. The same answer whether the address is new, already waiting, already invited or already has an account, so nothing is
// learned about anyone. A new row gets one private mail saying so, and the admins hear a count, at most one note an hour each.
invitesPublic.post('/waitlist', async (c) => {
  const db = c.env.DB;
  const body = await objectBody(c);
  const email = str(body.email, 254).toLowerCase();
  const name = str(body.name, WAITLIST_NAME_MAX);
  const note = str(body.note, WAITLIST_NOTE_MAX);
  if (!EMAIL_RE.test(email)) return c.json({ error: 'that email does not look right' }, 400);
  if (!name) return c.json({ error: 'say your name' }, 400);
  const done = { ok: true, message: WAITLIST_DONE } as const;
  const account = await db.prepare('SELECT 1 AS x FROM users WHERE email = ?').bind(email).first();
  if (account) return c.json(done, 201);
  const now = nowIso();
  const res = await db.prepare("INSERT OR IGNORE INTO waitlist (id, email, name, note, status, created_at) VALUES (?, ?, ?, ?, 'waiting', ?)").bind(newId(), email, name, note, now).run();
  if (!res.meta.changes) return c.json(done, 201);
  // After the answer (the safety review, 2026-11-10), so a new address answers as fast as one already listed or with an account and the
  // time says nothing about anyone. The mail never repeats the typed name: anyone can type any address, so the words are only ours.
  const after = (async () => {
    await sendEmail(db, c.env, {
      private: true,
      to: email,
      subject: WAITLIST_MAIL_SUBJECT,
      body: 'Thanks. You are on the waitlist for kreators.app. We will email you when there is a place.\n\nIf you did not ask for this, you can ignore this mail.',
    }).catch(() => undefined);
    // A count only, never a name or an address. One note an hour per admin (`renew` on an id with the hour), its number kept fresh.
    const [ids, waiting] = await Promise.all([adminIds(db), db.prepare("SELECT COUNT(*) AS n FROM waitlist WHERE status = 'waiting'").first<{ n: number }>()]);
    const hour = now.slice(0, 13);
    const n = waiting?.n ?? 0;
    await inBatches(
      db,
      ids.map((uid) => noteStmt(db, { id: `waitlist-${hour}-${uid}`, userId: uid, kind: 'team', title: 'New on the waitlist', body: `${n} ${n === 1 ? 'person is' : 'people are'} waiting.`, link: '/admin?tab=invites', at: now }, 'renew')),
    );
  })().catch(() => undefined);
  try {
    c.executionCtx.waitUntil(after);
  } catch {
    await after;
  }
  return c.json(done, 201);
});

// ---- the maker's own codes (/me/invites, core)

myInvites.use('*', async (c, next) => {
  if (!canInvite(c.get('user'))) return c.json({ error: 'Only the team and people they made Inviters can make invite codes.' }, 403);
  await next();
});

myInvites.get('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const ask = pageOf(c, 'iv', TEN_A_PAGE);
  const [rows, joined] = await Promise.all([
    db.prepare('SELECT * FROM invite_codes WHERE created_by = ? ORDER BY created_at DESC, id LIMIT ? OFFSET ?').bind(user.id, ask.limit, ask.offset).all<InviteRow>(),
    db.prepare('SELECT COUNT(*) AS n FROM invite_codes WHERE created_by = ? AND used_by IS NOT NULL').bind(user.id).first<{ n: number }>(),
  ]);
  const pg = paged(rows.results, ask);
  const base = siteBase(c.env, c.req.url);
  const now = nowIso();
  const res: MyInvitesResponse = { items: pg.items.map((r) => toMine(r, base, now)), joinedCount: joined?.n ?? 0, page: pg.page };
  return c.json(res);
});

myInvites.post('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const asked = makeBody(await objectBody(c));
  if ('error' in asked) return c.json(asked, 400);
  const admin = user.role === 'admin';
  if (!admin) {
    const open = await db.prepare(`SELECT COUNT(*) AS n FROM invite_codes WHERE created_by = ?2 AND ${OPEN_SQL('?1')}`).bind(nowIso(), user.id).first<{ n: number }>();
    const left = MAX_OPEN_INVITES - (open?.n ?? 0);
    if (asked.count > left) return c.json({ error: left > 0 ? `You can hold ${MAX_OPEN_INVITES} unused codes at once. You can make ${left} more now.` : `You hold ${MAX_OPEN_INVITES} unused codes, the most at once. Take some back, or wait until they are used.` }, 400);
  }
  const made = await makeCodes(db, { makerId: user.id, count: asked.count, label: asked.label, days: asked.days, ...(admin ? {} : { cap: MAX_OPEN_INVITES }) });
  if (!made.length) return c.json({ error: `You hold ${MAX_OPEN_INVITES} unused codes, the most at once.` }, 400);
  const base = siteBase(c.env, c.req.url);
  const now = nowIso();
  return c.json({ items: made.map((r) => toMine(r, base, now)) }, 201);
});

// Take back a code of one's own while it is unused. Once used it stays as it is (409).
myInvites.delete('/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await db.prepare('SELECT * FROM invite_codes WHERE id = ? AND created_by = ?').bind(c.req.param('id'), user.id).first<InviteRow>();
  if (!row) return c.json({ error: 'not found' }, 404);
  if (row.used_by) return c.json({ error: 'That code was used already, so it stays.' }, 409);
  await db.prepare('UPDATE invite_codes SET revoked_at = ?, revoked_by = ? WHERE id = ? AND used_by IS NULL AND revoked_at IS NULL').bind(nowIso(), user.id, row.id).run();
  const after = await db.prepare('SELECT used_by FROM invite_codes WHERE id = ?').bind(row.id).first<{ used_by: string | null }>();
  if (after?.used_by) return c.json({ error: 'That code was used already, so it stays.' }, 409);
  return c.json({ ok: true });
});

// ---- Admin, Invites (/admin/invites: admins and the key only)

type AdminRow = InviteRow & { m_name: string | null; m_handle: string | null; u_name: string | null; u_handle: string | null };
const person = (id: string | null, name: string | null, handle: string | null) => (id && name !== null ? { id, name: nameOf({ display_name: name }), handle: handle ?? '' } : null);

adminInvites.get('/', async (c) => {
  const db = c.env.DB;
  const ask = pageOf(c);
  const state = c.req.query('state');
  const maker = str(c.req.query('maker'), 64);
  const q = likeFit(str(c.req.query('q'), 80));
  const now = nowIso();
  const rows = await db
    .prepare(
      `SELECT i.*, m.display_name AS m_name, m.handle AS m_handle, u.display_name AS u_name, u.handle AS u_handle
       FROM invite_codes i LEFT JOIN users m ON m.id = i.created_by LEFT JOIN users u ON u.id = i.used_by
       WHERE ${isState(state) ? STATE_SQL[state] : '?1 = ?1'}
         AND (?2 = '' OR i.created_by = ?2) AND (?3 = '' OR i.label LIKE ?4 OR i.code LIKE ?4)
       ORDER BY i.created_at DESC, i.id LIMIT ?5 OFFSET ?6`,
    )
    .bind(now, maker, q, `%${q}%`, ask.limit, ask.offset)
    .all<AdminRow>();
  const pg = paged(rows.results, ask);
  const base = siteBase(c.env, c.req.url);
  const items: AdminInvite[] = pg.items.map((r) => ({ ...toMine(r, base, now), revokedAt: r.revoked_at, maker: person(r.created_by, r.m_name, r.m_handle), usedBy: person(r.used_by, r.u_name, r.u_handle), waitlistId: r.waitlist_id }));
  const res: AdminInvitesResponse = { items, page: pg.page };
  return c.json(res);
});

adminInvites.post('/', async (c) => {
  const db = c.env.DB;
  const asked = makeBody(await objectBody(c));
  if ('error' in asked) return c.json(asked, 400);
  const actor = actorOf(c);
  const made = await makeCodes(db, { makerId: actor, count: asked.count, label: asked.label, days: asked.days });
  await audit(db, actor, 'invite.make', 'invite_code', made[0]?.id ?? null, '', { count: made.length, days: asked.days });
  const base = siteBase(c.env, c.req.url);
  const now = nowIso();
  const me = c.get('user');
  const items: AdminInvite[] = made.map((r) => ({ ...toMine(r, base, now), revokedAt: null, maker: me ? { id: me.id, name: nameOf(me), handle: me.handle ?? '' } : null, usedBy: null, waitlistId: null }));
  return c.json({ items }, 201);
});

adminInvites.get('/settings', async (c) => c.json({ inviteOnly: await inviteOnly(c.env.DB) }));

// The switch. Off lets anyone make an account; on asks every new account for a code. Audited either way.
adminInvites.put('/settings', async (c) => {
  const db = c.env.DB;
  const body = await objectBody(c);
  if (typeof body.inviteOnly !== 'boolean') return c.json({ error: 'inviteOnly is true or false' }, 400);
  const before = await inviteOnly(db);
  await db
    .prepare("INSERT INTO signup_settings (key, value, updated_at) VALUES ('invite_only', ?1, ?2) ON CONFLICT(key) DO UPDATE SET value = ?1, updated_at = ?2")
    .bind(body.inviteOnly ? '1' : '0', nowIso())
    .run();
  if (before !== body.inviteOnly) await audit(db, actorOf(c), 'invite.gate', 'signup_settings', 'invite_only', before ? 'on' : 'off', body.inviteOnly ? 'on' : 'off');
  return c.json({ inviteOnly: body.inviteOnly });
});

// ---- the waitlist (admins only)

type WaitRow = { id: string; email: string; name: string; note: string; status: WaitlistStatus; created_at: string; decided_at: string | null; invite_id: string | null; code: string | null; used_by: string | null; revoked_at: string | null; expires_at: string | null };
const WAIT_SELECT = 'SELECT w.*, i.code, i.used_by, i.revoked_at, i.expires_at FROM waitlist w LEFT JOIN invite_codes i ON i.id = w.invite_id';

adminInvites.get('/waitlist', async (c) => {
  const db = c.env.DB;
  const ask = pageOf(c);
  const status = c.req.query('status');
  const q = likeFit(str(c.req.query('q'), 80));
  const [rows, waiting] = await Promise.all([
    db
      .prepare(
        `${WAIT_SELECT} WHERE (?1 = '' OR w.status = ?1) AND (?2 = '' OR w.name LIKE ?3 OR w.email LIKE ?3)
         ORDER BY CASE w.status WHEN 'waiting' THEN 0 ELSE 1 END, w.created_at DESC, w.id LIMIT ?4 OFFSET ?5`,
      )
      .bind(isWaitStatus(status) ? status : '', q, `%${q}%`, ask.limit, ask.offset)
      .all<WaitRow>(),
    db.prepare("SELECT COUNT(*) AS n FROM waitlist WHERE status = 'waiting'").first<{ n: number }>(),
  ]);
  const pg = paged(rows.results, ask);
  const base = siteBase(c.env, c.req.url);
  const items: WaitlistEntry[] = pg.items.map((r) => {
    const shown = r.code && !r.revoked_at ? r.code : null;
    return { id: r.id, email: r.email, name: r.name, note: r.note, status: r.status, createdAt: r.created_at, decidedAt: r.decided_at, code: shown, link: shown ? inviteLink(base, shown) : null };
  });
  const res: WaitlistResponse = { items, page: pg.page, waiting: waiting?.n ?? 0 };
  return c.json(res);
});

// Yes: a code tied to the row, its link mailed (private, never marketing). Asked twice, it answers the code it made, never a second one.
adminInvites.post('/waitlist/:id/approve', async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  const base = siteBase(c.env, c.req.url);
  const read = () => db.prepare(`${WAIT_SELECT} WHERE w.id = ?`).bind(id).first<WaitRow>();
  const row = await read();
  if (!row) return c.json({ error: 'not found' }, 404);
  if (row.status === 'joined') return c.json({ error: 'They joined already.' }, 409);
  const now = nowIso();
  const stillWorks = (r: WaitRow) => r.code && inviteStateOf({ usedAt: r.used_by, revokedAt: r.revoked_at, expiresAt: r.expires_at }, now) === 'open';
  if (row.status === 'invited' && stillWorks(row)) return c.json({ code: row.code, link: inviteLink(base, row.code!), emailed: false, already: true });
  const actor = actorOf(c);
  const [made] = await makeCodes(db, { makerId: actor, count: 1, label: row.name.slice(0, 60), days: INVITE_EXPIRY_DEFAULT, waitlistId: row.id });
  if (!made) return c.json({ error: 'something broke on our side' }, 500);
  // Guarded on the row as it was read, so two yeses at once keep one code: the other one's code is removed and its answer is the kept one.
  const moved = await db
    .prepare("UPDATE waitlist SET status = 'invited', invite_id = ?, decided_at = ?, decided_by = ? WHERE id = ? AND status != 'joined' AND COALESCE(invite_id, '') = ?")
    .bind(made.id, now, actor, row.id, row.invite_id ?? '')
    .run();
  if (!moved.meta.changes) {
    await db.prepare('DELETE FROM invite_codes WHERE id = ? AND used_by IS NULL').bind(made.id).run();
    const kept = await read();
    return kept?.code ? c.json({ code: kept.code, link: inviteLink(base, kept.code), emailed: false, already: true }) : c.json({ error: 'They were answered already.' }, 409);
  }
  // An older code for the row that no longer works stays as it is; a new one replaces it on the row.
  const link = inviteLink(base, made.code);
  const sent = await sendEmail(db, c.env, {
    private: true,
    to: row.email,
    subject: INVITE_MAIL_SUBJECT,
    body: `Hello ${row.name}. A place is ready for you on kreators.app.\n\nTap this link to join:\n${link}\n\nOr type this invite code when you start: ${made.code}\n\nIt works once, for ${INVITE_EXPIRY_DEFAULT} days.`,
  }).catch(() => 'failed' as const);
  await audit(db, actor, 'waitlist.approve', 'waitlist', row.id, row.status, 'invited');
  return c.json({ code: made.code, link, emailed: sent === 'sent' });
});

// No: nothing is sent. A code the row was given and nobody used is taken back.
adminInvites.post('/waitlist/:id/decline', async (c) => {
  const db = c.env.DB;
  const actor = actorOf(c);
  const now = nowIso();
  const row = await db.prepare('SELECT id, status, invite_id FROM waitlist WHERE id = ?').bind(c.req.param('id')).first<{ id: string; status: WaitlistStatus; invite_id: string | null }>();
  if (!row) return c.json({ error: 'not found' }, 404);
  if (row.status === 'joined') return c.json({ error: 'They joined already.' }, 409);
  const res = await db.prepare("UPDATE waitlist SET status = 'declined', decided_at = ?, decided_by = ? WHERE id = ? AND status IN ('waiting', 'invited')").bind(now, actor, row.id).run();
  if (res.meta.changes && row.invite_id) await db.prepare('UPDATE invite_codes SET revoked_at = ?, revoked_by = ? WHERE id = ? AND used_by IS NULL AND revoked_at IS NULL').bind(now, actor, row.invite_id).run();
  if (res.meta.changes) await audit(db, actor, 'waitlist.decline', 'waitlist', row.id, row.status, 'declined');
  return c.json({ ok: true });
});

adminInvites.delete('/waitlist/:id', async (c) => {
  const db = c.env.DB;
  const actor = actorOf(c);
  const row = await db.prepare('SELECT id, email, status, invite_id FROM waitlist WHERE id = ?').bind(c.req.param('id')).first<{ id: string; email: string; status: WaitlistStatus; invite_id: string | null }>();
  if (!row) return c.json({ error: 'not found' }, 404);
  await db.batch([
    db.prepare('DELETE FROM waitlist WHERE id = ?').bind(row.id),
    // "It goes at once if you ask us" (RETENTION): the two waitlist mails to that address (sent to no account) go with the row.
    db.prepare(`DELETE FROM email_outbox WHERE to_email = ? AND user_id IS NULL AND subject IN ('${WAITLIST_MAIL_SUBJECT}', '${INVITE_MAIL_SUBJECT}')`).bind(row.email),
    ...(row.invite_id ? [db.prepare('UPDATE invite_codes SET revoked_at = ?, revoked_by = ? WHERE id = ? AND used_by IS NULL AND revoked_at IS NULL').bind(nowIso(), actor, row.invite_id)] : []),
  ]);
  await audit(db, actor, 'waitlist.delete', 'waitlist', row.id, row.status, '');
  return c.json({ ok: true });
});

// Take back any unused code. Audited.
adminInvites.delete('/:id', async (c) => {
  const db = c.env.DB;
  const actor = actorOf(c);
  const row = await db.prepare('SELECT * FROM invite_codes WHERE id = ?').bind(c.req.param('id')).first<InviteRow>();
  if (!row) return c.json({ error: 'not found' }, 404);
  if (row.used_by) return c.json({ error: 'That code was used already, so it stays.' }, 409);
  const res = await db.prepare('UPDATE invite_codes SET revoked_at = ?, revoked_by = ? WHERE id = ? AND used_by IS NULL AND revoked_at IS NULL').bind(nowIso(), actor, row.id).run();
  if (res.meta.changes) await audit(db, actor, 'invite.revoke', 'invite_code', row.id, '', 'revoked');
  return c.json({ ok: true });
});

