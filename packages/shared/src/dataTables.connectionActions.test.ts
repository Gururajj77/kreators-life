import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  audienceOf,
  DATA_TABLES,
  dataTableByKey,
  editValue,
  noEditWhyOf,
  noRemoveWhyOf,
  parseTableQuery,
  plainCall,
  removeCallFor,
  removeCallOf,
  removeStateOf,
  rowFromRaw,
  ruleSelects,
  tableColumn,
  tableEditable,
  tableSql,
  type DataTable,
  type RemoveCall,
} from './dataTables';
import { MAX_REPLY_DEPTH } from './circles';

// All tables' Edit and Delete for the owner in the Connection apps (2026-11-14, the founder: "all tables need to be editable ... each entry for the
// original user and not for coach, and not even ai, edit and delete buttons should also be there in select and multi select and select all"):
// People, Community, Bond, Club, Party, Kreators Run and Circles. Each table changes and goes only through its app's own route, as the person; a
// record, another person's words or someone's seat stays, and says why. This file holds what is particular to these thirty-five; the framework's
// rules are in dataTables.actions.test.ts.

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const today = '2026-11-14';
const ctx = { view: 'owner' as const, ownerId: 'u1', viewerId: 'u1', today, zone: 'Asia/Kolkata' };
const GROUPS = ['people', 'community', 'bond', 'club', 'party', 'runs', 'circles'];
const CONNECTION = DATA_TABLES.filter((t) => GROUPS.includes(t.group));
const T = (k: string): DataTable => dataTableByKey[k]!;
const callsOf = (t: DataTable): RemoveCall[] =>
  t.remove ? [...(t.remove.call ? [t.remove.call] : []), ...(t.remove.outcomes ?? []).flatMap((o) => ('call' in o ? [o.call] : []))] : [];

