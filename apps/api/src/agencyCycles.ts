import {
  AGENCY_MAX_ITEMS,
  cyclePieceDays,
  cyclePieceTitle,
  cyclesDue,
  docFromProfile,
  retainerCycles,
  retainerMonthlyCents,
  type InvoiceItem,
  type RetainerCycle,
} from '@kreators/shared';
import { newId, noteStmt, notify, nowIso, shiftDate } from './db';
import { localDay } from './coaching';
import { createInvoice, nextNumberAfter, setInvoiceStatus } from './routes/finance';
import { billingOf, settingsFor } from './routes/agency';
import { logStmt, type RetainerRow } from './lifecycle';
import { openTurn, type Share, type Turn } from './cronTick';

/**
 * Recurring work for a running retainer. Every month of it makes its invoice (a draft, or sent when the owner left auto-send on) and its
 * pieces, once. The month starts on the retainer's own day (a retainer begun on the 31st starts on the 28th or 29th of February, the 31st
 * in March), counted in the owner's own zone. A month that was missed while nothing ran is made on the next run, never twice:
 * `UNIQUE (retainer_id, month)` on `agency_cycles` is what makes a month happen once, and the row is written in the same batch as its pieces.
 */

interface DueRetainer extends RetainerRow {
  timezone: string | null;
  client_name: string;
  contact_email: string;
  billing_json: string;
}

const DUE_SELECT = `SELECT r.*, u.timezone, c.name AS client_name, c.contact_email, c.billing_json
  FROM agency_retainers r JOIN users u ON u.id = r.user_id JOIN agency_clients c ON c.id = r.client_id`;

/** What one month costs in round trips, at the most measured: its pieces in a batch, an invoice and its number, a note. */
const CYCLE_TRIPS = 16;

/** A month is made, or it already was. Throws only on a real failure. */
async function makeCycle(db: D1Database, r: DueRetainer, cycle: RetainerCycle, total: number): Promise<boolean> {
  const count = await db.prepare('SELECT COUNT(*) AS n FROM agency_items WHERE user_id = ?').bind(r.user_id).first<{ n: number }>();
  // The pieces fit under the cap on a person's deliverables; if they do not all fit, the month says how many it made.
  const pieces = Math.max(0, Math.min(r.pieces_per_month, AGENCY_MAX_ITEMS - (count?.n ?? 0)));
  const days = cyclePieceDays(cycle.day, cycle.end, pieces);
  const cycleId = newId();
  const now = nowIso();
  try {
    await db.batch([
      db.prepare('INSERT INTO agency_cycles (id, retainer_id, user_id, client_id, n, month, day, pieces, invoice_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)').bind(cycleId, r.id, r.user_id, r.client_id, cycle.n, cycle.month, cycle.day, pieces, now),
      ...days.map((due, i) =>
        db
          .prepare("INSERT INTO agency_items (id, user_id, client_id, title, kind, platform, stage, due_date, cycle_id, cycle_n, revisions_allowed, created_at, updated_at) VALUES (?, ?, ?, ?, 'video', '', 'idea', ?, ?, ?, ?, ?, ?)")
          .bind(newId(), r.user_id, r.client_id, cyclePieceTitle(cycle.n, i + 1), due, cycleId, cycle.n, r.revisions_per_piece, now, now),
      ),
      logStmt(db, r.user_id, r.client_id, 'auto', 'cycle', `Month ${cycle.n} of ${total} started: ${pieces} ${pieces === 1 ? 'piece' : 'pieces'} added.`),
    ]);
  } catch (e) {
    // Two runs at once: the other one made it first.
    const taken = await db.prepare('SELECT 1 AS x FROM agency_cycles WHERE retainer_id = ? AND month = ?').bind(r.id, cycle.month).first();
    if (taken) return false;
    throw e;
  }
  await invoiceForCycle(db, r, cycleId, cycle, total, pieces);
  return true;
}

