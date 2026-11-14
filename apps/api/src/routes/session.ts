import { Hono } from 'hono';
import {
  affirmationFor,
  BREATHING,
  CONTRACT_MIN_DAYS_DEFAULT,
  DEFAULT_REAL_DAY,
  DRIVES,
  isRelationshipKey,
  levelByValue,
  MANTRAS,
  MAX_FEARS,
  MAX_INSECURITIES,
  OWN_MANTRA_MAX,
  AWAY_LEVEL,
  awayPlacement,
  parseAway,
  parseRoutineBlocks,
  repairRoutineBlocks,
  routineTimesProblem,
  PENALTIES,
  pickFocus,
  placementFlags,
  RELATIONSHIPS,
  routineFor,
  SCORECARD,
  settleScore,
  type Assessment,
  type Contract,
  type Fear,
  type Insecurity,
  type Placement,
  type Practices,
  type RealDay,
  type RelationshipKey,
  type Routine,
  type BlockKey,
  type RoutineBlock,
  type RoutineDay,
  type Scores,
  type SessionResponse,
} from '@kreators/shared';
import type { AppEnv } from '../env';
import { BEFORE_JOINED, beforeStart, DATE_RE, newId, nowIso, num, oneOf, personDay, shiftDate, startDay, str } from '../db';
import { localDay } from '../coaching';
import { askForCall, callPaymentsLive, openCall, withdrawCall } from '../liveCall';

/** The strategy session: the assessment, the plan it produces, and the morning routine day by day. */
export const session = new Hono<AppEnv>();

interface ARow { id: string; kind: Assessment['kind']; fears_json: string; insecurities_json: string; scores_json: string; real_day_json: string; focus_json: string; away_json?: string; created_at: string }
interface PRow { relationship: RelationshipKey; core_level: number; floor_level: number; evidence: string }
interface RRow { id: string; assessment_id: string; ramp_step: number; general_json: string; exceptional_json: string; practices_json: string; created_at: string }
interface CRow { min_days: number; checkin_time: string; penalty: Contract['penalty']; next_weekly: string; next_monthly: string; signed_name: string; signed_at: string }
interface DRow { day: string; day_type: RoutineDay['dayType']; steps_json: string; blocks_json: string; done: number }
const json = <T,>(s: string, fb: T): T => {
  try {
    return JSON.parse(s) as T;
  } catch {
    return fb;
  }
};
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const time = (v: unknown, fb: string) => (typeof v === 'string' && TIME_RE.test(v) ? v : fb);

/** A saved routine's two days as they were read, and as they should read once put right. */
interface RoutineFix { id: string; generalJson: string; exceptionalJson: string; general: RoutineBlock[]; exceptional: RoutineBlock[] }
/**
 * A saved routine as it should read: a Food and water, People or Learning block that runs backwards on the person's day (a
 * routine made before 2026-11-14 when work ended after nine, or the person woke up in the evening) is put right by
 * repairRoutineBlocks, and nothing else moves. `fix` is set only when something did.
 */
function routineRead(r: RRow): { general: RoutineBlock[]; exceptional: RoutineBlock[]; fix: RoutineFix | null } {
  const savedGeneral = json<RoutineBlock[]>(r.general_json, []);
  const savedExceptional = json<RoutineBlock[]>(r.exceptional_json, []);
  const general = repairRoutineBlocks(savedGeneral, 'general');
  const exceptional = repairRoutineBlocks(savedExceptional, 'exceptional');
  const fix = general !== savedGeneral || exceptional !== savedExceptional ? { id: r.id, generalJson: r.general_json, exceptionalJson: r.exceptional_json, general, exceptional } : null;
  return { general, exceptional, fix };
}
/**
 * Keeps a repair once, guarded on the exact words it read, so a newer edit from another tab is never written over. One round
 * trip, and only for a routine that needed one; a failed write leaves the answer as it is, put right again next time.
 */
async function keepRoutineFix(db: D1Database, userId: string, fix: RoutineFix): Promise<void> {
  try {
    await db
      .prepare('UPDATE routines SET general_json = ?, exceptional_json = ? WHERE id = ? AND user_id = ? AND general_json = ? AND exceptional_json = ?')
      .bind(JSON.stringify(fix.general), JSON.stringify(fix.exceptional), fix.id, userId, fix.generalJson, fix.exceptionalJson)
      .run();
  } catch {
    // Read again next time; the answer already carries the repaired times.
  }
}

