import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  audienceOf,
  BRAND_SOURCE_KIND_OPTIONS,
  coachTableKeys,
  DATA_TABLES,
  dataTableByKey,
  editValue,
  LISTING_STATUS_OPTIONS,
  listTables,
  OFFER_STATUS_OPTIONS,
  parseTableQuery,
  PIECE_KIND_OPTIONS,
  PIECE_STATUS_OPTIONS,
  PIECE_WRITER_OPTIONS,
  plainCall,
  PREOWNED_CONDITION_OPTIONS,
  REDEMPTION_STATUS_OPTIONS,
  RESEARCH_KIND_OPTIONS,
  rowEditable,
  rowFromRaw,
  SERVER_DERIVES,
  STORE_CATEGORY_OPTIONS,
  tableAllowed,
  tableColumn,
  tableReach,
  tableSql,
  TOOL_CATEGORY_OPTIONS,
  type ColumnOption,
} from './dataTables';
import {
  BRAND_SOURCE_META,
  LISTING_STATUSES,
  OFFER_STATUSES,
  PIECE_KINDS,
  PIECE_META,
  PREOWNED_CONDITION_META,
  PREOWNED_CONDITIONS,
  RESEARCH_KINDS,
  RESEARCH_META,
  STORE_CATEGORIES,
  TOOL_CATEGORIES,
  type RedemptionStatus,
} from './index';

// All tables' third batch (2026-11-14, the founder: "ok, add them"): Content's brand folders, the Store's pre-owned gear, the tools a person
// suggested, and the rewards they reserved and the games they unlocked. Its own file, beside dataTables.test.ts, which holds the rules every table
// meets (the schema, the owner's index, secrets, routes and words); this one holds what is particular to these twelve.

const MIGRATIONS = new URL('../../../apps/api/migrations/', import.meta.url);
const today = '2026-11-14';
const editable = (k: string) => dataTableByKey[k]!.columns.filter((col) => col.edit).map((col) => col.key);
const pairs = (o: readonly ColumnOption[]) => o.filter((x) => !x.isNull).map((x) => [x.value, x.label]);

