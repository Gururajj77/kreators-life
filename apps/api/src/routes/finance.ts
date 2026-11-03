import { Hono } from 'hono';
import { DOC_COMMENT_MAX, monthShift, emptyInvoiceDoc, invoiceForClient, EXPENSE_CATEGORIES, INCOME_CATEGORIES, INVOICE_STATUSES, invoiceTotals, parseInvoiceDoc, type InvoiceDoc, type FinanceBudget, type FinanceDue, type FinanceGoal, type FinanceRecurring, type FinanceSplit, type FinanceSummary, type FinanceTransaction, type Invoice, type InvoiceItem, type Page } from '@kreators/shared';
import type { AppEnv } from '../env';
import { DATE_RE, dayFromDevice, nameOf, newId, notify, nowIso, num, oneOf, pageOf, paged, randomCode, str } from '../db';

/** Finance: a creator's money in and out, budgets and invoices. Nothing here touches points or payouts. */
export const finance = new Hono<AppEnv>();

interface TxRow { id: string; kind: 'income' | 'expense'; amount_cents: number; currency: string; category: string; counterparty: string; note: string; date: string; source: FinanceTransaction['source']; ref: string | null; splits_json: string; created_at: string }
function parseSplits(raw: string): FinanceSplit[] {
  try {
    const v = JSON.parse(raw || '[]') as unknown;
    return Array.isArray(v) ? v.filter((x): x is FinanceSplit => Boolean(x && typeof x === 'object' && 'name' in x && 'cents' in x)) : [];
  } catch {
    return [];
  }
}
function cleanSplits(v: unknown, max: number): FinanceSplit[] {
  if (!Array.isArray(v)) return [];
  const out: FinanceSplit[] = [];
  let sum = 0;
  for (const x of v.slice(0, 10)) {
    if (!x || typeof x !== 'object') continue;
    const o = x as Record<string, unknown>;
    const name = str(o.name, 80);
    const cents = Math.round(Number(o.cents));
    if (!name || !Number.isFinite(cents) || cents <= 0 || sum + cents > max) continue;
    sum += cents;
    out.push({ name, cents, status: o.status === 'paid' ? 'paid' : 'due' });
  }
  return out;
}
const toTx = (r: TxRow): FinanceTransaction => ({ id: r.id, kind: r.kind, amountCents: r.amount_cents, currency: r.currency, category: r.category, counterparty: r.counterparty ?? '', note: r.note, date: r.date, source: r.source, ref: r.ref, splits: parseSplits(r.splits_json), createdAt: r.created_at });

interface DueRow { id: string; direction: 'owe' | 'owed'; counterparty: string; amount_cents: number; currency: string; category: string; note: string; due_date: string | null; recurring: 'none' | 'monthly'; status: 'open' | 'settled'; settled_at: string | null; created_at: string }
const toDue = (r: DueRow): FinanceDue => ({ id: r.id, direction: r.direction, counterparty: r.counterparty, amountCents: r.amount_cents, currency: r.currency, category: r.category, note: r.note, dueDate: r.due_date, recurring: r.recurring, status: r.status, settledAt: r.settled_at, createdAt: r.created_at });
interface RecRow { id: string; kind: 'income' | 'expense'; amount_cents: number; currency: string; category: string; counterparty: string; note: string; day_of_month: number; next_date: string; active: number; created_at: string }
const toRec = (r: RecRow): FinanceRecurring => ({ id: r.id, kind: r.kind, amountCents: r.amount_cents, currency: r.currency, category: r.category, counterparty: r.counterparty, note: r.note, dayOfMonth: r.day_of_month, nextDate: r.next_date, active: r.active === 1, createdAt: r.created_at });
interface GoalRow { id: string; title: string; kind: 'save' | 'earn'; target_cents: number; saved_cents: number; start_date: string; deadline: string | null; created_at: string; earned: number | null }
const toGoal = (r: GoalRow): FinanceGoal => ({ id: r.id, title: r.title, kind: r.kind, targetCents: r.target_cents, progressCents: r.kind === 'earn' ? (r.earned ?? 0) : r.saved_cents, startDate: r.start_date, deadline: r.deadline, createdAt: r.created_at });

/** The same day next month, clamped to that month's length. */
export function nextMonthly(from: string, dayOfMonth: number): string {
  const [y, m] = from.split('-').map(Number);
  const first = new Date(Date.UTC(y ?? 2026, (m ?? 1), 1));
  const days = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return `${first.toISOString().slice(0, 7)}-${String(Math.min(dayOfMonth, days)).padStart(2, '0')}`;
}

