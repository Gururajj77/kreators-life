import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  BULK_MAX,
  DATA_TABLES,
  editWhenWhy,
  isPastDay,
  MATCH_NOT_MAX,
  noEditWhyOf,
  noRemoveWhyOf,
  parseTableQuery,
  previewLine,
  REMOVE_VERBS,
  removeCallFor,
  removeCount,
  removeDoneLine,
  removeCallOf,
  removeStateOf,
  removeVerbOf,
  removeWords,
  rowEditable,
  rowFromRaw,
  rowNoEditWhy,
  rowsWord,
  ruleSelects,
  tableColumn,
  tableEditable,
  tableSql,
  verbWith,
  type ColumnEdit,
  type DataColumn,
  type DataTable,
  type EditWhen,
  type RemoveCall,
  type RowRule,
} from './dataTables';

// All tables' Edit and remove from the selection bar (2026-11-14, the founder: "all tables need to be editable ... each entry for the original
// user and not for coach, and not even ai, edit and delete buttons should also be there in select and multi select and select all"). This file
// holds the framework's rules: every table's remove is well formed and reaches only routes the app has, a row's state is worked out by one rule,
// a call is built only from the row's own ids, and the words. Each group's own file holds what is particular to its tables.

/**
 * COVERAGE_STRICT (on since the integration of 2026-11-14, when every group had filled its tables): every table ends with an editable column or
 * `noEditWhy`, and with a `remove` or `noRemoveWhy`, so no table is left with a greyed button that says nothing true. A new table fails here
 * until it says how its rows are edited and removed, or why not.
 */
const COVERAGE_STRICT = true;

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const today = '2026-11-14';
const ctx = { view: 'owner' as const, ownerId: 'u1', viewerId: 'u1', today, zone: 'Asia/Kolkata' };

/** Every rule a remove holds, in the order the read and removeStateOf walk them. */
function rulesOf(t: DataTable): (RowRule | undefined)[] {
  return t.remove ? [t.remove.only?.where, ...(t.remove.outcomes ?? []).map((o) => o.when), t.remove.sheetWhen] : [];
}
/** Every call a remove can make. */
function callsOf(t: DataTable): RemoveCall[] {
  if (!t.remove) return [];
  return [...(t.remove.call ? [t.remove.call] : []), ...(t.remove.outcomes ?? []).flatMap((o) => ('call' in o ? [o.call] : []))];
}

// A table made for these tests (never in the registry): an owner's things, some locked, some paid, some sent, with another person's id that a
// route needs in its path and nobody may see.
const col = (key: string, kind: DataColumn['kind'], sql: string | null, more: Partial<DataColumn> = {}): DataColumn => ({ key, label: key, kind, sql, ...more });
const THINGS: DataTable = {
  key: 'testThings',
  name: 'Things',
  blurb: 'A table made for the tests.',
  group: 'daily',
  sqlTable: 'things',
  from: 'things t',
  owner: 't.user_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'made', dir: 'desc' },
  read: 'sql',
  dayCell: 'day',
  columns: [
    col('title', 'text', 't.title', { sortable: true, searchable: true, edit: { method: 'PATCH', path: '/things/:id', field: 'title', input: 'text', minLength: 1, when: 'open' } }),
    col('status', 'enum', 't.status', { options: [{ value: 'open', label: 'Open' }, { value: 'sent', label: 'Sent' }, { value: 'paid', label: 'Paid' }, { value: 'locked', label: 'Locked' }], filter: 'pick' }),
    col('made', 'datetime', 't.made', { sortable: true }),
    col('day', 'date', 't.day', { edit: { method: 'PATCH', path: '/things/:id', field: 'day', input: 'date', when: 'past' } }),
    col('folderId', 'text', 't.folder_id', { hidden: true, ownerOnly: true }),
  ],
  privateSelect: { otherId: 't.other_id' },
  remove: {
    verb: 'Delete',
    did: 'deleted',
    ask: 'sheet',
    warn: 'They go for good.',
    only: { where: "t.status <> 'locked'", why: 'Locked ones stay.' },
    outcomes: [
      { when: { cell: 'status', is: ['paid'] }, skip: 'Paid ones stay for the books.' },
      { when: "t.status = 'sent' AND {today} >= t.day", did: 'voided', call: { method: 'POST', path: '/things/:id/void', body: { why: 'table' }, today: 'body' } },
      { did: 'deleted', call: { method: 'DELETE', path: '/folders/:folderId/things/:id', today: 'query' } },
    ],
  },
};

