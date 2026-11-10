import { CONNECT_REWARD, INVITE_REWARD, type RelationshipKey } from '@kreators/shared';
import { INVITE_ALPHABET, INVITE_CODE_LENGTH, inviteLinkPath, normalizeInviteCode, type InviteExpiry } from '@kreators/shared/invites';
import type { ConnectKind } from '@kreators/shared/connect';
import type { Env, UserRow } from './env';
import { DELETED_NAME, getUser, inBatches, newId, noteStmt, nowIso, randomCode } from './db';

/**
 * Joining by invite (2026-11-10) and what bringing people in and the team's connections pay. The routes are in routes/invites.ts; the gate
 * on a new account is in routes/auth.ts (`inviteGate`). See packages/shared/src/invites.ts for the words and the rules.
 */

/** Is "Invite only" on? One read of one row. A missing row reads as on, since the migration put it there on. */
export async function inviteOnly(db: D1Database): Promise<boolean> {
  const row = await db.prepare("SELECT value FROM signup_settings WHERE key = 'invite_only'").first<{ value: string }>();
  return row ? row.value === '1' : true;
}

/** Ten characters from the alphabet with no look-alikes, without bias (a byte past the last whole round of 31 is drawn again). */
export function newInviteCode(): string {
  const n = INVITE_ALPHABET.length;
  const top = 256 - (256 % n);
  let out = '';
  while (out.length < INVITE_CODE_LENGTH) {
    for (const b of crypto.getRandomValues(new Uint8Array(INVITE_CODE_LENGTH * 2))) {
      if (b < top && out.length < INVITE_CODE_LENGTH) out += INVITE_ALPHABET[b % n];
    }
  }
  return out;
}

/** The site's own address for a link that goes out: PUBLIC_URL, never the Host a request names; only without it (local development) the request's origin. */
export function siteBase(env: Pick<Env, 'PUBLIC_URL'>, reqUrl: string): string {
  return (env.PUBLIC_URL ?? '').trim().replace(/\/+$/, '') || new URL(reqUrl).origin;
}
export const inviteLink = (base: string, code: string): string => `${base}${inviteLinkPath(code)}`;

export interface InviteRow {
  id: string;
  code: string;
  created_by: string | null;
  label: string;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
  used_by: string | null;
  used_at: string | null;
  waitlist_id: string | null;
  setup_done_at: string | null;
}

/** The SQL for a code that still works at ?now (a numbered parameter). */
export const OPEN_SQL = (now: string) => `used_by IS NULL AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ${now})`;

/**
 * The maker may still make codes (the safety review, 2026-11-10): a code someone made stops working once they lose Inviter or their
 * staff role, or their account goes, since that is when the team stops trusting who they let in. A code the admin key made (no maker) and
 * a waitlist yes (the team's decision, already mailed to that person) keep working. `canInvite` in shared is the rule; this is it in SQL,
 * checked where a code is read as working and where it is claimed. `revokeIfCannotInvite` marks them taken back so the lists say so too.
 */
const MAKER_CAN_SQL = `(invite_codes.created_by IS NULL OR invite_codes.waitlist_id IS NOT NULL OR EXISTS (SELECT 1 FROM users mk WHERE mk.id = invite_codes.created_by AND (mk.role IN ('admin', 'sub_admin') OR mk.permissions LIKE '%"invite"%')))`;

/** Whether a code works right now, without using it (GET /public/invite/:code, and the sign-up's look before the 409 and the hashing). */
export async function inviteWorks(db: D1Database, code: string): Promise<boolean> {
  const row = await db.prepare(`SELECT 1 AS x FROM invite_codes WHERE code = ?2 AND ${OPEN_SQL('?1')} AND ${MAKER_CAN_SQL}`).bind(nowIso(), code).first();
  return Boolean(row);
}

/** After a role or permission change: the person's unused codes are taken back when they can no longer make codes (one statement, nothing when they still can). */
export function revokeIfCannotInvite(db: D1Database, userId: string, actorId: string | null): D1PreparedStatement {
  return db
    .prepare(`UPDATE invite_codes SET revoked_at = ?1, revoked_by = ?2 WHERE created_by = ?3 AND used_by IS NULL AND revoked_at IS NULL AND NOT ${MAKER_CAN_SQL}`)
    .bind(nowIso(), actorId, userId);
}

/**
 * Makes codes, fifty to a round trip. The days are one of the choices (null never runs out). With `cap`, each insert lands only while the
 * maker holds fewer open codes than that (MAX_OPEN_INVITES for someone who is not an admin), counted inside the insert, so two batches at
 * once never pass it; only the codes that landed come back.
 */
