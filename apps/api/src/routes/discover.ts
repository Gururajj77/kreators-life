import { Hono } from 'hono';
import { analyseDiscover, discoverComplete, discoverProfile, discoverProgress, emptyDiscoverAnswers, parseDiscoverAnswers, profileForAssistant, scoreDiscover, styleHints, type DiscoverAnswers, type DiscoverProfile, type DiscoverResult, EXTRA_KINDS, extraHints, learnedForAssistant, analyseLove, analyseMind, analyseType, emptyExtra, extraComplete, extraProgress, extrasProfile, isExtraKind, parseExtra, scoreExtra, type ExtraKind, type ExtrasProfile, type LoveResult, type MindResult, type TypeResult, type DesignResult, analyseDesign, designChart, designCompare } from '@kreators/shared';
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
  /** "How your mind works" may shape next steps and be read by the assistant. Off until the person says. */
  mind: boolean;
}
export async function settingsOf(db: D1Database, userId: string): Promise<DiscoverSettings> {
  const r = await db.prepare('SELECT steps, assistant, mind FROM discover_settings WHERE user_id = ?').bind(userId).first<{ steps: number; assistant: number; mind: number }>();
  return { steps: r ? r.steps === 1 : true, assistant: r ? r.assistant === 1 : false, mind: r ? r.mind === 1 : false };
}
/** The latest result as a small profile, or null when there is none. Callers check the person's switch first. */
export async function latestProfile(db: D1Database, userId: string): Promise<DiscoverProfile | null> {
  const r = await db.prepare('SELECT result_json, created_at FROM discover_results WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').bind(userId).first<{ result_json: string; created_at: string }>();
  return r ? discoverProfile(JSON.parse(r.result_json) as DiscoverResult, r.created_at) : null;
}

/** The add-ons taken, as a small summary. The mind part is left out unless the person's mind switch is on. Callers check the steps or assistant switch first. */
export async function latestExtras(db: D1Database, userId: string, allowMind: boolean): Promise<ExtrasProfile | null> {
  const rows = await db.prepare('SELECT kind, result_json FROM discover_extras WHERE user_id = ? AND result_json IS NOT NULL').bind(userId).all<{ kind: string; result_json: string }>();
  const by = (k: ExtraKind) => {
    const r = rows.results.find((x) => x.kind === k);
    return r ? JSON.parse(r.result_json) : null;
  };
  return extrasProfile({ type: by('type') as TypeResult | null, love: by('love') as LoveResult | null, mind: by('mind') as MindResult | null, design: by('design') as DesignResult | null }, allowMind);
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
  const body = await c.req.json<{ steps?: unknown; assistant?: unknown; mind?: unknown }>().catch(() => ({}) as { steps?: unknown; assistant?: unknown; mind?: unknown });
  const cur = await settingsOf(c.env.DB, user.id);
  const next = { steps: typeof body.steps === 'boolean' ? body.steps : cur.steps, assistant: typeof body.assistant === 'boolean' ? body.assistant : cur.assistant, mind: typeof body.mind === 'boolean' ? body.mind : cur.mind };
  await c.env.DB.prepare('INSERT INTO discover_settings (user_id, steps, assistant, mind, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET steps = excluded.steps, assistant = excluded.assistant, mind = excluded.mind, updated_at = excluded.updated_at')
    .bind(user.id, next.steps ? 1 : 0, next.assistant ? 1 : 0, next.mind ? 1 : 0, nowIso())
    .run();
  return c.json({ settings: next });
});

// The add-ons: a 16-type self-check, love languages and how your mind works. Each is kept apart from the main quiz, one row a kind: the
// answers so far as a draft, then the latest result. Owner only: every query filters by the session user.
discover.get('/more', async (c) => {
  const user = c.get('user');
  const rows = await c.env.DB.prepare('SELECT kind, draft_json, result_json, taken_at FROM discover_extras WHERE user_id = ?').bind(user.id).all<{ kind: string; draft_json: string | null; result_json: string | null; taken_at: string | null }>();
  const extras = Object.fromEntries(
    EXTRA_KINDS.map((k) => {
      const r = rows.results.find((x) => x.kind === k.key);
      const draft = r?.draft_json ? parseExtra(k.key, JSON.parse(r.draft_json)) : emptyExtra(k.key);
      return [k.key, { draft, progress: extraProgress(k.key, draft), result: r?.result_json ? JSON.parse(r.result_json) : null, takenAt: r?.taken_at ?? null }];
    }),
  );
  return c.json({ extras });
});

