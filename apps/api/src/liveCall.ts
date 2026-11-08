import { LIVE_CALL_CENTS, money, PAYMENTS_LIVE, PLAN_CURRENCY, type LiveCallAnswer, type LiveCallRequest, type LiveCallStatus } from '@kreators/shared';
import type { Env, UserRow } from './env';
import { adminIds, nameOf, newId, notify, notifyMany, nowIso } from './db';
import { paymentsConfig, providerFor } from './payments';
import { logEvent } from './ops';

/**
 * The live call with a coach, a paid service (migration 0100 `call_requests`). The person says yes on the strategy session's
 * contract; this keeps the ask, tells the admins once, and takes the payment through payments.ts when payments are live.
 * The call becomes `paid` only in the payment webhook after its signature is checked (`handleCallPayment`), never here.
 */
interface CallRow {
  id: string;
  user_id: string | null;
  status: LiveCallStatus;
  amount_cents: number;
  currency: string;
  provider: string | null;
  provider_order_id: string | null;
  created_at: string;
  paid_at: string | null;
}

const OPEN = "('asked', 'paying', 'paid', 'booked')";
const toRequest = (r: CallRow): LiveCallRequest => ({ id: r.id, status: r.status, amountCents: r.amount_cents, currency: r.currency, createdAt: r.created_at, paidAt: r.paid_at });

/** The admins to tell: every super admin, in the Team tab of their inbox. */
async function tellAdmins(db: D1Database, title: string, body: string): Promise<void> {
  await notifyMany(db, await adminIds(db), 'team', title, body, '/admin?tab=people');
}

/** The person's open ask, if any: asked, being paid, paid or booked. */
export async function openCall(db: D1Database, userId: string): Promise<LiveCallRequest | null> {
  const r = await db.prepare(`SELECT * FROM call_requests WHERE user_id = ? AND status IN ${OPEN} ORDER BY created_at DESC LIMIT 1`).bind(userId).first<CallRow>();
  return r ? toRequest(r) : null;
}

/** Whether money is taken for the call now: the switch in shared and a provider with keys. */
export const callPaymentsLive = (env: Env): boolean => PAYMENTS_LIVE && providerFor(env).name === 'razorpay';

/**
 * Ask for the call. One open ask per person (a unique index), so asking again returns the same one and tells nobody again.
 * While payments are not live nothing is charged: the ask waits for the team, who are told at once. Once they are live the
 * ask gets a provider order and the answer carries what the browser opens the payment window with; the team is told when
 * the webhook says it was paid.
 */
