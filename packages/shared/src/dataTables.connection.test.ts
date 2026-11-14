import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  audienceOf,
  blockHides,
  CHANNEL_NAME_LEAST,
  CHANNEL_NAME_MOST,
  CHANNEL_SEAT_OPTIONS,
  CHANNEL_TOPIC_MOST,
  coachTableKeys,
  COHORT_TALK_SHOW_OPTIONS,
  COHORT_TALK_SHOWN_DEFAULT,
  DATA_TABLES,
  dataTableByKey,
  DELIVERY_MODE_OPTIONS,
  editValue,
  INTRO_STATE_OPTIONS,
  listTables,
  parseTableQuery,
  plainCall,
  postSeen,
  PROGRAM_ABOUT_MOST,
  PROGRAM_NAME_MOST,
  PROGRAM_STATE_OPTIONS,
  programStateSql,
  REACTION_OPTIONS,
  rowEditable,
  tableAllowed,
  tableColumn,
  tableReach,
  tableSql,
  visibleColumns,
  type ColumnOption,
} from './dataTables';
import { COHORT_TALK_DEFAULT_VISIBILITY, COHORT_TALK_VISIBILITIES, MAX_CHANNEL_NAME, MAX_CHANNEL_TOPIC, MIN_CHANNEL_NAME, PROGRAM_VISIBILITIES, PROGRAM_VISIBILITY_META, REACTION_META, REACTIONS } from './index';

// All tables' sixth batch (2026-11-14, the founder: "ok, add them"): School and Connection. Its own file, beside dataTables.test.ts, which holds the
// rules every table meets (the schema, the owner's index, secrets, routes and words); this one holds what is particular to these seventeen.

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const today = '2026-11-14';
const editable = (k: string) => dataTableByKey[k]!.columns.filter((col) => col.edit).map((col) => col.key);
const pairs = (o: readonly ColumnOption[]) => o.filter((x) => !x.isNull).map((x) => [x.value, x.label]);
const ctx = { view: 'owner' as const, ownerId: 'u1', viewerId: 'u1', today, zone: 'Asia/Kolkata' };

/** Every SQL string a table holds. */
const textOf = (k: string) => {
  const t = dataTableByKey[k]!;
  return [t.from, t.owner, t.where ?? '', t.coachWhere ?? '', t.othersWhere ?? '', t.idSql, ...t.columns.flatMap((col) => [col.sql ?? '', col.sortSql ?? '', col.searchSql ?? '', col.filterSql ?? '', ...(col.sortTerms ?? [])]), ...Object.values(t.privateSelect ?? {})].join(' ');
};