/** Everything the session holds for one person on a date. Also read for a student by their life coach, who gets only the parts that student shares. */
export async function latest(db: D1Database, userId: string, date: string): Promise<SessionResponse> {
  return (await latestRead(db, userId, date)).res;
}

/** latest, with the routine's repair to keep when it needed one (GET /session keeps it; a coach's read never writes). */
async function latestRead(db: D1Database, userId: string, date: string): Promise<{ res: SessionResponse; fix: RoutineFix | null }> {
  // Independent reads go out together, so the assistant's get_routine and the screens cost one trip here, not four.
  const [a, r, c, days] = await Promise.all([
    db.prepare("SELECT * FROM assessments WHERE user_id = ? AND kind = 'onboard' ORDER BY created_at DESC LIMIT 1").bind(userId).first<ARow>(),
    db.prepare('SELECT * FROM routines WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').bind(userId).first<RRow>(),
    db.prepare('SELECT * FROM contracts WHERE user_id = ? ORDER BY signed_at DESC LIMIT 1').bind(userId).first<CRow>(),
    db.prepare('SELECT day, day_type, steps_json, blocks_json, done FROM routine_days WHERE user_id = ? AND day > ? AND day <= ?').bind(userId, shiftDate(date, -7), date).all<DRow>(),
  ]);
  let assessment: Assessment | null = null;
  if (a) {
    const ps = await db.prepare('SELECT relationship, core_level, floor_level, evidence FROM placements WHERE assessment_id = ?').bind(a.id).all<PRow>();
    assessment = {
      id: a.id,
      kind: a.kind,
      placements: ps.results.map((p) => {
        const base: Placement = { relationship: p.relationship, core: p.core_level, floor: p.floor_level, evidence: p.evidence };
        return { ...base, ...placementFlags(base) };
      }),
      fears: json<Fear[]>(a.fears_json, []),
      insecurities: json<Insecurity[]>(a.insecurities_json, []),
      scores: json<Scores>(a.scores_json, {}),
      realDay: json<RealDay>(a.real_day_json, DEFAULT_REAL_DAY),
      focus: json<RelationshipKey[]>(a.focus_json, []),
      away: parseAway(json<unknown>(a.away_json ?? '[]', [])),
      createdAt: a.created_at,
    };
  }
  const byDay = new Map(days.results.map((d) => [d.day, d]));
  const today = byDay.get(date);
  const week = Array.from({ length: 7 }, (_, i) => shiftDate(date, i - 6)).map((d) => (byDay.has(d) ? byDay.get(d)!.done === 1 : null));
  const blocks = r ? routineRead(r) : null;
  const res: SessionResponse = {
    assessment,
    routine: r && blocks ? { id: r.id, rampStep: r.ramp_step, general: blocks.general, exceptional: blocks.exceptional, practices: json<Practices>(r.practices_json, { mantra: 'none', breathing: 'box', affirmation: '', reading: '' }), createdAt: r.created_at } : null,
    contract: c ? { minDays: c.min_days, checkinTime: c.checkin_time, penalty: c.penalty, nextWeekly: c.next_weekly, nextMonthly: c.next_monthly, signedName: c.signed_name, signedAt: c.signed_at } : null,
    today: today ? { day: today.day, dayType: today.day_type, steps: json<string[]>(today.steps_json, []), blocks: json<BlockKey[]>(today.blocks_json, []), done: today.done === 1 } : null,
    week: { done: week.filter((d) => d === true).length, days: week },
  };
  return { res, fix: blocks?.fix ?? null };
}

/**
 * The person's day: the one the device sent when it is a real day no further ahead than tomorrow in their zone, else today in
 * their own zone, never the server's UTC date (which is a day behind for the first hours of an Indian morning).
 */
const dateOf = (v: string | undefined, zone: string) => {
  const own = localDay(zone);
  return v && DATE_RE.test(v) && v <= shiftDate(own, 1) ? v : own;
};

