import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DATA_TABLES,
  dataTableByKey,
  editValue,
  editWhenWhy,
  noEditWhyOf,
  noRemoveWhyOf,
  parseTableQuery,
  plainCall,
  removeCallFor,
  removeCallOf,
  removeStateOf,
  removeWords,
  rowEditable,
  rowFromRaw,
  ruleSelects,
  tableColumn,
  tableEditable,
  tableSql,
  visibleColumns,
  type DataTable,
  type RemoveCall,
} from './dataTables';

// All tables' Edit and Delete for the Creation apps (2026-11-14, the founder: "all tables need to be editable ... each entry for the original
// user and not for coach, and not even ai, edit and delete buttons should also be there in select and multi select and select all"): Money,
// My purchases, Shop, Audience, Content and Auto-DM, Content folders, the Public page, the Store, Tools, and TV and Fund. Each table changes
// and goes only through its own app's route, as the person, and says why not where the app keeps a record (a ledger, a paid question, an
// order). This file holds what is particular to these forty-three; dataTables.actions.test.ts holds the rules every remove meets.

const GROUPS = ['money', 'purchases', 'shop', 'audience', 'creatorContent', 'contentFolders', 'publicPage', 'store', 'tools', 'pitches'];
const MINE = DATA_TABLES.filter((t) => GROUPS.includes(t.group));
const today = '2026-11-14';
const ctx = { view: 'owner' as const, ownerId: 'u1', viewerId: 'u1', today, zone: 'Asia/Kolkata' };
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const t = (k: string): DataTable => dataTableByKey[k]!;
const callsOf = (table: DataTable): RemoveCall[] =>
  table.remove ? [...(table.remove.call ? [table.remove.call] : []), ...(table.remove.outcomes ?? []).flatMap((o) => ('call' in o ? [o.call] : []))] : [];