/** Post every recurring entry whose date has come. Called by the cron. */
export async function runRecurring(db: D1Database, onlyUser?: string): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const due = onlyUser
    ? await db.prepare('SELECT * FROM finance_recurring WHERE active = 1 AND next_date <= ? AND user_id = ? LIMIT 200').bind(today, onlyUser).all<RecRow & { user_id: string }>()
    : await db.prepare('SELECT * FROM finance_recurring WHERE active = 1 AND next_date <= ? LIMIT 200').bind(today).all<RecRow & { user_id: string }>();
  let posted = 0;
  for (const r of due.results) {
    // The date moves first and only from the date that was read, so a second run at the same time posts nothing twice.
    const moved = await db.prepare('UPDATE finance_recurring SET next_date = ? WHERE id = ? AND next_date = ?').bind(nextMonthly(r.next_date, r.day_of_month), r.id, r.next_date).run();
    if (moved.meta.changes !== 1) continue;
    await db
      .prepare("INSERT INTO finance_transactions (id, user_id, kind, amount_cents, currency, category, counterparty, note, date, source, ref, splits_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'recurring', ?, '[]', ?)")
      .bind(newId(), r.user_id, r.kind, r.amount_cents, r.currency, r.category, r.counterparty, r.note || 'Monthly', r.next_date, r.id, nowIso())
      .run();
    posted += 1;
  }
  return posted;
}

export interface InvRow { id: string; user_id: string; owner_name: string; owner_handle: string | null; number: string; client_name: string; client_email: string; items_json: string; total_cents: number; currency: string; status: Invoice['status']; issue_date: string; due_date: string | null; note: string; token: string; paid_at: string | null; created_at: string; doc_json?: string; agency_client_id?: string | null; revised_at?: string | null }
export const INV_SELECT = 'SELECT i.*, u.display_name AS owner_name, u.handle AS owner_handle FROM invoices i JOIN users u ON u.id = i.user_id';
function parseItems(raw: string): InvoiceItem[] {
  try {
    const v = JSON.parse(raw || '[]') as unknown;
    return Array.isArray(v) ? v.filter((x): x is InvoiceItem => Boolean(x && typeof x === 'object' && 'description' in x)) : [];
  } catch {
    return [];
  }
}
function docOf(raw: string | undefined): InvoiceDoc {
  try {
    return parseInvoiceDoc(JSON.parse(raw || '{}'));
  } catch {
    return emptyInvoiceDoc();
  }
}
export const toInvoice = (r: InvRow): Invoice => ({ id: r.id, number: r.number, ownerName: nameOf({ display_name: r.owner_name }), ownerHandle: r.owner_handle, clientName: r.client_name, clientEmail: r.client_email, items: parseItems(r.items_json), totalCents: r.total_cents, currency: r.currency, status: r.status, issueDate: r.issue_date, dueDate: r.due_date, note: r.note, token: r.token, paidAt: r.paid_at, createdAt: r.created_at, doc: docOf(r.doc_json), agencyClientId: r.agency_client_id ?? null, revisedAt: r.revised_at ?? null });

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const monthOf = (v: string | undefined) => (v && MONTH_RE.test(v) ? v : new Date().toISOString().slice(0, 7));
const shiftMonth = monthShift;

