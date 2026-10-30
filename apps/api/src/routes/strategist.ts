import { Hono } from 'hono';
import { BRAND_NAME_MAX, BRAND_SOURCE_KINDS, BRIEF_MAX, MAX_BRANDS, MAX_BRAND_SOURCES, PIECE_KINDS, RESEARCH_KINDS, sourceKindOf, type Brand, type BrandDetail, type BrandPiece, type BrandSource, type PieceKind, type ResearchItem, type ResearchKind, type ResearchRun } from '@kreators/shared';
import type { AppEnv } from '../env';
import { newId, nowIso, num, oneOf, pageOf, paged, str } from '../db';
import { reachConnected, readLink, research } from '../reach';
import type { Env } from '../env';
import { titleFor, write, writerFor, type Context } from '../strategist';

/** Content as a strategist: one folder per brand, its sources, the research runs and the pieces written from them. */
export const strategist = new Hono<AppEnv>();

interface BrandRow { id: string; owner_id: string; name: string; niche: string; description: string; voice: string; created_at: string; updated_at: string; sources: number; runs: number; pieces: number }
interface SourceRow { id: string; brand_id: string; kind: BrandSource['kind']; url: string; label: string; summary: string; meta_json: string; last_read_at: string | null; created_at: string }
interface RunRow { id: string; brand_id: string; kind: ResearchKind; query: string; status: 'done' | 'failed'; backend: string; items_json: string; error: string; created_at: string }
interface PieceRow { id: string; brand_id: string; kind: PieceKind; title: string; brief: string; body: string; sources_json: string; writer: string; status: 'draft' | 'kept'; created_at: string; updated_at: string }

const BRAND_SELECT = `SELECT b.*,
  (SELECT COUNT(*) FROM brand_sources s WHERE s.brand_id = b.id) AS sources,
  (SELECT COUNT(*) FROM research_runs r WHERE r.brand_id = b.id) AS runs,
  (SELECT COUNT(*) FROM brand_pieces p WHERE p.brand_id = b.id) AS pieces
  FROM brands b`;
const json = <T,>(s: string, fallback: T): T => {
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
};
const toBrand = (r: BrandRow): Brand => ({ id: r.id, name: r.name, niche: r.niche, description: r.description, voice: r.voice, sources: r.sources, runs: r.runs, pieces: r.pieces, createdAt: r.created_at, updatedAt: r.updated_at });
const toSource = (r: SourceRow): BrandSource => ({ id: r.id, kind: r.kind, url: r.url, label: r.label, summary: r.summary, meta: json(r.meta_json, {}), lastReadAt: r.last_read_at, createdAt: r.created_at });
const toRun = (r: RunRow): ResearchRun => ({ id: r.id, kind: r.kind, query: r.query, status: r.status, backend: r.backend, items: json<ResearchItem[]>(r.items_json, []), error: r.error, createdAt: r.created_at });
const toPiece = (r: PieceRow): BrandPiece => ({ id: r.id, kind: r.kind, title: r.title, brief: r.brief, body: r.body, sources: json<string[]>(r.sources_json, []), writer: r.writer, status: r.status, createdAt: r.created_at, updatedAt: r.updated_at });

async function mine(db: D1Database, userId: string, id: string): Promise<BrandRow | null> {
  return db.prepare(`${BRAND_SELECT} WHERE b.id = ? AND b.owner_id = ?`).bind(id, userId).first<BrandRow>();
}
const touch = (db: D1Database, id: string) => db.prepare('UPDATE brands SET updated_at = ? WHERE id = ?').bind(nowIso(), id).run();
const httpsOnly = (u: string) => /^https?:\/\/[^\s]+$/i.test(u);

strategist.get('/brands', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const ask = pageOf(c);
  const rows = await db.prepare(`${BRAND_SELECT} WHERE b.owner_id = ? ORDER BY b.updated_at DESC LIMIT ? OFFSET ?`).bind(user.id, ask.limit, ask.offset).all<BrandRow>();
  const pg = paged(rows.results, ask);
  return c.json({ page: pg.page, brands: pg.items.map(toBrand), tools: { reach: reachConnected(c.env), writer: writerFor(c.env) } });
});

strategist.post('/brands', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const name = str(body.name, BRAND_NAME_MAX);
  if (!name) return c.json({ error: 'name the brand' }, 400);
  const count = await db.prepare('SELECT COUNT(*) AS n FROM brands WHERE owner_id = ?').bind(user.id).first<{ n: number }>();
  if ((count?.n ?? 0) >= MAX_BRANDS) return c.json({ error: `that is ${MAX_BRANDS} brands already; remove one first` }, 400);
  const id = newId();
  const now = nowIso();
  await db.prepare('INSERT INTO brands (id, owner_id, name, niche, description, voice, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(id, user.id, name, str(body.niche, 120), str(body.description, 2000), str(body.voice, 1000), now, now).run();
  const row = await mine(db, user.id, id);
  return c.json({ brand: row ? toBrand(row) : null }, 201);
});

