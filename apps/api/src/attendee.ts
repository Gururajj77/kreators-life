import {
  ATTENDEE_CLAIMS_PER_DAY,
  ATTENDEE_XP_DEFAULT,
  attendeeXpLocked,
  attendeeXpProblem,
  codeProblem,
  codeWindow,
  normalizeCode,
  RUN_CODE_LENGTH,
  runEntryState,
  type AttendeeCodeHost,
  type AttendeeCodeView,
} from '@kreators/shared';
import { badgesNow, diffBadges, nowIso, randomCode } from './db';

/**
 * Attendee codes, the one rule for Party events, circles and runs. The host sets the xp (shared caps it) when the
 * event is made or later, and a code, their own word or a random one; the xp is fixed once the code opens, thirty
 * minutes before the start, and the code can still change. A claim needs the event's own guest list, the event's
 * window, the right code, and not being anyone who can see the code (the host, events staff, admins); it pays once
 * per person, at most ATTENDEE_CLAIMS_PER_DAY in any 24 hours, and the claim and the pay land together or not at all.
 * Runs keep their start code on the run and pay through run.ts; this file only sets their xp and code.
 */

export type EventApp = 'party' | 'circles';

export interface CodeRow {
  app: EventApp;
  thing_id: string;
  code: string;
  xp: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

type Failed = { error: string; status: 400 | 403 | 404 | 409 | 429 };

export const codeOf = (db: D1Database, app: EventApp, thingId: string) => db.prepare('SELECT * FROM attendee_codes WHERE app = ? AND thing_id = ?').bind(app, thingId).first<CodeRow>();

/** What the change asks for: a new xp, the host's own code, or a fresh random one. */
export interface CodeChange {
  xp?: unknown;
  code?: unknown;
  /** Make a new random code. */
  fresh?: unknown;
}

/**
 * Works out the xp and code a change leaves, or what is wrong with it. Shared by events, circles and runs. `locked`
 * is attendeeXpLocked for a change to an event that exists; a new event is never locked, it is where the xp is set.
 */
function nextCode(prev: { xp: number; code: string } | null, locked: boolean, change: CodeChange, length = 6): { xp: number; code: string } | Failed {
  let xp = prev?.xp ?? ATTENDEE_XP_DEFAULT;
  if (change.xp !== undefined && change.xp !== null && change.xp !== '') {
    const n = Number(change.xp);
    const bad = attendeeXpProblem(n);
    if (bad) return { error: bad, status: 400 };
    if (n !== xp && locked) return { error: 'The xp is fixed once the code opens, thirty minutes before the start: it was promised to the guests.', status: 400 };
    xp = n;
  }
  if (!prev && locked) return { error: 'Set the xp more than thirty minutes before the start, before the code opens.', status: 400 };
  let code = prev?.code ?? '';
  if (typeof change.code === 'string' && change.code.trim()) {
    const bad = codeProblem(change.code);
    if (bad) return { error: bad, status: 400 };
    code = normalizeCode(change.code);
  } else if (change.fresh === true || !code) code = randomCode(length);
  return { xp, code };
}

/**
 * Set an event's or a circle's xp and code. The caller checks that the person hosts it. `creating` is the create
 * form: the xp is set with the event, so only a start that has already passed is refused.
 */
export async function setEventCode(db: D1Database, app: EventApp, thingId: string, startsAt: string, actorId: string | null, change: CodeChange, creating = false): Promise<{ row: CodeRow } | Failed> {
  if (creating && Date.now() >= Date.parse(startsAt)) return { error: 'An event that has already started cannot get xp.', status: 400 };
  const prev = await codeOf(db, app, thingId);
  const next = nextCode(prev, creating ? false : attendeeXpLocked(startsAt), change);
  if ('error' in next) return next;
  const now = nowIso();
  await db
    .prepare(
      `INSERT INTO attendee_codes (app, thing_id, code, xp, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(app, thing_id) DO UPDATE SET code = excluded.code, xp = excluded.xp, updated_at = excluded.updated_at`,
    )
    .bind(app, thingId, next.code, next.xp, actorId, now, now)
    .run();
  return { row: { app, thing_id: thingId, code: next.code, xp: next.xp, created_by: prev?.created_by ?? actorId, created_at: prev?.created_at ?? now, updated_at: now } };
}

/** Set a run's xp and start code, by the same rule. The caller checks that the person hosts the club. */
export async function setRunCode(db: D1Database, run: { id: string; starts_at: string; xp: number; code: string }, change: CodeChange): Promise<{ xp: number; code: string } | Failed> {
  const next = nextCode({ xp: run.xp, code: run.code }, attendeeXpLocked(run.starts_at), change, RUN_CODE_LENGTH);
  if ('error' in next) return next;
  await db.prepare('UPDATE runs SET xp = ?, code = ? WHERE id = ?').bind(next.xp, next.code, run.id).run();
  return next;
}

/**
 * A new run's xp and start code: the host's, or the defaults. A run added after its start (a host who forgot) still
 * gets its code, but its xp is the usual ATTENDEE_XP_DEFAULT: xp is promised before a run starts, never after.
 */
export function newRunCode(change: CodeChange, startsAt: string): { xp: number; code: string; note: string | null } | Failed {
  const late = Date.now() >= Date.parse(startsAt);
  const asked = change.xp !== undefined && change.xp !== null && change.xp !== '' && Number(change.xp) !== ATTENDEE_XP_DEFAULT;
  const next = nextCode(null, false, late ? { code: change.code } : change, RUN_CODE_LENGTH);
  if ('error' in next) return next;
  return { ...next, note: late && asked ? `This run has already started, so it pays the usual ${ATTENDEE_XP_DEFAULT} xp.` : null };
}

/** What the host sees: the code, the xp, whether it is fixed, how many of how many guests claimed it, and when it works. */
export async function hostView(db: D1Database, row: CodeRow | null, startsAt: string, endsAt: string, guests: number): Promise<AttendeeCodeHost | null> {
  if (!row) return null;
  const n = await db.prepare('SELECT COUNT(*) AS n FROM attendee_claims WHERE app = ? AND thing_id = ?').bind(row.app, row.thing_id).first<{ n: number }>();
  return { code: row.code, xp: row.xp, locked: attendeeXpLocked(startsAt), claims: n?.n ?? 0, guests, ...codeWindow(startsAt, endsAt) };
}

/** What a guest sees: the xp, whether they claimed it, and when the code works. Never the code. */
export async function guestView(db: D1Database, row: CodeRow | null, userId: string, startsAt: string, endsAt: string): Promise<AttendeeCodeView | null> {
  if (!row) return null;
  const mine = await db.prepare('SELECT 1 FROM attendee_claims WHERE app = ? AND thing_id = ? AND user_id = ?').bind(row.app, row.thing_id, userId).first();
  return { xp: row.xp, claimed: Boolean(mine), state: runEntryState(startsAt, endsAt), ...codeWindow(startsAt, endsAt) };
}

/**
 * Claim an event's code. `guest` says whether the person is on this event's own list (the caller knows how its app
 * keeps one); `host` says whether they can see or set the code (its host, events staff, an admin), and those are
 * never paid. The claim row, the xp, the pillar and the ledger are one batch: the claim is written only while the
 * person is under the 24-hour cap, and the pay only when the claim was written, so a second tap, or two at once,
 * pays nothing.
 */
export async function claimEventCode(
  db: D1Database,
  a: { app: EventApp; thingId: string; userId: string; host: boolean; guest: boolean; cancelled: boolean; startsAt: string; endsAt: string; code: unknown },
): Promise<{ xp: number; newBadges: string[] } | Failed> {
  const row = await codeOf(db, a.app, a.thingId);
  if (!row) return { error: 'This event has no attendee code.', status: 404 };
  if (a.cancelled) return { error: 'This event was cancelled.', status: 400 };
  if (a.host) return { error: 'Hosts and the team give the code; they do not claim it.', status: 403 };
  if (!a.guest) return { error: 'Only the guests on this event’s list can use its code.', status: 403 };
  const state = runEntryState(a.startsAt, a.endsAt);
  if (state === 'early') return { error: 'The code works from thirty minutes before the start. Come back then.', status: 400 };
  if (state === 'closed') return { error: 'The code closed three hours after the end.', status: 400 };
  if (normalizeCode(a.code) !== row.code) return { error: 'That is not the code for this event. The host shows it there.', status: 400 };
  if (await db.prepare('SELECT 1 FROM attendee_claims WHERE app = ? AND thing_id = ? AND user_id = ?').bind(a.app, a.thingId, a.userId).first()) return { error: 'You already claimed this one.', status: 409 };
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const full = { error: `You claimed ${ATTENDEE_CLAIMS_PER_DAY} event codes in the last 24 hours, the most there is. One frees up a day after each claim.`, status: 429 as const };
  const day = await db.prepare('SELECT COUNT(*) AS n FROM attendee_claims WHERE user_id = ? AND created_at >= ?').bind(a.userId, since).first<{ n: number }>();
  if ((day?.n ?? 0) >= ATTENDEE_CLAIMS_PER_DAY) return full;
  const before = await badgesNow(db, a.userId);
  const now = nowIso();
  // ?1 person, ?2 app, ?3 event. Everything after the claim pays only if this claim's row is there.
  const claimed = 'EXISTS (SELECT 1 FROM attendee_claims WHERE app = ?2 AND thing_id = ?3 AND user_id = ?1)';
  let written = 0;
  try {
    const done = await db.batch([
      db.prepare('INSERT INTO attendee_claims (app, thing_id, user_id, xp, created_at) SELECT ?2, ?3, ?1, ?4, ?5 WHERE (SELECT COUNT(*) FROM attendee_claims WHERE user_id = ?1 AND created_at >= ?6) < ?7').bind(a.userId, a.app, a.thingId, row.xp, now, since, ATTENDEE_CLAIMS_PER_DAY),
      db.prepare(`UPDATE users SET xp = xp + ?4 WHERE id = ?1 AND ${claimed}`).bind(a.userId, a.app, a.thingId, row.xp),
      db.prepare(`UPDATE relationship_scores SET xp = xp + ?4 WHERE user_id = ?1 AND relationship = 'friendship' AND ${claimed}`).bind(a.userId, a.app, a.thingId, row.xp),
      db.prepare(`INSERT INTO xp_events (user_id, relationship, source, source_id, amount, created_at) SELECT ?1, 'friendship', 'attendee', ?2 || ':' || ?3, ?4, ?5 WHERE ${claimed}`).bind(a.userId, a.app, a.thingId, row.xp, now),
    ]);
    written = done[0]?.meta.changes ?? 0;
  } catch {
    return { error: 'You already claimed this one.', status: 409 };
  }
  if (written === 0) return full;
  return { xp: row.xp, newBadges: diffBadges(before, await badgesNow(db, a.userId)) };
}