finance.get('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const month = monthOf(c.req.query('month'));
  const from = shiftMonth(month, -5);
  // The month's entries and every due are paged (prefixes tx and du); the month's sums and what is owed are added up in SQL, so they cover every row, not one page.
  const txAsk = pageOf(c, 'tx');
  const duAsk = pageOf(c, 'du');
  const today = new Date().toISOString().slice(0, 10);
  const [tx, byMonth, budgets, invoices, points, totals, dues, recurring, goals, monthCats, owedSums, agencyOwed] = await Promise.all([
    db.prepare('SELECT * FROM finance_transactions WHERE user_id = ? AND date LIKE ? ORDER BY date DESC, created_at DESC LIMIT ? OFFSET ?').bind(user.id, `${month}%`, txAsk.limit, txAsk.offset).all<TxRow>(),
    db.prepare("SELECT substr(date, 1, 7) AS m, kind, SUM(amount_cents) AS cents FROM finance_transactions WHERE user_id = ? AND substr(date, 1, 7) >= ? AND substr(date, 1, 7) <= ? GROUP BY m, kind").bind(user.id, from, month).all<{ m: string; kind: 'income' | 'expense'; cents: number }>(),
    db.prepare('SELECT category, monthly_cents FROM finance_budgets WHERE user_id = ?').bind(user.id).all<{ category: string; monthly_cents: number }>(),
    db.prepare(`${INV_SELECT} WHERE i.user_id = ? ORDER BY i.created_at DESC LIMIT 100`).bind(user.id).all<InvRow>(),
    db.prepare("SELECT COALESCE(SUM(amount), 0) AS n FROM points_ledger WHERE user_id = ? AND amount > 0 AND reason IN ('sale','affiliate','bounty') AND created_at LIKE ?").bind(user.id, `${month}%`).first<{ n: number }>(),
    db
      .prepare(
        `SELECT
          (SELECT COALESCE(SUM(amount_cents), 0) FROM finance_transactions WHERE user_id = ?1 AND kind = 'income') AS income,
          (SELECT COALESCE(SUM(amount_cents), 0) FROM finance_transactions WHERE user_id = ?1 AND kind = 'expense') AS expense,
          (SELECT COALESCE(SUM(amount), 0) FROM points_ledger WHERE user_id = ?1 AND amount > 0 AND reason IN ('sale','affiliate','bounty')) AS points`,
      )
      .bind(user.id)
      .first<{ income: number; expense: number; points: number }>(),
    db.prepare("SELECT * FROM finance_dues WHERE user_id = ? ORDER BY CASE status WHEN 'open' THEN 0 ELSE 1 END, due_date IS NULL, due_date, created_at LIMIT ? OFFSET ?").bind(user.id, duAsk.limit, duAsk.offset).all<DueRow>(),
    db.prepare('SELECT * FROM finance_recurring WHERE user_id = ? ORDER BY active DESC, next_date').bind(user.id).all<RecRow>(),
    db
      .prepare(
        `SELECT g.*, (SELECT COALESCE(SUM(amount_cents), 0) FROM finance_transactions t WHERE t.user_id = g.user_id AND t.kind = 'income' AND t.date >= g.start_date AND (g.deadline IS NULL OR t.date <= g.deadline)) AS earned
         FROM finance_goals g WHERE g.user_id = ? ORDER BY g.created_at DESC`,
      )
      .bind(user.id)
      .all<GoalRow>(),
    db.prepare('SELECT kind, category, SUM(amount_cents) AS cents, MIN(currency) AS currency FROM finance_transactions WHERE user_id = ? AND date LIKE ? GROUP BY kind, category').bind(user.id, `${month}%`).all<{ kind: 'income' | 'expense'; category: string; cents: number; currency: string }>(),
    db
      .prepare("SELECT COALESCE(SUM(CASE WHEN direction = 'owed' THEN amount_cents END), 0) AS owed, COALESCE(SUM(CASE WHEN direction = 'owe' THEN amount_cents END), 0) AS owe FROM finance_dues WHERE user_id = ? AND status = 'open'")
      .bind(user.id)
      .first<{ owed: number; owe: number }>(),
    // Agency invoices sent and not paid: owed to the person, summed in SQL by currency so a page limit never hides one.
    db
      .prepare(
        "SELECT currency, COALESCE(SUM(total_cents), 0) AS cents, COUNT(*) AS n, SUM(CASE WHEN due_date IS NOT NULL AND due_date < ? THEN 1 ELSE 0 END) AS overdue FROM invoices WHERE user_id = ? AND status = 'sent' AND agency_client_id IS NOT NULL GROUP BY currency ORDER BY cents DESC",
      )
      .bind(today, user.id)
      .all<{ currency: string; cents: number; n: number; overdue: number }>(),
  ]);
  const txPaged = paged(tx.results, txAsk);
  const duePaged = paged(dues.results, duAsk);
  const list = txPaged.items.map(toTx);
  const cat = new Map<string, { category: string; kind: 'income' | 'expense'; cents: number }>();
  for (const r of monthCats.results) cat.set(`${r.kind}:${r.category}`, { category: r.category, kind: r.kind, cents: r.cents });
  const incomeCents = monthCats.results.filter((r) => r.kind === 'income').reduce((a, r) => a + r.cents, 0);
  const expenseCents = monthCats.results.filter((r) => r.kind === 'expense').reduce((a, r) => a + r.cents, 0);
  const months: FinanceSummary['months'] = [];
  for (let i = 5; i >= 0; i -= 1) {
    const m = shiftMonth(month, -i);
    months.push({ month: m, incomeCents: byMonth.results.find((r) => r.m === m && r.kind === 'income')?.cents ?? 0, expenseCents: byMonth.results.find((r) => r.m === m && r.kind === 'expense')?.cents ?? 0 });
  }
  const budgetList: FinanceBudget[] = budgets.results.map((b) => ({ category: b.category, monthlyCents: b.monthly_cents, spentCents: cat.get(`expense:${b.category}`)?.cents ?? 0 }));
  const inv = invoices.results.map(toInvoice);
  const currency = list[0]?.currency ?? monthCats.results[0]?.currency ?? inv[0]?.currency ?? 'INR';
  const summary: FinanceSummary & { txPage: Page; duePage: Page } = {
    month,
    currency,
    incomeCents,
    expenseCents,
    netCents: incomeCents - expenseCents,
    platformPoints: points?.n ?? 0,
    byCategory: [...cat.values()].sort((a, b) => b.cents - a.cents),
    months,
    budgets: budgetList,
    openInvoicesCents: inv.filter((i) => i.status === 'sent').reduce((a, i) => a + i.totalCents, 0),
    overdueInvoices: inv.filter((i) => i.status === 'sent' && i.dueDate && i.dueDate < today).length,
    transactions: list,
    invoices: inv,
    totals: { incomeCents: totals?.income ?? 0, expenseCents: totals?.expense ?? 0, netCents: (totals?.income ?? 0) - (totals?.expense ?? 0), platformPoints: totals?.points ?? 0 },
    dues: duePaged.items.map(toDue),
    owedToMeCents: owedSums?.owed ?? 0,
    iOweCents: owedSums?.owe ?? 0,
    owedToYou: agencyOwed.results.map((r) => ({ currency: r.currency, cents: r.cents, count: r.n, overdue: r.overdue ?? 0 })),
    recurring: recurring.results.map(toRec),
    goals: goals.results.map(toGoal),
    txPage: txPaged.page,
    duePage: duePaged.page,
  };
  return c.json(summary);
});

