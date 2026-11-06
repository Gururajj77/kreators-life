import { Hono } from 'hono';
import {
  blockColorOf,
  dayTemplateProblem,
  TIME_BLOCK_SWATCHES,
  isRelationshipKey,
  MAX_APPLY_DATES,
  MAX_DAY_TEMPLATES,
  MAX_TIME_BLOCKS,
  mondayOf,
  parseSlots,
  parseTimeBlockBody,
  templateForDate,
  timeBlockProblem,
  weekDates,
  weekdayOf,
  DAY_TEMPLATE_NAME_MAX,
  type DayTemplate,
  type TemplateSlot,
  type TimeBlocksResponse,
  type KindsMonthResponse,
} from '@kreators/shared';
import type { AppEnv } from '../env';
import { DATE_RE, dayFromDevice, newId, nowIso } from '../db';
import { ensureTimeBlocks, kindsBetween, loadBlocking, slotInsert, templateIdByName, toDayTemplate, toTimeBlock, restoreStartingSet, type DayTemplateRow, type TimeBlockRow } from '../timeBlocks';

// Time blocks, day templates and the weekly pattern (docs/time-blocks.md). Core like /today, so it is not in MODULE_FOR_PREFIX.
// Every query filters by the session user; an id that is not the person's own answers 404. Every write is under `prefs` in limits.ts.
export const timeBlocks = new Hono<AppEnv>();

type Json = Record<string, unknown>;
const bodyOf = async (c: { req: { json: <T>() => Promise<T> } }): Promise<Json> => {
  const b = await c.req.json<unknown>().catch(() => ({}));
  return b && typeof b === 'object' && !Array.isArray(b) ? (b as Json) : {};
};

async function ownBlock(db: D1Database, userId: string, id: string): Promise<TimeBlockRow | null> {
  return db.prepare('SELECT * FROM time_blocks WHERE id = ? AND user_id = ?').bind(id, userId).first<TimeBlockRow>();
}
async function ownTemplate(db: D1Database, userId: string, id: string): Promise<DayTemplate | null> {
  const [t, s] = await db.batch([
    db.prepare('SELECT * FROM day_templates WHERE id = ? AND user_id = ?').bind(id, userId),
    db.prepare('SELECT block_id, start_min, end_min FROM day_template_slots WHERE template_id = ? AND user_id = ? ORDER BY start_min').bind(id, userId),
  ]);
  const row = (t!.results as DayTemplateRow[])[0];
  if (!row) return null;
  return toDayTemplate(row, (s!.results as { block_id: string; start_min: number; end_min: number }[]).map((r) => ({ blockId: r.block_id, start: r.start_min, end: r.end_min })));
}
/** The person's block ids and names, for checking slots. */
async function blockNames(db: D1Database, userId: string): Promise<{ ids: Set<string>; names: Record<string, string> }> {
  const rows = await db.prepare('SELECT id, name FROM time_blocks WHERE user_id = ?').bind(userId).all<{ id: string; name: string }>();
  const names: Record<string, string> = Object.create(null) as Record<string, string>;
  for (const r of rows.results) names[r.id] = r.name;
  return { ids: new Set(rows.results.map((r) => r.id)), names };
}
const slotRows = (templateId: string, slots: TemplateSlot[]) => slots.map((s) => ({ id: newId(), tid: templateId, block: s.blockId, start: s.start, end: s.end }));

/**
 * The template a request names: `templateId` (an id) or `template` (a name, for the assistant). Undefined: none named. `{ id: null }`:
 * follow the week again (null, '' , 'week' or 'default').
 */
async function templateFromBody(db: D1Database, userId: string, body: Json): Promise<{ id: string | null } | { error: string; status: 400 | 404 } | undefined> {
  if ('templateId' in body) {
    const v = body.templateId;
    if (v === null || v === '') return { id: null };
    if (typeof v !== 'string') return { error: 'Pick one of your day templates.', status: 400 };
    const row = await db.prepare('SELECT id FROM day_templates WHERE id = ? AND user_id = ?').bind(v, userId).first<{ id: string }>();
    return row ? { id: row.id } : { error: 'not found', status: 404 };
  }
  if ('template' in body) {
    const v = body.template;
    if (v === null || (typeof v === 'string' && ['', 'week', 'default'].includes(v.trim().toLowerCase()))) return { id: null };
    if (typeof v !== 'string') return { error: 'No day template called that.', status: 400 };
    const id = await templateIdByName(db, userId, v);
    return id ? { id } : { error: 'No day template called that.', status: 400 };
  }
  return undefined;
}

