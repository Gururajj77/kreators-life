import { Hono } from 'hono';
import {
  builtInTemplate,
  MAX_REVIEW_TEMPLATES,
  parseReviewPrompts,
  PERIOD_KINDS,
  periodDays,
  periodFor,
  periodShift,
  REVIEW_ANSWER_MAX,
  REVIEW_HIGHLIGHT_MAX,
  REVIEW_NAME_MAX,
  type Period,
  type PeriodKind,
  type PeriodNumbers,
  type RelationshipKey,
  type Review,
  type ReviewListItem,
  type ReviewSummary,
  type ReviewTemplate,
  type ReviewsResponse,
} from '@kreators/shared';
import type { AppEnv } from '../env';
import { DATE_RE, newId, nowIso, shiftDate } from '../db';

/** Reviews: the numbers for a period from every app, and the review a person writes about it. */
export const reviews = new Hono<AppEnv>();

const today = () => new Date().toISOString().slice(0, 10);
const kindOf = (v: string | undefined): PeriodKind | null => (v && (PERIOD_KINDS as readonly string[]).includes(v) ? (v as PeriodKind) : null);
const dateOf = (v: string | undefined) => (v && DATE_RE.test(v) ? v : today());
const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const round1 = (v: number) => Math.round(v * 10) / 10;

interface TemplateRow { id: string; user_id: string; kind: PeriodKind; name: string; prompts_json: string; created_at: string; updated_at: string }
interface ReviewRow { id: string; user_id: string; kind: PeriodKind; period_start: string; period_end: string; template_id: string | null; template_name: string; prompts_json: string; answers_json: string; rating: number | null; highlight: string; snapshot_json: string; created_at: string; updated_at: string }

