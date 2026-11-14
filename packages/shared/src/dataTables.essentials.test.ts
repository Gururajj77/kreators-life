import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DATA_TABLES,
  dataTableByKey,
  editValue,
  editWhenWhy,
  parseTableQuery,
  plainCall,
  REPEAT_OPTIONS,
  removeCallFor,
  removeCallOf,
  removeStateOf,
  rowEditable,
  rowFromRaw,
  tableColumn,
  tableEditable,
  tableSql,
  type DataTable,
} from './dataTables';
import { NOT_TO_DO_TITLE_MAX, parseRepeat, REPEAT_KINDS } from './index';
import { INVITE_LABEL_MAX } from './invites';

// All tables' Edit and remove for Essentials (2026-11-14, the founder: "each entry for the original user and not for coach, and not even ai, edit
// and delete buttons should also be there in select and multi select and select all"): Daily, Pillars, Rewards, Account, and Invites and help.
// Each row changes or goes through the app's own route as the person; a record (xp, a badge, signed paper, consent and terms) stays and says why.

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const today = '2026-11-14';
const ctx = { view: 'owner' as const, ownerId: 'u1', viewerId: 'u1', today, zone: 'Asia/Kolkata' };
const t = (k: string): DataTable => dataTableByKey[k]!;
const col = (k: string, c: string) => tableColumn(t(k), c)!;
const editable = (k: string) => t(k).columns.filter((x) => x.edit).map((x) => x.key);

const ESSENTIALS = ['daily', 'pillars', 'rewards', 'account', 'invites'];