// This month so far (2026-11-06): how many days of each kind, set for the date or given by the week, from the 1st to the device's day.
// The default template's days have no kind. Reads only.
timeBlocks.get('/month', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const asked = c.req.query('day');
  if (asked !== undefined && !DATE_RE.test(asked)) return c.json({ error: 'day must be a real day like 2026-11-02' }, 400);
  const to = dayFromDevice(asked);
  const from = `${to.slice(0, 7)}-01`;
  await ensureTimeBlocks(db, user);
  const { kinds, colors } = await kindsBetween(db, user, from, to);
  const res: KindsMonthResponse = { from, to, kinds: kinds.tally.map((t) => ({ ...t, color: colors[t.templateId] ?? null })), none: kinds.none };
  return c.json(res);
});

// The week: seven days, each with the template it uses and where that came from, plus every block, template, the pattern and the date changes.
timeBlocks.get('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const asked = c.req.query('week');
  if (asked !== undefined && !DATE_RE.test(asked)) return c.json({ error: 'week must be a real day like 2026-11-02' }, 400);
  const monday = mondayOf(asked ?? dayFromDevice(c.req.query('day')));
  await ensureTimeBlocks(db, user);
  const dates = weekDates(monday);
  const b = await loadBlocking(db, user.id, dates);
  const ids = new Set(b.templates.map((t) => t.id));
  const res: TimeBlocksResponse = {
    week: monday,
    days: dates.map((date) => ({ date, weekday: weekdayOf(date), ...templateForDate(date, { overrides: b.overrides, pattern: b.pattern, defaultId: b.defaultId, exists: (id) => ids.has(id) }) })),
    blocks: b.blocks,
    templates: b.templates,
    defaultTemplateId: b.defaultId,
    pattern: b.pattern,
    overrides: dates.filter((d) => b.overrides[d]).map((date) => ({ date, templateId: b.overrides[date]! })),
  };
  return c.json(res);
});

// ---- blocks ----

timeBlocks.post('/blocks', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  await ensureTimeBlocks(db, user);
  const body = await bodyOf(c);
  const problem = timeBlockProblem(body, false);
  if (problem) return c.json({ error: problem }, 400);
  const count = await db.prepare('SELECT COUNT(*) AS n, COALESCE(MAX(sort), -1) AS top FROM time_blocks WHERE user_id = ?').bind(user.id).first<{ n: number; top: number }>();
  if ((count?.n ?? 0) >= MAX_TIME_BLOCKS) return c.json({ error: `You have the most blocks you can keep (${MAX_TIME_BLOCKS}).` }, 409);
  const f = parseTimeBlockBody(body);
  const id = newId();
  const now = nowIso();
  await db
    .prepare('INSERT INTO time_blocks (id, user_id, seed, name, tag, color, life_area, relationship, sort, created_at, updated_at) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, user.id, f.name ?? '', f.tag ?? '', f.color ?? 'slate', f.area ?? null, f.pillar ?? null, (count?.top ?? -1) + 1, now, now)
    .run();
  const row = await ownBlock(db, user.id, id);
  return c.json({ block: row ? toTimeBlock(row) : null }, 201);
});

// Arranging: every one of the person's blocks, each once. (Before /blocks/:id so "order" is never read as an id.)
timeBlocks.put('/blocks/order', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await bodyOf(c);
  const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === 'string') : [];
  const have = await db.prepare('SELECT id FROM time_blocks WHERE user_id = ?').bind(user.id).all<{ id: string }>();
  const own = new Set(have.results.map((r) => r.id));
  if (ids.length !== own.size || new Set(ids).size !== ids.length || ids.some((id) => !own.has(id))) return c.json({ error: 'Send every one of your blocks, each once.' }, 400);
  const now = nowIso();
  if (ids.length) await db.batch(ids.map((id, i) => db.prepare('UPDATE time_blocks SET sort = ?, updated_at = ? WHERE id = ? AND user_id = ?').bind(i, now, id, user.id)));
  return c.json({ ok: true });
});