/**
 * Why a routine day cannot be ticked or changed, or null (2026-11-14, the founder: routine days may change on ANY PAST DAY, never a day still to
 * come; Daily still ticks only today, the change is for All tables). The day must be a real calendar day, today or any day before it. The
 * person's today is their device's (`today`, else the day sent itself, as Daily and the assistant send only their own today), within a day of
 * their zone's, as everywhere (`personDay`); so a device a zone ahead still ticks its own today, and a day two or more ahead is refused out loud.
 */
function routineDayProblem(date: unknown, today: unknown, zone: string, joined?: string): string | null {
  if (typeof date !== 'string' || !DATE_RE.test(date)) return 'Pick a real day, like 2026-11-02.';
  const own = personDay(typeof today === 'string' ? today : date, zone);
  if (date > own) return 'A day still to come cannot be ticked yet.';
  // A tick or a change is never for a day before the account began (the review of 2026-11-14); clearing one passes no `joined`.
  return joined && beforeStart(date, joined, own) ? BEFORE_JOINED : null;
}

session.get('/', async (c) => {
  const user = c.get('user');
  const { res, fix } = await latestRead(c.env.DB, user.id, dateOf(c.req.query('date'), user.timezone));
  // A routine that needed putting right is kept once, so Daily, the life map, the assistant and the Companion all read it.
  if (fix) await keepRoutineFix(c.env.DB, user.id, fix);
  return c.json(res);
});

/**
 * The live call with a coach, a paid service (liveCall.ts). GET is the person's open ask, if any. POST is the yes from the
 * contract card: it keeps the ask (one open per person), tells the admins once, and carries a provider order to pay with
 * only while payments are live; otherwise it says plainly that nothing was charged. Owner only; never part of what a
 * coach reads through `latest`.
 */
session.get('/call', async (c) => c.json({ request: await openCall(c.env.DB, c.get('user').id), live: callPaymentsLive(c.env) }));
session.post('/call', async (c) => {
  try {
    return c.json(await askForCall(c.env.DB, c.env, c.get('user')), 201);
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : 'The ask for a live call did not go through. Nothing was charged; try again.' }, 502);
  }
});
/**
 * Withdraw an ask that is still only an ask (2026-11-14, All tables, the owner's own): guarded on `asked`, so two taps withdraw it once and the
 * team is told once. One with a payment window open, paid, booked or done stays for the books (409 in words). Limit `checkout`.
 */
session.post('/call/:id/withdraw', async (c) => {
  const got = await withdrawCall(c.env.DB, c.get('user'), c.req.param('id'));
  if (got === 'gone') return c.json({ error: 'not found' }, 404);
  if (got === 'already') return c.json({ error: 'It is cancelled already.' }, 409);
  if (got === 'moved') return c.json({ error: 'It is being paid for, paid or booked, so it stays. Write to the team about it.' }, 409);
  return c.json({ ok: true });
});

