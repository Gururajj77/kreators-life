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
  startingToRestore,
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
// The starting set lives in code until the person's first change to a block or a template (2026-11-07, the founder: the rows were 769 of the
// 1,076 a sign-up wrote). Until then every read answers from `startingSet` with the same fixed ids the rows get, so a task, a date or a
// weekday that points at a starting block or template keeps pointing at it. `users.time_blocks_seeded_at` says which: empty is code, set is rows.

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

const startingBlockRows = (userId: string, seeds?: ReadonlySet<string>, sortFrom = 0): TimeBlockRow[] =>
  STARTING_BLOCKS.filter((b) => !seeds || seeds.has(b.seed)).map((b) => ({
    id: seededBlockId(b.seed, userId),
    user_id: userId,
    seed: b.seed,
    name: b.name,
    tag: b.tag,
    color: b.color,
    life_area: b.area,
    relationship: b.pillar,
    sort: sortFrom + STARTING_BLOCKS.indexOf(b),
    created_at: '',
    updated_at: '',
  }));
const startingTemplateRows = (userId: string, seeds?: ReadonlySet<string>, allowDefault = true, sortFrom = 0): DayTemplateRow[] =>
  STARTING_TEMPLATES.filter((t) => !seeds || seeds.has(t.seed)).map((t) => ({
    id: seededTemplateId(t.seed, userId),
    user_id: userId,
    seed: t.seed,
    source_kind: t.sourceKind,
    name: t.name,
    lead: t.lead,
    second: t.second,
    why: t.why,
    source: t.source,
    is_default: allowDefault && t.isDefault ? 1 : 0,
    sort: sortFrom + STARTING_TEMPLATES.indexOf(t),
    color: t.color,
    created_at: '',
    updated_at: '',
  }));
const startingSlots = (t: (typeof STARTING_TEMPLATES)[number], userId: string): TemplateSlot[] => t.slots.map((s) => ({ blockId: seededBlockId(s.block, userId), start: minuteOf(s.start) ?? 0, end: minuteOf(s.end) ?? 0 }));

/** What a person who has changed nothing has: the same blocks and templates, through the same mappers, as their rows would give. `slots: false` as in `loadBlocking`. */
export function startingSet(userId: string, opts: { slots?: boolean } = {}): { blocks: TimeBlock[]; templates: DayTemplate[] } {
  return {
    blocks: startingBlockRows(userId).map(toTimeBlock),
    templates: startingTemplateRows(userId).map((r, i) => toDayTemplate(r, opts.slots === false ? [] : startingSlots(STARTING_TEMPLATES[i]!, userId))),
  };
}
/** One starting block as its row would read, by its id; null when the id is not one. */
export const startingBlockRow = (userId: string, id: string): TimeBlockRow | null => startingBlockRows(userId).find((r) => r.id === id) ?? null;
/** One starting template by its id, with its slots; null when the id is not one. */
export const startingTemplate = (userId: string, id: string): DayTemplate | null => startingSet(userId).templates.find((t) => t.id === id) ?? null;

/**
 * Whether the person's starting set is rows yet. Read beside whatever it decides about, in one `Promise.all`: the binding sends the reads of one
 * turn as one batch (d1Batch.ts), so one answer sees one state.
 */
export async function blocksWritten(db: D1Database, userId: string): Promise<boolean> {
  const row = await db.prepare('SELECT time_blocks_seeded_at AS at FROM users WHERE id = ?').bind(userId).first<{ at: string | null }>();
  return Boolean(row?.at);
}

/** Only the batch that made this claim adds rows: a later one from another tab, read before the first, must not bring back what was deleted since. Unclaimed (a restore) always adds. */
const claimed = (claim: number) => `WHERE ?${claim} IS NULL OR (SELECT time_blocks_seeded_at FROM users WHERE id = ?1) = ?${claim}`;