timeBlocks.patch('/blocks/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await ownBlock(db, user.id, c.req.param('id'));
  if (!row) return c.json({ error: 'not found' }, 404);
  const body = await bodyOf(c);
  const problem = timeBlockProblem(body, true);
  if (problem) return c.json({ error: problem }, 400);
  const f = parseTimeBlockBody(body);
  await db
    .prepare('UPDATE time_blocks SET name = ?, tag = ?, color = ?, life_area = ?, relationship = ?, updated_at = ? WHERE id = ? AND user_id = ?')
    .bind(
      f.name ?? row.name,
      'tag' in f ? f.tag : row.tag,
      f.color ?? row.color,
      'area' in f ? f.area : row.life_area,
      'pillar' in f ? f.pillar : row.relationship,
      nowIso(),
      row.id,
      user.id,
    )
    .run();
  const fresh = await ownBlock(db, user.id, row.id);
  return c.json({ block: fresh ? toTimeBlock(fresh) : null });
});

// Deleting a block: its slots go, tasks that had it picked keep everything else and lose the block, then the block goes. One batch.
timeBlocks.delete('/blocks/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await ownBlock(db, user.id, c.req.param('id'));
  if (!row) return c.json({ error: 'not found' }, 404);
  const touched = await db.prepare('SELECT COUNT(DISTINCT template_id) AS n FROM day_template_slots WHERE block_id = ? AND user_id = ?').bind(row.id, user.id).first<{ n: number }>();
  const res = await db.batch([
    db.prepare('DELETE FROM day_template_slots WHERE block_id = ? AND user_id = ?').bind(row.id, user.id),
    db.prepare('UPDATE nodes SET time_block_id = NULL WHERE user_id = ? AND time_block_id = ?').bind(user.id, row.id),
    db.prepare('DELETE FROM time_blocks WHERE id = ? AND user_id = ?').bind(row.id, user.id),
  ]);
  return c.json({ ok: true, tasksCleared: res[1]?.meta.changes ?? 0, templatesTouched: touched?.n ?? 0 });
});

// ---- day templates ----

timeBlocks.post('/templates', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  await ensureTimeBlocks(db, user);
  const body = await bodyOf(c);
  let from: DayTemplate | null = null;
  if (body.fromId !== undefined && body.fromId !== null) {
    if (typeof body.fromId !== 'string') return c.json({ error: 'not found' }, 404);
    from = await ownTemplate(db, user.id, body.fromId);
    if (!from) return c.json({ error: 'not found' }, 404);
  }
  const merged: Json = { ...(from ? { lead: from.lead, second: from.second } : {}), ...body };
  const problem = dayTemplateProblem(merged, false);
  if (problem) return c.json({ error: problem }, 400);
  const [count, worn] = await Promise.all([
    db.prepare('SELECT COUNT(*) AS n, COALESCE(MAX(sort), -1) AS top FROM day_templates WHERE user_id = ?').bind(user.id).first<{ n: number; top: number }>(),
    db.prepare('SELECT DISTINCT color FROM day_templates WHERE user_id = ? AND color IS NOT NULL').bind(user.id).all<{ color: string }>(),
  ]);
  if ((count?.n ?? 0) >= MAX_DAY_TEMPLATES) return c.json({ error: `You have the most day templates you can keep (${MAX_DAY_TEMPLATES}).` }, 409);
  let slots: TemplateSlot[] = [];
  if (body.slots !== undefined) {
    const { ids, names } = await blockNames(db, user.id);
    const parsed = parseSlots(body.slots, ids, names);
    if ('problem' in parsed) return c.json({ error: parsed.problem }, 400);
    slots = parsed.slots;
  } else if (from) slots = from.slots;
  const id = newId();
  const now = nowIso();
  const second = isRelationshipKey(merged.second) ? merged.second : null;
  // Its own colour as sent (null falls back to its longest block's). Sent none, a new kind takes the first wheel colour no template of
  // theirs wears yet, so no two kinds look alike while the wheel lasts; with every colour taken, a copy keeps its source's.
  let color = 'color' in body ? blockColorOf(body.color) : null;
  if (!('color' in body)) {
    const taken = new Set((worn.results ?? []).map((r) => r.color));
    color = TIME_BLOCK_SWATCHES.find((k) => !taken.has(k)) ?? from?.color ?? null;
  }
  await db.batch([
    db
      .prepare('INSERT INTO day_templates (id, user_id, seed, source_kind, name, lead, second, why, source, is_default, sort, color, created_at, updated_at) VALUES (?, ?, NULL, NULL, ?, ?, ?, NULL, NULL, 0, ?, ?, ?, ?)')
      .bind(id, user.id, String(merged.name).trim().slice(0, DAY_TEMPLATE_NAME_MAX), merged.lead, second, (count?.top ?? -1) + 1, color, now, now),
    ...(slots.length ? [slotInsert(db, user.id, slotRows(id, slots))] : []),
  ]);
  return c.json({ template: await ownTemplate(db, user.id, id) }, 201);
});

