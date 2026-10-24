import { Hono } from 'hono';
import type { SupportTicket } from '@kreators/shared';
import type { AppEnv } from '../env';
import { can, nameOf, newId, notify, nowIso, oneOf, str } from '../db';

export const support = new Hono<AppEnv>();

interface Row { id: string; user_id: string; user_name: string; subject: string; body: string; status: SupportTicket['status']; reply: string; replied_by_name: string | null; created_at: string; updated_at: string }
const SELECT = 'SELECT t.*, u.display_name AS user_name, r.display_name AS replied_by_name FROM support_tickets t JOIN users u ON u.id = t.user_id LEFT JOIN users r ON r.id = t.replied_by';
const toT = (r: Row): SupportTicket => ({ id: r.id, userId: r.user_id, userName: nameOf({ display_name: r.user_name }), subject: r.subject, body: r.body, status: r.status, reply: r.reply, repliedByName: r.replied_by_name ? nameOf({ display_name: r.replied_by_name }) : '', createdAt: r.created_at, updatedAt: r.updated_at });

support.get('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const mine = await db.prepare(`${SELECT} WHERE t.user_id = ? ORDER BY t.created_at DESC`).bind(user.id).all<Row>();
  const queue = can(user, 'support') ? await db.prepare(`${SELECT} WHERE t.status = 'open' ORDER BY t.created_at`).all<Row>() : { results: [] as Row[] };
  return c.json({ tickets: mine.results.map(toT), queue: queue.results.map(toT), agent: can(user, 'support') });
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
  if (reply) await notify(db, prev.user_id, 'support', `Reply: ${prev.subject}`, reply.slice(0, 160), '/help');
  return c.json({ ok: true });
});