/** The month marked done and the owner told, in one batch, so a stop can never finish a month nobody hears of. The note has a fixed id, so it is once whichever run finished it. */
const finishMonth = (db: D1Database, r: DueRetainer, cycleId: string, invoiceId: string, n: number, pieces: number) =>
  db.batch([
    db.prepare('UPDATE agency_cycles SET invoice_id = ? WHERE id = ?').bind(invoiceId, cycleId),
    noteStmt(db, { id: `month-ready-${cycleId}`, userId: r.user_id, kind: 'agency', title: `Month ${n} of ${r.client_name} is ready`, body: `${pieces} ${pieces === 1 ? 'piece' : 'pieces'}${invoiceId ? ` and an invoice ${r.auto_send === 1 ? 'sent' : 'in drafts'}` : ''}.`, link: `/agency/${r.client_id}` }, 'once'),
  ]);

/** The month's invoice: the retainer's fee for the length chosen, as a draft, sent when auto-send is on. Once: only the run that holds the cycle row gets here. */
async function invoiceForCycle(db: D1Database, r: DueRetainer, cycleId: string, cycle: RetainerCycle, total: number, pieces: number): Promise<void> {
  const monthly = retainerMonthlyCents(r.fee_cents, r.discount_bps);
  if (monthly <= 0) {
    await finishMonth(db, r, cycleId, '', cycle.n, pieces);
    return;
  }
  // A claim before the work, so a retry never makes a second invoice for the same month.
  const claim = await db.prepare("UPDATE agency_cycles SET invoice_id = 'making' WHERE id = ? AND invoice_id IS NULL").bind(cycleId).run();
  if (!claim.meta.changes) return;
  const made = await db.prepare('SELECT id FROM invoices WHERE agency_cycle_id = ?').bind(cycleId).first<{ id: string }>();
  let invoiceId = made?.id ?? '';
  if (!made) {
    const settings = await settingsFor(db, r.user_id);
    const items: InvoiceItem[] = [{ description: `Content retainer, month ${cycle.n} of ${total} (${cycle.month})`, quantity: 1, unitCents: monthly }];
    const last = await db.prepare('SELECT number FROM invoices WHERE user_id = ? AND agency_client_id IS NOT NULL ORDER BY created_at DESC LIMIT 1').bind(r.user_id).first<{ number: string }>();
    const invoice = await createInvoice(db, r.user_id, {
      clientName: r.client_name,
      clientEmail: r.contact_email,
      items,
      dueDate: shiftDate(cycle.day, settings.profile.payDays),
      issueDate: cycle.day,
      note: '',
      currency: settings.currency,
      agencyClientId: r.client_id,
      doc: { ...docFromProfile(settings.profile), to: billingOf({ billing_json: r.billing_json, name: r.client_name, contact_email: r.contact_email }) },
      prefix: settings.profile.invoicePrefix,
      agencyCycleId: cycleId,
      ...(last ? { number: await nextNumberAfter(db, r.user_id, last.number) } : {}),
    });
    invoiceId = invoice?.id ?? '';
  }
  // Sent before the month is marked done, so a stop in between leaves it for the half-hour sweep, which finds this invoice and sends it (twice does nothing), never a second one.
  if (invoiceId && r.auto_send === 1) await setInvoiceStatus(db, r.user_id, invoiceId, 'sent');
  await finishMonth(db, r, cycleId, invoiceId, cycle.n, pieces);
}

/**
 * Makes what is due for every running retainer (or one): the months whose start day has come in the owner's zone, oldest first. Also ends
 * a retainer whose last month is over, and finishes an invoice that a crash left half made. Returns the number of months made.
 */