/** The statements that add the starting blocks and templates (only the seeds asked for), each one statement over a JSON list. */
function seedStatements(db: D1Database, userId: string, blockSeeds: ReadonlySet<string>, templateSeeds: ReadonlySet<string>, opts: { allowDefault: boolean; blockSortFrom: number; templateSortFrom: number; claim?: string }): D1PreparedStatement[] {
  const now = nowIso();
  const claim = opts.claim ?? null;
  const blocks = startingBlockRows(userId, blockSeeds, opts.blockSortFrom);
  const templates = startingTemplateRows(userId, templateSeeds, opts.allowDefault, opts.templateSortFrom);
  const slots = STARTING_TEMPLATES.filter((t) => templateSeeds.has(t.seed)).flatMap((t) => {
    const tid = seededTemplateId(t.seed, userId);
    return startingSlots(t, userId).map((s, i) => ({ id: `${tid}-${i}`, tid, block: s.blockId, start: s.start, end: s.end }));
  });
  const out: D1PreparedStatement[] = [];
  if (blocks.length)
    out.push(
      db
        .prepare(
          `INSERT OR IGNORE INTO time_blocks (id, user_id, seed, name, tag, color, life_area, relationship, sort, created_at, updated_at)
           SELECT json_extract(value, '$.id'), ?1, json_extract(value, '$.seed'), json_extract(value, '$.name'), json_extract(value, '$.tag'), json_extract(value, '$.color'),
             json_extract(value, '$.life_area'), json_extract(value, '$.relationship'), json_extract(value, '$.sort'), ?2, ?2 FROM json_each(?3) ${claimed(4)}`,
        )
        .bind(userId, now, JSON.stringify(blocks), claim),
    );
  if (templates.length)
    out.push(
      db
        .prepare(
          `INSERT OR IGNORE INTO day_templates (id, user_id, seed, source_kind, name, lead, second, why, source, is_default, sort, color, created_at, updated_at)
           SELECT json_extract(value, '$.id'), ?1, json_extract(value, '$.seed'), json_extract(value, '$.source_kind'), json_extract(value, '$.name'), json_extract(value, '$.lead'),
             json_extract(value, '$.second'), json_extract(value, '$.why'), json_extract(value, '$.source'), json_extract(value, '$.is_default'), json_extract(value, '$.sort'),
             json_extract(value, '$.color'), ?2, ?2 FROM json_each(?3) ${claimed(4)}`,
        )
        .bind(userId, now, JSON.stringify(templates), claim),
    );
  if (slots.length) out.push(slotInsert(db, userId, slots, claim));
  return out;
}

/**
 * One statement that adds a list of slots (`{ id, tid, block, start, end }`) for the person. Outside a claim (the seeding batch adds both ends itself), a slot
 * whose block or template another tab deleted since it was checked is left out: the foreign key would otherwise turn that moment into a 500.
 */
export function slotInsert(db: D1Database, userId: string, slots: { id: string; tid: string; block: string; start: number; end: number }[], claim: string | null = null): D1PreparedStatement {
  const columns = `INSERT OR IGNORE INTO day_template_slots (id, template_id, user_id, block_id, start_min, end_min)
       SELECT json_extract(value, '$.id'), json_extract(value, '$.tid'), ?1, json_extract(value, '$.block'), json_extract(value, '$.start'), json_extract(value, '$.end') FROM json_each(?2)`;
  if (claim) return db.prepare(`${columns} ${claimed(3)}`).bind(userId, JSON.stringify(slots), claim);
  return db
    .prepare(
      `${columns} WHERE EXISTS (SELECT 1 FROM time_blocks WHERE id = json_extract(value, '$.block') AND user_id = ?1) AND EXISTS (SELECT 1 FROM day_templates WHERE id = json_extract(value, '$.tid') AND user_id = ?1)`,
    )
    .bind(userId, JSON.stringify(slots));
}

/**
 * Writes the starting blocks and day templates as the person's rows, in one batch, just before their first change to a block or a template:
 * nothing else needs them, since a task, a date and a weekday only hold an id and the ids never change. Safe against two tabs: the batch
 * first claims the account with a stamp no other batch has (`WHERE time_blocks_seeded_at IS NULL`) and each insert runs only under that
 * claim, so a tab that read the account before another tab's first change adds nothing, and a template deleted in between stays deleted.
 */
export async function ensureTimeBlocks(db: D1Database, user: { id: string; time_blocks_seeded_at?: string | null }): Promise<void> {
  if (user.time_blocks_seeded_at) return;
  // Still a UTC ISO time, with three more digits so that two batches never hold one stamp.
  const claim = nowIso().replace('Z', `${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}Z`);
  await db.batch([
    db.prepare('UPDATE users SET time_blocks_seeded_at = ? WHERE id = ? AND time_blocks_seeded_at IS NULL').bind(claim, user.id),
    ...seedStatements(db, user.id, new Set(STARTING_BLOCKS.map((b) => b.seed)), new Set(STARTING_TEMPLATES.map((t) => t.seed)), { allowDefault: true, blockSortFrom: 0, templateSortFrom: 0, claim }),
  ]);
  user.time_blocks_seeded_at = claim;
}

