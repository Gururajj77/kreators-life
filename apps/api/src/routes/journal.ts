import { Hono } from 'hono';
import type { JournalEntry } from '@kreators/shared';
import type { AppEnv } from '../env';
import { newId, nowIso } from '../db';

export const journal = new Hono<AppEnv>();

interface Row {
  id: string;
  title: string;
  body: string;
  emotion: number | null;
  stress: number | null;
  stressors: string;
  created_at: string;
  updated_at: string;
}

function toEntry(r: Row): JournalEntry {
  let stressors: string[] = [];
  try {
    stressors = JSON.parse(r.stressors || '[]') as string[];
  } catch {
    stressors = [];
  }
  return { id: r.id, title: r.title, body: r.body, emotion: r.emotion, stress: r.stress, stressors, createdAt: r.created_at, updatedAt: r.updated_at };
}

function parse(body: Record<string, unknown>, prev?: Row) {
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 120) : (prev?.title ?? '');
  const text = typeof body.body === 'string' ? body.body.trim().slice(0, 5000) : (prev?.body ?? '');
  const emotion = typeof body.emotion === 'number' && body.emotion >= 1 && body.emotion <= 5 ? Math.round(body.emotion) : body.emotion === null ? null : (prev?.emotion ?? null);
  const stress = typeof body.stress === 'number' && body.stress >= 1 && body.stress <= 5 ? Math.round(body.stress) : body.stress === null ? null : (prev?.stress ?? null);
  const stressors = Array.isArray(body.stressors) ? body.stressors.filter((s): s is string => typeof s === 'string').slice(0, 8) : prev ? (JSON.parse(prev.stressors || '[]') as string[]) : [];
  return { title, text, emotion, stress, stressors };
}

journal.get('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const rows = await db.prepare('SELECT * FROM journal_entries WHERE user_id = ? ORDER BY created_at DESC LIMIT 100').bind(user.id).all<Row>();
  const stats = await db
    .prepare(
      `SELECT COUNT(*) AS total,
        SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS this_month,
        SUM(CASE WHEN emotion >= 4 THEN 1 ELSE 0 END) AS positive,
        SUM(CASE WHEN emotion <= 2 THEN 1 ELSE 0 END) AS negative
       FROM journal_entries WHERE user_id = ?`,
    )
    .bind(new Date().toISOString().slice(0, 7) + '-01', user.id)
    .first<{ total: number; this_month: number; positive: number; negative: number }>();
  return c.json({ entries: rows.results.map(toEntry), stats: { total: stats?.total ?? 0, thisMonth: stats?.this_month ?? 0, positive: stats?.positive ?? 0, negative: stats?.negative ?? 0 } });
});

journal.post('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const p = parse(body);
  if (!p.text && !p.title) return c.json({ error: 'write something first' }, 400);
  const id = newId();
  const now = nowIso();
  await db
    .prepare('INSERT INTO journal_entries (id, user_id, title, body, emotion, stress, stressors, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, user.id, p.title || 'Untitled', p.text, p.emotion, p.stress, JSON.stringify(p.stressors), now, now)
    .run();
  const row = await db.prepare('SELECT * FROM journal_entries WHERE id = ?').bind(id).first<Row>();
  return c.json({ entry: row ? toEntry(row) : null }, 201);
});

journal.patch('/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const prev = await db.prepare('SELECT * FROM journal_entries WHERE id = ? AND user_id = ?').bind(c.req.param('id'), user.id).first<Row>();
  if (!prev) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const p = parse(body, prev);
  await db
    .prepare('UPDATE journal_entries SET title = ?, body = ?, emotion = ?, stress = ?, stressors = ?, updated_at = ? WHERE id = ?')
    .bind(p.title || 'Untitled', p.text, p.emotion, p.stress, JSON.stringify(p.stressors), nowIso(), prev.id)
    .run();
  const row = await db.prepare('SELECT * FROM journal_entries WHERE id = ?').bind(prev.id).first<Row>();
  return c.json({ entry: row ? toEntry(row) : null });
});

journal.delete('/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM journal_entries WHERE id = ? AND user_id = ?').bind(c.req.param('id'), c.get('user').id).run();
  return c.json({ ok: true });
});
