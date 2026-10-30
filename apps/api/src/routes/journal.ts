import { Hono } from 'hono';
import type { JournalEntry } from '@kreators/shared';
import type { AppEnv } from '../env';
import { DATE_RE, newId, nowIso, pageOf, paged, shiftDate } from '../db';

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

/** A day the calendar can write to: a real date, today or earlier (a day ahead is allowed for time zones). */
const pastDay = (v: unknown): v is string => typeof v === 'string' && DATE_RE.test(v) && v <= shiftDate(new Date().toISOString().slice(0, 10), 1);

// One month of the calendar: for each day with an entry, how many and how it felt on average.
journal.get('/days', async (c) => {
  const month = c.req.query('month') ?? '';
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return c.json({ error: 'send month as YYYY-MM' }, 400);
  const next = shiftDate(`${month}-01`, 32).slice(0, 7);
  const rows = await c.env.DB.prepare("SELECT substr(created_at, 1, 10) AS d, COUNT(*) AS n, AVG(emotion) AS e FROM journal_entries WHERE user_id = ? AND created_at >= ? AND created_at < ? GROUP BY d").bind(c.get('user').id, `${month}-01`, `${next}-01`).all<{ d: string; n: number; e: number | null }>();
  return c.json({ days: rows.results.map((r) => ({ date: r.d, count: r.n, emotion: r.e === null ? null : Math.round(r.e) })) });
});

journal.get('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const ask = pageOf(c);
  // ?date= lists one day's entries, for the calendar.
  const day = c.req.query('date');
  const rows = pastDay(day)
    ? await db.prepare('SELECT * FROM journal_entries WHERE user_id = ? AND substr(created_at, 1, 10) = ? ORDER BY created_at DESC LIMIT ? OFFSET ?').bind(user.id, day, ask.limit, ask.offset).all<Row>()
    : await db.prepare('SELECT * FROM journal_entries WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?').bind(user.id, ask.limit, ask.offset).all<Row>();
  const pg = paged(rows.results, ask);
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
  return c.json({ page: pg.page, entries: pg.items.map(toEntry), stats: { total: stats?.total ?? 0, thisMonth: stats?.this_month ?? 0, positive: stats?.positive ?? 0, negative: stats?.negative ?? 0 } });
});

journal.post('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const p = parse(body);
  if (!p.text && !p.title) return c.json({ error: 'write something first' }, 400);
  const id = newId();
  const now = nowIso();
  // An entry added from a calendar day belongs to that day: noon UTC keeps the date the same in nearly every time zone.
  if (body.date !== undefined && !pastDay(body.date)) return c.json({ error: 'pick a day that is not in the future' }, 400);
  const at = typeof body.date === 'string' ? `${body.date}T12:00:00.000Z` : now;
  await db
    .prepare('INSERT INTO journal_entries (id, user_id, title, body, emotion, stress, stressors, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, user.id, p.title || 'Untitled', p.text, p.emotion, p.stress, JSON.stringify(p.stressors), at, now)
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
