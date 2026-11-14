import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ATTENDEE_XP_MOST,
  audienceOf,
  CIRCLE_SHOW_UP_OPTIONS,
  coachTableKeys,
  CODE_OPENS_MINUTES,
  DATA_TABLES,
  dataTableByKey,
  editValue,
  EVENT_TYPE_OPTIONS,
  listTables,
  parseTableQuery,
  plainCall,
  rowEditable,
  RUN_PACE_OPTIONS,
  tableAllowed,
  tableColumn,
  tableReach,
  tableSql,
  visibleColumns,
  type ColumnOption,
} from './dataTables';
import { ATTENDEE_XP_MAX, CIRCLE_STATUS_META, CIRCLE_STATUSES, EVENT_TYPE_META, EVENT_TYPES, RUN_CODE_WINDOW, RUN_PACE_META, RUN_PACES } from './index';

// All tables' fifth batch (2026-11-14, the founder: "ok, add them"): Party, Kreators Run and Circles. Its own file, beside dataTables.test.ts,
// which holds the rules every table meets (the schema, the owner's index, secrets, routes and words); this one holds what is particular to
// these sixteen.

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const MIGRATIONS = new URL('../../../apps/api/migrations/', import.meta.url);
const today = '2026-11-14';
const editable = (k: string) => dataTableByKey[k]!.columns.filter((col) => col.edit).map((col) => col.key);
const pairs = (o: readonly ColumnOption[]) => o.filter((x) => !x.isNull).map((x) => [x.value, x.label]);
const ctx = { view: 'owner' as const, ownerId: 'u1', viewerId: 'u1', today, zone: 'Asia/Kolkata' };

/** Every SQL string a table holds. */
const textOf = (k: string) => {
  const t = dataTableByKey[k]!;
  return [t.from, t.owner, t.where ?? '', t.coachWhere ?? '', t.idSql, ...t.columns.flatMap((col) => [col.sql ?? '', col.sortSql ?? '', col.searchSql ?? '', col.filterSql ?? '', ...(col.sortTerms ?? [])]), ...Object.values(t.privateSelect ?? {})].join(' ');
};

