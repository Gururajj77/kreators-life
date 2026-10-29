import {
  ATTENDEE_CLAIMS_PER_DAY,
  ATTENDEE_XP_DEFAULT,
  attendeeXpLocked,
  attendeeXpProblem,
  codeProblem,
  normalizeCode,
  RUN_CODE_LENGTH,
  runEntryState,
  type AttendeeCodeHost,
  type AttendeeCodeView,
} from '@kreators/shared';
import { badgesNow, diffBadges, nowIso, randomCode } from './db';

/**
 * Attendee codes, the one rule for Party events, circles and runs. Before an event starts its host sets the xp
 * (shared caps it) and a code, their own word or a random one; the xp is fixed once it starts, the code can still
 * change. A claim needs the event's own guest list, the event's window, the right code, and not being its host; it
 * pays once per person, at most ATTENDEE_CLAIMS_PER_DAY a day, and the claim and the pay land together or not at all.
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

/** Works out the xp and code a change leaves, or what is wrong with it. Shared by events, circles and runs. */
function nextCode(prev: { xp: number; code: string } | null, startsAt: string, change: CodeChange, length = 6): { xp: number; code: string } | Failed {
  const locked = attendeeXpLocked(startsAt);
  let xp = prev?.xp ?? ATTENDEE_XP_DEFAULT;
  if (change.xp !== undefined && change.xp !== null && change.xp !== '') {
    const n = Number(change.xp);
    const bad = attendeeXpProblem(n);
    if (bad) return { error: bad, status: 400 };
    if (n !== xp && locked) return { error: 'The xp is fixed once the event has started: it was promised to the guests.', status: 400 };
    xp = n;
  }
  if (!prev && locked) return { error: 'Set the xp before the event starts.', status: 400 };
  let code = prev?.code ?? '';
  if (typeof change.code === 'string' && change.code.trim()) {
    const bad = codeProblem(change.code);
    if (bad) return { error: bad, status: 400 };
    code = normalizeCode(change.code);
  } else if (change.fresh === true || !code) code = randomCode(length);
  return { xp, code };
}

/** Set an event's or a circle's xp and code. The caller checks that the person hosts it. */
export async function setEventCode(db: D1Database, app: EventApp, thingId: string, startsAt: string, actorId: string | null, change: CodeChange): Promise<{ row: CodeRow } | Failed> {
  const prev = await codeOf(db, app, thingId);
  const next = nextCode(prev, startsAt, change);
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
  const next = nextCode({ xp: run.xp, code: run.code }, run.starts_at, change, RUN_CODE_LENGTH);
  if ('error' in next) return next;
  await db.prepare('UPDATE runs SET xp = ?, code = ? WHERE id = ?').bind(next.xp, next.code, run.id).run();
  return next;
}

/** A new run's xp and start code: the host's, or the defaults. */
export function newRunCode(change: CodeChange): { xp: number; code: string } | Failed {
  return nextCode(null, new Date(Date.now() + 60_000).toISOString(), change, RUN_CODE_LENGTH);
}

/** What the host sees: the code, the xp, whether it is fixed, and how many of how many guests claimed it. */
export async function hostView(db: D1Database, row: CodeRow | null, startsAt: string, guests: number): Promise<AttendeeCodeHost | null> {
  if (!row) return null;
  const n = await db.prepare('SELECT COUNT(*) AS n FROM attendee_claims WHERE app = ? AND thing_id = ?').bind(row.app, row.thing_id).first<{ n: number }>();
  return { code: row.code, xp: row.xp, locked: attendeeXpLocked(startsAt), claims: n?.n ?? 0, guests };
}

/** What a guest sees: the xp, whether they claimed it, and whether the code works now. Never the code. */
export async function guestView(db: D1Database, row: CodeRow | null, userId: string, startsAt: string, endsAt: string): Promise<AttendeeCodeView | null> {
  if (!row) return null;
  const mine = await db.prepare('SELECT 1 FROM attendee_claims WHERE app = ? AND thing_id = ? AND user_id = ?').bind(row.app, row.thing_id, userId).first();
  return { xp: row.xp, claimed: Boolean(mine), state: runEntryState(startsAt, endsAt) };
}

/**
 * Claim an event's code. `guest` says whether the person is on this event's own list (the caller knows how its app
 * keeps one); `hostId` is never paid. The claim row, the xp, the pillar and the ledger are one batch, so a second
 * tap, or two at once, can only fail on the claim's key and pays nothing.
 */
export async function claimEventCode(
  db: D1Database,
  a: { app: EventApp; thingId: string; userId: string; hostId: string | null; guest: boolean; cancelled: boolean; startsAt: string; endsAt: string; code: unknown },
): Promise<{ xp: number; newBadges: string[] } | Failed> {
  const row = await codeOf(db, a.app, a.thingId);
  if (!row) return { error: 'This event has no attendee code.', status: 404 };
  if (a.cancelled) return { error: 'This event was cancelled.', status: 400 };
  if (a.userId === a.hostId) return { error: 'Hosts give the code; they do not claim it.', status: 403 };
  if (!a.guest) return { error: 'Only the guests on this event’s list can use its code.', status: 403 };
  const state = runEntryState(a.startsAt, a.endsAt);
  if (state === 'early') return { error: 'The code works from thirty minutes before the start. Come back then.', status: 400 };
  if (state === 'closed') return { error: 'The code closed three hours after the end.', status: 400 };
  if (normalizeCode(a.code) !== row.code) return { error: 'That is not the code for this event. The host shows it there.', status: 400 };
  if (await db.prepare('SELECT 1 FROM attendee_claims WHERE app = ? AND thing_id = ? AND user_id = ?').bind(a.app, a.thingId, a.userId).first()) return { error: 'You already claimed this one.', status: 409 };
  const day = await db.prepare('SELECT COUNT(*) AS n FROM attendee_claims WHERE user_id = ? AND created_at >= ?').bind(a.userId, new Date(Date.now() - 86_400_000).toISOString()).first<{ n: number }>();
  if ((day?.n ?? 0) >= ATTENDEE_CLAIMS_PER_DAY) return { error: `That is ${ATTENDEE_CLAIMS_PER_DAY} event codes in a day, the most there is. Try again tomorrow.`, status: 429 };
  const before = await badgesNow(db, a.userId);
  const now = nowIso();
  try {
    await db.batch([
      db.prepare('INSERT INTO attendee_claims (app, thing_id, user_id, xp, created_at) VALUES (?, ?, ?, ?, ?)').bind(a.app, a.thingId, a.userId, row.xp, now),
      db.prepare('UPDATE users SET xp = xp + ? WHERE id = ?').bind(row.xp, a.userId),
      db.prepare("UPDATE relationship_scores SET xp = xp + ? WHERE user_id = ? AND relationship = 'friendship'").bind(row.xp, a.userId),
      db.prepare("INSERT INTO xp_events (user_id, relationship, source, source_id, amount, created_at) VALUES (?, 'friendship', 'attendee', ?, ?, ?)").bind(a.userId, `${a.app}:${a.thingId}`, row.xp, now),
    ]);
  } catch {
    return { error: 'You already claimed this one.', status: 409 };
  }
  return { xp: row.xp, newBadges: diffBadges(before, await badgesNow(db, a.userId)) };
}
