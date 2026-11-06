import {
  isRelationshipKey,
  blockColorOf,
  minuteOf,
  overrideTemplateId,
  parseLifeArea,
  slotOrder,
  STARTING_BLOCKS,
  STARTING_TEMPLATES,
  templateForDate,
  addDays,
  dayTypeOf,
  DEFAULT_ZONE,
  kindsOfDays,
  localStamp,
  templateColor,
  type BlockColor,
  type KindsOfDays,
  type DayPlan,
  type DayTemplate,
  type RelationshipKey,
  type TemplateSlot,
  type TimeBlock,
} from '@kreators/shared';
import { nowIso } from './db';

// Time blocks, day templates and the weekly pattern on the server (docs/time-blocks.md). Every read and write is the person's own.
// The starting set is added once per person (`ensureTimeBlocks`) with fixed ids, so two first reads at once add it once.

export interface TimeBlockRow {
  id: string;
  user_id: string;
  seed: string | null;
  name: string;
  tag: string;
  color: string;
  life_area: string | null;
  relationship: string | null;
  sort: number;
  created_at: string;
  updated_at: string;
}
export interface DayTemplateRow {
  id: string;
  user_id: string;
  seed: string | null;
  source_kind: string | null;
  name: string;
  lead: string;
  second: string | null;
  why: string | null;
  source: string | null;
  is_default: number;
  sort: number;
  /** Its own colour (migration 0098): a swatch key or a person's own "#rrggbb"; NULL falls back to its longest block's. */
  color?: string | null;
  created_at: string;
  updated_at: string;
}
interface SlotRow {
  template_id: string;
  block_id: string;
  start_min: number;
  end_min: number;
}

export const seededBlockId = (seed: string, userId: string) => `b-${seed}-${userId}`;
export const seededTemplateId = (seed: string, userId: string) => `t-${seed}-${userId}`;

export function toTimeBlock(r: TimeBlockRow): TimeBlock {
  return {
    id: r.id,
    seed: r.seed,
    name: r.name,
    tag: r.tag ?? '',
    color: blockColorOf(r.color) ?? 'slate',
    area: parseLifeArea(r.life_area),
    pillar: isRelationshipKey(r.relationship) ? r.relationship : null,
    sort: r.sort,
  };
}
export function toDayTemplate(r: DayTemplateRow, slots: TemplateSlot[]): DayTemplate {
  return {
    id: r.id,
    seed: r.seed,
    sourceKind: dayTypeOf(r.source_kind)?.key ?? null,
    name: r.name,
    lead: isRelationshipKey(r.lead) ? r.lead : 'self',
    second: isRelationshipKey(r.second) ? r.second : null,
    why: r.why,
    source: r.source,
    isDefault: r.is_default === 1,
    sort: r.sort,
    color: blockColorOf(r.color),
    slots: slotOrder(slots),
  };
}