timeBlocks.patch('/templates/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const tpl = await ownTemplate(db, user.id, c.req.param('id'));
  if (!tpl) return c.json({ error: 'not found' }, 404);
  const body = await bodyOf(c);
  const problem = dayTemplateProblem(body, true) ?? dayTemplateProblem({ name: tpl.name, lead: tpl.lead, second: tpl.second, ...body }, false);
  if (problem) return c.json({ error: problem }, 400);
  const stmts: D1PreparedStatement[] = [];
  if (body.slots !== undefined) {
    const { ids, names } = await blockNames(db, user.id);
    const parsed = parseSlots(body.slots, ids, names);
    if ('problem' in parsed) return c.json({ error: parsed.problem }, 400);
    stmts.push(db.prepare('DELETE FROM day_template_slots WHERE template_id = ? AND user_id = ?').bind(tpl.id, user.id));
    if (parsed.slots.length) stmts.push(slotInsert(db, user.id, slotRows(tpl.id, parsed.slots)));
  }
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, DAY_TEMPLATE_NAME_MAX) : tpl.name;
  const lead = isRelationshipKey(body.lead) ? body.lead : tpl.lead;
  const second = 'second' in body ? (isRelationshipKey(body.second) ? body.second : null) : tpl.second;
  // Its own colour: sent as a swatch or a hex, or null to go back to its longest block's; left out, it stays.
  const color = 'color' in body ? blockColorOf(body.color) : tpl.color;
  stmts.push(db.prepare('UPDATE day_templates SET name = ?, lead = ?, second = ?, color = ?, updated_at = ? WHERE id = ? AND user_id = ?').bind(name, lead, second, color, nowIso(), tpl.id, user.id));
  // One default: the old one is cleared before the new one is set, in the same batch.
  if (body.isDefault === true && !tpl.isDefault) {
    stmts.push(db.prepare('UPDATE day_templates SET is_default = 0 WHERE user_id = ? AND is_default = 1').bind(user.id));
    stmts.push(db.prepare('UPDATE day_templates SET is_default = 1 WHERE id = ? AND user_id = ?').bind(tpl.id, user.id));
  }
  await db.batch(stmts);
  return c.json({ template: await ownTemplate(db, user.id, tpl.id) });
});

