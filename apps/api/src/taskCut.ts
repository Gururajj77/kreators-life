import { OPEN_KINDS, parseLifeArea, parseTaskTags, taskTagsKey, type LifeAreaKey, type TaskTagCut, type TemplateSlot } from '@kreators/shared';

/**
 * Daily's cuts as SQL, in one place (2026-11-13): the Area filter (`?area=`, one of the five or 'none') and the tags a person tapped
 * (`?tags=`, `parseTaskTags` in shared: a pillar, a priority, Remember, For review, Habit, From pillar, From your coach, a kind of open
 * business and a time block, combined with AND). Every value comes from a fixed list or one of the person's own block ids checked against
 * their blocks, so it is written into the query as text, never a value a person typed. The cut is extra predicates on reads that already
 * exist: no new round trip and no new index.
 */

const BLOCK_ID_RE = /^[A-Za-z0-9-]{1,80}$/;
/** A task's time of day as minutes after midnight, in SQL. */
const minuteSql = (col: string) => `(CAST(substr(${col}, 1, 2) AS INTEGER) * 60 + CAST(substr(${col}, 4, 2) AS INTEGER))`;
/** A slot's range as SQL over that minute; the bounds are whole numbers from the person's own rows, written as numbers. */
const slotSql = (m: string, s: TemplateSlot) => {
  const a = Math.trunc(s.start);
  const b = Math.trunc(s.end);
  return a < b ? `(${m} >= ${a} AND ${m} < ${b})` : `(${m} >= ${a} OR ${m} < ${b})`;
};

/** Whether a block id has the shape of one (the older `?block=` cut checks it before looking it up). */
export const isBlockId = (v: string): boolean => BLOCK_ID_RE.test(v);

/**
 * A block cut as SQL: a task is in a block when it was picked into it, or when it has none picked and its time falls in one of the block's
 * slots that day. 'none': nothing picked and no time in any slot. The id is one of the person's own block ids, checked first. For Past due,
 * Upcoming and Done today the slots are the asked day's, so a timed task on another day is placed by that day's slots: near enough, since a
 * block picked by hand (the usual case) is exact whatever the day.
 */
export function blockFilterSql(block: string | null, slots: readonly TemplateSlot[], prefix: string): string {
  if (!block) return '';
  const m = minuteSql(`${prefix}due_time`);
  if (block === 'none') {
    const any = slots.length ? slots.map((s) => slotSql(m, s)).join(' OR ') : '0';
    return ` AND ${prefix}time_block_id IS NULL AND (${prefix}due_time IS NULL OR NOT (${any}))`;
  }
  const own = slots.filter((s) => s.blockId === block);
  const timed = own.length ? ` OR (${prefix}time_block_id IS NULL AND ${prefix}due_time IS NOT NULL AND (${own.map((s) => slotSql(m, s)).join(' OR ')}))` : '';
  return ` AND (${prefix}time_block_id = '${block}'${timed})`;
}

/** The Area filter as read from the query: one of the five, 'none' (tasks with no area), or null for every area. */
export function readArea(ask: string | undefined): LifeAreaKey | 'none' | null {
  return ask === 'none' ? 'none' : parseLifeArea(ask);
}

/** The Area cut as SQL on a column. */
export const areaSql = (area: LifeAreaKey | 'none' | null, col: string): string => (area === 'none' ? ` AND ${col} IS NULL` : area ? ` AND ${col} = '${area}'` : '');

/** The open-business cut as SQL, from a key already read through `isOpenFilter` or `parseOpenKind`. */
const openSql = (kind: string | null, col: string): string => (kind === 'any' ? ` AND ${col} IN (${OPEN_KINDS.map((k) => `'${k}'`).join(', ')})` : kind ? ` AND ${col} = '${kind}'` : '');

export interface TaskCut {
  area: LifeAreaKey | 'none' | null;
  /** The tags asked for, already read; a block not among the person's own is dropped before the SQL is written. */
  tags: TaskTagCut;
  /** The canonical tags string echoed back (`taskTagsKey`), '' for none. */
  key: string;
  /** The Area and tag cuts as SQL for a table read under `prefix` ('n.' or ''). */
  sql: (prefix: string) => string;
}

/** Whether the tags asked for name a block, so the caller loads the person's blocks first. */
export const tagsNeedBlocks = (ask: string | undefined): boolean => parseTaskTags(ask).block !== null;

/**
 * Reads `?area=` and `?tags=` into one cut. `blocking` is the person's blocks and the day's slots when a block tag was asked (the caller
 * loads them; GET /today and /waiting have them anyway). A block id that is not one of the person's is dropped, never a 400, so a link
 * to a block since deleted still opens Daily; the echo (`key`) then leaves it out and the screen drops it from its address.
 */
export function readTaskCut(query: (k: string) => string | undefined, blocking?: { blocks: readonly { id: string }[]; slots: readonly TemplateSlot[] } | null): TaskCut {
  const area = readArea(query('area'));
  const asked = parseTaskTags(query('tags'));
  const block = asked.block && blocking?.blocks.some((b) => b.id === asked.block) ? asked.block : null;
  const tags: TaskTagCut = { ...asked, block };
  const slots = blocking?.slots ?? [];
  const sql = (p: string): string => {
    let out = areaSql(area, `${p}life_area`);
    if (tags.pillar) out += ` AND ${p}relationship = '${tags.pillar}'`;
    if (tags.priority !== null) out += ` AND ${p}priority = ${Math.trunc(tags.priority)}`;
    if (tags.remember) out += ` AND ${p}remind = 1`;
    if (tags.review) out += ` AND ${p}for_review = 1`;
    // The Habit tag shows on a task that repeats and is counted as a habit (`taskIsHabit`: its own pick, else repeating is a habit).
    if (tags.habit) out += ` AND ${p}repeat_json IS NOT NULL AND COALESCE(${p}habit, 1) = 1`;
    if (tags.built) out += ` AND ${p}origin = 'build'`;
    if (tags.coach) out += ` AND ${p}added_by IS NOT NULL`;
    if (tags.kind) out += openSql(tags.kind, `${p}open_kind`);
    if (tags.block) out += blockFilterSql(tags.block, slots, p);
    return out;
  };
  return { area, tags, key: taskTagsKey(tags), sql };
}