strategist.get('/brands/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await mine(db, user.id, c.req.param('id'));
  if (!row) return c.json({ error: 'not found' }, 404);
  const ask = pageOf(c);
  const [sources, runs, pieces, runCounts, pieceCounts] = await Promise.all([
    db.prepare('SELECT * FROM brand_sources WHERE brand_id = ? ORDER BY created_at').bind(row.id).all<SourceRow>(),
    db.prepare('SELECT * FROM research_runs WHERE brand_id = ? ORDER BY created_at DESC LIMIT 40').bind(row.id).all<RunRow>(),
    db.prepare('SELECT * FROM brand_pieces WHERE brand_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?').bind(row.id, ask.limit, ask.offset).all<PieceRow>(),
    db.prepare("SELECT kind, COUNT(*) AS n FROM research_runs WHERE brand_id = ? AND status = 'done' GROUP BY kind").bind(row.id).all<{ kind: string; n: number }>(),
    db.prepare('SELECT kind, COUNT(*) AS n FROM brand_pieces WHERE brand_id = ? GROUP BY kind').bind(row.id).all<{ kind: string; n: number }>(),
  ]);
  const pg = paged(pieces.results, ask);
  const res: BrandDetail = {
    brand: toBrand(row),
    sources: sources.results.map(toSource),
    runs: runs.results.map(toRun),
    pieces: pg.items.map(toPiece),
    page: pg.page,
    tools: { reach: reachConnected(c.env), writer: writerFor(c.env) },
    counts: { runs: Object.fromEntries(runCounts.results.map((r) => [r.kind, r.n])), pieces: Object.fromEntries(pieceCounts.results.map((r) => [r.kind, r.n])) },
  };
  return c.json(res);
});

strategist.patch('/brands/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await mine(db, user.id, c.req.param('id'));
  if (!row) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  await db
    .prepare('UPDATE brands SET name = ?, niche = ?, description = ?, voice = ?, updated_at = ? WHERE id = ?')
    .bind(str(body.name, BRAND_NAME_MAX, row.name) || row.name, str(body.niche, 120, row.niche), str(body.description, 2000, row.description), str(body.voice, 1000, row.voice), nowIso(), row.id)
    .run();
  const fresh = await mine(db, user.id, row.id);
  return c.json({ brand: fresh ? toBrand(fresh) : null });
});

strategist.delete('/brands/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await mine(db, user.id, c.req.param('id'));
  if (!row) return c.json({ error: 'not found' }, 404);
  await db.batch([
    db.prepare('DELETE FROM brand_pieces WHERE brand_id = ?').bind(row.id),
    db.prepare('DELETE FROM research_runs WHERE brand_id = ?').bind(row.id),
    db.prepare('DELETE FROM brand_sources WHERE brand_id = ?').bind(row.id),
    db.prepare('DELETE FROM brands WHERE id = ?').bind(row.id),
  ]);
  return c.json({ ok: true });
});

// ---- sources: the links a brand is fed
strategist.post('/brands/:id/sources', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await mine(db, user.id, c.req.param('id'));
  if (!row) return c.json({ error: 'not found' }, 404);
  if (row.sources >= MAX_BRAND_SOURCES) return c.json({ error: `that is ${MAX_BRAND_SOURCES} links already` }, 400);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const url = str(body.url, 500);
  if (!httpsOnly(url)) return c.json({ error: 'a link that starts with https://' }, 400);
  const kind = oneOf(body.kind, BRAND_SOURCE_KINDS, sourceKindOf(url));
  const id = newId();
  await db.prepare("INSERT INTO brand_sources (id, brand_id, kind, url, label, summary, meta_json, last_read_at, created_at) VALUES (?, ?, ?, ?, ?, '', '{}', NULL, ?)").bind(id, row.id, kind, url, str(body.label, 120), nowIso()).run();
  await touch(db, row.id);
  const s = await db.prepare('SELECT * FROM brand_sources WHERE id = ?').bind(id).first<SourceRow>();
  return c.json({ source: s ? toSource(s) : null }, 201);
});

