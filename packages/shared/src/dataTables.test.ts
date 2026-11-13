import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  AGENT_OPTIONS,
  BADGE_FAMILY_OPTIONS,
  cellText,
  CONSENT_OPTIONS,
  CSV_MAX_CELLS,
  CSV_MAX_ROWS,
  csvMaxRows,
  CURRENCY_OPTIONS,
  DATA_TABLE_GROUPS,
  DATA_TABLE_KEYS,
  DATA_TABLES,
  dataTableByKey,
  editableKeys,
  editValue,
  EFFORT_OPTIONS,
  EAT_FULLNESS_OPTIONS,
  EAT_PACKAGED_OPTIONS,
  EXPENSE_CATEGORY_OPTIONS,
  FOCUS_QUALITY_OPTIONS,
  INBOX_TAB_KINDS,
  INCOME_CATEGORY_OPTIONS,
  knownTableKeys,
  LAYER_OPTIONS,
  LEAF_DERIVES,
  LIFE_AREA_OPTIONS,
  likePattern,
  listTables,
  MAP_BAND_OPTIONS,
  MAP_LEVEL_OPTIONS,
  MOOD_OPTIONS,
  MOVE_KIND_OPTIONS,
  OPEN_KIND_OPTIONS,
  pageRows,
  parseTableQuery,
  PENALTY_OPTIONS,
  PERIOD_OPTIONS,
  PILLAR_OPTIONS,
  plainCall,
  POST_CATEGORY_OPTIONS,
  PRIORITY_OPTIONS,
  PRODUCT_KIND_OPTIONS,
  rowFromRaw,
  SERVER_DERIVES,
  STRESS_OPTIONS,
  STRESSOR_OPTIONS,
  SUPPLEMENT_KIND_OPTIONS,
  SUPPLEMENT_TIME_OPTIONS,
  tableColumn,
  tableQueryString,
  tableSql,
  TIME_BLOCK_SWATCH_OPTIONS,
  toCsv,
  toTsv,
  visibleColumns,
  weekdayWords,
  type ColumnOption,
  type DataTable,
  type TableRow,
} from './dataTables';
import {
  AGENT_META,
  BADGE_FAMILY_META,
  CONSENT_PURPOSES,
  CURRENCIES,
  EXPENSE_CATEGORIES,
  FOCUS_QUALITY,
  formatCount,
  INBOX_TAB_META,
  INBOX_TABS,
  INCOME_CATEGORIES,
  KIND_META,
  LIFE_AREA_ORDER,
  LIFE_AREAS,
  MAP_BAND_META,
  MAP_LEVELS,
  MOODS,
  MODULE_BY_KEY,
  OPEN_KINDS,
  openTag,
  parseCoachShare,
  PENALTIES,
  PERIOD_META,
  POST_CATEGORIES,
  PRIORITIES,
  PRODUCT_KIND_META,
  RELATIONSHIPS,
  STRESS_LEVELS,
  STRESSORS,
  TIME_BLOCK_SWATCHES,
} from './index';
import { EAT_FULLNESS, EAT_PACKAGED, EFFORT_LEVELS, MOVE_KIND_META, SUPPLEMENT_KIND_META, SUPPLEMENT_TIME_META } from './fitness';
import { HOW_TO } from './help';

// ---------------------------------------------------------------------------------------------------------------------------------
// The schema, read from the migrations in order (CREATE TABLE, ADD COLUMN, RENAME, DROP), and the indexes on each table.
// ---------------------------------------------------------------------------------------------------------------------------------

