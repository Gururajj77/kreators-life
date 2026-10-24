import { Hono } from 'hono';
import type { Introduction } from '@kreators/shared';
import type { AppEnv } from '../env';
import { nameOf, newId, notify, nowIso, oneOf, parseList, str } from '../db';

export const bond = new Hono<AppEnv>();

interface Row { id: string; requester_user_id: string; requester_name: string; recipient_user_id: string; recipient_name: string; context: string; status: Introduction['status']; created_at: string }
const SELECT = 'SELECT i.*, a.display_name AS requester_name, b.display_name AS recipient_name FROM introductions i JOIN users a ON a.id = i.requester_user_id JOIN users b ON b.id = i.recipient_user_id';
const toI = (r: Row): Introduction => ({ id: r.id, requesterId: r.requester_user_id, requesterName: nameOf({ display_name: r.requester_name }), recipientId: r.recipient_user_id, recipientName: nameOf({ display_name: r.recipient_name }), context: r.context, status: r.status, createdAt: r.created_at });

// Suggestions: people who opted in and were at an event you were at, or share a skill.
bond.get('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const [intros, met, blocks] = await Promise.all([
    db.prepare(`${SELECT} WHERE i.requester_user_id = ? OR i.recipient_user_id = ? ORDER BY i.created_at DESC LIMIT 100`).bind(user.id, user.id).all<Row>(),
    user.open_to_intros === 1
      ? db
          .prepare(
            `SELECT DISTINCT u.id, u.display_name, u.handle, u.skills, e.title AS event_title FROM event_registrations r JOIN users u ON u.id = r.user_id JOIN events e ON e.id = r.event_id
             WHERE r.event_id IN (SELECT event_id FROM event_registrations WHERE user_id = ?1 AND status IN ('registered','attended') UNION SELECT id FROM events WHERE host_user_id = ?1)
               AND r.status IN ('registered','attended') AND r.user_id != ?1 AND r.networking_opt_in = 1 AND u.open_to_intros = 1 LIMIT 30`,
          )
          .bind(user.id)
          .all<{ id: string; display_name: string; handle: string | null; skills: string; event_title: string }>()
      : Promise.resolve({ results: [] }),
    db.prepare('SELECT blocked_id FROM blocks WHERE blocker_id = ?').bind(user.id).all<{ blocked_id: string }>(),
  ]);
  const blocked = new Set(blocks.results.map((b) => b.blocked_id));
  return c.json({
    optedIn: user.open_to_intros === 1,
    intros: intros.results.map(toI).filter((i) => !blocked.has(i.requesterId) && !blocked.has(i.recipientId)),
    suggestions: met.results.filter((m) => !blocked.has(m.id)).map((m) => ({ userId: m.id, name: nameOf(m), handle: m.handle, skills: parseList(m.skills).slice(0, 3), context: `Met at ${m.event_title}` })),
  });
});

bond.post('/intros', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  if (user.open_to_intros !== 1) return c.json({ error: 'switch introductions on first' }, 400);
  const body = await c.req.json<{ recipientId?: string; context?: string }>().catch(() => ({}) as Record<string, never>);
  const recipientId = str(body.recipientId, 64);
  if (!recipientId || recipientId === user.id) return c.json({ error: 'who do you want to meet?' }, 400);
  const target = await db.prepare('SELECT id, open_to_intros FROM users WHERE id = ?').bind(recipientId).first<{ id: string; open_to_intros: number }>();
  if (!target || target.open_to_intros !== 1) return c.json({ error: 'that person is not open to introductions' }, 400);
  const blocked = await db.prepare('SELECT 1 FROM blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)').bind(user.id, recipientId, recipientId, user.id).first();
  if (blocked) return c.json({ error: 'not possible' }, 400);
  const dup = await db.prepare("SELECT 1 FROM introductions WHERE requester_user_id = ? AND recipient_user_id = ? AND status = 'proposed'").bind(user.id, recipientId).first();
  if (dup) return c.json({ error: 'already proposed' }, 409);
  await db.prepare("INSERT INTO introductions (id, requester_user_id, recipient_user_id, context, status, consent_at, created_at) VALUES (?, ?, ?, ?, 'proposed', NULL, ?)").bind(newId(), user.id, recipientId, str(body.context, 500), nowIso()).run();
  await notify(db, recipientId, 'bond', `${nameOf(user)} would like an introduction`, str(body.context, 160), '/bond');
  return c.json({ ok: true }, 201);
});

// Contact details only move after the recipient says yes.
bond.post('/intros/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const i = await db.prepare(`${SELECT} WHERE i.id = ? AND i.recipient_user_id = ?`).bind(c.req.param('id'), user.id).first<Row>();
  if (!i) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<{ status?: string }>().catch(() => ({}) as { status?: string });
  const status = oneOf(body.status, ['accepted', 'declined'] as const, 'declined');
  await db.prepare('UPDATE introductions SET status = ?, consent_at = ? WHERE id = ?').bind(status, status === 'accepted' ? nowIso() : null, i.id).run();
  if (status === 'accepted') {
    const me = await db.prepare('SELECT handle, email FROM users WHERE id = ?').bind(user.id).first<{ handle: string | null; email: string | null }>();
    const them = await db.prepare('SELECT handle, email FROM users WHERE id = ?').bind(i.requester_user_id).first<{ handle: string | null; email: string | null }>();
    await notify(db, i.requester_user_id, 'bond', `${nameOf({ display_name: i.recipient_name })} said yes`, me?.email ? `Reach them at ${me.email}${me.handle ? ` or /u/${me.handle}` : ''}` : me?.handle ? `Find them at /u/${me.handle}` : 'Say hello in the community.', '/bond');
    await notify(db, user.id, 'bond', `You are introduced to ${nameOf({ display_name: i.requester_name })}`, them?.email ? `Reach them at ${them.email}${them.handle ? ` or /u/${them.handle}` : ''}` : them?.handle ? `Find them at /u/${them.handle}` : 'Say hello in the community.', '/bond');
  }
  return c.json({ ok: true });
});

bond.post('/block', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<{ userId?: string; reason?: string }>().catch(() => ({}) as Record<string, never>);
  const id = str(body.userId, 64);
  if (!id || id === user.id) return c.json({ error: 'who?' }, 400);
  await db.prepare('INSERT OR REPLACE INTO blocks (blocker_id, blocked_id, reason, created_at) VALUES (?, ?, ?, ?)').bind(user.id, id, str(body.reason, 300), nowIso()).run();
  return c.json({ ok: true }, 201);
});