strategist.delete('/brands/:id/sources/:sid', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await mine(db, user.id, c.req.param('id'));
  if (!row) return c.json({ error: 'not found' }, 404);
  await db.prepare('DELETE FROM brand_sources WHERE id = ? AND brand_id = ?').bind(c.req.param('sid'), row.id).run();
  return c.json({ ok: true });
});

/** Read a source: what the page, channel or post says, kept as a run and summarised on the source. */
strategist.post('/brands/:id/sources/:sid/read', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await mine(db, user.id, c.req.param('id'));
  if (!row) return c.json({ error: 'not found' }, 404);
  const s = await db.prepare('SELECT * FROM brand_sources WHERE id = ? AND brand_id = ?').bind(c.req.param('sid'), row.id).first<SourceRow>();
  if (!s) return c.json({ error: 'not found' }, 404);
  const r = await readLink(c.env, s.url);
  const id = newId();
  const now = nowIso();
  const first = r.items[0];
  await db.batch([
    db.prepare('INSERT INTO research_runs (id, brand_id, kind, query, status, backend, items_json, error, created_at, finished_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, row.id, 'read', s.url, r.ok ? 'done' : 'failed', r.backend, JSON.stringify(r.items), r.error, now, now),
    ...(r.ok && first ? [db.prepare('UPDATE brand_sources SET summary = ?, meta_json = ?, last_read_at = ?, label = CASE WHEN label = \'\' THEN ? ELSE label END WHERE id = ?').bind(first.text.slice(0, 600), JSON.stringify(first.stats), now, first.title.slice(0, 120), s.id)] : []),
  ]);
  await touch(db, row.id);
  const run = await db.prepare('SELECT * FROM research_runs WHERE id = ?').bind(id).first<RunRow>();
  const fresh = await db.prepare('SELECT * FROM brand_sources WHERE id = ?').bind(s.id).first<SourceRow>();
  return c.json({ run: run ? toRun(run) : null, source: fresh ? toSource(fresh) : null }, r.ok ? 201 : 200);
});

// ---- research runs: searches, outliers, transcripts, profiles
strategist.post('/brands/:id/research', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await mine(db, user.id, c.req.param('id'));
  if (!row) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const kind = oneOf(body.kind, RESEARCH_KINDS, 'search');
  const query = str(body.query, 500);
  if (!query) return c.json({ error: kind === 'read' || kind === 'transcript' || kind === 'profile' ? 'a link' : 'what to look for' }, 400);
  const r = await research(c.env, kind, query, num(body.limit, 10, 1, 25) ?? 10);
  const id = newId();
  const now = nowIso();
  await db.prepare('INSERT INTO research_runs (id, brand_id, kind, query, status, backend, items_json, error, created_at, finished_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, row.id, kind, query, r.ok ? 'done' : 'failed', r.backend, JSON.stringify(r.items), r.error, now, now).run();
  await touch(db, row.id);
  const run = await db.prepare('SELECT * FROM research_runs WHERE id = ?').bind(id).first<RunRow>();
  return c.json({ run: run ? toRun(run) : null }, r.ok ? 201 : 200);
});

strategist.delete('/brands/:id/runs/:rid', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await mine(db, user.id, c.req.param('id'));
  if (!row) return c.json({ error: 'not found' }, 404);
  await db.prepare('DELETE FROM research_runs WHERE id = ? AND brand_id = ?').bind(c.req.param('rid'), row.id).run();
  return c.json({ ok: true });
});

// ---- pieces: what the strategist writes
strategist.post('/brands/:id/pieces', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await mine(db, user.id, c.req.param('id'));
  if (!row) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const kind = oneOf(body.kind, PIECE_KINDS, 'ideas');
  const brief = str(body.brief, BRIEF_MAX);
  const runIds = (Array.isArray(body.runIds) ? body.runIds : []).filter((x): x is string => typeof x === 'string').slice(0, 20);
  // Research first, unless told not to: unread links get read, and the niche and the brief get searched
  // through Agent Reach (or the YouTube key), so the writer never works from an empty folder.
  const researched = body.research === false ? [] : await autoResearch(db, c.env, row, brief);
  runIds.push(...researched);
  const [sources, runs] = await Promise.all([
    db.prepare('SELECT * FROM brand_sources WHERE brand_id = ? ORDER BY created_at').bind(row.id).all<SourceRow>(),
    runIds.length
      ? db.prepare(`SELECT * FROM research_runs WHERE brand_id = ? AND status = 'done' AND id IN (${runIds.map(() => '?').join(',')})`).bind(row.id, ...runIds).all<RunRow>()
      : db.prepare("SELECT * FROM research_runs WHERE brand_id = ? AND status = 'done' ORDER BY created_at DESC LIMIT 8").bind(row.id).all<RunRow>(),
  ]);
  const ctx: Context = {
    brand: { name: row.name, niche: row.niche, description: row.description, voice: row.voice },
    sources: sources.results.map((s) => ({ label: s.label, url: s.url, summary: s.summary })),
    runs: runs.results.map((r) => ({ kind: r.kind, query: r.query, items: json<ResearchItem[]>(r.items_json, []) })),
  };
  let out: { body: string; writer: string };
  try {
    out = await write(c.env, kind, brief, ctx);
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : 'the writer did not answer' }, 502);
  }
  const id = newId();
  const now = nowIso();
  await db.prepare("INSERT INTO brand_pieces (id, brand_id, kind, title, brief, body, sources_json, writer, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)").bind(id, row.id, kind, titleFor(kind, brief, row.name), brief, out.body, JSON.stringify(runs.results.map((r) => r.id)), out.writer, now, now).run();
  await touch(db, row.id);
  const p = await db.prepare('SELECT * FROM brand_pieces WHERE id = ?').bind(id).first<PieceRow>();
  return c.json({ piece: p ? toPiece(p) : null }, 201);
});

