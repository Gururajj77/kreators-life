import { Hono, type Context } from 'hono';
import { EVENT_APPS, MAX_EVENT_MESSAGE, MAX_REPLY_DEPTH, photoLinkProblem, threadOrder, type EventApp, type EventExtras, type EventMessage, type EventPerson } from '@kreators/shared';
import type { AppEnv, UserRow } from '../env';
import { anonAlias, can, nameOf, newId, notify, nowIso, publicOf, str } from '../db';
import { requestFriend } from './bond';

/**
 * Inside an event: the shared photo folder, the conversation, and the guests who said they would like to meet
 * others. It works the same for a Party event and a run (its guests are the club's members). Circles are
 * anonymous, so they have none of it. Anyone blocked either way never sees the other here.
 */
export const connect = new Hono<AppEnv>();

interface Ev {
  app: EventApp;
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  status: string;
  role: 'host' | 'guest' | null;
  /** Everyone to tell when the photos land. */
  guestIds: () => Promise<string[]>;
  path: string;
}

/** The event, and what this person is to it: its host (or events staff), a guest, or nobody. */
async function eventFor(db: D1Database, user: UserRow, appName: string, id: string): Promise<Ev | null> {
  if (!(EVENT_APPS as readonly string[]).includes(appName)) return null;
  const app = appName as EventApp;
  if (app === 'party') {
    const e = await db.prepare('SELECT id, title, host_user_id, starts_at, ends_at, status FROM events WHERE id = ?').bind(id).first<{ id: string; title: string; host_user_id: string; starts_at: string; ends_at: string; status: string }>();
    if (!e) return null;
    const reg = await db.prepare("SELECT status FROM event_registrations WHERE event_id = ? AND user_id = ? AND status IN ('registered','attended')").bind(id, user.id).first();
    const role = e.host_user_id === user.id || can(user, 'events') ? 'host' : reg ? 'guest' : null;
    return {
      app, id, title: e.title, startsAt: e.starts_at, endsAt: e.ends_at, status: e.status, role, path: `/party/${id}`,
      guestIds: async () => (await db.prepare("SELECT user_id FROM event_registrations WHERE event_id = ? AND status IN ('registered','attended') LIMIT 500").bind(id).all<{ user_id: string }>()).results.map((r) => r.user_id),
    };
  }
  const r = await db.prepare('SELECT r.id, r.title, r.starts_at, r.ends_at, r.status, r.club_id, c.host_user_id FROM runs r JOIN run_clubs c ON c.id = r.club_id WHERE r.id = ?').bind(id).first<{ id: string; title: string; starts_at: string; ends_at: string; status: string; club_id: string; host_user_id: string }>();
  if (!r) return null;
  const member = await db.prepare("SELECT 1 FROM run_members WHERE club_id = ? AND user_id = ? AND status = 'member'").bind(r.club_id, user.id).first();
  const role = r.host_user_id === user.id || can(user, 'events') ? 'host' : member ? 'guest' : null;
  return {
    app, id, title: r.title, startsAt: r.starts_at, endsAt: r.ends_at, status: r.status, role, path: '/run',
    guestIds: async () => (await db.prepare("SELECT user_id FROM run_members WHERE club_id = ? AND status = 'member' LIMIT 500").bind(r.club_id).all<{ user_id: string }>()).results.map((x) => x.user_id),
  };
}

/** The conversation stays open until a month after the event, so a thank-you or a lost scarf can still be sorted. */
const CHAT_DAYS_AFTER = 30;
const chatOpen = (ev: Ev, now = nowIso()) => ev.status !== 'cancelled' && now < new Date(new Date(ev.endsAt).getTime() + CHAT_DAYS_AFTER * 86_400_000).toISOString();