// Deleting a template: never the default. Its slots, the date changes that point at it and its weekdays go (those days follow the default).
timeBlocks.delete('/templates/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const tpl = await ownTemplate(db, user.id, c.req.param('id'));
  if (!tpl) return c.json({ error: 'not found' }, 404);
  if (tpl.isDefault) return c.json({ error: 'Make another template the default first.' }, 409);
  const res = await db.batch([
    db.prepare('DELETE FROM day_template_slots WHERE template_id = ? AND user_id = ?').bind(tpl.id, user.id),
    db.prepare('DELETE FROM day_types WHERE user_id = ? AND (template_id = ? OR (template_id IS NULL AND kind = ?))').bind(user.id, tpl.id, tpl.sourceKind),
    db.prepare('DELETE FROM week_patterns WHERE user_id = ? AND template_id = ?').bind(user.id, tpl.id),
    db.prepare('DELETE FROM day_templates WHERE id = ? AND user_id = ?').bind(tpl.id, user.id),
  ]);
  return c.json({ ok: true, daysCleared: res[1]?.meta.changes ?? 0, weekdaysReset: res[2]?.meta.changes ?? 0 });
});

// ---- the weekly pattern and single dates ----

timeBlocks.put('/pattern', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  await ensureTimeBlocks(db, user);
  const body = await bodyOf(c);
  const weekdays = Array.isArray(body.weekdays) ? [...new Set(body.weekdays)] : [];
  if (weekdays.length === 0 || weekdays.some((w) => typeof w !== 'number' || !Number.isInteger(w) || w < 1 || w > 7)) return c.json({ error: 'Pick the weekdays, 1 for Monday to 7 for Sunday.' }, 400);
  const days = weekdays as number[];
  const tpl = await templateFromBody(db, user.id, body);
  if (tpl === undefined) return c.json({ error: 'Pick a day template, or null to follow the default.' }, 400);
  if ('error' in tpl) return c.json({ error: tpl.error }, tpl.status);
  const before = await db.prepare('SELECT weekday, template_id FROM week_patterns WHERE user_id = ?').bind(user.id).all<{ weekday: number; template_id: string }>();
  const was = new Map(before.results.map((r) => [r.weekday, r.template_id]));
  const now = nowIso();
  await db.batch(
    days.map((w) =>
      tpl.id
        ? db
            .prepare('INSERT INTO week_patterns (user_id, weekday, template_id, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, weekday) DO UPDATE SET template_id = excluded.template_id, updated_at = excluded.updated_at')
            .bind(user.id, w, tpl.id, now)
        : db.prepare('DELETE FROM week_patterns WHERE user_id = ? AND weekday = ?').bind(user.id, w),
    ),
  );
  const pattern: (string | null)[] = [1, 2, 3, 4, 5, 6, 7].map((w) => (days.includes(w) ? tpl.id : (was.get(w) ?? null)));
  return c.json({ pattern, previous: days.map((w) => ({ weekday: w, templateId: was.get(w) ?? null })) });
});

timeBlocks.put('/days', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  await ensureTimeBlocks(db, user);
  const body = await bodyOf(c);
  const dates = Array.isArray(body.dates) ? [...new Set(body.dates)] : [];
  if (dates.length === 0 || dates.length > MAX_APPLY_DATES || dates.some((d) => typeof d !== 'string' || !DATE_RE.test(d))) return c.json({ error: `Pick 1 to ${MAX_APPLY_DATES} real days, like 2026-11-02.` }, 400);
  const list = dates as string[];
  const tpl = await templateFromBody(db, user.id, body);
  if (tpl === undefined) return c.json({ error: 'Pick a day template, or null to follow your week.' }, 400);
  if ('error' in tpl) return c.json({ error: tpl.error }, tpl.status);
  const blocking = await loadBlocking(db, user.id, list);
  const target = tpl.id ? blocking.templates.find((t) => t.id === tpl.id) : null;
  const now = nowIso();
  await db.batch(
    list.map((d) =>
      target
        ? db
            .prepare('INSERT INTO day_types (user_id, day, kind, created_at, template_id) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id, day) DO UPDATE SET kind = excluded.kind, template_id = excluded.template_id')
            .bind(user.id, d, target.sourceKind ?? 'template', now, target.id)
        : db.prepare('DELETE FROM day_types WHERE user_id = ? AND day = ?').bind(user.id, d),
    ),
  );
  return c.json({ days: list.map((date) => ({ date, templateId: target?.id ?? null, previous: blocking.overrides[date] ?? null })) });
});

timeBlocks.post('/restore', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  await ensureTimeBlocks(db, user);
  return c.json({ added: await restoreStartingSet(db, user.id) });
});