finance.post('/transactions', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const kind = body.kind === 'expense' ? 'expense' : 'income';
  const raw = Math.round(Number(body.amountCents));
  if (!Number.isFinite(raw) || raw <= 0) return c.json({ error: 'an amount above zero' }, 400);
  const amount = Math.min(raw, 1_000_000_000);
  const categories = kind === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const category = oneOf(body.category, categories, categories[categories.length - 1] as string);
  const date = typeof body.date === 'string' && DATE_RE.test(body.date) ? body.date : new Date().toISOString().slice(0, 10);
  const id = newId();
  await db
    .prepare("INSERT INTO finance_transactions (id, user_id, kind, amount_cents, currency, category, counterparty, note, date, source, ref, splits_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', NULL, ?, ?)")
    .bind(id, user.id, kind, amount, str(body.currency, 3, 'INR').toUpperCase() || 'INR', category, str(body.counterparty, 80), str(body.note, 300), date, JSON.stringify(cleanSplits(body.splits, amount)), nowIso())
    .run();
  const row = await db.prepare('SELECT * FROM finance_transactions WHERE id = ?').bind(id).first<TxRow>();
  return c.json({ transaction: row ? toTx(row) : null }, 201);
});

// Replace the splits on a transaction, for example to mark an editor's share paid.
finance.patch('/transactions/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const prev = await db.prepare('SELECT * FROM finance_transactions WHERE id = ? AND user_id = ?').bind(c.req.param('id'), user.id).first<TxRow>();
  if (!prev) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  await db
    .prepare('UPDATE finance_transactions SET counterparty = ?, note = ?, splits_json = ? WHERE id = ?')
    .bind(str(body.counterparty, 80, prev.counterparty), str(body.note, 300, prev.note), 'splits' in body ? JSON.stringify(cleanSplits(body.splits, prev.amount_cents)) : prev.splits_json, prev.id)
    .run();
  const row = await db.prepare('SELECT * FROM finance_transactions WHERE id = ?').bind(prev.id).first<TxRow>();
  return c.json({ transaction: row ? toTx(row) : null });
});

// ---- dues: who owes whom
finance.post('/dues', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const amount = Math.round(Number(body.amountCents));
  const counterparty = str(body.counterparty, 80);
  if (!counterparty || !Number.isFinite(amount) || amount <= 0) return c.json({ error: 'who, and how much' }, 400);
  const direction = body.direction === 'owe' ? 'owe' : 'owed';
  const cats = direction === 'owe' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  const id = newId();
  await db
    .prepare("INSERT INTO finance_dues (id, user_id, direction, counterparty, amount_cents, currency, category, note, due_date, recurring, status, settled_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', NULL, ?)")
    .bind(id, user.id, direction, counterparty, Math.min(amount, 1_000_000_000), str(body.currency, 3, 'INR').toUpperCase() || 'INR', oneOf(body.category, cats, cats[cats.length - 1] as string), str(body.note, 300), typeof body.dueDate === 'string' && DATE_RE.test(body.dueDate) ? body.dueDate : null, body.recurring === 'monthly' ? 'monthly' : 'none', nowIso())
    .run();
  const row = await db.prepare('SELECT * FROM finance_dues WHERE id = ?').bind(id).first<DueRow>();
  return c.json({ due: row ? toDue(row) : null }, 201);
});