describe('All tables: Edit and remove from the selection bar (2026-11-14)', () => {
  it('builds every remove from the app’s own words, rules and calls', () => {
    for (const t of DATA_TABLES) {
      const spec = t.remove;
      if (!spec) continue;
      const id = t.key;
      expect(REMOVE_VERBS, id).toContain(spec.verb);
      expect(spec.did.trim(), `${id} did`).toBe(spec.did);
      expect(spec.did, `${id} did`).toMatch(/^[a-z][a-z ]+$/);
      expect(spec.warn.length, `${id} warn`).toBeGreaterThan(0);
      expect(['twice', 'sheet'], id).toContain(spec.ask);
      expect(Boolean(spec.call) !== Boolean(spec.outcomes), `${id}: one of call and outcomes`).toBe(true);
      if (spec.outcomes) {
        expect(spec.outcomes.length, id).toBeGreaterThan(0);
        expect(spec.outcomes.some((o) => 'call' in o), `${id}: some outcome does something`).toBe(true);
        for (const o of spec.outcomes) {
          if ('call' in o) expect(o.did, `${id} outcome did`).toMatch(/^[a-z][a-z ]+$/);
          else expect(o.skip.length, `${id} skip why`).toBeGreaterThan(0);
        }
      }
      if (spec.only) expect(spec.only.why.length, `${id} only.why`).toBeGreaterThan(0);
      for (const w of [spec.title, spec.yes, spec.keep]) if (w) expect(w.replace(/\{(n|rows|it)\}/g, ''), `${id}: only {n}, {rows} and {it}`).not.toMatch(/[{}]/);
      // Rules: SQL only where a statement reads the row; a cell rule names one of the table's own columns or private fields.
      for (const r of rulesOf(t)) {
        if (r === undefined) continue;
        if (typeof r === 'string') {
          expect(t.read, `${id}: a memory table's rules are cell rules`).toBe('sql');
          expect(r, id).not.toMatch(/;|--/);
        } else expect(Boolean(tableColumn(t, r.cell)) || t.privateSelect?.[r.cell] !== undefined, `${id} rule reads ${r.cell}`).toBe(true);
      }
      for (const call of callsOf(t)) {
        expect(call.path.startsWith('/'), id).toBe(true);
        if (call.param) expect(tableColumn(t, call.param), `${id} param`).toBeTruthy();
        // Any other part of the path is the row's own hidden owner-only cell, or a private field the server reads and never sends.
        for (const m of call.path.split('?')[0]!.matchAll(/:([A-Za-z]\w*)/g)) {
          if (m[1] === 'id') continue;
          const cell = tableColumn(t, m[1]!);
          const ok = (cell?.hidden === true && cell.ownerOnly === true) || t.privateSelect?.[m[1]!] !== undefined;
          expect(ok, `${id} fills :${m[1]} from a hidden owner-only cell or a private field`).toBe(true);
        }
        for (const from of Object.values(call.bodyFrom ?? {})) expect(Boolean(tableColumn(t, from)) || t.privateSelect?.[from] !== undefined, `${id} body reads ${from}`).toBe(true);
        if (call.recipe && call.recipe !== 'plain') expect(read('../../../apps/api/src/tablesRemove.ts'), `${id}: ${call.recipe} has its builder`).toMatch(new RegExp(`\\b${call.recipe}\\s*:`));
      }
      const words = [spec.did, spec.warn, spec.title ?? '', spec.yes ?? '', spec.keep ?? '', spec.only?.why ?? '', ...(spec.outcomes ?? []).map((o) => ('skip' in o ? o.skip : o.did))].join(' ').toLowerCase();
      expect(words, id).not.toContain('database');
    }
  });

  it('never says a greyed button is greyed for nothing, nor contradicts itself', () => {
    for (const t of DATA_TABLES) {
      // A table that edits never says it does not, and one that removes never says it does not.
      if (tableEditable(t)) expect(t.noEditWhy, `${t.key} edits and says why not`).toBeUndefined();
      if (t.remove) expect(t.noRemoveWhy, `${t.key} removes and says why not`).toBeUndefined();
      for (const why of [t.noEditWhy, t.noRemoveWhy]) if (why !== undefined) expect(why, t.key).toMatch(/^[A-Z].*[.!]$/);
      // Whatever is set, the bar always has words for a greyed button.
      if (!tableEditable(t)) expect(noEditWhyOf(t), t.key).toBeTruthy();
      if (!t.remove) expect(noRemoveWhyOf(t), t.key).toBeTruthy();
    }
  });

  it.skipIf(!COVERAGE_STRICT)('every table says how its rows are edited and removed here, or why not (COVERAGE_STRICT)', () => {
    expect(DATA_TABLES.length).toBeGreaterThan(0);
    const open = DATA_TABLES.filter((t) => !(tableEditable(t) || t.noEditWhy) || !(t.remove || t.noRemoveWhy)).map((t) => t.key);
    expect(open).toEqual([]);
  });

  it('offers an answer only while it waits: a cell gate names the table’s own column and says why (whenCell)', () => {
    for (const t of DATA_TABLES) {
      for (const col of t.columns) {
        const gate = col.edit?.whenCell;
        if (!gate) continue;
        expect(tableColumn(t, gate.cell), `${t.key}.${col.key} gate reads ${gate.cell}`).toBeTruthy();
        expect(gate.is.length, `${t.key}.${col.key}`).toBeGreaterThan(0);
        expect(col.edit?.why ?? '', `${t.key}.${col.key} says why`).toMatch(/^[A-Z].*\.$/);
      }
    }
    const friends = DATA_TABLES.find((t) => t.key === 'friends')!;
    const state = tableColumn(friends, 'state')!;
    expect(rowEditable(friends, state, { state: 'pending' }, today)).toBe(true);
    for (const shut of ['sent', 'friends']) expect(rowEditable(friends, state, { state: shut }, today), shut).toBe(false);
    expect(rowNoEditWhy(friends, { state: 'friends' }, today)).toBe('Only a request someone sent you waits for your yes.');
    const rooms = DATA_TABLES.find((t) => t.key === 'bondChannels')!;
    const seat = tableColumn(rooms, 'seat')!;
    expect(rowEditable(rooms, seat, { seat: 'invited', madeIt: false }, today)).toBe(true);
    expect(rowEditable(rooms, seat, { seat: 'member', madeIt: false }, today)).toBe(false);
  });

  it('says why a cell waits for every rule a column can have, and a column’s own words first', () => {
    const WHENS: EditWhen[] = ['open', 'project', 'recent', 'recentOwnMove', 'recentEat', 'handInOpen', 'paperOpen', 'retainerOpen', 'listingOpen', 'unpublished', 'pitchWaiting', 'xpOpen', 'seatHeld', 'madeIt', 'linkOpen', 'past'];
    const edit = (when: EditWhen): ColumnEdit => ({ method: 'PATCH', path: '/x/:id', field: 'x', input: 'text', when });
    for (const w of WHENS) {
      const why = editWhenWhy(edit(w), {});
      expect(why, w).toMatch(/^[A-Z].*\.$/);
      expect(why, w).not.toBe('This one cannot be changed now.');
    }
    expect(editWhenWhy({ ...edit('paperOpen'), why: 'Paid invoices stay for the books.' }, { status: 'paid' })).toBe('Paid invoices stay for the books.');
    // A row whose only editable cells wait says the first one's reason.
    expect(rowNoEditWhy(THINGS, { status: 'sent', day: '2026-11-20' }, today)).toBe('Only an open task can be changed this way.');
  });

  it('lets a past day change, never one still to come (water, gratitude, supplement ticks, routine days)', () => {
    expect(isPastDay('2026-11-14', today)).toBe(true);
    expect(isPastDay('2020-01-01', today)).toBe(true);
    expect(isPastDay('2026-11-15', today)).toBe(false);
    expect(isPastDay('2026-02-30', today)).toBe(false);
    expect(isPastDay(null, today)).toBe(false);
    const day = tableColumn(THINGS, 'day')!;
    expect(rowEditable(THINGS, day, { day: '2025-01-01' }, today)).toBe(true);
    expect(rowEditable(THINGS, day, { day: '2026-12-01' }, today)).toBe(false);
  });

  it('works a row’s remove out by one rule: only, then the first outcome that fits, else it stays', () => {
    expect(ruleSelects(THINGS)).toEqual(["t.status <> 'locked'", "t.status = 'sent' AND {today} >= t.day"]);
    // The SQL rules' results ride in the row's private fields (`_q0`, `_q1`), as the owner's read leaves them.
    expect(removeStateOf(THINGS, { status: 'locked' }, { _q0: 0, _q1: 0 })).toEqual({ why: 'Locked ones stay.' });
    expect(removeStateOf(THINGS, { status: 'paid' }, { _q0: 1, _q1: 0 })).toEqual({ why: 'Paid ones stay for the books.' });
    expect(removeStateOf(THINGS, { status: 'sent' }, { _q0: 1, _q1: 1 })).toEqual({ did: 'voided', at: 1 });
    expect(removeStateOf(THINGS, { status: 'open' }, { _q0: 1, _q1: 0 })).toEqual({ did: 'deleted', at: 2 });
    // A read that did not work the rules out never removes on a rule nobody checked.
    expect(removeStateOf(THINGS, { status: 'open' }, {})).toEqual({ why: 'Locked ones stay.' });
    expect(removeCallOf(THINGS.remove!, 1)?.path).toBe('/things/:id/void');
    expect(removeCallOf(THINGS.remove!, 0)).toBeNull();
    // One call for every row.
    const plain: DataTable = { ...THINGS, remove: { verb: 'Take down', did: 'taken down', ask: 'twice', warn: 'Its place stays.', call: { method: 'DELETE', path: '/things/:id' } } };
    expect(removeStateOf(plain, {}, {})).toEqual({ did: 'taken down', at: -1 });
    expect(removeStateOf({ ...THINGS, remove: undefined }, {}, {})).toBeNull();
    // A rule on a cell reads the private fields too (a memory table's, which are its cells).
    const byField: DataTable = { ...plain, remove: { ...plain.remove!, only: { where: { cell: 'otherId', not: [null] }, why: 'Nobody there.' } } };
    expect(removeStateOf(byField, {}, { otherId: 'u2' })).toEqual({ did: 'taken down', at: -1 });
    expect(removeStateOf(byField, {}, {})).toEqual({ why: 'Nobody there.' });
  });

  it('builds a remove’s call only from the row’s own ids, its cells and fields, and the day', () => {
    const del = (THINGS.remove!.outcomes![2] as { call: RemoveCall }).call;
    const voidCall = (THINGS.remove!.outcomes![1] as { call: RemoveCall }).call;
    expect(removeCallFor(del, 'th1', { folderId: 'f9' }, {}, today)).toEqual({ method: 'DELETE', path: '/folders/f9/things/th1?day=2026-11-14' });
    expect(removeCallFor(voidCall, 'th1', {}, {}, today)).toEqual({ method: 'POST', path: '/things/th1/void', body: { why: 'table', today } });
    // Never a path the row does not hold, nor an id that is not an id.
    expect(removeCallFor(del, 'th1', {}, {}, today)).toBeNull();
    expect(removeCallFor(del, 'th1', { folderId: '../x' }, {}, today)).toBeNull();
    expect(removeCallFor(voidCall, 'a/b', {}, {}, today)).toBeNull();
    expect(removeCallFor(voidCall, 'item:2026-11-14', {}, {}, today)).toBeNull();
    // A private field fills the path (another person's id, which no cell holds), a param names the id, a fixed query stays, the body reads cells.
    expect(removeCallFor({ method: 'DELETE', path: '/people/:otherId/follow' }, 'row1', {}, { otherId: 'u2' }, today)).toEqual({ method: 'DELETE', path: '/people/u2/follow' });
    expect(removeCallFor({ method: 'DELETE', path: '/nodes/:id?archived=1', param: 'nodeId', today: 'query' }, 'x:y', { nodeId: 'n1' }, {}, today)).toEqual({
      method: 'DELETE',
      path: '/nodes/n1?archived=1&day=2026-11-14',
    });
    expect(removeCallFor({ method: 'PUT', path: '/journal/gratitude/:id', bodyFrom: { ifUpdatedAt: 'updatedAt', gone: 'nothing' } }, '2026-11-13', { updatedAt: 'T1' }, {}, today)).toEqual({
      method: 'PUT',
      path: '/journal/gratitude/2026-11-13',
      body: { ifUpdatedAt: 'T1', gone: null },
    });
    // A recipe the server builds is never built here.
    expect(removeCallFor({ method: 'PUT', path: '/finance/budgets', recipe: 'other' as never }, 'r1', {}, {}, today)).toBeNull();
  });

  it('reads a remove’s rows by id with its rules, and Select all’s rows leaving out the ones sent, in one statement each', async () => {
    const q = parseTableQuery(THINGS, {});
    const ids = tableSql(THINGS, { ...q, count: false }, { ...ctx, ids: ['a', 'b'], rules: true });
    expect(ids.sql).toContain('IN (SELECT value FROM json_each(');
    expect(ids.sql).not.toContain('ORDER BY');
    expect(ids.countSql).toBeNull();
    expect(ids.sql).toContain('AS "_q0"');
    expect(ids.sql).toContain('AS "_q1"');
    expect(ids.binds).toContain(JSON.stringify(['a', 'b']));
    // The rules are the owner's alone: never in a coach's or an admin's read, nor when not asked.
    expect(tableSql(THINGS, q, { ...ctx, view: 'coach', rules: true }).sql).not.toContain('_q0');
    expect(tableSql(THINGS, q, { ...ctx, view: 'admin', rules: true }).sql).not.toContain('_q0');
    expect(tableSql(THINGS, q, ctx).sql).not.toContain('_q0');
    const match = tableSql(THINGS, { ...q, count: true }, { ...ctx, not: ['a'], limit: BULK_MAX + 1, offset: 0 });
    expect(match.sql).toContain('NOT IN (SELECT value FROM json_each(');
    expect(match.countSql).toContain('NOT IN (SELECT value FROM json_each(');

    const { DatabaseSync } = await import('node:sqlite');
    const db = new DatabaseSync(':memory:');
    // node:sqlite binds numbered parameters by name, as the other tables' tests do.
    const run = (sql: string, binds: readonly unknown[], one = false) => {
      const st = db.prepare(sql.replace(/\?(\d+)/g, '@p$1'));
      const args = Object.fromEntries(binds.map((v, i) => [`p${i + 1}`, v as string | number]));
      return one ? st.get(args) : st.all(args);
    };
    db.exec('CREATE TABLE things (id TEXT PRIMARY KEY, user_id TEXT, title TEXT, status TEXT, made TEXT, day TEXT, folder_id TEXT, other_id TEXT)');
    const add = db.prepare('INSERT INTO things VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    add.run('a', 'u1', 'Open one', 'open', '2026-11-01T00:00:00Z', '2026-11-01', 'f1', 'u2');
    add.run('b', 'u1', 'Sent one', 'sent', '2026-11-02T00:00:00Z', '2026-11-02', 'f1', null);
    add.run('c', 'u1', 'Paid one', 'paid', '2026-11-03T00:00:00Z', '2026-11-03', 'f1', null);
    add.run('d', 'u1', 'Locked one', 'locked', '2026-11-04T00:00:00Z', '2026-11-04', 'f1', null);
    add.run('e', 'u1', 'Sent later', 'sent', '2026-11-05T00:00:00Z', '2026-12-01', 'f1', null);
    add.run('x', 'u2', 'Someone else', 'open', '2026-11-06T00:00:00Z', '2026-11-06', 'f2', null);
    const all = tableSql(THINGS, { ...q, count: false }, { ...ctx, ids: ['a', 'b', 'c', 'd', 'e', 'x', 'nope'], rules: true });
    const raw = run(all.sql, all.binds) as Record<string, unknown>[];
    // Only the owner's rows, by id; another person's id finds nothing.
    expect(raw.map((r) => r._id).sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
    const state = Object.fromEntries(
      raw.map((r) => {
        const { row, fields } = rowFromRaw(THINGS, r, 'owner');
        // The rules' results are private fields, never cells.
        expect(Object.keys(row.cells).some((k) => k.startsWith('_q')), String(r._id)).toBe(false);
        return [row.id, removeStateOf(THINGS, row.cells, fields)];
      }),
    );
    expect(state).toEqual({
      a: { did: 'deleted', at: 2 },
      b: { did: 'voided', at: 1 },
      c: { why: 'Paid ones stay for the books.' },
      d: { why: 'Locked ones stay.' },
      // Sent, but its day is still to come: the voiding rule does not fit, so it is deleted (this table's own rule, for the test).
      e: { did: 'deleted', at: 2 },
    });
    // Select all's rows: the query's own sort, the owner's rows only, leaving out what was sent, and the count of the rest.
    const m = tableSql(THINGS, { ...q, count: true }, { ...ctx, not: ['e', 'd'], limit: BULK_MAX + 1, offset: 0 });
    expect((run(m.sql, m.binds) as { _id: string }[]).map((r) => r._id)).toEqual(['c', 'b', 'a']);
    expect({ ...(run(m.countSql!, m.countBinds, true) as object) }).toEqual({ n: 3 });
    // A filter holds in Select all as on the page.
    const sent = tableSql(THINGS, { ...parseTableQuery(THINGS, { f_status: 'sent' }), count: true }, { ...ctx, not: [], limit: BULK_MAX + 1, offset: 0 });
    expect({ ...(run(sent.countSql!, sent.countBinds, true) as object) }).toEqual({ n: 2 });
  });

  it('says a remove in the app’s own words: the button, the second tap, the sheet and its counts', () => {
    const t: DataTable = { ...THINGS };
    expect(removeVerbOf(t)).toBe('Delete');
    expect(removeVerbOf({ ...t, remove: undefined })).toBe('Delete');
    expect(removeWords(t, 1)).toMatchObject({ verb: 'Delete', ask: 'Tap again to delete', title: 'Delete 1 row?', yes: 'Yes, delete it', keep: 'Keep it', warn: 'They go for good.' });
    expect(removeWords(t, 3)).toMatchObject({ title: 'Delete 3 rows?', yes: 'Yes, delete them', keep: 'Keep them' });
    // Select all, a hundred at a time.
    expect(removeWords(t, BULK_MAX, 340).title).toBe('Delete the first 100 of 340?');
    // A verb of two words keeps "it" in its middle.
    const down: DataTable = { ...t, remove: { ...t.remove!, verb: 'Take down' } };
    expect(removeWords(down, 2)).toMatchObject({ ask: 'Tap again to take down', title: 'Take down 2 rows?', yes: 'Yes, take them down' });
    expect(verbWith('Take down', 'it')).toBe('take it down');
    expect(verbWith('Unfollow', 'them')).toBe('unfollow them');
    // The table's own words, with the count filled in.
    const own: DataTable = { ...t, remove: { ...t.remove!, verb: 'Leave', title: 'Leave {rows}?', yes: 'Yes, leave {it}', keep: 'Stay in {it}' } };
    expect(removeWords(own, 2)).toMatchObject({ title: 'Leave 2 rows?', yes: 'Yes, leave them', keep: 'Stay in them' });
    expect(rowsWord(1)).toBe('1 row');
    expect(rowsWord(123456)).toBe('1,23,456 rows');
    expect(previewLine({ act: [{ did: 'deleted', n: 6 }, { did: 'voided', n: 2 }], skipped: [{ why: 'Paid invoices stay for the books.', n: 1 }] })).toBe(
      '6 will be deleted and 2 voided. 1 stays as it is: Paid invoices stay for the books.',
    );
    expect(previewLine({ act: [{ did: 'deleted', n: 0 }], skipped: [{ why: 'Locked ones stay.', n: 3 }] })).toBe('None of these can be changed this way. 3 stay as they are: Locked ones stay.');
  });

  it('names one row in its second tap where its app does, and says what goes with that very row', () => {
    const blocks = DATA_TABLES.find((x) => x.key === 'timeBlocks')!;
    const templates = DATA_TABLES.find((x) => x.key === 'dayTemplates')!;
    // As Time blocks' own Delete: "Tap again to delete Deep work", with what goes with it.
    expect(removeWords(blocks, 1, 1, { cells: { name: 'Deep work' } })).toMatchObject({ ask: 'Tap again to delete Deep work', warn: blocks.remove!.warn });
    expect(removeWords(templates, 1, 1, { cells: { name: 'Edit day', weekdays: 'Mon, Tue' } })).toMatchObject({
      ask: 'Tap again to delete Edit day',
      warn: 'The days it has in your week (Mon, Tue), and any day set to it, follow your default again.',
    });
    // No weekdays of its own keeps the spec's line; no row, or several rows, keep the plain ask.
    expect(removeWords(templates, 1, 1, { cells: { name: 'Edit day', weekdays: null } }).warn).toBe(templates.remove!.warn);
    expect(removeWords(templates, 1).ask).toBe('Tap again to delete');
    expect(removeWords(templates, 2, 2, { cells: { name: 'Edit day' } }).ask).toBe('Tap again to delete');
    // Every name and row line points at a column the table has.
    for (const t of DATA_TABLES) {
      for (const key of [t.remove?.nameCell, t.remove?.rowWarn?.cell]) if (key) expect(t.columns.some((col) => col.key === key), `${t.key}.${key}`).toBe(true);
      if (t.remove?.rowWarn) expect(t.remove.rowWarn.words).toContain('{value}');
    }
  });

  it('names people and events in their own words, never "row" (the review of 2026-11-14)', () => {
    const byKey = (key: string) => DATA_TABLES.find((x) => x.key === key)!;
    // Every table whose rows are people, or events and the places people meet, names what it removes.
    const PEOPLE_OR_EVENTS = [
      'friends', 'following', 'followers', 'mutes', 'blocks', 'lifeCoaches', 'coachStudents', 'agencyTeam', 'armyBrandTeams', 'introductions', 'leads',
      'courseInvites', 'programInvitesSent', 'programInvites', 'myCourseInvites',
      'partyHosted', 'partyJoined', 'runsHosted', 'runClubsHosted', 'runClubsJoined', 'runEntriesHosted', 'myBookings', 'bookings', 'circleSignups',
      'clubMembership', 'communityChannels', 'bondChannels', 'enrolments', 'armyCampaigns', 'armyRoles', 'armyBrands',
    ];
    for (const key of PEOPLE_OR_EVENTS) {
      const t = byKey(key);
      expect(t?.remove?.noun, `${key} names its rows`).toBeTruthy();
      for (const n of [1, 3]) {
        const w = removeWords(t, n);
        expect(`${w.title} ${w.yes} ${w.keep}`, `${key} ${n}`).not.toMatch(/\brows?\b/);
      }
      expect(removeWords(t, BULK_MAX, 340).title, key).not.toMatch(/\brows?\b/);
      expect(removeCount(t, 2), key).not.toMatch(/\brows?\b/);
    }
    for (const t of DATA_TABLES) {
      const noun = t.remove?.noun;
      if (!noun) continue;
      expect(noun.one, t.key).toMatch(/^[a-z][a-z ]*[a-z]$/);
      expect(noun.many, t.key).toMatch(/^[a-z][a-z ]*[a-z]$/);
      expect(noun.many, t.key).not.toBe(noun.one);
    }
    // A person is "them", one or many; an event is "it".
    const friends = byKey('friends');
    expect(removeWords(friends, 1)).toMatchObject({ title: 'Remove 1 friend?', yes: 'Yes, remove them', keep: 'Keep them' });
    expect(removeWords(friends, 3)).toMatchObject({ title: 'Remove 3 friends?', yes: 'Yes, remove them' });
    expect(removeWords(friends, BULK_MAX, 340).title).toBe('Remove the first 100 of 340 friends?');
    expect(removeWords(byKey('blocks'), 1)).toMatchObject({ title: 'Unblock 1 person?', yes: 'Yes, unblock them' });
    expect(removeWords(byKey('agencyTeam'), 1)).toMatchObject({ title: 'Remove 1 teammate?', yes: 'Yes, remove them' });
    expect(removeWords(byKey('partyHosted'), 1)).toMatchObject({ title: 'Cancel 1 event?', yes: 'Yes, cancel it', keep: 'Keep it' });
    expect(removeWords(byKey('lifeCoaches'), 2)).toMatchObject({ title: 'End coaching with 2 coaches?', yes: 'Yes, end the coaching' });
    // `{it}` in a spec's own words stays the count's: a mute is "it".
    expect(removeWords(byKey('mutes'), 1)).toMatchObject({ title: 'Lift the mute on 1 person?', yes: 'Yes, lift it' });
    // Past a hundred a spec's own title stays its own, the first hundred in its `{rows}`, so it says what its red yes says (the review of
    // 2026-11-14: "Remove the first 100 of 250 people?" sat over "Yes, lift them").
    expect(removeWords(byKey('mutes'), BULK_MAX, 250)).toMatchObject({ title: 'Lift the mute on the first 100 of 250 people?', yes: 'Yes, lift them' });
    expect(removeWords(byKey('lifeCoaches'), BULK_MAX, 250).title).toBe('End coaching with the first 100 of 250 coaches?');
    expect(removeWords(byKey('coachStudents'), BULK_MAX, 250).title).toBe('End coaching with the first 100 of 250 students?');
    expect(removeWords(byKey('supplementDays'), BULK_MAX, 250)).toMatchObject({ title: 'Untick the first 100 of 250?', yes: 'Yes, untick them' });
    for (const t of DATA_TABLES) {
      if (!t.remove) continue;
      // A title of its own says the count through `{rows}`, so the words past a hundred are its own too.
      if (t.remove.title) expect(t.remove.title, t.key).toContain('{rows}');
      // Select all keeps the verb the few-rows sheet asks with.
      expect(removeWords(t, BULK_MAX, 340).title.split(' ')[0], t.key).toBe(removeWords(t, 3).title.split(' ')[0]);
    }
    // The status line counts them too; a table with no noun keeps rows.
    expect(removeCount(friends, 1)).toBe('1 friend');
    expect(removeCount(THINGS, 2)).toBe('2 rows');
    expect(removeDoneLine(friends, 'removed', 2)).toBe('2 friends removed.');
    expect(removeDoneLine(THINGS, 'deleted', 1)).toBe('1 row deleted.');
    // Where the count before the word would say the people were acted on, the line names the mute, the coaching or the ask instead.
    expect(removeDoneLine(byKey('mutes'), 'lifted', 2)).toBe('Lifted the mute on 2 people.');
    expect(removeDoneLine(byKey('lifeCoaches'), 'ended', 1)).toBe('Ended coaching with 1 coach.');
    expect(removeDoneLine(byKey('lifeCoaches'), 'turned down', 1)).toBe('Said no to 1 coach.');
    expect(removeDoneLine(byKey('coachStudents'), 'taken back', 2)).toBe('Took back the ask to 2 students.');
    expect(removeDoneLine(byKey('armyBrandTeams'), 'taken back', 1)).toBe('Took back the ask to 1 teammate.');
    expect(removeDoneLine(byKey('armyBrandTeams'), 'removed', 2)).toBe('2 teammates removed.');
    // No table of people says "<n> people lifted", "ended", "turned down" or "taken back": each of those has a line of its own.
    for (const t of DATA_TABLES) {
      const r = t.remove;
      // A mute's rows are people too, though its `{it}` is the mute.
      if (!r?.noun || !(r.noun.person || r.noun.one === 'person')) continue;
      const dids = [...(r.call ? [r.did] : []), ...(r.outcomes ?? []).flatMap((o) => ('did' in o ? [o.did] : []))];
      for (const did of dids) {
        if (!['lifted', 'ended', 'turned down', 'taken back'].includes(did)) continue;
        expect(removeDoneLine(t, did, 2), `${t.key} ${did}`).not.toBe(`${removeCount(t, 2)} ${did}.`);
        expect(removeDoneLine(t, did, 2), `${t.key} ${did}`).toContain(removeCount(t, 2));
      }
    }
  });

  it('asks a row in the sheet where its app does (sheetWhen: a post with replies), else on a second tap', () => {
    const posts = DATA_TABLES.find((x) => x.key === 'posts')!;
    expect(posts.remove).toMatchObject({ ask: 'twice' });
    expect(posts.remove!.sheetWhen).toMatch(/community_replies/);
    expect(ruleSelects(posts)).toEqual([posts.remove!.sheetWhen]);
    expect(removeStateOf(posts, {}, { _q0: 0 })).toEqual({ did: 'deleted', at: -1 });
    expect(removeStateOf(posts, {}, { _q0: 1 })).toEqual({ did: 'deleted', at: -1, sheet: true });
    // A read that did not work the rule out asks in the sheet: the safe ask.
    expect(removeStateOf(posts, {}, {})).toEqual({ did: 'deleted', at: -1, sheet: true });
    // After `only` and the outcomes, in the read's order: its field is the last SQL rule's.
    const withSheet: DataTable = { ...THINGS, remove: { ...THINGS.remove!, ask: 'twice', sheetWhen: "t.title <> ''" } };
    expect(ruleSelects(withSheet)).toEqual(["t.status <> 'locked'", "t.status = 'sent' AND {today} >= t.day", "t.title <> ''"]);
    expect(removeStateOf(withSheet, { status: 'open' }, { _q0: 1, _q1: 0, _q2: 1 })).toEqual({ did: 'deleted', at: 2, sheet: true });
    expect(removeStateOf(withSheet, { status: 'open' }, { _q0: 1, _q1: 0, _q2: 0 })).toEqual({ did: 'deleted', at: 2 });
    expect(removeStateOf(withSheet, { status: 'paid' }, { _q0: 1, _q1: 0, _q2: 1 })).toEqual({ why: 'Paid ones stay for the books.' });
    // Only a 'twice' spec has one, and the bar's second tap tells the server so, which skips a row that asks in the sheet by now.
    for (const t of DATA_TABLES) if (t.remove?.sheetWhen !== undefined) expect(t.remove.ask, t.key).toBe('twice');
    const src = read('../../../apps/api/src/routes/tables.ts');
    expect(src).toMatch(/body\.asked === 'twice'/);
    expect(src).toMatch(/twice && state\.sheet/);
  });

  it('keeps a call to Select all and its rounds bounded', () => {
    expect(BULK_MAX).toBe(100);
    expect(MATCH_NOT_MAX).toBe(10 * BULK_MAX);
  });

  it('serves remove, preview and matching on the owner’s mount only, and refuses AI chat on every write', () => {
    const src = read('../../../apps/api/src/routes/tables.ts');
    // The owner's bulk route is the one place these actions are read.
    expect(src).toMatch(/r\.post\('\/:table\/bulk'/);
    expect(src).toContain("body.action === 'matching'");
    expect(src).toContain("body.action === 'preview' || body.action === 'remove'");
    // Neither a coach's nor an admin's mount has a write route.
    expect(src).not.toMatch(/r\.(post|patch|put|delete)\('\/(coach|admin)/);
    // A call marked as AI chat is refused on anything but a read.
    expect(src).toMatch(/if \(c\.req\.method !== 'GET' \|\| rest\.length > 1/);
    // Each row goes to the app's own route as the person, in turn, watching the round trips: an archive's rows cost alike, and a remove
    // starts a row only while twice the dearest so far is left, since a later one can cost more (the review of 2026-11-14).
    expect(src).toMatch(/tripsOf\(db\) \+ dearest \+ 2 > ROUTE_TRIPS/);
    expect(src).toMatch(/tripsOf\(db\) \+ 2 \* dearest \+ 2 > ROUTE_TRIPS/);
  });
});