describe('All tables: School and Connection (2026-11-14)', () => {
  // The person's own records, with nobody else's details or words in them: the old rules.
  const OWN = ['cohortLines', 'programsMade', 'cohortsRun', 'communityChannels', 'communityLines'];
  // Another person's name or words: who was invited and by whom, another person's post or reply, a member muted, the other side of a chat under
  // an alias, an introduction, a friend's private room, someone blocked.
  const OTHERS = ['programInvites', 'programInvitesSent', 'postReactions', 'replyReactions', 'followedPosts', 'mutes', 'bondChats', 'bondChatLines', 'introductions', 'bondChannels', 'bondChannelLines', 'blocks'];
  const BATCH = [...OWN, ...OTHERS];
  const SCHOOL = ['programInvites', 'cohortLines', 'programsMade', 'cohortsRun', 'programInvitesSent'];
  const COMMUNITY = ['communityChannels', 'communityLines', 'postReactions', 'replyReactions', 'followedPosts', 'mutes'];
  const BOND = ['bondChats', 'bondChatLines', 'introductions', 'bondChannels', 'bondChannelLines', 'blocks'];

  it('holds every table, each with its audience and the app its records belong to, in its category', () => {
    for (const k of BATCH) expect(dataTableByKey[k], k).toBeTruthy();
    expect(DATA_TABLES.filter((t) => ['teaching', 'community', 'bond'].includes(t.group)).map((t) => t.key).sort()).toEqual([...BATCH].filter((k) => !['programInvites', 'cohortLines'].includes(k)).sort());
    expect(dataTableByKey.programInvites!.group).toBe('learning');
    expect(dataTableByKey.cohortLines!.group).toBe('learning');
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
    for (const k of SCHOOL) expect(dataTableByKey[k]!.needs, k).toEqual(['school']);
    for (const k of COMMUNITY) expect(dataTableByKey[k]!.needs, k).toEqual(['community']);
    for (const k of BOND) expect(dataTableByKey[k]!.needs, k).toEqual(['bond']);
    // Each lists only while its app is on: Bond hidden takes Bond's away and leaves Community's.
    const keysFor = (on: string[]) => listTables('owner', [], on).flatMap((g) => g.tables.map((t) => t.key));
    for (const k of BATCH) expect(keysFor([]), k).not.toContain(k);
    expect(keysFor(['school']).filter((k) => BATCH.includes(k))).toEqual(SCHOOL);
    expect(keysFor(['community']).filter((k) => BATCH.includes(k))).toEqual(COMMUNITY);
    expect(keysFor(['bond']).filter((k) => BATCH.includes(k))).toEqual(BOND);
    // Teaching under Contribution right after Learning, where School sits; Community and Bond under Connection right after People.
    const groups = listTables('owner', [], null);
    const order = groups.map((g) => g.key);
    expect(groups.filter((g) => ['teaching', 'community', 'bond'].includes(g.key)).map((g) => [g.key, g.name, g.appGroup])).toEqual([
      ['teaching', 'Teaching', 'earn'],
      ['community', 'Community', 'community'],
      ['bond', 'Bond', 'community'],
    ]);
    expect(order.indexOf('teaching')).toBe(order.indexOf('learning') + 1);
    expect(order.indexOf('community')).toBe(order.indexOf('people') + 1);
    expect(order.indexOf('bond')).toBe(order.indexOf('community') + 1);
    // An admin's list holds the person's own School and Community records, never one with other people's details.
    const adminKeys = listTables('admin', [], null).flatMap((g) => g.tables.map((t) => t.key));
    for (const k of OWN) expect(adminKeys, k).toContain(k);
    for (const k of OTHERS) expect(adminKeys, k).not.toContain(k);
  });

  it('says each state, way of running, reaction and limit in the app’s own words', () => {
    expect(pairs(PROGRAM_STATE_OPTIONS)).toEqual(PROGRAM_VISIBILITIES.map((k) => [k, PROGRAM_VISIBILITY_META[k].name]));
    expect(read('../../../apps/web/src/screens/School.tsx')).toContain(`({ ${pairs(DELIVERY_MODE_OPTIONS).map(([k, v]) => `${k}: '${v}'`).join(', ')} })`);
    expect(pairs(REACTION_OPTIONS)).toEqual(REACTIONS.map((k) => [k, REACTION_META[k].name]));
    expect(pairs(COHORT_TALK_SHOW_OPTIONS).map(([k]) => k).sort()).toEqual([...COHORT_TALK_VISIBILITIES].sort());
    const talkScreen = read('../../../apps/web/src/components/CohortDiscussion.tsx');
    for (const [v, label] of pairs(COHORT_TALK_SHOW_OPTIONS)) expect(talkScreen, v).toContain(`{ value: '${v}', label: '${label}' }`);
    expect(COHORT_TALK_SHOWN_DEFAULT).toBe(COHORT_TALK_DEFAULT_VISIBILITY);
    expect([CHANNEL_NAME_LEAST, CHANNEL_NAME_MOST, CHANNEL_TOPIC_MOST]).toEqual([MIN_CHANNEL_NAME, MAX_CHANNEL_NAME, MAX_CHANNEL_TOPIC]);
    expect(pairs(CHANNEL_SEAT_OPTIONS).map(([k]) => k)).toEqual(['member', 'invited']);
    // A program's state is read the one way School reads it, and its name and words are held to the route's own lengths.
    const school = read('../../../apps/api/src/routes/school.ts');
    expect(school).toContain(`export const VIS = \`${programStateSql('p')}\`;`);
    expect(school).toContain(`str(body.name, ${PROGRAM_NAME_MOST}, prev.name)`);
    expect(school).toContain(`str(body.description, ${PROGRAM_ABOUT_MOST}, prev.description)`);
    // An introduction's states are the route's own.
    const bond = read('../../../apps/api/src/routes/bond.ts');
    expect(pairs(INTRO_STATE_OPTIONS).map(([k]) => k)).toEqual(['proposed', 'accepted', 'declined']);
    expect(bond).toContain("oneOf(body.status, ['accepted', 'declined'] as const, 'declined')");
    // Who a block hides is hiddenByBlock in db.ts, word for word, and which posts the person may still see is the feed's and canSeePost's rule.
    expect(read('../../../apps/api/src/db.ts')).toContain(`\`${blockHides('${viewer}', '${writer}', '${anon}')}\``);
    const community = read('../../../apps/api/src/routes/community.ts');
    const seen = postSeen('p');
    expect(community).toContain(seen.slice(seen.indexOf('(p.product_id IS NULL')));
    expect(community).toContain("clauses.push('p.hidden_at IS NULL')");
    expect(community).toContain("clauses.push('(p.held_at IS NULL OR p.user_id = ?1)')");
    expect(community).toContain("hiddenByBlock('?1', 'p.user_id', 'p.anonymous')");
  });

  it('never reads an id behind an alias, a block behind a made-up name, who took a line down, a line answered or a code', () => {
    for (const k of BATCH) {
      const text = textOf(k);
      // Who took a line down, and the line one answers (another person's words), are never read: only whether there is one.
      expect(text, k).not.toMatch(/deleted_by|removed_by|reply_to_id|thread_id/);
      for (const m of text.matchAll(/\b(reply_to|parent_id)\b(.{0,12})/g)) expect(m[2], `${k} ${m[1]}`).toMatch(/^ IS (NOT )?NULL/);
      // No code, link key or token of any kind.
      expect(text, k).not.toMatch(/invite_codes|\.code\b|token|online_url|friend_code/);
      // Another person's name is read only in a table with other people's details.
      if (audienceOf(dataTableByKey[k]!) === 'own') expect(text, k).not.toMatch(/\b(u|ib|a|b)\.(display_name|handle)\b|JOIN users /);
    }
    // An anonymous chat's two sides are only ever compared with the person, never read: aliases only, as Bond shows a chat.
    for (const k of ['bondChats', 'bondChatLines']) {
      const text = textOf(k);
      for (const m of text.matchAll(/\b(a_user_id|b_user_id|user_id)\b(.{0,6})/g)) expect(m[2], `${k} ${m[1]}`).toMatch(/^ = \?1/);
      expect(text, k).not.toMatch(/JOIN users/);
    }
    // A block behind a made-up name is never listed: only a block by name, and block_aliases is never read.
    const blocks = dataTableByKey.blocks!;
    expect(blocks.where).toBe('t.by_name = 1');
    expect(textOf('blocks')).not.toContain('block_aliases');
    // A post or reply written under a made-up name never says who, whoever reads the table.
    for (const [k, col] of [['postReactions', 'writer'], ['replyReactions', 'writer'], ['followedPosts', 'writer']] as const) {
      expect(tableColumn(dataTableByKey[k]!, col)!.sql, k).toMatch(/^CASE WHEN \w+\.user_id = \?1 THEN 'You' WHEN \w+\.anonymous = 1 THEN 'Under a made-up name' ELSE /);
    }
    // A line taken down shows no words; a coach never sees a line written without a name, nor a cohort's line written behind a masked name.
    for (const k of ['cohortLines', 'communityLines', 'bondChannelLines']) expect(tableColumn(dataTableByKey[k]!, 'line')!.sql, k).toBe('CASE WHEN t.deleted_at IS NULL THEN t.body END');
    expect(dataTableByKey.communityLines!.coachWhere).toBe('t.anonymous = 0');
    expect(dataTableByKey.cohortLines!.coachWhere).toBe("v.visibility = 'public'");
    for (const k of ['communityLines', 'cohortLines']) {
      const t = dataTableByKey[k]!;
      expect(tableSql(t, parseTableQuery(t, {}, 'coach'), { ...ctx, view: 'coach', viewerId: 'c9' }).sql, k).toContain(t.coachWhere!);
      expect(tableSql(t, parseTableQuery(t, {}), ctx).sql, k).not.toContain(t.coachWhere!);
      expect(tableSql(t, parseTableQuery(t, {}, 'admin'), { ...ctx, view: 'admin', viewerId: 'a9' }).sql, k).not.toContain(t.coachWhere!);
    }
    // A program's and a channel's own id stays the owner's: each row is keyed by its own number, and the id an edit needs is a hidden owner-only
    // cell, never selected for a coach or an admin.
    for (const [k, cell] of [['programsMade', 'programId'], ['communityChannels', 'channelId']] as const) {
      const t = dataTableByKey[k]!;
      expect(t.idSql, k).toBe('t.rowid');
      const col = tableColumn(t, cell)!;
      expect([col.hidden, col.ownerOnly], k).toEqual([true, true]);
      for (const view of ['coach', 'admin'] as const) expect(tableSql(t, parseTableQuery(t, {}, view), { ...ctx, view, viewerId: 'v9' }).sql, `${k} ${view}`).not.toContain(`AS "${cell}"`);
    }
    for (const k of OWN) {
      for (const view of ['coach', 'admin'] as const) for (const col of visibleColumns(dataTableByKey[k]!, view)) expect(col.sql ?? '', `${k}.${col.key}`).not.toMatch(/^\w+\.(\w+_)?id$/);
    }
  });

  it('changes only through School’s and the channels’ own routes: a program’s name and words, and a channel its maker opened', () => {
    expect(editable('programsMade')).toEqual(['name', 'about']);
    expect(editable('communityChannels')).toEqual(['channel', 'topic']);
    expect(editable('bondChannels')).toEqual(['channel', 'topic']);
    for (const k of BATCH.filter((x) => !['programsMade', 'communityChannels', 'bondChannels'].includes(x))) {
      expect(editable(k), k).toEqual([]);
      expect(dataTableByKey[k]!.readOnlyWhy, k).toBeTruthy();
    }
    // A program's state is changed in School, which asks first before it takes a program from anyone; its price is set when it is made.
    expect(tableColumn(dataTableByKey.programsMade!, 'state')!.edit).toBeUndefined();
    const name = tableColumn(dataTableByKey.programsMade!, 'name')!;
    const about = tableColumn(dataTableByKey.programsMade!, 'about')!;
    // The program's id comes from the owner's own hidden cell, never the row's key (the row's own number).
    expect(plainCall(name, '16', { programId: 'p1' }, 'Better name', today)).toEqual({ method: 'PATCH', path: '/school/programs/p1', body: { name: 'Better name' } });
    expect(plainCall(name, 'p1', {}, 'Better name', today)).toBeNull();
    expect(plainCall(about, '16', { programId: 'p1' }, 'New words', today)).toEqual({ method: 'PATCH', path: '/school/programs/p1', body: { description: 'New words' } });
    expect('error' in editValue(name, '')).toBe(true);
    expect('error' in editValue(name, 'x'.repeat(PROGRAM_NAME_MOST + 1))).toBe(true);
    expect(editValue(about, '')).toEqual({ value: '' });
    // A channel's name and topic: only one its maker opened (in Community, the route takes it only from a guide), through the channel's own route.
    for (const [k, base] of [['communityChannels', '/community/channels'], ['bondChannels', '/bond/channels']] as const) {
      const t = dataTableByKey[k]!;
      const channel = tableColumn(t, 'channel')!;
      const topic = tableColumn(t, 'topic')!;
      expect(rowEditable(t, channel, { madeIt: true }, today), k).toBe(true);
      expect(rowEditable(t, channel, { madeIt: false }, today), k).toBe(false);
      expect(rowEditable(t, topic, { madeIt: false }, today), k).toBe(false);
      expect(plainCall(channel, '7', { channelId: 'c1' }, 'Book club', today), k).toEqual({ method: 'PATCH', path: `${base}/c1`, body: { name: 'Book club' } });
      expect(plainCall(topic, '7', { channelId: 'c1' }, '', today), k).toEqual({ method: 'PATCH', path: `${base}/c1`, body: { topic: '' } });
      expect('error' in editValue(channel, 'x'), k).toBe(true);
      expect('error' in editValue(channel, 'x'.repeat(CHANNEL_NAME_MOST + 1)), k).toBe(true);
      expect(editValue(topic, ''), k).toEqual({ value: '' });
    }
    // The routes as they are: a name alone keeps the words and the topic, and a channel changes only for whoever manages it.
    const school = read('../../../apps/api/src/routes/school.ts');
    expect(school).toContain("if (!a.edit) return c.json({ error: 'the people who run this program edit it' }, 403);");
    const channels = read('../../../apps/api/src/routes/channels.ts');
    expect(channels).toContain('const topic = body.topic === undefined ? row.topic : str(body.topic, MAX_CHANNEL_TOPIC);');
    expect(channels).toContain("const manages = (r: Pick<ChRow, 'scope' | 'created_by'>, u: UserRow) => (r.scope === 'community' ? isGuide(u) : r.created_by === u.id);");
    expect(read('../../../apps/api/src/routes/tables.ts')).toContain("case 'madeIt':");
  });

  it('reads each page in an order an index serves, and only what the app would show the person', async () => {
    const migration = read('../../../apps/api/migrations/0159_school_connection_table_indexes.sql');
    // Each index it drops starts on the same column as the one it adds in its place.
    for (const [dropped, kept] of [['idx_program_invites_user', 'idx_program_invites_user_created ON program_invites (user_id,'], ['idx_cohort_talk_user', 'idx_cohort_talk_user_created ON cohort_talk (user_id,'], ['community_post_follows_user', 'idx_post_follows_user_created ON community_post_follows (user_id,']]) {
      expect(migration, dropped).toContain(`DROP INDEX IF EXISTS ${dropped};`);
      expect(migration, dropped).toContain(kept);
    }
    const { DatabaseSync } = await import('node:sqlite');
    const db = new DatabaseSync(':memory:');
    db.exec(`CREATE TABLE users (id TEXT PRIMARY KEY, display_name TEXT NOT NULL, handle TEXT);
      CREATE TABLE products (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL);
      CREATE TABLE orders (id TEXT PRIMARY KEY, buyer_id TEXT, product_id TEXT, status TEXT NOT NULL);
      CREATE TABLE programs (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', price_points INTEGER NOT NULL DEFAULT 0, price_cents INTEGER NOT NULL DEFAULT 0,
        currency TEXT NOT NULL DEFAULT 'INR', delivery_mode TEXT NOT NULL DEFAULT 'online', published INTEGER NOT NULL DEFAULT 0, outcomes TEXT NOT NULL DEFAULT '',
        prerequisites TEXT NOT NULL DEFAULT '', created_by TEXT, created_at TEXT NOT NULL, featured INTEGER NOT NULL DEFAULT 0, visibility TEXT NOT NULL DEFAULT 'draft', sort_position INTEGER);
      CREATE TABLE cohorts (id TEXT PRIMARY KEY, program_id TEXT NOT NULL, name TEXT NOT NULL, start_at TEXT NOT NULL, end_at TEXT NOT NULL, capacity INTEGER NOT NULL DEFAULT 50,
        status TEXT NOT NULL DEFAULT 'upcoming', manager_user_id TEXT, created_at TEXT NOT NULL);
      CREATE TABLE enrollments (id TEXT PRIMARY KEY, cohort_id TEXT NOT NULL, learner_user_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'enrolled', payment_status TEXT NOT NULL DEFAULT 'free',
        enrolled_at TEXT NOT NULL, completed_at TEXT, UNIQUE (cohort_id, learner_user_id));
      CREATE TABLE program_invites (program_id TEXT NOT NULL, user_id TEXT NOT NULL, invited_by TEXT, created_at TEXT NOT NULL, PRIMARY KEY (program_id, user_id));
      CREATE INDEX idx_program_invites_user ON program_invites (user_id);
      CREATE TABLE cohort_talk (id TEXT PRIMARY KEY, cohort_id TEXT NOT NULL, user_id TEXT NOT NULL, thread_id TEXT NOT NULL, parent_id TEXT, reply_to_id TEXT, depth INTEGER NOT NULL DEFAULT 0,
        body TEXT NOT NULL, created_at TEXT NOT NULL, deleted_at TEXT, deleted_by TEXT);
      CREATE INDEX idx_cohort_talk_user ON cohort_talk (user_id);
      CREATE TABLE cohort_talk_prefs (cohort_id TEXT NOT NULL, user_id TEXT NOT NULL, visibility TEXT NOT NULL DEFAULT 'private', updated_at TEXT NOT NULL, PRIMARY KEY (cohort_id, user_id));
      CREATE TABLE channels (id TEXT PRIMARY KEY, scope TEXT NOT NULL, slug TEXT NOT NULL, name TEXT NOT NULL, topic TEXT NOT NULL DEFAULT '', kind TEXT NOT NULL DEFAULT 'public',
        created_by TEXT NOT NULL, archived_at TEXT, created_at TEXT NOT NULL);
      CREATE TABLE channel_members (channel_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member', status TEXT NOT NULL DEFAULT 'member', last_read_at TEXT NOT NULL,
        joined_at TEXT NOT NULL, PRIMARY KEY (channel_id, user_id));
      CREATE INDEX idx_channel_members_user ON channel_members (user_id, status);
      CREATE TABLE channel_messages (seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, channel_id TEXT NOT NULL, user_id TEXT NOT NULL, body TEXT NOT NULL,
        anonymous INTEGER NOT NULL DEFAULT 0, reply_to TEXT, created_at TEXT NOT NULL, deleted_at TEXT, deleted_by TEXT);
      CREATE INDEX idx_channel_messages_channel ON channel_messages (channel_id, seq);
      CREATE INDEX idx_channel_messages_user ON channel_messages (user_id);
      CREATE TABLE community_posts (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, category TEXT NOT NULL, body TEXT NOT NULL, product_id TEXT, hidden_at TEXT, hidden_by TEXT,
        created_at TEXT NOT NULL, pinned_at TEXT, pinned_by TEXT, held_at TEXT, anonymous INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE community_replies (id TEXT PRIMARY KEY, post_id TEXT NOT NULL, user_id TEXT NOT NULL, body TEXT NOT NULL, hidden_at TEXT, created_at TEXT NOT NULL,
        anonymous INTEGER NOT NULL DEFAULT 0, parent_id TEXT, depth INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE community_likes (post_id TEXT NOT NULL, user_id TEXT NOT NULL, created_at TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'like', PRIMARY KEY (post_id, user_id));
      CREATE TABLE community_reply_reactions (reply_id TEXT NOT NULL, user_id TEXT NOT NULL, kind TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (reply_id, user_id));
      CREATE TABLE community_post_follows (post_id TEXT NOT NULL, user_id TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (post_id, user_id));
      CREATE INDEX community_post_follows_user ON community_post_follows (user_id);
      CREATE TABLE community_mutes (user_id TEXT PRIMARY KEY, muted_by TEXT NOT NULL, muter_rank TEXT NOT NULL, reason TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL);
      CREATE TABLE blocks (blocker_id TEXT NOT NULL, blocked_id TEXT NOT NULL, reason TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, by_name INTEGER NOT NULL DEFAULT 1,
        PRIMARY KEY (blocker_id, blocked_id));
      CREATE TABLE block_aliases (id TEXT PRIMARY KEY, blocker_id TEXT NOT NULL, blocked_id TEXT NOT NULL, alias TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE (blocker_id, blocked_id, alias));
      CREATE TABLE introductions (id TEXT PRIMARY KEY, requester_user_id TEXT NOT NULL, recipient_user_id TEXT NOT NULL, context TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'proposed',
        consent_at TEXT, created_at TEXT NOT NULL);
      CREATE TABLE bond_chats (id TEXT PRIMARY KEY, a_user_id TEXT NOT NULL, b_user_id TEXT NOT NULL, a_alias TEXT NOT NULL, b_alias TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'bond',
        created_at TEXT NOT NULL, last_message_at TEXT, UNIQUE (a_user_id, b_user_id));
      CREATE INDEX idx_bond_chats_a ON bond_chats(a_user_id, last_message_at);
      CREATE INDEX idx_bond_chats_b ON bond_chats(b_user_id, last_message_at);
      CREATE TABLE bond_messages (id TEXT PRIMARY KEY, chat_id TEXT NOT NULL, user_id TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE INDEX idx_bond_messages_chat ON bond_messages(chat_id, created_at);
      ${migration}`);
    const named = (sql: string, binds: readonly unknown[]) => ({ sql: sql.replace(/\?(\d+)/g, '@p$1'), args: Object.fromEntries(binds.map((v, i) => [`p${i + 1}`, v as string | number])) });
    const plan = (key: string) => {
      const t = dataTableByKey[key]!;
      const s = tableSql(t, parseTableQuery(t, {}), ctx);
      const n = named(`EXPLAIN QUERY PLAN ${s.sql}`, s.binds);
      return (db.prepare(n.sql).all(n.args) as { detail: string }[]).map((r) => r.detail).join(' | ');
    };
    const INDEX: Record<string, RegExp> = {
      programsMade: /SEARCH t USING INDEX idx_programs_created_by .*SEARCH k USING INDEX idx_cohorts_program/,
      cohortsRun: /SEARCH t USING INDEX idx_cohorts_manager/,
      programInvitesSent: /SEARCH p USING INDEX idx_programs_created_by.*SEARCH t USING INDEX idx_program_invites_program_created/,
      programInvites: /SEARCH t USING INDEX idx_program_invites_user_created/,
      cohortLines: /SEARCH t USING INDEX idx_cohort_talk_user_created/,
      communityChannels: /SEARCH t USING INDEX idx_channel_members_user_joined/,
      bondChannels: /SEARCH t USING INDEX idx_channel_members_user_joined/,
      communityLines: /SEARCH t USING (COVERING )?INDEX idx_channel_messages_user/,
      bondChannelLines: /SEARCH t USING (COVERING )?INDEX idx_channel_messages_user/,
      postReactions: /SEARCH t USING INDEX idx_community_likes_user/,
      replyReactions: /SEARCH t USING INDEX idx_reply_reactions_user/,
      followedPosts: /SEARCH t USING INDEX idx_post_follows_user_created/,
      mutes: /SEARCH t USING INDEX idx_community_mutes_by/,
      blocks: /SEARCH t USING INDEX idx_blocks_blocker_created/,
      bondChats: /SEARCH t USING INDEX idx_bond_chats_a.*SEARCH t USING INDEX idx_bond_chats_b/,
      // The lines are the outer loop, walked chat by chat through their index; the person's chats come from either side's index.
      bondChatLines: /^SEARCH t USING INDEX idx_bond_messages_chat \(chat_id=\?\).*SEARCH ch USING INDEX idx_bond_chats_a.*SEARCH ch USING INDEX idx_bond_chats_b/,
      introductions: /SEARCH t USING INDEX idx_introductions_requester.*SEARCH t USING INDEX idx_introductions_recipient/,
    };
    expect(Object.keys(INDEX).sort()).toEqual([...BATCH].sort());
    // Either side of a chat or an introduction is the person, so the two sides' rows meet and are sorted: a person has few of them. A chat's
    // lines grow without end, so they are not among them: their page is read in index order and stops at its last row.
    const EITHER_SIDE = ['bondChats', 'introductions'];
    for (const [k, re] of Object.entries(INDEX)) {
      const p = plan(k);
      expect(p, `${k}: ${p}`).toMatch(re);
      if (!EITHER_SIDE.includes(k)) expect(p, `${k}: ${p}`).not.toMatch(/TEMP B-TREE/);
    }

    db.exec(`INSERT INTO users (id, display_name, handle) VALUES ('u1', 'Me', 'me'), ('u2', 'Other', 'other'), ('u3', 'Quiet writer', 'quiet'), ('u4', 'Blocked me', 'blocker'),
        ('u5', 'Named block', 'named'), ('u6', 'Masked block', 'masked'), ('u7', 'Deleted member', NULL);
      INSERT INTO blocks (blocker_id, blocked_id, created_at, by_name) VALUES ('u4', 'u1', '2026-11-01T00:00:00Z', 1), ('u1', 'u5', '2026-11-02T00:00:00Z', 1), ('u1', 'u6', '2026-11-03T00:00:00Z', 0);
      INSERT INTO block_aliases (id, blocker_id, blocked_id, alias, created_at) VALUES ('ba1', 'u1', 'u6', 'Calm Otter 12', '2026-11-03T00:00:00Z');
      INSERT INTO community_posts (id, user_id, category, body, created_at, anonymous, hidden_at) VALUES
        ('p1', 'u2', 'Stories', 'Named post', '2026-11-04T00:00:00Z', 0, NULL), ('p2', 'u3', 'Stories', 'Quiet post', '2026-11-04T01:00:00Z', 1, NULL),
        ('p3', 'u4', 'Stories', 'Post of one who blocked me', '2026-11-04T02:00:00Z', 0, NULL), ('p4', 'u2', 'Stories', 'Hidden post', '2026-11-04T03:00:00Z', 0, '2026-11-05T00:00:00Z'),
        ('p5', 'u5', 'Stories', 'Post of one I blocked', '2026-11-04T04:00:00Z', 0, NULL), ('p6', 'u6', 'Stories', 'Masked post', '2026-11-04T05:00:00Z', 1, NULL),
        ('p7', 'u6', 'Stories', 'Named post of the masked', '2026-11-04T06:00:00Z', 0, NULL), ('p8', 'u1', 'Stories', 'My own quiet post', '2026-11-04T07:00:00Z', 1, NULL);
      INSERT INTO community_likes (post_id, user_id, created_at, kind) SELECT id, 'u1', created_at, 'celebrate' FROM community_posts;
      INSERT INTO community_post_follows (post_id, user_id, created_at) SELECT id, 'u1', created_at FROM community_posts;
      INSERT INTO community_mutes (user_id, muted_by, muter_rank, reason, created_at) VALUES ('u2', 'u1', 'guide', 'Spam', '2026-11-06T00:00:00Z'), ('u3', 'u9', 'staff', 'Not mine', '2026-11-06T00:00:00Z');
      INSERT INTO bond_chats (id, a_user_id, b_user_id, a_alias, b_alias, created_at, last_message_at) VALUES ('ch1', 'u1', 'u2', 'Brave Dew', 'Calm Pip', '2026-11-07T00:00:00Z', '2026-11-07T00:02:00Z');
      INSERT INTO bond_messages (id, chat_id, user_id, body, created_at) VALUES ('m1', 'ch1', 'u1', 'Hello', '2026-11-07T00:01:00Z'), ('m2', 'ch1', 'u2', 'Hi back', '2026-11-07T00:02:00Z');
      INSERT INTO programs (id, name, created_by, created_at, visibility) VALUES ('pr1', 'My program', 'u1', '2026-11-08T00:00:00Z', 'private'), ('pr2', 'Their program', 'u2', '2026-11-08T00:00:00Z', 'private'),
        ('pr3', 'Their draft', 'u2', '2026-11-08T00:00:00Z', 'draft');
      INSERT INTO program_invites (program_id, user_id, invited_by, created_at) VALUES ('pr1', 'u2', 'u1', '2026-11-08T01:00:00Z'), ('pr1', 'u7', 'u1', '2026-11-08T02:00:00Z'),
        ('pr2', 'u1', 'u2', '2026-11-08T03:00:00Z'), ('pr3', 'u1', 'u2', '2026-11-08T04:00:00Z');
      INSERT INTO cohorts (id, program_id, name, start_at, end_at, manager_user_id, created_at) VALUES ('k1', 'pr2', 'Shown cohort', '2026-11-01T00:00:00Z', '2026-12-01T00:00:00Z', 'u2', '2026-11-01T00:00:00Z'),
        ('k2', 'pr2', 'Masked cohort', '2026-11-01T00:00:00Z', '2099-12-31T00:00:00Z', 'u1', '2026-11-01T00:00:00Z');
      INSERT INTO cohort_talk_prefs (cohort_id, user_id, visibility, updated_at) VALUES ('k1', 'u1', 'public', '2026-11-09T00:00:00Z');
      INSERT INTO cohort_talk (id, cohort_id, user_id, thread_id, body, created_at) VALUES ('t1', 'k1', 'u1', 't1', 'Shown line', '2026-11-09T01:00:00Z'), ('t2', 'k2', 'u1', 't2', 'Masked line', '2026-11-09T02:00:00Z');`);
    const rows = (key: string, view: 'owner' | 'coach' | 'admin' = 'owner') => {
      const t = dataTableByKey[key]!;
      const s = tableSql(t, parseTableQuery(t, {}, view), { ...ctx, view, viewerId: view === 'owner' ? 'u1' : 'v9' });
      const n = named(s.sql, s.binds);
      return db.prepare(n.sql).all(n.args) as Record<string, unknown>[];
    };
    // Reactions and follows: only the posts the feed still shows the person, a post under a made-up name never naming who, the person's own as You.
    for (const k of ['postReactions', 'followedPosts']) {
      const got = rows(k);
      expect(got.map((r) => [String(r.post), r.writer]).sort((a, b) => a[0]!.localeCompare(b[0]!)), k).toEqual([
        ['My own quiet post', 'You'],
        ['Named post', 'Other'],
        ['Named post of the masked', 'Masked block'],
        ['Quiet post', 'Under a made-up name'],
      ]);
      expect(JSON.stringify(got), k).not.toMatch(/Quiet writer|Hidden post|Blocked me|Named block|Masked post/);
    }
    // Only a block by name, by name; one behind a made-up name, and its made-up name, never.
    expect(rows('blocks').map((r) => r.person)).toEqual(['Named block']);
    expect(JSON.stringify(rows('blocks'))).not.toMatch(/Masked|Calm Otter/);
    // Only the mutes the person made.
    expect(rows('mutes').map((r) => [r.person, r.reason])).toEqual([['Other', 'Spam']]);
    // A chat both ways by alias, never an id.
    const lines = rows('bondChatLines');
    expect(lines.map((r) => [r.chat, r.from, r.line])).toEqual([
      ['Calm Pip', 'Calm Pip', 'Hi back'],
      ['Calm Pip', 'You', 'Hello'],
    ]);
    expect(rows('bondChats').map((r) => [r.them, r.you, r.lines, r.lastLine])).toEqual([['Calm Pip', 'Brave Dew', 2, 'Hi back']]);
    expect(JSON.stringify([...lines, ...rows('bondChats')])).not.toMatch(/"u2"|Other/);
    // A second chat, its lines between the first chat's in time: a page still reads chat by chat, each chat's lines newest first, both sides.
    db.exec(`INSERT INTO bond_chats (id, a_user_id, b_user_id, a_alias, b_alias, created_at, last_message_at) VALUES ('ch0', 'u1', 'u3', 'Kind Sage', 'Bold Ember', '2026-11-06T00:00:00Z', '2026-11-07T00:03:00Z');
      INSERT INTO bond_messages (id, chat_id, user_id, body, created_at) VALUES ('m3', 'ch0', 'u3', 'Earlier hello', '2026-11-07T00:00:30Z'), ('m4', 'ch0', 'u1', 'Later reply', '2026-11-07T00:03:00Z');`);
    expect(rows('bondChatLines').map((r) => [r.chat, r.from, r.line])).toEqual([
      ['Calm Pip', 'Calm Pip', 'Hi back'],
      ['Calm Pip', 'You', 'Hello'],
      ['Bold Ember', 'You', 'Later reply'],
      ['Bold Ember', 'Bold Ember', 'Earlier hello'],
    ]);
    db.exec(`DELETE FROM bond_messages WHERE chat_id = 'ch0'; DELETE FROM bond_chats WHERE id = 'ch0';`);
    // A program's invites by name, never a closed account; a program invited to, only one the person can still see, with who invited them.
    expect(rows('programInvitesSent').map((r) => [r.program, r.person])).toEqual([['My program', 'Other']]);
    expect(rows('programInvites').map((r) => [r.program, r.programState])).toEqual([['Their program', 'private']]);
    // Who invited the person is never read: Connect people's note says only "The team".
    expect(textOf('programInvites')).not.toMatch(/invited_by|JOIN users/);
    // A cohort the person runs, by its dates; ten years or more reads always open.
    expect(rows('cohortsRun').map((r) => [r.cohort, r.when])).toEqual([['Masked cohort', 'always']]);
    // The person's own cohort lines; a coach only the ones where they show by name, an admin all of them.
    expect(rows('cohortLines').map((r) => [r.line, r.shownAs]).sort()).toEqual([['Masked line', 'private'], ['Shown line', 'public']]);
    expect(rows('cohortLines', 'coach').map((r) => r.line)).toEqual(['Shown line']);
    expect(rows('cohortLines', 'admin').length).toBe(2);
    db.close();
  });
});