function strings(raw: string): string[] {
  try {
    const v = JSON.parse(raw || '[]') as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
const toTemplate = (r: TemplateRow): ReviewTemplate => ({ id: r.id, kind: r.kind, name: r.name, prompts: strings(r.prompts_json), builtIn: false, createdAt: r.created_at });
function toReview(r: ReviewRow): Review {
  let snapshot: ReviewSummary | null = null;
  try {
    const v = JSON.parse(r.snapshot_json || '{}') as ReviewSummary;
    snapshot = v && typeof v === 'object' && 'now' in v ? v : null;
  } catch {
    snapshot = null;
  }
  return { id: r.id, kind: r.kind, start: r.period_start, end: r.period_end, templateId: r.template_id, templateName: r.template_name, prompts: strings(r.prompts_json), answers: strings(r.answers_json), rating: r.rating, highlight: r.highlight, snapshot, createdAt: r.created_at, updatedAt: r.updated_at };
}

/** Everything that happened in one period, pulled from each app's own table. Journal and wellbeing stay with the owner. */
async function numbersFor(db: D1Database, userId: string, p: Period): Promise<PeriodNumbers> {
  const from = p.start;
  const to = p.end;
  const fromTs = `${from}T00:00:00`;
  const toTs = `${shiftDate(to, 1)}T00:00:00`;
  const [daily, xp, ntd, wb, journal, fin, shop, school, work, people] = await Promise.all([
    db
      .prepare(
        `SELECT
          (SELECT COUNT(*) FROM xp_events WHERE user_id = ?1 AND source = 'checkin' AND source_id >= ?2 AND source_id <= ?3) AS checkins,
          (SELECT COUNT(*) FROM nodes WHERE user_id = ?1 AND kind = 'task' AND status = 'done' AND completed_at >= ?4 AND completed_at < ?5) AS tasks,
          (SELECT COUNT(*) FROM spark_completions WHERE user_id = ?1 AND date >= ?2 AND date <= ?3) AS acts`,
      )
      .bind(userId, from, to, fromTs, toTs)
      .first<{ checkins: number; tasks: number; acts: number }>(),
    db.prepare('SELECT COALESCE(SUM(amount), 0) AS xp, COUNT(DISTINCT substr(created_at, 1, 10)) AS days FROM xp_events WHERE user_id = ? AND created_at >= ? AND created_at < ?').bind(userId, fromTs, toTs).first<{ xp: number; days: number }>(),
    db
      .prepare("SELECT SUM(CASE WHEN status = 'kept' THEN 1 ELSE 0 END) AS kept, SUM(CASE WHEN status = 'slipped' THEN 1 ELSE 0 END) AS slipped FROM not_to_do_days WHERE user_id = ? AND day >= ? AND day <= ?")
      .bind(userId, from, to)
      .first<{ kept: number | null; slipped: number | null }>(),
    db.prepare('SELECT kind, COUNT(*) AS n, SUM(value) AS total FROM wellbeing_logs WHERE user_id = ? AND date >= ? AND date <= ? GROUP BY kind').bind(userId, from, to).all<{ kind: string; n: number; total: number }>(),
    db.prepare('SELECT COUNT(*) AS n, AVG(emotion) AS mood FROM journal_entries WHERE user_id = ? AND created_at >= ? AND created_at < ?').bind(userId, fromTs, toTs).first<{ n: number; mood: number | null }>(),
    db.prepare('SELECT kind, COALESCE(SUM(amount_cents), 0) AS cents FROM finance_transactions WHERE user_id = ? AND date >= ? AND date <= ? GROUP BY kind').bind(userId, from, to).all<{ kind: string; cents: number }>(),
    db
      .prepare("SELECT COUNT(*) AS n, COALESCE(SUM(cents), 0) AS cents, COALESCE(SUM(points), 0) AS points FROM orders WHERE owner_id = ? AND status IN ('paid', 'test') AND created_at >= ? AND created_at < ?")
      .bind(userId, fromTs, toTs)
      .first<{ n: number; cents: number; points: number }>(),
    db
      .prepare(
        `SELECT (SELECT COUNT(*) FROM lesson_progress WHERE user_id = ?1 AND completed_at >= ?2 AND completed_at < ?3) AS lessons,
                (SELECT COUNT(*) FROM enrollments WHERE learner_user_id = ?1 AND completed_at >= ?2 AND completed_at < ?3) AS programs`,
      )
      .bind(userId, fromTs, toTs)
      .first<{ lessons: number; programs: number }>(),
    db
      .prepare(
        `SELECT (SELECT COUNT(*) FROM applications WHERE creator_user_id = ?1 AND submitted_at >= ?2 AND submitted_at < ?3) AS applications,
                (SELECT COUNT(*) FROM applications WHERE creator_user_id = ?1 AND decision_at >= ?2 AND decision_at < ?3) AS decisions`,
      )
      .bind(userId, fromTs, toTs)
      .first<{ applications: number; decisions: number }>(),
    db
      .prepare(
        `SELECT (SELECT COUNT(*) FROM event_registrations WHERE user_id = ?1 AND registered_at >= ?2 AND registered_at < ?3) AS events,
                (SELECT COUNT(*) FROM community_posts WHERE user_id = ?1 AND created_at >= ?2 AND created_at < ?3) AS posts,
                (SELECT COUNT(*) FROM circle_signups WHERE user_id = ?1 AND created_at >= ?2 AND created_at < ?3) AS circles,
                (SELECT COUNT(*) FROM run_entries WHERE user_id = ?1 AND status = 'logged' AND logged_at >= ?2 AND logged_at < ?3) AS runs,
                (SELECT COALESCE(SUM(metres), 0) FROM run_entries WHERE user_id = ?1 AND status = 'logged' AND logged_at >= ?2 AND logged_at < ?3) AS run_metres`,
      )
      .bind(userId, fromTs, toTs)
      .first<{ events: number; posts: number; circles: number; runs: number; run_metres: number }>(),
  ]);
  const log = (kind: string) => wb.results.find((w) => w.kind === kind);
  const avgOf = (kind: string) => {
    const l = log(kind);
    return l && l.n > 0 ? round1(l.total / l.n) : null;
  };
  const sumOf = (kind: string) => Math.round(n(log(kind)?.total));
  return {
    days: periodDays(p).length,
    checkins: n(daily?.checkins),
    tasksDone: n(daily?.tasks),
    smallActs: n(daily?.acts),
    xp: n(xp?.xp),
    activeDays: n(xp?.days),
    notToDoKept: n(ntd?.kept),
    notToDoSlipped: n(ntd?.slipped),
    moodAvg: avgOf('mood'),
    sleepAvg: avgOf('sleep'),
    stressAvg: avgOf('stress'),
    mindfulMin: sumOf('mindful'),
    moveMin: sumOf('move'),
    journalEntries: n(journal?.n),
    journalMoodAvg: journal?.mood === null || journal?.mood === undefined ? null : round1(journal.mood),
    incomeCents: n(fin.results.find((f) => f.kind === 'income')?.cents),
    expenseCents: n(fin.results.find((f) => f.kind === 'expense')?.cents),
    orders: n(shop?.n),
    salesCents: n(shop?.cents),
    salesPoints: n(shop?.points),
    lessonsDone: n(school?.lessons),
    programsDone: n(school?.programs),
    applications: n(work?.applications),
    decisions: n(work?.decisions),
    events: n(people?.events),
    posts: n(people?.posts),
    circles: n(people?.circles),
    runs: n(people?.runs),
    runMetres: n(people?.run_metres),
  };
}

export async function summaryFor(db: D1Database, userId: string, p: Period): Promise<ReviewSummary> {
  const previous = periodShift(p, -1);
  const fromTs = `${p.start}T00:00:00`;
  const toTs = `${shiftDate(p.end, 1)}T00:00:00`;
  const [now, before, xpByDay, tasksByDay, byArea, cur] = await Promise.all([
    numbersFor(db, userId, p),
    numbersFor(db, userId, previous),
    db.prepare('SELECT substr(created_at, 1, 10) AS d, SUM(amount) AS xp FROM xp_events WHERE user_id = ? AND created_at >= ? AND created_at < ? GROUP BY d').bind(userId, fromTs, toTs).all<{ d: string; xp: number }>(),
    db.prepare("SELECT substr(completed_at, 1, 10) AS d, COUNT(*) AS n FROM nodes WHERE user_id = ? AND kind = 'task' AND status = 'done' AND completed_at >= ? AND completed_at < ? GROUP BY d").bind(userId, fromTs, toTs).all<{ d: string; n: number }>(),
    db.prepare('SELECT relationship, SUM(amount) AS xp FROM xp_events WHERE user_id = ? AND relationship IS NOT NULL AND created_at >= ? AND created_at < ? GROUP BY relationship').bind(userId, fromTs, toTs).all<{ relationship: RelationshipKey; xp: number }>(),
    db.prepare('SELECT currency FROM finance_transactions WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date DESC LIMIT 1').bind(userId, p.start, p.end).first<{ currency: string }>(),
  ]);
  const xpMap = new Map(xpByDay.results.map((r) => [r.d, r.xp]));
  const taskMap = new Map(tasksByDay.results.map((r) => [r.d, r.n]));
  const xpByArea: Partial<Record<RelationshipKey, number>> = {};
  for (const r of byArea.results) xpByArea[r.relationship] = r.xp;
  return { period: p, previous, now, before, series: periodDays(p).map((d) => ({ date: d, xp: xpMap.get(d) ?? 0, tasks: taskMap.get(d) ?? 0 })), xpByArea, currency: cur?.currency ?? 'INR' };
}

async function templatesFor(db: D1Database, userId: string, kind: PeriodKind): Promise<ReviewTemplate[]> {
  const rows = await db.prepare('SELECT * FROM review_templates WHERE user_id = ? AND kind = ? ORDER BY created_at ASC').bind(userId, kind).all<TemplateRow>();
  return [builtInTemplate(kind), ...rows.results.map(toTemplate)];
}

reviews.get('/summary', async (c) => {
  const kind = kindOf(c.req.query('kind')) ?? 'week';
  return c.json(await summaryFor(c.env.DB, c.get('user').id, periodFor(kind, dateOf(c.req.query('date')))));
});

reviews.get('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const kind = kindOf(c.req.query('kind')) ?? 'week';
  const period = periodFor(kind, dateOf(c.req.query('date')));
  const [summary, row, templates, recent] = await Promise.all([
    summaryFor(db, user.id, period),
    db.prepare('SELECT * FROM reviews WHERE user_id = ? AND kind = ? AND period_start = ?').bind(user.id, kind, period.start).first<ReviewRow>(),
    templatesFor(db, user.id, kind),
    db.prepare('SELECT id, kind, period_start, period_end, rating, highlight, updated_at FROM reviews WHERE user_id = ? ORDER BY period_start DESC, updated_at DESC LIMIT 24').bind(user.id).all<Pick<ReviewRow, 'id' | 'kind' | 'period_start' | 'period_end' | 'rating' | 'highlight' | 'updated_at'>>(),
  ]);
  const res: ReviewsResponse = {
    period,
    summary,
    review: row ? toReview(row) : null,
    templates,
    recent: recent.results.map((r): ReviewListItem => ({ id: r.id, kind: r.kind, start: r.period_start, end: r.period_end, rating: r.rating, highlight: r.highlight, updatedAt: r.updated_at })),
  };
  return c.json(res);
});

// Write or rewrite the review for a period. The prompts and the numbers are copied in, so later changes never rewrite it.
reviews.put('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  type PutBody = { kind?: string; date?: string; templateId?: string | null; answers?: unknown; rating?: unknown; highlight?: unknown };
  const body = await c.req.json<PutBody>().catch(() => ({}) as PutBody);
  const kind = kindOf(body.kind);
  if (!kind) return c.json({ error: 'kind must be week, month, quarter or half' }, 400);
  if (!body.date || !DATE_RE.test(body.date)) return c.json({ error: 'date must be YYYY-MM-DD' }, 400);
  const period = periodFor(kind, body.date);
  if (period.start > shiftDate(today(), 1)) return c.json({ error: 'That period has not started yet.' }, 400);
  const templates = await templatesFor(db, user.id, kind);
  const template = templates.find((t) => t.id === (body.templateId ?? `builtin:${kind}`));
  if (!template) return c.json({ error: 'no such template' }, 404);
  const given = Array.isArray(body.answers) ? body.answers : [];
  const answers = template.prompts.map((_, i) => (typeof given[i] === 'string' ? (given[i] as string).trim().slice(0, REVIEW_ANSWER_MAX) : ''));
  const rating = typeof body.rating === 'number' && body.rating >= 1 && body.rating <= 5 ? Math.round(body.rating) : null;
  const highlight = typeof body.highlight === 'string' ? body.highlight.trim().slice(0, REVIEW_HIGHLIGHT_MAX) : '';
  const snapshot = await summaryFor(db, user.id, period);
  const now = nowIso();
  const id = newId();
  await db
    .prepare(
      `INSERT INTO reviews (id, user_id, kind, period_start, period_end, template_id, template_name, prompts_json, answers_json, rating, highlight, snapshot_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, kind, period_start) DO UPDATE SET template_id = excluded.template_id, template_name = excluded.template_name, prompts_json = excluded.prompts_json,
         answers_json = excluded.answers_json, rating = excluded.rating, highlight = excluded.highlight, snapshot_json = excluded.snapshot_json, updated_at = excluded.updated_at`,
    )
    .bind(id, user.id, kind, period.start, period.end, template.builtIn ? null : template.id, template.name, JSON.stringify(template.prompts), JSON.stringify(answers), rating, highlight, JSON.stringify(snapshot), now, now)
    .run();
  const row = await db.prepare('SELECT * FROM reviews WHERE user_id = ? AND kind = ? AND period_start = ?').bind(user.id, kind, period.start).first<ReviewRow>();
  return c.json({ review: row ? toReview(row) : null });
});