discover.put('/more/:kind/draft', async (c) => {
  const kind = c.req.param('kind');
  if (!isExtraKind(kind)) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<{ answers?: unknown }>().catch(() => ({}) as { answers?: unknown });
  const answers = parseExtra(kind, body.answers);
  const now = nowIso();
  await c.env.DB.prepare('INSERT INTO discover_extras (user_id, kind, draft_json, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, kind) DO UPDATE SET draft_json = excluded.draft_json, updated_at = excluded.updated_at')
    .bind(c.get('user').id, kind, JSON.stringify(answers), now)
    .run();
  return c.json({ ok: true, progress: extraProgress(kind, answers) });
});

// Score it here, never in the browser. A retake replaces the earlier result; the draft goes.
discover.post('/more/:kind/submit', async (c) => {
  const kind = c.req.param('kind');
  if (!isExtraKind(kind)) return c.json({ error: 'not found' }, 404);
  const user = c.get('user');
  const body = await c.req.json<{ answers?: unknown }>().catch(() => ({}) as { answers?: unknown });
  let answers: unknown;
  if (body.answers !== undefined) answers = parseExtra(kind, body.answers);
  else {
    const d = await c.env.DB.prepare('SELECT draft_json FROM discover_extras WHERE user_id = ? AND kind = ?').bind(user.id, kind).first<{ draft_json: string | null }>();
    answers = d?.draft_json ? parseExtra(kind, JSON.parse(d.draft_json)) : emptyExtra(kind);
  }
  if (!extraComplete(kind, answers)) {
    const p = extraProgress(kind, answers);
    return c.json({ error: `${p.total - p.done} questions are still open.`, progress: p }, 400);
  }
  const result = scoreExtra(kind, answers);
  const now = nowIso();
  await c.env.DB.prepare(
    'INSERT INTO discover_extras (user_id, kind, draft_json, answers_json, result_json, taken_at, updated_at) VALUES (?, ?, NULL, ?, ?, ?, ?) ON CONFLICT(user_id, kind) DO UPDATE SET draft_json = NULL, answers_json = excluded.answers_json, result_json = excluded.result_json, taken_at = excluded.taken_at, updated_at = excluded.updated_at',
  )
    .bind(user.id, kind, JSON.stringify(answers), JSON.stringify(result), now, now)
    .run();
  const analysis =
    kind === 'type'
      ? analyseType(result as TypeResult)
      : kind === 'love'
        ? analyseLove(result as LoveResult)
        : kind === 'design'
          ? { tropical: analyseDesign(designChart(result as DesignResult, 'tropical')), fagan: analyseDesign(designChart(result as DesignResult, 'fagan')), compare: designCompare(result as DesignResult) }
          : analyseMind(result as MindResult);
  return c.json({ kind, takenAt: now, result, analysis }, 201);
});

// Remove one add-on: its answers, its result and its draft.
discover.delete('/more/:kind', async (c) => {
  const kind = c.req.param('kind');
  if (!isExtraKind(kind)) return c.json({ error: 'not found' }, 404);
  await c.env.DB.prepare('DELETE FROM discover_extras WHERE user_id = ? AND kind = ?').bind(c.get('user').id, kind).run();
  return c.json({ ok: true });
});

// What the assistant may read: a small profile, only while the person's switch is on. The assistant calls this as the person, with their own token.
discover.get('/profile', async (c) => {
  const user = c.get('user');
  const settings = await settingsOf(c.env.DB, user.id);
  if (!settings.assistant) return c.json({ error: 'They have not let the assistant use their Discover results. They can switch it on under Discover.' }, 403);
  const profile = await latestProfile(c.env.DB, user.id);
  const extras = await latestExtras(c.env.DB, user.id, settings.mind);
  if (!profile && !extras) return c.json({ error: 'They have not taken the Discover quiz or any of its self-checks yet.' }, 404);
  const latest = profile ? await c.env.DB.prepare('SELECT result_json FROM discover_results WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').bind(user.id).first<{ result_json: string }>() : null;
  return c.json({
    profile,
    extras,
    summary: learnedForAssistant(profile, extras),
    howToHelp: [...(profile ? styleHints(profile) : []), ...(extras ? extraHints(extras) : [])],
    analysis: latest ? analyseDiscover(JSON.parse(latest.result_json) as DiscoverResult) : null,
  });
});
