import { Hono } from 'hono';
import { analyseDiscover, discoverComplete, discoverProfile, discoverProgress, emptyDiscoverAnswers, parseDiscoverAnswers, profileForAssistant, scoreDiscover, styleHints, type DiscoverAnswers, type DiscoverProfile, type DiscoverResult } from '@kreators/shared';
import type { AppEnv } from '../env';
import { newId, nowIso } from '../db';

export const discover = new Hono<AppEnv>();

interface ResultRow {
  id: string;
  result_json: string;
  created_at: string;
}
export interface DiscoverSettings {
  steps: boolean;
  assistant: boolean;
}
export async function settingsOf(db: D1Database, userId: string): Promise<DiscoverSettings> {
  const r = await db.prepare('SELECT steps, assistant FROM discover_settings WHERE user_id = ?').bind(userId).first<{ steps: number; assistant: number }>();
  return { steps: r ? r.steps === 1 : true, assistant: r ? r.assistant === 1 : false };
}
/** The latest result as a small profile, or null when there is none. Callers check the person's switch first. */
export async function latestProfile(db: D1Database, userId: string): Promise<DiscoverProfile | null> {
  const r = await db.prepare('SELECT result_json, created_at FROM discover_results WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').bind(userId).first<{ result_json: string; created_at: string }>();
  return r ? discoverProfile(JSON.parse(r.result_json) as DiscoverResult, r.created_at) : null;
}

const toResult = (r: ResultRow) => ({ id: r.id, createdAt: r.created_at, result: JSON.parse(r.result_json) as DiscoverResult });

// The draft, the latest result and the earlier ones. Owner only: every query filters by the session user.
discover.get('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const draft = await db.prepare('SELECT answers_json FROM discover_drafts WHERE user_id = ?').bind(user.id).first<{ answers_json: string }>();
  const answers = draft ? parseDiscoverAnswers(JSON.parse(draft.answers_json)) : emptyDiscoverAnswers();
  const rows = await db.prepare('SELECT id, result_json, created_at FROM discover_results WHERE user_id = ? ORDER BY created_at DESC LIMIT 10').bind(user.id).all<ResultRow>();
  const results = rows.results.map(toResult);
  return c.json({ answers, progress: discoverProgress(answers), latest: results[0] ?? null, history: results.slice(1), settings: await settingsOf(db, user.id) });
});

// Save the answers so far. Anything that is not a clean answer is dropped, so a draft can never hold nonsense.
discover.put('/draft', async (c) => {
  const body = await c.req.json<{ answers?: unknown }>().catch(() => ({}) as { answers?: unknown });
  const answers: DiscoverAnswers = parseDiscoverAnswers(body.answers);
  await c.env.DB.prepare('INSERT INTO discover_drafts (user_id, answers_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET answers_json = excluded.answers_json, updated_at = excluded.updated_at')
    .bind(c.get('user').id, JSON.stringify(answers), nowIso())
    .run();
  return c.json({ ok: true, progress: discoverProgress(answers) });
});

// Score the quiz here, never in the browser, and keep the answers with the result. The draft goes.
discover.post('/submit', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<{ answers?: unknown }>().catch(() => ({}) as { answers?: unknown });
  let answers: DiscoverAnswers;
  if (body.answers !== undefined) answers = parseDiscoverAnswers(body.answers);
  else {
    const draft = await db.prepare('SELECT answers_json FROM discover_drafts WHERE user_id = ?').bind(user.id).first<{ answers_json: string }>();
    answers = draft ? parseDiscoverAnswers(JSON.parse(draft.answers_json)) : emptyDiscoverAnswers();
  }
  if (!discoverComplete(answers)) {
    const p = discoverProgress(answers);
    return c.json({ error: `${p.total - p.done} questions are still open.`, progress: p }, 400);
  }
  const result = scoreDiscover(answers);
  const id = newId();
  const now = nowIso();
  await db.batch([
    db.prepare('INSERT INTO discover_results (id, user_id, answers_json, result_json, created_at) VALUES (?, ?, ?, ?, ?)').bind(id, user.id, JSON.stringify(answers), JSON.stringify(result), now),
    db.prepare('DELETE FROM discover_drafts WHERE user_id = ?').bind(user.id),
  ]);
  return c.json({ id, createdAt: now, result }, 201);
});

// Throw the draft away and start the quiz again. Finished results stay.
discover.delete('/draft', async (c) => {
  await c.env.DB.prepare('DELETE FROM discover_drafts WHERE user_id = ?').bind(c.get('user').id).run();
  return c.json({ ok: true });
});

// Delete one finished result.
discover.delete('/results/:id', async (c) => {
  const done = await c.env.DB.prepare('DELETE FROM discover_results WHERE id = ? AND user_id = ?').bind(c.req.param('id'), c.get('user').id).run();
  if (!(done.meta.changes ?? 0)) return c.json({ error: 'not found' }, 404);
  return c.json({ ok: true });
});

// What Discover may do with the result. Both switches are the owner's alone.
discover.put('/settings', async (c) => {
  const user = c.get('user');
  const body = await c.req.json<{ steps?: unknown; assistant?: unknown }>().catch(() => ({}) as { steps?: unknown; assistant?: unknown });
  const cur = await settingsOf(c.env.DB, user.id);
  const next = { steps: typeof body.steps === 'boolean' ? body.steps : cur.steps, assistant: typeof body.assistant === 'boolean' ? body.assistant : cur.assistant };
  await c.env.DB.prepare('INSERT INTO discover_settings (user_id, steps, assistant, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET steps = excluded.steps, assistant = excluded.assistant, updated_at = excluded.updated_at')
    .bind(user.id, next.steps ? 1 : 0, next.assistant ? 1 : 0, nowIso())
    .run();
  return c.json({ settings: next });
});

// What the assistant may read: a small profile, only while the person's switch is on. The assistant calls this as the person, with their own token.
discover.get('/profile', async (c) => {
  const user = c.get('user');
  const settings = await settingsOf(c.env.DB, user.id);
  if (!settings.assistant) return c.json({ error: 'They have not let the assistant use their Discover results. They can switch it on under Discover.' }, 403);
  const profile = await latestProfile(c.env.DB, user.id);
  if (!profile) return c.json({ error: 'They have not taken the Discover quiz yet.' }, 404);
  return c.json({ profile, summary: profileForAssistant(profile), howToHelp: styleHints(profile), analysis: analyseDiscover(JSON.parse((await c.env.DB.prepare('SELECT result_json FROM discover_results WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').bind(user.id).first<{ result_json: string }>())!.result_json) as DiscoverResult).personality.map((p) => ({ trait: p.name, band: p.band, title: p.reading.title })) });
});