describe('All tables: Essentials, edited and removed by their owner (2026-11-14)', () => {
  it('says for every one of its tables how a row is edited and removed here, or why not', () => {
    const mine = DATA_TABLES.filter((x) => ESSENTIALS.includes(x.group));
    expect(mine.length).toBe(31);
    for (const x of mine) {
      expect(tableEditable(x) || Boolean(x.noEditWhy), `${x.key} edit`).toBe(true);
      expect(Boolean(x.remove) || Boolean(x.noRemoveWhy), `${x.key} remove`).toBe(true);
    }
  });

  it('removes in the app’s own word, asking as the app asks, through the app’s own route', () => {
    const removes = Object.fromEntries(
      DATA_TABLES.filter((x) => ESSENTIALS.includes(x.group) && x.remove).map((x) => {
        const r = x.remove!;
        const calls = [...(r.call ? [r.call] : []), ...(r.outcomes ?? []).flatMap((o) => ('call' in o ? [o.call] : []))];
        return [x.key, [r.verb, r.ask, ...calls.map((c) => `${c.method} ${c.path}`)]];
      }),
    );
    expect(removes).toEqual({
      // Small personal rows the person can make again: a second tap, as on Daily, Time blocks and Water and reminders.
      tasks: ['Delete', 'twice', 'DELETE /nodes/:id'],
      subtasks: ['Remove', 'twice', 'DELETE /nodes/subtasks/:id'],
      notToDo: ['Remove', 'twice', 'DELETE /today/not-to-do/:id'],
      notToDoDays: ['Clear', 'twice', 'POST /today/not-to-do/:id/day'],
      reminders: ['Remove', 'twice', 'DELETE /reminders/custom/:id'],
      kindsOfDay: ['Clear', 'twice', 'PUT /time-blocks/days'],
      timeBlocks: ['Delete', 'twice', 'DELETE /time-blocks/blocks/:id'],
      dayTemplates: ['Delete', 'twice', 'DELETE /time-blocks/templates/:id'],
      routineDays: ['Clear', 'twice', 'DELETE /session/day/:id'],
      calendarLink: ['Close', 'twice', 'POST /me/calendar'],
      inviteCodes: ['Withdraw', 'twice', 'DELETE /me/invites/:id'],
      teamMessages: ['Withdraw', 'twice', 'DELETE /support/:id'],
      // A layer that holds others up, points coming back, and the team's own list: a sheet.
      pyramids: ['Remove', 'sheet', 'DELETE /nodes/:id'],
      liveCalls: ['Withdraw', 'sheet', 'POST /session/call/:id/withdraw'],
      rewardReservations: ['Cancel', 'sheet', 'POST /rewards/redemptions/:id/cancel'],
    });
    // Records stay, each saying why: xp, scores, placements, signed paper, games, badges, honors, seasons, consent and terms.
    const RECORDS = ['smallActs', 'pillarScores', 'xpHistory', 'lifeMap', 'lifeMapAnswers', 'vibeCheckAnswers', 'routine', 'contract', 'gamesUnlocked', 'badges', 'honors', 'seasonPlaces', 'privacyRecords', 'termsAccepted'];
    for (const k of RECORDS) {
      expect(t(k).remove, k).toBeUndefined();
      expect(editable(k), k).toEqual([]);
      expect(t(k).noEditWhy, k).toMatch(/^[A-Z].*\.$/);
      expect(t(k).noRemoveWhy, k).toMatch(/^[A-Z].*\.$/);
    }
    // The inbox puts a note away first, as Inbox does; a privacy choice is switched off, never removed.
    expect(t('inbox').remove).toBeUndefined();
    expect(t('inbox').noRemoveWhy).toMatch(/Archive a note first/);
    expect(t('privacyChoices').noRemoveWhy).toMatch(/Switch Allowed off/);
    // Tasks keep their archive, and its Delete forever only for a task let go, exactly as before.
    expect(t('tasks').archive?.remove.path).toBe('/nodes/:id?archived=1');
  });

  it('changes only through the app’s own routes, each field one the app takes', () => {
    expect(editable('tasks')).toContain('repeat');
    expect(editable('notToDo')).toEqual(['title', 'pillar']);
    expect(editable('timeBlocks')).toEqual(['name', 'tag', 'color', 'lifeArea', 'pillar']);
    expect(editable('dayTemplates')).toEqual(['name', 'lead', 'second', 'isDefault']);
    expect(editable('routineDays')).toEqual(['dayType', 'done']);
    expect(editable('inbox')).toEqual(['read']);
    expect(editable('inviteCodes')).toEqual(['label']);
    expect(editable('teamMessages')).toEqual(['subject', 'words']);
    // The limits match the app's own (a leaf may not import the barrel's or a subpath's numbers).
    expect(col('notToDo', 'title').edit?.maxLength).toBe(NOT_TO_DO_TITLE_MAX);
    expect(col('inviteCodes', 'label').edit?.maxLength).toBe(INVITE_LABEL_MAX);
    // A repeat in the plain shapes, named as REPEAT_KINDS names them, sent as JSON the route reads with parseRepeat; Once clears it.
    expect(REPEAT_OPTIONS.filter((o) => !o.isNull).map((o) => [o.value, o.label])).toEqual(REPEAT_KINDS.map((k) => [k.key, k.name]));
    const repeat = col('tasks', 'repeat');
    expect(repeat.edit).toMatchObject({ method: 'PATCH', path: '/nodes/:id', field: 'repeat', input: 'select', current: 'repeatKind', when: 'open' });
    const weekly = editValue(repeat, 'weekly');
    expect(weekly).toEqual({ value: '{"kind":"weekly"}' });
    expect(parseRepeat((weekly as { value: string }).value)).toEqual({ kind: 'weekly', every: 1, days: [], until: null });
    expect(editValue(repeat, 'none')).toEqual({ value: null });
    expect(editValue(repeat, 'constructor')).toHaveProperty('error');
    expect(plainCall(repeat, 'n1', { status: 'active' }, '{"kind":"daily"}', today)).toEqual({ method: 'PATCH', path: '/nodes/n1', body: { repeat: '{"kind":"daily"}' } });
    expect(rowEditable(t('tasks'), repeat, { status: 'done' }, today)).toBe(false);
    // Not to do: the words and the pillar, one field a call; no pillar is null.
    expect(plainCall(col('notToDo', 'pillar'), 'i1', {}, null, today)).toEqual({ method: 'PATCH', path: '/today/not-to-do/i1', body: { relationship: null } });
    expect(editValue(col('notToDo', 'pillar'), 'none')).toEqual({ value: null });
    expect(editValue(col('notToDo', 'title'), 'x'.repeat(NOT_TO_DO_TITLE_MAX + 1))).toHaveProperty('error');
    // A block's colour: one of the wheel's (a colour of one's own shows where it starts, unpickable).
    expect(editValue(col('timeBlocks', 'color'), 'teal')).toEqual({ value: 'teal' });
    expect(editValue(col('timeBlocks', 'color'), '#123456')).toHaveProperty('error');
    // Routine days: any past day, never one still to come, with the device's day for the route's own check.
    const done = col('routineDays', 'done');
    expect(rowEditable(t('routineDays'), done, { day: '2025-01-03' }, today)).toBe(true);
    expect(rowEditable(t('routineDays'), done, { day: '2026-11-15' }, today)).toBe(false);
    expect(editWhenWhy(done.edit!, {})).toBe('A day still to come cannot be changed yet.');
    expect(plainCall(done, '2026-11-01', { day: '2026-11-01' }, true, today)).toEqual({ method: 'PATCH', path: '/session/day/2026-11-01', body: { done: true, today } });
    expect(plainCall(col('routineDays', 'dayType'), '2026-11-01', {}, 'exceptional', today)).toEqual({ method: 'PATCH', path: '/session/day/2026-11-01', body: { dayType: 'exceptional', today } });
    // Inbox: off marks it unread again, through the read route Inbox uses.
    expect(plainCall(col('inbox', 'read'), 'n9', {}, false, today)).toEqual({ method: 'POST', path: '/inbox/n9/read', body: { read: false } });
    // A code's label; empty clears it.
    expect(editValue(col('inviteCodes', 'label'), '')).toEqual({ value: '' });
    expect(plainCall(col('inviteCodes', 'label'), 'c1', {}, 'For Priya', today)).toEqual({ method: 'PATCH', path: '/me/invites/c1', body: { label: 'For Priya' } });
    // A message to the team: only while the team has not answered it, and never a report, in this table's own words.
    const subject = col('teamMessages', 'subject');
    expect(rowEditable(t('teamMessages'), subject, { status: 'active' }, today)).toBe(true);
    expect(rowEditable(t('teamMessages'), subject, { status: 'kept' }, today)).toBe(false);
    expect(editWhenWhy(subject.edit!, { status: 'kept' })).toBe('Only a message the team has not answered can be changed. A report stays as you sent it.');
    expect(plainCall(col('teamMessages', 'words'), 's1', { status: 'active' }, 'More detail', today)).toEqual({ method: 'PATCH', path: '/support/s1', body: { body: 'More detail' } });
  });

  it('works each row’s remove out by its state, and builds its call only from the row', () => {
    // A default kind of day is skipped, in Time blocks' own words; any other is deleted.
    expect(removeStateOf(t('dayTemplates'), { isDefault: true })).toEqual({ why: 'Make another kind of day the default first.' });
    expect(removeStateOf(t('dayTemplates'), { isDefault: false })).toEqual({ did: 'deleted', at: 1 });
    // Only an ask still waiting for the team; only a reservation still waiting; only a link that is on; only a code that still works; only a
    // message not answered.
    expect(removeStateOf(t('liveCalls'), { state: 'asked' })).toEqual({ did: 'withdrawn', at: -1 });
    for (const s of ['paying', 'paid', 'booked', 'done', 'cancelled']) expect(removeStateOf(t('liveCalls'), { state: s }), s).toHaveProperty('why');
    expect(removeStateOf(t('rewardReservations'), { status: 'reserved' })).toEqual({ did: 'cancelled', at: -1 });
    for (const s of ['unlocked', 'fulfilled', 'cancelled']) expect(removeStateOf(t('rewardReservations'), { status: s }), s).toHaveProperty('why');
    expect(removeStateOf(t('calendarLink'), { on: true })).toEqual({ did: 'switched off', at: -1 });
    expect(removeStateOf(t('calendarLink'), { on: false })).toEqual({ why: 'It is off already.' });
    expect(removeStateOf(t('inviteCodes'), { state: 'open' })).toEqual({ did: 'taken back', at: -1 });
    for (const s of ['used', 'expired', 'revoked']) expect(removeStateOf(t('inviteCodes'), { state: s }), s).toHaveProperty('why');
    expect(removeStateOf(t('teamMessages'), { status: 'active' })).toEqual({ did: 'withdrawn', at: -1 });
    expect(removeStateOf(t('teamMessages'), { status: 'kept' })).toHaveProperty('why');
    // A done task is deleted like an open one (2026-11-14, the founder): its xp stays, which the route never touches.
    expect(removeStateOf(t('tasks'), { status: 'done' })).toEqual({ did: 'deleted', at: -1 });
    expect(removeCallFor(removeCallOf(t('tasks').remove!, -1)!, 'n1', {}, {}, today)).toEqual({ method: 'DELETE', path: '/nodes/n1' });
    // A not to do day is unmarked through Daily's own route: the item's id from its hidden cell, the day from the row, the device's day.
    const ntd = removeCallOf(t('notToDoDays').remove!, -1)!;
    expect(removeCallFor(ntd, 'i1:2026-11-13', { itemId: 'i1', day: '2026-11-13' }, {}, today)).toEqual({ method: 'POST', path: '/today/not-to-do/i1/day', body: { status: null, date: '2026-11-13', today } });
    // A kind of day follows the week again: one day, no template.
    const kind = removeCallOf(t('kindsOfDay').remove!, -1)!;
    expect(removeCallFor(kind, '2026-11-13', { day: '2026-11-13' }, {}, today)).toEqual({ method: 'PUT', path: '/time-blocks/days', body: { templateId: null, date: '2026-11-13' } });
    // A routine day is cleared with the device's day in the query, which the route checks it against.
    const routine = removeCallOf(t('routineDays').remove!, -1)!;
    expect(removeCallFor(routine, '2026-11-13', { day: '2026-11-13' }, {}, today)).toEqual({ method: 'DELETE', path: '/session/day/2026-11-13?day=2026-11-14' });
    expect(removeCallFor(removeCallOf(t('calendarLink').remove!, -1)!, 'calendar', { on: true }, {}, today)).toEqual({ method: 'POST', path: '/me/calendar', body: { on: false } });
  });

  it('reads the rules with the row: a not to do day only today or yesterday, a message only while the team has not answered, a task’s repeat', async () => {
    const { DatabaseSync } = await import('node:sqlite');
    const db = new DatabaseSync(':memory:');
    db.exec(`CREATE TABLE not_to_do (id TEXT PRIMARY KEY, user_id TEXT, title TEXT, relationship TEXT, streak INTEGER, best_streak INTEGER, created_at TEXT);
      CREATE TABLE not_to_do_days (item_id TEXT, user_id TEXT, day TEXT, status TEXT, created_at TEXT, PRIMARY KEY (item_id, day));
      CREATE TABLE support_tickets (id TEXT PRIMARY KEY, user_id TEXT, subject TEXT, body TEXT, status TEXT, reply TEXT, replied_by TEXT, created_at TEXT, updated_at TEXT);
      CREATE TABLE users (id TEXT PRIMARY KEY, display_name TEXT, handle TEXT);
      CREATE TABLE nodes (id TEXT PRIMARY KEY, user_id TEXT, kind TEXT, parent_id TEXT, relationship TEXT, title TEXT, note TEXT, status TEXT, xp INTEGER, due_date TEXT, completed_at TEXT,
        created_at TEXT, updated_at TEXT, due_time TEXT, estimate_min INTEGER, added_by TEXT, do_date TEXT, repeat_json TEXT, priority INTEGER, remind INTEGER, for_review INTEGER, habit INTEGER,
        life_area TEXT, open_kind TEXT, time_block_id TEXT, hidden_until TEXT, origin TEXT);
      INSERT INTO not_to_do VALUES ('i1', 'u1', 'Late coffee', NULL, 0, 0, '2026-11-01T00:00:00Z'), ('i2', 'u2', 'Theirs', NULL, 0, 0, '2026-11-01T00:00:00Z');
      INSERT INTO not_to_do_days VALUES ('i1', 'u1', '2026-11-14', 'kept', 'x'), ('i1', 'u1', '2026-11-13', 'slipped', 'x'), ('i1', 'u1', '2026-11-12', 'kept', 'x'), ('i2', 'u2', '2026-11-14', 'kept', 'x');
      INSERT INTO nodes (id, user_id, kind, title, note, status, xp, created_at, updated_at, do_date, repeat_json) VALUES
        ('n1', 'u1', 'task', 'Walk', '', 'active', 0, 'a', 'a', '2026-11-14', '{"kind":"weekly","every":2,"days":[1,4],"until":null}'),
        ('n2', 'u1', 'task', 'Call home', '', 'done', 5, 'b', 'b', '2026-11-13', NULL);
      INSERT INTO support_tickets VALUES
        ('s1', 'u1', 'The app froze', 'On Daily', 'open', '', NULL, '2026-11-10T00:00:00Z', '2026-11-10T00:00:00Z'),
        ('s2', 'u1', 'Report: a line in the run discussion Sunday', 'It says: …', 'open', '', NULL, '2026-11-11T00:00:00Z', '2026-11-11T00:00:00Z'),
        ('s3', 'u1', 'Billing', 'Two charges', 'answered', 'Fixed it', 'staff1', '2026-11-12T00:00:00Z', '2026-11-12T00:00:00Z'),
        ('s4', 'u2', 'Someone else', 'Theirs', 'open', '', NULL, '2026-11-13T00:00:00Z', '2026-11-13T00:00:00Z');`);
    const named = (sql: string, binds: readonly unknown[]) => ({ sql: sql.replace(/\?(\d+)/g, '@p$1'), args: Object.fromEntries(binds.map((v, i) => [`p${i + 1}`, v as string | number])) });
    const removeStates = (k: string, ids: string[]) => {
      const tab = t(k);
      const s = tableSql(tab, { ...parseTableQuery(tab, {}), count: false }, { ...ctx, ids, rules: true });
      const n = named(s.sql, s.binds);
      return Object.fromEntries(
        (db.prepare(n.sql).all(n.args) as Record<string, unknown>[]).map((raw) => {
          const { row, fields } = rowFromRaw(tab, raw, 'owner');
          return [row.id, removeStateOf(tab, row.cells, fields)];
        }),
      );
    };
    // Today and yesterday only; another person's day finds nothing.
    expect(removeStates('notToDoDays', ['i1:2026-11-14', 'i1:2026-11-13', 'i1:2026-11-12', 'i2:2026-11-14'])).toEqual({
      'i1:2026-11-14': { did: 'cleared', at: -1 },
      'i1:2026-11-13': { did: 'cleared', at: -1 },
      'i1:2026-11-12': { why: 'Only today or yesterday can be marked or cleared, as on Daily.' },
    });
    // A plain open message may change or go; a report or an answered one stays; another person's is not read.
    const tickets = removeStates('teamMessages', ['s1', 's2', 's3', 's4']);
    expect(Object.keys(tickets).sort()).toEqual(['s1', 's2', 's3']);
    expect(tickets.s1).toEqual({ did: 'withdrawn', at: -1 });
    expect(tickets.s2).toHaveProperty('why');
    expect(tickets.s3).toHaveProperty('why');
    // A task's repeat starts its select from the stored rule's kind (Every 2 weeks reads as Every week there; the cell keeps its own words),
    // and a done task is deleted like an open one.
    const tasks = t('tasks');
    const ts = tableSql(tasks, { ...parseTableQuery(tasks, {}), count: false }, { ...ctx, ids: ['n1', 'n2'], rules: true });
    const tn = named(ts.sql, ts.binds);
    const taskRows = (db.prepare(tn.sql).all(tn.args) as Record<string, unknown>[]).map((raw) => rowFromRaw(tasks, raw, 'owner').row).sort((a, b) => a.id.localeCompare(b.id));
    expect(taskRows.map((r) => [r.id, r.cells.repeatKind, r.cells.status])).toEqual([['n1', 'weekly', 'active'], ['n2', null, 'done']]);
    expect(taskRows.map((r) => removeStateOf(tasks, r.cells))).toEqual([{ did: 'deleted', at: -1 }, { did: 'deleted', at: -1 }]);
    // The rule is the same one the routes hold in their statements.
    expect(read('../../../apps/api/src/routes/support.ts')).toContain("const OWN_OPEN = \"user_id = ? AND status = 'open' AND reply = '' AND subject NOT LIKE 'Report: %'\";");
  });

  it('holds every new route to the owner, the row’s state and one change, with its limit, and gives AI chat none of it', () => {
    const today_ = read('../../../apps/api/src/routes/today.ts');
    expect(today_).toContain("today.patch('/not-to-do/:id'");
    expect(today_).toContain('UPDATE not_to_do SET ${sets.join(\', \')} WHERE id = ? AND user_id = ?');
    const session = read('../../../apps/api/src/routes/session.ts');
    // Any past day, never one still to come, on every routine day route: the tick, the change and the clear.
    expect(session.match(/routineDayProblem\(/g)?.length).toBeGreaterThanOrEqual(4);
    expect(session).toContain("if (date > own) return 'A day still to come cannot be ticked yet.';");
    // The tick and the change never reach a day before the account began; clearing one passes no start (the review of 2026-11-14).
    expect(session).toContain('return joined && beforeStart(date, joined, own) ? BEFORE_JOINED : null;');
    expect(session.match(/startDay\(user\.created_at, user\.timezone\)/g)?.length).toBe(2);
    expect(session).toContain('WHERE user_id = ? AND day = ? AND updated_at = ?');
    expect(session).toContain("session.delete('/day/:date'");
    expect(session).toContain("session.post('/call/:id/withdraw'");
    expect(read('../../../apps/api/src/liveCall.ts')).toContain("WHERE id = ? AND user_id = ? AND status = 'asked'");
    expect(read('../../../apps/api/src/routes/invites.ts')).toContain('UPDATE invite_codes SET label = ? WHERE id = ? AND created_by = ?');
    expect(read('../../../apps/api/src/routes/inbox.ts')).toContain('if (body.read === false)');
    const blocks = read('../../../apps/api/src/routes/timeBlocks.ts');
    expect(blocks).toContain("typeof body.date === 'string' ? [body.date] : []");
    expect(blocks).toContain("if (body.isDefault === false && tpl.isDefault)");
    // A report is written with "Report: " first by every route that writes one, so the support routes' rule keeps them as sent.
    for (const f of ['cohortTalk', 'channels', 'run']) expect(read(`../../../apps/api/src/routes/${f}.ts`), f).toMatch(/`Report: /);
    // Every new write has its limit.
    const limits = read('../../../apps/api/src/limits.ts');
    for (const line of [
      "{ method: 'PATCH', path: '/today/not-to-do/:id', limit: 'prefs' }",
      "{ method: 'POST', path: '/session/call/:id/withdraw', limit: 'checkout' }",
      "{ method: 'PATCH', path: '/session/day/:date', limit: 'prefs' }",
      "{ method: 'DELETE', path: '/session/day/:date', limit: 'prefs' }",
      "{ method: 'PATCH', path: '/me/invites/:id', limit: 'inviteMake' }",
      "{ method: 'PATCH', path: '/support/:id', limit: 'prefs' }",
      "{ method: 'DELETE', path: '/support/:id', limit: 'prefs' }",
    ])
      expect(limits, line).toContain(line);
    // No assistant tool reaches the new routes: AI chat reads tables, never changes them.
    const tools = read('../../../apps/api/src/assistant/tools.ts');
    for (const p of ['/withdraw', "'/support/", '/me/invites', '/session/day/', "method: 'PATCH', path: `/today/not-to-do"]) expect(tools, p).not.toContain(p);
  });
});