reviews.post('/templates', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  type TplBody = { kind?: string; name?: unknown; prompts?: unknown };
  const body = await c.req.json<TplBody>().catch(() => ({}) as TplBody);
  const kind = kindOf(body.kind);
  if (!kind) return c.json({ error: 'kind must be week, month, quarter or half' }, 400);
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, REVIEW_NAME_MAX) : '';
  const prompts = parseReviewPrompts(body.prompts);
  if (!name) return c.json({ error: 'Give the template a name.' }, 400);
  if (prompts.length === 0) return c.json({ error: 'Add at least one question.' }, 400);
  const count = await db.prepare('SELECT COUNT(*) AS n FROM review_templates WHERE user_id = ?').bind(user.id).first<{ n: number }>();
  if ((count?.n ?? 0) >= MAX_REVIEW_TEMPLATES) return c.json({ error: `${MAX_REVIEW_TEMPLATES} templates is plenty. Remove one to add another.` }, 400);
  const id = newId();
  const now = nowIso();
  await db.prepare('INSERT INTO review_templates (id, user_id, kind, name, prompts_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(id, user.id, kind, name, JSON.stringify(prompts), now, now).run();
  const template: ReviewTemplate = { id, kind, name, prompts, builtIn: false, createdAt: now };
  return c.json({ template }, 201);
});