/** The statements that add the starting blocks and templates (only the seeds asked for), each one statement over a JSON list. */
function seedStatements(db: D1Database, userId: string, blockSeeds: ReadonlySet<string>, templateSeeds: ReadonlySet<string>, opts: { allowDefault: boolean; blockSortFrom: number; templateSortFrom: number }): D1PreparedStatement[] {
  const now = nowIso();
  const blocks = STARTING_BLOCKS.filter((b) => blockSeeds.has(b.seed)).map((b) => ({
    id: seededBlockId(b.seed, userId),
    seed: b.seed,
    name: b.name,
    tag: b.tag,
    color: b.color,
    area: b.area,
    pillar: b.pillar,
    sort: opts.blockSortFrom + STARTING_BLOCKS.indexOf(b),
  }));
  const templates = STARTING_TEMPLATES.filter((t) => templateSeeds.has(t.seed)).map((t) => ({
    id: seededTemplateId(t.seed, userId),
    seed: t.seed,
    kind: t.sourceKind,
    name: t.name,
    lead: t.lead,
    second: t.second,
    why: t.why,
    source: t.source,
    def: opts.allowDefault && t.isDefault ? 1 : 0,
    sort: opts.templateSortFrom + STARTING_TEMPLATES.indexOf(t),
    color: t.color,
  }));
  const slots = STARTING_TEMPLATES.filter((t) => templateSeeds.has(t.seed)).flatMap((t) => {
    const tid = seededTemplateId(t.seed, userId);
    return t.slots.map((s, i) => ({ id: `${tid}-${i}`, tid, block: seededBlockId(s.block, userId), start: minuteOf(s.start) ?? 0, end: minuteOf(s.end) ?? 0 }));
  });
  const out: D1PreparedStatement[] = [];
  if (blocks.length)
    out.push(
      db
        .prepare(
          `INSERT OR IGNORE INTO time_blocks (id, user_id, seed, name, tag, color, life_area, relationship, sort, created_at, updated_at)
           SELECT json_extract(value, '$.id'), ?1, json_extract(value, '$.seed'), json_extract(value, '$.name'), json_extract(value, '$.tag'), json_extract(value, '$.color'),
             json_extract(value, '$.area'), json_extract(value, '$.pillar'), json_extract(value, '$.sort'), ?2, ?2 FROM json_each(?3)`,
        )
        .bind(userId, now, JSON.stringify(blocks)),
    );
  if (templates.length)
    out.push(
      db
        .prepare(
          `INSERT OR IGNORE INTO day_templates (id, user_id, seed, source_kind, name, lead, second, why, source, is_default, sort, color, created_at, updated_at)
           SELECT json_extract(value, '$.id'), ?1, json_extract(value, '$.seed'), json_extract(value, '$.kind'), json_extract(value, '$.name'), json_extract(value, '$.lead'),
             json_extract(value, '$.second'), json_extract(value, '$.why'), json_extract(value, '$.source'), json_extract(value, '$.def'), json_extract(value, '$.sort'),
             json_extract(value, '$.color'), ?2, ?2 FROM json_each(?3)`,
        )
        .bind(userId, now, JSON.stringify(templates)),
    );
  if (slots.length) out.push(slotInsert(db, userId, slots));
  return out;
}

/** One statement that adds a list of slots (`{ id, tid, block, start, end }`) for the person. */
export function slotInsert(db: D1Database, userId: string, slots: { id: string; tid: string; block: string; start: number; end: number }[]): D1PreparedStatement {
  return db
    .prepare(
      `INSERT OR IGNORE INTO day_template_slots (id, template_id, user_id, block_id, start_min, end_min)
       SELECT json_extract(value, '$.id'), json_extract(value, '$.tid'), ?1, json_extract(value, '$.block'), json_extract(value, '$.start'), json_extract(value, '$.end') FROM json_each(?2)`,
    )
    .bind(userId, JSON.stringify(slots));
}

/**
 * Adds the starting blocks and day templates the first time a person's blocks are read (once: `users.time_blocks_seeded_at`). The session's
 * user row is already loaded, so a person who has them costs no read. Fixed ids and INSERT OR IGNORE make two first reads at once add them once.
 */
export async function ensureTimeBlocks(db: D1Database, user: { id: string; time_blocks_seeded_at?: string | null }): Promise<void> {
  if (user.time_blocks_seeded_at) return;
  if (user.time_blocks_seeded_at === undefined) {
    const row = await db.prepare('SELECT time_blocks_seeded_at AS at FROM users WHERE id = ?').bind(user.id).first<{ at: string | null }>();
    if (row?.at) {
      user.time_blocks_seeded_at = row.at;
      return;
    }
  }
  const now = nowIso();
  await db.batch([
    ...seedStatements(db, user.id, new Set(STARTING_BLOCKS.map((b) => b.seed)), new Set(STARTING_TEMPLATES.map((t) => t.seed)), { allowDefault: true, blockSortFrom: 0, templateSortFrom: 0 }),
    db.prepare('UPDATE users SET time_blocks_seeded_at = ? WHERE id = ? AND time_blocks_seeded_at IS NULL').bind(now, user.id),
  ]);
  user.time_blocks_seeded_at = now;
}