const MIGRATIONS = new URL('../../../apps/api/migrations/', import.meta.url);
function splitTop(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote = '';
  let cur = '';
  for (const ch of body) {
    if (quote) {
      if (ch === quote) quote = '';
    } else if (ch === "'" || ch === '"') quote = ch;
    else if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0 && !quote) {
      parts.push(cur);
      cur = '';
    } else cur += ch;
  }
  parts.push(cur);
  return parts;
}
function readSchema(): { tables: Map<string, Set<string>>; leads: Map<string, Set<string>> } {
  const tables = new Map<string, Set<string>>();
  /** For each table, the first column of every index, primary key or unique constraint on it. */
  const leads = new Map<string, Set<string>>();
  const lead = (t: string, col: string) => (leads.get(t) ?? leads.set(t, new Set()).get(t)!).add(col);
  const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) {
    const sql = readFileSync(new URL(f, MIGRATIONS), 'utf8').replace(/--[^\n]*/g, '');
    for (const stmt of sql.split(/;\s*(?:\n|$)/)) {
      const s = stmt.trim();
      let m: RegExpExecArray | null;
      if ((m = /^CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?["`]?(\w+)["`]?\s*\(([\s\S]*)\)\s*(?:WITHOUT\s+ROWID)?\s*$/i.exec(s))) {
        const name = m[2]!;
        if (tables.has(name) && m[1]) continue;
        const cols = new Set<string>();
        leads.delete(name);
        for (const part of splitTop(m[3]!)) {
          const t = part.trim();
          const w = /^["`]?(\w+)["`]?/.exec(t);
          if (!w) continue;
          const pk = /^(?:PRIMARY\s+KEY|UNIQUE)\s*\(\s*["`]?(\w+)/i.exec(t);
          if (pk) {
            lead(name, pk[1]!);
            continue;
          }
          if (/^(PRIMARY|UNIQUE|FOREIGN|CHECK|CONSTRAINT)$/i.test(w[1]!)) continue;
          cols.add(w[1]!);
          if (/\bPRIMARY\s+KEY\b|\bUNIQUE\b/i.test(t)) lead(name, w[1]!);
        }
        tables.set(name, cols);
      } else if ((m = /^ALTER\s+TABLE\s+(\w+)\s+ADD\s+(?:COLUMN\s+)?["`]?(\w+)/i.exec(s))) {
        tables.get(m[1]!)?.add(m[2]!);
      } else if ((m = /^ALTER\s+TABLE\s+(\w+)\s+RENAME\s+TO\s+(\w+)/i.exec(s))) {
        tables.set(m[2]!, tables.get(m[1]!)!);
        leads.set(m[2]!, leads.get(m[1]!) ?? new Set());
        tables.delete(m[1]!);
        leads.delete(m[1]!);
      } else if ((m = /^ALTER\s+TABLE\s+(\w+)\s+DROP\s+(?:COLUMN\s+)?(\w+)/i.exec(s))) {
        tables.get(m[1]!)?.delete(m[2]!);
      } else if ((m = /^DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(\w+)/i.exec(s))) {
        tables.delete(m[1]!);
        leads.delete(m[1]!);
      } else if ((m = /^CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?\w+\s+ON\s+(\w+)\s*\(\s*["`]?(\w+)/i.exec(s))) {
        lead(m[1]!, m[2]!);
      }
    }
  }
  return { tables, leads };
}
const SCHEMA = readSchema();

/** Every `alias.column` a table's SQL reads, with the alias resolved to its table through `from`. */
function aliasesOf(table: DataTable): Map<string, string> {
  const map = new Map<string, string>();
  const re = /(?:^|\bJOIN\s+)(\w+)\s+(\w+)(?=\s+ON\b|\s+LEFT\b|\s+JOIN\b|\s*$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(table.from))) map.set(m[2]!, m[1]!);
  return map;
}
function sqlTextsOf(table: DataTable): string[] {
  const out = [table.from, table.owner, table.idSql];
  if (table.where) out.push(table.where);
  if (table.coachWhere) out.push(table.coachWhere);
  if (table.othersWhere) out.push(table.othersWhere);
  if (table.archive) out.push(table.archive.activeWhere, table.archive.archivedWhere, table.archive.only?.where ?? '');
  for (const expr of Object.values(table.privateSelect ?? {})) out.push(expr);
  for (const col of table.columns) for (const e of [col.sql, col.sortSql, col.filterSql, col.searchSql]) if (e) out.push(e);
  return out;
}
/** `alias.column` pairs in a table's SQL, skipping the inner aliases of a subquery that names its own table (routines r, contracts k). */
function refsOf(table: DataTable): { table: string; column: string; text: string }[] {
  const aliases = aliasesOf(table);
  const refs: { table: string; column: string; text: string }[] = [];
  for (const text of sqlTextsOf(table)) {
    const local = new Map(aliases);
    const sub = /\bFROM\s+(\w+)\s+(\w+)\b/g;
    let s: RegExpExecArray | null;
    while ((s = sub.exec(text))) local.set(s[2]!, s[1]!);
    const re = /\b([a-z]{1,3})\.([a-z_]\w*)\b/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const t = local.get(m[1]!);
      if (t) refs.push({ table: t, column: m[2]!, text });
    }
  }
  return refs;
}

// ---------------------------------------------------------------------------------------------------------------------------------

describe('All tables: the registry', () => {
  it('has unique keys that a route can never mistake for its coach or admin path', () => {
    expect(new Set(DATA_TABLE_KEYS).size).toBe(DATA_TABLES.length);
    for (const t of DATA_TABLES) {
      expect(t.key, t.key).toMatch(/^[a-z][A-Za-z0-9]{0,39}$/);
      expect(['coach', 'admin', 'csv', 'edit', 'bulk']).not.toContain(t.key);
      expect(dataTableByKey[t.key]).toBe(t);
      const keys = t.columns.map((col) => col.key);
      expect(new Set(keys).size, t.key).toBe(keys.length);
      for (const k of keys) expect(k, `${t.key}.${k}`).toMatch(/^[a-z][A-Za-z0-9]*$/);
    }
    expect(dataTableByKey.constructor).toBeUndefined();
    expect(dataTableByKey.toString).toBeUndefined();
  });

  it('lists the groups in order, every table in one of them, each group holding something', () => {
    expect(DATA_TABLE_GROUPS.map((g) => g.name)).toEqual(['Daily', 'Pillars', 'Reviews', 'Body and mind', 'Journal', 'Money', 'Learning', 'People', 'Account']);
    const order = DATA_TABLE_GROUPS.map((g) => g.key);
    const seen = DATA_TABLES.map((t) => order.indexOf(t.group));
    expect(seen.every((i) => i >= 0)).toBe(true);
    expect([...seen].sort((a, b) => a - b)).toEqual(seen);
    for (const g of DATA_TABLE_GROUPS) expect(DATA_TABLES.some((t) => t.group === g.key), g.key).toBe(true);
  });

  it('reads only columns the migrations made, on the tables they made', () => {
    for (const t of DATA_TABLES) {
      expect(SCHEMA.tables.has(t.sqlTable), t.sqlTable).toBe(true);
      for (const r of refsOf(t)) expect(SCHEMA.tables.get(r.table)?.has(r.column), `${t.key}: ${r.table}.${r.column} in ${r.text}`).toBe(true);
    }
  });

  it('filters every read by its owner, through an index on that owner (0144 adds the four still missing)', () => {
    // Tables whose owner column has no index yet; migration 0144 adds them, and then this list empties (the test fails until it does).
    const PENDING = new Set<string>();
    for (const t of DATA_TABLES) {
      expect(t.owner, t.key).toMatch(/\?1/);
      const owners = [...t.owner.matchAll(/\bt\.(\w+)\s*=\s*\?1/g)].map((m) => m[1]!);
      expect(owners.length, t.key).toBeGreaterThan(0);
      for (const col of owners) {
        const name = `${t.sqlTable}.${col}`;
        const indexed = SCHEMA.leads.get(t.sqlTable)?.has(col) ?? false;
        if (PENDING.has(name)) expect(indexed, `${name} has its index now: take it off PENDING`).toBe(false);
        else expect(indexed, `${name} needs an index whose first column is ${col}`).toBe(true);
      }
    }
  });

  it('never lists a secret, a code, a link key, a signed name, a snapshot or another person’s id', () => {
    const SENSITIVE = /hash|salt|token|secret|password|session|(^|_)code$|key$/i;
    // Named on purpose, each with why it is safe.
    const ALLOWED: Record<string, string> = {
      'credit_ledger.input_tokens': 'a count of model tokens, not a secret',
      'credit_ledger.output_tokens': 'a count of model tokens, not a secret',
      'badge_awards.badge_key': 'the badge’s own public key, never shown raw',
      'attendance.session_id': 'a cohort class meeting, not a sign-in session',
      'cohort_sessions.id': 'a cohort class meeting, not a sign-in session',
    };
    const NEVER = new Set([
      'signed_name', 'snapshot_json', 'password_hash', 'password_salt', 'email', 'phone', 'birth_date', 'friend_code', 'referral_code', 'code',
      'coupon_code', 'affiliate_code', 'discount_code_id', 'provider_order_id', 'provider_payment_id', 'click_id', 'source_link_id', 'meeting_url',
      'online_url', 'client_ref', 'source_id', 'ref', 'hidden_by', 'pinned_by', 'actor_id', 'platform_fee_points', 'portal_token', 'log_id_raw',
    ]);
    for (const t of DATA_TABLES) {
      for (const r of refsOf(t)) {
        const name = `${r.table}.${r.column}`;
        if (!ALLOWED[name]) expect(SENSITIVE.test(r.column), `${t.key}: ${name}`).toBe(false);
        expect(NEVER.has(r.column), `${t.key}: ${name}`).toBe(false);
        // A user row joined in gives a name or a handle, never anything else of theirs.
        if (r.table === 'users') expect(['id', 'display_name', 'handle'], `${t.key}: ${name}`).toContain(r.column);
      }
      for (const col of t.columns) if (col.key !== 'tokensIn' && col.key !== 'tokensOut') expect(SENSITIVE.test(col.key), `${t.key}.${col.key}`).toBe(false);
      // A coach's id on a task is only ever asked "is there one?" (Made by), never read.
      for (const text of sqlTextsOf(t)) for (const m of text.matchAll(/added_by(.{0,12})/g)) expect(m[1], t.key).toMatch(/^ IS NOT NULL/);
    }
  });

  it('keeps an archive only where the app already has one: tasks and inbox notes', () => {
    expect(DATA_TABLES.filter((t) => t.archive).map((t) => t.key).sort()).toEqual(['inbox', 'tasks']);
    for (const t of DATA_TABLES.filter((x) => x.archive)) {
      expect(t.archive!.remove.method).toBe('DELETE');
      expect(t.archive!.archivedWhere).not.toBe(t.archive!.activeWhere);
    }
    // Delete forever is guarded at the moment of deleting, not only by the bulk route's check before it: a task brought back in another tab
    // in between stays. A task's delete asks the route for an archived one only; an inbox note's delete route takes only an archived note.
    expect(dataTableByKey.tasks!.archive!.remove.path).toBe('/nodes/:id?archived=1');
    const nodesSrc = readFileSync(new URL('../../../apps/api/src/routes/nodes.ts', import.meta.url), 'utf8');
    expect(nodesSrc).toContain("c.req.query('archived') === '1'");
    expect(nodesSrc).toMatch(/AND \(\?3 = 0 OR status = 'archived'\)/);
    const inboxSrc = readFileSync(new URL('../../../apps/api/src/routes/inbox.ts', import.meta.url), 'utf8');
    expect(inboxSrc).toMatch(/DELETE FROM notifications WHERE id = \? AND user_id = \? AND archived_at IS NOT NULL/);
  });

  it('never shows an admin the journal, gratitude or any body and mind table, and hides nothing else from them', () => {
    const hidden = DATA_TABLES.filter((t) => t.adminHidden).map((t) => t.key);
    const expected = DATA_TABLES.filter((t) => t.group === 'body' || t.group === 'journal').map((t) => t.key);
    expect(hidden.sort()).toEqual(expected.sort());
    const adminList = listTables('admin').flatMap((g) => g.tables.map((t) => t.key));
    for (const k of expected) expect(adminList).not.toContain(k);
    expect(adminList.length).toBe(DATA_TABLES.length - expected.length);
    expect(listTables('admin').map((g) => g.name)).not.toContain('Body and mind');
  });

  it('gives a coach only the tables shared with them, and only known ones', () => {
    expect(listTables('coach')).toEqual([]);
    expect(listTables('coach', ['mood', 'tasks']).flatMap((g) => g.tables.map((t) => t.key))).toEqual(['tasks', 'mood']);
    expect(knownTableKeys(['mood', 'constructor', 'mood', 42, 'tasks', 'nope'])).toEqual(['tasks', 'mood']);
    expect(knownTableKeys('mood')).toEqual([]);
    // The coach share keeps table keys by shape; the server keeps only known ones.
    expect(parseCoachShare('{"tables":["mood","Bad Key","mood","x;drop",7]}').tables).toEqual(['mood']);
    expect(parseCoachShare('{}').tables).toEqual([]);
    expect(parseCoachShare('{"tables":"mood"}').tables).toEqual([]);
  });

  it('holds every column and edit together: expressions, derives, cells, routes and rules', () => {
    for (const t of DATA_TABLES) {
      if (t.read === 'memory') expect(t.reader && t.memoryMax, t.key).toBeTruthy();
      expect(tableColumn(t, t.defaultSort.key)?.sortable, `${t.key} default sort`).toBe(true);
      if (t.dayCell) expect(tableColumn(t, t.dayCell), t.key).toBeTruthy();
      for (const col of t.columns) {
        const id = `${t.key}.${col.key}`;
        if (t.read === 'sql') {
          if (col.sortable) expect(col.sql ?? col.sortSql, `${id} sorts`).toBeTruthy();
          if (col.filter) expect(col.sql ?? col.filterSql, `${id} filters`).toBeTruthy();
          if (col.searchable) expect(col.sql ?? col.searchSql, `${id} searches`).toBeTruthy();
          if (!col.sql) expect(col.derive, `${id} has a sql or a derive`).toBeTruthy();
        } else expect(col.sql, `${id}: a memory table's reader fills it`).toBeNull();
        if (col.derive) {
          expect([...LEAF_DERIVES, ...SERVER_DERIVES], id).toContain(col.derive);
          for (const f of col.from ?? []) expect(t.privateSelect?.[f] !== undefined || !!tableColumn(t, f), `${id} reads ${f}`).toBe(true);
        }
        if (col.kind === 'money') expect(col.currency === 'person' || !!tableColumn(t, col.currency ?? ''), id).toBe(true);
        if (col.filter === 'pick' && col.kind !== 'bool') expect(col.options || col.dynamic, `${id} has choices`).toBeTruthy();
        if (col.filter === 'range') expect(['date', 'datetime'], id).toContain(col.kind);
        for (const o of col.options ?? []) expect(o.value, id).toMatch(/^[A-Za-z0-9 _:.-]*$/);
        if (col.options) expect(new Set(col.options.map((o) => o.value)).size, id).toBe(col.options.length);
        const e = col.edit;
        if (!e) continue;
        expect(col.hidden, `${id}: a hidden cell is never edited`).toBeFalsy();
        expect(col.ownerOnly, id).toBeFalsy();
        if (e.param) expect(tableColumn(t, e.param), `${id} param`).toBeTruthy();
        if (e.current) expect(tableColumn(t, e.current), `${id} current`).toBeTruthy();
        if (e.when === 'recent' || e.when === 'recentEat' || e.when === 'recentOwnMove') expect(t.dayCell, `${id} needs a dayCell`).toBeTruthy();
        if (e.when === 'recentEat') expect(tableColumn(t, 'legacy')?.hidden, id).toBe(true);
        if (e.when === 'handInOpen') expect(tableColumn(t, 'enrolStatus')?.hidden, id).toBe(true);
        if (e.input === 'select') expect(col.options || e.choices, `${id} select has choices`).toBeTruthy();
        if (e.path.includes(':id') && !e.param) expect(true).toBe(true);
      }
      // A table with nothing to change says why.
      if (!t.columns.some((col) => col.edit) && !t.archive) expect(t.readOnlyWhy, t.key).toBeTruthy();
    }
  });

  it('edits and archives only through routes that exist, as the app mounts them', () => {
    const MOUNTS: [string, string][] = [
      ['/fitness/supplements', 'routes/supplements.ts'],
      ['/fitness', 'routes/fitness.ts'],
      ['/nodes', 'routes/nodes.ts'],
      ['/today', 'routes/today.ts'],
      ['/time-blocks', 'routes/timeBlocks.ts'],
      ['/wellbeing', 'routes/wellbeing.ts'],
      ['/journal', 'routes/journal.ts'],
      ['/inbox', 'routes/inbox.ts'],
      ['/reminders', 'routes/reminders.ts'],
      ['/finance', 'routes/finance.ts'],
      ['/reviews', 'routes/reviews.ts'],
      ['/school', 'routes/school.ts'],
      ['/me/legal', 'routes/legal.ts'],
    ];
    const index = readFileSync(new URL('../../../apps/api/src/index.ts', import.meta.url), 'utf8');
    const check = (method: string, path: string, why: string) => {
      const mount = MOUNTS.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`));
      expect(mount, `${why}: ${path} has a known mount`).toBeTruthy();
      const [prefix, file] = mount!;
      if (prefix !== '/fitness/supplements') expect(index.includes(`app.route('${prefix}',`), `${prefix} is mounted`).toBe(true);
      const rest = path.slice(prefix.length) || '/';
      const src = readFileSync(new URL(`../../../apps/api/src/${file}`, import.meta.url), 'utf8');
      const segs = rest.split('/').filter(Boolean).map((s) => (s.startsWith(':') ? ':\\w+' : `(?:${s.replace(/[-]/g, '\\-')}|:\\w+)`));
      const re = new RegExp(`\\.${method.toLowerCase()}\\('/${segs.join('/')}'`);
      expect(re.test(src), `${why}: ${method} ${path} in ${file}`).toBe(true);
    };
    for (const t of DATA_TABLES) {
      for (const col of t.columns) if (col.edit) check(col.edit.method, col.edit.path, `${t.key}.${col.key}`);
      if (t.archive) for (const call of [t.archive.archive, t.archive.restore, t.archive.remove]) check(call.method, call.path, t.key);
    }
  });

  it('speaks plainly: never "database", every name, blurb and label present', () => {
    for (const t of DATA_TABLES) {
      const words = [t.name, t.blurb, t.readOnlyWhy ?? '', ...t.columns.flatMap((col) => [col.label, col.edit?.note ?? '', ...(col.options ?? []).map((o) => o.label)])].join(' ');
      expect(words.toLowerCase(), t.key).not.toContain('database');
      expect(words.toLowerCase(), t.key).not.toContain('kreators life');
      expect(t.name.length && t.blurb.length, t.key).toBeTruthy();
      expect(t.blurb.length, t.key).toBeLessThanOrEqual(90);
    }
  });
});

describe('All tables: the words match the app’s own lists', () => {
  const pairs = (o: readonly ColumnOption[]) => o.filter((x) => !x.isNull).map((x) => [x.value, x.label]);
  it('pillars, areas, priorities, bottlenecks, layers and periods', () => {
    expect(pairs(PILLAR_OPTIONS)).toEqual(RELATIONSHIPS.map((r) => [r.key, r.name]));
    expect(pairs(LIFE_AREA_OPTIONS)).toEqual(LIFE_AREA_ORDER.map((k) => [k, LIFE_AREAS[k].name]));
    expect(pairs(PRIORITY_OPTIONS)).toEqual(PRIORITIES.map((p) => [String(p.value), `${p.tag} ${p.name}`]));
    expect(pairs(OPEN_KIND_OPTIONS)).toEqual(OPEN_KINDS.map((k) => [k, openTag(k)]));
    expect(pairs(LAYER_OPTIONS)).toEqual((['pillar', 'principle', 'value_goal', 'outcome', 'project'] as const).map((k) => [k, KIND_META[k].label]));
    expect(pairs(PERIOD_OPTIONS)).toEqual(Object.entries(PERIOD_META).map(([k, m]) => [k, m.short]));
  });
  it('the life map, the contract and the trackers', () => {
    expect(pairs(MAP_LEVEL_OPTIONS)).toEqual([...MAP_LEVELS].reverse().map((l) => [String(l.value), l.name]));
    expect(pairs(MAP_BAND_OPTIONS)).toEqual((['realization', 'empowerment', 'victim'] as const).map((k) => [k, MAP_BAND_META[k].name]));
    expect(pairs(PENALTY_OPTIONS)).toEqual(PENALTIES.map((p) => [p.key, p.name]));
    expect(pairs(MOOD_OPTIONS)).toEqual(MOODS.map((m) => [String(m.value), m.name]));
    expect(pairs(STRESS_OPTIONS)).toEqual(STRESS_LEVELS.map((s, i) => [String(i + 1), s]));
    expect(pairs(STRESSOR_OPTIONS)).toEqual(STRESSORS.map((s) => [s, s]));
    expect(pairs(EFFORT_OPTIONS)).toEqual(EFFORT_LEVELS.map((s, i) => [String(i + 1), s]));
    expect(pairs(MOVE_KIND_OPTIONS)).toEqual(Object.entries(MOVE_KIND_META).map(([k, m]) => [k, m.name]));
    expect(pairs(EAT_PACKAGED_OPTIONS)).toEqual(EAT_PACKAGED.map((s, i) => [String(i), s]));
    expect(pairs(EAT_FULLNESS_OPTIONS)).toEqual(EAT_FULLNESS.map((s, i) => [String(i), s]));
    expect(pairs(FOCUS_QUALITY_OPTIONS)).toEqual(FOCUS_QUALITY.map((q) => [String(q.value), q.name]));
    expect(pairs(SUPPLEMENT_KIND_OPTIONS)).toEqual(Object.entries(SUPPLEMENT_KIND_META).map(([k, m]) => [k, m.name]));
    expect(pairs(SUPPLEMENT_TIME_OPTIONS)).toEqual(Object.entries(SUPPLEMENT_TIME_META).map(([k, m]) => [k, m.name]));
  });
  it('money, the shop, community, the inbox, privacy, badges and blocks', () => {
    expect(pairs(CURRENCY_OPTIONS).map(([k]) => k)).toEqual([...CURRENCIES]);
    expect(pairs(INCOME_CATEGORY_OPTIONS).map(([k]) => k)).toEqual([...INCOME_CATEGORIES]);
    expect(pairs(EXPENSE_CATEGORY_OPTIONS).map(([k]) => k)).toEqual([...EXPENSE_CATEGORIES]);
    expect(pairs(PRODUCT_KIND_OPTIONS)).toEqual(Object.entries(PRODUCT_KIND_META).map(([k, m]) => [k, m.name]));
    expect(pairs(AGENT_OPTIONS)).toEqual(Object.entries(AGENT_META).map(([k, m]) => [k, m.name]));
    expect(pairs(POST_CATEGORY_OPTIONS).map(([k]) => k)).toEqual([...POST_CATEGORIES]);
    expect(INBOX_TAB_KINDS.map(([tab, name, kinds]) => [tab, name, [...kinds]])).toEqual(INBOX_TABS.filter((t) => t !== 'all').map((t) => [t, INBOX_TAB_META[t].name, [...INBOX_TAB_META[t].kinds]]));
    expect(pairs(CONSENT_OPTIONS)).toEqual(CONSENT_PURPOSES.map((p) => [p.key, p.name]));
    expect(pairs(BADGE_FAMILY_OPTIONS).map(([k]) => k).sort()).toEqual(Object.keys(BADGE_FAMILY_META).sort());
    expect(pairs(TIME_BLOCK_SWATCH_OPTIONS).map(([k]) => k)).toEqual([...TIME_BLOCK_SWATCHES]);
  });
  it('the module, its how-to and its word', () => {
    const m = MODULE_BY_KEY.tables;
    expect(m).toMatchObject({ name: 'All tables', group: 'core', path: '/tables', defaultOn: true, minRole: 'user' });
    expect(m?.locked).toBeFalsy();
    expect(HOW_TO.tables?.steps.join(' ')).toContain(formatCount(CSV_MAX_ROWS));
    expect(HOW_TO.tables?.steps.join(' ').toLowerCase()).not.toContain('database');
  });
});

describe('All tables: the query', () => {
  const tasks = dataTableByKey.tasks!;
  const mood = dataTableByKey.mood!;
  it('reads a clean address and drops anything unknown', () => {
    const q = parseTableQuery(tasks, new URLSearchParams('page=3&size=50&sort=priority&dir=asc&q=%20edit%20%20vlog%20&f_priority=1&f_status=done&f_remember=yes&f_doDate_from=2026-11-01&f_doDate_to=2026-11-30&view=archived&count=1'));
    expect(q).toMatchObject({ page: 3, size: 50, sort: 'priority', dir: 'asc', q: 'edit vlog', view: 'archived', count: true });
    expect({ ...q.filters }).toEqual({ priority: '1', status: 'done', remember: 'yes' });
    expect({ ...q.ranges }).toEqual({ doDate: { from: '2026-11-01', to: '2026-11-30' } });
  });
  it('refuses unknown sorts, filters, sizes, days, views and "constructor"', () => {
    const q = parseTableQuery(tasks, { page: '-2', size: '7', sort: 'constructor', dir: 'sideways', f_constructor: 'x', f_priority: '9', f_status: 'constructor', f_remember: 'maybe', f_doDate_from: '2026-11-31', f_timeBlock: '../x', view: 'everything' });
    expect(q).toMatchObject({ page: 1, size: 10, sort: 'createdAt', dir: 'desc', q: '', view: 'active', count: false });
    expect(Object.keys(q.filters)).toEqual([]);
    expect(Object.keys(q.ranges)).toEqual([]);
    expect(Object.getPrototypeOf(q.filters)).toBeNull();
    expect(parseTableQuery(tasks, { sort: 'toString' }).sort).toBe('createdAt');
    expect(parseTableQuery(tasks, { sort: 'hidden' }).sort).toBe('createdAt'); // not sortable
    expect(parseTableQuery(mood, { view: 'archived' }).view).toBeNull();
    for (const size of ['10', '25', '50', '100']) expect(parseTableQuery(tasks, { size }).size).toBe(Number(size));
    expect(parseTableQuery(tasks, { q: 'x'.repeat(200) }).q.length).toBe(80);
    expect(parseTableQuery(tasks, { f_doDate_from: '2026-11-30', f_doDate_to: '2026-11-01' }).ranges.doDate).toEqual({ from: '2026-11-01', to: '2026-11-30' });
  });
  it('never lets a coach or an admin sort, filter or search by an owner-only column', () => {
    const inbox = dataTableByKey.inbox!;
    expect(parseTableQuery(inbox, { q: 'hi' }, 'coach').q).toBe('hi'); // the title is still searchable
    expect(visibleColumns(inbox, 'coach').map((col) => col.key)).not.toContain('body');
    expect(visibleColumns(inbox, 'owner').map((col) => col.key)).toContain('body');
  });
  it('writes the address back with the defaults left out', () => {
    const q = parseTableQuery(tasks, { page: '2', sort: 'title', dir: 'asc', f_priority: 'none', count: '1' });
    expect(tableQueryString(tasks, q)).toBe('page=2&sort=title&dir=asc&f_priority=none&count=1');
    expect(tableQueryString(tasks, q, { page: false, count: false })).toBe('sort=title&dir=asc&f_priority=none');
    expect(tableQueryString(tasks, parseTableQuery(tasks, {}))).toBe('');
    expect(parseTableQuery(tasks, new URLSearchParams(tableQueryString(tasks, q)))).toEqual(q);
  });
});

describe('All tables: the SQL', () => {
  const ctx = { view: 'owner' as const, ownerId: 'u1', viewerId: 'u1', today: '2026-11-13', zone: 'Asia/Kolkata' };
  /** Every ?N is bound and every bind is used. */
  const balanced = (sql: string, binds: unknown[]) => {
    const used = new Set([...sql.matchAll(/\?(\d+)/g)].map((m) => Number(m[1])));
    expect([...used].sort((a, b) => a - b)).toEqual(binds.map((_, i) => i + 1));
  };
  it('binds every typed word, day and id, and never writes them into the SQL', () => {
    const evil = "x' OR 1=1 --%_\\";
    const q = parseTableQuery(dataTableByKey.tasks!, { q: evil, f_timeBlock: 'blk_1', f_doDate_from: '2026-11-01', f_createdAt_to: '2026-11-13', count: '1', sort: 'priority' });
    const s = tableSql(dataTableByKey.tasks!, q, ctx);
    expect(s.sql).not.toContain('OR 1=1');
    expect(s.sql).not.toContain('blk_1');
    expect(s.sql).not.toContain('2026-11-01');
    expect(s.binds[0]).toBe('u1');
    expect(s.binds).toContain('blk_1');
    expect(s.binds).toContain(likePattern(evil));
    expect(likePattern(evil)).toBe("%x' OR 1=1 --\\%\\_\\\\%");
    expect(s.sql).toContain("ESCAPE '\\'");
    expect(s.sql).toMatch(/ORDER BY .*CASE t\.priority WHEN '0' THEN 0/);
    expect(s.sql).toMatch(/LIMIT \?\d+ OFFSET \?\d+$/);
    balanced(s.sql, s.binds);
    // A subquery SQLite cannot flatten (LIMIT -1), so the count drops the LEFT JOINs nothing reads.
    expect(s.countSql).toMatch(/^SELECT COUNT\(\*\) AS n FROM \(SELECT 1 FROM nodes t .* LIMIT -1\)$/);
    balanced(s.countSql!, s.countBinds);
    expect(s.countBinds).not.toContain(26);
  });
  it('builds every table’s page, count, CSV read and one-row read for every viewer, all balanced', () => {
    for (const t of DATA_TABLES.filter((x) => x.read === 'sql')) {
      for (const view of ['owner', 'coach', 'admin'] as const) {
        const q = parseTableQuery(t, { count: '1', q: 'a' }, view);
        const s = tableSql(t, q, { ...ctx, view, viewerId: 'c9' });
        balanced(s.sql, s.binds);
        if (s.countSql) balanced(s.countSql, s.countBinds);
        const one = tableSql(t, q, { ...ctx, view, id: 'row1' });
        balanced(one.sql, one.binds);
        expect(one.countSql).toBeNull();
        expect(one.sql).not.toMatch(/LIMIT \?\d/);
        if (view !== 'owner') for (const col of t.columns.filter((x) => x.ownerOnly)) expect(s.sql, `${t.key}.${col.key}`).not.toContain(`AS "${col.key}"`);
      }
      const csv = tableSql(t, parseTableQuery(t, {}), { ...ctx, limit: CSV_MAX_ROWS + 1, offset: 0 });
      expect(csv.binds.slice(-2)).toEqual([CSV_MAX_ROWS + 1, 0]);
    }
  });
  it('holds a download to CSV_MAX_CELLS cells, so a wide table gives fewer rows a file', () => {
    for (const t of DATA_TABLES) {
      for (const view of ['owner', 'coach', 'admin'] as const) {
        const max = csvMaxRows(t, view);
        expect(max, `${t.key} ${view}`).toBeLessThanOrEqual(CSV_MAX_ROWS);
        expect(max * visibleColumns(t, view).length, `${t.key} ${view}`).toBeLessThanOrEqual(CSV_MAX_CELLS);
        expect(max, `${t.key} ${view}`).toBeGreaterThan(1000);
      }
    }
    expect(csvMaxRows(dataTableByKey.tasks!, 'owner')).toBeLessThan(CSV_MAX_ROWS);
    expect(csvMaxRows(dataTableByKey.xpHistory!, 'owner')).toBe(CSV_MAX_ROWS);
  });
  it('asks a coach only for their own notes and never for an anonymous post', () => {
    const notes = tableSql(dataTableByKey.coachNotes!, parseTableQuery(dataTableByKey.coachNotes!, {}), { ...ctx, view: 'coach', viewerId: 'coach7' });
    expect(notes.sql).toMatch(/t\.coach_id = \?\d/);
    expect(notes.binds).toContain('coach7');
    const own = tableSql(dataTableByKey.coachNotes!, parseTableQuery(dataTableByKey.coachNotes!, {}), ctx);
    expect(own.sql).not.toContain('t.coach_id =');
    expect(tableSql(dataTableByKey.posts!, parseTableQuery(dataTableByKey.posts!, {}), { ...ctx, view: 'coach' }).sql).toContain('t.anonymous = 0');
    // A social xp, a social point or a reply note lands the moment a line was written: its time would say who wrote an anonymous one.
    const coachOf = (key: string, view: 'owner' | 'coach' | 'admin' = 'coach') => {
      const t = dataTableByKey[key]!;
      const q = parseTableQuery(t, { count: '1' }, view);
      return tableSql(t, q, { ...ctx, view, viewerId: view === 'owner' ? 'u1' : 'coach7' });
    };
    const said: [string, string][] = [
      ['xpHistory', "t.source NOT LIKE 'social:%'"],
      ['points', "t.reason NOT LIKE 'social:%'"],
      ['inbox', "t.kind NOT IN ('reply', 'thread', 'moderation', 'team')"],
    ];
    for (const [key, cond] of said) {
      const s = coachOf(key);
      expect(s.sql, key).toContain(cond);
      expect(s.countSql, key).toContain(cond);
      expect(coachOf(key, 'owner').sql, key).not.toContain(cond);
    }
    // The stored reasons of a like's and a follow's point (rewardSocial writes `social:<kind>`), so the owner reads them by name.
    const reasons = dataTableByKey.points!.columns.find((col) => col.key === 'reason')!.options!.map((o) => o.value);
    expect(reasons).toEqual(expect.arrayContaining(['social:liked', 'social:follower']));
  });
  it('never shows anyone but the owner an inbox’s supplement or focus nudge, which are body and mind', () => {
    const t = dataTableByKey.inbox!;
    for (const view of ['coach', 'admin'] as const) {
      const s = tableSql(t, parseTableQuery(t, { count: '1' }, view), { ...ctx, view, viewerId: 'v9' });
      expect(s.sql, view).toContain("t.id >= 'supp-' AND t.id < 'supp.'");
      expect(s.sql, view).toContain("t.id >= 'focus-' AND t.id < 'focus.'");
      expect(s.countSql, view).toContain("t.id >= 'supp-'");
    }
    expect(tableSql(t, parseTableQuery(t, {}), ctx).sql).not.toContain("'supp-'");
  });
  it('leaves out of a coach’s view anyone with a block by name either way with that coach', () => {
    for (const key of ['friends', 'following', 'followers']) {
      const t = dataTableByKey[key]!;
      const coach = tableSql(t, parseTableQuery(t, { count: '1' }, 'coach'), { ...ctx, view: 'coach', viewerId: 'coach7' });
      expect(coach.sql, key).toContain('FROM blocks bn');
      expect(coach.sql, key).toMatch(/bn\.by_name = 1/);
      expect(coach.binds, key).toContain('coach7');
      expect(coach.countSql, key).toContain('FROM blocks bn');
      for (const view of ['owner', 'admin'] as const) expect(tableSql(t, parseTableQuery(t, {}, view), { ...ctx, view }).sql, `${key} ${view}`).not.toContain('FROM blocks bn');
    }
  });
  it('reads instants by the subject’s own midnight and keeps the archive view apart', () => {
    const t = dataTableByKey.tasks!;
    const s = tableSql(t, parseTableQuery(t, { f_createdAt_from: '2026-11-13', f_createdAt_to: '2026-11-13', view: 'archived' }), ctx);
    expect(s.binds).toContain('2026-11-12T18:30:00.000Z');
    expect(s.binds).toContain('2026-11-13T18:30:00.000Z');
    expect(s.sql).toContain("t.status = 'archived'");
    expect(s.sql).not.toContain("t.status IN ('active', 'done')");
  });
  it('binds a number for a filter on numbers stored in JSON, so a stored 4 matches', () => {
    const t = dataTableByKey.sleep!;
    const s = tableSql(t, parseTableQuery(t, { f_quality: '4' }), ctx);
    expect(s.binds).toContain(4);
    const none = tableSql(t, parseTableQuery(t, { f_quality: 'none' }), ctx);
    expect(none.sql).toContain("(json_extract(t.extra, '$.quality')) IS NULL");
  });
});

describe('All tables: rows, edits and words out', () => {
  const today = '2026-11-13';
  it('turns a raw row into cells, with the leaf derives done and nothing private sent', () => {
    const t = dataTableByKey.reminders!;
    const { row, fields } = rowFromRaw(t, { _id: 'r1', title: 'Water plants', time: '08:00', enabled: 1, lastSent: null, createdAt: '2026-11-01T00:00:00.000Z', _p_days: '[1,2,3,4,5]' }, 'owner');
    expect(row).toEqual({ id: 'r1', cells: { title: 'Water plants', time: '08:00', days: 'Weekdays', enabled: true, lastSent: null, createdAt: '2026-11-01T00:00:00.000Z' } });
    expect(fields.days).toBe('[1,2,3,4,5]');
    expect(weekdayWords([7, 1, 2, 3, 4, 5, 6])).toBe('Every day');
    expect(weekdayWords([6, 7])).toBe('Weekends');
    expect(weekdayWords([1, 3, 5])).toBe('Mon, Wed, Fri');
    const rv = rowFromRaw(dataTableByKey.reviews!, { _id: 'v', _p_prompts: '["What went well?","What next?"]', _p_answers: '["The edit",""]' }, 'owner').row;
    expect(rv.cells.answered).toBe('1 of 2');
    expect(rv.cells.answers).toBe('What went well?: The edit');
    expect(rv.cells.name).toBeNull(); // the server fills an empty name
    // Planned once per table and viewer: a private field wins over a cell of its name only when the raw row has it, and a coach's or an
    // admin's row never holds an owner-only cell, whichever viewer read the table first.
    const tasks = dataTableByKey.tasks!;
    expect(rowFromRaw(tasks, { _id: 't1', title: 'A' }, 'owner').fields.repeat).toBeNull();
    expect(rowFromRaw(tasks, { _id: 't1', title: 'A', _p_repeat: '{"kind":"daily"}' }, 'owner').fields.repeat).toBe('{"kind":"daily"}');
    const inbox = dataTableByKey.inbox!;
    const raw = { _id: 'n1', title: 'Hi', body: 'Words', link: '/today' };
    expect('body' in rowFromRaw(inbox, raw, 'coach').row.cells).toBe(false);
    expect(rowFromRaw(inbox, raw, 'owner').row.cells.body).toBe('Words');
    expect('body' in rowFromRaw(inbox, raw, 'admin').row.cells).toBe(false);
  });
  it('says which cells the owner may change on a row, by its own rules', () => {
    const tasks = dataTableByKey.tasks!;
    expect(editableKeys(tasks, { status: 'active' }, today)).toEqual(expect.arrayContaining(['title', 'project', 'hidden']));
    expect(editableKeys(tasks, { status: 'done' }, today)).not.toContain('project');
    const move = dataTableByKey.movement!;
    expect(editableKeys(move, { day: today, loggedBy: null }, today)).toContain('minutes');
    expect(editableKeys(move, { day: '2026-11-12', loggedBy: null }, today)).toContain('minutes');
    expect(editableKeys(move, { day: '2026-11-11', loggedBy: null }, today)).toEqual([]);
    expect(editableKeys(move, { day: today, loggedBy: 'run' }, today)).toEqual([]);
    const eat = dataTableByKey.eating!;
    expect(editableKeys(eat, { day: today, legacy: true }, today)).toEqual([]);
    const hand = dataTableByKey.handIns!;
    expect(editableKeys(hand, { status: 'changes', enrolStatus: 'enrolled' }, today)).toEqual(['url', 'text']);
    expect(editableKeys(hand, { status: 'approved', enrolStatus: 'enrolled' }, today)).toEqual([]);
    expect(editableKeys(dataTableByKey.points!, {}, today)).toEqual([]);
  });
  it('checks a value and turns it into what the route gets', () => {
    const tasks = dataTableByKey.tasks!;
    const col = (k: string) => tableColumn(tasks, k)!;
    expect(editValue(col('title'), '  Edit vlog  ')).toEqual({ value: 'Edit vlog' });
    expect(editValue(col('title'), '   ')).toEqual({ error: 'This one cannot be empty.' });
    // A note can be emptied, as on Daily (it has no least length).
    expect(editValue(col('note'), '')).toEqual({ value: '' });
    expect(editValue(col('note'), '   ')).toEqual({ value: '' });
    expect(editValue(col('title'), 'x'.repeat(141))).toHaveProperty('error');
    expect(editValue(col('priority'), '1')).toEqual({ value: 1 });
    expect(editValue(col('priority'), 'none')).toEqual({ value: null });
    expect(editValue(col('priority'), null)).toEqual({ value: null });
    expect(editValue(col('priority'), 'constructor')).toHaveProperty('error');
    expect(editValue(col('habit'), 'no')).toEqual({ value: false });
    expect(editValue(col('hidden'), 'shown')).toEqual({ value: null });
    expect(editValue(col('doDate'), '2026-02-30')).toHaveProperty('error');
    expect(editValue(col('doDate'), null)).toEqual({ value: null });
    expect(editValue(col('dueTime'), '24:00')).toHaveProperty('error');
    expect(editValue(col('estimate'), 601)).toHaveProperty('error');
    expect(editValue(col('remember'), 'yes')).toHaveProperty('error');
    expect(editValue(col('timeBlock'), 'b2', [{ value: 'b1', label: 'Deep work' }])).toHaveProperty('error');
    expect(editValue(col('timeBlock'), 'b1', [{ value: 'b1', label: 'Deep work' }])).toEqual({ value: 'b1' });
    expect(editValue(col('xp'), 5)).toEqual({ error: 'That column cannot be changed here.' });
    expect(editValue(tableColumn(dataTableByKey.sleep!, 'hours')!, 7.25)).toHaveProperty('error');
    expect(editValue(tableColumn(dataTableByKey.sleep!, 'hours')!, 7.5)).toEqual({ value: 7.5 });
  });
  it('builds the plain calls, and leaves the whole-object recipes to the server', () => {
    const tasks = dataTableByKey.tasks!;
    expect(plainCall(tableColumn(tasks, 'title')!, 'n1', {}, 'New', today)).toEqual({ method: 'PATCH', path: '/nodes/n1', body: { title: 'New' } });
    expect(plainCall(tableColumn(tasks, 'hidden')!, 'n1', {}, 'tomorrow', today)).toEqual({ method: 'PATCH', path: '/nodes/n1', body: { hide: 'tomorrow', today } });
    expect(plainCall(tableColumn(dataTableByKey.reviewReminders!, 'time')!, 's1', {}, '09:00', today)).toEqual({ method: 'PATCH', path: `/reviews/schedule/s1?day=${today}`, body: { time: '09:00' } });
    expect(plainCall(tableColumn(tasks, 'title')!, '../x', {}, 'New', today)).toBeNull();
    expect(plainCall(tableColumn(dataTableByKey.mood!, 'mood')!, 'm1', {}, 3, today)).toBeNull();
  });
  it('pages a whole read by the same rules as the SQL', () => {
    const t = dataTableByKey.notToDo!;
    const rows: TableRow[] = [
      { id: 'a', cells: { title: 'Phone in bed', pillar: 'self', streak: 3, bestStreak: 5, createdAt: '2026-11-01T00:00:00.000Z' } },
      { id: 'b', cells: { title: 'Late coffee', pillar: null, streak: 0, bestStreak: 2, createdAt: '2026-11-02T00:00:00.000Z' } },
      { id: 'c', cells: { title: 'Doom scroll', pillar: 'friendship', streak: null, bestStreak: 1, createdAt: '2026-11-03T00:00:00.000Z' } },
    ];
    const by = (params: Record<string, string>) => pageRows(t, rows, parseTableQuery(t, params), { view: 'owner', zone: 'Asia/Kolkata' });
    expect(by({}).rows.map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(by({ sort: 'streak', dir: 'desc' }).rows.map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(by({ sort: 'streak', dir: 'asc' }).rows.map((r) => r.id)).toEqual(['b', 'a', 'c']);
    expect(by({ f_pillar: 'none' }).rows.map((r) => r.id)).toEqual(['b']);
    expect(by({ q: 'yourself' }).rows.map((r) => r.id)).toEqual([]);
    expect(by({ q: 'COFFEE' }).rows.map((r) => r.id)).toEqual(['b']);
    expect(by({ size: '10', page: '2' })).toMatchObject({ rows: [], total: 3, page: { page: 2, more: false, empty: true } });
    expect(by({ f_createdAt_from: '2026-11-02' }).total).toBe(2);
  });
  it('writes Copy and CSV that a spreadsheet never runs', () => {
    const t = dataTableByKey.moneyInOut!;
    const cols = visibleColumns(t, 'owner').filter((col) => ['day', 'amount', 'who', 'kind'].includes(col.key));
    const rows: TableRow[] = [{ id: 'x', cells: { day: '2026-11-13', amount: 123450, currency: 'INR', who: '=HYPERLINK("http://x")', kind: 'income' } }];
    const csv = toCsv(cols, rows);
    expect(csv).toBe(`Day,In or out,Amount,Who\r\n2026-11-13,Money in,"₹1,234.50","'=HYPERLINK(""http://x"")"\r\n`);
    expect(toTsv(cols, [{ id: 'y', cells: { day: '2026-11-13', amount: -500, currency: 'USD', who: 'Line\tone\ntwo', kind: 'expense' } }])).toBe('Day\tIn or out\tAmount\tWho\n2026-11-13\tMoney out\t' + cellText(tableColumn(t, 'amount')!, { amount: -500, currency: 'USD' }) + '\tLine one two');
    const tasks = dataTableByKey.tasks!;
    expect(cellText(tableColumn(tasks, 'priority')!, { priority: null })).toBe('No priority');
    expect(cellText(tableColumn(tasks, 'remember')!, { remember: true })).toBe('Yes');
    expect(cellText(tableColumn(tasks, 'timeBlock')!, { timeBlock: 'b1' }, { options: { timeBlock: [{ value: 'b1', label: 'Deep work' }] } })).toBe('Deep work');
    expect(cellText(tableColumn(dataTableByKey.budgets!, 'monthly')!, { monthly: 500000 }, { currency: 'INR' })).toBe('₹5,000');
  });
});