/** The assessment: seven placements, fears, insecurities, the scorecard, the real day. The rules run here, not in the browser. */
session.post('/assessment', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const kind = oneOf(body.kind, ['onboard', 'monthly', 'quarterly', 'biannual'] as const, 'onboard');
  const placements: Placement[] = [];
  for (const raw of Array.isArray(body.placements) ? body.placements : []) {
    const p = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    if (!isRelationshipKey(p.relationship)) continue;
    const core = num(p.core, null, 20, 540);
    const floor = num(p.floor, null, 20, 540);
    if (core === null || floor === null || !levelByValue(core) || !levelByValue(floor)) continue;
    placements.push({ relationship: p.relationship, core, floor, evidence: str(p.evidence, 500) });
  }
  // "Not part of my life right now": love, teachers or faith, placed at Neutrality whatever was sent, and never suggested.
  const away = parseAway(body.away);
  for (const k of away) {
    const at = placements.findIndex((p) => p.relationship === k);
    if (at >= 0) placements[at] = awayPlacement(k);
    else placements.push(awayPlacement(k));
  }
  const seen = new Set(placements.map((p) => p.relationship));
  if (seen.size !== RELATIONSHIPS.length) return c.json({ error: 'place every one of the seven relationships' }, 400);
  const fears: Fear[] = (Array.isArray(body.fears) ? body.fears : [])
    .map((f) => (f && typeof f === 'object' ? (f as Record<string, unknown>) : {}))
    .filter((f) => isRelationshipKey(f.relationship) && str(f.text, 120))
    .map((f) => ({ text: str(f.text, 120), relationship: f.relationship as RelationshipKey, drives: oneOf(f.drives, DRIVES, 'sometimes') }))
    .slice(0, MAX_FEARS);
  const insecurities: Insecurity[] = (Array.isArray(body.insecurities) ? body.insecurities : [])
    .map((i) => (i && typeof i === 'object' ? (i as Record<string, unknown>) : {}))
    .filter((i) => isRelationshipKey(i.relationship) && str(i.text, 120))
    .map((i) => ({ text: str(i.text, 120), weight: num(i.weight, 5, 0, 10) ?? 5, relationship: i.relationship as RelationshipKey }))
    .slice(0, MAX_INSECURITIES);
  // Scores: every slider is 0 to 10; a high relationship score over a low floor is settled by the behaviour answer.
  const rawScores = (body.scores && typeof body.scores === 'object' ? body.scores : {}) as Record<string, unknown>;
  const behaviour = (body.behaviour && typeof body.behaviour === 'object' ? body.behaviour : {}) as Record<string, unknown>;
  const scores: Scores = {};
  const flagged = new Map(placements.map((p) => [p.relationship, placementFlags(p)]));
  for (const k of [...SCORECARD.health, ...SCORECARD.wealth, ...RELATIONSHIPS.map((r) => r.key)]) {
    const v = num(rawScores[k], null, 0, 10);
    if (v === null) continue;
    const floor = flagged.get(k as RelationshipKey)?.floor;
    scores[k] = floor === undefined ? v : settleScore(v, floor, num(behaviour[k], null, 0, 7));
  }
  const rd = (body.realDay && typeof body.realDay === 'object' ? body.realDay : {}) as Record<string, unknown>;
  const realDay: RealDay = { wake: time(rd.wake, DEFAULT_REAL_DAY.wake), sleep: time(rd.sleep, DEFAULT_REAL_DAY.sleep), workStart: time(rd.workStart, DEFAULT_REAL_DAY.workStart), workEnd: time(rd.workEnd, DEFAULT_REAL_DAY.workEnd), evening: str(rd.evening, 200), gym: time(rd.gym, '') };
  const focus = pickFocus(placements, insecurities, away);
  const id = newId();
  const now = nowIso();
  await db.batch([
    db.prepare('INSERT INTO assessments (id, user_id, kind, fears_json, insecurities_json, scores_json, real_day_json, focus_json, away_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, user.id, kind, JSON.stringify(fears), JSON.stringify(insecurities), JSON.stringify(scores), JSON.stringify(realDay), JSON.stringify(focus), JSON.stringify(away), now),
    ...placements.map((p) => db.prepare('INSERT INTO placements (id, assessment_id, user_id, relationship, core_level, floor_level, core_band, floor_band, evidence, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(newId(), id, user.id, p.relationship, p.core, p.floor, levelByValue(p.core)!.band, levelByValue(p.floor)!.band, p.evidence, now)),
  ]);
  const res = await latest(db, user.id, dateOf(undefined, user.timezone));
  return c.json({ ...res, suggestedFocus: focus }, 201);
});

/**
 * Set one optional pillar aside, or bring it back, on the latest map (from the life map under Pillars). Set aside, it sits at
 * Neutrality and leaves the focus; brought back, it keeps Neutrality until the person places it again.
 */
session.put('/away', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const k = parseAway([body.relationship])[0];
  if (!k) return c.json({ error: 'only love, teachers or faith can be set aside' }, 400);
  const a = await db.prepare("SELECT * FROM assessments WHERE user_id = ? AND kind = 'onboard' ORDER BY created_at DESC LIMIT 1").bind(user.id).first<ARow>();
  if (!a) return c.json({ error: 'do the assessment first' }, 400);
  const was = parseAway(json<unknown>(a.away_json ?? '[]', []));
  const on = body.away === true;
  const away = parseAway(on ? [...was, k] : was.filter((x) => x !== k));
  const focus = json<RelationshipKey[]>(a.focus_json, []).filter((x) => !on || x !== k);
  await db.batch([
    db.prepare('UPDATE assessments SET away_json = ?, focus_json = ? WHERE id = ? AND user_id = ?').bind(JSON.stringify(away), JSON.stringify(focus), a.id, user.id),
    ...(on ? [db.prepare("UPDATE placements SET core_level = ?, floor_level = ?, core_band = ?, floor_band = ?, evidence = '' WHERE assessment_id = ? AND user_id = ? AND relationship = ?").bind(AWAY_LEVEL, AWAY_LEVEL, levelByValue(AWAY_LEVEL)!.band, levelByValue(AWAY_LEVEL)!.band, a.id, user.id, k)] : []),
  ]);
  return c.json(await latest(db, user.id, dateOf(typeof body.date === 'string' ? body.date : undefined, user.timezone)));
});

/** The plan: the focus the person settled on, the routine ramped from their day, the practices, and the signed contract. */
session.post('/plan', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const a = await db.prepare("SELECT * FROM assessments WHERE user_id = ? AND kind = 'onboard' ORDER BY created_at DESC LIMIT 1").bind(user.id).first<ARow>();
  if (!a) return c.json({ error: 'do the assessment first' }, 400);
  const ps = await db.prepare('SELECT relationship, core_level, floor_level, evidence FROM placements WHERE assessment_id = ?').bind(a.id).all<PRow>();
  const placements: Placement[] = ps.results.map((p) => ({ relationship: p.relationship, core: p.core_level, floor: p.floor_level, evidence: p.evidence }));
  // The focus is the person's pick, two at most. A floor under Courage is only where the session suggests starting.
  const focus = [...new Set((Array.isArray(body.focus) ? body.focus : []).filter(isRelationshipKey))].slice(0, 2);
  if (focus.length === 0) return c.json({ error: 'pick at least one pillar to focus on' }, 400);
  const realDay = json<RealDay>(a.real_day_json, DEFAULT_REAL_DAY);
  const routine: Routine = routineFor(realDay, 0, focus, placements);
  const pr = (body.practices && typeof body.practices === 'object' ? body.practices : {}) as Record<string, unknown>;
  const mantra = oneOf(pr.mantra, MANTRAS.map((m) => m.key) as unknown as readonly Practices['mantra'][], 'none');
  const ownMantra = str(pr.ownMantra, OWN_MANTRA_MAX);
  const practices: Practices = {
    // A mantra of your own needs its words; without them it is no mantra yet.
    mantra: mantra === 'own' && !ownMantra ? 'none' : mantra,
    ...(mantra === 'own' && ownMantra ? { ownMantra } : {}),
    breathing: oneOf(pr.breathing, BREATHING.map((b) => b.key) as unknown as readonly Practices['breathing'][], 'box'),
    affirmation: str(pr.affirmation, 240) || affirmationFor(focus),
    reading: str(pr.reading, 120),
  };
  const ct = (body.contract && typeof body.contract === 'object' ? body.contract : {}) as Record<string, unknown>;
  const signedName = str(ct.signedName, 80);
  if (!signedName) return c.json({ error: 'type your name to sign' }, 400);
  const today = dateOf(typeof body.date === 'string' ? body.date : undefined, user.timezone);
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay();
  const nextWeekly = shiftDate(today, dow === 0 ? 7 : 7 - dow);
  const nextMonthly = shiftDate(today, 30);
  const checkinTime = time(ct.checkinTime, '21:00');
  const now = nowIso();
  await db.batch([
    db.prepare('UPDATE assessments SET focus_json = ? WHERE id = ?').bind(JSON.stringify(focus), a.id),
    db.prepare('INSERT INTO routines (id, user_id, assessment_id, ramp_step, general_json, exceptional_json, practices_json, created_at) VALUES (?, ?, ?, 0, ?, ?, ?, ?)').bind(newId(), user.id, a.id, JSON.stringify(routine.general), JSON.stringify(routine.exceptional), JSON.stringify(practices), now),
    db.prepare('INSERT INTO contracts (id, user_id, assessment_id, min_days, checkin_time, penalty, next_weekly, next_monthly, signed_name, signed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(newId(), user.id, a.id, num(ct.minDays, CONTRACT_MIN_DAYS_DEFAULT, 1, 7) ?? CONTRACT_MIN_DAYS_DEFAULT, checkinTime, oneOf(ct.penalty, PENALTIES.map((p) => p.key) as unknown as readonly Contract['penalty'][], 'streak'), nextWeekly, nextMonthly, signedName, now),
    // The contract's check-in time is the daily reminder: one time, one place.
    db.prepare('UPDATE users SET reminder_time = ? WHERE id = ?').bind(checkinTime, user.id),
  ]);
  return c.json(await latest(db, user.id, today), 201);
});

/** A day of the routine: which morning steps were done. Done only when every step of that day type is ticked. */
/** Edit the routine: each block's times, the morning steps and their minutes, and a note per block, through parseRoutineBlocks. */
session.patch('/routine', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const r = await db.prepare('SELECT * FROM routines WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').bind(user.id).first<RRow>();
  if (!r) return c.json({ error: 'no routine yet; run the strategy session first' }, 400);
  // The saved routine is put right first, so a save never writes a block that runs backwards back.
  const { general, exceptional } = routineRead(r);
  const next = {
    general: body.general === undefined ? general : parseRoutineBlocks(body.general, general),
    exceptional: body.exceptional === undefined ? exceptional : parseRoutineBlocks(body.exceptional, exceptional),
  };
  // An edit that makes Food and water, People or Learning end before it starts is refused in words, and nothing is saved.
  const problem = (body.general !== undefined && routineTimesProblem(next.general)) || (body.exceptional !== undefined && routineTimesProblem(next.exceptional)) || null;
  if (problem) return c.json({ error: problem }, 400);
  await db.prepare('UPDATE routines SET general_json = ?, exceptional_json = ? WHERE id = ? AND user_id = ?').bind(JSON.stringify(next.general), JSON.stringify(next.exceptional), r.id, user.id).run();
  return c.json(await latest(db, user.id, dateOf(typeof body.date === 'string' ? body.date : undefined, user.timezone)));
});