async function extrasFor(env: { CLICK_SALT?: string }, db: D1Database, user: UserRow, ev: Ev): Promise<EventExtras> {
  const now = nowIso();
  const photos = await db.prepare('SELECT url, note FROM event_photos WHERE app = ? AND event_id = ?').bind(ev.app, ev.id).first<{ url: string; note: string }>();
  const msgs = await db
    .prepare(
      `SELECT m.id, m.user_id, m.body, m.created_at, m.anonymous, m.parent_id, m.depth, u.display_name, u.handle FROM event_messages m JOIN users u ON u.id = m.user_id
       WHERE m.app = ?1 AND m.event_id = ?2 AND m.removed_by IS NULL
         AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = ?3 AND b.blocked_id = m.user_id) OR (b.blocker_id = m.user_id AND b.blocked_id = ?3))
       ORDER BY m.created_at DESC LIMIT 200`,
    )
    .bind(ev.app, ev.id, user.id)
    .all<{ id: string; user_id: string; body: string; created_at: string; anonymous: number; parent_id: string | null; depth: number; display_name: string; handle: string | null }>();
  const hostIds = new Set<string>();
  if (ev.app === 'party') {
    const h = await db.prepare('SELECT host_user_id FROM events WHERE id = ?').bind(ev.id).first<{ host_user_id: string }>();
    if (h) hostIds.add(h.host_user_id);
  } else {
    const h = await db.prepare('SELECT c.host_user_id FROM runs r JOIN run_clubs c ON c.id = r.club_id WHERE r.id = ?').bind(ev.id).first<{ host_user_id: string }>();
    if (h) hostIds.add(h.host_user_id);
  }
  // A line written anonymously carries a made-up name for this event and nothing that points at the person.
  const flat: EventMessage[] = await Promise.all(
    msgs.results.reverse().map(async (m): Promise<EventMessage> => {
      const anon = m.anonymous === 1;
      return {
        id: m.id,
        userId: anon ? '' : m.user_id,
        anonymous: anon,
        parentId: m.parent_id,
        depth: m.depth,
        name: anon ? await anonAlias(env, m.user_id, `${ev.app}:${ev.id}`) : nameOf(m),
        handle: anon ? null : m.handle,
        body: m.body,
        createdAt: m.created_at,
        mine: m.user_id === user.id,
        host: !anon && hostIds.has(m.user_id),
      };
    }),
  );
  const messages = threadOrder(flat);

  // People to meet: guests who said yes to being listed, who take friend requests, and nobody blocked either way.
  const listed = await db
    .prepare(
      `SELECT u.id, u.display_name, u.handle, u.public_json,
         (SELECT CASE WHEN f.status = 'accepted' THEN 'friends' WHEN f.requester_id = ?3 THEN 'sent' ELSE 'pending' END FROM friendships f WHERE (f.requester_id = ?3 AND f.recipient_id = u.id) OR (f.requester_id = u.id AND f.recipient_id = ?3) LIMIT 1) AS friend
       FROM users u
       WHERE u.id != ?3
         AND (EXISTS (SELECT 1 FROM event_networking n WHERE n.app = ?1 AND n.event_id = ?2 AND n.user_id = u.id)
              OR (?1 = 'party' AND EXISTS (SELECT 1 FROM event_registrations r WHERE r.event_id = ?2 AND r.user_id = u.id AND r.networking_opt_in = 1 AND r.status IN ('registered','attended'))))
         AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = ?3 AND b.blocked_id = u.id) OR (b.blocker_id = u.id AND b.blocked_id = ?3))
       ORDER BY u.display_name LIMIT 100`,
    )
    .bind(ev.app, ev.id, user.id)
    .all<{ id: string; display_name: string; handle: string | null; public_json: string; friend: EventPerson['friend'] | null }>();
  const people: EventPerson[] = listed.results.filter((u) => publicOf(u).allowFriendRequests).map((u) => ({ userId: u.id, name: nameOf(u), handle: u.handle, friend: u.friend ?? 'none' }));
  const me = await db
    .prepare(`SELECT 1 FROM event_networking WHERE app = ?1 AND event_id = ?2 AND user_id = ?3 UNION SELECT 1 FROM event_registrations WHERE ?1 = 'party' AND event_id = ?2 AND user_id = ?3 AND networking_opt_in = 1 AND status IN ('registered','attended')`)
    .bind(ev.app, ev.id, user.id)
    .first();
  return {
    role: ev.role ?? 'guest',
    started: ev.startsAt <= now,
    ended: ev.endsAt <= now,
    photos: photos ? { url: photos.url, note: photos.note } : null,
    messages,
    people,
    iAmListed: Boolean(me),
  };
}

async function guarded(c: Context<AppEnv>): Promise<{ ev: Ev } | { error: Response }> {
  const ev = await eventFor(c.env.DB, c.get('user'), c.req.param('app') ?? '', c.req.param('id') ?? '');
  if (!ev || !ev.role) return { error: c.json({ error: 'not found' }, 404) };
  return { ev };
}

connect.get('/:app/:id', async (c) => {
  const g = await guarded(c);
  if ('error' in g) return g.error;
  return c.json(await extrasFor(c.env, c.env.DB, c.get('user'), g.ev));
});

connect.post('/:app/:id/messages', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const g = await guarded(c);
  if ('error' in g) return g.error;
  if (!chatOpen(g.ev)) return c.json({ error: 'The conversation for this event is closed.' }, 409);
  const muted = await db.prepare('SELECT 1 FROM community_mutes WHERE user_id = ?').bind(user.id).first();
  if (muted) return c.json({ error: 'You are muted from conversations for now.' }, 403);
  const body = await c.req.json<{ body?: string; anonymous?: boolean; parentId?: string | null }>().catch(() => ({}) as { body?: string; anonymous?: boolean; parentId?: string | null });
  const text = str(body.body, MAX_EVENT_MESSAGE);
  if (!text) return c.json({ error: 'Write something first.' }, 400);
  // An answer sits under the line it answers; past the deepest level it lands beside it.
  let parentId: string | null = null;
  let depth = 0;
  if (typeof body.parentId === 'string' && body.parentId) {
    const parent = await db.prepare('SELECT id, parent_id, depth FROM event_messages WHERE id = ? AND app = ? AND event_id = ? AND removed_by IS NULL').bind(body.parentId, g.ev.app, g.ev.id).first<{ id: string; parent_id: string | null; depth: number }>();
    if (!parent) return c.json({ error: 'That line is gone.' }, 404);
    parentId = parent.depth >= MAX_REPLY_DEPTH ? parent.parent_id : parent.id;
    depth = Math.min(parent.depth + 1, MAX_REPLY_DEPTH);
  }
  await db.prepare('INSERT INTO event_messages (id, app, event_id, user_id, body, created_at, removed_by, anonymous, parent_id, depth) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)').bind(newId(), g.ev.app, g.ev.id, user.id, text, nowIso(), body.anonymous === true ? 1 : 0, parentId, depth).run();
  return c.json({ ok: true }, 201);
});

