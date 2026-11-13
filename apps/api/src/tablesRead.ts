import {
  columnFor,
  csvMaxRows,
  editableKeys,
  pageRows,
  parseTableQuery,
  rowFromRaw,
  tableSql,
  visibleColumns,
  weekdayWords,
  type Cell,
  type ColumnOption,
  type DataColumn,
  type DataTable,
  type DynamicOptions,
  type TablePageResponse,
  type TableQuery,
  type TableRow,
  type TableSubject,
  type TableView,
} from '@kreators/shared/dataTables';
import {
  BADGE_BY_KEY,
  BADGE_FAMILY_META,
  BREATHING,
  CONSENT_PURPOSES,
  DEFAULT_ZONE,
  isRelationshipKey,
  mantraLine,
  minutesLabel,
  notToDoStreak,
  overrideTemplateId,
  parseRepeat,
  RELATIONSHIP_BY_KEY,
  repeatLabel,
  reviewNameFor,
  SCORE_LABEL,
  SCORECARD,
  slotRangeLabel,
  starsOf,
  stepsMinutes,
  weightWord,
  type NotToDoStatus,
  type Page,
  type PageSize,
  type PeriodKind,
} from '@kreators/shared';
import { EAT_MOMENT_META, eatFromStored, mealLabel, proteinGrams } from '@kreators/shared/fitness';
import { GRATITUDE_GROUP_NAMES, gratitudePromptByKey } from '@kreators/shared/gratitude';
import type { UserRow } from './env';
import { currencyOf, dateNearToday, dayInZone, nameOf } from './db';
import { blockingForTables, type TablesBlocking } from './timeBlocks';

/**
 * All tables (2026-11-13, the founder): the one reader behind every table a person, their coach or a super admin opens. The registry
 * (`@kreators/shared/dataTables`) says what each table is; this file reads it, one round trip a page: the rows, the count when asked, the
 * person's own choices (time blocks, templates, projects, not to do items) and a memory table's rows are plain reads made in one turn,
 * which the binding sends as one batch (d1Batch.ts). SQL comes only from registry strings; the subject's id is ?1 on every statement.
 * The owner, the coach and the admin read through these same functions, so the rules cannot drift apart; the routes in routes/tables.ts
 * decide who may open what.
 */

export interface ReadCtx {
  view: TableView;
  subject: TableSubject;
  /** Who is looking (the coach's `{viewer}` in a coach's view). */
  viewerId: string;
}