/** Adds back any starting block or template whose seed the person no longer has. Never touches one that still exists, never the pattern. */
export async function restoreStartingSet(db: D1Database, userId: string): Promise<{ blocks: number; templates: number }> {
  const [b, t, any] = await db.batch([
    db.prepare('SELECT seed, sort FROM time_blocks WHERE user_id = ?').bind(userId),
    db.prepare('SELECT seed, sort FROM day_templates WHERE user_id = ?').bind(userId),
    db.prepare('SELECT 1 AS one FROM day_templates WHERE user_id = ? AND is_default = 1').bind(userId),
  ]);
  const haveB = new Set((b!.results as { seed: string | null }[]).map((r) => r.seed).filter(Boolean));
  const haveT = new Set((t!.results as { seed: string | null }[]).map((r) => r.seed).filter(Boolean));
  const maxB = Math.max(-1, ...(b!.results as { sort: number }[]).map((r) => r.sort));
  const maxT = Math.max(-1, ...(t!.results as { sort: number }[]).map((r) => r.sort));
  // A template needs its blocks, so a missing template brings back the starting blocks it uses as well.
  const wantT = new Set(STARTING_TEMPLATES.filter((x) => !haveT.has(x.seed)).map((x) => x.seed));
  const wantB = new Set(STARTING_BLOCKS.filter((x) => !haveB.has(x.seed)).map((x) => x.seed));
  if (wantB.size === 0 && wantT.size === 0) return { blocks: 0, templates: 0 };
  await db.batch(seedStatements(db, userId, wantB, wantT, { allowDefault: (any!.results as unknown[]).length === 0, blockSortFrom: maxB + 1, templateSortFrom: maxT + 1 }));
  return { blocks: wantB.size, templates: wantT.size };
}

export interface Blocking {
  blocks: TimeBlock[];
  templates: DayTemplate[];
  defaultId: string;
  /** Seven entries, Monday first; null follows the default. */
  pattern: (string | null)[];
  /** Date to template id, for the dates asked about (a row whose template is gone is left out). */
  overrides: Record<string, string>;
}

/** Everything a person's days are made from, plus the date changes for the dates asked about. One round trip. */
export async function loadBlocking(db: D1Database, userId: string, dates: readonly string[]): Promise<Blocking> {
  const days = [...new Set(dates)];
  const [b, t, s, p, d] = await db.batch([
    db.prepare('SELECT * FROM time_blocks WHERE user_id = ? ORDER BY sort ASC, created_at ASC').bind(userId),
    db.prepare('SELECT * FROM day_templates WHERE user_id = ? ORDER BY sort ASC, created_at ASC').bind(userId),
    db.prepare('SELECT template_id, block_id, start_min, end_min FROM day_template_slots WHERE user_id = ? ORDER BY start_min ASC').bind(userId),
    db.prepare('SELECT weekday, template_id FROM week_patterns WHERE user_id = ?').bind(userId),
    db.prepare('SELECT day, kind, template_id FROM day_types WHERE user_id = ? AND day IN (SELECT value FROM json_each(?))').bind(userId, JSON.stringify(days)),
  ]);
  const slotsBy = new Map<string, TemplateSlot[]>();
  for (const r of s!.results as SlotRow[]) slotsBy.set(r.template_id, [...(slotsBy.get(r.template_id) ?? []), { blockId: r.block_id, start: r.start_min, end: r.end_min }]);
  const blocks = (b!.results as TimeBlockRow[]).map(toTimeBlock);
  const templates = (t!.results as DayTemplateRow[]).map((r) => toDayTemplate(r, slotsBy.get(r.id) ?? []));
  const ids = new Set(templates.map((x) => x.id));
  const defaultId = templates.find((x) => x.isDefault)?.id ?? templates[0]?.id ?? '';
  const pattern: (string | null)[] = [null, null, null, null, null, null, null];
  for (const r of p!.results as { weekday: number; template_id: string }[]) if (r.weekday >= 1 && r.weekday <= 7 && ids.has(r.template_id)) pattern[r.weekday - 1] = r.template_id;
  const overrides: Record<string, string> = Object.create(null) as Record<string, string>;
  for (const r of d!.results as { day: string; kind: string; template_id: string | null }[]) {
    const id = overrideTemplateId(r, templates);
    if (id) overrides[r.day] = id;
  }
  return { blocks, templates, defaultId, pattern, overrides };
}

/** The day an account began, in the person's zone: a day before it has no kind of day. */
export function accountDay(user: { created_at?: string | null; timezone?: string | null }): string | null {
  return user.created_at ? (localStamp(user.created_at, user.timezone || DEFAULT_ZONE)?.day ?? null) : null;
}

