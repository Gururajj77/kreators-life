import { Hono } from 'hono';
import { PROPOSAL_STAGES, typedCents, type Proposal } from '@kreators/shared';
import type { AppEnv } from '../env';
import { audit, can, nameOf, newId, notify, nowIso, oneOf, str, pageOf, paged } from '../db';

/** TV series pitches and Fund applications share one review pipeline. */
export const proposals = new Hono<AppEnv>();

/**
 * The budget, read from its digits with `typedCents` (never `Number(x)`), kept in whole units as `budget_amount` stores it.
 * Anything that is not a plain amount, or is negative, is 0.
 */
function budgetOf(v: unknown): number {
  if (typeof v !== 'number' && typeof v !== 'string') return 0;
  const cents = typedCents(String(v));
  return Number.isFinite(cents) && cents > 0 ? Math.min(1e12, Math.round(cents / 100)) : 0;
}

interface Row { id: string; kind: 'tv' | 'fund'; user_id: string; user_name: string; title: string; pitch: string; budget_amount: number; currency: string; stage: Proposal['stage']; created_at: string; updated_at: string }
interface LogRow { proposal_id: string; actor_name: string | null; from_stage: string; to_stage: string; note: string; created_at: string }
const SELECT = 'SELECT p.*, u.display_name AS user_name FROM proposals p JOIN users u ON u.id = p.user_id';

proposals.get('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const kind = c.req.query('kind') === 'fund' ? 'fund' : 'tv';
  const reviewer = can(user, 'review');
  const ask = pageOf(c);
  const all = reviewer
    ? await db.prepare(`${SELECT} WHERE p.kind = ? ORDER BY p.updated_at DESC LIMIT ? OFFSET ?`).bind(kind, ask.limit, ask.offset).all<Row>()
    : await db.prepare(`${SELECT} WHERE p.kind = ? AND p.user_id = ? ORDER BY p.updated_at DESC LIMIT ? OFFSET ?`).bind(kind, user.id, ask.limit, ask.offset).all<Row>();
  const pg = paged(all.results, ask);
  const rows = { results: pg.items };
  const ids = rows.results.map((r) => r.id);
  const logs = ids.length ? await db.prepare(`SELECT l.*, u.display_name AS actor_name FROM decision_log l LEFT JOIN users u ON u.id = l.actor_user_id WHERE l.proposal_id IN (${ids.map(() => '?').join(',')}) ORDER BY l.created_at`).bind(...ids).all<LogRow>() : { results: [] as LogRow[] };
  const list: Proposal[] = rows.results.map((r) => ({ id: r.id, kind: r.kind, userId: r.user_id, userName: nameOf({ display_name: r.user_name }), title: r.title, pitch: r.pitch, budgetAmount: r.budget_amount, currency: r.currency, stage: r.stage, createdAt: r.created_at, updatedAt: r.updated_at, log: logs.results.filter((l) => l.proposal_id === r.id).map((l) => ({ actorName: l.actor_name ? nameOf({ display_name: l.actor_name }) : 'Staff', fromStage: l.from_stage, toStage: l.to_stage, note: l.note, createdAt: l.created_at })) }));
  return c.json({ page: pg.page, proposals: list, reviewer });
});

proposals.post('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const kind = body.kind === 'fund' ? 'fund' : 'tv';
  const title = str(body.title, 120);
  const pitch = str(body.pitch, 8000);
  if (!title || !pitch) return c.json({ error: 'a title and a pitch' }, 400);
  const id = newId();
  const now = nowIso();
  await db.batch([
    db.prepare("INSERT INTO proposals (id, kind, user_id, title, pitch, budget_amount, currency, stage, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'submitted', ?, ?)").bind(id, kind, user.id, title, pitch, budgetOf(body.budgetAmount), str(body.currency, 3, 'INR').toUpperCase(), now, now),
    db.prepare("INSERT INTO decision_log (id, proposal_id, actor_user_id, from_stage, to_stage, note, created_at) VALUES (?, ?, ?, '', 'submitted', '', ?)").bind(newId(), id, user.id, now),
  ]);
  return c.json({ ok: true, id }, 201);
});

/** The author changes their own pitch while it waits: title, pitch and budget, and only while it is still `submitted`. */
proposals.patch('/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const title = str(body.title, 120);
  const pitch = str(body.pitch, 8000);
  if (!title || !pitch) return c.json({ error: 'a title and a pitch' }, 400);
  const budget = budgetOf(body.budgetAmount);
  const now = nowIso();
  const res = await db
    .prepare("UPDATE proposals SET title = ?, pitch = ?, budget_amount = ?, updated_at = ? WHERE id = ? AND user_id = ? AND stage = 'submitted'")
    .bind(title, pitch, budget, now, id, user.id)
    .run();
  if (!res.meta.changes) {
    const own = await db.prepare('SELECT stage FROM proposals WHERE id = ? AND user_id = ?').bind(id, user.id).first<{ stage: string }>();
    return own ? c.json({ error: 'The team has started reading it, so it can no longer be changed.' }, 409) : c.json({ error: 'not found' }, 404);
  }
  return c.json({ ok: true });
});

/**
 * The author takes back their own pitch while it waits. `withdrawn` is not a stage, so the row and its decision log go
 * in one batch and the fact stays in the audit log. Guarded on the owner and `submitted`, so a pitch the team has picked up stays.
 */
proposals.post('/:id/withdraw', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const id = c.req.param('id');
  const [, res] = await db.batch([
    db.prepare("DELETE FROM decision_log WHERE proposal_id IN (SELECT id FROM proposals WHERE id = ? AND user_id = ? AND stage = 'submitted')").bind(id, user.id),
    db.prepare("DELETE FROM proposals WHERE id = ? AND user_id = ? AND stage = 'submitted'").bind(id, user.id),
  ]);
  if (!res?.meta.changes) {
    const own = await db.prepare('SELECT stage FROM proposals WHERE id = ? AND user_id = ?').bind(id, user.id).first<{ stage: string }>();
    return own ? c.json({ error: 'The team has started reading it, so it can no longer be withdrawn.' }, 409) : c.json({ error: 'not found' }, 404);
  }
  await audit(db, user.id, 'proposal.withdraw', 'proposal', id, 'submitted', '');
  return c.json({ ok: true });
});

proposals.post('/:id/stage', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  if (!can(user, 'review')) return c.json({ error: 'reviewers move proposals' }, 403);
  const prev = await db.prepare(`${SELECT} WHERE p.id = ?`).bind(c.req.param('id')).first<Row>();
  if (!prev) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<{ stage?: string; note?: string }>().catch(() => ({}) as Record<string, never>);
  const stage = oneOf(body.stage, PROPOSAL_STAGES, prev.stage);
  const now = nowIso();
  await db.batch([
    db.prepare('UPDATE proposals SET stage = ?, updated_at = ? WHERE id = ?').bind(stage, now, prev.id),
    db.prepare('INSERT INTO decision_log (id, proposal_id, actor_user_id, from_stage, to_stage, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(newId(), prev.id, user.id, prev.stage, stage, str(body.note, 2000), now),
  ]);
  await audit(db, user.id, 'proposal.stage', 'proposal', prev.id, prev.stage, stage);
  // A pitch is TV's or Fund's. note-link: /tv, /fund
  await notify(db, prev.user_id, prev.kind, `${prev.title}: ${stage.replace('_', ' ')}`, str(body.note, 160), `/${prev.kind}`);
  return c.json({ ok: true });
});