reviews.patch('/templates/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await db.prepare('SELECT * FROM review_templates WHERE id = ? AND user_id = ?').bind(c.req.param('id'), user.id).first<TemplateRow>();
  if (!row) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<{ name?: unknown; prompts?: unknown }>().catch(() => ({}) as { name?: unknown; prompts?: unknown });
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, REVIEW_NAME_MAX) : row.name;
  const prompts = body.prompts === undefined ? strings(row.prompts_json) : parseReviewPrompts(body.prompts);
  if (!name) return c.json({ error: 'Give the template a name.' }, 400);
  if (prompts.length === 0) return c.json({ error: 'Add at least one question.' }, 400);
  const now = nowIso();
  await db.prepare('UPDATE review_templates SET name = ?, prompts_json = ?, updated_at = ? WHERE id = ?').bind(name, JSON.stringify(prompts), now, row.id).run();
  return c.json({ template: toTemplate({ ...row, name, prompts_json: JSON.stringify(prompts), updated_at: now }) });
});

reviews.delete('/templates/:id', async (c) => {
  const r = await c.env.DB.prepare('DELETE FROM review_templates WHERE id = ? AND user_id = ?').bind(c.req.param('id'), c.get('user').id).run();
  if (!r.meta.changes) return c.json({ error: 'not found' }, 404);
  return c.json({ ok: true });
});

reviews.get('/:id', async (c) => {
  const row = await c.env.DB.prepare('SELECT * FROM reviews WHERE id = ? AND user_id = ?').bind(c.req.param('id'), c.get('user').id).first<ReviewRow>();
  if (!row) return c.json({ error: 'not found' }, 404);
  return c.json({ review: toReview(row) });
});

reviews.delete('/:id', async (c) => {
  const r = await c.env.DB.prepare('DELETE FROM reviews WHERE id = ? AND user_id = ?').bind(c.req.param('id'), c.get('user').id).run();
  if (!r.meta.changes) return c.json({ error: 'not found' }, 404);
  return c.json({ ok: true });
});