// Settling books the money and, for a monthly due, lines up next month's.
finance.post('/dues/:id/settle', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const d = await db.prepare("SELECT * FROM finance_dues WHERE id = ? AND user_id = ? AND status = 'open'").bind(c.req.param('id'), user.id).first<DueRow>();
  if (!d) return c.json({ error: 'not found, or already settled' }, 404);
  const now = nowIso();
  // The person's own day, from the device (?day=), so a due settled late in the evening is booked on their day, not the server's.
  const today = dayFromDevice(c.req.query('day'));
  // The status moves first and only from open: two taps at once settle (and book the money) once.
  const moved = await db.prepare("UPDATE finance_dues SET status = 'settled', settled_at = ? WHERE id = ? AND user_id = ? AND status = 'open'").bind(now, d.id, user.id).run();
  if (moved.meta.changes !== 1) return c.json({ error: 'not found, or already settled' }, 409);
  const stmts = [
    db
      .prepare("INSERT INTO finance_transactions (id, user_id, kind, amount_cents, currency, category, counterparty, note, date, source, ref, splits_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'due', ?, '[]', ?)")
      .bind(newId(), user.id, d.direction === 'owe' ? 'expense' : 'income', d.amount_cents, d.currency, d.category || (d.direction === 'owe' ? 'Other expense' : 'Other income'), d.counterparty, d.note || (d.direction === 'owe' ? 'Paid what was due' : 'Received what was due'), today, d.id, now),
  ];
  if (d.recurring === 'monthly') {
    const base = d.due_date ?? today;
    stmts.push(
      db
        .prepare("INSERT INTO finance_dues (id, user_id, direction, counterparty, amount_cents, currency, category, note, due_date, recurring, status, settled_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'monthly', 'open', NULL, ?)")
        .bind(newId(), user.id, d.direction, d.counterparty, d.amount_cents, d.currency, d.category, d.note, nextMonthly(base, Number(base.slice(8, 10))), now),
    );
  }
  await db.batch(stmts);
  return c.json({ ok: true });
});

finance.delete('/dues/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM finance_dues WHERE id = ? AND user_id = ?').bind(c.req.param('id'), c.get('user').id).run();
  return c.json({ ok: true });
});

// ---- recurring entries
finance.post('/recurring', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const amount = Math.round(Number(body.amountCents));
  if (!Number.isFinite(amount) || amount <= 0) return c.json({ error: 'an amount above zero' }, 400);
  const kind = body.kind === 'expense' ? 'expense' : 'income';
  const cats = kind === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const day = Math.max(1, Math.min(28, Math.round(Number(body.dayOfMonth)) || 1));
  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = `${today.slice(0, 7)}-${String(day).padStart(2, '0')}`;
  const next = thisMonth >= today ? thisMonth : nextMonthly(thisMonth, day);
  const id = newId();
  await db
    .prepare('INSERT INTO finance_recurring (id, user_id, kind, amount_cents, currency, category, counterparty, note, day_of_month, next_date, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)')
    .bind(id, user.id, kind, Math.min(amount, 1_000_000_000), str(body.currency, 3, 'INR').toUpperCase() || 'INR', oneOf(body.category, cats, cats[cats.length - 1] as string), str(body.counterparty, 80), str(body.note, 300), day, next, nowIso())
    .run();
  const row = await db.prepare('SELECT * FROM finance_recurring WHERE id = ?').bind(id).first<RecRow>();
  return c.json({ recurring: row ? toRec(row) : null }, 201);
});

finance.patch('/recurring/:id', async (c) => {
  const body = await c.req.json<{ active?: boolean }>().catch(() => ({}) as { active?: boolean });
  await c.env.DB.prepare('UPDATE finance_recurring SET active = ? WHERE id = ? AND user_id = ?').bind(body.active === false ? 0 : 1, c.req.param('id'), c.get('user').id).run();
  return c.json({ ok: true });
});

finance.delete('/recurring/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM finance_recurring WHERE id = ? AND user_id = ?').bind(c.req.param('id'), c.get('user').id).run();
  return c.json({ ok: true });
});

// Run what is due now, so a person never waits for the clock.
finance.post('/recurring/run', async (c) => {
  const n = await runRecurring(c.env.DB, c.get('user').id);
  return c.json({ posted: n });
});

// ---- goals
finance.post('/goals', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const title = str(body.title, 120);
  const target = Math.round(Number(body.targetCents));
  if (!title || !Number.isFinite(target) || target <= 0) return c.json({ error: 'a name and a target' }, 400);
  const id = newId();
  await db
    .prepare('INSERT INTO finance_goals (id, user_id, title, kind, target_cents, saved_cents, start_date, deadline, created_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)')
    .bind(id, user.id, title, body.kind === 'earn' ? 'earn' : 'save', Math.min(target, 1_000_000_000_000), new Date().toISOString().slice(0, 10), typeof body.deadline === 'string' && DATE_RE.test(body.deadline) ? body.deadline : null, nowIso())
    .run();
  return c.json({ ok: true, id }, 201);
});