// A line comes down when its author asks, or when the host or events staff do.
connect.delete('/:app/:id/messages/:mid', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const g = await guarded(c);
  if ('error' in g) return g.error;
  const row = await db.prepare('SELECT user_id FROM event_messages WHERE id = ? AND app = ? AND event_id = ? AND removed_by IS NULL').bind(c.req.param('mid'), g.ev.app, g.ev.id).first<{ user_id: string }>();
  if (!row) return c.json({ error: 'not found' }, 404);
  if (row.user_id !== user.id && g.ev.role !== 'host') return c.json({ error: 'only its author or the host can take a line down' }, 403);
  await db.prepare('UPDATE event_messages SET removed_by = ? WHERE id = ?').bind(user.id, c.req.param('mid')).run();
  return c.json({ ok: true });
});

// The host's shared folder of pictures: a link on a known service, set any time and changed whenever.
connect.put('/:app/:id/photos', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const g = await guarded(c);
  if ('error' in g) return g.error;
  if (g.ev.role !== 'host') return c.json({ error: 'only the host can share the photos' }, 403);
  const body = await c.req.json<{ url?: string; note?: string }>().catch(() => ({}) as { url?: string; note?: string });
  const bad = photoLinkProblem(body.url);
  if (bad) return c.json({ error: bad }, 400);
  const url = str(body.url, 500);
  const prev = await db.prepare('SELECT url FROM event_photos WHERE app = ? AND event_id = ?').bind(g.ev.app, g.ev.id).first<{ url: string }>();
  await db
    .prepare('INSERT INTO event_photos (app, event_id, url, note, set_by, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (app, event_id) DO UPDATE SET url = excluded.url, note = excluded.note, set_by = excluded.set_by, updated_at = excluded.updated_at')
    .bind(g.ev.app, g.ev.id, url, str(body.note, 200), user.id, nowIso())
    .run();
  // Everyone on the list hears once when the folder first appears, and again if the link changes.
  if (!prev || prev.url !== url) for (const gid of (await g.ev.guestIds()).filter((x) => x !== user.id)) await notify(db, gid, g.ev.app, `Photos from ${g.ev.title}`, 'The host shared a folder. Open the event to get yours.', g.ev.path);
  return c.json({ ok: true });
});

connect.delete('/:app/:id/photos', async (c) => {
  const g = await guarded(c);
  if ('error' in g) return g.error;
  if (g.ev.role !== 'host') return c.json({ error: 'only the host can take the photos down' }, 403);
  await c.env.DB.prepare('DELETE FROM event_photos WHERE app = ? AND event_id = ?').bind(g.ev.app, g.ev.id).run();
  return c.json({ ok: true });
});

// A guest chooses to be on the list of people to meet, or steps off it.
connect.put('/:app/:id/networking', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const g = await guarded(c);
  if ('error' in g) return g.error;
  const body = await c.req.json<{ on?: boolean }>().catch(() => ({}) as { on?: boolean });
  const batch = [db.prepare('DELETE FROM event_networking WHERE app = ? AND event_id = ? AND user_id = ?').bind(g.ev.app, g.ev.id, user.id)];
  if (g.ev.app === 'party') batch.push(db.prepare('UPDATE event_registrations SET networking_opt_in = ? WHERE event_id = ? AND user_id = ?').bind(body.on ? 1 : 0, g.ev.id, user.id));
  if (body.on) batch.push(db.prepare('INSERT INTO event_networking (app, event_id, user_id, created_at) VALUES (?, ?, ?, ?)').bind(g.ev.app, g.ev.id, user.id, nowIso()));
  await db.batch(batch);
  return c.json({ ok: true });
});

// Ask someone from the list to be friends. Only people on that list, and only a guest or the host can ask.
connect.post('/:app/:id/people/:userId/connect', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const g = await guarded(c);
  if ('error' in g) return g.error;
  const target = c.req.param('userId');
  const extras = await extrasFor(c.env, db, user, g.ev);
  if (!extras.people.some((p) => p.userId === target)) return c.json({ error: 'that person is not on the list' }, 404);
  const r = await requestFriend(db, user, target, g.ev.title);
  return c.json(r.body, r.code as 400);
});
