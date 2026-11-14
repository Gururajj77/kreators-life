import type { Context } from 'hono';
import { eatDayScore, eatExtra, eatFromStored, eatHowWell, isMoveKind, MOVE_KIND_META, MOVE_METRES_MAX, parseEat, parseMove, parseProteinGoal, proteinFromStored, proteinGrams, typedMetres, type EatLog, type MoveInput, type MoveKind, type MoveLog } from '@kreators/shared/fitness';
import { localStamp } from '@kreators/shared';
import type { AppEnv } from './env';
import { DATE_RE, dateNearOwnDay, dayInZone, GONE_NOW, newId, nowIso, objectBody } from './db';

/**
 * Fitness's movement and eating logs, one set of helpers for its own routes (/fitness) and Kreators Run's tool (/run/move): one action,
 * two callers. Both are rows of `wellbeing_logs`, so the export and the account delete already cover them, and an erase of progress
 * keeps them like every tracker. Nothing here pays.
 */

export interface LogRow {
  id: string;
  kind: string;
  date: string;
  value: number;
  extra: string;
  note: string;
  created_at: string;
}
export const LOG_COLS = 'id, kind, date, value, extra, note, created_at';

function extraOf(s: string): Record<string, unknown> {
  try {
    const v = JSON.parse(s || '{}') as unknown;
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
const int = (v: unknown, lo: number, hi: number): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi ? v : null);

/** A movement row as the screens read it. A run logged with a start code (`source: 'run'`, written by Kreators Run) is a club run. */
export function toMove(r: LogRow): MoveLog {
  const x = extraOf(r.extra);
  const club = x.source === 'run';
  const kind: MoveKind = isMoveKind(x.kind) ? x.kind : club ? 'run' : 'other';
  const metres = MOVE_KIND_META[kind].distance ? int(x.metres, 1, MOVE_METRES_MAX) : null;
  return { id: r.id, date: r.date, kind, minutes: r.value, metres, effort: int(x.effort, 1, 5), note: r.note, source: club ? 'club' : 'self', createdAt: r.created_at };
}

/** A stored eating check-in as the screens read it, through the one kind reader in shared (an older one too). */
export function toEat(r: LogRow): EatLog {
  const e = eatFromStored(r.value, r.extra, r.note);
  return { id: r.id, date: r.date, ...e.input, dayScore: e.dayScore, howWell: e.howWell, proteinG: e.input.protein ? proteinGrams(e.input.protein) : null, legacy: e.legacy, createdAt: r.created_at };
}

/** What a movement log keeps beside its minutes. Nothing the person did not send, and never a `source`: only Kreators Run's own entry writes that. */
export const moveExtra = (m: MoveInput): string => JSON.stringify({ kind: m.kind, ...(m.metres ? { metres: m.metres } : {}), ...(m.effort ? { effort: m.effort } : {}) });

/** The day a log is for: the device's day as sent (a real calendar day, else refused), the person's own today when none is sent, and only their today or yesterday, in their zone (`dateNearOwnDay`), so Yesterday holds in New York's evening too. */
export function logDay(raw: unknown, zone: string | null | undefined): string | { error: string } {
  if (raw !== undefined && raw !== null && raw !== '' && !(typeof raw === 'string' && DATE_RE.test(raw))) return { error: 'send date as a real day, YYYY-MM-DD' };
  const date = typeof raw === 'string' && raw ? raw : dayInZone(zone);
  return dateNearOwnDay(date, zone) ? date : { error: 'You can log today or yesterday.' };
}

/**
 * Whether a supplement was on the person's list on a day, the one reading for Fitness's "Taken on N of M days" and the review's count: from the day it was added in
 * their zone, not while it is paused, and not in any stretch it was paused and came back from (`pauses_json`, from day to the day it came back).
 */
export function supplementOnList(s: { created_at: string; paused_at: string | null; pauses_json?: string | null }, zone: string): (day: string) => boolean {
  const since = localStamp(s.created_at, zone)?.day ?? s.created_at.slice(0, 10);
  const paused = s.paused_at ? (localStamp(s.paused_at, zone)?.day ?? s.paused_at.slice(0, 10)) : null;
  let stretches: [string, string][] = [];
  try {
    const v = JSON.parse(s.pauses_json || '[]') as unknown;
    if (Array.isArray(v)) stretches = v.filter((x): x is [string, string] => Array.isArray(x) && typeof x[0] === 'string' && typeof x[1] === 'string');
  } catch {
    stretches = [];
  }
  return (day) => day >= since && (!paused || day < paused) && !stretches.some(([from, to]) => day >= from && day < to);
}

async function readMove(db: D1Database, userId: string, id: string): Promise<LogRow | null> {
  return db.prepare(`SELECT ${LOG_COLS} FROM wellbeing_logs WHERE id = ? AND user_id = ? AND kind = 'move'`).bind(id, userId).first<LogRow>();
}

/** POST: log movement for today or yesterday. `kinds` narrows what this caller offers (Kreators Run's tool: a run or a walk). */
export async function logMoveFrom(c: Context<AppEnv>, kinds?: readonly MoveKind[]): Promise<Response> {
  const db = c.env.DB;
  const userId = c.get('user').id;
  const body = await objectBody(c);
  const day = logDay(body.date, c.get('user').timezone);
  if (typeof day !== 'string') return c.json(day, 400);
  const m = parseMove(body);
  if (typeof m === 'string') return c.json({ error: m }, 400);
  if (kinds && !kinds.includes(m.kind)) return c.json({ error: `here you can log ${kinds.join(' or ')}` }, 400);
  const id = newId();
  const now = nowIso();
  await db.prepare("INSERT INTO wellbeing_logs (id, user_id, kind, date, value, extra, note, created_at) VALUES (?, ?, 'move', ?, ?, ?, ?, ?)").bind(id, userId, day, m.minutes, moveExtra(m), m.note, now).run();
  return c.json({ move: toMove({ id, kind: 'move', date: day, value: m.minutes, extra: moveExtra(m), note: m.note, created_at: now }) }, 201);
}

/** DELETE: remove one of your own movement logs. With `kinds`, only one logged on your own of those kinds (Kreators Run's tool never removes a club run). */
export async function removeMoveFrom(c: Context<AppEnv>, kinds?: readonly MoveKind[]): Promise<Response> {
  const db = c.env.DB;
  const userId = c.get('user').id;
  const row = await readMove(db, userId, c.req.param('id') ?? '');
  if (!row) return c.json({ error: 'not found' }, 404);
  if (kinds) {
    const m = toMove(row);
    if (m.source !== 'self' || !kinds.includes(m.kind)) return c.json({ error: 'not found' }, 404);
  }
  const res = await db.prepare("DELETE FROM wellbeing_logs WHERE id = ? AND user_id = ? AND kind = 'move'").bind(row.id, userId).run();
  // Another tab, or a second send, took it between the read above and here: said, never a quiet yes, so All tables counts it once.
  if (!res.meta.changes) return c.json({ error: GONE_NOW }, 409);
  return c.json({ ok: true });
}

/** PATCH: change a movement log you made yourself, today's or yesterday's. Its day stays. A club run is changed nowhere. */
export async function editMoveFrom(c: Context<AppEnv>): Promise<Response> {
  const db = c.env.DB;
  const userId = c.get('user').id;
  const row = await readMove(db, userId, c.req.param('id') ?? '');
  if (!row) return c.json({ error: 'not found' }, 404);
  const old = toMove(row);
  if (old.source === 'club') return c.json({ error: 'This came from a club run with a start code. You can remove it here, not change it.' }, 400);
  if (!dateNearOwnDay(old.date, c.get('user').timezone)) return c.json({ error: 'Only today’s and yesterday’s can change. You can still remove it.' }, 400);
  const body = await objectBody(c);
  // The distance typed in km (All tables' one cell, 2026-11-14), read as the movement form reads it (`typedMetres`); empty takes it off.
  if (body.km !== undefined) {
    const metres = body.km === null ? null : typeof body.km === 'string' ? typedMetres(body.km) : 'bad';
    if (metres === 'bad') return c.json({ error: 'Type the distance in km, like 5.2.' }, 400);
    body.metres = metres;
  }
  const m = parseMove(body, { kind: old.kind, minutes: old.minutes, metres: old.metres, effort: old.effort, note: old.note });
  if (typeof m === 'string') return c.json({ error: m }, 400);
  if (body.km !== undefined && body.km !== null && body.km !== '' && m.metres === null) return c.json({ error: `${MOVE_KIND_META[m.kind].name} has no distance here.` }, 400);
  await db.prepare("UPDATE wellbeing_logs SET value = ?, extra = ?, note = ? WHERE id = ? AND user_id = ? AND kind = 'move'").bind(m.minutes, moveExtra(m), m.note, row.id, userId).run();
  return c.json({ move: toMove({ ...row, value: m.minutes, extra: moveExtra(m), note: m.note }) });
}

/**
 * PUT: the day's eating check-in, one a day, for today or yesterday: saving again replaces it. The old row goes and the new one comes in one
 * batch, and a unique index on the day (migration 0103) holds the rule even for two saves at once. A body with no `protein` at all (the assistant, a tab
 * of the older app) keeps the day's protein; the form always sends it, null when it was taken off.
 */
export async function saveEatFrom(c: Context<AppEnv>): Promise<Response> {
  const db = c.env.DB;
  const userId = c.get('user').id;
  const body = await objectBody(c);
  const day = logDay(body.date, c.get('user').timezone);
  if (typeof day !== 'string') return c.json(day, 400);
  const e = parseEat(body);
  if (typeof e === 'string') return c.json({ error: e }, 400);
  if (body.protein === undefined) {
    const was = await db.prepare("SELECT extra FROM wellbeing_logs WHERE user_id = ? AND kind = 'eat' AND date = ?").bind(userId, day).first<{ extra: string }>();
    e.protein = proteinFromStored(extraOf(was?.extra ?? '').protein);
  }
  const id = newId();
  const now = nowIso();
  const extra = eatExtra(e);
  // The value is the day's 1 to 5 by the one map in shared (0 on a fasting day), so Reviews, Emerging and a coach read it as before.
  const value = eatHowWell(eatDayScore(e));
  // The form says which row it read (`ifId`, null for none): a day's protein adds up over hours, so a tab left open must not write over what another tab or the phone saved since.
  // Guarded inside the batch, so two saves at once never both pass. The assistant and an older tab send no `ifId` and replace the day, as they always did.
  if (body.ifId === null || typeof body.ifId === 'string') {
    const res = await db.batch([
      db.prepare("DELETE FROM wellbeing_logs WHERE user_id = ? AND kind = 'eat' AND date = ? AND id = ?").bind(userId, day, body.ifId ?? ''),
      db.prepare("INSERT INTO wellbeing_logs (id, user_id, kind, date, value, extra, note, created_at) SELECT ?, ?, 'eat', ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM wellbeing_logs WHERE user_id = ? AND kind = 'eat' AND date = ?)").bind(id, userId, day, value, extra, e.note, now, userId, day),
    ]);
    if (res[1]?.meta.changes === 0) return c.json({ error: 'changed' }, 409);
  } else {
    await db.batch([
      db.prepare("DELETE FROM wellbeing_logs WHERE user_id = ? AND kind = 'eat' AND date = ?").bind(userId, day),
      db.prepare("INSERT OR REPLACE INTO wellbeing_logs (id, user_id, kind, date, value, extra, note, created_at) VALUES (?, ?, 'eat', ?, ?, ?, ?, ?)").bind(id, userId, day, value, extra, e.note, now),
    ]);
  }
  return c.json({ eat: toEat({ id, kind: 'eat', date: day, value, extra, note: e.note, created_at: now }) });
}

/**
 * PUT: the daily protein goal, whole grams, or null to take it off. Only the goal comes here: the weight it may have been worked out from stays in the browser's form.
 * An upsert of the one column, so the supplement switches on the same row never move.
 */
export async function saveProteinGoal(c: Context<AppEnv>): Promise<Response> {
  const body = await objectBody(c);
  // Only a body that says the goal changes it: an empty or odd one is refused, never read as "take it off".
  if (body.goal === undefined) return c.json({ error: 'send goal, or null to take it off' }, 400);
  const goal = parseProteinGoal(body.goal);
  if (typeof goal === 'string') return c.json({ error: goal }, 400);
  await c.env.DB.prepare('INSERT INTO fitness_prefs (user_id, protein_goal_g, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET protein_goal_g = excluded.protein_goal_g, updated_at = excluded.updated_at').bind(c.get('user').id, goal, nowIso()).run();
  return c.json({ goal });
}