finance.post('/goals/:id/add', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<{ cents?: number }>().catch(() => ({}) as { cents?: number });
  const cents = Math.round(Number(body.cents));
  if (!Number.isFinite(cents) || cents === 0) return c.json({ error: 'an amount' }, 400);
  const res = await db.prepare("UPDATE finance_goals SET saved_cents = MAX(0, saved_cents + ?) WHERE id = ? AND user_id = ? AND kind = 'save'").bind(cents, c.req.param('id'), user.id).run();
  if (res.meta.changes === 0) return c.json({ error: 'only saving goals take contributions' }, 400);
  return c.json({ ok: true });
});

finance.delete('/goals/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM finance_goals WHERE id = ? AND user_id = ?').bind(c.req.param('id'), c.get('user').id).run();
  return c.json({ ok: true });
});

finance.delete('/transactions/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM finance_transactions WHERE id = ? AND user_id = ?').bind(c.req.param('id'), c.get('user').id).run();
  return c.json({ ok: true });
});

finance.put('/budgets', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<{ budgets?: unknown }>().catch(() => ({}) as { budgets?: unknown });
  const list = Array.isArray(body.budgets) ? body.budgets : [];
  const stmts = [db.prepare('DELETE FROM finance_budgets WHERE user_id = ?').bind(user.id)];
  for (const b of list) {
    if (!b || typeof b !== 'object') continue;
    const o = b as Record<string, unknown>;
    const category = oneOf(o.category, EXPENSE_CATEGORIES, 'Other expense');
    const cents = num(o.monthlyCents, 0, 0, 1_000_000_000) ?? 0;
    if (cents > 0) stmts.push(db.prepare('INSERT OR REPLACE INTO finance_budgets (user_id, category, monthly_cents) VALUES (?, ?, ?)').bind(user.id, category, cents));
  }
  await db.batch(stmts);
  return c.json({ ok: true });
});

// ---- invoices
interface NewInvoice { clientName: string; clientEmail: string; items: InvoiceItem[]; dueDate: string | null; note: string; currency: string; agencyClientId?: string | null; doc?: InvoiceDoc; prefix?: string; number?: string; issueDate?: string }

/** The number that follows another in its own series: SSBB-001 becomes SSBB-002, INV-2026-009 becomes INV-2026-010. Never one already taken. */
export async function nextNumberAfter(db: D1Database, userId: string, number: string): Promise<string> {
  const m = /^(.*?)(\d+)$/.exec(number);
  if (!m) return nextNumber(db, userId, '');
  const stem = m[1] ?? '';
  const width = (m[2] ?? '').length;
  let n = Number(m[2]) + 1;
  for (;;) {
    const candidate = `${stem}${String(n).padStart(width, '0')}`;
    const taken = await db.prepare('SELECT 1 AS x FROM invoices WHERE user_id = ? AND number = ?').bind(userId, candidate).first();
    if (!taken) return candidate;
    n += 1;
  }
}

/** The next number: INV-2026-001 by default, or PREFIX-001 when the person set a prefix. Never one that is already taken. */
export async function nextNumber(db: D1Database, userId: string, prefix: string): Promise<string> {
  const stem = prefix ? `${prefix}-` : `INV-${new Date().getFullYear()}-`;
  const count = await db.prepare('SELECT COUNT(*) AS n FROM invoices WHERE user_id = ? AND number LIKE ?').bind(userId, `${stem}%`).first<{ n: number }>();
  let n = (count?.n ?? 0) + 1;
  for (;;) {
    const number = `${stem}${String(n).padStart(3, '0')}`;
    const taken = await db.prepare('SELECT 1 AS x FROM invoices WHERE user_id = ? AND number = ?').bind(userId, number).first();
    if (!taken) return number;
    n += 1;
  }
}

/** The cents an invoice comes to: the designed sum when it has a design, else the plain sum of its lines. */
const totalOf = (items: InvoiceItem[], doc: InvoiceDoc | undefined) => (doc ? invoiceTotals(items, doc).total : items.reduce((a, i) => a + i.quantity * i.unitCents, 0));