describe('All tables: Edit and Delete for the Creation apps (2026-11-14)', () => {
  it('says for every table how its rows change and go here, or why not', () => {
    expect(MINE.length).toBe(43);
    for (const table of MINE) {
      expect(tableEditable(table) || Boolean(table.noEditWhy), `${table.key} edits or says why not`).toBe(true);
      expect(Boolean(table.remove) || Boolean(table.noRemoveWhy), `${table.key} removes or says why not`).toBe(true);
      if (!tableEditable(table)) expect(noEditWhyOf(table), table.key).toMatch(/^[A-Z].*\.$/);
      if (!table.remove) expect(noRemoveWhyOf(table), table.key).toMatch(/^[A-Z].*\.$/);
    }
  });

  it('removes each the way its own app does, in its own word, and asks the way the app asks', () => {
    const asks = Object.fromEntries(MINE.filter((x) => x.remove).map((x) => [x.key, `${x.remove!.verb}/${x.remove!.ask}`]));
    expect(asks).toEqual({
      moneyInOut: 'Delete/sheet', budgets: 'Delete/twice', dues: 'Delete/sheet', savingsGoals: 'Delete/sheet', recurring: 'Delete/sheet',
      myBookings: 'Cancel/sheet', myCourseInvites: 'Decline/sheet', myProductReviews: 'Delete/twice',
      products: 'Delete/sheet', coupons: 'Delete/sheet', bookings: 'Cancel/sheet', sessionHours: 'Remove/sheet', sessionDays: 'Remove/sheet', courseInvites: 'Remove/sheet',
      leads: 'Delete/sheet', broadcasts: 'Delete/sheet',
      contentPosts: 'Delete/sheet', trackedLinks: 'Delete/sheet', autoDms: 'Delete/sheet', funnels: 'Delete/sheet', sequences: 'Delete/sheet',
      portfolio: 'Delete/twice',
      brands: 'Delete/sheet', brandSources: 'Delete/twice', researchRuns: 'Delete/twice', brandPieces: 'Delete/twice',
      preownedListings: 'Delete/sheet', chatsWithBuyers: 'Delete/twice', myOffers: 'Withdraw/sheet', chatsWithSellers: 'Delete/twice',
      toolsSuggested: 'Delete/twice',
      tvPitches: 'Withdraw/sheet', fundApplications: 'Withdraw/sheet',
    });
    // Records stay: a ledger, an order, a plan, payout details, a paid question, a buyer's offer or review, each greyed with why.
    for (const k of ['points', 'credits', 'orders', 'plan', 'discountsUsed', 'payoutDetails', 'myQuestions', 'priorityDms', 'productReviews', 'listingOffers']) {
      expect(t(k).remove, k).toBeUndefined();
      expect(t(k).noRemoveWhy, k).toBeTruthy();
    }
    expect(t('orders').noRemoveWhy).toBe('An order stays for the books, yours and the seller’s.');
    // Every call reaches only routes of these apps' own prefixes.
    for (const table of MINE) for (const call of callsOf(table)) expect(call.path, table.key).toMatch(/^\/(finance|store|studio|market|me\/portfolio|tools|proposals)\//);
    // The words a sheet says: what goes and what stays, never a promise the app does not keep.
    expect(t('trackedLinks').remove!.warn).toContain('any Auto-DM that sends it goes too');
    expect(t('contentPosts').remove!.warn).toContain('Its tracked links keep working');
    expect(t('broadcasts').remove!.warn).toContain('The copies in people’s inboxes stay');
    expect(removeWords(t('products'), 1)).toMatchObject({ title: 'Delete 1 row?', yes: 'Yes, delete it for good' });
    expect(removeWords(t('myBookings'), 2)).toMatchObject({ ask: 'Tap again to cancel', yes: 'Yes, cancel them' });
  });

  it('changes the amount, side, category and day only of money you typed, and deletes only that', () => {
    const tx = t('moneyInOut');
    for (const k of ['day', 'kind', 'amount', 'category']) {
      const col = tableColumn(tx, k)!;
      expect(col.edit?.when, k).toBe('madeIt');
      expect(rowEditable(tx, col, { madeIt: true }, today), k).toBe(true);
      expect(rowEditable(tx, col, { madeIt: false }, today), k).toBe(false);
      expect(editWhenWhy(col.edit!, { madeIt: false }), k).toBe('The app booked this one from an invoice, a due or a monthly entry, so it stays as it was booked.');
    }
    // Who and the note change on any entry, as Finance lets them.
    for (const k of ['who', 'note']) expect(rowEditable(tx, tableColumn(tx, k)!, { madeIt: false }, today), k).toBe(true);
    expect(tableColumn(tx, 'madeIt')).toMatchObject({ hidden: true, sql: "t.source = 'manual'" });
    expect(removeStateOf(tx, { madeIt: false }, {})).toEqual({ why: 'Money the app booked from an invoice, a due or a monthly entry stays. Change it where it came from.' });
    expect(removeStateOf(tx, { madeIt: true }, {})).toEqual({ did: 'deleted', at: -1 });
    expect(editValue(tableColumn(tx, 'amount')!, 0)).toHaveProperty('error');
    expect(plainCall(tableColumn(tx, 'amount')!, 'tx1', { madeIt: true }, 250000, today)).toEqual({ method: 'PATCH', path: '/finance/transactions/tx1', body: { amountCents: 250000 } });
    // Finance's own route holds the same rule, in the write and out loud (the route gap All tables found: it deleted an invoice's booked income).
    const finance = read('../../../apps/api/src/routes/finance.ts');
    expect(finance).toContain("DELETE FROM finance_transactions WHERE id = ? AND user_id = ? AND source = 'manual'");
    expect(finance).toContain("WHERE id = ? AND user_id = ?${typed ? \" AND source = 'manual'\" : ''}");
    expect(finance).toContain("if (prev.source !== 'manual') return c.json({ error: BOOKED_STAYS }, 409);");
  });

  it('changes a due only while open, settles it one way, and takes a budget off by its category', () => {
    const dues = t('dues');
    const status = tableColumn(dues, 'status')!;
    expect(status.edit).toMatchObject({ method: 'POST', path: '/finance/dues/:id/settle', recipe: 'todayQuery', offer: ['settled'] });
    expect(editValue(status, 'open')).toHaveProperty('error');
    expect(plainCall(status, 'd1', { madeIt: true }, 'settled', today)).toEqual({ method: 'POST', path: '/finance/dues/d1/settle?day=2026-11-14', body: { status: 'settled' } });
    for (const k of ['who', 'amount', 'note', 'due', 'status']) expect(rowEditable(dues, tableColumn(dues, k)!, { madeIt: false }, today), k).toBe(false);
    expect(read('../../../apps/api/src/routes/finance.ts')).toContain("UPDATE finance_dues SET counterparty = ?, amount_cents = ?, note = ?, due_date = ? WHERE id = ? AND user_id = ? AND status = 'open'");
    // A budget is named by its category, which may hold a space: the path carries it with dashes, and the route reads either.
    const del = t('budgets').remove!.call!;
    expect(removeCallFor(del, 'Other expense', { slug: 'Other-expense' }, {}, today)).toEqual({ method: 'DELETE', path: '/finance/budgets/Other-expense' });
    expect(tableColumn(t('budgets'), 'slug')?.sql).toBe("replace(t.category, ' ', '-')");
    expect(read('../../../apps/api/src/routes/finance.ts')).toContain("EXPENSE_CATEGORIES.find((k) => k === raw || k.replace(/ /g, '-') === raw)");
    // A saving goal's amount put aside is typed; an earning goal counts money in by itself.
    const saved = tableColumn(t('savingsGoals'), 'saved')!;
    expect(rowEditable(t('savingsGoals'), saved, { madeIt: false }, today)).toBe(false);
    expect(editWhenWhy(saved.edit!, {})).toBe('An earning goal counts your money in by itself.');
  });

  it('keeps Shop’s own one-way steps, and its records', () => {
    const products = t('products');
    expect(ruleSelects(products)).toEqual(['EXISTS (SELECT 1 FROM orders o WHERE o.product_id = t.id)']);
    expect(removeStateOf(products, { status: 'live' }, { _q0: 0 })).toEqual({ why: 'Archive it first. Only an archived product can be deleted for good.' });
    expect(removeStateOf(products, { status: 'archived' }, { _q0: 1 })).toEqual({ why: 'People bought it, so it stays archived to keep their orders and access.' });
    expect(removeStateOf(products, { status: 'archived' }, { _q0: 0 })).toEqual({ did: 'deleted', at: 1 });
    // A booking is confirmed, then done; a cancelled or finished one stays. Its route holds the same, and is guarded on the state it read.
    const booking = tableColumn(t('bookings'), 'status')!;
    expect(booking.edit?.offer).toEqual(['confirmed', 'done']);
    expect(editValue(booking, 'cancelled')).toHaveProperty('error');
    expect(removeStateOf(t('bookings'), { madeIt: false }, {})).toEqual({ why: 'A cancelled or finished session stays as it is.' });
    expect(removeCallFor(t('bookings').remove!.call!, 'b1', {}, {}, today)).toEqual({ method: 'POST', path: '/studio/bookings/b1', body: { status: 'cancelled' } });
    const studio = read('../../../apps/api/src/routes/studio.ts');
    expect(studio).toContain("UPDATE bookings SET status = ?, meeting_url = ? WHERE id = ? AND status = ?");
    expect(studio).toContain("if (prev.status === 'cancelled' || prev.status === 'done') return c.json({ error: 'A cancelled or finished session stays as it is.' }, 409);");
    // A coupon's uses never go under the uses made; its code and percent never change.
    expect(studio).toContain('UPDATE coupons SET max_uses = ?1 WHERE id = ?2 AND owner_id = ?3 AND (?1 IS NULL OR uses <= ?1)');
    expect(tableColumn(t('coupons'), 'percentOff')?.edit).toBeUndefined();
    // A paid question is answered once, while it waits (the route gap: it took a second answer, and one on a refunded question).
    const answer = tableColumn(t('priorityDms'), 'answer')!;
    expect(rowEditable(t('priorityDms'), answer, { madeIt: false }, today)).toBe(false);
    expect(read('../../../apps/api/src/routes/growth.ts')).toContain(`UPDATE dm_requests SET answer = ?, status = 'answered', answered_at = ? WHERE id = ? AND status = 'open'`);
    // A buyer cancels only a session still waiting or confirmed (the route gap: it cancelled a finished one too).
    expect(read('../../../apps/api/src/routes/store.ts')).toContain("UPDATE bookings SET status = 'cancelled' WHERE id = ? AND buyer_id = ? AND status IN ('requested', 'confirmed')");
    // Session hours change by weekday and clock time; a day's own hours go back to the week, named by the day.
    expect(plainCall(tableColumn(t('sessionHours'), 'from')!, 'a1', {}, '09:30', today)).toEqual({ method: 'PATCH', path: '/studio/availability/a1', body: { from: '09:30' } });
    expect(removeCallFor(t('sessionDays').remove!.call!, 'ov1', { day: '2026-11-20' }, {}, today)).toEqual({ method: 'DELETE', path: '/studio/availability/overrides/2026-11-20' });
  });

  it('builds a call from the row’s own ids only: another person’s id from the server, never a cell', () => {
    // A course invite's person is a private field (read on the server, never sent); the course is a hidden cell only the owner's view reads.
    const invites = t('courseInvites');
    expect(invites.privateSelect?.userId).toBe('t.user_id');
    expect(tableColumn(invites, 'productId')).toMatchObject({ hidden: true, ownerOnly: true });
    expect(removeCallFor(invites.remove!.call!, 'p1:u2', { productId: 'p1' }, { userId: 'u2' }, today)).toEqual({ method: 'DELETE', path: '/studio/products/p1/invites/u2' });
    expect(removeCallFor(invites.remove!.call!, 'p1:u2', { productId: 'p1' }, {}, today)).toBeNull();
    // A course you were invited to is declined by its course; a chat line by its listing.
    expect(removeCallFor(t('myCourseInvites').remove!.call!, 'p1:u1', { productId: 'p1' }, {}, today)).toEqual({ method: 'DELETE', path: '/store/invites/p1' });
    expect(removeCallFor(t('chatsWithBuyers').remove!.call!, 'm1', { listingId: 'l1' }, {}, today)).toEqual({ method: 'DELETE', path: '/market/listings/l1/messages/m1' });
    expect(removeCallFor(t('brandSources').remove!.call!, 's1', { brandId: 'b1' }, {}, today)).toEqual({ method: 'DELETE', path: '/studio/brands/b1/sources/s1' });
    expect(removeCallFor(t('researchRuns').remove!.call!, 'r1', { brandId: '../x' }, {}, today)).toBeNull();
    // Those ids are the owner's alone: a coach's or an admin's read never selects them, nor the remove's rules.
    for (const k of ['brandSources', 'researchRuns']) {
      const q = parseTableQuery(t(k), {});
      for (const view of ['coach', 'admin'] as const) {
        expect(visibleColumns(t(k), view).map((col) => col.key), `${k} ${view}`).not.toContain('brandId');
        expect(tableSql(t(k), q, { ...ctx, view, viewerId: 'c1', rules: true }).sql, `${k} ${view}`).not.toContain('t.brand_id AS');
      }
    }
    // Offers: the Store's own accept and decline, sent as its words; and the route's write is guarded on the offer still open.
    const offer = tableColumn(t('listingOffers'), 'status')!;
    expect(editValue(offer, 'accepted')).toEqual({ value: 'accept' });
    expect(editValue(offer, 'withdrawn')).toHaveProperty('error');
    expect(plainCall(offer, 'o1', { madeIt: true }, 'decline', today)).toEqual({ method: 'POST', path: '/market/offers/o1', body: { action: 'decline' } });
    const market = read('../../../apps/api/src/routes/market.ts');
    expect(market).toContain("UPDATE preowned_offers SET status = 'accepted', decided_at = ? WHERE id = ? AND status = 'open'");
    expect(market).toContain('DELETE FROM preowned_messages WHERE id = ? AND listing_id = ? AND sender_id = ?');
    expect(removeCallFor(t('myOffers').remove!.call!, 'o1', {}, {}, today)).toEqual({ method: 'POST', path: '/market/offers/o1', body: { action: 'withdraw' } });
    // A tool you suggested is yours to change or take back only until the team checks it; Tools' routes hold the same.
    const tools = read('../../../apps/api/src/routes/tools.ts');
    expect(tools).toContain('DELETE FROM tools WHERE id = ? AND suggested_by = ? AND verified = 0');
    expect(tools).toContain('WHERE id = ? AND suggested_by = ? AND verified = 0');
    expect(removeStateOf(t('toolsSuggested'), { madeIt: false }, {})).toEqual({ why: 'The team checked it, so it stays in the directory as the team keeps it.' });
    // A pitch goes only while the team has not started it.
    const pitch = t('tvPitches');
    expect(removeStateOf(pitch, {}, { _q0: 1 })).toEqual({ did: 'withdrawn', at: 0 });
    expect(removeStateOf(pitch, {}, { _q0: 0 })).toEqual({ why: 'The team has started reading it, so it stays.' });
    expect(removeCallOf(pitch.remove!, 0)?.path).toBe('/proposals/:id/withdraw');
  });

  it('works each remove’s rule out in the read itself, for the owner’s own rows only', async () => {
    const { DatabaseSync } = await import('node:sqlite');
    const db = new DatabaseSync(':memory:');
    const run = (sql: string, binds: readonly unknown[]) => {
      const st = db.prepare(sql.replace(/\?(\d+)/g, '@p$1'));
      return st.all(Object.fromEntries(binds.map((v, i) => [`p${i + 1}`, v as string | number]))) as Record<string, unknown>[];
    };
    db.exec(`
      CREATE TABLE users (id TEXT PRIMARY KEY, display_name TEXT, handle TEXT);
      CREATE TABLE products (id TEXT PRIMARY KEY, owner_id TEXT, title TEXT, kind TEXT, status TEXT, created_at TEXT);
      CREATE TABLE product_invites (product_id TEXT, user_id TEXT, invited_by TEXT, created_at TEXT);
      CREATE TABLE orders (id TEXT PRIMARY KEY, product_id TEXT, buyer_id TEXT, status TEXT);
      CREATE TABLE preowned_listings (id TEXT PRIMARY KEY, seller_id TEXT, title TEXT, currency TEXT, created_at TEXT);
      CREATE TABLE preowned_messages (id TEXT PRIMARY KEY, listing_id TEXT, buyer_id TEXT, sender_id TEXT, body TEXT, created_at TEXT);
      CREATE TABLE blocks (blocker_id TEXT, blocked_id TEXT, by_name INTEGER);
      INSERT INTO users VALUES ('u1', 'Me', 'me'), ('u2', 'Asha', 'asha'), ('u3', 'Ravi', 'ravi');
      INSERT INTO products VALUES ('p1', 'u2', 'Open course', 'course', 'private', '2026-11-01'), ('p2', 'u2', 'Bought course', 'course', 'private', '2026-11-02');
      INSERT INTO product_invites VALUES ('p1', 'u1', 'u2', '2026-11-03'), ('p2', 'u1', 'u2', '2026-11-04'), ('p1', 'u3', 'u2', '2026-11-05');
      INSERT INTO orders VALUES ('o1', 'p2', 'u1', 'paid'), ('o2', 'p1', 'u3', 'paid');
      INSERT INTO preowned_listings VALUES ('l1', 'u1', 'Camera', 'INR', '2026-11-01');
      INSERT INTO preowned_messages VALUES ('m1', 'l1', 'u2', 'u2', 'Is it still there?', '2026-11-02'), ('m2', 'l1', 'u2', 'u1', 'Yes it is', '2026-11-03');
    `);
    const stateOf = (table: DataTable, ids: string[]) => {
      const s = tableSql(table, { ...parseTableQuery(table, {}), count: false }, { ...ctx, ids, rules: true });
      return Object.fromEntries(
        run(s.sql, s.binds).map((r) => {
          const { row, fields } = rowFromRaw(table, r, 'owner');
          return [row.id, removeStateOf(table, row.cells, fields)];
        }),
      );
    };
    // A course you bought keeps its invite; one you did not is declined; someone else's invite is never in your list.
    expect(stateOf(t('myCourseInvites'), ['p1:u1', 'p2:u1', 'p1:u3'])).toEqual({
      'p1:u1': { did: 'declined', at: -1 },
      'p2:u1': { why: 'You bought this course, so its invite stays with it.' },
    });
    // Only your own lines of a chat, never the buyer's.
    expect(stateOf(t('chatsWithBuyers'), ['m1', 'm2'])).toEqual({
      m1: { why: 'Only your own lines can be deleted. Theirs stay as they wrote them.' },
      m2: { did: 'deleted', at: -1 },
    });
  });

  it('adds no assistant tool and keeps every new route under its app’s own door', () => {
    const tools = read('../../../apps/api/src/assistant/tools.ts');
    for (const path of ['/studio/leads/', '/studio/broadcasts/', '/store/invites/', '/store/reviews/', '/me/portfolio/', '/studio/coupons/']) expect(tools, path).not.toContain(path);
    const limits = read('../../../apps/api/src/limits.ts');
    for (const path of ['/finance/dues/:id', '/finance/budgets/:category', '/studio/leads/:id', '/studio/broadcasts/:id', '/store/invites/:productId', '/market/listings/:id/messages/:mid', '/me/portfolio/:id', '/tools/:id']) {
      expect(limits, path).toContain(`'${path}'`);
    }
  });
});
