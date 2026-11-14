import { Hono } from 'hono';
import type { SupportTicket } from '@kreators/shared';
import type { AppEnv } from '../env';
import { can, nameOf, newId, notify, nowIso, oneOf, pageOf, paged, str } from '../db';

export const support = new Hono<AppEnv>();

interface Row { id: string; user_id: string; user_name: string; subject: string; body: string; status: SupportTicket['status']; reply: string; replied_by_name: string | null; created_at: string; updated_at: string }
const SELECT = 'SELECT t.*, u.display_name AS user_name, r.display_name AS replied_by_name FROM support_tickets t JOIN users u ON u.id = t.user_id LEFT JOIN users r ON r.id = t.replied_by';
const toT = (r: Row): SupportTicket => ({ id: r.id, userId: r.user_id, userName: nameOf({ display_name: r.user_name }), subject: r.subject, body: r.body, status: r.status, reply: r.reply, repliedByName: r.replied_by_name ? nameOf({ display_name: r.replied_by_name }) : '', createdAt: r.created_at, updatedAt: r.updated_at });

support.get('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const agent = can(user, 'support');
  // Both lists a page at a time: `t` for the person's own messages, `q` for the open queue the support staff answer.
  const askMine = pageOf(c, 't');
  const askQueue = pageOf(c, 'q');
  const [mine, queue] = await Promise.all([
    db.prepare(`${SELECT} WHERE t.user_id = ? ORDER BY t.created_at DESC, t.id LIMIT ? OFFSET ?`).bind(user.id, askMine.limit, askMine.offset).all<Row>(),
    agent ? db.prepare(`${SELECT} WHERE t.status = 'open' ORDER BY t.created_at, t.id LIMIT ? OFFSET ?`).bind(askQueue.limit, askQueue.offset).all<Row>() : Promise.resolve({ results: [] as Row[] }),
  ]);
  const myPage = paged(mine.results, askMine);
  const queuePage = paged(queue.results, askQueue);
  return c.json({ tickets: myPage.items.map(toT), page: myPage.page, queue: queuePage.items.map(toT), queuePage: queuePage.page, agent });
});

support.post('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<{ subject?: string; body?: string }>().catch(() => ({}) as Record<string, never>);
  const subject = str(body.subject, 120);
  const text = str(body.body, 4000);
  if (!subject || !text) return c.json({ error: 'a subject and what happened' }, 400);
  const now = nowIso();
  await db.prepare("INSERT INTO support_tickets (id, user_id, subject, body, status, reply, replied_by, created_at, updated_at) VALUES (?, ?, ?, ?, 'open', '', NULL, ?, ?)").bind(newId(), user.id, subject, text, now, now).run();
  return c.json({ ok: true }, 201);
});

/**
 * A message of one's own that the team has not answered yet (2026-11-14, All tables, the owner's own): its subject and words can change, or it
 * can be withdrawn. Only a plain message: a report (written by a Report on someone else's line, its subject always "Report: …", in
 * cohortTalk.ts, channels.ts and run.ts) quotes another person's words, so it stays as it was sent. Every write is guarded on the same rule in
 * the statement itself, owner first, so a reply that lands first wins and a second send changes nothing twice (404 or 409 in words).
 */
const OWN_OPEN = "user_id = ? AND status = 'open' AND reply = '' AND subject NOT LIKE 'Report: %'";
/** Why a message of one's own that a write did not reach stays, or null when it is not theirs. */
async function whyStays(db: D1Database, id: string, userId: string): Promise<string | null> {
  const row = await db.prepare('SELECT subject, status, reply FROM support_tickets WHERE id = ? AND user_id = ?').bind(id, userId).first<{ subject: string; status: string; reply: string }>();
  if (!row) return null;
  if (/^report: /i.test(row.subject)) return 'A report stays as you sent it.';
  return row.status === 'closed' && !row.reply ? 'The team closed it, so it stays as it is.' : 'The team has answered it, so it stays as it is.';
}

support.patch('/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<{ subject?: unknown; body?: unknown }>().catch(() => ({}) as { subject?: unknown; body?: unknown });
  const subject = 'subject' in body ? str(body.subject, 120) : null;
  const text = 'body' in body ? str(body.body, 4000) : null;
  if (subject === null && text === null) return c.json({ error: 'Send a subject or the words to change.' }, 400);
  if (subject === '' || text === '') return c.json({ error: 'a subject and what happened' }, 400);
  const r = await db
    .prepare(`UPDATE support_tickets SET subject = COALESCE(?, subject), body = COALESCE(?, body), updated_at = ? WHERE id = ? AND ${OWN_OPEN}`)
    .bind(subject, text, nowIso(), c.req.param('id'), user.id)
    .run();
  if (!r.meta.changes) {
    const why = await whyStays(db, c.req.param('id'), user.id);
    return why ? c.json({ error: why }, 409) : c.json({ error: 'not found' }, 404);
  }
  return c.json({ ok: true });
});

support.delete('/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const r = await db.prepare(`DELETE FROM support_tickets WHERE id = ? AND ${OWN_OPEN}`).bind(c.req.param('id'), user.id).run();
  if (!r.meta.changes) {
    const why = await whyStays(db, c.req.param('id'), user.id);
    return why ? c.json({ error: why }, 409) : c.json({ error: 'not found' }, 404);
  }
  return c.json({ ok: true });
});

support.post('/:id/reply', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  if (!can(user, 'support')) return c.json({ error: 'support staff reply' }, 403);
  const prev = await db.prepare(`${SELECT} WHERE t.id = ?`).bind(c.req.param('id')).first<Row>();
  if (!prev) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<{ reply?: string; status?: string }>().catch(() => ({}) as Record<string, never>);
  const reply = str(body.reply, 4000);
  const status = oneOf(body.status, ['open', 'answered', 'closed'] as const, 'answered');
  await db.prepare('UPDATE support_tickets SET reply = ?, replied_by = ?, status = ?, updated_at = ? WHERE id = ?').bind(reply || prev.reply, user.id, status, nowIso(), prev.id).run();
  if (reply) await notify(db, prev.user_id, 'support', `Reply: ${prev.subject}`, reply.slice(0, 160), '/help#mine-heading');
  return c.json({ ok: true });
});