export async function runAgencyCycles(db: D1Database, only?: { retainerId: string }, turn: Turn = openTurn(db)): Promise<number> {
  const live = `r.status = 'active' AND r.start_day IS NOT NULL AND r.months IS NOT NULL ${only ? 'AND r.id = ?' : ''}`;
  const whose = only ? [only.retainerId] : [];
  // Every running retainer and the months it has made, in one trip, so a tick asks nothing per retainer unless a month is really due. A half-made month has its own read.
  const cutoff = new Date(Date.now() - 30 * 60_000).toISOString();
  const [rows, madeRows, stuck] = await Promise.all([
    db.prepare(`${DUE_SELECT} WHERE ${live} ORDER BY r.created_at LIMIT 300`).bind(...whose).all<DueRetainer>(),
    db.prepare(`SELECT cy.retainer_id, cy.month FROM agency_cycles cy JOIN agency_retainers r ON r.id = cy.retainer_id WHERE ${live}`).bind(...whose).all<{ retainer_id: string; month: string }>(),
    only ? Promise.resolve(null) : db.prepare(`SELECT cy.id AS cycle_id, cy.n, cy.month, cy.day, cy.pieces FROM agency_cycles cy WHERE cy.created_at < ? AND (cy.invoice_id IS NULL OR cy.invoice_id = 'making') LIMIT 50`).bind(cutoff).all<StuckCycle>(),
  ]);
  const madeMonths = new Set(madeRows.results.map((m) => `${m.retainer_id}|${m.month}`));
  // What is really due: a month not yet made, or a retainer whose last month is over. Worked out once, without a trip.
  const due = rows.results.flatMap((r) => {
    const total = r.months ?? 0;
    const today = localDay(r.timezone || 'Asia/Kolkata');
    const months = cyclesDue(r.start_day!, total, today).filter((cycle) => !madeMonths.has(`${r.id}|${cycle.month}`));
    const all = retainerCycles(r.start_day!, total);
    const last = all[all.length - 1];
    const over = Boolean(last && today > last.end);
    return months.length || over ? [{ r, total, months, over }] : [];
  });
  if (!due.length && !stuck?.results.length) return 0;
  const share = await turn(CYCLE_TRIPS);
  let made = 0;
  for (const { r, total, months, over } of due) {
    try {
      let stopped = false;
      for (const cycle of months) {
        // The next tick takes the rest, from the months it reads then: each month is whole or not started.
        if (share.left() < CYCLE_TRIPS) {
          share.more();
          stopped = true;
          break;
        }
        if (await makeCycle(db, r, cycle, total)) made += 1;
      }
      if (stopped) break;
      if (over) {
        const ended = await db.prepare("UPDATE agency_retainers SET status = 'ended', ended_at = ?, updated_at = ? WHERE id = ? AND status = 'active'").bind(nowIso(), nowIso(), r.id).run();
        if (ended.meta.changes) {
          await logStmt(db, r.user_id, r.client_id, 'auto', 'retainer', `The retainer ended after ${total} ${total === 1 ? 'month' : 'months'}. Offer a renewal to go on.`).run();
          await notify(db, r.user_id, 'agency', `The retainer for ${r.client_name} ended`, 'Offer a renewal to keep it going.', `/agency/${r.client_id}`);
        }
      }
    } catch {
      // One retainer failing must not stop the others; it is tried again on the next run.
    }
  }
  if (stuck) made += await finishHalfMade(db, stuck.results, cutoff, share);
  return made;
}

interface StuckCycle {
  cycle_id: string;
  n: number;
  month: string;
  day: string;
  pieces: number;
}

/** A month whose invoice was never finished (the run stopped between the pieces and the invoice): finished once, a half hour later. */
async function finishHalfMade(db: D1Database, stuck: readonly StuckCycle[], cutoff: string, share: Share): Promise<number> {
  let fixed = 0;
  for (const s of stuck) {
    if (share.left() < CYCLE_TRIPS) {
      share.more();
      break;
    }
    const r = await db.prepare(`${DUE_SELECT} WHERE r.id = (SELECT retainer_id FROM agency_cycles WHERE id = ?)`).bind(s.cycle_id).first<DueRetainer>();
    if (!r) continue;
    // Take the half-made claim back so exactly one run finishes it.
    const took = await db.prepare("UPDATE agency_cycles SET invoice_id = NULL WHERE id = ? AND (invoice_id IS NULL OR invoice_id = 'making') AND created_at < ?").bind(s.cycle_id, cutoff).run();
    if (!took.meta.changes) continue;
    try {
      await invoiceForCycle(db, r, s.cycle_id, { n: s.n, month: s.month, day: s.day, end: s.day }, r.months ?? 0, s.pieces);
      fixed += 1;
    } catch {
      // tried again next time
    }
  }
  return fixed;
}
