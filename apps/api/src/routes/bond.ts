import { Hono } from 'hono';
import { ALIAS_WORDS, RELATIONSHIPS, type BondChat, type BondMessage, type Friend, type Introduction } from '@kreators/shared';
import type { AppEnv } from '../env';
import { nameOf, newId, notify, nowIso, oneOf, parseList, publicOf, str } from '../db';
import { memberBehindAlias } from './circles';

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

// ---------------------------------------------------------------------------
// Friends: a request, a yes, and then you are on each other's lists.
// ---------------------------------------------------------------------------

interface FriendRow { id: string; requester_id: string; recipient_id: string; status: string; created_at: string; name: string; handle: string | null; avatar_url: string }

bond.get('/friends', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const rows = await db
    .prepare(
      `SELECT f.id, f.requester_id, f.recipient_id, f.status, f.created_at, u.display_name AS name, u.handle, u.avatar_url
       FROM friendships f JOIN users u ON u.id = CASE WHEN f.requester_id = ?1 THEN f.recipient_id ELSE f.requester_id END
       WHERE (f.requester_id = ?1 OR f.recipient_id = ?1) AND f.status IN ('pending', 'accepted') ORDER BY f.created_at DESC LIMIT 200`,
    )
    .bind(user.id)
    .all<FriendRow>();
  const friends: Friend[] = rows.results.map((r) => ({
    userId: r.requester_id === user.id ? r.recipient_id : r.requester_id,
    name: nameOf({ display_name: r.name }),
    handle: r.handle,
    avatarUrl: r.avatar_url ?? '',
    status: r.status === 'accepted' ? 'friends' : r.requester_id === user.id ? 'sent' : 'pending',
    requestId: r.id,
    createdAt: r.created_at,
  }));
  return c.json({ friends });
});

bond.post('/friends', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<{ userId?: string }>().catch(() => ({}) as { userId?: string });
  const id = str(body.userId, 64);
  if (!id || id === user.id) return c.json({ error: 'who?' }, 400);
  const target = await db.prepare('SELECT id, public_json FROM users WHERE id = ?').bind(id).first<{ id: string; public_json: string }>();
  if (!target) return c.json({ error: 'no such person' }, 404);
  const tp = publicOf(target);
  if (!tp.pagePublic || !tp.allowFriendRequests) return c.json({ error: 'this person is not taking friend requests' }, 403);
  const blocked = await db.prepare('SELECT 1 FROM blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)').bind(user.id, id, id, user.id).first();
  if (blocked) return c.json({ error: 'not possible' }, 400);
  const existing = await db.prepare('SELECT id, requester_id, status FROM friendships WHERE (requester_id = ?1 AND recipient_id = ?2) OR (requester_id = ?2 AND recipient_id = ?1)').bind(user.id, id).first<{ id: string; requester_id: string; status: string }>();
  if (existing?.status === 'accepted') return c.json({ error: 'already friends' }, 409);
  if (existing?.status === 'pending') {
    // They asked first: asking back is a yes.
    if (existing.requester_id !== user.id) {
      await db.prepare("UPDATE friendships SET status = 'accepted', answered_at = ? WHERE id = ?").bind(nowIso(), existing.id).run();
      await notify(db, existing.requester_id, 'bond', `${nameOf(user)} is now your friend`, 'Say hello from Bond.', '/bond');
      return c.json({ ok: true, status: 'friends' });
    }
    return c.json({ error: 'already asked' }, 409);
  }
  await db.prepare("INSERT OR REPLACE INTO friendships (id, requester_id, recipient_id, status, created_at, answered_at) VALUES (?, ?, ?, 'pending', ?, NULL)").bind(newId(), user.id, id, nowIso()).run();
  await notify(db, id, 'bond', `${nameOf(user)} would like to be friends`, 'Accept or decline under Bond.', '/bond');
  return c.json({ ok: true, status: 'sent' }, 201);
});

bond.post('/friends/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await db.prepare("SELECT id, requester_id FROM friendships WHERE id = ? AND recipient_id = ? AND status = 'pending'").bind(c.req.param('id'), user.id).first<{ id: string; requester_id: string }>();
  if (!row) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<{ status?: string }>().catch(() => ({}) as { status?: string });
  const status = oneOf(body.status, ['accepted', 'declined'] as const, 'declined');
  await db.prepare('UPDATE friendships SET status = ?, answered_at = ? WHERE id = ?').bind(status, nowIso(), row.id).run();
  if (status === 'accepted') await notify(db, row.requester_id, 'bond', `${nameOf(user)} said yes`, 'You are friends now. Say hello from Bond.', '/bond');
  return c.json({ ok: true });
});