describe('All tables: Edit and Delete in the Connection apps (2026-11-14)', () => {
  it('gives every one of the thirty-five a way to change and a way to go, or says why not, each in the app’s own asking', () => {
    expect(CONNECTION.length).toBe(35);
    // [verb, ask] for each remove; null where a row is never removed here (a record, another person's words or someone else's seat).
    const REMOVES: Record<string, [string, 'twice' | 'sheet'] | null> = {
      friends: ['Remove', 'sheet'],
      following: ['Unfollow', 'twice'],
      followers: ['Remove', 'sheet'],
      // A post nobody answered is a second tap, one with replies asks in the sheet (`sheetWhen`, the review of 2026-11-14).
      posts: ['Delete', 'twice'],
      replies: ['Delete', 'twice'],
      coachNotes: null,
      communityChannels: ['Leave', 'sheet'],
      communityLines: ['Take down', 'twice'],
      postReactions: ['Remove', 'twice'],
      replyReactions: ['Remove', 'twice'],
      followedPosts: ['Unfollow', 'twice'],
      mutes: ['Remove', 'sheet'],
      bondChats: null,
      bondChatLines: ['Delete', 'twice'],
      introductions: ['Remove', 'sheet'],
      bondChannels: ['Leave', 'sheet'],
      bondChannelLines: ['Take down', 'twice'],
      blocks: ['Unblock', 'sheet'],
      clubMembership: ['Withdraw', 'sheet'],
      partyHosted: ['Cancel', 'sheet'],
      partyGuests: null,
      partyJoined: ['Cancel', 'sheet'],
      partyFeedback: ['Delete', 'twice'],
      partyLines: ['Take down', 'twice'],
      runClubsHosted: ['Close', 'sheet'],
      runClubsJoined: ['Leave', 'sheet'],
      runsHosted: ['Cancel', 'sheet'],
      runEntries: null,
      runEntriesHosted: ['Void', 'sheet'],
      runLines: ['Take down', 'twice'],
      runCollabsPosted: ['Close', 'sheet'],
      runCollabApplicants: null,
      runCollabApplications: ['Withdraw', 'twice'],
      // Leaving asks in a sheet, as the Circles screen does (the review of 2026-11-14).
      circleSignups: ['Leave', 'sheet'],
      circleLines: ['Delete', 'twice'],
    };
    expect(Object.keys(REMOVES).sort()).toEqual(CONNECTION.map((t) => t.key).sort());
    for (const t of CONNECTION) {
      const want = REMOVES[t.key];
      if (want) expect([t.remove?.verb, t.remove?.ask], t.key).toEqual(want);
      else {
        expect(t.remove, t.key).toBeUndefined();
        expect(t.noRemoveWhy, t.key).toMatch(/^[A-Z].*\.$/);
      }
      // Every greyed button has its own words, and a table that changes never says it does not.
      if (tableEditable(t)) expect(noEditWhyOf(t), t.key).toBeNull();
      else expect(t.noEditWhy, t.key).toMatch(/^[A-Z].*\.$/);
      expect(noRemoveWhyOf(t) === null, t.key).toBe(Boolean(t.remove));
    }
  });

  it('never puts another person’s id in a cell: a route that needs one reads it on the server', () => {
    const PERSON = /\.(user_id|requester_id|recipient_id|requester_user_id|recipient_user_id|blocked_id|blocker_id|follower_id|owner_id|host_user_id|created_by|coach_id|muted_by)$/;
    for (const t of CONNECTION) {
      for (const col of t.columns.filter((x) => x.hidden)) expect(col.sql ?? '', `${t.key}.${col.key}`).not.toMatch(PERSON);
      // Every other part of a remove's path is the row's own hidden owner-only cell (an event's, a club's, a chat's, a line's own id) or a
      // private field the server reads and never sends (another person's id).
      for (const call of callsOf(t)) {
        for (const m of call.path.split('?')[0]!.matchAll(/:([A-Za-z]\w*)/g)) {
          if (m[1] === 'id') continue;
          const cell = tableColumn(t, m[1]!);
          if (cell) expect([cell.hidden, cell.ownerOnly], `${t.key} :${m[1]}`).toEqual([true, true]);
          else expect(t.privateSelect?.[m[1]!], `${t.key} :${m[1]}`).toBeTruthy();
        }
      }
    }
    // The people a route needs by id: the other side of a friendship, someone muted, someone blocked. Each a private field.
    expect(T('friends').privateSelect).toEqual({ otherId: 'CASE WHEN t.requester_id = ?1 THEN t.recipient_id ELSE t.requester_id END' });
    expect(T('mutes').privateSelect).toEqual({ mutedId: 't.user_id' });
    expect(T('blocks').privateSelect).toEqual({ blockedId: 't.blocked_id' });
  });

  it('builds each remove’s call to the app’s own route from the row alone', () => {
    const call = (k: string, rowId: string, cells: Record<string, string | number | boolean | null> = {}, fields: Record<string, unknown> = {}, at = -1) =>
      removeCallFor(removeCallOf(T(k).remove!, at)!, rowId, cells, fields, today);
    expect(call('friends', 'f1', {}, { otherId: 'u2' })).toEqual({ method: 'DELETE', path: '/bond/friends/u2' });
    // Following and followers are keyed by the other person (their pages are found by it), so the row's key is the path's id.
    expect(call('following', 'u2')).toEqual({ method: 'DELETE', path: '/community/follow/u2' });
    expect(call('followers', 'u3')).toEqual({ method: 'DELETE', path: '/community/followers/u3' });
    expect(call('posts', 'p1')).toEqual({ method: 'DELETE', path: '/community/p1' });
    expect(call('replies', 'r1', {}, {}, 0)).toEqual({ method: 'DELETE', path: '/community/replies/r1' });
    expect(call('communityChannels', '7', { channelId: 'c1' })).toEqual({ method: 'POST', path: '/community/channels/c1/leave' });
    expect(call('communityLines', 'l1', { channelId: 'c1' })).toEqual({ method: 'DELETE', path: '/community/channels/c1/messages/l1' });
    expect(call('postReactions', '9', { postId: 'p1' })).toEqual({ method: 'DELETE', path: '/community/p1/reaction' });
    expect(call('replyReactions', '9', { replyId: 'r1' })).toEqual({ method: 'DELETE', path: '/community/replies/r1/reaction' });
    expect(call('followedPosts', '9', { postId: 'p1' })).toEqual({ method: 'DELETE', path: '/community/p1/follow-post' });
    // Only the mute the person set: another guide may have muted them since.
    expect(call('mutes', '4', {}, { mutedId: 'u5' })).toEqual({ method: 'DELETE', path: '/community/members/u5/mute?mine=1' });
    expect(call('bondChatLines', '12', { lineId: 'm1', chatId: 'ch1' })).toEqual({ method: 'DELETE', path: '/bond/chats/ch1/messages/m1' });
    expect(call('introductions', '3', { introId: 'i1' }, {}, 0)).toEqual({ method: 'POST', path: '/bond/intros/i1', body: { status: 'declined' } });
    expect(call('introductions', '3', { introId: 'i1' }, {}, 1)).toEqual({ method: 'DELETE', path: '/bond/intros/i1' });
    expect(call('bondChannels', '5', { channelId: 'b1' }, {}, 0)).toEqual({ method: 'POST', path: '/bond/channels/b1/archive', body: { archived: true } });
    expect(call('bondChannels', '5', { channelId: 'b1' }, {}, 3)).toEqual({ method: 'POST', path: '/bond/channels/b1/leave' });
    expect(call('bondChannelLines', 'l2', { channelId: 'b1' })).toEqual({ method: 'DELETE', path: '/bond/channels/b1/messages/l2' });
    expect(call('blocks', '6', {}, { blockedId: 'u7' })).toEqual({ method: 'DELETE', path: '/bond/block/u7' });
    expect(call('clubMembership', 'm1')).toEqual({ method: 'DELETE', path: '/club/apply' });
    // An event's and a club's id is its link, so it comes from the owner's own hidden cell, never the row's key (the row's own number).
    expect(call('partyHosted', '8', { eventId: 'e1' })).toEqual({ method: 'PATCH', path: '/party/events/e1', body: { status: 'cancelled' } });
    expect(call('partyHosted', 'e1')).toBeNull();
    expect(call('partyJoined', 'r1', { eventId: 'e1' })).toEqual({ method: 'POST', path: '/party/events/e1/cancel-rsvp' });
    expect(call('partyFeedback', 'f1', { eventId: 'e1' })).toEqual({ method: 'DELETE', path: '/party/events/e1/feedback' });
    expect(call('partyLines', 'l3', { eventId: 'e1' })).toEqual({ method: 'DELETE', path: '/connect/party/e1/messages/l3' });
    expect(call('runClubsHosted', '2', { clubId: 'k1' })).toEqual({ method: 'PATCH', path: '/run/clubs/k1', body: { status: 'closed' } });
    expect(call('runClubsJoined', '2', { clubId: 'k1' }, {}, 1)).toEqual({ method: 'POST', path: '/run/clubs/k1/leave' });
    expect(call('runsHosted', 'r9')).toEqual({ method: 'PATCH', path: '/run/runs/r9', body: { status: 'cancelled' } });
    expect(call('runEntriesHosted', 'x1')).toEqual({ method: 'POST', path: '/run/entries/x1/void' });
    expect(call('runLines', 'l4', { runId: 'r9' })).toEqual({ method: 'DELETE', path: '/run/talk/r9/messages/l4' });
    expect(call('runCollabsPosted', 'cb1')).toEqual({ method: 'PATCH', path: '/run/collabs/cb1', body: { status: 'closed' } });
    expect(call('runCollabApplications', 'a1', { collabId: 'cb1' })).toEqual({ method: 'DELETE', path: '/run/collabs/cb1/applications/a1' });
    expect(call('circleSignups', 'ce1')).toEqual({ method: 'DELETE', path: '/circles/events/ce1/join' });
    expect(call('circleLines', 'cm1', { groupId: 'g1' })).toEqual({ method: 'DELETE', path: '/circles/groups/g1/messages/cm1' });
  });

  it('works out each row’s remove by the app’s own rules: what stays, and why', () => {
    const state = (k: string, cells: Record<string, string | number | boolean | null>, fields: Record<string, unknown> = {}) => removeStateOf(T(k), cells, fields);
    // A Club application goes only while it waits for a reviewer.
    expect(state('clubMembership', { status: 'applied' })).toEqual({ did: 'withdrawn', at: -1 });
    expect(state('clubMembership', { status: 'approved' })).toEqual({ why: 'Only an application still waiting can be withdrawn. A reviewer’s decision stays.' });
    // A line already taken down stays down; one not yet goes.
    for (const k of ['communityLines', 'bondChannelLines', 'partyLines', 'runLines']) {
      expect(state(k, { takenDown: false }), k).toEqual({ did: 'taken down', at: -1 });
      expect(state(k, { takenDown: true }), k).toEqual({ why: 'It is already taken down.' });
    }
    // Only your own lines in a chat: the other side's stay.
    expect(state('bondChatLines', { from: 'You' })).toEqual({ did: 'deleted', at: -1 });
    expect(state('bondChatLines', { from: 'Brave Pip' })).toEqual({ why: 'Only your own lines can be deleted. The other side’s words stay.' });
    // A club you host is closed under Clubs you host, never left; one you already left stays.
    expect(state('runClubsJoined', { youHost: true, status: 'member' })).toEqual({ why: 'You host it. Close it under Clubs you host instead.' });
    expect(state('runClubsJoined', { youHost: false, status: 'member' })).toEqual({ did: 'left', at: 1 });
    expect(state('runClubsJoined', { youHost: false, status: 'left' })).toEqual({ why: 'You already left it.' });
    // Closing a club, a collab; voiding an entry; leaving a circle; withdrawing an application to a collab: each only once, in its state.
    expect(state('runClubsHosted', { state: 'closed' })).toEqual({ why: 'It is already closed.' });
    expect(state('runCollabsPosted', { state: 'open' })).toEqual({ did: 'closed', at: -1 });
    expect(state('runEntriesHosted', { status: 'void' })).toEqual({ why: 'It is already voided.' });
    expect(state('circleSignups', { state: 'matched' })).toEqual({ why: 'Its tables are set, so your place stays.' });
    expect(state('circleSignups', { state: 'open' })).toEqual({ did: 'left', at: -1 });
    expect(state('runCollabApplications', { status: 'accepted' })).toEqual({ why: 'It was already answered, so it stays.' });
    // A rule worked out by SQL reads the read's own result, never one nobody checked.
    expect(state('partyHosted', {}, {})).toEqual({ why: 'Only an event that has not ended, and is not cancelled already, can be called off.' });
    expect(state('partyHosted', {}, { _q0: 1 })).toEqual({ did: 'cancelled', at: -1 });
    expect(state('replies', {}, { _q0: 0 })).toEqual({ why: 'Someone answered it, so it stays with their words.' });
    expect(ruleSelects(T('introductions'))).toEqual(["t.status = 'proposed' AND t.recipient_user_id = ?1", "t.status = 'proposed'"]);
  });

  it('changes a cell only through the app’s own route, the event’s and club’s ids from the owner’s own cell', () => {
    const edit = (k: string, col: string, rowId: string, cells: Record<string, string | number | boolean | null>, value: unknown) => plainCall(tableColumn(T(k), col)!, rowId, cells, value, today);
    // Saying yes to a friend request: only "Friends" is offered, sent as Bond's own "accepted".
    const state = tableColumn(T('friends'), 'state')!;
    expect(editValue(state, 'friends')).toEqual({ value: 'accepted' });
    expect('error' in editValue(state, 'sent')).toBe(true);
    expect(edit('friends', 'state', 'f1', {}, 'accepted')).toEqual({ method: 'POST', path: '/bond/friends/f1', body: { status: 'accepted' } });
    expect(edit('posts', 'body', 'p1', {}, 'New words')).toEqual({ method: 'PATCH', path: '/community/p1', body: { body: 'New words' } });
    expect('error' in editValue(tableColumn(T('posts'), 'body')!, '')).toBe(true);
    expect(edit('postReactions', 'reaction', '9', { postId: 'p1' }, 'love')).toEqual({ method: 'PUT', path: '/community/p1/reaction', body: { kind: 'love' } });
    expect(edit('replyReactions', 'reaction', '9', { replyId: 'r1' }, 'love')).toEqual({ method: 'PUT', path: '/community/replies/r1/reaction', body: { kind: 'love' } });
    expect(edit('bondChannels', 'seat', '5', { channelId: 'b1' }, 'member')).toEqual({ method: 'POST', path: '/bond/channels/b1/join', body: { status: 'member' } });
    expect('error' in editValue(tableColumn(T('bondChannels'), 'seat')!, 'invited')).toBe(true);
    expect(edit('clubMembership', 'note', 'm1', {}, 'More about me')).toEqual({ method: 'PATCH', path: '/club/apply', body: { note: 'More about me' } });
    // An event's words and Mark done; never Live again from here, nor a cancel (that is the remove).
    expect(edit('partyHosted', 'title', '8', { eventId: 'e1' }, 'Picnic')).toEqual({ method: 'PATCH', path: '/party/events/e1', body: { title: 'Picnic' } });
    expect(edit('partyHosted', 'venue', '8', { eventId: 'e1' }, 'The park')).toEqual({ method: 'PATCH', path: '/party/events/e1', body: { venue: 'The park' } });
    expect(edit('partyHosted', 'about', '8', { eventId: 'e1' }, 'Bring a mat')).toEqual({ method: 'PATCH', path: '/party/events/e1', body: { description: 'Bring a mat' } });
    expect(edit('partyHosted', 'title', 'e1', {}, 'Picnic')).toBeNull();
    for (const bad of ['published', 'cancelled']) expect('error' in editValue(tableColumn(T('partyHosted'), 'state')!, bad), bad).toBe(true);
    expect(editValue(tableColumn(T('partyHosted'), 'state')!, 'done')).toEqual({ value: 'done' });
    expect(edit('partyFeedback', 'score', 'f1', { eventId: 'e1' }, 4)).toEqual({ method: 'POST', path: '/party/events/e1/feedback', body: { rating: 4 } });
    expect('error' in editValue(tableColumn(T('partyFeedback'), 'score')!, 6)).toBe(true);
    // A club's name and city, never emptied; opening it again, never closing it here (that is the remove).
    expect(edit('runClubsHosted', 'club', '2', { clubId: 'k1' }, 'Dawn loop')).toEqual({ method: 'PATCH', path: '/run/clubs/k1', body: { name: 'Dawn loop' } });
    expect('error' in editValue(tableColumn(T('runClubsHosted'), 'city')!, '')).toBe(true);
    expect('error' in editValue(tableColumn(T('runClubsHosted'), 'state')!, 'closed')).toBe(true);
    expect(edit('runClubsJoined', 'status', '2', { clubId: 'k1' }, 'member')).toEqual({ method: 'POST', path: '/run/clubs/k1/join', body: { status: 'member' } });
    expect(edit('runsHosted', 'meetingPoint', 'r9', {}, 'Gate 2')).toEqual({ method: 'PATCH', path: '/run/runs/r9', body: { meetingPoint: 'Gate 2' } });
    for (const bad of ['published', 'cancelled']) expect('error' in editValue(tableColumn(T('runsHosted'), 'state')!, bad), bad).toBe(true);
    expect(edit('runCollabsPosted', 'giveaway', 'cb1', {}, 'Socks')).toEqual({ method: 'PATCH', path: '/run/collabs/cb1', body: { giveaway: 'Socks' } });
    expect(edit('runCollabApplicants', 'status', 'a1', { collabId: 'cb1' }, 'accepted')).toEqual({ method: 'POST', path: '/run/collabs/cb1/applications/a1', body: { status: 'accepted' } });
    expect('error' in editValue(tableColumn(T('runCollabApplicants'), 'status')!, 'applied')).toBe(true);
    expect(edit('runCollabApplications', 'note', 'a1', { collabId: 'cb1' }, 'We run Sundays')).toEqual({ method: 'PATCH', path: '/run/collabs/cb1/applications/a1', body: { note: 'We run Sundays' } });
    // How the person shows up at a circle stays theirs alone: never edited here (an owner-only column).
    expect(tableColumn(T('circleSignups'), 'showUp')!.edit).toBeUndefined();
  });

  it('reads every page and every remove’s rows on the real schema, its rules in the same statement, and none of it for anyone else', async () => {
    const { DatabaseSync } = await import('node:sqlite');
    const db = new DatabaseSync(':memory:');
    const MIGRATIONS = new URL('../../../apps/api/migrations/', import.meta.url);
    for (const f of readdirSync(MIGRATIONS).filter((x) => x.endsWith('.sql')).sort()) db.exec(readFileSync(new URL(f, MIGRATIONS), 'utf8'));
    const named = (sql: string, binds: readonly unknown[]) => ({ sql: sql.replace(/\?(\d+)/g, '@p$1'), args: Object.fromEntries(binds.map((v, i) => [`p${i + 1}`, v as string | number])) });
    const rowsOf = (t: DataTable, extra: Partial<Parameters<typeof tableSql>[2]> = {}) => {
      const s = tableSql(t, { ...parseTableQuery(t, {}), count: false }, { ...ctx, rules: true, ...extra });
      const n = named(s.sql, s.binds);
      return db.prepare(n.sql).all(n.args) as Record<string, unknown>[];
    };
    // Each table's page and its remove's read by ids compile on the migrations as they are (a rule naming a column that is not there fails here).
    for (const t of CONNECTION) {
      expect(() => rowsOf(t), t.key).not.toThrow();
      expect(() => rowsOf(t, { ids: ['a', 'b'] }), t.key).not.toThrow();
      // A coach's and an admin's read never carries a rule or an owner-only cell (an event's, a club's, a chat's or a line's own id).
      for (const view of ['coach', 'admin'] as const) {
        const s = tableSql(t, parseTableQuery(t, {}, view), { ...ctx, view, viewerId: 'v9', rules: true });
        expect(s.sql, `${t.key} ${view}`).not.toContain('"_q0"');
        for (const col of t.columns.filter((x) => x.ownerOnly)) expect(s.sql, `${t.key} ${view}`).not.toContain(`AS "${col.key}"`);
      }
    }
    db.exec(`INSERT INTO users (id, display_name, created_at) VALUES ('u1', 'Me', '2026-01-01'), ('u2', 'Asha', '2026-01-01'), ('u3', 'Ravi', '2026-01-01');
      INSERT INTO community_posts (id, user_id, category, body, created_at) VALUES ('p1', 'u1', 'Stories', 'Mine', '2026-11-01'), ('p2', 'u2', 'Stories', 'Theirs', '2026-11-02');
      INSERT INTO community_replies (id, post_id, user_id, body, created_at, parent_id, depth) VALUES ('r1', 'p2', 'u1', 'Answered', '2026-11-03', NULL, 0),
        ('r2', 'p2', 'u2', 'An answer to r1', '2026-11-04', 'r1', 1), ('r3', 'p2', 'u1', 'Not answered', '2026-11-05', NULL, 0),
        ('rd3', 'p2', 'u2', 'Third level', '2026-11-06', 'r2', 3), ('r4', 'p2', 'u1', 'At the bottom, answered', '2026-11-07', 'rd3', 4),
        ('r5', 'p2', 'u2', 'An answer to r4, stored beside it', '2026-11-08', 'rd3', 4), ('r6', 'p2', 'u1', 'At the bottom, after the answer', '2026-11-09', 'rd3', 4);
      INSERT INTO events (id, title, host_user_id, starts_at, ends_at, created_at, status) VALUES
        ('e-past', 'Over', 'u1', '2020-01-01T10:00:00.000Z', '2020-01-01T12:00:00.000Z', '2019-12-01', 'published'),
        ('e-soon', 'Soon', 'u1', '2099-01-01T10:00:00.000Z', '2099-01-01T12:00:00.000Z', '2026-11-01', 'published'),
        ('e-off', 'Off', 'u1', '2099-02-01T10:00:00.000Z', '2099-02-01T12:00:00.000Z', '2026-11-01', 'cancelled'),
        ('e-theirs', 'Theirs', 'u2', '2099-03-01T10:00:00.000Z', '2099-03-01T12:00:00.000Z', '2026-11-01', 'published'),
        ('e-theirs-past', 'Theirs over', 'u2', '2020-03-01T10:00:00.000Z', '2020-03-01T12:00:00.000Z', '2020-02-01', 'published');
      INSERT INTO event_registrations (id, event_id, user_id, status, registered_at) VALUES ('g1', 'e-theirs', 'u1', 'registered', '2026-11-01'),
        ('g2', 'e-theirs-past', 'u1', 'registered', '2020-02-02'), ('g3', 'e-theirs', 'u3', 'waitlisted', '2026-11-01');
      INSERT INTO run_clubs (id, name, host_user_id, created_at) VALUES ('k1', 'Loop', 'u1', '2026-01-01');
      INSERT INTO runs (id, club_id, title, starts_at, ends_at, code, created_at, status) VALUES ('run-logged', 'k1', 'Logged', '2026-11-01T06:00:00.000Z', '2026-11-01T07:00:00.000Z', 'ABCD', '2026-10-01', 'done'),
        ('run-empty', 'k1', 'Empty', '2099-01-01T06:00:00.000Z', '2099-01-01T07:00:00.000Z', 'EFGH', '2026-10-01', 'published');
      INSERT INTO run_entries (id, run_id, club_id, user_id, logged_at, status) VALUES ('x1', 'run-logged', 'k1', 'u2', '2026-11-01T06:30:00.000Z', 'logged');
      INSERT INTO introductions (id, requester_user_id, recipient_user_id, created_at, status) VALUES ('i-in', 'u2', 'u1', '2026-11-01', 'proposed'),
        ('i-out', 'u1', 'u3', '2026-11-02', 'proposed'), ('i-done', 'u1', 'u2', '2026-11-03', 'accepted');
      INSERT INTO channels (id, scope, slug, name, created_by, created_at, archived_at) VALUES ('b-mine', 'bond', 'mine', 'Mine', 'u1', '2026-11-01', NULL),
        ('b-closed', 'bond', 'closed', 'Closed', 'u1', '2026-11-01', '2026-11-05'), ('b-asked', 'bond', 'asked', 'Asked', 'u2', '2026-11-01', NULL), ('b-in', 'bond', 'in', 'In', 'u2', '2026-11-01', NULL);
      INSERT INTO channel_members (channel_id, user_id, role, status, last_read_at, joined_at) VALUES ('b-mine', 'u1', 'mod', 'member', '2026-11-01', '2026-11-01'),
        ('b-closed', 'u1', 'mod', 'member', '2026-11-01', '2026-11-02'), ('b-asked', 'u1', 'member', 'invited', '2026-11-01', '2026-11-03'), ('b-in', 'u1', 'member', 'member', '2026-11-01', '2026-11-04');`);
    const outcome = (k: string) =>
      Object.fromEntries(
        rowsOf(T(k)).map((raw) => {
          const { row, fields } = rowFromRaw(T(k), raw, 'owner');
          const s = removeStateOf(T(k), row.cells, fields)!;
          return [String(row.cells.eventId ?? row.cells.introId ?? row.cells.channelId ?? row.cells.run ?? row.id), 'why' in s ? s.why : s.did];
        }),
      );
    // A reply someone answered stays; one nobody answered goes. An answer to a reply at the deepest level is stored beside it (the review of
    // 2026-11-14: r4 could be deleted though r5 answered it), so there a later reply beside it counts as an answer; r6, with none after it, goes.
    expect(outcome('replies')).toEqual({ r1: 'Someone answered it, so it stays with their words.', r3: 'deleted', r4: 'Someone answered it, so it stays with their words.', r6: 'deleted' });
    // An event is called off only before it ends, and never twice.
    expect(outcome('partyHosted')).toEqual({ 'e-past': 'Only an event that has not ended, and is not cancelled already, can be called off.', 'e-soon': 'cancelled', 'e-off': 'Only an event that has not ended, and is not cancelled already, can be called off.' });
    // A seat is cancelled only at an event still to come: a ticket is never refunded after the event.
    expect(outcome('partyJoined')).toEqual({ 'e-theirs': 'cancelled', 'e-theirs-past': 'Only a place at an event still to come can be cancelled.' });
    // A run someone logged with its code stays; an empty one is cancelled.
    expect(outcome('runsHosted')).toEqual({ Logged: 'A run already cancelled, or one someone logged with its code, stays as it is. Void an entry instead.', Empty: 'cancelled' });
    // An introduction asked of you is turned down, one you asked is taken back, an answered one stays.
    expect(outcome('introductions')).toEqual({ 'i-in': 'turned down', 'i-out': 'taken back', 'i-done': 'An introduction already answered stays as it is.' });
    // A room you made closes (once); one you were asked into is turned down; another you are in, you leave.
    expect(outcome('bondChannels')).toEqual({ 'b-mine': 'closed', 'b-closed': 'You made it, and it is closed already.', 'b-asked': 'turned down', 'b-in': 'left' });
    // Another person's rows, asked for by id, are never read: they come back "not in your list".
    expect(rowsOf(T('replies'), { ids: ['r1', 'r2', 'r3'] }).map((r) => r._id).sort()).toEqual(['r1', 'r3']);
    db.close();
  });

  it('keeps every new route the owner’s own, guarded, limited and gated, and gives none of them to the assistant', () => {
    const route = (f: string) => read(`../../../apps/api/src/routes/${f}.ts`);
    const community = route('community');
    for (const r of ["community.put('/:id/reaction'", "community.delete('/:id/reaction'", "community.put('/replies/:id/reaction'", "community.delete('/replies/:id/reaction'", "community.delete('/:id/follow-post'", "community.delete('/replies/:id'", "community.patch('/:id'", "community.delete('/follow/:userId'", "community.delete('/followers/:userId'"])
      expect(community, r).toContain(r);
    // Taking a reaction or a follow back leaves the same state however often it is sent: never the toggle.
    expect(community).toContain("DELETE FROM community_likes WHERE post_id = ? AND user_id = ?').bind(c.req.param('id'), c.get('user').id)");
    expect(community).toContain('ON CONFLICT (post_id, user_id) DO NOTHING');
    // A post's words change in one guarded statement, never once someone answered or reacted; a reply goes only while unanswered.
    expect(community).toContain('NOT EXISTS (SELECT 1 FROM community_replies r WHERE r.post_id = ?1) AND NOT EXISTS (SELECT 1 FROM community_likes l WHERE l.post_id = ?1)');
    expect(community).toContain('DELETE FROM community_replies WHERE id = ?1 AND user_id = ?2 AND NOT EXISTS (SELECT 1 FROM community_replies x WHERE x.parent_id = ?1)');
    // The route and the table read an answer at the deepest level the same way: a later reply beside it. The table's 4 is that depth.
    expect(community).toContain('AND NOT (depth >= ?3 AND EXISTS (SELECT 1 FROM community_replies x WHERE x.parent_id = community_replies.parent_id AND x.id != ?1 AND x.depth >= ?3 AND x.created_at >= community_replies.created_at))');
    expect(community).toContain('.bind(id, user.id, MAX_REPLY_DEPTH)');
    expect(ruleSelects(T('replies'))[0]).toContain(`t.depth >= ${MAX_REPLY_DEPTH} AND EXISTS (SELECT 1 FROM community_replies x WHERE x.parent_id = t.parent_id AND x.id != t.id AND x.depth >= ${MAX_REPLY_DEPTH} AND x.created_at >= t.created_at)`);
    expect(community).toContain("if (mine && row.muted_by !== me.id) return c.json({ error: 'Another guide has muted them since, so their mute stays.' }, 409);");
    const bond = route('bond');
    expect(bond).toContain("UPDATE introductions SET status = ?, consent_at = ? WHERE id = ? AND status = 'proposed'");
    expect(bond).toContain("DELETE FROM introductions WHERE id = ? AND requester_user_id = ? AND status = 'proposed'");
    expect(bond).toContain("UPDATE friendships SET status = ?, answered_at = ? WHERE id = ? AND status = 'pending'");
    expect(bond).toContain('DELETE FROM bond_messages WHERE id = ? AND chat_id = ? AND user_id = ?');
    const club = route('club');
    expect(club).toContain("UPDATE memberships SET note = ? WHERE user_id = ? AND status = 'applied'");
    expect(club).toContain("DELETE FROM memberships WHERE user_id = ? AND status = 'applied'");
    const party = route('party');
    // The gap a table would have shown: a seat cancelled after the event refunded its ticket.
    expect(party).toContain("if (Date.parse(row.ends_at) <= Date.now()) return c.json({ error: 'This event is over, so your seat stays as it was.' }, 400);");
    // A cancelled event never comes back, and a PATCH with only words leaves its state alone.
    expect(party).toContain("AND (status != 'cancelled' OR ? = 'cancelled')");
    expect(party).toContain("if (body.status === undefined && !words) return c.json({ error: 'Say what to change.' }, 400);");
    expect(party).toContain('ON CONFLICT (event_id, user_id) DO UPDATE SET rating = excluded.rating, comment = excluded.comment');
    expect(party).toContain("party.delete('/events/:id/feedback'");
    const run = route('run');
    // A collab's answer is given once (the gap the plan named), and an application changes or goes only while it waits.
    expect(run).toContain("UPDATE run_collab_applications SET status = ?, decided_at = ? WHERE id = ? AND status = 'applied'");
    expect(run).toContain("UPDATE run_collab_applications SET note = ? WHERE id = ? AND collab_id = ? AND user_id = ? AND status = 'applied'");
    expect(run).toContain("DELETE FROM run_collab_applications WHERE id = ? AND collab_id = ? AND user_id = ? AND status = 'applied'");
    expect(run).toContain('UPDATE runs SET status = ?, title = ?, meeting_point = ? WHERE id = ? AND status = ?');
    expect(run).toContain('AND NOT EXISTS (SELECT 1 FROM run_collab_applications a WHERE a.collab_id = ?)');
    expect(route('circles')).toContain('DELETE FROM circle_messages WHERE id = ? AND group_id = ? AND user_id = ?');
    expect(route('connect')).toContain("UPDATE event_messages SET removed_by = ? WHERE id = ? AND removed_by IS NULL");
    // Every new door has its limit, under its app's prefix (so its module gate holds).
    const limits = read('../../../apps/api/src/limits.ts');
    const NEW: [string, string][] = [
      ['PATCH', '/community/:id'], ['DELETE', '/community/replies/:id'], ['PUT', '/community/:id/reaction'], ['DELETE', '/community/:id/reaction'],
      ['PUT', '/community/replies/:id/reaction'], ['DELETE', '/community/replies/:id/reaction'], ['DELETE', '/community/:id/follow-post'],
      ['DELETE', '/community/follow/:userId'], ['DELETE', '/community/followers/:userId'], ['DELETE', '/bond/intros/:id'], ['DELETE', '/bond/chats/:id/messages/:mid'],
      ['PATCH', '/club/apply'], ['DELETE', '/club/apply'], ['DELETE', '/party/events/:id/feedback'], ['PATCH', '/run/collabs/:id/applications/:appId'],
      ['DELETE', '/run/collabs/:id/applications/:appId'], ['DELETE', '/circles/groups/:id/messages/:mid'],
    ];
    for (const [method, path] of NEW) expect(limits, `${method} ${path}`).toContain(`{ method: '${method}', path: '${path}', limit: '`);
    const access = read('../../../apps/api/src/access.ts');
    for (const app of ['community', 'bond', 'club', 'party', 'run', 'circles', 'connect']) expect(access, app).toMatch(new RegExp(`^  ${app}: \\[`, 'm'));
    // AI chat reads tables and never changes them: no assistant tool reaches any of these doors.
    const tools = read('../../../apps/api/src/assistant/tools.ts');
    for (const p of ['/follow-post', '/followers/', '/reaction', '/community/replies/', '/bond/intros/', '/bond/chats/', '/club/apply', '/feedback', '/applications/', '/circles/groups/', '/bond/block', '/bond/friends']) expect(tools, p).not.toContain(p);
    // Only the owner: the tables of other people's details stay out of every coach's and admin's view, the people a remove reaches with them.
    for (const k of ['friends', 'following', 'followers', 'mutes', 'blocks', 'introductions', 'bondChatLines', 'circleLines', 'circleSignups']) expect(audienceOf(T(k)), k).toBe('others');
  });
});