export async function makeCodes(db: D1Database, o: { makerId: string | null; count: number; label: string; days: InviteExpiry; waitlistId?: string | null; cap?: number }): Promise<InviteRow[]> {
  const now = nowIso();
  const expires = o.days === null ? null : new Date(Date.now() + o.days * 86_400_000).toISOString();
  const rows: InviteRow[] = Array.from({ length: o.count }, () => ({
    id: newId(),
    code: newInviteCode(),
    created_by: o.makerId,
    label: o.label,
    created_at: now,
    expires_at: expires,
    revoked_at: null,
    revoked_by: null,
    used_by: null,
    used_at: null,
    waitlist_id: o.waitlistId ?? null,
    setup_done_at: null,
  }));
  const done = await inBatches(
    db,
    rows.map((r) =>
      o.cap === undefined
        ? db.prepare('INSERT INTO invite_codes (id, code, created_by, label, created_at, expires_at, waitlist_id) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(r.id, r.code, r.created_by, r.label, r.created_at, r.expires_at, r.waitlist_id)
        : db
            .prepare(`INSERT INTO invite_codes (id, code, created_by, label, created_at, expires_at, waitlist_id) SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7 WHERE (SELECT COUNT(*) FROM invite_codes WHERE created_by = ?3 AND ${OPEN_SQL('?5')}) < ?8`)
            .bind(r.id, r.code, r.created_by, r.label, r.created_at, r.expires_at, r.waitlist_id, o.cap),
    ),
  );
  return rows.filter((_, i) => (done[i]?.meta.changes ?? 0) > 0);
}

export type GateAnswer = { ok: true; invite: InviteRow | null; referral: string | null } | { ok: false; reason: 'invite' | 'invite-unusable' };

/**
 * The gate on a new account (POST /auth/anon, and /auth/signup when it makes an account). While Invite only is on, no code is `invite` and a
 * code that does not work is `invite-unusable`, the same words for unknown, used, taken back and past its day. A good code is claimed here,
 * before the account is made, for the id the account will have; the caller gives it back (`releaseInvite`) if making the account fails.
 * With the gate off a good code is still claimed, so the join is credited to its maker; a bad one is ignored. `pass` is a founder's
 * address: no code is asked for and none is used, so the founders can never be locked out.
 */
export async function inviteGate(db: D1Database, raw: unknown, newUserId: string, pass = false): Promise<GateAnswer> {
  if (pass) return { ok: true, invite: null, referral: null };
  const typed = typeof raw === 'string' && raw.trim() !== '';
  const [on, code] = [await inviteOnly(db), normalizeInviteCode(raw)];
  if (!typed) return on ? { ok: false, reason: 'invite' } : { ok: true, invite: null, referral: null };
  const claimed = code ? await claimInvite(db, code, newUserId) : null;
  if (!claimed) return on ? { ok: false, reason: 'invite-unusable' } : { ok: true, invite: null, referral: null };
  return { ok: true, invite: claimed, referral: await makerReferral(db, claimed.created_by) };
}

/**
 * Takes a code for an account about to be made: one guarded UPDATE, so of two people using one code at once exactly one gets it, and the
 * partial unique index on used_by means an account never holds two. Null when the code is unknown, used, taken back or past its day.
 */
export async function claimInvite(db: D1Database, code: string, userId: string): Promise<InviteRow | null> {
  const now = nowIso();
  const res = await db
    .prepare(`UPDATE invite_codes SET used_by = ?1, used_at = ?2 WHERE code = ?3 AND ${OPEN_SQL('?2')} AND ${MAKER_CAN_SQL}`)
    .bind(userId, now, code)
    .run()
    .catch(() => null);
  if (!res?.meta.changes) return null;
  return db.prepare('SELECT * FROM invite_codes WHERE code = ? AND used_by = ?').bind(code, userId).first<InviteRow>();
}

/** Gives a claimed code back when making the account failed after it, so the code still works. */
export async function releaseInvite(db: D1Database, code: string, userId: string): Promise<void> {
  await db.prepare('UPDATE invite_codes SET used_by = NULL, used_at = NULL WHERE code = ? AND used_by = ?').bind(code, userId).run();
}

/** The maker's referral code (their affiliate code), given them now if they never had one, the way /me does. Null for the admin key or a deleted maker. */
export async function makerReferral(db: D1Database, makerId: string | null): Promise<string | null> {
  if (!makerId) return null;
  const [, row] = await db.batch<{ referral_code: string | null; display_name: string }>([
    db.prepare(`UPDATE users SET referral_code = ? WHERE id = ? AND referral_code IS NULL AND display_name != '${DELETED_NAME}'`).bind(randomCode(), makerId),
    db.prepare('SELECT referral_code, display_name FROM users WHERE id = ?').bind(makerId),
  ]);
  const r = row?.results[0];
  return r && r.display_name !== DELETED_NAME ? r.referral_code : null;
}

const noteId = (inviteId: string) => `invite-${inviteId}`;
const noteLink = (maker: Pick<UserRow, 'role'>) => (maker.role === 'admin' ? '/admin?tab=invites' : '/you#invites');

/**
 * After an account was made with a code: the waitlist row it came from is marked joined, and the maker hears it once, under the code's label
 * and never the new person's name. The note is rewritten in place (`invite-<code id>`) when the person finishes setup, so one code is one note.
 */
export async function afterInviteJoin(db: D1Database, invite: InviteRow): Promise<void> {
  const maker = invite.created_by ? await getUser(db, invite.created_by) : null;
  const stmts: D1PreparedStatement[] = [];
  if (invite.waitlist_id) stmts.push(db.prepare("UPDATE waitlist SET status = 'joined' WHERE id = ? AND status IN ('waiting', 'invited')").bind(invite.waitlist_id));
  if (maker && maker.display_name !== DELETED_NAME) {
    stmts.push(
      // note-link: /you#invites, /admin
      noteStmt(db, { id: noteId(invite.id), userId: maker.id, kind: 'affiliate', title: 'Someone joined with your invite', body: invite.label ? `Your code for “${invite.label}” was used.` : 'One of your invite codes was used.', link: noteLink(maker) }, 'renew'),
    );
  }
  // A note that fails never undoes the join: the account and its code are already made, and the person still gets their session.
  if (stmts.length) await db.batch(stmts).catch(() => undefined);
}

/**
 * Pays once, inside the daily cap: the first statement claims the payment (an xp_events row for this source and ref, written only while none
 * exists and today's count is under the cap, one statement, so two at once pay once), and only a claim that went through moves the totals.
 */
async function payOnce(db: D1Database, p: { userId: string; source: string; ref: string; xp: number; points: number; relationship: RelationshipKey; perDay: number }): Promise<boolean> {
  const now = nowIso();
  const dayStart = `${now.slice(0, 10)}T00:00:00`;
  const claim = await db
    .prepare(
      `INSERT INTO xp_events (user_id, relationship, source, source_id, amount, created_at)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6
       WHERE NOT EXISTS (SELECT 1 FROM xp_events WHERE user_id = ?1 AND source = ?3 AND source_id = ?4)
         AND (SELECT COUNT(*) FROM xp_events WHERE user_id = ?1 AND source = ?3 AND created_at >= ?7) < ?8`,
    )
    .bind(p.userId, p.relationship, p.source, p.ref, p.xp, now, dayStart, p.perDay)
    .run();
  if (!claim.meta.changes) return false;
  await db.batch([
    db.prepare('UPDATE users SET xp = xp + ?, points = points + ? WHERE id = ?').bind(p.xp, p.points, p.userId),
    db.prepare('UPDATE relationship_scores SET xp = xp + ? WHERE user_id = ? AND relationship = ?').bind(p.xp, p.userId, p.relationship),
    ...(p.points > 0 ? [db.prepare('INSERT INTO points_ledger (user_id, amount, reason, ref, created_at) VALUES (?, ?, ?, ?, ?)').bind(p.userId, p.points, p.source, p.ref, now)] : []),
  ]);
  return true;
}

/** Someone who earns from these: alive and not an admin (an admin earns nothing from bringing people in or from the team's connections). */
const earns = (u: UserRow | null): u is UserRow => Boolean(u && u.role !== 'admin' && u.display_name !== DELETED_NAME);

/**
 * The person who joined with a code finished setup: the referral pays the code's maker once (INVITE_REWARD), never at the bare sign-up.
 * Claimed by `setup_done_at` on the code, so setup done twice (an erase of progress, then setup again) never pays twice. Called by both of
 * the setup's saves (routes/onboarding.ts). The maker's note is the join note, rewritten in place.
 */
export async function payInviteOnSetup(db: D1Database, userId: string): Promise<void> {
  const now = nowIso();
  // Setup finished on a real account (the safety review, 2026-11-10): an email on it as well as setup, so a device session that ticked
  // through the setup and was never made an account pays nothing. The setup chat asks for the account first, so a real join has both;
  // when the email comes after the setup, the sign-up that adds it calls this too (routes/auth.ts).
  const claim = await db
    .prepare('UPDATE invite_codes SET setup_done_at = ?1 WHERE used_by = ?2 AND setup_done_at IS NULL AND EXISTS (SELECT 1 FROM users WHERE id = ?2 AND email IS NOT NULL AND onboarded_at IS NOT NULL)')
    .bind(now, userId)
    .run();
  if (!claim.meta.changes) return;
  const invite = await db.prepare('SELECT * FROM invite_codes WHERE used_by = ?').bind(userId).first<InviteRow>();
  const maker = invite?.created_by ? await getUser(db, invite.created_by) : null;
  if (!invite || !maker || maker.display_name === DELETED_NAME) return;
  const paid = earns(maker) ? await payOnce(db, { userId: maker.id, source: 'invite', ref: userId, xp: INVITE_REWARD.xp, points: INVITE_REWARD.points, relationship: 'friendship', perDay: INVITE_REWARD.perDay }) : false;
  const body = paid
    ? `+${INVITE_REWARD.xp} xp, +${INVITE_REWARD.points} points.`
    : earns(maker)
      ? `That is ${INVITE_REWARD.perDay} today, the most that pay in a day, so this one paid nothing.`
      : invite.label
        ? `Your code for “${invite.label}” was used.`
        : '';
  // note-link: /you#invites, /admin
  await noteStmt(db, { id: noteId(invite.id), userId: maker.id, kind: 'affiliate', title: 'Someone you invited finished setting up', body, link: noteLink(maker) }, 'renew').run();
}

/**
 * Which pillar a connection counts toward: friends for friends, teachers for a coach and School, servitude for Agency, the Club and a
 * brand's team. A cohort manager named by the team is a job given, not a connection, so it never pays (adminConnect.ts); it is here only so
 * every kind has a pillar.
 */
const CONNECT_PILLAR: Record<ConnectKind, RelationshipKey> = { friends: 'friendship', coach: 'guru', program: 'guru', product: 'guru', agency: 'servant_leader', club: 'servant_leader', cohort: 'guru', org: 'servant_leader' };

/**
 * A connection the team made came true (a yes, or a direct link): each side who earns gets CONNECT_REWARD once, within the day's cap.
 * Claimed by `came_true_at`, so two yeses at once pay once and nothing is paid again; nothing comes back when it later ends.
 */
export async function payConnection(db: D1Database, connectionId: string): Promise<void> {
  const claim = await db.prepare('UPDATE team_connections SET came_true_at = ? WHERE id = ? AND came_true_at IS NULL AND ended_at IS NULL').bind(nowIso(), connectionId).run();
  if (!claim.meta.changes) return;
  const row = await db.prepare('SELECT kind, first_user_id, second_user_id FROM team_connections WHERE id = ?').bind(connectionId).first<{ kind: ConnectKind; first_user_id: string; second_user_id: string | null }>();
  if (!row) return;
  const people = await Promise.all([row.first_user_id, row.second_user_id].filter((x): x is string => Boolean(x)).map((id) => getUser(db, id)));
  for (const u of people) {
    if (earns(u)) await payOnce(db, { userId: u.id, source: 'connect', ref: connectionId, xp: CONNECT_REWARD.xp, points: CONNECT_REWARD.points, relationship: CONNECT_PILLAR[row.kind] ?? 'friendship', perDay: CONNECT_REWARD.perDay });
  }
}

/**
 * The yes in another app made a team connection real: a coach link that became active, an Agency invite accepted, a cohort joined from a
 * program invite, a course bought from a course invite, two people who became friends. Finds the open rows it answers and pays each once.
 */
export async function connectionsCameTrue(db: D1Database, kind: ConnectKind, match: { refId?: string; userId?: string; pair?: [string, string] }): Promise<void> {
  let rows: { id: string }[] = [];
  if (kind === 'friends' && match.pair) {
    const [a, b] = match.pair[0] < match.pair[1] ? match.pair : [match.pair[1], match.pair[0]];
    rows = (await db.prepare("SELECT id FROM team_connections WHERE kind = 'friends' AND first_user_id = ? AND second_user_id = ? AND came_true_at IS NULL AND status IN ('asked', 'accepted')").bind(a, b).all<{ id: string }>()).results;
  } else if (match.refId) {
    rows = (
      await db
        .prepare('SELECT id FROM team_connections WHERE kind = ? AND ref_id = ? AND (? IS NULL OR first_user_id = ?) AND came_true_at IS NULL AND ended_at IS NULL')
        .bind(kind, match.refId, match.userId ?? null, match.userId ?? null)
        .all<{ id: string }>()
    ).results;
  }
  for (const r of rows) await payConnection(db, r.id);
}