/** Makes a draft invoice with the next number. Finance and Agency both use it. */
export async function createInvoice(db: D1Database, userId: string, input: NewInvoice): Promise<Invoice | null> {
  const number = input.number ?? (await nextNumber(db, userId, input.prefix ?? ''));
  const id = newId();
  await db
    .prepare("INSERT INTO invoices (id, user_id, number, client_name, client_email, items_json, total_cents, currency, status, issue_date, due_date, note, token, paid_at, created_at, agency_client_id, doc_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, NULL, ?, ?, ?)")
    .bind(id, userId, number, input.clientName, input.clientEmail, JSON.stringify(input.items), totalOf(input.items, input.doc), input.currency, input.issueDate ?? new Date().toISOString().slice(0, 10), input.dueDate, input.note, randomCode(12), nowIso(), input.agencyClientId ?? null, JSON.stringify(input.doc ?? {}))
    .run();
  const row = await db.prepare(`${INV_SELECT} WHERE i.id = ?`).bind(id).first<InvRow>();
  return row ? toInvoice(row) : null;
}

/** Changes a draft or a sent invoice: its lines, design, dates and note. A sent one is marked revised, so the client's page says so. A paid or void one cannot change. Null when it is not editable. */
export async function updateDraftInvoice(db: D1Database, userId: string, invoiceId: string, input: { clientName: string; clientEmail: string; items: InvoiceItem[]; issueDate: string | null; dueDate: string | null; note: string; doc: InvoiceDoc; number?: string }): Promise<Invoice | null> {
  const res = await db
    .prepare("UPDATE invoices SET number = COALESCE(?, number), client_name = ?, client_email = ?, items_json = ?, total_cents = ?, issue_date = COALESCE(?, issue_date), due_date = ?, note = ?, doc_json = ?, revised_at = CASE WHEN status = 'sent' THEN ? ELSE revised_at END WHERE id = ? AND user_id = ? AND status IN ('draft', 'sent')")
    .bind(input.number ?? null, input.clientName, input.clientEmail, JSON.stringify(input.items), totalOf(input.items, input.doc), input.issueDate, input.dueDate, input.note, JSON.stringify(input.doc), nowIso(), invoiceId, userId)
    .run();
  if (!res.meta.changes) return null;
  const row = await db.prepare(`${INV_SELECT} WHERE i.id = ?`).bind(invoiceId).first<InvRow>();
  return row ? toInvoice(row) : null;
}

/** Changes an invoice's status. Marking one paid books the income; taking a paid one back out removes it. Null when it is not the person's. */
export async function setInvoiceStatus(db: D1Database, userId: string, invoiceId: string, wanted: unknown): Promise<Invoice | null> {
  const prev = await db.prepare(`${INV_SELECT} WHERE i.id = ? AND i.user_id = ?`).bind(invoiceId, userId).first<InvRow>();
  if (!prev) return null;
  const status = oneOf(wanted, INVOICE_STATUSES, prev.status);
  const now = nowIso();
  if (status === prev.status) return toInvoice(prev);
  // The status moves first, guarded on the one that was read, and the books change only when this call moved it, so two taps
  // on Mark paid at once book the income once.
  const moved = await db
    .prepare("UPDATE invoices SET status = ?, paid_at = CASE WHEN ? = 'paid' THEN COALESCE(paid_at, ?) ELSE paid_at END WHERE id = ? AND user_id = ? AND status = ?")
    .bind(status, status, now, prev.id, userId, prev.status)
    .run();
  if (moved.meta.changes !== 1) {
    const now2 = await db.prepare(`${INV_SELECT} WHERE i.id = ?`).bind(prev.id).first<InvRow>();
    return now2 ? toInvoice(now2) : null;
  }
  const stmts: D1PreparedStatement[] = [];
  if (status === 'paid' && prev.status !== 'paid') {
    stmts.push(
      db
        // OR IGNORE: migration 0067's unique index on (user_id, source, ref) for invoices is the last guard, so a booking that is already there is a no-op, never a 500.
        .prepare("INSERT OR IGNORE INTO finance_transactions (id, user_id, kind, amount_cents, currency, category, note, date, source, ref, created_at) VALUES (?, ?, 'income', ?, ?, 'Brand deal', ?, ?, 'invoice', ?, ?)")
        .bind(newId(), userId, prev.total_cents, prev.currency, `Invoice ${prev.number}, ${prev.client_name}`, now.slice(0, 10), prev.id, now),
    );
  }
  if (status !== 'paid' && prev.status === 'paid') stmts.push(db.prepare("DELETE FROM finance_transactions WHERE user_id = ? AND source = 'invoice' AND ref = ?").bind(userId, prev.id));
  if (stmts.length) await db.batch(stmts);
  const row = await db.prepare(`${INV_SELECT} WHERE i.id = ?`).bind(prev.id).first<InvRow>();
  return row ? toInvoice(row) : null;
}

