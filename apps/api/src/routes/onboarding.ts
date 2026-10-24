import { Hono } from 'hono';
import {
  deriveAllLadders,
  deriveLadder,
  isRelationshipKey,
  pointsForAnswer,
  QUESTION_BY_ID,
  RELATIONSHIPS,
  scoreAnswers,
  type Answers,
  type DerivedLadder,
  type OnboardingAnswer,
  type OnboardingResponse,
  type RelationshipKey,
} from '@kreators/shared';
import type { AppEnv } from '../env';
import { DATE_RE, newId, nowIso, readyFromNow, shiftDate, toNode, type NodeRow } from '../db';

export const onboarding = new Hono<AppEnv>();

async function storedAnswers(db: D1Database, userId: string): Promise<Answers> {
  const rows = await db
    .prepare('SELECT question_id, value FROM onboarding_answers WHERE user_id = ?')
    .bind(userId)
    .all<{ question_id: string; value: number }>();
  return Object.fromEntries(rows.results.map((r) => [r.question_id, r.value]));
}

// Score the adaptive flow and derive a ladder per floor. Nothing is built yet.
onboarding.post('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req
    .json<{ answers?: OnboardingAnswer[]; displayName?: string; focus?: string }>()
    .catch(() => ({}) as { answers?: OnboardingAnswer[]; displayName?: string; focus?: string });

  const answers: Answers = {};
  for (const a of Array.isArray(body.answers) ? body.answers : []) {
    const q = QUESTION_BY_ID[a?.questionId ?? ''];
    if (!q || typeof a.value !== 'number' || !Number.isFinite(a.value)) continue;
    answers[q.id] = Math.trunc(a.value);
  }
  if (Object.keys(answers).length === 0) return c.json({ error: 'answers required' }, 400);

  const scores = scoreAnswers(answers);
  const now = nowIso();
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim().slice(0, 40) : user.display_name;
  const focus = typeof body.focus === 'string' ? body.focus.trim().slice(0, 40) : user.creator_type;

  await db.batch([
    db.prepare('DELETE FROM onboarding_answers WHERE user_id = ?').bind(user.id),
    ...Object.entries(answers).map(([id, value]) => {
      const q = QUESTION_BY_ID[id]!;
      return db
        .prepare('INSERT INTO onboarding_answers (user_id, question_id, relationship, value, points, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(user.id, q.id, q.relationship, value, q.role === 'foundation' ? 0 : pointsForAnswer(q, value), now);
    }),
    ...RELATIONSHIPS.map((r) =>
      db.prepare('UPDATE relationship_scores SET score = ? WHERE user_id = ? AND relationship = ?').bind(scores[r.key], user.id, r.key),
    ),
    db
      .prepare('UPDATE users SET onboarded_at = ?, display_name = ?, creator_type = ? WHERE id = ?')
      .bind(now, displayName, focus, user.id),
  ]);

  const weakest = [...RELATIONSHIPS].sort((a, b) => scores[a.key] - scores[b.key]).slice(0, 2).map((r) => r.key);
  const res: OnboardingResponse = { scores, weakest, ladders: deriveAllLadders(answers) };
  return c.json(res);
});

function ladderRows(userId: string, ladder: DerivedLadder, date: string): NodeRow[] {
  const now = nowIso();
  const mk = (kind: NodeRow['kind'], parent_id: string | null, title: string, due_date: string | null, sort: number): NodeRow => ({
    id: newId(),
    user_id: userId,
    due_time: null,
    estimate_min: null,
    kind,
    parent_id,
    relationship: ladder.relationship,
    title,
    note: '',
    status: 'active',
    xp: 0,
    due_date,
    completed_at: null,
    ready_at: kind === 'task' ? readyFromNow() : null,
    sort_order: sort,
    created_at: now,
    updated_at: now,
  });
  const pillar = mk('pillar', null, ladder.pillar, null, 0);
  const principle = mk('principle', pillar.id, ladder.principle, null, 0);
  const valueGoal = mk('value_goal', principle.id, ladder.valueGoal, null, 0);
  const outcome = mk('outcome', valueGoal.id, ladder.outcome, null, 0);
  const project = mk('project', outcome.id, ladder.project, null, 0);
  const tasks = ladder.tasks.map((t, i) => mk('task', project.id, t, shiftDate(date, i * 2), i));
  return [pillar, principle, valueGoal, outcome, project, ...tasks];
}

/** Builds the ladder unless that pillar already stands on this floor. */
async function buildLadder(db: D1Database, userId: string, ladder: DerivedLadder, date: string): Promise<NodeRow[] | null> {
  const dup = await db
    .prepare("SELECT id FROM nodes WHERE user_id = ? AND relationship = ? AND kind = 'pillar' AND title = ? AND status != 'archived'")
    .bind(userId, ladder.relationship, ladder.pillar)
    .first<{ id: string }>();
  if (dup) return null;
  const rows = ladderRows(userId, ladder, date);
  await db.batch(
    rows.map((r) =>
      db
        .prepare(
          `INSERT INTO nodes (id, user_id, kind, parent_id, relationship, title, note, status, xp, due_date, completed_at, ready_at, sort_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          r.id, r.user_id, r.kind, r.parent_id, r.relationship, r.title, r.note, r.status, r.xp,
          r.due_date, r.completed_at, r.ready_at, r.sort_order, r.created_at, r.updated_at,
        ),
    ),
  );
  return rows;
}

// Build the derived ladders the person accepted. Derivation is redone from the
// stored answers, so the client cannot invent its own ladder.
onboarding.post('/build', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<{ relationships?: unknown; date?: string }>().catch(() => ({}) as { relationships?: unknown; date?: string });
  const keys = (Array.isArray(body.relationships) ? body.relationships : []).filter(isRelationshipKey);
  if (keys.length === 0) return c.json({ error: 'pick at least one floor' }, 400);
  const date = typeof body.date === 'string' && DATE_RE.test(body.date) ? body.date : new Date().toISOString().slice(0, 10);
  const answers = await storedAnswers(db, user.id);

  const nodes: NodeRow[] = [];
  const skipped: RelationshipKey[] = [];
  for (const key of [...new Set(keys)]) {
    const rows = await buildLadder(db, user.id, deriveLadder(key, answers), date);
    if (rows) nodes.push(...rows);
    else skipped.push(key);
  }
  return c.json({ nodes: nodes.map(toNode), skipped }, 201);
});

// One floor's derived ladder, from the realm screen.
onboarding.post('/accept-quest', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<{ relationship?: string; date?: string }>().catch(() => ({}) as { relationship?: string; date?: string });
  if (!isRelationshipKey(body.relationship)) return c.json({ error: 'relationship required' }, 400);
  const date = typeof body.date === 'string' && DATE_RE.test(body.date) ? body.date : new Date().toISOString().slice(0, 10);
  const answers = await storedAnswers(db, user.id);
  const rows = await buildLadder(db, user.id, deriveLadder(body.relationship, answers), date);
  if (!rows) return c.json({ error: 'that ladder is already standing on this floor' }, 409);
  return c.json({ nodes: rows.map(toNode) }, 201);
});