/** What "Bring back the starting set" did: how many came back, and the names of those that did not fit under the most a person keeps. */
export interface RestoreResult {
  blocks: number;
  templates: number;
  leftOut: { blocks: string[]; templates: string[] };
}
/**
 * Adds back any starting block or template whose seed the person no longer has. Never touches one that still exists, never the pattern. With
 * no rows yet, none can be missing. What would pass MAX_TIME_BLOCKS or MAX_DAY_TEMPLATES stays out and is named in `leftOut`, so the screen
 * can say which and why.
 */
export async function restoreStartingSet(db: D1Database, userId: string): Promise<RestoreResult> {
  const none: RestoreResult = { blocks: 0, templates: 0, leftOut: { blocks: [], templates: [] } };
  const [written, b, t, any] = await db.batch([
    db.prepare('SELECT time_blocks_seeded_at AS at FROM users WHERE id = ?').bind(userId),
    db.prepare('SELECT seed, sort FROM time_blocks WHERE user_id = ?').bind(userId),
    db.prepare('SELECT seed, sort FROM day_templates WHERE user_id = ?').bind(userId),
    db.prepare('SELECT 1 AS one FROM day_templates WHERE user_id = ? AND is_default = 1').bind(userId),
  ]);
  if (!(written!.results as { at: string | null }[])[0]?.at) return none;
  const haveB = new Set((b!.results as { seed: string | null }[]).map((r) => r.seed).filter((x): x is string => Boolean(x)));
  const haveT = new Set((t!.results as { seed: string | null }[]).map((r) => r.seed).filter((x): x is string => Boolean(x)));
  const maxB = Math.max(-1, ...(b!.results as { sort: number }[]).map((r) => r.sort));
  const maxT = Math.max(-1, ...(t!.results as { sort: number }[]).map((r) => r.sort));
  // A template needs its blocks, so a missing template brings back the starting blocks it uses as well; and never past MAX_TIME_BLOCKS or
  // MAX_DAY_TEMPLATES (2026-11-12: the content days took the starting set to 18 blocks and 17 templates), so `startingToRestore` adds a
  // template only with room for it and its missing blocks, then other missing blocks while there is room.
  const pick = startingToRestore({ blocks: haveB, templates: haveT }, { blocks: b!.results.length, templates: t!.results.length });
  const wantT = new Set(pick.templates);
  const wantB = new Set(pick.blocks);
  const nameOf = (list: readonly { seed: string; name: string }[], seeds: readonly string[]) => seeds.map((x) => list.find((y) => y.seed === x)?.name ?? x);
  const leftOut = { blocks: nameOf(STARTING_BLOCKS, pick.leftOut.blocks), templates: nameOf(STARTING_TEMPLATES, pick.leftOut.templates) };
  if (wantB.size === 0 && wantT.size === 0) return { ...none, leftOut };
  await db.batch(seedStatements(db, userId, wantB, wantT, { allowDefault: (any!.results as unknown[]).length === 0, blockSortFrom: maxB + 1, templateSortFrom: maxT + 1 }));
  return { blocks: wantB.size, templates: wantT.size, leftOut };
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
export async function loadBlocking(db: D1Database, userId: string, dates: readonly string[], opts: { slots?: boolean } = {}): Promise<Blocking> {
  const days = [...new Set(dates)];
  const noSlots = opts.slots === false;
  // `slots: false` is for what only needs which template a day has (a period's kinds of day): a person's slots are the most rows here, about 130, and a review reads this twice.
  const [written, b, t, s, p, d] = await db.batch([
    db.prepare('SELECT time_blocks_seeded_at AS at FROM users WHERE id = ?').bind(userId),
    db.prepare('SELECT * FROM time_blocks WHERE user_id = ? ORDER BY sort ASC, created_at ASC').bind(userId),
    db.prepare('SELECT * FROM day_templates WHERE user_id = ? ORDER BY sort ASC, created_at ASC').bind(userId),
    noSlots ? db.prepare('SELECT template_id, block_id, start_min, end_min FROM day_template_slots WHERE 0') : db.prepare('SELECT template_id, block_id, start_min, end_min FROM day_template_slots WHERE user_id = ? ORDER BY start_min ASC').bind(userId),
    db.prepare('SELECT weekday, template_id FROM week_patterns WHERE user_id = ?').bind(userId),
    db.prepare('SELECT day, kind, template_id FROM day_types WHERE user_id = ? AND day IN (SELECT value FROM json_each(?))').bind(userId, JSON.stringify(days)),
  ]);
  const slotsBy = new Map<string, TemplateSlot[]>();
  for (const r of s!.results as SlotRow[]) slotsBy.set(r.template_id, [...(slotsBy.get(r.template_id) ?? []), { blockId: r.block_id, start: r.start_min, end: r.end_min }]);
  // No rows yet: the starting set from code, read beside the pattern and the dates in this one batch.
  const start = (written!.results as { at: string | null }[])[0]?.at ? null : startingSet(userId, { slots: !noSlots });
  const blocks = start?.blocks ?? (b!.results as TimeBlockRow[]).map(toTimeBlock);
  const templates = start?.templates ?? (t!.results as DayTemplateRow[]).map((r) => toDayTemplate(r, slotsBy.get(r.id) ?? []));
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
 * (`templateColor`). Reads only, one round trip.
 */
export async function kindsBetween(db: D1Database, user: { id: string; created_at?: string | null; timezone?: string | null }, from: string, to: string, opts: { read?: Promise<Blocking> } = {}): Promise<{ blocking: Blocking; kinds: KindsOfDays; colors: Record<string, BlockColor | null> }> {
  const dates: string[] = [];
  for (let d = from, i = 0; d <= to && i < 400; d = addDays(d, 1), i += 1) dates.push(d);
  const blocking = await (opts.read ?? loadBlocking(db, user.id, dates));
  const kinds = kindsOfDays({ templates: blocking.templates, defaultId: blocking.defaultId, pattern: blocking.pattern, overrides: blocking.overrides, since: accountDay(user) }, from, to);
  const colors: Record<string, BlockColor | null> = Object.create(null) as Record<string, BlockColor | null>;
  for (const t of blocking.templates) colors[t.id] = templateColor(t, blocking.blocks);
  // A read without slots: a kind that has days and no colour of its own takes its longest block's, so those few slots are read now.
  const blank = opts.read ? kinds.tally.map((x) => x.templateId).filter((id) => !colors[id] && !blocking.templates.find((t) => t.id === id)?.color) : [];
  if (blank.length) {
    const rows = await db.prepare(`SELECT template_id, block_id, start_min, end_min FROM day_template_slots WHERE user_id = ? AND template_id IN (${blank.map(() => '?').join(', ')}) ORDER BY start_min ASC`).bind(user.id, ...blank).all<SlotRow>();
    for (const t of blocking.templates) {
      if (blank.includes(t.id)) colors[t.id] = templateColor({ ...t, slots: rows.results.filter((r) => r.template_id === t.id).map((r) => ({ blockId: r.block_id, start: r.start_min, end: r.end_min })) }, blocking.blocks);
    }
  }
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
      ? { id: tpl.id, seed: tpl.seed ?? null, name: tpl.name, lead: tpl.lead, second: tpl.second, why: tpl.why, source: tpl.source }
      : { id: '', seed: null, name: 'Everyday', lead: 'servant_leader' as RelationshipKey, second: 'self', why: null, source: null },
    from: tpl ? from : 'default',
    slots: tpl ? tpl.slots : [],
    blocks: blocking.blocks,
  };
}

/** The same match as the SQL below, over the starting names (all plain letters, so case folds the same). */
const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** A block or template of the person's by its name (no case, trimmed), for the assistant; screens send ids. */
export async function blockIdByName(db: D1Database, userId: string, name: string): Promise<string | null> {
  const [row, written] = await Promise.all([db.prepare('SELECT id FROM time_blocks WHERE user_id = ? AND lower(trim(name)) = lower(trim(?)) ORDER BY sort LIMIT 1').bind(userId, name).first<{ id: string }>(), blocksWritten(db, userId)]);
  if (written) return row?.id ?? null;
  return startingBlockRows(userId).find((r) => sameName(r.name, name))?.id ?? null;
}
export async function templateIdByName(db: D1Database, userId: string, name: string): Promise<string | null> {
  const [row, written] = await Promise.all([db.prepare('SELECT id FROM day_templates WHERE user_id = ? AND lower(trim(name)) = lower(trim(?)) ORDER BY sort LIMIT 1').bind(userId, name).first<{ id: string }>(), blocksWritten(db, userId)]);
  if (written) return row?.id ?? null;
  return startingTemplateRows(userId).find((r) => sameName(r.name, name))?.id ?? null;
}
/** A block or template of the person's by its id: one of their rows, or a starting one while they have none. */
export async function ownBlockId(db: D1Database, userId: string, id: string): Promise<string | null> {
  const [row, written] = await Promise.all([db.prepare('SELECT id FROM time_blocks WHERE id = ? AND user_id = ?').bind(id, userId).first<{ id: string }>(), blocksWritten(db, userId)]);
  if (written) return row?.id ?? null;
  return startingBlockRow(userId, id)?.id ?? null;
}
export async function ownTemplateId(db: D1Database, userId: string, id: string): Promise<string | null> {
  const [row, written] = await Promise.all([db.prepare('SELECT id FROM day_templates WHERE id = ? AND user_id = ?').bind(id, userId).first<{ id: string }>(), blocksWritten(db, userId)]);
  if (written) return row?.id ?? null;
  return startingTemplateRows(userId).find((r) => r.id === id)?.id ?? null;
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
    const own = await ownBlockId(db, userId, v);
    return own ? { id: own } : { error: 'pick one of your time blocks' };
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

/** All tables (2026-11-13): a person's blocks and templates with when each last changed, the week pattern and the default. */
export interface TablesBlocking {
  blocks: { block: TimeBlock; updatedAt: string | null }[];
  templates: { template: DayTemplate; updatedAt: string | null }[];
  defaultId: string;
  /** Seven entries, Monday first; null follows the default. */
  pattern: (string | null)[];
}
/**
 * What the All tables screens read of the time blocks: the same rows (or the starting set from code, until the first change) as
 * `loadBlocking`, as plain reads, so the binding sends them in the same round trip as the page's rows (d1Batch.ts). `slots: false` leaves the
 * template slots out (a list of choices needs only names).
 */
export async function blockingForTables(db: D1Database, userId: string, opts: { slots?: boolean } = {}): Promise<TablesBlocking> {
  const withSlots = opts.slots !== false;
  const [written, b, t, s, p] = await Promise.all([
    blocksWritten(db, userId),
    db.prepare('SELECT * FROM time_blocks WHERE user_id = ? ORDER BY sort ASC, created_at ASC').bind(userId).all<TimeBlockRow>(),
    db.prepare('SELECT * FROM day_templates WHERE user_id = ? ORDER BY sort ASC, created_at ASC').bind(userId).all<DayTemplateRow>(),
    withSlots ? db.prepare('SELECT template_id, block_id, start_min, end_min FROM day_template_slots WHERE user_id = ? ORDER BY start_min ASC').bind(userId).all<SlotRow>() : Promise.resolve({ results: [] as SlotRow[] }),
    db.prepare('SELECT weekday, template_id FROM week_patterns WHERE user_id = ?').bind(userId).all<{ weekday: number; template_id: string }>(),
  ]);
  let blocks: TablesBlocking['blocks'];
  let templates: TablesBlocking['templates'];
  if (!written) {
    const start = startingSet(userId, { slots: withSlots });
    blocks = start.blocks.map((block) => ({ block, updatedAt: null }));
    templates = start.templates.map((template) => ({ template, updatedAt: null }));
  } else {
    const slotsBy = new Map<string, TemplateSlot[]>();
    for (const r of s.results) slotsBy.set(r.template_id, [...(slotsBy.get(r.template_id) ?? []), { blockId: r.block_id, start: r.start_min, end: r.end_min }]);
    blocks = b.results.map((r) => ({ block: toTimeBlock(r), updatedAt: r.updated_at || null }));
    templates = t.results.map((r) => ({ template: toDayTemplate(r, slotsBy.get(r.id) ?? []), updatedAt: r.updated_at || null }));
  }
  const ids = new Set(templates.map((x) => x.template.id));
  const defaultId = templates.find((x) => x.template.isDefault)?.template.id ?? templates[0]?.template.id ?? '';
  const pattern: (string | null)[] = [null, null, null, null, null, null, null];
  for (const r of p.results) if (r.weekday >= 1 && r.weekday <= 7 && ids.has(r.template_id)) pattern[r.weekday - 1] = r.template_id;
  return { blocks, templates, defaultId, pattern };
}