finance.post('/invoices', async (c) => {
  const user = c.get('user');
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const clientName = str(body.clientName, 120);
  if (!clientName) return c.json({ error: 'who is this for?' }, 400);
  const items: InvoiceItem[] = (Array.isArray(body.items) ? body.items : [])
    .map((x) => (x && typeof x === 'object' ? (x as Record<string, unknown>) : {}))
    .map((x) => ({ description: str(x.description, 200), quantity: num(x.quantity, 1, 1, 10000) ?? 1, unitCents: num(x.unitCents, 0, 0, 1_000_000_000) ?? 0 }))
    .filter((x) => x.description)
    .slice(0, 30);
  if (items.length === 0) return c.json({ error: 'at least one line' }, 400);
  const dueDate = typeof body.dueDate === 'string' && DATE_RE.test(body.dueDate) ? body.dueDate : null;
  const invoice = await createInvoice(c.env.DB, user.id, { clientName, clientEmail: str(body.clientEmail, 120), items, dueDate, note: str(body.note, 500), currency: str(body.currency, 3, 'INR').toUpperCase() || 'INR' });
  return c.json({ invoice }, 201);
});

// Marking an invoice paid books the income; voiding a paid one takes it back out.
finance.patch('/invoices/:id', async (c) => {
  const body = await c.req.json<{ status?: string }>().catch(() => ({}) as { status?: string });
  const invoice = await setInvoiceStatus(c.env.DB, c.get('user').id, c.req.param('id'), body.status);
  return invoice ? c.json({ invoice }) : c.json({ error: 'not found' }, 404);
});

finance.delete('/invoices/:id', async (c) => {
  const res = await c.env.DB.prepare("DELETE FROM invoices WHERE id = ? AND user_id = ? AND status = 'draft'").bind(c.req.param('id'), c.get('user').id).run();
  if (res.meta.changes === 0) return c.json({ error: 'only drafts can be deleted; void the others' }, 400);
  return c.json({ ok: true });
});

/** Public: the client opens /i/<token>. Mounted at /public/invoices. */
export const publicInvoices = new Hono<AppEnv>();
publicInvoices.get('/:token', async (c) => {
  const db = c.env.DB;
  const row = await db.prepare(`${INV_SELECT} WHERE i.token = ? AND i.status != 'draft'`).bind(c.req.param('token').toUpperCase()).first<InvRow>();
  if (!row) return c.json({ error: 'no invoice at this link' }, 404);
  const full = toInvoice(row);
  // An invoice made in Agency carries the owner's switches: what is off is removed here, before it leaves the server.
  if (!row.agency_client_id) return c.json({ invoice: full, canComment: false, canDownload: true, comments: [] });
  const comments = full.doc.show.comments
    ? await db.prepare("SELECT id, author, body, created_at FROM agency_doc_comments WHERE doc_type = 'invoice' AND doc_id = ? ORDER BY created_at LIMIT 100").bind(row.id).all<{ id: string; author: 'me' | 'client'; body: string; created_at: string }>()
    : { results: [] as { id: string; author: 'me' | 'client'; body: string; created_at: string }[] };
  return c.json({
    invoice: invoiceForClient(full),
    canComment: full.doc.show.comments && full.status !== 'void',
    canDownload: full.doc.show.download,
    comments: comments.results.map((r) => ({ id: r.id, author: r.author, body: r.body, createdAt: r.created_at })),
  });
});

// The client asks for a change. It is a note on the invoice, and the person is told; the invoice itself does not change.
publicInvoices.post('/:token/comments', async (c) => {
  const db = c.env.DB;
  const row = await db.prepare(`${INV_SELECT} WHERE i.token = ? AND i.status IN ('sent', 'paid')`).bind(c.req.param('token').toUpperCase()).first<InvRow>();
  if (!row || !row.agency_client_id) return c.json({ error: 'no invoice at this link' }, 404);
  const inv = toInvoice(row);
  if (!inv.doc.show.comments) return c.json({ error: 'comments are switched off on this invoice' }, 403);
  const body = await c.req.json<{ body?: string }>().catch(() => ({}) as { body?: string });
  const text = str(body.body, DOC_COMMENT_MAX);
  if (!text) return c.json({ error: 'write something' }, 400);
  await db.prepare("INSERT INTO agency_doc_comments (id, user_id, doc_type, doc_id, author, body, created_at) VALUES (?, ?, 'invoice', ?, 'client', ?, ?)").bind(newId(), row.user_id, row.id, text, nowIso()).run();
  await notify(db, row.user_id, 'agency', `${row.client_name} wrote on invoice ${row.number}`, text.slice(0, 160), `/agency/invoices/${row.id}`);
  return c.json({ ok: true }, 201);
});