describe('All tables: Content, the Store, Tools and Rewards (2026-11-14)', () => {
  // The person's own records, with nobody else's details or words in them: the old rules.
  const OWN = ['brands', 'brandSources', 'researchRuns', 'preownedListings', 'myOffers', 'toolsSuggested', 'rewardReservations', 'gamesUnlocked'];
  // A buyer's or a seller's name and words: who offered on the person's gear, and both sides of a listing's chat. And other creators' titles,
  // names and words: a piece written for a brand quotes the research the runs only count.
  const OTHERS = ['listingOffers', 'chatsWithBuyers', 'chatsWithSellers', 'brandPieces'];
  const BATCH = [...OWN, ...OTHERS];

  it('holds every table, each with its audience and the app its records belong to', () => {
    for (const k of BATCH) expect(dataTableByKey[k], k).toBeTruthy();
    expect(DATA_TABLES.filter((t) => ['contentFolders', 'store', 'tools', 'rewards'].includes(t.group)).map((t) => t.key).sort()).toEqual([...BATCH].sort());
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
      brands: ['content'], brandSources: ['content'], researchRuns: ['content'], brandPieces: ['content'],
      preownedListings: ['store'], listingOffers: ['store'], chatsWithBuyers: ['store'], myOffers: ['store'], chatsWithSellers: ['store'],
      toolsSuggested: ['tools'],
      // Rewards is no app, and the games a person unlocked show on its shelf whatever Games is set to.
      rewardReservations: null, gamesUnlocked: null,
    });
    const keysFor = (on: string[]) => listTables('owner', [], on).flatMap((g) => g.tables.map((t) => t.key));
    expect(keysFor([])).toEqual(expect.arrayContaining(['rewardReservations', 'gamesUnlocked']));
    for (const k of ['brands', 'preownedListings', 'chatsWithSellers', 'toolsSuggested']) expect(keysFor([]), k).not.toContain(k);
    expect(keysFor(['content'])).toEqual(expect.arrayContaining(['brands', 'brandSources', 'researchRuns', 'brandPieces']));
    expect(keysFor(['store'])).toEqual(expect.arrayContaining(['preownedListings', 'listingOffers', 'chatsWithBuyers', 'myOffers', 'chatsWithSellers']));
    expect(keysFor(['tools'])).toContain('toolsSuggested');
    // Each category under the app group whose toggle it sits in.
    const appGroupOf = Object.fromEntries(listTables('owner', [], null).map((g) => [g.key, g.appGroup]));
    expect([appGroupOf.contentFolders, appGroupOf.store, appGroupOf.tools, appGroupOf.rewards]).toEqual(['creator', 'creator', 'creator', 'core']);
  });

  it('never selects a buyer’s or a sender’s id, a run’s results, a locked tool’s link or any other id', () => {
    for (const k of BATCH) {
      const t = dataTableByKey[k]!;
      for (const col of t.columns) {
        const sql = col.sql ?? '';
        // A bare id only as a hidden cell the owner's own view reads for a route's path (below), never a column anyone sees.
        if (!(col.hidden && col.ownerOnly)) expect(sql, `${k}.${col.key}`).not.toMatch(/^\w+\.(\w+_)?id$/);
        expect(sql, `${k}.${col.key}`).not.toMatch(/buyer_id|seller_id|suggested_by|redemption_id|game_key/);
        // A reward's key is never a cell: it is only asked whether it is a game's, and named on the server (`rewardName`).
        for (const m of sql.matchAll(/(.{0,9})reward_key(.{0,7})/g)) expect(`${m[1]}|${m[2]}`, `${k}.${col.key}`).toBe('substr(t.|, 1, 5)');
        // A sender's id is only ever compared with the person's own, to say "You".
        for (const m of sql.matchAll(/sender_id(.{0,6})/g)) expect(m[1], `${k}.${col.key}`).toBe(' = ?1 ');
        // A research run's results are counted, never read.
        for (const m of sql.matchAll(/items_json(.{0,2})/g)) expect(m[1], `${k}.${col.key}`).toMatch(/^\)/);
      }
    }
    // A brand piece's folder is a hidden cell only the owner's own view reads, for its route's path.
    const brandId = tableColumn(dataTableByKey.brandPieces!, 'brandId')!;
    expect([brandId.hidden, brandId.ownerOnly]).toEqual([true, true]);
    // Tools blanks a locked tool's link, so the table does, and never searches it (a search would say a locked link is there).
    const link = tableColumn(dataTableByKey.toolsSuggested!, 'link')!;
    expect(link.sql).toBe("CASE WHEN t.min_points = 0 AND t.min_xp = 0 AND t.badge = '' THEN t.url END");
    expect(link.searchable).toBeFalsy();
    // A chat a block by name closed reads as none, on both sides.
    for (const k of ['chatsWithBuyers', 'chatsWithSellers']) expect(dataTableByKey[k]!.where, k).toMatch(/^NOT EXISTS \(SELECT 1 FROM blocks bk WHERE bk\.by_name = 1/);
  });

  it('changes only through Content’s and the Store’s own routes, and only while the app would take it', () => {
    expect(editable('brands')).toEqual(['name', 'niche', 'about', 'voice']);
    expect(editable('brandPieces')).toEqual(['title', 'status']);
    expect(editable('preownedListings')).toEqual(['title', 'condition', 'price', 'status', 'city', 'about']);
    for (const k of BATCH.filter((x) => !['brands', 'brandPieces', 'preownedListings'].includes(x))) {
      expect(editable(k), k).toEqual([]);
      expect(dataTableByKey[k]!.readOnlyWhy, k).toBeTruthy();
    }
    // A piece lives under its folder: both ids fill the path, and with no folder there is no call.
    const title = tableColumn(dataTableByKey.brandPieces!, 'title')!;
    expect(plainCall(title, 'p1', { brandId: 'b1' }, 'The plan', today)).toEqual({ method: 'PATCH', path: '/studio/brands/b1/pieces/p1', body: { title: 'The plan' } });
    expect(plainCall(title, 'p1', {}, 'The plan', today)).toBeNull();
    expect(plainCall(title, 'p1', { brandId: '../x' }, 'The plan', today)).toBeNull();
    expect(plainCall(tableColumn(dataTableByKey.brands!, 'niche')!, 'b1', {}, '', today)).toEqual({ method: 'PATCH', path: '/studio/brands/b1', body: { niche: '' } });
    // A listing changes only while it is for sale or taken down, and only between those two; sold and agreed happen in the Store.
    const listings = dataTableByKey.preownedListings!;
    const status = tableColumn(listings, 'status')!;
    expect(status.edit?.offer).toEqual(['live', 'withdrawn']);
    expect(editValue(status, 'withdrawn')).toEqual({ value: 'withdrawn' });
    expect(editValue(status, 'sold')).toEqual({ error: 'That one is set in the app itself. Pick another.' });
    expect(editValue(status, 'agreed')).toHaveProperty('error');
    expect(editValue(status, 'constructor')).toHaveProperty('error');
    for (const s of ['live', 'withdrawn']) expect(rowEditable(listings, status, { status: s }, today), s).toBe(true);
    for (const s of ['agreed', 'sold']) expect(rowEditable(listings, tableColumn(listings, 'price')!, { status: s }, today), s).toBe(false);
    const price = tableColumn(listings, 'price')!;
    expect(editValue(price, 0)).toHaveProperty('error');
    expect(editValue(price, 250000)).toEqual({ value: 250000 });
    expect(plainCall(price, 'l1', { status: 'live' }, 250000, today)).toEqual({ method: 'PATCH', path: '/market/listings/l1', body: { priceCents: 250000 } });
    expect(editValue(tableColumn(listings, 'condition')!, 'well_used')).toEqual({ value: 'well_used' });
    // The Store's own route takes each field alone and keeps the rest; while sold or agreed it refuses every change.
    const market = readFileSync(new URL('../../../apps/api/src/routes/market.ts', import.meta.url), 'utf8');
    expect(market).toContain("if (status === 'sold' || status === 'agreed') return c.json({ error: 'mark it sold with the sold price' }, 400);");
    expect(market).toContain('body.priceCents === undefined ? row.price_cents : Math.max(1,');
  });

  it('says each kind and state in the app’s own words', () => {
    expect(pairs(BRAND_SOURCE_KIND_OPTIONS)).toEqual(Object.entries(BRAND_SOURCE_META).map(([k, m]) => [k, m.name]));
    expect(pairs(RESEARCH_KIND_OPTIONS)).toEqual(RESEARCH_KINDS.map((k) => [k, RESEARCH_META[k].name]));
    expect(pairs(PIECE_KIND_OPTIONS)).toEqual(PIECE_KINDS.map((k) => [k, PIECE_META[k].name]));
    expect(pairs(PIECE_STATUS_OPTIONS).map(([k]) => k)).toEqual(['draft', 'kept']);
    expect(pairs(PREOWNED_CONDITION_OPTIONS)).toEqual(PREOWNED_CONDITIONS.map((k) => [k, PREOWNED_CONDITION_META[k].name]));
    expect(pairs(STORE_CATEGORY_OPTIONS).map(([k]) => k)).toEqual([...STORE_CATEGORIES]);
    expect(pairs(LISTING_STATUS_OPTIONS).map(([k]) => k)).toEqual([...LISTING_STATUSES]);
    expect(pairs(OFFER_STATUS_OPTIONS).map(([k]) => k)).toEqual([...OFFER_STATUSES]);
    expect(pairs(TOOL_CATEGORY_OPTIONS).map(([k]) => k)).toEqual([...TOOL_CATEGORIES]);
    const reservation: Record<RedemptionStatus, true> = { reserved: true, fulfilled: true, cancelled: true };
    expect(pairs(REDEMPTION_STATUS_OPTIONS).map(([k]) => k).filter((k) => k !== 'unlocked').sort()).toEqual(Object.keys(reservation).sort());
    // The Store's own tags, and Content's own words for who wrote a piece (the writers strategist.ts names).
    const store = readFileSync(new URL('../../../apps/web/src/screens/Store.tsx', import.meta.url), 'utf8');
    expect(store).toContain('<StatusTag tone="info">Offer accepted</StatusTag>');
    expect(store).toContain('<StatusTag tone="bad">Taken down</StatusTag>');
    const brand = readFileSync(new URL('../../../apps/web/src/screens/Brand.tsx', import.meta.url), 'utf8');
    expect(brand).toContain("'Written by a small model' : 'A research digest, no model'");
    const writer = readFileSync(new URL('../../../apps/api/src/strategist.ts', import.meta.url), 'utf8');
    const writers = [...writer.matchAll(/writer: '([\w-]+)'/g)].map((m) => m[1]).sort();
    expect(writers).toEqual(pairs(PIECE_WRITER_OPTIONS).map(([k]) => k).sort());
    // A reward's and a game's name come from the catalog itself, on the server, so a new reward never needs a second list here.
    expect(SERVER_DERIVES).toContain('rewardName');
    expect(rowFromRaw(dataTableByKey.gamesUnlocked!, { _id: 'funflow', unlocked: '2026-11-01T00:00:00Z', _p_reward: 'game_funflow' }, 'owner')).toMatchObject({ row: { cells: { game: null } }, fields: { reward: 'game_funflow' } });
  });

  it('reads each page in an order an index serves, and closes a chat a block by name closed, both ways', async () => {
    const ctx = { view: 'owner' as const, ownerId: 'u1', viewerId: 'u1', today, zone: 'Asia/Kolkata' };
    const { DatabaseSync } = await import('node:sqlite');
    const db = new DatabaseSync(':memory:');
    db.exec(`CREATE TABLE users (id TEXT PRIMARY KEY, display_name TEXT NOT NULL DEFAULT '', handle TEXT);
      CREATE TABLE blocks (blocker_id TEXT NOT NULL, blocked_id TEXT NOT NULL, reason TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, by_name INTEGER NOT NULL DEFAULT 1, PRIMARY KEY (blocker_id, blocked_id));
      CREATE TABLE brands (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, name TEXT NOT NULL, niche TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '', voice TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE INDEX brands_owner ON brands (owner_id, updated_at);
      CREATE TABLE brand_sources (id TEXT PRIMARY KEY, brand_id TEXT NOT NULL, kind TEXT NOT NULL, url TEXT NOT NULL, label TEXT NOT NULL DEFAULT '', summary TEXT NOT NULL DEFAULT '', meta_json TEXT NOT NULL DEFAULT '{}', last_read_at TEXT, created_at TEXT NOT NULL);
      CREATE INDEX brand_sources_brand ON brand_sources (brand_id, created_at);
      CREATE TABLE research_runs (id TEXT PRIMARY KEY, brand_id TEXT NOT NULL, kind TEXT NOT NULL, query TEXT NOT NULL DEFAULT '', status TEXT NOT NULL, backend TEXT NOT NULL DEFAULT '', items_json TEXT NOT NULL DEFAULT '[]', error TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, finished_at TEXT);
      CREATE INDEX research_runs_brand ON research_runs (brand_id, created_at);
      CREATE TABLE brand_pieces (id TEXT PRIMARY KEY, brand_id TEXT NOT NULL, kind TEXT NOT NULL, title TEXT NOT NULL, brief TEXT NOT NULL DEFAULT '', body TEXT NOT NULL, sources_json TEXT NOT NULL DEFAULT '[]', writer TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'draft', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE INDEX brand_pieces_brand ON brand_pieces (brand_id, created_at);
      CREATE TABLE preowned_listings (id TEXT PRIMARY KEY, seller_id TEXT NOT NULL, title TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'Other', description TEXT NOT NULL DEFAULT '', condition TEXT NOT NULL, price_cents INTEGER NOT NULL, original_cents INTEGER, currency TEXT NOT NULL DEFAULT 'INR', purchase_year INTEGER, includes TEXT NOT NULL DEFAULT '', images_json TEXT NOT NULL DEFAULT '[]', is_kit INTEGER NOT NULL DEFAULT 0, city TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'live', sold_cents INTEGER, buyer_id TEXT, featured_until TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE INDEX idx_preowned_status ON preowned_listings(status, created_at);
      CREATE INDEX idx_preowned_seller ON preowned_listings(seller_id, created_at);
      CREATE TABLE preowned_offers (id TEXT PRIMARY KEY, listing_id TEXT NOT NULL, buyer_id TEXT NOT NULL, cents INTEGER NOT NULL, note TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL, decided_at TEXT);
      CREATE INDEX idx_offers_listing ON preowned_offers(listing_id, created_at);
      CREATE INDEX idx_offers_buyer ON preowned_offers(buyer_id, created_at);
      CREATE TABLE preowned_messages (id TEXT PRIMARY KEY, listing_id TEXT NOT NULL, buyer_id TEXT NOT NULL, sender_id TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE INDEX idx_pm_thread ON preowned_messages(listing_id, buyer_id, created_at);
      CREATE TABLE tools (id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'Editing', url TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', affiliate INTEGER NOT NULL DEFAULT 0, verified INTEGER NOT NULL DEFAULT 0, suggested_by TEXT, created_at TEXT NOT NULL, featured_until TEXT, min_points INTEGER NOT NULL DEFAULT 0, badge TEXT NOT NULL DEFAULT '', min_xp INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE redemptions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, reward_key TEXT NOT NULL, points INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'reserved', note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE INDEX idx_redemptions_user ON redemptions(user_id);
      CREATE INDEX idx_redemptions_status ON redemptions(status);
      CREATE TABLE card_unlocks (user_id TEXT NOT NULL, game_key TEXT NOT NULL, redemption_id TEXT, unlocked_at TEXT NOT NULL, PRIMARY KEY (user_id, game_key));
      ${readFileSync(new URL('0156_store_table_indexes.sql', MIGRATIONS), 'utf8')}`);
    const named = (sql: string, binds: readonly unknown[]) => ({ sql: sql.replace(/\?(\d+)/g, '@p$1'), args: Object.fromEntries(binds.map((v, i) => [`p${i + 1}`, v as string | number])) });
    const plan = (key: string, q: Record<string, string> = {}) => {
      const t = dataTableByKey[key]!;
      const s = tableSql(t, parseTableQuery(t, q), ctx);
      const n = named(`EXPLAIN QUERY PLAN ${s.sql}`, s.binds);
      return (db.prepare(n.sql).all(n.args) as { detail: string }[]).map((r) => r.detail).join(' | ');
    };
    for (const k of ['brandSources', 'researchRuns', 'brandPieces']) {
      expect(plan(k), k).not.toMatch(/TEMP B-TREE/);
      expect(plan(k, { dir: 'asc' }), k).not.toMatch(/TEMP B-TREE/);
      expect(plan(k), k).toMatch(/brands_owner/);
    }
    expect(plan('brands')).toMatch(/brands_owner/);
    expect(plan('brands')).not.toMatch(/TEMP B-TREE FOR ORDER BY/);
    for (const k of ['listingOffers', 'chatsWithBuyers']) {
      expect(plan(k), k).not.toMatch(/TEMP B-TREE/);
      expect(plan(k), k).toMatch(/idx_preowned_seller/);
    }
    expect(plan('chatsWithSellers')).toMatch(/idx_preowned_messages_buyer_created/);
    expect(plan('myOffers')).toMatch(/idx_offers_buyer/);
    expect(plan('preownedListings')).toMatch(/idx_preowned_seller/);
    expect(plan('toolsSuggested')).toMatch(/idx_tools_suggested_created/);
    expect(plan('rewardReservations')).toMatch(/idx_redemptions_user_created/);
    expect(plan('gamesUnlocked')).not.toMatch(/TEMP B-TREE/);
    // The older index by user alone went, since the new one serves its reads.
    expect(db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name = 'idx_redemptions_user'").get()).toEqual({ n: 0 });

    db.exec(`INSERT INTO users (id, display_name, handle) VALUES ('u1', 'Seller Sam', 'sam'), ('u2', 'Buyer Bea', 'bea'), ('u3', 'Buyer Cal', 'cal');
      INSERT INTO preowned_listings (id, seller_id, title, condition, price_cents, status, buyer_id, created_at, updated_at) VALUES
        ('l1', 'u1', 'Camera', 'lightly_used', 500000, 'agreed', 'u2', '2026-11-01T00:00:00Z', '2026-11-02T00:00:00Z'),
        ('l2', 'u3', 'Mic', 'well_used', 90000, 'live', NULL, '2026-11-03T00:00:00Z', '2026-11-03T00:00:00Z');
      INSERT INTO preowned_messages (id, listing_id, buyer_id, sender_id, body, created_at) VALUES
        ('m1', 'l1', 'u2', 'u2', 'Is it still there?', '2026-11-01T10:00:00Z'), ('m2', 'l1', 'u2', 'u1', 'Yes it is', '2026-11-01T11:00:00Z'),
        ('m3', 'l1', 'u3', 'u3', 'Any scratches?', '2026-11-01T12:00:00Z'), ('m4', 'l2', 'u1', 'u1', 'Does it hum?', '2026-11-04T09:00:00Z');
      INSERT INTO redemptions (id, user_id, reward_key, points, status, note, created_at, updated_at) VALUES
        ('r1', 'u1', 'game_funflow', 1500, 'fulfilled', 'Unlocked', '2026-11-01T00:00:00Z', '2026-11-01T00:00:00Z'),
        ('r2', 'u1', 'tee', 2500, 'reserved', '', '2026-11-02T00:00:00Z', '2026-11-02T00:00:00Z');`);
    const rows = (key: string, owner = 'u1') => {
      const t = dataTableByKey[key]!;
      const s = tableSql(t, parseTableQuery(t, {}), { ...ctx, ownerId: owner, viewerId: owner });
      const n = named(s.sql, s.binds);
      return db.prepare(n.sql).all(n.args) as Record<string, unknown>[];
    };
    // The seller reads both buyers' chats on their listing, the buyer reads their own on someone else's; the person's own lines say You.
    expect(rows('chatsWithBuyers').map((r) => [r._id, r.buyer, r.from])).toEqual([['m3', 'Buyer Cal', 'Buyer Cal'], ['m2', 'Buyer Bea', 'You'], ['m1', 'Buyer Bea', 'Buyer Bea']]);
    expect(rows('chatsWithSellers').map((r) => [r._id, r.seller, r.from])).toEqual([['m4', 'Buyer Cal', 'You']]);
    expect(rows('chatsWithSellers', 'u2').map((r) => [r._id, r.seller, r.from])).toEqual([['m2', 'Seller Sam', 'Seller Sam'], ['m1', 'Seller Sam', 'You']]);
    // A block by name either way closes the chat on both sides; one behind a made-up name touches nothing here.
    db.exec("INSERT INTO blocks (blocker_id, blocked_id, created_at, by_name) VALUES ('u2', 'u1', '2026-11-05T00:00:00Z', 1)");
    expect(rows('chatsWithBuyers').map((r) => r._id)).toEqual(['m3']);
    expect(rows('chatsWithSellers', 'u2')).toEqual([]);
    db.exec("UPDATE blocks SET by_name = 0 WHERE blocker_id = 'u2'");
    expect(rows('chatsWithSellers', 'u2').map((r) => r._id)).toEqual(['m2', 'm1']);
    // A listing never says who bought it; a game's reservation reads Unlocked, with no note said twice.
    expect(JSON.stringify(rows('preownedListings'))).not.toContain('u2');
    expect(rows('rewardReservations').map((r) => [r._id, r.status, r.note])).toEqual([['r2', 'reserved', null], ['r1', 'unlocked', null]]);
    db.close();
  });
});
