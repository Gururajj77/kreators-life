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
  parseRoutineBlocks,
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
  type RoutineBlock,
  type RoutineDay,
  type Scores,
  type SessionResponse,
} from '@kreators/shared';
import type { AppEnv } from '../env';
import { DATE_RE, newId, nowIso, num, oneOf, shiftDate, str } from '../db';

/** The strategy session: the assessment, the plan it produces, and the morning routine day by day. */
export const session = new Hono<AppEnv>();

interface ARow { id: string; kind: Assessment['kind']; fears_json: string; insecurities_json: string; scores_json: string; real_day_json: string; focus_json: string; created_at: string }
interface PRow { relationship: RelationshipKey; core_level: number; floor_level: number; evidence: string }
interface RRow { id: string; assessment_id: string; ramp_step: number; general_json: string; exceptional_json: string; practices_json: string; created_at: string }
interface CRow { min_days: number; checkin_time: string; penalty: Contract['penalty']; next_weekly: string; next_monthly: string; signed_name: string; signed_at: string }
interface DRow { day: string; day_type: RoutineDay['dayType']; steps_json: string; done: number }
const json = <T,>(s: string, fb: T): T => {
  try {
    return JSON.parse(s) as T;
  } catch {
    return fb;
  }
};
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const time = (v: unknown, fb: string) => (typeof v === 'string' && TIME_RE.test(v) ? v : fb);

async function latest(db: D1Database, userId: string, date: string): Promise<SessionResponse> {
  const a = await db.prepare("SELECT * FROM assessments WHERE user_id = ? AND kind = 'onboard' ORDER BY created_at DESC LIMIT 1").bind(userId).first<ARow>();
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
      createdAt: a.created_at,
    };
  }
  const r = await db.prepare('SELECT * FROM routines WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').bind(userId).first<RRow>();
  const c = await db.prepare('SELECT * FROM contracts WHERE user_id = ? ORDER BY signed_at DESC LIMIT 1').bind(userId).first<CRow>();
  const days = await db.prepare('SELECT day, day_type, steps_json, done FROM routine_days WHERE user_id = ? AND day > ? AND day <= ?').bind(userId, shiftDate(date, -7), date).all<DRow>();
  const byDay = new Map(days.results.map((d) => [d.day, d]));
  const today = byDay.get(date);
  const week = Array.from({ length: 7 }, (_, i) => shiftDate(date, i - 6)).map((d) => (byDay.has(d) ? byDay.get(d)!.done === 1 : null));
  return {
    assessment,
    routine: r ? { id: r.id, rampStep: r.ramp_step, general: json<RoutineBlock[]>(r.general_json, []), exceptional: json<RoutineBlock[]>(r.exceptional_json, []), practices: json<Practices>(r.practices_json, { mantra: 'none', breathing: 'box', affirmation: '', reading: '' }), createdAt: r.created_at } : null,
    contract: c ? { minDays: c.min_days, checkinTime: c.checkin_time, penalty: c.penalty, nextWeekly: c.next_weekly, nextMonthly: c.next_monthly, signedName: c.signed_name, signedAt: c.signed_at } : null,
    today: today ? { day: today.day, dayType: today.day_type, steps: json<string[]>(today.steps_json, []), done: today.done === 1 } : null,
    week: { done: week.filter((d) => d === true).length, days: week },
  };
}

const dateOf = (v: string | undefined) => (v && DATE_RE.test(v) ? v : new Date().toISOString().slice(0, 10));

session.get('/', async (c) => c.json(await latest(c.env.DB, c.get('user').id, dateOf(c.req.query('date')))));

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
  const focus = pickFocus(placements, insecurities);
  const id = newId();
  const now = nowIso();
  await db.batch([
    db.prepare('INSERT INTO assessments (id, user_id, kind, fears_json, insecurities_json, scores_json, real_day_json, focus_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, user.id, kind, JSON.stringify(fears), JSON.stringify(insecurities), JSON.stringify(scores), JSON.stringify(realDay), JSON.stringify(focus), now),
    ...placements.map((p) => db.prepare('INSERT INTO placements (id, assessment_id, user_id, relationship, core_level, floor_level, core_band, floor_band, evidence, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(newId(), id, user.id, p.relationship, p.core, p.floor, levelByValue(p.core)!.band, levelByValue(p.floor)!.band, p.evidence, now)),
  ]);
  const res = await latest(db, user.id, dateOf(undefined));
  return c.json({ ...res, suggestedFocus: focus }, 201);
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
  const today = dateOf(typeof body.date === 'string' ? body.date : undefined);
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
  const general = json<RoutineBlock[]>(r.general_json, []);
  const exceptional = json<RoutineBlock[]>(r.exceptional_json, []);
  const next = {
    general: body.general === undefined ? general : parseRoutineBlocks(body.general, general),
    exceptional: body.exceptional === undefined ? exceptional : parseRoutineBlocks(body.exceptional, exceptional),
  };
  await db.prepare('UPDATE routines SET general_json = ?, exceptional_json = ? WHERE id = ? AND user_id = ?').bind(JSON.stringify(next.general), JSON.stringify(next.exceptional), r.id, user.id).run();
  return c.json(await latest(db, user.id, dateOf(typeof body.date === 'string' ? body.date : undefined)));
});

session.post('/day', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const day = dateOf(typeof body.date === 'string' ? body.date : undefined);
  const dayType = oneOf(body.dayType, ['general', 'exceptional'] as const, 'general');
  const r = await db.prepare('SELECT * FROM routines WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').bind(user.id).first<RRow>();
  if (!r) return c.json({ error: 'no routine yet; run the strategy session first' }, 400);
  const blocks = json<RoutineBlock[]>(dayType === 'general' ? r.general_json : r.exceptional_json, []);
  const morning = blocks.find((b) => b.key === 'morning')?.steps ?? [];
  const steps = (Array.isArray(body.steps) ? body.steps : []).filter((s): s is string => typeof s === 'string' && morning.includes(s));
  const done = morning.length > 0 && morning.every((s) => steps.includes(s)) ? 1 : 0;
  await db.prepare('INSERT INTO routine_days (user_id, day, day_type, steps_json, done, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, day) DO UPDATE SET day_type = excluded.day_type, steps_json = excluded.steps_json, done = excluded.done, updated_at = excluded.updated_at').bind(user.id, day, dayType, JSON.stringify(steps), done, nowIso()).run();
  return c.json(await latest(db, user.id, day));
});