bond.delete('/friends/:userId', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  await db.prepare('DELETE FROM friendships WHERE (requester_id = ?1 AND recipient_id = ?2) OR (requester_id = ?2 AND recipient_id = ?1)').bind(user.id, c.req.param('userId')).run();
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Anonymous chats: two people, two aliases, no names. Started from a friend, a person you met,
// or someone at your circle table (by alias, so the id never reaches the browser).
// ---------------------------------------------------------------------------

interface ChatRow { id: string; a_user_id: string; b_user_id: string; a_alias: string; b_alias: string; source: string; created_at: string; last_message_at: string | null; last_body: string | null }
const CHAT_SELECT = 'SELECT c.*, (SELECT body FROM bond_messages m WHERE m.chat_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_body FROM bond_chats c';

function toChat(r: ChatRow, userId: string): BondChat {
  const mine = r.a_user_id === userId;
  return { id: r.id, myAlias: mine ? r.a_alias : r.b_alias, theirAlias: mine ? r.b_alias : r.a_alias, source: r.source, lastMessageAt: r.last_message_at, lastBody: (r.last_body ?? '').slice(0, 80), createdAt: r.created_at };
}

function aliasPair(seed: string): [string, string] {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const w1 = ALIAS_WORDS[h % ALIAS_WORDS.length]!;
  const w2 = ALIAS_WORDS[(h + 5) % ALIAS_WORDS.length]!;
  const c1 = RELATIONSHIPS[h % RELATIONSHIPS.length]!.character;
  const c2 = RELATIONSHIPS[(h + 3) % RELATIONSHIPS.length]!.character;
  return [`${w1} ${c1}`, `${w2} ${c2}`];
}

async function chatFor(db: D1Database, id: string, userId: string): Promise<ChatRow | null> {
  return db.prepare(`${CHAT_SELECT} WHERE c.id = ? AND (c.a_user_id = ? OR c.b_user_id = ?)`).bind(id, userId, userId).first<ChatRow>();
}

bond.get('/chats', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const rows = await db.prepare(`${CHAT_SELECT} WHERE c.a_user_id = ?1 OR c.b_user_id = ?1 ORDER BY COALESCE(c.last_message_at, c.created_at) DESC LIMIT 100`).bind(user.id).all<ChatRow>();
  return c.json({ chats: rows.results.map((r) => toChat(r, user.id)) });
});

bond.post('/chats', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<{ userId?: string; groupId?: string; alias?: string; source?: string }>().catch(() => ({}) as Record<string, never>);
  let other = str(body.userId, 64);
  let source = 'bond';
  if (!other && body.groupId && body.alias) {
    other = (await memberBehindAlias(db, str(body.groupId, 64), user.id, str(body.alias, 60))) ?? '';
    source = 'circle';
  }
  if (!other || other === user.id) return c.json({ error: 'who do you want to talk to?' }, 400);
  const blocked = await db.prepare('SELECT 1 FROM blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)').bind(user.id, other, other, user.id).first();
  if (blocked) return c.json({ error: 'not possible' }, 400);
  const [a, b] = user.id < other ? [user.id, other] : [other, user.id];
  const existing = await db.prepare(`${CHAT_SELECT} WHERE c.a_user_id = ? AND c.b_user_id = ?`).bind(a, b).first<ChatRow>();
  if (existing) return c.json({ chat: toChat(existing, user.id) });
  // A new chat from a page or a friend list needs the other person's say-so and an accepted friendship. A table chat is covered by the circle.
  if (source === 'bond') {
    const them = await db.prepare('SELECT public_json FROM users WHERE id = ?').bind(other).first<{ public_json: string }>();
    if (!them || !publicOf(them).allowChats || !publicOf(them).pagePublic) return c.json({ error: 'this person is not taking chats' }, 403);
    const friends = await db.prepare("SELECT 1 FROM friendships WHERE status = 'accepted' AND ((requester_id = ?1 AND recipient_id = ?2) OR (requester_id = ?2 AND recipient_id = ?1))").bind(user.id, other).first();
    if (!friends) return c.json({ error: 'add them as a friend first' }, 403);
  }
  const id = newId();
  const [aliasA, aliasB] = aliasPair(id);
  await db.prepare('INSERT INTO bond_chats (id, a_user_id, b_user_id, a_alias, b_alias, source, created_at, last_message_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)').bind(id, a, b, aliasA, aliasB, source, nowIso()).run();
  await notify(db, other, 'bond', 'Someone opened a chat with you', 'Under an alias, from Bond. Say hello if you like.', `/bond/chats/${id}`);
  const row = await chatFor(db, id, user.id);
  return c.json({ chat: row ? toChat(row, user.id) : null }, 201);
});

bond.get('/chats/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await chatFor(db, c.req.param('id'), user.id);
  if (!row) return c.json({ error: 'not your chat' }, 404);
  const msgs = await db.prepare('SELECT id, user_id, body, created_at FROM bond_messages WHERE chat_id = ? ORDER BY created_at ASC LIMIT 300').bind(row.id).all<{ id: string; user_id: string; body: string; created_at: string }>();
  const chat = toChat(row, user.id);
  const messages: BondMessage[] = msgs.results.map((m) => ({ id: m.id, alias: m.user_id === user.id ? chat.myAlias : chat.theirAlias, body: m.body, mine: m.user_id === user.id, createdAt: m.created_at }));
  return c.json({ chat, messages });
});

bond.post('/chats/:id/messages', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await chatFor(db, c.req.param('id'), user.id);
  if (!row) return c.json({ error: 'not your chat' }, 404);
  const body = await c.req.json<{ body?: string }>().catch(() => ({}) as { body?: string });
  const text = str(body.body, 1000);
  if (!text) return c.json({ error: 'say something' }, 400);
  const now = nowIso();
  const id = newId();
  await db.batch([
    db.prepare('INSERT INTO bond_messages (id, chat_id, user_id, body, created_at) VALUES (?, ?, ?, ?, ?)').bind(id, row.id, user.id, text, now),
    db.prepare('UPDATE bond_chats SET last_message_at = ? WHERE id = ?').bind(now, row.id),
  ]);
  return c.json({ ok: true, id }, 201);
});