/** The person whose tables these are, with their own today and zone. */
export function subjectOf(u: Pick<UserRow, 'id' | 'display_name' | 'timezone'>, today?: string): TableSubject {
  const zone = u.timezone || DEFAULT_ZONE;
  return { id: u.id, name: nameOf(u), today: today ?? dayInZone(zone), zone, currency: currencyOf(u) };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The person's own choices (a select's options, and a dynamic column's words)
// ---------------------------------------------------------------------------------------------------------------------------------

/** Which of the person's own lists a column needs for this viewer: its words (`dynamic`), and for the owner the choices an edit offers. */
function choicesOf(col: DataColumn, view: TableView): DynamicOptions | undefined {
  if (!columnFor(col, view)) return undefined;
  return col.dynamic ?? (view === 'owner' ? col.edit?.choices : undefined);
}

interface Wanted {
  blocking: boolean;
  slots: boolean;
  projects: boolean;
  items: boolean;
}
function wantedFor(table: DataTable, view: TableView): Wanted {
  const kinds = new Set(table.columns.map((col) => choicesOf(col, view)).filter((k): k is DynamicOptions => k !== undefined));
  const memoryBlocks = table.read === 'memory' && (table.reader === 'timeBlocks' || table.reader === 'dayTemplates');
  return {
    blocking: kinds.has('timeBlocks') || kinds.has('dayTemplates') || memoryBlocks || table.columns.some((col) => col.derive === 'kindOfDay'),
    slots: table.reader === 'dayTemplates',
    projects: kinds.has('projects'),
    items: kinds.has('notToDoItems'),
  };
}

interface ProjectRow {
  id: string;
  title: string;
  relationship: string;
}
const PILLAR_ORDER = new Map<string, number>(Object.keys(RELATIONSHIP_BY_KEY).map((k, i) => [k, i]));
const pillarName = (k: unknown): string => (isRelationshipKey(k) ? RELATIONSHIP_BY_KEY[k].name : '');

function optionsFrom(table: DataTable, view: TableView, got: { blocking: TablesBlocking | null; projects: ProjectRow[]; items: { id: string; title: string }[] }): Record<string, ColumnOption[]> {
  const lists: Record<DynamicOptions, ColumnOption[]> = {
    timeBlocks: (got.blocking?.blocks ?? []).map(({ block }) => ({ value: block.id, label: block.name })),
    dayTemplates: (got.blocking?.templates ?? []).map(({ template }) => ({ value: template.id, label: template.name })),
    projects: [...got.projects]
      .sort((a, b) => (PILLAR_ORDER.get(a.relationship) ?? 99) - (PILLAR_ORDER.get(b.relationship) ?? 99))
      .map((p) => ({ value: p.id, label: p.title, group: pillarName(p.relationship) || undefined })),
    notToDoItems: got.items.map((i) => ({ value: i.id, label: i.title })),
  };
  const out: Record<string, ColumnOption[]> = {};
  for (const col of table.columns) {
    const kind = choicesOf(col, view);
    if (kind) out[col.key] = lists[kind];
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The cells the server works out (SERVER_DERIVES in the registry)
// ---------------------------------------------------------------------------------------------------------------------------------

function jsonOf(raw: unknown): unknown {
  if (typeof raw !== 'string' || !raw) return raw ?? null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
const listOf = (raw: unknown): unknown[] => {
  const v = jsonOf(raw);
  return Array.isArray(v) ? v : [];
};
const objOf = (raw: unknown): Record<string, unknown> => {
  const v = jsonOf(raw);
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
};
const textOf = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const joined = (parts: string[], sep = ', '): string | null => (parts.length ? parts.join(sep) : null);
const SCORE_ORDER: readonly string[] = [...SCORECARD.health, ...SCORECARD.wealth, ...Object.keys(RELATIONSHIP_BY_KEY)];
const scoreLabel = (k: string): string => (k in SCORE_LABEL ? SCORE_LABEL[k as keyof typeof SCORE_LABEL] : pillarName(k) || k);

/** One server derive for one row, or undefined when the key is not one of these. `fields` holds the table's private selects and cells. */
function serverDerive(table: DataTable, col: DataColumn, cells: Record<string, Cell>, fields: Record<string, unknown>, extra: { templates: TablesBlocking['templates'] | null; eat: () => ReturnType<typeof eatFromStored> }): Cell | undefined {
  const first = fields[col.from?.[0] ?? ''];
  switch (col.derive) {
    case 'repeatWords': {
      const rule = parseRepeat(first);
      if (!rule) return 'Once';
      const base = [cells.doDate, cells.dueDate, cells.anchor].find((v): v is string => typeof v === 'string' && v !== '') ?? null;
      return repeatLabel(rule, base);
    }
    case 'kindOfDay': {
      const templates = (extra.templates ?? []).map((x) => x.template);
      const stored = typeof cells[col.key] === 'string' ? (cells[col.key] as string) : null;
      return overrideTemplateId({ kind: textOf(fields.oldKind), template_id: stored }, templates);
    }
    case 'reviewName': {
      const named = textOf(cells[col.key]);
      if (named) return named;
      try {
        return typeof cells.from === 'string' && typeof cells.kind === 'string' ? reviewNameFor({ kind: cells.kind as PeriodKind, start: cells.from }) : null;
      } catch {
        return null;
      }
    }
    case 'eatMeals': {
      const e = extra.eat();
      if (e.input.fasting) return 'Fasting';
      return joined(e.input.meals.map((m) => `${EAT_MOMENT_META[m.moment]?.name ?? m.moment}: ${mealLabel(m)}`));
    }
    case 'eatProtein': {
      const g = proteinGrams(extra.eat().input.protein);
      return g > 0 ? g : null;
    }
    case 'eatScore':
      return extra.eat().dayScore;
    case 'eatLegacy':
      return extra.eat().legacy;
    case 'gratitudePrompts':
      return joined(listOf(first).map((l) => gratitudePromptByKey(textOf((l as { prompt?: unknown })?.prompt))?.text ?? '').filter(Boolean), ' / ');
    case 'gratitudePillars':
      return joined(
        listOf(first)
          .map((l) => gratitudePromptByKey(textOf((l as { prompt?: unknown })?.prompt)))
          .map((p) => (p ? GRATITUDE_GROUP_NAMES[p.group] : ''))
          .filter(Boolean),
      );
    case 'fears':
      return joined(
        listOf(first).flatMap((f) => {
          const o = objOf(f);
          const text = textOf(o.text);
          if (!text) return [];
          const drives = o.drives === 'yes' ? ', drives it' : o.drives === 'sometimes' ? ', sometimes drives it' : '';
          const where = pillarName(o.relationship);
          return [`${text} (${where || 'No pillar'}${drives})`];
        }),
        '; ',
      );
    case 'insecurities':
      return joined(
        listOf(first).flatMap((f) => {
          const o = objOf(f);
          const text = textOf(o.text);
          if (!text) return [];
          const weight = Number(o.weight);
          const parts = [Number.isFinite(weight) ? weightWord(weight) : '', pillarName(o.relationship)].filter(Boolean);
          return [parts.length ? `${text} (${parts.join(', ')})` : text];
        }),
        '; ',
      );
    case 'scorecard': {
      const scores = objOf(first);
      return joined(
        SCORE_ORDER.filter((k) => typeof scores[k] === 'number').map((k) => {
          const stars = starsOf(scores[k] as number);
          return `${scoreLabel(k)} ${stars} ${stars === 1 ? 'star' : 'stars'}`;
        }),
      );
    }
    case 'realDay': {
      const d = objOf(first);
      const parts = [
        textOf(d.wake) && `up ${textOf(d.wake)}`,
        textOf(d.sleep) && `bed ${textOf(d.sleep)}`,
        textOf(d.workStart) && textOf(d.workEnd) && `work ${textOf(d.workStart)} to ${textOf(d.workEnd)}`,
        textOf(d.gym) && `gym ${textOf(d.gym)}`,
        textOf(d.evening) && `evening ${textOf(d.evening)}`,
      ].filter((p): p is string => Boolean(p));
      const line = joined(parts);
      return line ? `${line.charAt(0).toUpperCase()}${line.slice(1)}` : null;
    }
    case 'routineDay':
      return joined(
        listOf(first).flatMap((b) => {
          const o = objOf(b);
          const name = textOf(o.name);
          if (!name) return [];
          const steps = Array.isArray(o.steps) ? o.steps.filter((s): s is string => typeof s === 'string') : [];
          const minutes = Array.isArray(o.minutes) ? o.minutes.map(Number) : undefined;
          const span = textOf(o.start) && textOf(o.end) ? ` ${textOf(o.start)} to ${textOf(o.end)}` : '';
          const more = steps.length ? ` (${steps.length} ${steps.length === 1 ? 'step' : 'steps'}, ${minutesLabel(stepsMinutes({ steps, minutes }))})` : '';
          return [`${name}${span}${more}`];
        }),
      );
    case 'practices': {
      const p = objOf(first);
      const mantra = typeof p.mantra === 'string' ? mantraLine({ mantra: p.mantra as never, ownMantra: textOf(p.ownMantra) }) : '';
      const breath = BREATHING.find((b) => b.key === p.breathing)?.name ?? '';
      const parts = [mantra && `Mantra: ${mantra}`, breath && `Breathing: ${breath}`, textOf(p.affirmation) && `Line: ${textOf(p.affirmation)}`, textOf(p.reading) && `Reading: ${textOf(p.reading)}`].filter(
        (x): x is string => Boolean(x),
      );
      return joined(parts, '. ');
    }
    default:
      return undefined;
  }
}

/** A raw row as the screen's row: the registry's own cells and leaf derives, then the server's derives, and for the owner what may change now. */
function shapeRow(table: DataTable, raw: Record<string, unknown>, ctx: ReadCtx, blocking: TablesBlocking | null, editable: boolean): { row: TableRow; fields: Record<string, unknown> } {
  const { row, fields } = rowFromRaw(table, raw, ctx.view);
  let eat: ReturnType<typeof eatFromStored> | null = null;
  const eatOf = () => (eat ??= eatFromStored(Number(fields.value) || 0, typeof fields.extra === 'string' ? fields.extra : '', typeof fields.note === 'string' ? fields.note : ''));
  for (const col of table.columns) {
    if (!col.derive || !columnFor(col, ctx.view)) continue;
    const v = serverDerive(table, col, row.cells, fields, { templates: blocking?.templates ?? null, eat: eatOf });
    if (v !== undefined) row.cells[col.key] = v;
  }
  if (ctx.view === 'owner' && editable) {
    row.edit = editableKeys(table, row.cells, ctx.subject.today);
    // A not to do day is marked through Daily's route, which takes only a day within one of the server's own (UTC) day: late in the evening
    // in a zone behind UTC, yesterday is past it, so the cell is not offered where the route would refuse it (as Daily hides yesterday then).
    const marks = row.edit.filter((k) => table.columns.find((col) => col.key === k)?.edit?.recipe === 'notToDoDay');
    if (marks.length && !dateNearToday(String(row.cells.day ?? ''))) row.edit = row.edit.filter((k) => !marks.includes(k));
  }
  return { row, fields };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Tables read whole by a server reader (`read: 'memory'`)
// ---------------------------------------------------------------------------------------------------------------------------------

async function readMemory(db: D1Database, table: DataTable, ctx: ReadCtx, blocking: Promise<TablesBlocking | null>): Promise<Record<string, unknown>[]> {
  const uid = ctx.subject.id;
  const max = table.memoryMax ?? 100;
  switch (table.reader) {
    case 'timeBlocks': {
      const b = await blocking;
      return (b?.blocks ?? []).slice(0, max).map(({ block, updatedAt }) => ({
        _id: block.id,
        name: block.name,
        tag: block.tag || null,
        color: block.color,
        lifeArea: block.area,
        pillar: block.pillar,
        starting: block.seed !== null,
        order: block.sort,
        updatedAt,
      }));
    }
    case 'dayTemplates': {
      const b = await blocking;
      if (!b) return [];
      const names = new Map(b.blocks.map(({ block }) => [block.id, block.name]));
      return b.templates.slice(0, max).map(({ template, updatedAt }) => {
        const days = [1, 2, 3, 4, 5, 6, 7].filter((w) => b.pattern[w - 1] === template.id || (b.pattern[w - 1] === null && template.id === b.defaultId));
        return {
          _id: template.id,
          name: template.name,
          lead: template.lead,
          second: template.second,
          slots: joined(template.slots.map((s) => `${names.get(s.blockId) ?? 'A block'} ${slotRangeLabel(s)}`)),
          weekdays: days.length ? weekdayWords(days) : null,
          isDefault: template.isDefault,
          why: template.why,
          source: template.source,
          order: template.sort,
          updatedAt,
        };
      });
    }
    case 'notToDo': {
      // The stored streak goes stale on a missed day, so it is worked out fresh, reaching back as far as Daily does (notToDoList in
      // routes/today.ts: eight days, or the longest stored streak and two), not a year of marks on every page; both reads go in one trip.
      const [items, days] = await Promise.all([
        db.prepare('SELECT id, title, relationship, streak, best_streak, created_at FROM not_to_do WHERE user_id = ? ORDER BY created_at ASC LIMIT ?').bind(uid, max).all<{ id: string; title: string; relationship: string | null; streak: number; best_streak: number; created_at: string }>(),
        db
          .prepare("SELECT item_id, day, status FROM not_to_do_days WHERE user_id = ? AND day >= date(?, '-' || (SELECT MAX(8, COALESCE(MAX(streak), 0) + 2) FROM not_to_do WHERE user_id = ?) || ' days') AND day <= ?")
          .bind(uid, ctx.subject.today, uid, ctx.subject.today)
          .all<{ item_id: string; day: string; status: NotToDoStatus }>(),
      ]);
      const reach = Math.max(8, ...items.results.map((r) => r.streak + 2));
      const byItem = new Map<string, Record<string, NotToDoStatus | undefined>>();
      for (const d of days.results) (byItem.get(d.item_id) ?? byItem.set(d.item_id, {}).get(d.item_id)!)[d.day] = d.status;
      return items.results.map((r) => {
        const fresh = notToDoStreak(byItem.get(r.id) ?? {}, ctx.subject.today);
        const streak = fresh >= reach ? Math.max(fresh, r.streak) : fresh;
        return { _id: r.id, title: r.title, pillar: isRelationshipKey(r.relationship) ? r.relationship : null, streak, bestStreak: Math.max(r.best_streak, streak), createdAt: r.created_at };
      });
    }
    case 'badges': {
      const [earned, given] = await Promise.all([
        db.prepare('SELECT badge_key, earned_at FROM badge_awards WHERE user_id = ?').bind(uid).all<{ badge_key: string; earned_at: string | null }>(),
        db.prepare('SELECT badge_key, note, awarded_at FROM badge_grants WHERE user_id = ?').bind(uid).all<{ badge_key: string; note: string; awarded_at: string }>(),
      ]);
      // A coach or an admin never sees the private families (Focus, Reflection, Money), as a public page never does.
      const shown = (key: string) => {
        const b = BADGE_BY_KEY[key];
        return b && (ctx.view === 'owner' || !BADGE_FAMILY_META[b.family]?.private) ? b : null;
      };
      const rows: Record<string, unknown>[] = [];
      for (const r of earned.results) {
        const b = shown(r.badge_key);
        if (b) rows.push({ _id: `earned:${b.key}`, badge: b.name, family: b.family, tier: b.tier, how: 'earned', note: null, at: r.earned_at });
      }
      for (const r of given.results) {
        const b = shown(r.badge_key);
        if (b) rows.push({ _id: `given:${b.key}`, badge: b.name, family: b.family, tier: b.tier, how: 'given', note: textOf(r.note) || null, at: r.awarded_at });
      }
      return rows.slice(0, max);
    }
    case 'consents': {
      const rows = await db.prepare('SELECT purpose, granted, updated_at FROM user_consents WHERE user_id = ?').bind(uid).all<{ purpose: string; granted: number; updated_at: string }>();
      return CONSENT_PURPOSES.map((p) => {
        const r = rows.results.find((x) => x.purpose === p.key);
        return { _id: p.key, choice: p.key, allowed: r ? r.granted === 1 : false, changed: r?.updated_at ?? null };
      });
    }
    default:
      return [];
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Reading: a page, every row (the CSV), or one row (an edit)
// ---------------------------------------------------------------------------------------------------------------------------------

export interface Loaded {
  rows: TableRow[];
  /** Each row's private fields and cells, for an edit's recipe. Same order as rows. */
  fields: Record<string, unknown>[];
  page: Page;
  total: number | null;
  /** True when there were more rows than the read took (the CSV's cap). */
  capped: boolean;
  options: Record<string, ColumnOption[]>;
}

type Mode = { kind: 'page' } | { kind: 'all' } | { kind: 'one'; id: string };

/** The query a single-row read uses: no filters, the view asked for. */
export function viewQuery(table: DataTable, view: TableView, archived = false): TableQuery {
  return parseTableQuery(table, archived ? { view: 'archived' } : {}, view);
}

/**
 * A coach's options hold only the choices the rows they read use (and the filter they picked): the student's whole list of time blocks,
 * day templates or not to do items would name blocks and items no shared row holds, which only those tables, switched on, may show.
 */
function cutForCoach(table: DataTable, options: Record<string, ColumnOption[]>, rows: readonly TableRow[], query: TableQuery): Record<string, ColumnOption[]> {
  const out: Record<string, ColumnOption[]> = { ...options };
  for (const col of table.columns) {
    const list = out[col.key];
    if (!col.dynamic || !list) continue;
    const used = new Set(rows.map((r) => r.cells[col.key]).filter((v): v is string => typeof v === 'string'));
    const picked = query.filters[col.key];
    if (picked !== undefined) used.add(picked);
    out[col.key] = list.filter((o) => used.has(o.value));
  }
  return out;
}

/**
 * The one read. A page: the query's page (size + 1 rows for `more`) and the count when it asked. All: every matching row up to `csvMaxRows`.
 * One: the row with that id in the query's view. Every read is the subject's own (?1); everything typed is bound. `options: false` skips the
 * person's own lists where no cell needs them (an edit's read after the save: the screen already holds them).
 */
export async function loadTable(db: D1Database, table: DataTable, query: TableQuery, ctx: ReadCtx, mode: Mode = { kind: 'page' }, opts: { options?: boolean } = {}): Promise<Loaded> {
  const want = wantedFor(table, ctx.view);
  const lists = opts.options !== false;
  // A derive and a memory reader read the blocks for the cells themselves, so those are read whatever is asked.
  const needBlocks = (table.read === 'memory' && (table.reader === 'timeBlocks' || table.reader === 'dayTemplates')) || table.columns.some((col) => col.derive === 'kindOfDay');
  const uid = ctx.subject.id;
  const blockingP: Promise<TablesBlocking | null> = want.blocking && (lists || needBlocks) ? blockingForTables(db, uid, { slots: want.slots }) : Promise.resolve(null);
  const projectsP =
    want.projects && lists
      ? db.prepare("SELECT id, title, relationship FROM nodes WHERE user_id = ? AND kind = 'project' AND status = 'active' ORDER BY created_at ASC LIMIT 200").bind(uid).all<ProjectRow>().then((r) => r.results)
      : Promise.resolve([] as ProjectRow[]);
  const itemsP = want.items && lists ? db.prepare('SELECT id, title FROM not_to_do WHERE user_id = ? ORDER BY created_at ASC LIMIT 20').bind(uid).all<{ id: string; title: string }>().then((r) => r.results) : Promise.resolve([] as { id: string; title: string }[]);
  // Rows are editable only for the owner, and on a table with an archive only in its Active view. A download never says what may change.
  const editable = ctx.view === 'owner' && (!table.archive || query.view !== 'archived') && mode.kind !== 'all';
  const csvMax = csvMaxRows(table, ctx.view);
  const optionsOf = (blocking: TablesBlocking | null, projects: ProjectRow[], items: { id: string; title: string }[], rows: readonly TableRow[]) => {
    if (!lists) return {};
    const options = optionsFrom(table, ctx.view, { blocking, projects, items });
    return ctx.view === 'coach' ? cutForCoach(table, options, rows, query) : options;
  };

  if (table.read === 'memory') {
    const [blocking, projects, items, raw] = await Promise.all([blockingP, projectsP, itemsP, readMemory(db, table, ctx, blockingP)]);
    const shaped = raw.map((r) => shapeRow(table, r, ctx, blocking, editable));
    if (mode.kind === 'one') {
      const hit = shaped.find((s) => s.row.id === mode.id);
      const rows = hit ? [hit.row] : [];
      return { rows, fields: hit ? [hit.fields] : [], page: { page: 1, size: query.size, more: false }, total: null, capped: false, options: optionsOf(blocking, projects, items, rows) };
    }
    const all = mode.kind === 'all';
    const q = all ? { ...query, page: 1, size: csvMax as PageSize } : query;
    const res = pageRows(table, shaped.map((s) => s.row), q, { view: ctx.view, zone: ctx.subject.zone });
    const fieldsById = new Map(shaped.map((s) => [s.row.id, s.fields]));
    return {
      rows: res.rows,
      fields: res.rows.map((r) => fieldsById.get(r.id) ?? {}),
      page: all ? { page: 1, size: query.size, more: false } : res.page,
      total: query.count || all ? res.total : null,
      capped: all && res.total > csvMax,
      options: optionsOf(blocking, projects, items, res.rows),
    };
  }

  const sqlCtx = { view: ctx.view, ownerId: uid, viewerId: ctx.viewerId, today: ctx.subject.today, zone: ctx.subject.zone };
  const built =
    mode.kind === 'one'
      ? tableSql(table, { ...query, count: false }, { ...sqlCtx, id: mode.id })
      : mode.kind === 'all'
        ? tableSql(table, { ...query, count: false }, { ...sqlCtx, limit: csvMax + 1, offset: 0 })
        : tableSql(table, query, sqlCtx);
  const [rowsRes, countRow, blocking, projects, items] = await Promise.all([
    db.prepare(built.sql).bind(...built.binds).all<Record<string, unknown>>(),
    built.countSql ? db.prepare(built.countSql).bind(...built.countBinds).first<{ n: number }>() : Promise.resolve(null),
    blockingP,
    projectsP,
    itemsP,
  ]);
  let raw = rowsRes.results;
  let page: Page = { page: query.page, size: query.size, more: false };
  let capped = false;
  if (mode.kind === 'page') {
    page = { page: query.page, size: query.size, more: raw.length > query.size, ...(raw.length === 0 && query.page > 1 ? { empty: true } : {}) };
    raw = raw.slice(0, query.size);
  } else if (mode.kind === 'all') {
    capped = raw.length > csvMax;
    raw = raw.slice(0, csvMax);
  }
  const shaped = raw.map((r) => shapeRow(table, r, ctx, blocking, editable));
  const rows = shaped.map((s) => s.row);
  return { rows, fields: shaped.map((s) => s.fields), page, total: countRow ? Number(countRow.n) : null, capped, options: optionsOf(blocking, projects, items, rows) };
}

/** A page as the API answers it. */
export async function readPage(db: D1Database, table: DataTable, query: TableQuery, ctx: ReadCtx): Promise<TablePageResponse> {
  const got = await loadTable(db, table, query, ctx);
  return {
    table: table.key,
    view: ctx.view,
    columns: visibleColumns(table, ctx.view).map((col) => col.key),
    options: got.options,
    rows: got.rows,
    page: got.page,
    ...(query.count && got.total !== null ? { total: got.total } : {}),
    query,
    subject: ctx.subject,
  };
}
