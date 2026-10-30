import { Hono } from 'hono';
import { MAX_MEDIA_CAPTION, MAX_MEDIA_ITEMS, MAX_UPLOAD_BYTES, MEDIA_OWNERS, mediaFromLink, OWN_MEDIA_PREFIX, UPLOAD_TYPES, type MediaItem, type MediaOwner } from '@kreators/shared';
import type { AppEnv, UserRow } from '../env';
import { audit, can, newId, nowIso, orgRole, str } from '../db';

/**
 * Pictures, GIFs and videos on listings and lessons. Uploaded files are small (the browser shrinks
 * pictures first) and live in the database; videos are always links. One table, `media_items`,
 * serves every app, and `canEditMedia` says who may change a given owner's set.
 */
export const mediaPublic = new Hono<AppEnv>();
export const media = new Hono<AppEnv>();

/** The most files one person keeps. A file nobody uses any more is cleaned out by `tidyMedia`. */
const MAX_FILES_PER_PERSON = 60;

const isOwner = (t: string): t is MediaOwner => (MEDIA_OWNERS as readonly string[]).includes(t);

/** Base64 of some bytes, in slices so a big file cannot overflow the call stack. */
function toBase64(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Does the file's first bytes say what the header says? A file is only served as the type it really is. */
function looksLike(mime: string, b: Uint8Array): boolean {
  const at = (s: string, off = 0) => [...s].every((ch, i) => b[off + i] === ch.charCodeAt(0));
  if (mime === 'image/jpeg') return b[0] === 0xff && b[1] === 0xd8;
  if (mime === 'image/png') return b[0] === 0x89 && at('PNG', 1);
  if (mime === 'image/gif') return at('GIF8');
  if (mime === 'image/webp') return at('RIFF') && at('WEBP', 8);
  if (mime === 'image/avif') return at('ftyp', 4);
  return false;
}

// ---- public: the file itself and what a public listing shows
mediaPublic.get('/for/:type/:id', async (c) => {
  const type = c.req.param('type');
  // A lesson's media is for the people in its program, so it is only read after sign-in.
  if (!isOwner(type) || type === 'lesson') return c.json({ items: [] });
  return c.json({ items: await itemsOf(c.env.DB, type, c.req.param('id')) });
});

mediaPublic.get('/:id', async (c) => {
  const row = await c.env.DB.prepare('SELECT mime, data FROM media_files WHERE id = ?').bind(c.req.param('id')).first<{ mime: string; data: string }>();
  if (!row) return c.json({ error: 'not found' }, 404);
  const bin = atob(row.data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Response(bytes, { headers: { 'Content-Type': row.mime, 'Cache-Control': 'public, max-age=31536000, immutable', 'Content-Disposition': 'inline', 'X-Content-Type-Options': 'nosniff' } });
});

export async function itemsOf(db: D1Database, type: MediaOwner, id: string): Promise<MediaItem[]> {
  const rows = await db.prepare('SELECT id, kind, url, caption FROM media_items WHERE owner_type = ? AND owner_id = ? ORDER BY position, created_at').bind(type, id).all<{ id: string; kind: MediaItem['kind']; url: string; caption: string }>();
  return rows.results.map((r) => ({ id: r.id, kind: r.kind, url: r.url, caption: r.caption }));
}

/** The media for many listings at once, by id, for the cards. Chunked: a query takes at most 100 values. */
export async function mediaForListings(db: D1Database, items: { type: MediaOwner; id: string }[]): Promise<Map<string, MediaItem[]>> {
  const out = new Map<string, MediaItem[]>();
  for (let i = 0; i < items.length; i += 80) {
    const chunk = items.slice(i, i + 80);
    if (chunk.length === 0) continue;
    const rows = await db
      .prepare(`SELECT owner_type, owner_id, id, kind, url, caption FROM media_items WHERE owner_id IN (${chunk.map(() => '?').join(',')}) ORDER BY position, created_at`)
      .bind(...chunk.map((x) => x.id))
      .all<{ owner_type: string; owner_id: string; id: string; kind: MediaItem['kind']; url: string; caption: string }>();
    for (const r of rows.results) {
      const key = `${r.owner_type}:${r.owner_id}`;
      out.set(key, [...(out.get(key) ?? []), { id: r.id, kind: r.kind, url: r.url, caption: r.caption }]);
    }
  }
  return out;
}

/** Who may change the media on this owner: the person who made it, their organization, or the staff whose area it is. */
export async function canEditMedia(db: D1Database, user: UserRow, type: MediaOwner, id: string): Promise<boolean> {
  const first = async <T>(sql: string) => db.prepare(sql).bind(id).first<T>();
  if (user.role === 'admin') return true;
  switch (type) {
    case 'reward': {
      const r = await first<{ created_by: string; organization_id: string | null }>('SELECT created_by, organization_id FROM bounties WHERE id = ?');
      return Boolean(r && (r.created_by === user.id || can(user, 'review') || can(user, 'talent') || (r.organization_id && (await orgRole(db, r.organization_id, user.id)))));
    }
    case 'opportunity': {
      const r = await first<{ created_by: string; organization_id: string | null }>('SELECT created_by, organization_id FROM opportunities WHERE id = ?');
      return Boolean(r && (r.created_by === user.id || can(user, 'talent') || (r.organization_id && (await orgRole(db, r.organization_id, user.id)))));
    }
    case 'event': {
      const r = await first<{ host_user_id: string }>('SELECT host_user_id FROM events WHERE id = ?');
      return Boolean(r && (r.host_user_id === user.id || can(user, 'events')));
    }
    case 'circle': {
      const r = await first<{ created_by: string | null }>('SELECT created_by FROM circle_events WHERE id = ?');
      return Boolean(r && (r.created_by === user.id || can(user, 'events')));
    }
    case 'program': {
      const r = await first<{ created_by: string | null }>('SELECT created_by FROM programs WHERE id = ?');
      return Boolean(r && (r.created_by === user.id || can(user, 'cohorts')));
    }
    case 'lesson': {
      const r = await first<{ created_by: string | null }>('SELECT p.created_by FROM learning_items i JOIN programs p ON p.id = i.program_id WHERE i.id = ?');
      return Boolean(r && (r.created_by === user.id || can(user, 'cohorts')));
    }
    case 'campaign': {
      const r = await first<{ owner_user_id: string | null; organization_id: string }>('SELECT owner_user_id, organization_id FROM campaigns WHERE id = ?');
      return Boolean(r && (r.owner_user_id === user.id || can(user, 'talent') || (await orgRole(db, r.organization_id, user.id))));
    }
    case 'tool':
      return user.role === 'sub_admin' && Boolean(await first<{ id: string }>('SELECT id FROM tools WHERE id = ?'));
  }
}

// ---- signed in
media.post('/upload', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const mime = (c.req.header('Content-Type') ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
  if (!(UPLOAD_TYPES as readonly string[]).includes(mime)) return c.json({ error: 'Upload a JPEG, PNG, WebP, AVIF or GIF. Link a video instead.' }, 415);
  const declared = Number(c.req.header('Content-Length') ?? 0);
  if (declared > MAX_UPLOAD_BYTES) return c.json({ error: 'That file is too big. Keep it under 1 MB, or paste a link.' }, 413);
  const data = await c.req.arrayBuffer();
  if (data.byteLength === 0) return c.json({ error: 'That file is empty.' }, 400);
  if (data.byteLength > MAX_UPLOAD_BYTES) return c.json({ error: 'That file is too big. Keep it under 1 MB, or paste a link.' }, 413);
  if (!looksLike(mime, new Uint8Array(data.slice(0, 16)))) return c.json({ error: 'That file is not the kind of picture it says it is.' }, 400);
  const count = await db.prepare('SELECT COUNT(*) AS n FROM media_files WHERE owner_id = ?').bind(user.id).first<{ n: number }>();
  if ((count?.n ?? 0) >= MAX_FILES_PER_PERSON) return c.json({ error: 'You have reached the most uploads. Remove a picture you no longer use first.' }, 429);
  const id = newId();
  await db.prepare('INSERT INTO media_files (id, owner_id, mime, size, data, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(id, user.id, mime, data.byteLength, toBase64(new Uint8Array(data)), nowIso()).run();
  return c.json({ id, url: `${OWN_MEDIA_PREFIX}${id}`, kind: mime === 'image/gif' ? 'gif' : 'image' }, 201);
});

media.get('/for/:type/:id', async (c) => {
  const type = c.req.param('type');
  const id = c.req.param('id');
  if (!isOwner(type)) return c.json({ error: 'not found' }, 404);
  return c.json({ items: await itemsOf(c.env.DB, type, id), canEdit: await canEditMedia(c.env.DB, c.get('user'), type, id), max: MAX_MEDIA_ITEMS });
});

// Replace the whole set: what is sent is what stays, in that order.
media.put('/for/:type/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const type = c.req.param('type');
  const id = c.req.param('id');
  if (!isOwner(type)) return c.json({ error: 'not found' }, 404);
  if (!(await canEditMedia(db, user, type, id))) return c.json({ error: 'only the person who made this can change its pictures and videos' }, 403);
  const body = await c.req.json<{ items?: { url?: unknown; caption?: unknown }[] }>().catch(() => ({}) as { items?: { url?: unknown; caption?: unknown }[] });
  if (!Array.isArray(body.items)) return c.json({ error: 'send items' }, 400);
  if (body.items.length > MAX_MEDIA_ITEMS) return c.json({ error: `At most ${MAX_MEDIA_ITEMS} pictures and videos.` }, 400);
  const before = await itemsOf(db, type, id);
  const keep = new Set(before.map((b) => b.url));
  const rows: { kind: MediaItem['kind']; url: string; caption: string }[] = [];
  for (const raw of body.items) {
    const link = typeof raw.url === 'string' ? mediaFromLink(raw.url) : null;
    if (!link) return c.json({ error: 'A picture or video link starts with https. A video can be YouTube, Vimeo or a direct .mp4 link.' }, 400);
    if (link.url.startsWith(OWN_MEDIA_PREFIX) && !keep.has(link.url)) {
      // A file that is new to this owner has to be one the person uploaded themselves.
      const file = await db.prepare('SELECT mime FROM media_files WHERE id = ? AND owner_id = ?').bind(link.url.slice(OWN_MEDIA_PREFIX.length), user.id).first<{ mime: string }>();
      if (!file) return c.json({ error: 'That uploaded file is not yours.' }, 403);
      rows.push({ kind: file.mime === 'image/gif' ? 'gif' : 'image', url: link.url, caption: str(raw.caption, MAX_MEDIA_CAPTION) });
    } else {
      rows.push({ kind: link.kind, url: link.url, caption: str(raw.caption, MAX_MEDIA_CAPTION) });
    }
  }
  const now = nowIso();
  await db.batch([
    db.prepare('DELETE FROM media_items WHERE owner_type = ? AND owner_id = ?').bind(type, id),
    ...rows.map((r, i) => db.prepare('INSERT INTO media_items (id, owner_type, owner_id, kind, url, caption, position, added_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(newId(), type, id, r.kind, r.url, r.caption, i, user.id, now)),
  ]);
  if (user.role !== 'user') await audit(db, user.id, 'media.set', type, id, `${before.length} items`, `${rows.length} items`);
  return c.json({ items: await itemsOf(db, type, id) });
});