session.post('/day', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  // Any past day, never one still to come (routineDayProblem); a body with no day ticks the person's own today.
  if (body.date !== undefined) {
    const problem = routineDayProblem(body.date, body.today, user.timezone, startDay(user.created_at, user.timezone));
    if (problem) return c.json({ error: problem }, 400);
  }
  const day = typeof body.date === 'string' ? body.date : localDay(user.timezone);
  const dayType = oneOf(body.dayType, ['general', 'exceptional'] as const, 'general');
  const r = await db.prepare('SELECT * FROM routines WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').bind(user.id).first<RRow>();
  if (!r) return c.json({ error: 'no routine yet; run the strategy session first' }, 400);
  const blocks = json<RoutineBlock[]>(dayType === 'general' ? r.general_json : r.exceptional_json, []);
  const morning = blocks.find((b) => b.key === 'morning')?.steps ?? [];
  const steps = (Array.isArray(body.steps) ? body.steps : []).filter((s): s is string => typeof s === 'string' && morning.includes(s));
  const done = morning.length > 0 && morning.every((s) => steps.includes(s)) ? 1 : 0;
  // The other blocks ticked that day: only keys this day type has, never the morning. A body with no `blocks` (the assistant's
  // tick_routine, an older tab) leaves the day's block ticks as they are.
  const others = new Set(blocks.filter((b) => b.key !== 'morning').map((b) => b.key));
  const sentBlocks = Array.isArray(body.blocks) ? [...new Set(body.blocks.filter((k): k is BlockKey => typeof k === 'string' && others.has(k as BlockKey)))] : null;
  await db
    .prepare(
      `INSERT INTO routine_days (user_id, day, day_type, steps_json, blocks_json, done, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, day) DO UPDATE SET day_type = excluded.day_type, steps_json = excluded.steps_json, done = excluded.done, updated_at = excluded.updated_at${sentBlocks ? ', blocks_json = excluded.blocks_json' : ''}`,
    )
    .bind(user.id, day, dayType, JSON.stringify(steps), JSON.stringify(sentBlocks ?? []), done, nowIso())
    .run();
  return c.json(await latest(db, user.id, day));
});