describe('All tables: Party, Kreators Run and Circles (2026-11-14)', () => {
  // The person's own records, with nobody else's details or words in them: the old rules.
  const OWN = [
    'partyHosted', 'partyJoined', 'partyFeedback', 'partyLines',
    'runClubsHosted', 'runClubsJoined', 'runsHosted', 'runEntries', 'runLines', 'runCollabsPosted', 'runCollabApplications',
  ];
  // Another person's name or words: the guests at the person's events, who logged the runs at their clubs, the clubs (and hosts) that applied to
  // their collabs; their own lines at a circle's tables, which hold only their words but would say who wrote under an alias; and the circles
  // they signed up for, which Circles tells nobody, its own hosts included (the review: a named seat narrows an alias at the table).
  const OTHERS = ['partyGuests', 'runEntriesHosted', 'runCollabApplicants', 'circleSignups', 'circleLines'];
  const BATCH = [...OWN, ...OTHERS];

  it('holds every table, each with its audience and the app its records belong to', () => {
    for (const k of BATCH) expect(dataTableByKey[k], k).toBeTruthy();
    expect(DATA_TABLES.filter((t) => ['party', 'runs', 'circles'].includes(t.group)).map((t) => t.key).sort()).toEqual([...BATCH].sort());
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
    for (const k of BATCH) {
      const t = dataTableByKey[k]!;
      expect(t.needs, k).toEqual([t.group === 'party' ? 'party' : t.group === 'runs' ? 'run' : 'circles']);
    }
    const keysFor = (on: string[]) => listTables('owner', [], on).flatMap((g) => g.tables.map((t) => t.key));
    for (const k of BATCH) expect(keysFor([]), k).not.toContain(k);
    expect(keysFor(['party']).filter((k) => BATCH.includes(k))).toEqual(['partyHosted', 'partyGuests', 'partyJoined', 'partyFeedback', 'partyLines']);
    expect(keysFor(['run']).filter((k) => BATCH.includes(k)).length).toBe(9);
    expect(keysFor(['circles']).filter((k) => BATCH.includes(k))).toEqual(['circleSignups', 'circleLines']);
    // Each category under Connection, where Party, Kreators Run and Circles sit on the Apps page, in that order after People and Club.
    const groups = listTables('owner', [], null);
    expect(groups.filter((g) => ['party', 'runs', 'circles'].includes(g.key)).map((g) => [g.key, g.name, g.appGroup])).toEqual([
      ['party', 'Party', 'community'],
      ['runs', 'Kreators Run', 'community'],
      ['circles', 'Circles', 'community'],
    ]);
    const order = groups.map((g) => g.key);
    expect(order.indexOf('club')).toBeLessThan(order.indexOf('party'));
    expect(order.indexOf('circles')).toBeLessThan(order.indexOf('rewards'));
  });

  it('says each kind, state and pace in the app’s own words', () => {
    expect(pairs(EVENT_TYPE_OPTIONS)).toEqual(EVENT_TYPES.map((k) => [k, EVENT_TYPE_META[k].name]));
    expect(pairs(RUN_PACE_OPTIONS)).toEqual(RUN_PACES.map((k) => [k, RUN_PACE_META[k].name]));
    expect(pairs(CIRCLE_SHOW_UP_OPTIONS)).toEqual(CIRCLE_STATUSES.map((k) => [k, CIRCLE_STATUS_META[k].name]));
    // An empty answer from before 0013 reads as not said, never a choice.
    expect(CIRCLE_SHOW_UP_OPTIONS.find((o) => o.isNull)?.label).toBe('Not said');
    expect(ATTENDEE_XP_MOST).toBe(ATTENDEE_XP_MAX);
    expect(CODE_OPENS_MINUTES).toBe(RUN_CODE_WINDOW.before);
    const party = read('../../../apps/web/src/screens/Party.tsx');
    expect(party).toContain("e.status === 'published' ? 'Live' : e.status === 'cancelled' ? 'Cancelled' : 'Done'");
    for (const [v, label] of pairs(tableColumn(dataTableByKey.partyHosted!, 'visibility')!.options!)) expect(party, v).toContain(`['${v}', '${label}']`);
    const run = read('../../../apps/web/src/screens/Run.tsx');
    for (const [v, label] of pairs(tableColumn(dataTableByKey.runClubsHosted!, 'visibility')!.options!)) expect(run, v).toContain(`{ key: '${v}', label: '${label}' }`);
    expect(run).toContain("a.status === 'declined' ? 'Not this time' : 'Applied'");
    expect(run).toContain("k.status === 'open' ? 'Open' : 'Closed'");
  });

  it('never reads a code, a room link, who took a line down, a host’s name on the person’s side, or anyone else at a circle’s table', () => {
    for (const k of BATCH) {
      const text = textOf(k);
      // No attendee code, start code or online room link, not even to ask whether there is one.
      expect(text, k).not.toMatch(/\.code\b|online_url|\bref\b/);
      // Who took a line down, set a photo folder or opened a circle is never read, only whether a line was taken down.
      for (const m of text.matchAll(/(removed_by|deleted_by)(.{0,12})/g)) expect(m[2], `${k} ${m[1]}`).toMatch(/^ IS (NOT )?NULL/);
      expect(text, k).not.toMatch(/set_by|\bcreated_by\b(?! = \?1)/);
      // A host's, a poster's or a runner's id is only ever the person, or joined for a name in a table with other people's details.
      for (const m of text.matchAll(/(host_user_id|created_by)(.{0,6})/g)) expect(m[2], `${k} ${m[1]}`).toMatch(/^ = \?1/);
      // Another person's name is read only in a table with other people's details (a count of live seats joins users for no name).
      if (audienceOf(dataTableByKey[k]!) === 'own') expect(text, k).not.toMatch(/\bu\.(display_name|handle)\b|JOIN users u /);
    }
    // At a circle, only the person's own seat: every read of circle_members is by the person.
    for (const k of ['circleSignups', 'circleLines']) {
      const t = textOf(k);
      for (const m of t.matchAll(/(\w+)\.user_id = (\S+)/g)) if (m[1] === 'm' || m[1] === 'cm') expect(m[2], k).toMatch(/^t\.user_id\)?$/);
    }
    // How the person said they will show up, their table and the name they go by there are theirs alone, never a coach's or an admin's.
    const signups = dataTableByKey.circleSignups!;
    expect(signups.columns.filter((col) => col.ownerOnly).map((col) => col.key)).toEqual(['showUp', 'table', 'alias']);
    for (const view of ['coach', 'admin'] as const) expect(visibleColumns(signups, view).map((col) => col.key), view).not.toEqual(expect.arrayContaining(['showUp']));
    // A photo folder opens the guests' photos: only its owner sees its link, anyone else whether there is one.
    for (const k of ['partyHosted', 'runsHosted']) {
      expect(tableColumn(dataTableByKey[k]!, 'photoFolder')?.ownerOnly, k).toBe(true);
      expect(tableColumn(dataTableByKey[k]!, 'photosShared')?.ownerOnly, k).toBeFalsy();
    }
    // A line taken down shows no words, and a coach never sees one written without a name.
    for (const k of ['partyLines', 'runLines']) {
      expect(tableColumn(dataTableByKey[k]!, 'line')!.sql, k).toMatch(/^CASE WHEN t\.(removed_by|deleted_at) IS NULL THEN t\.body END$/);
      expect(dataTableByKey[k]!.coachWhere, k).toBe('t.anonymous = 0');
      expect(tableSql(dataTableByKey[k]!, parseTableQuery(dataTableByKey[k]!, {}), { ...ctx, view: 'coach', viewerId: 'c9' }).sql, k).toContain('t.anonymous = 0');
      expect(tableSql(dataTableByKey[k]!, parseTableQuery(dataTableByKey[k]!, {}), ctx).sql, k).not.toContain('t.anonymous = 0');
    }
    expect(dataTableByKey.partyLines!.where).toBe("t.app = 'party'");
    // The host's guest list never holds a closed account, as an event's page shows it.
    expect(dataTableByKey.partyGuests!.where).toBe("u.display_name != 'Deleted member'");
  });

  it('hands a coach or an admin no event’s or club’s id: a private one’s id is its link (the review, 2026-11-14)', () => {
    // Party takes a seat at an event, and Kreators Run opens and joins a club, by its id alone, never asking how it was found. So the rows of
    // the events and clubs a person hosts or joined are keyed by their own number, and the id each route needs is a cell only the owner gets.
    for (const k of ['partyHosted', 'runClubsHosted', 'runClubsJoined']) expect(dataTableByKey[k]!.idSql, k).toBe('t.rowid');
    const keys: [string, string, string][] = [['partyHosted', 'eventId', 't.id'], ['partyJoined', 'eventId', 't.event_id'], ['runClubsHosted', 'clubId', 't.id']];
    for (const [k, cell, sql] of keys) {
      const col = tableColumn(dataTableByKey[k]!, cell)!;
      expect([col.sql, col.hidden, col.ownerOnly], k).toEqual([sql, true, true]);
      for (const col2 of dataTableByKey[k]!.columns.filter((x) => x.edit)) expect(col2.edit?.param, `${k}.${col2.key}`).toBe(cell);
      for (const view of ['coach', 'admin'] as const) {
        const t = dataTableByKey[k]!;
        expect(tableSql(t, parseTableQuery(t, {}, view), { ...ctx, view, viewerId: 'v9' }).sql, `${k} ${view}`).not.toContain(`AS "${cell}"`);
      }
    }
    // Every other column the batch's own tables send anyone but the owner is never a bare id of an event, a club or a circle.
    for (const k of OWN) {
      for (const view of ['coach', 'admin'] as const) {
        for (const col of visibleColumns(dataTableByKey[k]!, view)) expect(col.sql ?? '', `${k}.${col.key}`).not.toMatch(/^\w+\.(id|event_id|club_id|thing_id)$/);
        for (const col of dataTableByKey[k]!.columns.filter((x) => x.hidden && !x.ownerOnly)) expect(col.sql ?? '', `${k}.${col.key}`).not.toMatch(/^\w+\.(\w+_)?id$/);
      }
    }
  });

  it('changes only through Party’s and Kreators Run’s own routes, and only while the app would take it', () => {
    expect(editable('partyHosted')).toEqual(['guestXp']);
    expect(editable('partyJoined')).toEqual(['openToMeet']);
    expect(editable('runClubsHosted')).toEqual(['pace', 'visibility', 'meets', 'about']);
    expect(editable('runsHosted')).toEqual(['xp']);
    for (const k of BATCH.filter((x) => !['partyHosted', 'partyJoined', 'runClubsHosted', 'runsHosted'].includes(x))) {
      expect(editable(k), k).toEqual([]);
      expect(dataTableByKey[k]!.readOnlyWhy, k).toBeTruthy();
    }
    // A guest's xp and a runner's xp: one number from 1 to the most, only before the code opens and never on a cancelled one.
    const hosted = dataTableByKey.partyHosted!;
    const guestXp = tableColumn(hosted, 'guestXp')!;
    expect(rowEditable(hosted, guestXp, { xpOpen: true }, today)).toBe(true);
    expect(rowEditable(hosted, guestXp, { xpOpen: false }, today)).toBe(false);
    expect(editValue(guestXp, 25)).toEqual({ value: 25 });
    for (const bad of [0, ATTENDEE_XP_MOST + 1, 2.5, 'x']) expect('error' in editValue(guestXp, bad), String(bad)).toBe(true);
    // The event's id comes from the owner's own hidden cell, never the row's key (the row's own number).
    expect(plainCall(guestXp, '7', { eventId: 'e1' }, 25, today)).toEqual({ method: 'PUT', path: '/party/events/e1/attendee-code', body: { xp: 25 } });
    expect(plainCall(guestXp, 'e1', {}, 25, today)).toBeNull();
    const runs = dataTableByKey.runsHosted!;
    const runXp = tableColumn(runs, 'xp')!;
    expect(rowEditable(runs, runXp, { xpOpen: true }, today)).toBe(true);
    expect(rowEditable(runs, runXp, { xpOpen: false }, today)).toBe(false);
    expect(plainCall(runXp, 'r1', {}, 30, today)).toEqual({ method: 'POST', path: '/run/runs/r1/recode', body: { xp: 30 } });
    // Read by SQLite's own clock, in the stored instants' shape, thirty minutes ahead, and never for a cancelled one.
    for (const t of [hosted, runs]) expect(tableColumn(t, 'xpOpen')!.sql, t.key).toBe("(t.status != 'cancelled' AND t.starts_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+30 minutes'))");
    // The list to meet others: the guest's own switch on the event, only while they hold a seat, through the event's own route.
    const joined = dataTableByKey.partyJoined!;
    const meet = tableColumn(joined, 'openToMeet')!;
    for (const [status, ok] of [['registered', true], ['attended', true], ['waitlisted', false], ['cancelled', false]] as const) expect(rowEditable(joined, meet, { status }, today), status).toBe(ok);
    expect(plainCall(meet, 'reg1', { eventId: 'ev1' }, true, today)).toEqual({ method: 'PUT', path: '/connect/party/ev1/networking', body: { on: true } });
    // A run club's words, pace and who can find it, each alone: the route keeps every field it is not sent.
    const clubs = dataTableByKey.runClubsHosted!;
    expect(plainCall(tableColumn(clubs, 'about')!, '3', { clubId: 'k1' }, 'Easy loops', today)).toEqual({ method: 'PATCH', path: '/run/clubs/k1', body: { description: 'Easy loops' } });
    expect(plainCall(tableColumn(clubs, 'pace')!, '3', { clubId: 'k1' }, 'fast', today)).toEqual({ method: 'PATCH', path: '/run/clubs/k1', body: { pace: 'fast' } });
    for (const k of ['pace', 'visibility', 'meets', 'about']) expect(plainCall(tableColumn(clubs, k)!, 'k1', {}, 'x', today), k).toBeNull();
    expect('error' in editValue(tableColumn(clubs, 'visibility')!, 'club')).toBe(true);
    expect('error' in editValue(tableColumn(clubs, 'meets')!, 'x'.repeat(201))).toBe(true);
    // The routes as they are: a cancelled event's code is refused, an xp alone keeps a run's code, a club keeps what it is not sent, and the
    // list to meet others is set on both of Party's places.
    const partySrc = read('../../../apps/api/src/routes/party.ts');
    expect(partySrc).toContain("if (row.status === 'cancelled') return c.json({ error: 'This event was cancelled.' }, 400);");
    const runSrc = read('../../../apps/api/src/routes/run.ts');
    expect(runSrc).toContain("const asked = body.xp !== undefined || (typeof body.code === 'string' && body.code.trim() !== '');");
    expect(runSrc).toContain('str(body.description, 2000, row.description), str(body.meets, 200, row.meets), oneOf(body.pace, RUN_PACES, row.pace as RunClub[\'pace\'])');
    const connectSrc = read('../../../apps/api/src/routes/connect.ts');
    expect(connectSrc).toContain("if (g.ev.app === 'party') batch.push(db.prepare('UPDATE event_registrations SET networking_opt_in = ? WHERE event_id = ? AND user_id = ?')");
    const attendee = read('../../../apps/api/src/attendee.ts');
    expect(attendee).toContain("if (n !== xp && locked) return { error: 'The xp is fixed once the code opens");
    const route = read('../../../apps/api/src/routes/tables.ts');
    for (const when of ['xpOpen', 'seatHeld']) expect(route, when).toContain(`case '${when}':`);
  });

  it('reads each page in an order an index serves, the person first', async () => {
    const order = (k: string) => tableSql(dataTableByKey[k]!, parseTableQuery(dataTableByKey[k]!, {}), ctx).sql.split(' ORDER BY ')[1];
    expect(order('partyGuests')).toMatch(/^e\.starts_at DESC, e\.rowid DESC, t\.registered_at DESC, t\.rowid DESC, t\.id DESC LIMIT/);
    expect(order('runsHosted')).toMatch(/^k\.created_at DESC, k\.rowid DESC, t\.starts_at DESC, t\.rowid DESC, t\.id DESC LIMIT/);
    expect(order('runEntriesHosted')).toMatch(/^k\.created_at DESC, k\.rowid DESC, t\.logged_at DESC, t\.rowid DESC, t\.id DESC LIMIT/);
    expect(order('runCollabApplicants')).toMatch(/^cb\.created_at DESC, cb\.rowid DESC, t\.created_at DESC, t\.rowid DESC, t\.id DESC LIMIT/);
    expect(order('runLines')).toMatch(/^t\.seq DESC, t\.id DESC LIMIT/);
    // Each joined owner is an inner join: no row is read without the person on it.
    expect(dataTableByKey.partyGuests!.from).toMatch(/^event_registrations t JOIN events e ON/);
    for (const k of ['runsHosted', 'runEntriesHosted']) expect(dataTableByKey[k]!.from, k).toMatch(/^(runs|run_entries) t JOIN run_clubs k ON k\.id = t\.club_id/);
    expect(dataTableByKey.runCollabApplicants!.from).toMatch(/^run_collab_applications t JOIN run_collabs cb ON/);

    const migration = read('../../../apps/api/migrations/0158_events_table_indexes.sql');
    const { DatabaseSync } = await import('node:sqlite');
    const db = new DatabaseSync(':memory:');
    db.exec(`CREATE TABLE users (id TEXT PRIMARY KEY, display_name TEXT NOT NULL, handle TEXT);
      CREATE TABLE events (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', event_type TEXT NOT NULL DEFAULT 'meetup', host_user_id TEXT NOT NULL,
        venue TEXT NOT NULL DEFAULT '', online_url TEXT, timezone TEXT NOT NULL DEFAULT 'UTC', starts_at TEXT NOT NULL, ends_at TEXT NOT NULL, capacity INTEGER,
        price_points INTEGER NOT NULL DEFAULT 0, visibility TEXT NOT NULL DEFAULT 'public', status TEXT NOT NULL DEFAULT 'published', created_at TEXT NOT NULL, featured INTEGER NOT NULL DEFAULT 0);
      CREATE INDEX idx_events_starts ON events(starts_at);
      CREATE TABLE event_registrations (id TEXT PRIMARY KEY, event_id TEXT NOT NULL, user_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'registered', registered_at TEXT NOT NULL,
        checked_in_at TEXT, networking_opt_in INTEGER NOT NULL DEFAULT 0, paid_points INTEGER, UNIQUE (event_id, user_id));
      CREATE INDEX idx_event_reg_user ON event_registrations (user_id, status);
      CREATE TABLE event_feedback (id TEXT PRIMARY KEY, event_id TEXT NOT NULL, user_id TEXT NOT NULL, rating INTEGER NOT NULL, comment TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, UNIQUE (event_id, user_id));
      CREATE TABLE attendee_codes (app TEXT NOT NULL, thing_id TEXT NOT NULL, code TEXT NOT NULL, xp INTEGER NOT NULL, PRIMARY KEY (app, thing_id));
      CREATE TABLE attendee_claims (app TEXT NOT NULL, thing_id TEXT NOT NULL, user_id TEXT NOT NULL, xp INTEGER NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (app, thing_id, user_id));
      CREATE TABLE event_photos (app TEXT NOT NULL, event_id TEXT NOT NULL, url TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', set_by TEXT, updated_at TEXT NOT NULL, PRIMARY KEY (app, event_id));
      CREATE TABLE event_networking (app TEXT NOT NULL, event_id TEXT NOT NULL, user_id TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (app, event_id, user_id));
      CREATE TABLE event_messages (id TEXT PRIMARY KEY, app TEXT NOT NULL, event_id TEXT NOT NULL, user_id TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL, removed_by TEXT,
        anonymous INTEGER NOT NULL DEFAULT 0, parent_id TEXT, depth INTEGER NOT NULL DEFAULT 0);
      CREATE INDEX idx_event_messages_event ON event_messages(app, event_id, created_at);
      CREATE TABLE run_clubs (id TEXT PRIMARY KEY, name TEXT NOT NULL, city TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '', pace TEXT NOT NULL DEFAULT 'all',
        meets TEXT NOT NULL DEFAULT '', host_user_id TEXT NOT NULL, visibility TEXT NOT NULL DEFAULT 'public', status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL);
      CREATE INDEX idx_run_clubs_city ON run_clubs(status, visibility, city);
      CREATE TABLE run_members (club_id TEXT NOT NULL, user_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'member', joined_at TEXT NOT NULL, PRIMARY KEY (club_id, user_id));
      CREATE INDEX idx_run_members_user ON run_members(user_id, status);
      CREATE TABLE run_collabs (id TEXT PRIMARY KEY, title TEXT NOT NULL, brand_name TEXT NOT NULL DEFAULT '', organization_id TEXT, created_by TEXT NOT NULL, brief TEXT NOT NULL DEFAULT '',
        asks TEXT NOT NULL DEFAULT '', giveaway TEXT NOT NULL DEFAULT '', giveaway_count INTEGER NOT NULL DEFAULT 0, city TEXT NOT NULL DEFAULT '', starts_at TEXT NOT NULL, ends_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL);
      CREATE INDEX idx_run_collabs_open ON run_collabs(status, ends_at);
      CREATE TABLE run_collab_applications (id TEXT PRIMARY KEY, collab_id TEXT NOT NULL, club_id TEXT NOT NULL, user_id TEXT NOT NULL, note TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'applied', created_at TEXT NOT NULL, decided_at TEXT, UNIQUE (collab_id, club_id));
      CREATE TABLE runs (id TEXT PRIMARY KEY, club_id TEXT NOT NULL, title TEXT NOT NULL, meeting_point TEXT NOT NULL DEFAULT '', starts_at TEXT NOT NULL, ends_at TEXT NOT NULL,
        metres INTEGER NOT NULL DEFAULT 5000, code TEXT NOT NULL, collab_id TEXT, status TEXT NOT NULL DEFAULT 'published', created_at TEXT NOT NULL, xp INTEGER NOT NULL DEFAULT 20);
      CREATE INDEX idx_runs_club ON runs(club_id, starts_at);
      CREATE TABLE run_entries (id TEXT PRIMARY KEY, run_id TEXT NOT NULL, club_id TEXT NOT NULL, user_id TEXT NOT NULL, metres INTEGER NOT NULL DEFAULT 0, minutes INTEGER NOT NULL DEFAULT 0,
        xp INTEGER NOT NULL DEFAULT 0, points INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'logged', logged_at TEXT NOT NULL, UNIQUE (run_id, user_id));
      CREATE INDEX idx_run_entries_user ON run_entries(user_id, status, logged_at);
      CREATE TABLE run_messages (seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, run_id TEXT NOT NULL, user_id TEXT NOT NULL, body TEXT NOT NULL,
        anonymous INTEGER NOT NULL DEFAULT 0, reply_to TEXT, created_at TEXT NOT NULL, deleted_at TEXT, deleted_by TEXT);
      CREATE INDEX idx_run_messages_user ON run_messages (user_id);
      CREATE TABLE circle_events (id TEXT PRIMARY KEY, title TEXT NOT NULL, city TEXT NOT NULL, area TEXT NOT NULL DEFAULT '', starts_at TEXT NOT NULL, venue_hint TEXT NOT NULL DEFAULT '',
        group_size INTEGER NOT NULL DEFAULT 5, status TEXT NOT NULL DEFAULT 'open', created_by TEXT, created_at TEXT NOT NULL, repeat TEXT NOT NULL DEFAULT 'none', series_id TEXT);
      CREATE TABLE circle_signups (event_id TEXT NOT NULL, user_id TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT '', PRIMARY KEY (event_id, user_id));
      CREATE INDEX idx_circle_signups_user ON circle_signups (user_id, created_at);
      CREATE TABLE circle_groups (id TEXT PRIMARY KEY, event_id TEXT NOT NULL, name TEXT NOT NULL, venue TEXT NOT NULL DEFAULT '', plan TEXT NOT NULL DEFAULT '', chat_opens_at TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE circle_members (group_id TEXT NOT NULL, user_id TEXT NOT NULL, alias TEXT NOT NULL, character TEXT NOT NULL, revealed INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT '', PRIMARY KEY (group_id, user_id));
      CREATE INDEX idx_circle_members_user ON circle_members(user_id);
      CREATE TABLE circle_messages (id TEXT PRIMARY KEY, group_id TEXT NOT NULL, user_id TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE INDEX idx_circle_messages_group ON circle_messages(group_id, created_at);
      ${migration}`);
    const named = (sql: string, binds: readonly unknown[]) => ({ sql: sql.replace(/\?(\d+)/g, '@p$1'), args: Object.fromEntries(binds.map((v, i) => [`p${i + 1}`, v as string | number])) });
    const plan = (key: string) => {
      const t = dataTableByKey[key]!;
      const s = tableSql(t, parseTableQuery(t, {}), ctx);
      const n = named(`EXPLAIN QUERY PLAN ${s.sql}`, s.binds);
      return (db.prepare(n.sql).all(n.args) as { detail: string }[]).map((r) => r.detail).join(' | ');
    };
    const INDEX: Record<string, RegExp> = {
      partyHosted: /SEARCH t USING INDEX idx_events_host_starts/,
      partyGuests: /SEARCH e USING INDEX idx_events_host_starts.*SEARCH t USING INDEX idx_event_reg_event_registered/,
      partyJoined: /SEARCH t USING INDEX idx_event_reg_user_registered/,
      partyFeedback: /SEARCH t USING INDEX idx_event_feedback_user/,
      partyLines: /SEARCH t USING INDEX idx_event_messages_user/,
      runClubsHosted: /SEARCH t USING INDEX idx_run_clubs_host/,
      runClubsJoined: /SEARCH t USING INDEX idx_run_members_user_joined/,
      runsHosted: /SEARCH k USING INDEX idx_run_clubs_host.*SEARCH t USING INDEX idx_runs_club/,
      runEntries: /SEARCH t USING INDEX idx_run_entries_user_logged/,
      runEntriesHosted: /SEARCH k USING INDEX idx_run_clubs_host.*SEARCH t USING INDEX idx_run_entries_club_logged/,
      runLines: /SEARCH t USING (COVERING )?INDEX idx_run_messages_user/,
      runCollabsPosted: /SEARCH t USING INDEX idx_run_collabs_created_by/,
      runCollabApplicants: /SEARCH cb USING INDEX idx_run_collabs_created_by.*SEARCH t USING INDEX idx_run_collab_apps_collab/,
      runCollabApplications: /SEARCH t USING INDEX idx_run_collab_apps_user/,
      circleSignups: /SEARCH t USING INDEX idx_circle_signups_user/,
      circleLines: /SEARCH t USING INDEX idx_circle_messages_user/,
    };
    expect(Object.keys(INDEX).sort()).toEqual([...BATCH].sort());
    for (const [k, re] of Object.entries(INDEX)) {
      const p = plan(k);
      expect(p, `${k}: ${p}`).toMatch(re);
      // No page of the batch sorts its rows in a temporary tree but for the row key that breaks a tie (a walk ends on rowid, so needs none).
      expect(p, `${k}: ${p}`).not.toMatch(/USE TEMP B-TREE FOR ORDER BY/);
      if (dataTableByKey[k]!.columns.some((col) => col.sortTerms && col.key === dataTableByKey[k]!.defaultSort.key)) expect(p, `${k}: ${p}`).not.toMatch(/TEMP B-TREE/);
    }

    // The person's own seat at a circle: never anyone else at the table, and nothing before the tables are set.
    db.exec(`INSERT INTO users (id, display_name, handle) VALUES ('u1', 'Me', 'me'), ('u2', 'Other', 'other'), ('u3', 'Deleted member', NULL);
      INSERT INTO circle_events (id, title, city, starts_at, status, created_at) VALUES ('c1', 'Friday circle', 'Pune', '2026-11-20T12:00:00.000Z', 'matched', '2026-11-01T00:00:00Z'),
        ('c2', 'Next circle', 'Pune', '2026-11-27T12:00:00.000Z', 'open', '2026-11-02T00:00:00Z');
      INSERT INTO circle_signups (event_id, user_id, created_at, status) VALUES ('c1', 'u1', '2026-11-03T00:00:00Z', 'single'), ('c1', 'u2', '2026-11-03T01:00:00Z', 'committed'), ('c2', 'u1', '2026-11-04T00:00:00Z', '');
      INSERT INTO circle_groups (id, event_id, name, chat_opens_at, created_at) VALUES ('g1', 'c1', 'Table 1', '2026-11-19T12:00:00Z', '2026-11-18T00:00:00Z'), ('g2', 'c1', 'Table 2', '2026-11-19T12:00:00Z', '2026-11-18T00:00:00Z');
      INSERT INTO circle_members (group_id, user_id, alias, character) VALUES ('g2', 'u1', 'Brave Dew', 'self'), ('g2', 'u2', 'Calm Pip', 'friendship');
      INSERT INTO attendee_claims (app, thing_id, user_id, xp, created_at) VALUES ('circles', 'c1', 'u1', 15, '2026-11-20T12:10:00Z'), ('circles', 'c1', 'u2', 15, '2026-11-20T12:11:00Z');
      INSERT INTO events (id, title, host_user_id, starts_at, ends_at, created_at) VALUES ('e1', 'Mine', 'u1', '2026-11-20T10:00:00.000Z', '2026-11-20T12:00:00.000Z', '2026-11-01T00:00:00Z');
      INSERT INTO event_registrations (id, event_id, user_id, status, registered_at) VALUES ('r1', 'e1', 'u2', 'registered', '2026-11-02T00:00:00Z'), ('r2', 'e1', 'u3', 'registered', '2026-11-03T00:00:00Z');`);
    const rows = (key: string, view: 'owner' | 'coach' | 'admin' = 'owner') => {
      const t = dataTableByKey[key]!;
      const s = tableSql(t, parseTableQuery(t, {}, view), { ...ctx, view, viewerId: view === 'owner' ? 'u1' : 'v9' });
      const n = named(s.sql, s.binds);
      return db.prepare(n.sql).all(n.args) as Record<string, unknown>[];
    };
    const seats = rows('circleSignups');
    expect(seats.map((r) => [r._id, r.seated, r.table, r.alias, r.showUp, r.codeXp])).toEqual([
      ['c2', 0, null, null, null, null],
      ['c1', 1, 'Table 2', 'Brave Dew', 'single', 15],
    ]);
    expect(JSON.stringify(seats)).not.toMatch(/Calm Pip|committed|Other/);
    // Never shown to a coach or an admin at all ('others'); and were any other view to read it, it would still hold none of that.
    for (const view of ['coach', 'admin'] as const) {
      const theirs = rows('circleSignups', view);
      expect(theirs.map((r) => [r._id, r.seated]), view).toEqual([['c2', 0], ['c1', 1]]);
      expect(JSON.stringify(theirs), view).not.toMatch(/Brave Dew|Table 2|single/);
    }
    // The host's guests, never a closed account.
    expect(rows('partyGuests').map((r) => [r._id, r.guest])).toEqual([['r1', 'Other']]);

    // A private event the person hosts and one they joined, a club only its link finds that they host and a third person's one they joined:
    // the owner's rows carry each id in its own cell, a coach's and an admin's carry none of them, not even as a row's key.
    db.exec(`INSERT INTO events (id, title, host_user_id, starts_at, ends_at, created_at, visibility) VALUES ('ev-private-own', 'My quiet one', 'u1', '2026-11-21T10:00:00.000Z', '2026-11-21T12:00:00.000Z', '2026-11-01T00:00:00Z', 'private'),
        ('ev-private-theirs', 'Their quiet one', 'u2', '2026-11-22T10:00:00.000Z', '2026-11-22T12:00:00.000Z', '2026-11-01T00:00:00Z', 'private');
      INSERT INTO event_registrations (id, event_id, user_id, status, registered_at) VALUES ('r3', 'ev-private-theirs', 'u1', 'registered', '2026-11-04T00:00:00Z');
      INSERT INTO run_clubs (id, name, host_user_id, visibility, created_at) VALUES ('club-link-own', 'My loop', 'u1', 'private', '2026-11-01T00:00:00Z'), ('club-link-theirs', 'Their loop', 'u2', 'private', '2026-11-02T00:00:00Z');
      INSERT INTO run_members (club_id, user_id, joined_at) VALUES ('club-link-own', 'u1', '2026-11-01T00:00:00Z'), ('club-link-theirs', 'u1', '2026-11-03T00:00:00Z');`);
    const own = Object.fromEntries(['partyHosted', 'partyJoined', 'runClubsHosted', 'runClubsJoined'].map((k) => [k, rows(k)]));
    expect(own.partyHosted!.map((r) => r.eventId).sort()).toEqual(['e1', 'ev-private-own']);
    expect(own.partyJoined!.map((r) => r.eventId)).toEqual(['ev-private-theirs']);
    expect(own.runClubsHosted!.map((r) => r.clubId)).toEqual(['club-link-own']);
    expect(own.runClubsJoined!.map((r) => r.club)).toEqual(['Their loop', 'My loop']);
    for (const k of ['partyHosted', 'partyJoined', 'runClubsHosted', 'runClubsJoined']) {
      for (const r of own[k]!) expect(['ev-private-own', 'ev-private-theirs', 'club-link-own', 'club-link-theirs', 'e1'], k).not.toContain(r._id);
      for (const view of ['coach', 'admin'] as const) {
        const theirs = rows(k, view);
        expect(theirs.length, `${k} ${view}`).toBe(own[k]!.length);
        expect(JSON.stringify(theirs), `${k} ${view}`).not.toMatch(/ev-private|club-link|"e1"/);
      }
    }
    db.close();
  });
});
