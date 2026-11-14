import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  AGENT_OPTIONS,
  aiPrivateOnly,
  andList,
  audienceOf,
  BADGE_FAMILY_OPTIONS,
  coachTableKeys,
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
  keepHiddenTables,
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
  TABLE_LIST_MAX,
  tableAllowed,
  tableAppsOn,
  tablesShownNow,
  tableColumn,
  tableReach,
  tableQueryString,
  tableSql,
  TABLE_SWITCHES,
  tableSwitchKey,
  TIME_BLOCK_SWATCH_OPTIONS,
  AGENCY_CLIENT_STATUS_OPTIONS,
  AGENCY_DOC_KIND_OPTIONS,
  AGENCY_DOC_STATUS_OPTIONS,
  AGENCY_HEALTH_OPTIONS,
  AGENCY_STAGE_OPTIONS,
  CONTRACT_STATUS_OPTIONS,
  DELIVERABLE_KIND_OPTIONS,
  DELIVERABLE_STAGE_OPTIONS,
  INVOICE_STATUS_OPTIONS,
  KPI_SOURCE_OPTIONS,
  KPI_UNIT_OPTIONS,
  NOTE_KIND_OPTIONS,
  RETAINER_DISCOUNT_CAP_BPS,
  RETAINER_MONTH_SQL,
  RETAINER_STATUS_OPTIONS,
  rowEditable,
  TEAM_LEVEL_OPTIONS,
  TEAM_ROLE_OPTIONS,
  TEAM_STATUS_OPTIONS,
  TEMPLATE_KIND_OPTIONS,
  BOOKING_STATUS_OPTIONS,
  CONTENT_KIND_OPTIONS,
  DM_STATUS_OPTIONS,
  FUNNEL_STEP_WORDS,
  LINK_SOURCE_OPTIONS,
  LEAD_SOURCE_OPTIONS,
  PRODUCT_POINTS_MAX,
  PRODUCT_STATUS_OPTIONS,
  SOCIAL_PLATFORM_OPTIONS,
  WEEKDAY_SUNDAY_FIRST_OPTIONS,
  type TableSwitch,
  toCsv,
  toTsv,
  visibleColumns,
  weekdayWords,
  type ColumnOption,
  type DataTable,
  type TableRow,
} from './dataTables';
import {
  PRODUCT_MONEY_MAX,
  AGENCY_CLIENT_STATUSES,
  AGENCY_DOC_KIND_META,
  AGENCY_DOC_STATUS_NAME,
  AGENCY_HEALTH,
  AGENCY_HEALTH_NAME,
  AGENCY_STAGES,
  AGENCY_STATUS_NAME,
  CONTRACT_STATUS_NAME,
  DELIVERABLE_KIND_NAME,
  DELIVERABLE_STAGE_META,
  INVOICE_STATUS_NAME,
  KPI_AUTO,
  KPI_UNIT_NAME,
  NOTE_KIND_NAME,
  REVISIONS_MAX,
  RETAINER_DISCOUNT_MAX_BPS,
  RETAINER_STATUS_NAME,
  retainerMonthlyCents,
  TEAM_LEVEL_NAME,
  TEAM_ROLE_META,
  TEAM_STATUS_NAME,
  TEMPLATE_KINDS,
  AGENT_META,
  BADGE_FAMILY_META,
  COACH_SHARE_TABLES_MAX,
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
  MODULE_GROUP_ORDER,
  MODULES,
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
  CONTENT_KINDS,
  LINK_SOURCES,
  LOCALE,
  productStatusLabel,
  SOCIAL_PLATFORM_META,
  statusesFor,
  type Booking,
  type DmRequest,
  type FunnelStepKind,
  type PortfolioItem,
  type ProductKind,
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
      if ((m = /^CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?["`]?(\w+)["`]?\s*\(([\s\S]*)\)\s*(WITHOUT\s+ROWID)?\s*$/i.exec(s))) {
        const name = m[2]!;
        if (tables.has(name) && m[1]) continue;
        // Every table but a WITHOUT ROWID one has its rowid, which each of its indexes keeps as its last column (a sort can end on it).
        const cols = new Set<string>(m[4] ? [] : ['rowid']);
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
  const re = /(?:^|\bJOIN\s+)(\w+)\s+(\w+)(?=\s+ON\b|\s+LEFT\b|\s+CROSS\b|\s+JOIN\b|\s*$)/g;
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
  for (const col of table.columns) for (const e of [col.sql, col.sortSql, col.filterSql, col.searchSql, ...(col.sortTerms ?? [])]) if (e) out.push(e);
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
    expect(DATA_TABLE_GROUPS.map((g) => g.name)).toEqual([
      'Daily', 'Pillars', 'Reviews', 'Business metrics', 'Body and mind', 'Journal', 'Life coaching', 'Discover and AI chat', 'Money', 'My purchases', 'Shop',
      'Audience', 'Content and Auto-DM', 'Content folders', 'Public page', 'Store', 'Tools', 'TV and Fund', 'Learning', 'Teaching', 'Work', 'Army', 'Win', 'Agency',
      'Agency paperwork', 'People', 'Community', 'Bond', 'Club', 'Party', 'Kreators Run', 'Circles', 'Rewards', 'Account', 'Invites and help',
    ]);
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
      // The owner is a column of the table itself (`t.user_id = ?1`), or of a table it joins (a business metric's value is the person's through its
      // metric, `k.user_id = ?1`): either way through an index whose first column it is.
      const aliases = aliasesOf(t);
      const owners = [...t.owner.matchAll(/\b([a-z]{1,3})\.(\w+)\s*=\s*\?1/g)].map((m) => ({ table: aliases.get(m[1]!) ?? '', col: m[2]! }));
      expect(owners.length, t.key).toBeGreaterThan(0);
      for (const { table, col } of owners) {
        expect(table, `${t.key}: the owner's alias names a table in its FROM`).not.toBe('');
        if (table !== t.sqlTable) expect(t.from, `${t.key}: a joined owner is an inner join, so no row without one is ever read`).toMatch(new RegExp(`(^|[^T] )JOIN ${table} `));
        const name = `${table}.${col}`;
        const indexed = SCHEMA.leads.get(table)?.has(col) ?? false;
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
      'honors.honor_key': 'the honor’s own public key (HONORS), read to name it and as the row’s key, never shown raw',
      'redemptions.reward_key': 'the reward’s own key in the public catalog, read only to name it, never shown raw',
      'card_unlocks.game_key': 'the game’s own key in the public catalog, read to name it and order the rows, never shown raw',
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
    const adminList = listTables('admin', [], null).flatMap((g) => g.tables.map((t) => t.key));
    for (const k of expected) expect(adminList).not.toContain(k);
    // Every table but these and the ones with other people's details (2026-11-14), which an admin never sees either.
    expect(adminList.length).toBe(DATA_TABLES.length - expected.length - DATA_TABLES.filter((t) => !t.adminHidden && audienceOf(t) === 'others').length);
    expect(listTables('admin', [], null).map((g) => g.name)).not.toContain('Body and mind');
  });

  it('gives a coach only the tables shared with them, and only known ones', () => {
    expect(listTables('coach', [], null)).toEqual([]);
    expect(listTables('coach', ['mood', 'tasks'], null).flatMap((g) => g.tables.map((t) => t.key))).toEqual(['tasks', 'mood']);
    expect(knownTableKeys(['mood', 'constructor', 'mood', 42, 'tasks', 'nope'])).toEqual(['tasks', 'mood']);
    expect(knownTableKeys('mood')).toEqual([]);
    // The coach share keeps table keys by shape; the server keeps only known ones.
    expect(parseCoachShare('{"tables":["mood","Bad Key","mood","x;drop",7]}').tables).toEqual(['mood']);
    expect(parseCoachShare('{}').tables).toEqual([]);
    expect(parseCoachShare('{"tables":"mood"}').tables).toEqual([]);
  });

  // ---------------------------------------------------------------------------------------------------------------------------------
  // Who sees a table (2026-11-14): two audiences, the apps each table needs, and the app group each category is drawn under.
  // ---------------------------------------------------------------------------------------------------------------------------------

  it('says who may see each table in one rule: the person’s own, or with other people’s details', () => {
    const own = dataTableByKey.tasks!;
    const body = dataTableByKey.mood!;
    // A table with other people's details, made here: every batch's own such table meets the same rule through the same function.
    const others: DataTable = { ...own, key: 'fakeOthers', audience: 'others' };
    expect(tableReach(own)).toEqual({ coach: true, admin: true, ai: 'any' });
    expect(tableReach(body)).toEqual({ coach: true, admin: false, ai: 'private' });
    expect(tableReach(others)).toEqual({ coach: false, admin: false, ai: 'private' });
    expect(aiPrivateOnly(others)).toBe(true);
    expect(aiPrivateOnly(own)).toBe(false);
    expect(aiPrivateOnly(body)).toBe(true);
    // Never a coach, even when a stored share names it, and never an admin; the person always.
    expect(tableAllowed(others, 'coach', ['fakeOthers'], null)).toBe(false);
    expect(tableAllowed(others, 'admin', [], null)).toBe(false);
    expect(tableAllowed(others, 'owner', [], null)).toBe(true);
    expect(tableAllowed(own, 'coach', ['tasks'], null)).toBe(true);
    // Every table in the registry: an 'others' one never reaches a coach's share, a coach's list or an admin's list.
    const everyApp = MODULES.map((m) => m.key);
    const coachList = listTables('coach', DATA_TABLE_KEYS, everyApp).flatMap((g) => g.tables.map((t) => t.key));
    const adminList = listTables('admin', [], everyApp).flatMap((g) => g.tables.map((t) => t.key));
    for (const t of DATA_TABLES) {
      const reach = tableReach(t);
      expect(['own', 'others'], t.key).toContain(audienceOf(t));
      if (audienceOf(t) === 'others') {
        expect(coachTableKeys([t.key]), t.key).toEqual([]);
        expect(coachList, t.key).not.toContain(t.key);
        expect(adminList, t.key).not.toContain(t.key);
        expect(reach.ai, t.key).toBe('private');
      } else {
        expect(coachTableKeys([t.key]), t.key).toEqual([t.key]);
        expect(reach.admin, t.key).toBe(!t.adminHidden);
      }
    }
    expect(coachTableKeys(['tasks', 'constructor', 'tasks', 7])).toEqual(['tasks']);
  });

  it('never lets anyone but the owner read another account’s row in an own table', () => {
    // An 'own' table holds nobody else's details for a coach, an admin or AI chat on a model that may keep data: a column reading another
    // person's `users` row (a join, or a subquery) is ownerOnly, or the table is 'others' (2026-11-14, the review).
    for (const t of DATA_TABLES) {
      if (audienceOf(t) === 'others') continue;
      const people = [...aliasesOf(t)].filter(([, table]) => table === 'users').map(([alias]) => alias);
      for (const col of t.columns) {
        if (col.ownerOnly) continue;
        for (const e of [col.sql, col.sortSql, col.filterSql, col.searchSql, ...(col.sortTerms ?? [])]) {
          if (!e) continue;
          expect(e, `${t.key}.${col.key}`).not.toMatch(/\bFROM\s+users\b/i);
          for (const a of people) expect(e, `${t.key}.${col.key}`).not.toMatch(new RegExp(`\\b${a}\\.`));
        }
      }
    }
  });

  it('lists a table only while an app it belongs to is on, for every view', () => {
    for (const t of DATA_TABLES) {
      if (!t.needs) continue;
      expect(t.needs.length, t.key).toBeGreaterThan(0);
      expect(new Set(t.needs).size, t.key).toBe(t.needs.length);
      for (const k of t.needs) {
        // A real app the person can switch: a locked one is always on, so naming it would mean nothing.
        expect(MODULE_BY_KEY[k], `${t.key} needs ${k}`).toBeTruthy();
        expect(MODULE_BY_KEY[k]!.locked, `${t.key} needs ${k}`).not.toBe(true);
      }
      // At least one of its apps sits in the app group its category is drawn under.
      const appGroup = DATA_TABLE_GROUPS.find((g) => g.key === t.group)!.appGroup;
      expect(t.needs.some((k) => MODULE_BY_KEY[k]!.group === appGroup), `${t.key} in ${appGroup}`).toBe(true);
    }
    const journal = dataTableByKey.journal!;
    const movement = dataTableByKey.movement!;
    const tasks = dataTableByKey.tasks!;
    expect(tableAppsOn(journal, ['tables'])).toBe(false);
    expect(tableAppsOn(journal, ['journal'])).toBe(true);
    expect(tableAppsOn(movement, ['run'])).toBe(true);
    expect(tableAppsOn(tasks, [])).toBe(true);
    for (const view of ['owner', 'coach', 'admin'] as const) expect(tableAllowed(journal, view, ['journal'], ['tables']), view).toBe(false);
    const ownKeys = listTables('owner', [], []).flatMap((g) => g.tables.map((t) => t.key));
    expect(ownKeys).toContain('tasks');
    expect(ownKeys).not.toContain('journal');
    expect(ownKeys.length).toBe(DATA_TABLES.filter((t) => !t.needs && !t.needsSwitch).length);
    // Every app on, and every setting inside one (`switch:<key>`), opens every table.
    const everything = [...MODULES.map((m) => m.key), ...Object.keys(TABLE_SWITCHES).map((k) => tableSwitchKey(k as TableSwitch))];
    expect(listTables('owner', [], everything).flatMap((g) => g.tables).length).toBe(DATA_TABLES.length);
    // A table that needs a setting inside its app (Business metrics in Reviews) opens only while both are on.
    for (const t of DATA_TABLES.filter((x) => x.needsSwitch)) {
      const sw = TABLE_SWITCHES[t.needsSwitch!];
      expect(t.needs, t.key).toContain(sw.app);
      expect(tableAppsOn(t, [sw.app]), t.key).toBe(false);
      expect(tableAppsOn(t, [tableSwitchKey(t.needsSwitch!)]), t.key).toBe(false);
      expect(tableAppsOn(t, [sw.app, tableSwitchKey(t.needsSwitch!)]), t.key).toBe(true);
    }
    expect(DATA_TABLES.filter((t) => t.needsSwitch).map((t) => t.key)).toEqual(['businessMetrics', 'businessMetricValues']);
  });

  it('carries only the tables shown now, and a whole list leaves a hidden app’s table as it was', () => {
    // A share answers with the tables whose app is on (so every count agrees and a coach never learns which app was hidden).
    expect(tablesShownNow(['tasks', 'journal', 'mood', 'nonsense', 'constructor'], ['journal'])).toEqual(['tasks', 'journal']);
    expect(tablesShownNow(['mood'], [])).toEqual([]);
    // Share none and Share all speak only for what the person can see: the hidden app's table keeps its switch for when the app comes back.
    expect(knownTableKeys(keepHiddenTables([], ['tasks', 'mood'], ['tables']))).toEqual(['mood']);
    expect(knownTableKeys(keepHiddenTables(['tasks', 'journal', 'mood'], ['mood'], ['journal'])).sort()).toEqual(['journal', 'mood', 'tasks']);
    expect(knownTableKeys(keepHiddenTables(['tasks'], ['tasks', 'journal'], ['journal']))).toEqual(['tasks']);
  });

  it('says a list of names so each one reads as one thing', () => {
    expect(andList([])).toBe('');
    expect(andList(['Tasks'])).toBe('Tasks');
    expect(andList(['Tasks', 'Mood'])).toBe('Tasks and Mood');
    expect(andList(['Daily', 'Pillars', 'Account'])).toBe('Daily, Pillars and Account');
    expect(andList(['Reviews', 'Body and mind', 'Journal'])).toBe('Reviews, Body and mind, and Journal');
    expect(andList(['Body and mind', 'Journal'])).toBe('Body and mind, and Journal');
  });

  it('draws each category under one app group, in the Apps page’s order', () => {
    for (const g of DATA_TABLE_GROUPS) expect(MODULE_GROUP_ORDER, g.key).toContain(g.appGroup);
    for (const g of listTables('owner', [], null)) expect(g.appGroup).toBe(DATA_TABLE_GROUPS.find((x) => x.key === g.key)!.appGroup);
    expect(Object.fromEntries(DATA_TABLE_GROUPS.map((g) => [g.key, g.appGroup]))).toEqual({
      daily: 'core', pillars: 'core', reviews: 'wellbeing', business: 'wellbeing', body: 'wellbeing', journal: 'wellbeing', coaching: 'wellbeing', selfAi: 'wellbeing', money: 'creator',
      purchases: 'creator', shop: 'creator', audience: 'creator', creatorContent: 'creator', contentFolders: 'creator', publicPage: 'creator', store: 'creator', tools: 'creator',
      pitches: 'creator', learning: 'earn', teaching: 'earn', work: 'earn', army: 'earn', win: 'earn', agency: 'earn', agencyPaper: 'earn', people: 'community',
      community: 'community', bond: 'community', club: 'community', party: 'community', runs: 'community', circles: 'community', rewards: 'core', account: 'core',
      invites: 'core',
    });
  });

  it('takes Share all for every table the registry will hold', () => {
    expect(DATA_TABLES.length * 2).toBeLessThanOrEqual(TABLE_LIST_MAX);
    expect(COACH_SHARE_TABLES_MAX).toBe(TABLE_LIST_MAX);
    expect(parseCoachShare(JSON.stringify({ tables: DATA_TABLE_KEYS })).tables).toEqual([...DATA_TABLE_KEYS]);
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
        if (e.when === 'recent' || e.when === 'recentEat' || e.when === 'recentOwnMove' || e.when === 'past') expect(t.dayCell, `${id} needs a dayCell`).toBeTruthy();
        if (e.when === 'recentEat') expect(tableColumn(t, 'legacy')?.hidden, id).toBe(true);
        if (e.when === 'handInOpen') expect(tableColumn(t, 'enrolStatus')?.hidden, id).toBe(true);
        if (e.input === 'select') expect(col.options || e.choices, `${id} select has choices`).toBeTruthy();
        if (e.path.includes(':id') && !e.param) expect(true).toBe(true);
        // Any other part of the path is the row's own hidden cell of that name, only ever the owner's (a piece's brand).
        for (const m of e.path.replace(':id', '').matchAll(/:([A-Za-z]\w*)/g)) expect(tableColumn(t, m[1]!)?.hidden, `${id} fills :${m[1]} from a hidden cell`).toBe(true);
        // A select offers only some of its words: each one of them, and the cell it starts from among them while the row may change.
        for (const v of e.offer ?? []) expect(col.options?.some((o) => o.value === v), `${id} offers ${v}`).toBe(true);
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
      ['/reviews/kpis', 'routes/kpis.ts'],
      ['/reviews', 'routes/reviews.ts'],
      ['/school', 'routes/school.ts'],
      // Contribution (2026-11-14): a cohort's talk, Agency's team and documents, Army, Win, a brand's team and the answer to its ask.
      ['/school/cohorts', 'routes/cohortTalk.ts'],
      ['/agency/team', 'routes/agencyTeam.ts'],
      ['/agency/docs', 'routes/agencyOther.ts'],
      ['/army', 'routes/army.ts'],
      ['/win', 'routes/win.ts'],
      ['/orgs', 'routes/orgs.ts'],
      ['/me/org-invites', 'routes/orgs.ts'],
      ['/me/legal', 'routes/legal.ts'],
      // Agency's own routes are several files mounted at /agency (index.ts); a path is found in whichever holds it.
      ['/agency', 'routes/agency.ts|routes/agencyLife.ts|routes/agencyDocs.ts'],
      // Shop's own routes are two files mounted at /studio (index.ts): the products and reviews, and the growth tools.
      ['/studio', 'routes/studio.ts|routes/growth.ts|routes/strategist.ts'],
      // The Store's pre-owned listings (the market prefix, the Store's own switch).
      ['/market', 'routes/market.ts'],
      // A Work listing's own route, and TV's and Fund's one route for a pitch.
      ['/work', 'routes/work.ts'],
      ['/proposals', 'routes/proposals.ts'],
      // Party's events (a guest's xp), a run club and a run's xp, and the event extras an event and a run share (the list to meet others).
      ['/party', 'routes/party.ts'],
      ['/run', 'routes/run.ts'],
      ['/connect', 'routes/connect.ts'],
      // A channel's name and topic: Community's and Bond's channels are one router file mounted twice (index.ts), each behind its own app.
      ['/community/channels', 'routes/channels.ts'],
      ['/bond/channels', 'routes/channels.ts'],
      // Connection (2026-11-14): Community's posts, replies, reactions, follows and mutes; Bond's friends, chats, introductions and blocks; a Club
      // application; a line at a circle's table. Each after its channels' prefix above, so a channel's path finds the channels' file first.
      ['/community', 'routes/community.ts'],
      ['/bond', 'routes/bond.ts'],
      ['/club', 'routes/club.ts'],
      ['/circles', 'routes/circles.ts'],
      // What a student shares with one coach (My coach, core), a coach's own directory card (Coaching) and the private calendar link (the Profile tab).
      ['/me/coach', 'routes/coach.ts'],
      ['/coach', 'routes/coach.ts'],
      ['/me/calendar', 'routes/calendar.ts'],
      // Discover's results and add-ons, and one Companion line (Reflection's removes, 2026-11-14).
      ['/discover', 'routes/discover.ts'],
      ['/companion', 'routes/companion.ts'],
      // Essentials (2026-11-14): routine days and the live call ask (the strategy session's file), a reward's cancel, a code's label and
      // taking it back, and a message to the team.
      ['/session', 'routes/session.ts'],
      ['/rewards', 'routes/rewards.ts'],
      ['/me/invites', 'routes/invites.ts'],
      ['/support', 'routes/support.ts'],
      // Creation (2026-11-14): a booking's cancel, a course invite's no and a review you wrote (the store prefix, core, two files), and a tool
      // you suggested.
      ['/store', 'routes/store.ts|routes/buyer.ts'],
      ['/tools', 'routes/tools.ts'],
      // A portfolio piece on the Public page. Kept last: every /me/... prefix above finds its own file first.
      ['/me', 'routes/me.ts'],
    ];
    const index = readFileSync(new URL('../../../apps/api/src/index.ts', import.meta.url), 'utf8');
    // Every mount whose prefix holds the path is tried, and one of them must hold the route (2026-11-14: School's cohort talk is mounted at
    // /school/cohorts beside School's own /school, which holds a cohort's own PATCH; Agency's team and documents beside /agency).
    const check = (method: string, path: string, why: string) => {
      const mounts = MOUNTS.filter(([prefix]) => path === prefix || path.startsWith(`${prefix}/`));
      expect(mounts.length > 0, `${why}: ${path} has a known mount`).toBe(true);
      const holds = mounts.some(([prefix, file]) => {
        if (prefix !== '/fitness/supplements' && !index.includes(`app.route('${prefix}',`)) return false;
        const rest = path.slice(prefix.length) || '/';
        const src = file.split('|').map((f) => readFileSync(new URL(`../../../apps/api/src/${f}`, import.meta.url), 'utf8')).join('\n');
        const segs = rest.split('/').filter(Boolean).map((s) => (s.startsWith(':') ? ':\\w+' : `(?:${s.replace(/[-]/g, '\\-')}|:\\w+)`));
        return new RegExp(`\\.${method.toLowerCase()}\\('/${segs.join('/')}'`).test(src);
      });
      expect(holds, `${why}: ${method} ${path} in ${mounts.map(([, f]) => f).join(' or ')}`).toBe(true);
    };
    for (const t of DATA_TABLES) {
      for (const col of t.columns) if (col.edit) check(col.edit.method, col.edit.path, `${t.key}.${col.key}`);
      if (t.archive) for (const call of [t.archive.archive, t.archive.restore, t.archive.remove]) check(call.method, call.path, t.key);
      // The selection bar's remove (2026-11-14): every route a remove can call, its fixed query left off. A remove on a new prefix needs its line
      // in MOUNTS above (the prefix and the route file or files that hold it).
      const removeCalls = t.remove ? [...(t.remove.call ? [t.remove.call] : []), ...(t.remove.outcomes ?? []).flatMap((o) => ('call' in o ? [o.call] : []))] : [];
      for (const call of removeCalls) check(call.method, call.path.split('?')[0]!, `${t.key} remove`);
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
  it('Agency and Business metrics', () => {
    expect(pairs(AGENCY_CLIENT_STATUS_OPTIONS)).toEqual(AGENCY_CLIENT_STATUSES.map((k) => [k, AGENCY_STATUS_NAME[k]]));
    expect(pairs(AGENCY_HEALTH_OPTIONS)).toEqual(AGENCY_HEALTH.map((k) => [k, AGENCY_HEALTH_NAME[k]]));
    expect(pairs(AGENCY_STAGE_OPTIONS)).toEqual(AGENCY_STAGES.map((st) => [st.key, st.name]));
    expect(pairs(DELIVERABLE_KIND_OPTIONS)).toEqual(Object.entries(DELIVERABLE_KIND_NAME));
    expect(pairs(DELIVERABLE_STAGE_OPTIONS)).toEqual(Object.entries(DELIVERABLE_STAGE_META).map(([k, m]) => [k, m.name]));
    expect(pairs(NOTE_KIND_OPTIONS)).toEqual(Object.entries(NOTE_KIND_NAME));
    expect(pairs(INVOICE_STATUS_OPTIONS)).toEqual(Object.entries(INVOICE_STATUS_NAME));
    expect(pairs(CONTRACT_STATUS_OPTIONS)).toEqual(Object.entries(CONTRACT_STATUS_NAME));
    expect(pairs(AGENCY_DOC_KIND_OPTIONS)).toEqual(Object.entries(AGENCY_DOC_KIND_META).map(([k, m]) => [k, m.name]));
    expect(pairs(AGENCY_DOC_STATUS_OPTIONS)).toEqual(Object.entries(AGENCY_DOC_STATUS_NAME));
    expect(pairs(RETAINER_STATUS_OPTIONS)).toEqual(Object.entries(RETAINER_STATUS_NAME));
    expect(pairs(TEMPLATE_KIND_OPTIONS).map(([k]) => k)).toEqual([...TEMPLATE_KINDS]);
    expect(pairs(TEAM_ROLE_OPTIONS)).toEqual(Object.entries(TEAM_ROLE_META).map(([k, m]) => [k, m.name]));
    expect(pairs(TEAM_STATUS_OPTIONS)).toEqual(Object.entries(TEAM_STATUS_NAME));
    expect(pairs(TEAM_LEVEL_OPTIONS)).toEqual(Object.entries(TEAM_LEVEL_NAME));
    expect(pairs(KPI_UNIT_OPTIONS)).toEqual(Object.entries(KPI_UNIT_NAME));
    expect(pairs(KPI_SOURCE_OPTIONS)).toEqual([['manual', 'Typed in'], ...KPI_AUTO.map((a) => [a.key, a.name])]);
    // The changes a client's piece includes: the column's own most is the app's.
    expect(tableColumn(dataTableByKey.agencyClients!, 'changes')?.edit?.max).toBe(REVISIONS_MAX);
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
  it('never asks a coach for an anonymous post, nor for what would say who wrote one', () => {
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
  it('keeps friends, follows, coach notes and the inbox for the person alone, and AI chat on a model that keeps nothing', () => {
    // Every row is another person (a friend, someone followed or following, a coach's words) or names and quotes one (an inbox note's title and
    // words), and the inbox holds the supplement and focus nudges, which are body and mind (2026-11-14, the review, on the founder's two audiences).
    for (const key of ['friends', 'following', 'followers', 'coachNotes', 'inbox']) {
      const t = dataTableByKey[key]!;
      expect(audienceOf(t), key).toBe('others');
      expect(tableReach(t), key).toEqual({ coach: false, admin: false, ai: 'private' });
      expect(aiPrivateOnly(t), key).toBe(true);
      expect(tableAllowed(t, 'coach', [key], null), key).toBe(false);
      expect(tableAllowed(t, 'admin', [], null), key).toBe(false);
      expect(coachTableKeys([key]), key).toEqual([]);
    }
  });
  it('shows another person’s name in an own table only to its owner: an order’s seller, a course maker', () => {
    for (const [key, col] of [['orders', 'seller'], ['certificates', 'from']] as const) {
      const t = dataTableByKey[key]!;
      expect(audienceOf(t), key).toBe('own');
      expect(tableColumn(t, col)!.ownerOnly, key).toBe(true);
      const own = tableSql(t, parseTableQuery(t, { q: 'Sam', count: '1' }), ctx);
      expect(own.sql, key).toMatch(new RegExp(`AS "${col}"`));
      // A coach, an admin and AI chat on a model that may keep data (read in the admin view) never get it, nor search by it.
      for (const view of ['coach', 'admin'] as const) {
        const other = tableSql(t, parseTableQuery(t, { q: 'Sam', sort: col, count: '1' }, view), { ...ctx, view, viewerId: 'v9' });
        expect(other.sql, `${key} ${view}`).not.toMatch(new RegExp(`AS "${col}"`));
        expect(other.sql, `${key} ${view}`).not.toContain('display_name');
        expect(other.countSql ?? '', `${key} ${view}`).not.toContain('display_name');
      }
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

describe('All tables: Agency and Business metrics (2026-11-14)', () => {
  const AGENCY = ['agencyClients', 'agencyPieces', 'agencyNotes', 'agencyTime', 'agencyRetainers', 'agencyLog', 'agencyTeam', 'agencyInvoices', 'agencyAgreements', 'agencyDocuments', 'agencyTemplates'];
  const BUSINESS = ['businessMetrics', 'businessMetricValues'];

  it('holds all thirteen, each with other people’s details: the person and AI chat on a model that keeps nothing, never a coach or an admin', () => {
    for (const k of [...AGENCY, ...BUSINESS]) {
      const t = dataTableByKey[k];
      expect(t, k).toBeTruthy();
      expect(audienceOf(t!), k).toBe('others');
      expect(tableReach(t!), k).toEqual({ coach: false, admin: false, ai: 'private' });
      expect(tableAllowed(t!, 'coach', [k], null), k).toBe(false);
      expect(tableAllowed(t!, 'admin', [], null), k).toBe(false);
      expect(coachTableKeys([k]), k).toEqual([]);
    }
    for (const k of AGENCY) expect(dataTableByKey[k]!.needs, k).toEqual(['agency']);
    for (const k of BUSINESS) {
      expect(dataTableByKey[k]!.needs, k).toEqual(['reviews']);
      expect(dataTableByKey[k]!.needsSwitch, k).toBe('businessMetrics');
      expect(dataTableByKey[k]!.group, k).toBe('business');
    }
    expect(DATA_TABLES.filter((t) => t.group === 'agency' || t.group === 'agencyPaper').map((t) => t.key).sort()).toEqual([...AGENCY].sort());
    // Agency's tables list only while Agency is on, and Business metrics' only while Reviews and its switch are.
    const keysFor = (on: string[]) => listTables('owner', [], on).flatMap((g) => g.tables.map((t) => t.key));
    expect(keysFor(['reviews'])).not.toContain('agencyClients');
    expect(keysFor(['agency'])).toEqual(expect.arrayContaining(AGENCY));
    expect(keysFor(['reviews'])).not.toContain('businessMetrics');
    expect(keysFor(['reviews', tableSwitchKey('businessMetrics')])).toEqual(expect.arrayContaining(BUSINESS));
  });

  it('never selects a link key, a password, a bank, a teammate’s id or a brand’s words', () => {
    const NEVER = /portal_token|team_link_token|pass_hash|pass_salt|team_link_pass|voided_token|\btoken\b|doc_json|body_json|billing_json|onboarding_json|answers_json|acceptance_json|approval_json|actor_id|army_deliverable_id|campaign_id|cycle_id\b(?! IS NOT NULL)|options_json/;
    for (const k of [...AGENCY, ...BUSINESS]) {
      const t = dataTableByKey[k]!;
      for (const col of t.columns) expect(col.sql ?? '', `${k}.${col.key}`).not.toMatch(NEVER);
      for (const expr of Object.values(t.privateSelect ?? {})) expect(expr, k).not.toMatch(NEVER);
    }
    // A teammate's line names them as Agency does, never by their id; the log never names one at all (it keeps only the id).
    const who = tableColumn(dataTableByKey.agencyNotes!, 'teammate')!.sql!;
    expect(who).toContain('A former team member');
    expect(who).not.toMatch(/SELECT|author_id(?! = \?1)(?!\s*$)/);
  });

  it('changes only through Agency’s and Reviews’ own routes, each only while the app would take it', () => {
    const editable = (k: string) => dataTableByKey[k]!.columns.filter((col) => col.edit).map((col) => col.key);
    // Contribution's Edit (2026-11-14): a client's email and a stage forward, a piece's link, an invoice's number and day, a teammate's role and
    // a time entry (dataTables.contribution.test.ts).
    expect(editable('agencyClients')).toEqual(['name', 'contact', 'contactEmail', 'status', 'health', 'stage', 'monthlyFee', 'pieces', 'hours', 'changes', 'renews', 'notes']);
    expect(editable('agencyPieces')).toEqual(['title', 'kind', 'channel', 'stage', 'due', 'goesLive', 'fee', 'link', 'notes']);
    expect(editable('agencyInvoices')).toEqual(['number', 'issued', 'due', 'note']);
    expect(editable('agencyRetainers')).toEqual(['autoSend']);
    expect(editable('agencyTemplates')).toEqual(['name']);
    expect(editable('agencyTeam')).toEqual(['role']);
    expect(editable('agencyTime')).toEqual(['day', 'minutes', 'billable', 'note']);
    // Reflection's Edit (2026-11-14): Good when and the target too, and a typed value and its note (dataTables.reflection.test.ts).
    expect(editable('businessMetrics')).toEqual(['name', 'direction', 'cadence', 'target']);
    expect(editable('businessMetricValues')).toEqual(['value', 'note']);
    for (const k of ['agencyNotes', 'agencyLog', 'agencyAgreements', 'agencyDocuments']) {
      expect(editable(k), k).toEqual([]);
      expect(dataTableByKey[k]!.readOnlyWhy, k).toBeTruthy();
    }
    // A piece's change sends the device's day, which a move to Approved or Published dates itself by.
    for (const col of dataTableByKey.agencyPieces!.columns) if (col.edit) expect(col.edit.recipe, col.key).toBe('todayQuery');
    const pieceStage = tableColumn(dataTableByKey.agencyPieces!, 'stage')!;
    expect(plainCall(pieceStage, 'p1', {}, 'review', '2026-11-14')).toEqual({ method: 'PATCH', path: '/agency/items/p1?day=2026-11-14', body: { stage: 'review' } });
    // An invoice changes only while a draft or sent (the route says so too); a retainer's sending only while it may still make months.
    const invoices = dataTableByKey.agencyInvoices!;
    const due = tableColumn(invoices, 'due')!;
    expect(rowEditable(invoices, due, { status: 'draft' }, '2026-11-14')).toBe(true);
    expect(rowEditable(invoices, due, { status: 'sent' }, '2026-11-14')).toBe(true);
    expect(rowEditable(invoices, due, { status: 'paid' }, '2026-11-14')).toBe(false);
    expect(rowEditable(invoices, due, { status: 'void' }, '2026-11-14')).toBe(false);
    const retainers = dataTableByKey.agencyRetainers!;
    const auto = tableColumn(retainers, 'autoSend')!;
    for (const st of ['offered', 'chosen', 'active']) expect(rowEditable(retainers, auto, { status: st }, '2026-11-14'), st).toBe(true);
    for (const st of ['ended', 'withdrawn']) expect(rowEditable(retainers, auto, { status: st }, '2026-11-14'), st).toBe(false);
    expect(plainCall(auto, 'r1', {}, false, '2026-11-14')).toEqual({ method: 'POST', path: '/agency/retainers/r1/auto-send', body: { on: false } });
  });

  it('reads a retainer’s month after its discount, as Agency shows and bills it, and the fee before it beside it', async () => {
    const t = dataTableByKey.agencyRetainers!;
    expect(tableColumn(t, 'fee')!.sql).toBe(RETAINER_MONTH_SQL);
    expect(tableColumn(t, 'feeBefore')!.sql).toBe('t.fee_cents');
    expect(tableColumn(t, 'fee')!.label).toBe('Fee a month');
    expect(tableColumn(t, 'feeBefore')!.label).toBe('Fee before the discount');
    expect(RETAINER_DISCOUNT_CAP_BPS).toBe(RETAINER_DISCOUNT_MAX_BPS);
    // The SQL itself, run by SQLite, against retainerMonthlyCents on the numbers its own test uses and more (a cap past 50%, a negative one).
    const { DatabaseSync } = await import('node:sqlite');
    const db = new DatabaseSync(':memory:');
    const run = db.prepare(`SELECT ${RETAINER_MONTH_SQL} AS m FROM (SELECT ? AS fee_cents, ? AS discount_bps) t`);
    for (const [fee, bps] of [[2500000, 1000], [100000, 0], [100000, 500], [33333, 500], [5, 1000], [100000, -300], [100000, 90000], [33333, 275], [0, 1000], [999999, 4999]] as const) {
      // As stored (INTEGER columns), and as a real number, which the CAST keeps whole.
      for (const got of [run.get(BigInt(fee), BigInt(bps)), run.get(fee, bps)] as { m: number }[]) {
        expect(Number(got.m), `${fee} at ${bps}`).toBe(retainerMonthlyCents(fee, bps));
        expect(Number.isInteger(Number(got.m))).toBe(true);
      }
    }
    // The reviewer's case: ₹25,000 at 10% off reads ₹22,500 a month.
    expect(Number((run.get(2500000n, 1000n) as { m: number }).m)).toBe(2250000);
    db.close();
  });

  it('says a teammate who said no to the invite said no, never that they left', () => {
    const t = dataTableByKey.agencyTeam!;
    const col = tableColumn(t, 'endedBy')!;
    expect(col.sql).toContain("WHEN t.ended_by = 'member' AND t.joined_at IS NULL THEN 'declined'");
    expect(cellText(col, { endedBy: 'declined' })).toBe('They said no');
    expect(cellText(col, { endedBy: 'member' })).toBe('They left');
    expect(cellText(col, { endedBy: 'owner' })).toBe('You');
    expect(col.options?.map((o) => o.value)).toEqual(['owner', 'member', 'declined']);
    // The filter picks the same words the cell reads, through the same expression.
    const built = tableSql(t, parseTableQuery(t, { f_endedBy: 'declined' }), { view: 'owner', ownerId: 'u1', viewerId: 'u1', today: '2026-11-14', zone: 'Asia/Kolkata' });
    expect(built.sql).toContain("(CASE WHEN t.ended_by = 'member' AND t.joined_at IS NULL THEN 'declined' ELSE t.ended_by END) = ?");
  });

  it('pages a business metric’s values in an order an index serves: by metric, newest first, then its periods', async () => {
    const values = dataTableByKey.businessMetricValues!;
    expect(values.defaultSort).toEqual({ key: 'byMetric', dir: 'desc' });
    const by = tableColumn(values, 'byMetric')!;
    expect(by.hidden).toBe(true);
    expect(visibleColumns(values, 'owner').map((col) => col.key)).not.toContain('byMetric');
    const ctx = { view: 'owner' as const, ownerId: 'u1', viewerId: 'u1', today: '2026-11-14', zone: 'Asia/Kolkata' };
    const built = tableSql(values, parseTableQuery(values, {}), ctx);
    expect(built.sql).toContain("ORDER BY k.created_at DESC, k.rowid DESC, t.period_start DESC, t.kpi_id || ':' || t.period_start DESC");
    // On the tables and indexes the migrations made, SQLite walks the indexes and never sorts, either way; by the period alone it does.
    const { DatabaseSync } = await import('node:sqlite');
    const db = new DatabaseSync(':memory:');
    db.exec(`CREATE TABLE users (id TEXT PRIMARY KEY);
      CREATE TABLE kpis (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL, unit TEXT NOT NULL DEFAULT 'number', direction TEXT NOT NULL DEFAULT 'up', cadence TEXT NOT NULL DEFAULT 'month', target INTEGER NOT NULL DEFAULT 0, source TEXT NOT NULL DEFAULT 'manual', created_at TEXT NOT NULL);
      CREATE INDEX idx_kpis_user_created ON kpis (user_id, created_at);
      CREATE TABLE kpi_values (kpi_id TEXT NOT NULL, period_start TEXT NOT NULL, value INTEGER NOT NULL, note TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL, PRIMARY KEY (kpi_id, period_start));
      CREATE TABLE agency_settings (user_id TEXT PRIMARY KEY, profile_json TEXT, currency TEXT);`);
    // node:sqlite takes numbered binds by name, as the smoke suite's D1 shim does.
    const named = (sql: string, binds: readonly unknown[]) => ({
      sql: sql.replace(/\?(\d+)/g, '@p$1'),
      args: Object.fromEntries(binds.map((v, i) => [`p${i + 1}`, v as string | number])),
    });
    const plan = (q: Record<string, string>) => {
      const s = tableSql(values, parseTableQuery(values, q), ctx);
      const n = named(`EXPLAIN QUERY PLAN ${s.sql}`, s.binds);
      return (db.prepare(n.sql).all(n.args) as { detail: string }[]).map((r) => r.detail).join(' | ');
    };
    expect(plan({})).not.toMatch(/TEMP B-TREE/);
    expect(plan({ dir: 'asc' })).not.toMatch(/TEMP B-TREE/);
    expect(plan({})).toMatch(/idx_kpis_user_created/);
    expect(plan({ sort: 'period' })).toMatch(/TEMP B-TREE/);
    // And the order is the one it says: the newest metric's newest period first.
    db.exec(`INSERT INTO kpis (id, user_id, name, created_at) VALUES ('a', 'u1', 'Old', '2026-01-01T00:00:00Z'), ('b', 'u1', 'New', '2026-06-01T00:00:00Z'), ('c', 'u2', 'Not mine', '2026-07-01T00:00:00Z');
      INSERT INTO kpi_values (kpi_id, period_start, value, updated_at) VALUES ('a', '2026-10-01', 1, 'x'), ('a', '2026-11-01', 2, 'x'), ('b', '2026-09-01', 3, 'x'), ('b', '2026-10-01', 4, 'x'), ('c', '2026-11-01', 5, 'x');`);
    const s = named(tableSql(values, parseTableQuery(values, {}), ctx).sql, tableSql(values, parseTableQuery(values, {}), ctx).binds);
    const ids = (db.prepare(s.sql).all(s.args) as { _id: string }[]).map((r) => r._id);
    expect(ids).toEqual(['b:2026-10-01', 'b:2026-09-01', 'a:2026-11-01', 'a:2026-10-01']);
    db.close();
  });

  it('reads Agency’s money in the Agency’s own currency, and a value through its metric', () => {
    for (const k of ['agencyClients', 'agencyPieces', 'agencyRetainers']) {
      const t = dataTableByKey[k]!;
      expect(t.from, k).toContain('LEFT JOIN agency_settings s ON s.user_id = t.user_id');
      expect(tableColumn(t, 'currency')?.hidden, k).toBe(true);
    }
    expect(tableColumn(dataTableByKey.agencyInvoices!, 'total')?.currency).toBe('currency');
    const values = dataTableByKey.businessMetricValues!;
    const built = tableSql(values, parseTableQuery(values, {}), { view: 'owner', ownerId: 'u1', viewerId: 'u1', today: '2026-11-14', zone: 'Asia/Kolkata' });
    expect(built.sql).toContain('k.user_id = ?1');
    expect(built.binds[0]).toBe('u1');
    const own = rowFromRaw(values, { _id: 'k1:2026-11-01', metric: 'Calls', period: '2026-11-01', cadence: 'month', note: '', updatedAt: '2026-11-02T00:00:00Z', _p_unit: 'money', _p_amount: 1250, _p_currency: 'INR' }, 'owner');
    expect(own.fields).toMatchObject({ unit: 'money', amount: 1250, currency: 'INR' });
  });
});

describe('All tables: Shop and creator tools (2026-11-14)', () => {
  // The creator's own records, and the reviews the person wrote themselves: the old rules.
  const OWN = ['products', 'coupons', 'sessionHours', 'sessionDays', 'myProductReviews', 'broadcasts', 'contentPosts', 'trackedLinks', 'autoDms', 'funnels', 'sequences', 'portfolio'];
  // Another person's details or words: who booked, a buyer's question, a review someone wrote, who was invited, a lead, a creator's answer,
  // and on the buyer's side the creator a session is with, and who invited you to a private course and its title (2026-11-14 review).
  const OTHERS = ['bookings', 'courseInvites', 'priorityDms', 'productReviews', 'myBookings', 'myQuestions', 'myCourseInvites', 'leads'];
  const BATCH = [...OWN, ...OTHERS];
  const today = '2026-11-14';
  const editable = (k: string) => dataTableByKey[k]!.columns.filter((col) => col.edit).map((col) => col.key);

  it('holds every table, each with its audience and the app its records belong to', () => {
    for (const k of BATCH) expect(dataTableByKey[k], k).toBeTruthy();
    expect(DATA_TABLES.filter((t) => ['purchases', 'shop', 'audience', 'creatorContent', 'publicPage'].includes(t.group)).map((t) => t.key).sort()).toEqual([...BATCH].sort());
    for (const k of OWN) {
      const t = dataTableByKey[k]!;
      expect(audienceOf(t), k).toBe('own');
      expect(tableReach(t), k).toEqual({ coach: true, admin: true, ai: 'any' });
      expect(coachTableKeys([k]), k).toEqual([k]);
    }
    for (const k of OTHERS) {
      const t = dataTableByKey[k]!;
      expect(audienceOf(t), k).toBe('others');
      expect(tableReach(t), k).toEqual({ coach: false, admin: false, ai: 'private' });
      expect(tableAllowed(t, 'coach', [k], null), k).toBe(false);
      expect(tableAllowed(t, 'admin', [], null), k).toBe(false);
      expect(coachTableKeys([k]), k).toEqual([]);
    }
    expect(Object.fromEntries(BATCH.map((k) => [k, dataTableByKey[k]!.needs ?? null]))).toEqual({
      products: ['shop'], coupons: ['shop'], bookings: ['shop'], sessionHours: ['shop'], sessionDays: ['shop'], courseInvites: ['shop'], priorityDms: ['shop'], productReviews: ['shop'],
      myBookings: ['library'], myQuestions: ['library'], myCourseInvites: null, myProductReviews: null,
      leads: ['audience'], broadcasts: ['audience'],
      contentPosts: ['content', 'automations'], trackedLinks: ['content', 'automations'], autoDms: ['automations'], funnels: ['automations'], sequences: ['automations'],
      portfolio: ['profile'],
    });
    // A table lists only while its app is on; an invite to a course and a review written on a product's page are seen there, so always.
    const keysFor = (on: string[]) => listTables('owner', [], on).flatMap((g) => g.tables.map((t) => t.key));
    expect(keysFor([])).toEqual(expect.arrayContaining(['myCourseInvites', 'myProductReviews']));
    for (const k of ['products', 'bookings', 'myBookings', 'leads', 'trackedLinks', 'portfolio']) expect(keysFor([]), k).not.toContain(k);
    expect(keysFor(['shop'])).toEqual(expect.arrayContaining(['products', 'coupons', 'bookings', 'sessionHours', 'sessionDays', 'courseInvites', 'priorityDms', 'productReviews']));
    expect(keysFor(['content'])).toEqual(expect.arrayContaining(['contentPosts', 'trackedLinks']));
    expect(keysFor(['content'])).not.toContain('autoDms');
    expect(keysFor(['automations'])).toEqual(expect.arrayContaining(['contentPosts', 'trackedLinks', 'autoDms', 'funnels', 'sequences']));
  });

  it('never selects a code, a meeting or download link, a paid post, an email, a click’s address or a person’s id', () => {
    const NEVER = /\bcode\b|email|ip_hash|user_agent|referrer|meeting_url|replay_url|locked_body|invited_by|recipient_|external_|thumbnail_url|source_link_id|order_id/;
    for (const k of BATCH) {
      const t = dataTableByKey[k]!;
      for (const col of t.columns) {
        expect(col.sql ?? '', `${k}.${col.key}`).not.toMatch(NEVER);
        // A cell is never a bare id (a person's, a product's or a link's): a name, a title or a count instead. The one exception is a hidden
        // cell only the owner's own view reads, for a route's path (a course an invite is for, 2026-11-14).
        if (!(col.hidden && col.ownerOnly)) expect(col.sql ?? '', `${k}.${col.key}`).not.toMatch(/^\w+\.(\w+_)?id$/);
      }
      for (const expr of Object.values(t.privateSelect ?? {})) expect(expr, k).not.toMatch(NEVER);
    }
    // A product's file or link is what a buyer pays for: never in its table, not even its owner's.
    for (const col of dataTableByKey.products!.columns) expect(col.sql ?? '', col.key).not.toMatch(/\bt\.url\b/);
    // Counts only: never who tapped a link or got a DM.
    expect(tableColumn(dataTableByKey.trackedLinks!, 'taps')!.sql).toBe('(SELECT COUNT(*) FROM link_clicks lc WHERE lc.link_id = t.id)');
    expect(tableColumn(dataTableByKey.autoDms!, 'sent')!.sql).toMatch(/^\(SELECT COUNT\(\*\) FROM dm_sends ds WHERE ds\.automation_id = t\.id/);
  });

  it('changes only through Shop’s own routes, each field one the app changes by itself', () => {
    // What each table changes (2026-11-14, All tables' Edit and Delete: every field its app's own route lets its owner change, nothing else).
    const EDITS: Record<string, string[]> = {
      products: ['title', 'status', 'pricePoints', 'price', 'payWhatYouWant', 'minPoints', 'minXp', 'description'],
      coupons: ['usesAllowed'],
      bookings: ['status'],
      sessionHours: ['day', 'from', 'until'],
      priorityDms: ['answer'],
      productReviews: ['shown'],
      myProductReviews: ['rating', 'words'],
      contentPosts: ['caption', 'kind', 'views', 'likes', 'comments'],
      trackedLinks: ['label'],
      autoDms: ['keywords', 'message', 'on'],
      funnels: ['name'],
      sequences: ['title', 'message', 'days', 'on'],
      portfolio: ['title', 'about', 'link', 'shown'],
    };
    for (const k of BATCH) expect(editable(k), k).toEqual(EDITS[k] ?? []);
    for (const k of BATCH.filter((x) => !EDITS[x])) {
      expect(dataTableByKey[k]!.readOnlyWhy, k).toBeTruthy();
      expect(dataTableByKey[k]!.noEditWhy, k).toBeTruthy();
    }
    const products = dataTableByKey.products!;
    const status = tableColumn(products, 'status')!;
    // Public is a live course: it is sent as live, which the route takes for any kind (Private it refuses, in its own words, for anything but a course).
    expect(editValue(status, 'public')).toEqual({ value: 'live' });
    expect(editValue(status, 'archived')).toEqual({ value: 'archived' });
    expect(editValue(status, 'constructor')).toHaveProperty('error');
    // A money price goes up to ₹10,00,000 (2026-11-14, the founder: "remove the cap", then "stop under 10lacs"): ₹25,000 is taken, and a price
    // past ₹10,00,000 is refused, out loud and in whole units. A points price past Studio's own cap is refused too, never saved as the cap.
    const price = tableColumn(products, 'price')!;
    expect(editValue(price, 2_500_000)).toEqual({ value: 2_500_000 });
    expect(editValue(price, PRODUCT_MONEY_MAX)).toEqual({ value: PRODUCT_MONEY_MAX });
    expect(editValue(price, PRODUCT_MONEY_MAX + 1)).toEqual({ error: 'The most is 10,00,000.' });
    expect(editValue(price, 250000)).toEqual({ value: 250000 });
    expect(editValue(price, 12.5)).toHaveProperty('error');
    expect(editValue(tableColumn(products, 'pricePoints')!, PRODUCT_POINTS_MAX + 1)).toHaveProperty('error');
    expect(plainCall(price, 'p1', {}, 250000, today)).toEqual({ method: 'PATCH', path: '/studio/products/p1', body: { priceCents: 250000 } });
    expect(plainCall(tableColumn(dataTableByKey.productReviews!, 'shown')!, 'r1', {}, true, today)).toEqual({ method: 'POST', path: '/studio/testimonials/r1', body: { approved: true } });
    expect(plainCall(tableColumn(dataTableByKey.autoDms!, 'on')!, 'a1', {}, false, today)).toEqual({ method: 'PATCH', path: '/studio/automations/a1', body: { active: false } });
    // The points cap is Studio's own int() default, which both product routes read the points price through; the money price is read up to
    // PRODUCT_MONEY_MAX, and a price past it is refused first (tooDear) on both routes.
    const studio = readFileSync(new URL('../../../apps/api/src/routes/studio.ts', import.meta.url), 'utf8');
    expect(PRODUCT_POINTS_MAX).toBe(1_000_000);
    expect(PRODUCT_MONEY_MAX).toBe(100_000_000);
    expect(PRODUCT_MONEY_MAX * 10_000).toBeLessThan(Number.MAX_SAFE_INTEGER);
    expect(studio).toContain('const int = (v: unknown, fallback: number | null, lo = 0, hi = 1_000_000): number | null => {');
    expect(studio).toContain('int(body.priceCents, prev.price_cents, 0, PRODUCT_MONEY_MAX)');
    expect(studio).toContain('int(body.priceCents, 0, 0, PRODUCT_MONEY_MAX)');
    expect(studio.match(/if \(tooDear\(body\.priceCents\)\) return c\.json\(\{ error: TOO_DEAR \}, 400\);/g)).toHaveLength(2);
    expect(studio).toContain('int(body.pricePoints, prev.price_points)');
    expect(LOCALE).toBe('en-IN');
  });

  it('says each state, kind and source in the app’s own words', () => {
    const pairs = (o: readonly ColumnOption[]) => o.filter((x) => !x.isNull).map((x) => [x.value, x.label]);
    // A product's state as Shop names it: a live course is Public, any other live product Live.
    for (const kind of ['course', 'digital', 'session'] as ProductKind[]) {
      for (const st of statusesFor(kind)) {
        const shown = st === 'live' && kind === 'course' ? 'public' : st;
        expect(PRODUCT_STATUS_OPTIONS.find((o) => o.value === shown)?.label, `${kind} ${st}`).toBe(productStatusLabel(st, kind));
      }
    }
    expect(pairs(LINK_SOURCE_OPTIONS).map(([k]) => k)).toEqual([...LINK_SOURCES]);
    // A lead's source in words: the two places Shop writes one, and nothing else.
    const store = readFileSync(new URL('../../../apps/api/src/routes/store.ts', import.meta.url), 'utf8');
    const leadSources = [...store.matchAll(/INSERT INTO leads \(id, owner_id, name, email, message, source, created_at\)[^\n]*?'(\w+)'/g)].map((m) => m[1]);
    expect(leadSources.sort()).toEqual(pairs(LEAD_SOURCE_OPTIONS).map(([k]) => k).sort());
    expect(Object.fromEntries(pairs(LEAD_SOURCE_OPTIONS))).toEqual({ page: 'Your page', lead_magnet: 'A free product' });
    expect(tableColumn(dataTableByKey.leads!, 'from')?.options).toBe(LEAD_SOURCE_OPTIONS);
    expect(pairs(CONTENT_KIND_OPTIONS).map(([k]) => k)).toEqual([...CONTENT_KINDS]);
    expect(pairs(SOCIAL_PLATFORM_OPTIONS)).toEqual(Object.entries(SOCIAL_PLATFORM_META).map(([k, m]) => [k, m.name]));
    const bookingKeys: Record<Booking['status'], true> = { requested: true, confirmed: true, cancelled: true, done: true };
    expect(pairs(BOOKING_STATUS_OPTIONS).map(([k]) => k)).toEqual(Object.keys(bookingKeys));
    const dmKeys: Record<DmRequest['status'], true> = { open: true, answered: true, refunded: true };
    expect(pairs(DM_STATUS_OPTIONS).map(([k]) => k)).toEqual(Object.keys(dmKeys));
    const stepKeys: Record<FunnelStepKind, true> = { content: true, automation: true, link: true, lead: true, product: true, broadcast: true };
    expect(Object.keys(FUNNEL_STEP_WORDS).sort()).toEqual(Object.keys(stepKeys).sort());
    const shownKeys: Record<PortfolioItem['visibility'], true> = { public: true, private: true };
    expect(pairs(tableColumn(dataTableByKey.portfolio!, 'shown')!.options!).map(([k]) => k)).toEqual(Object.keys(shownKeys));
    // Session hours keep Shop's day numbers (getUTCDay: 0 is Sunday), in Shop's order. 15 November 2026 is a Sunday.
    expect(pairs(WEEKDAY_SUNDAY_FIRST_OPTIONS).map(([k]) => k)).toEqual(['0', '1', '2', '3', '4', '5', '6']);
    expect(WEEKDAY_SUNDAY_FIRST_OPTIONS[new Date(Date.UTC(2026, 10, 15)).getUTCDay()]!.label).toBe('Sunday');
  });

  it('words a funnel’s steps, and the server words a day’s own hours', () => {
    const funnels = dataTableByKey.funnels!;
    const steps = JSON.stringify([{ kind: 'content', ref: 'c1', label: '' }, { kind: 'link', ref: 'l1', label: 'Bio link' }, { kind: 'nope', ref: 'x', label: '' }, 'junk']);
    expect(rowFromRaw(funnels, { _id: 'f1', name: 'Launch', stepCount: 4, made: '2026-11-14T00:00:00Z', _p_steps: steps }, 'owner').row.cells.steps).toBe('A post, Bio link');
    expect(rowFromRaw(funnels, { _id: 'f2', name: 'Empty', _p_steps: '[]' }, 'owner').row.cells.steps).toBeNull();
    expect(SERVER_DERIVES).toContain('minuteRanges');
    expect(rowFromRaw(dataTableByKey.sessionDays!, { _id: 'd1', day: '2026-11-20', closed: 1, _p_ranges: '[]' }, 'owner').row.cells.hours).toBeNull();
  });

  it('pages a course’s invites and the session hours in an order their indexes serve, and reads a live course as Public', async () => {
    const ctx = { view: 'owner' as const, ownerId: 'u1', viewerId: 'u1', today, zone: 'Asia/Kolkata' };
    const { DatabaseSync } = await import('node:sqlite');
    const db = new DatabaseSync(':memory:');
    const migration = readFileSync(new URL('0155_shop_table_indexes.sql', MIGRATIONS), 'utf8');
    db.exec(`CREATE TABLE users (id TEXT PRIMARY KEY, display_name TEXT, handle TEXT);
      CREATE TABLE products (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, kind TEXT NOT NULL, title TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', created_at TEXT NOT NULL);
      CREATE INDEX idx_products_owner ON products(owner_id, status);
      CREATE TABLE product_invites (product_id TEXT NOT NULL, user_id TEXT NOT NULL, invited_by TEXT, created_at TEXT NOT NULL, PRIMARY KEY (product_id, user_id));
      CREATE INDEX idx_product_invites_user ON product_invites (user_id);
      CREATE TABLE availability (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, weekday INTEGER NOT NULL, start_min INTEGER NOT NULL, end_min INTEGER NOT NULL);
      CREATE TABLE coupons (id TEXT PRIMARY KEY, owner_id TEXT, code TEXT, created_at TEXT); CREATE TABLE testimonials (id TEXT PRIMARY KEY, owner_id TEXT, author_id TEXT, approved INTEGER, created_at TEXT);
      CREATE TABLE dm_requests (id TEXT PRIMARY KEY, owner_id TEXT, buyer_id TEXT, created_at TEXT); CREATE TABLE broadcasts (id TEXT PRIMARY KEY, owner_id TEXT, created_at TEXT);
      CREATE TABLE sequences (id TEXT PRIMARY KEY, owner_id TEXT, created_at TEXT); CREATE TABLE funnels (id TEXT PRIMARY KEY, owner_id TEXT, created_at TEXT);
      CREATE TABLE dm_automations (id TEXT PRIMARY KEY, owner_id TEXT, created_at TEXT); CREATE TABLE content_items (id TEXT PRIMARY KEY, owner_id TEXT, url TEXT, created_at TEXT);
      ${migration}`);
    const named = (sql: string, binds: readonly unknown[]) => ({ sql: sql.replace(/\?(\d+)/g, '@p$1'), args: Object.fromEntries(binds.map((v, i) => [`p${i + 1}`, v as string | number])) });
    const plan = (key: string, q: Record<string, string> = {}) => {
      const t = dataTableByKey[key]!;
      const s = tableSql(t, parseTableQuery(t, q), ctx);
      const n = named(`EXPLAIN QUERY PLAN ${s.sql}`, s.binds);
      return (db.prepare(n.sql).all(n.args) as { detail: string }[]).map((r) => r.detail).join(' | ');
    };
    expect(plan('courseInvites')).not.toMatch(/TEMP B-TREE/);
    expect(plan('courseInvites', { dir: 'asc' })).not.toMatch(/TEMP B-TREE/);
    expect(plan('courseInvites')).toMatch(/idx_products_owner_created/);
    expect(plan('sessionHours')).not.toMatch(/TEMP B-TREE/);
    expect(plan('sessionHours')).toMatch(/idx_availability_owner_day/);
    expect(plan('myCourseInvites')).toMatch(/idx_product_invites_user_created/);
    // The older index by user alone went, since the new one serves its reads.
    expect(db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name = 'idx_product_invites_user'").get()).toEqual({ n: 0 });
    db.exec(`INSERT INTO users (id, display_name, handle) VALUES ('u1', 'Maker', 'maker'), ('u2', 'Asha', 'asha'), ('u3', 'Deleted member', 'gone');
      INSERT INTO products (id, owner_id, kind, title, status, created_at) VALUES ('c1', 'u1', 'course', 'Old course', 'live', '2026-01-01T00:00:00Z'), ('c2', 'u1', 'course', 'New course', 'private', '2026-06-01T00:00:00Z'), ('c3', 'u9', 'course', 'Not mine', 'private', '2026-07-01T00:00:00Z');
      INSERT INTO product_invites (product_id, user_id, created_at) VALUES ('c1', 'u2', '2026-02-01T00:00:00Z'), ('c2', 'u2', '2026-06-02T00:00:00Z'), ('c2', 'u3', '2026-06-03T00:00:00Z'), ('c3', 'u2', '2026-07-02T00:00:00Z');
      INSERT INTO availability (id, owner_id, weekday, start_min, end_min) VALUES ('a1', 'u1', 1, 540, 720), ('a2', 'u1', 0, 600, 1440), ('a3', 'u1', 1, 300, 420);`);
    const rows = (key: string) => {
      const t = dataTableByKey[key]!;
      const s = tableSql(t, parseTableQuery(t, {}), ctx);
      const n = named(s.sql, s.binds);
      return db.prepare(n.sql).all(n.args) as Record<string, unknown>[];
    };
    const invites = rows('courseInvites');
    expect(invites.map((r) => r._id)).toEqual(['c2:u3', 'c2:u2', 'c1:u2']);
    expect(invites.map((r) => [r.course, r.person, r.handle, r.courseState])).toEqual([
      ['New course', 'Deleted member', null, 'private'],
      ['New course', 'Asha', 'asha', 'private'],
      ['Old course', 'Asha', 'asha', 'public'],
    ]);
    expect(rows('sessionHours').map((r) => [r.day, r.from, r.until])).toEqual([[0, '10:00', '24:00'], [1, '05:00', '07:00'], [1, '09:00', '12:00']]);
    db.close();
  });
});