/**
 * Change one routine day that was ticked (2026-11-14, All tables, the owner's own; any past day, never one still to come). What a cell can hold:
 * `done` (the morning: every step of that day's kind ticked, or none, the other blocks as they were) and `dayType` (counted as a normal or an
 * exceptional day; the ticks kept are those the new kind has, as the routine reads now). Owner only, in the statement; guarded on the row as it
 * was read, so two tabs change it once (409 for the second). It pays nothing, as ticking never did. Limit `prefs`.
 */
session.patch('/day/:date', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const date = c.req.param('date');
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const problem = routineDayProblem(date, body.today, user.timezone, startDay(user.created_at, user.timezone));
  if (problem) return c.json({ error: problem }, 400);
  if (body.done !== undefined && typeof body.done !== 'boolean') return c.json({ error: 'Pick yes or no.' }, 400);
  if (body.dayType !== undefined && body.dayType !== 'general' && body.dayType !== 'exceptional') return c.json({ error: 'Pick a normal day or an exceptional day.' }, 400);
  if (body.done === undefined && body.dayType === undefined) return c.json({ error: 'Send whether the morning was done, or the kind of day.' }, 400);
  const [row, r] = await Promise.all([
    db.prepare('SELECT day, day_type, steps_json, blocks_json, done, updated_at FROM routine_days WHERE user_id = ? AND day = ?').bind(user.id, date).first<DRow & { updated_at: string }>(),
    db.prepare('SELECT * FROM routines WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').bind(user.id).first<RRow>(),
  ]);
  if (!row) return c.json({ error: 'not found' }, 404);
  if (!r) return c.json({ error: 'no routine yet; run the strategy session first' }, 400);
  const dayType = (body.dayType as RoutineDay['dayType'] | undefined) ?? row.day_type;
  const blocks = json<RoutineBlock[]>(dayType === 'general' ? r.general_json : r.exceptional_json, []);
  const morning = blocks.find((b) => b.key === 'morning')?.steps ?? [];
  if (body.done === true && morning.length === 0) return c.json({ error: 'That kind of day has no morning steps to tick.' }, 400);
  const others = new Set(blocks.filter((b) => b.key !== 'morning').map((b) => b.key));
  const kept = json<unknown[]>(row.steps_json, []).filter((s): s is string => typeof s === 'string' && morning.includes(s));
  const steps = body.done === true ? [...morning] : body.done === false ? [] : kept;
  const ticked = json<unknown[]>(row.blocks_json, []).filter((k): k is BlockKey => typeof k === 'string' && others.has(k as BlockKey));
  const done = morning.length > 0 && morning.every((s) => steps.includes(s)) ? 1 : 0;
  const res = await db
    .prepare('UPDATE routine_days SET day_type = ?, steps_json = ?, blocks_json = ?, done = ?, updated_at = ? WHERE user_id = ? AND day = ? AND updated_at = ?')
    .bind(dayType, JSON.stringify(steps), JSON.stringify(ticked), done, nowIso(), user.id, date, row.updated_at)
    .run();
  if (!res.meta.changes) return c.json({ error: 'It changed somewhere else just now. Look again and change it then.' }, 409);
  return c.json({ day: { day: date, dayType, steps, blocks: ticked, done: done === 1 } satisfies RoutineDay });
});

/**
 * Clear one routine day (2026-11-14, All tables, the owner's own): its ticks go, any past day, never one still to come (the device's today in
 * `?day=`). It paid nothing, so nothing is taken back; the week it sits in counts it as not done. Owner only, in the statement; a second send
 * answers 404. Limit `prefs`.
 */
session.delete('/day/:date', async (c) => {
  const user = c.get('user');
  const date = c.req.param('date');
  const problem = routineDayProblem(date, c.req.query('day'), user.timezone);
  if (problem) return c.json({ error: problem }, 400);
  const res = await c.env.DB.prepare('DELETE FROM routine_days WHERE user_id = ? AND day = ?').bind(user.id, date).run();
  if (!res.meta.changes) return c.json({ error: 'not found' }, 404);
  return c.json({ ok: true });
});