strategist.patch('/brands/:id/pieces/:pid', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await mine(db, user.id, c.req.param('id'));
  if (!row) return c.json({ error: 'not found' }, 404);
  const p = await db.prepare('SELECT * FROM brand_pieces WHERE id = ? AND brand_id = ?').bind(c.req.param('pid'), row.id).first<PieceRow>();
  if (!p) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  await db
    .prepare('UPDATE brand_pieces SET title = ?, body = ?, status = ?, updated_at = ? WHERE id = ?')
    .bind(str(body.title, 160, p.title) || p.title, str(body.body, 60_000, p.body) || p.body, oneOf(body.status, ['draft', 'kept'] as const, p.status), nowIso(), p.id)
    .run();
  const fresh = await db.prepare('SELECT * FROM brand_pieces WHERE id = ?').bind(p.id).first<PieceRow>();
  return c.json({ piece: fresh ? toPiece(fresh) : null });
});

strategist.delete('/brands/:id/pieces/:pid', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await mine(db, user.id, c.req.param('id'));
  if (!row) return c.json({ error: 'not found' }, 404);
  await db.prepare('DELETE FROM brand_pieces WHERE id = ? AND brand_id = ?').bind(c.req.param('pid'), row.id).run();
  return c.json({ ok: true });
});

/** What a strategist would look up before writing: the brand's own links, outliers in its niche, and the brief. */
async function autoResearch(db: D1Database, env: Env, brand: BrandRow, brief: string): Promise<string[]> {
  const ids: string[] = [];
  const keep = async (kind: ResearchKind, query: string, r: Awaited<ReturnType<typeof research>>) => {
    const id = newId();
    const now = nowIso();
    await db.prepare('INSERT INTO research_runs (id, brand_id, kind, query, status, backend, items_json, error, created_at, finished_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, brand.id, kind, query, r.ok ? 'done' : 'failed', r.backend, JSON.stringify(r.items), r.error, now, now).run();
    if (r.ok) ids.push(id);
  };
  const unread = await db.prepare('SELECT * FROM brand_sources WHERE brand_id = ? AND last_read_at IS NULL ORDER BY created_at LIMIT 3').bind(brand.id).all<SourceRow>();
  for (const s of unread.results) {
    const r = await readLink(env, s.url);
    await keep('read', s.url, r);
    const first = r.items[0];
    if (r.ok && first) await db.prepare("UPDATE brand_sources SET summary = ?, meta_json = ?, last_read_at = ?, label = CASE WHEN label = '' THEN ? ELSE label END WHERE id = ?").bind(first.text.slice(0, 600), JSON.stringify(first.stats), nowIso(), first.title.slice(0, 120), s.id).run();
  }
  const topic = [brand.niche, brief.split('\n')[0]?.slice(0, 80)].filter(Boolean).join(' ').trim() || brand.name;
  const recent = await db.prepare("SELECT kind, query FROM research_runs WHERE brand_id = ? AND status = 'done' AND created_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 day')").bind(brand.id).all<{ kind: string; query: string }>();
  const have = new Set(recent.results.map((r) => `${r.kind}:${r.query}`));
  const wanted: [ResearchKind, string][] = [['outliers', brand.niche || topic], ...(reachConnected(env) ? ([['search', topic]] as [ResearchKind, string][]) : [])];
  for (const [kind, query] of wanted) {
    if (have.has(`${kind}:${query}`)) continue;
    await keep(kind, query, await research(env, kind, query, 10));
  }
  return ids;
}