/**
 * The person's kinds of day from `from` to `to`, both included (2026-11-06, docs/time-blocks.md): each day the template set for it,
 * else the weekly pattern's, the default counting as none, read through the shared `kindsOfDays`, with each template's colour
 * (`templateColor`). Reads only, one round trip; the starting set is not added here.
 */
export async function kindsBetween(db: D1Database, user: { id: string; created_at?: string | null; timezone?: string | null }, from: string, to: string): Promise<{ blocking: Blocking; kinds: KindsOfDays; colors: Record<string, BlockColor | null> }> {
  const dates: string[] = [];
  for (let d = from, i = 0; d <= to && i < 400; d = addDays(d, 1), i += 1) dates.push(d);
  const blocking = await loadBlocking(db, user.id, dates);
  const kinds = kindsOfDays({ templates: blocking.templates, defaultId: blocking.defaultId, pattern: blocking.pattern, overrides: blocking.overrides, since: accountDay(user) }, from, to);
  const colors: Record<string, BlockColor | null> = Object.create(null) as Record<string, BlockColor | null>;
  for (const t of blocking.templates) colors[t.id] = templateColor(t, blocking.blocks);
  return { blocking, kinds, colors };
}

/** The plan for one date: its template (date change, else the pattern, else the default), its slots in clock order and every block. */
export function dayPlan(blocking: Blocking, date: string): DayPlan {
  const ids = new Set(blocking.templates.map((x) => x.id));
  const { templateId, from } = templateForDate(date, { overrides: blocking.overrides, pattern: blocking.pattern, defaultId: blocking.defaultId, exists: (id) => ids.has(id) });
  const tpl = blocking.templates.find((x) => x.id === templateId);
  return {
    date,
    template: tpl
      ? { id: tpl.id, name: tpl.name, lead: tpl.lead, second: tpl.second, why: tpl.why, source: tpl.source }
      : { id: '', name: 'Everyday', lead: 'servant_leader' as RelationshipKey, second: 'self', why: null, source: null },
    from: tpl ? from : 'default',
    slots: tpl ? tpl.slots : [],
    blocks: blocking.blocks,
  };
}

/** A block or template of the person's by its name (no case, trimmed), for the assistant; screens send ids. */
export async function blockIdByName(db: D1Database, userId: string, name: string): Promise<string | null> {
  const row = await db.prepare('SELECT id FROM time_blocks WHERE user_id = ? AND lower(trim(name)) = lower(trim(?)) ORDER BY sort LIMIT 1').bind(userId, name).first<{ id: string }>();
  return row?.id ?? null;
}
export async function templateIdByName(db: D1Database, userId: string, name: string): Promise<string | null> {
  const row = await db.prepare('SELECT id FROM day_templates WHERE user_id = ? AND lower(trim(name)) = lower(trim(?)) ORDER BY sort LIMIT 1').bind(userId, name).first<{ id: string }>();
  return row?.id ?? null;
}

/**
 * The block a task request names: `timeBlockId` (an id) or `timeBlock` (a name, for the assistant). Undefined when the request names none;
 * `{ id: null }` clears it (null, '' or 'none'); an id or name that is not the person's own is refused.
 */
export async function blockFromBody(db: D1Database, userId: string, body: { timeBlockId?: unknown; timeBlock?: unknown }): Promise<{ id: string | null } | { error: string } | undefined> {
  if ('timeBlockId' in body && body.timeBlockId !== undefined) {
    const v = body.timeBlockId;
    if (v === null || v === '' || v === 'none') return { id: null };
    if (typeof v !== 'string') return { error: 'pick one of your time blocks' };
    const own = await db.prepare('SELECT id FROM time_blocks WHERE id = ? AND user_id = ?').bind(v, userId).first<{ id: string }>();
    return own ? { id: own.id } : { error: 'pick one of your time blocks' };
  }
  if ('timeBlock' in body && body.timeBlock !== undefined) {
    const v = body.timeBlock;
    if (v === null || (typeof v === 'string' && (!v.trim() || v.trim().toLowerCase() === 'none'))) return { id: null };
    if (typeof v !== 'string') return { error: 'No time block called that.' };
    const id = await blockIdByName(db, userId, v);
    return id ? { id } : { error: 'No time block called that.' };
  }
  return undefined;
}