export async function askForCall(db: D1Database, env: Env, user: UserRow): Promise<LiveCallAnswer> {
  const live = callPaymentsLive(env);
  const now = nowIso();
  const made = await db
    .prepare('INSERT OR IGNORE INTO call_requests (id, user_id, status, amount_cents, currency, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(newId(), user.id, 'asked', LIVE_CALL_CENTS, PLAN_CURRENCY, now, now)
    .run();
  const fresh = made.meta.changes === 1;
  let row = await db.prepare(`SELECT * FROM call_requests WHERE user_id = ? AND status IN ${OPEN} ORDER BY created_at DESC LIMIT 1`).bind(user.id).first<CallRow>();
  if (!row) throw new Error('the ask for a live call was not kept');
  const price = money(row.amount_cents, row.currency);

  if (!live) {
    if (fresh) {
      await tellAdmins(db, `${nameOf(user)} asked for a live call`, `${price}, from the strategy session. Payments are not live, so nothing was charged: write to ${user.email ?? 'them'} to set a time.`);
      await logEvent(db, 'call', row.id, 'call.asked');
    }
    const note =
      row.status === 'paid' || row.status === 'booked'
        ? 'Your live call is paid. The team will write to you to set a time.'
        : `Your ask for a live call is in. Payments are not live yet, so nothing was charged. The team will write to you to set a time and how to pay the ${price}.`;
    return { request: toRequest(row), payment: null, live: false, note };
  }

  // Live: an ask still to be paid gets one provider order, kept on the row so asking again reopens the same order.
  if (row.status === 'asked' || (row.status === 'paying' && !row.provider_order_id)) {
    const provider = providerFor(env);
    const order = await provider.createOrder({ amountCents: row.amount_cents, currency: row.currency, receipt: `call_${row.id}`, notes: { service: 'Live call with a coach' } });
    const moved = await db
      .prepare("UPDATE call_requests SET status = 'paying', provider = ?, provider_order_id = ?, updated_at = ? WHERE id = ? AND status = ? AND provider_order_id IS NULL")
      .bind(provider.name, order.providerOrderId, nowIso(), row.id, row.status)
      .run();
    // Two taps at once: the other one made the order first, so its order is the one to pay.
    row = (await db.prepare('SELECT * FROM call_requests WHERE id = ?').bind(row.id).first<CallRow>()) ?? row;
    if (moved.meta.changes === 1) await logEvent(db, 'call', row.id, 'call.order', { providerOrderId: order.providerOrderId });
  }
  if (row.status === 'paying' && row.provider_order_id) {
    return {
      request: toRequest(row),
      payment: { mode: 'razorpay', keyId: paymentsConfig(env).keyId, providerOrderId: row.provider_order_id, amountCents: row.amount_cents, currency: row.currency },
      live: true,
      note: `Pay ${price} to book the call. The team writes to you to set a time once it is paid.`,
    };
  }
  return { request: toRequest(row), payment: null, live: true, note: 'Your live call is paid. The team will write to you to set a time.' };
}

/**
 * One provider event for a live call, from the payment webhook (after its signature was checked) or the admin's replay.
 * Answers null when the event is not about a call, so the caller goes on to orders.
 */
export async function handleCallPayment(db: D1Database, parsed: { type: string; providerOrderId: string | null; providerPaymentId: string | null; amountCents: number | null }): Promise<string | null> {
  const r = parsed.providerOrderId
    ? await db.prepare('SELECT * FROM call_requests WHERE provider_order_id = ?').bind(parsed.providerOrderId).first<CallRow>()
    : parsed.providerPaymentId
      ? await db.prepare('SELECT * FROM call_requests WHERE provider_payment_id = ?').bind(parsed.providerPaymentId).first<CallRow>()
      : null;
  if (!r) return null;
  const now = nowIso();
  if (parsed.type === 'payment.captured' || parsed.type === 'order.paid') {
    if (r.status !== 'paying') return r.status === 'paid' || r.status === 'booked' || r.status === 'done' ? 'already paid' : `capture on a call that is ${r.status}`;
    if (parsed.amountCents !== null && parsed.amountCents !== r.amount_cents) return `amount mismatch: ${parsed.amountCents} vs ${r.amount_cents}`;
    // The status moves first, on its own, and only the event that moved it tells anyone: payment.captured and order.paid arrive together.
    const moved = await db.prepare("UPDATE call_requests SET status = 'paid', provider_payment_id = ?, paid_at = ?, updated_at = ? WHERE id = ? AND status = 'paying'").bind(parsed.providerPaymentId, now, now, r.id).run();
    if (moved.meta.changes !== 1) return 'already paid';
    await logEvent(db, 'call', r.id, 'payment.captured', { paymentId: parsed.providerPaymentId, cents: parsed.amountCents });
    const who = r.user_id ? await db.prepare('SELECT display_name, email FROM users WHERE id = ?').bind(r.user_id).first<{ display_name: string; email: string | null }>() : null;
    await tellAdmins(db, `${who ? nameOf(who) : 'Someone'} paid for a live call`, `${money(r.amount_cents, r.currency)}. Write to ${who?.email ?? 'them'} to set a time.`);
    if (r.user_id) await notify(db, r.user_id, 'order', 'Paid: your live call', 'The team will write to you to set a time.', '/tower#life-map');
    return 'paid';
  }
  if (parsed.type === 'payment.failed') return 'failed';
  if (parsed.type === 'refund.processed') {
    const moved = await db.prepare("UPDATE call_requests SET status = 'cancelled', updated_at = ? WHERE id = ? AND status IN ('paid', 'booked')").bind(now, r.id).run();
    if (moved.meta.changes !== 1) return 'already refunded';
    await logEvent(db, 'call', r.id, 'refund.processed');
    return 'refunded';
  }
  return `ignored ${parsed.type}`;
}
