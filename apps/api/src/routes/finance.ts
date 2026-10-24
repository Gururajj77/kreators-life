import { Hono } from 'hono';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, INVOICE_STATUSES, type FinanceBudget, type FinanceDue, type FinanceGoal, type FinanceRecurring, type FinanceSplit, type FinanceSummary, type FinanceTransaction, type Invoice, type InvoiceItem } from '@kreators/shared';
import type { AppEnv } from '../env';
import { DATE_RE, nameOf, newId, nowIso, num, oneOf, randomCode, str } from '../db';

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
export async function runRecurring(db: D1Database): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const due = await db.prepare('SELECT * FROM finance_recurring WHERE active = 1 AND next_date <= ? LIMIT 200').bind(today).all<RecRow & { user_id: string }>();
  for (const r of due.results) {
    await db.batch([
      db
        .prepare("INSERT INTO finance_transactions (id, user_id, kind, amount_cents, currency, category, counterparty, note, date, source, ref, splits_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'recurring', ?, '[]', ?)")
        .bind(newId(), r.user_id, r.kind, r.amount_cents, r.currency, r.category, r.counterparty, r.note || 'Monthly', r.next_date, r.id, nowIso()),
      db.prepare('UPDATE finance_recurring SET next_date = ? WHERE id = ?').bind(nextMonthly(r.next_date, r.day_of_month), r.id),
    ]);
  }
  return due.results.length;
}

interface InvRow { id: string; user_id: string; owner_name: string; owner_handle: string | null; number: string; client_name: string; client_email: string; items_json: string; total_cents: number; currency: string; status: Invoice['status']; issue_date: string; due_date: string | null; note: string; token: string; paid_at: string | null; created_at: string }
const INV_SELECT = 'SELECT i.*, u.display_name AS owner_name, u.handle AS owner_handle FROM invoices i JOIN users u ON u.id = i.user_id';
function parseItems(raw: string): InvoiceItem[] {
  try {
    const v = JSON.parse(raw || '[]') as unknown;
    return Array.isArray(v) ? v.filter((x): x is InvoiceItem => Boolean(x && typeof x === 'object' && 'description' in x)) : [];
  } catch {
    return [];
  }
}
export const toInvoice = (r: InvRow): Invoice => ({ id: r.id, number: r.number, ownerName: nameOf({ display_name: r.owner_name }), ownerHandle: r.owner_handle, clientName: r.client_name, clientEmail: r.client_email, items: parseItems(r.items_json), totalCents: r.total_cents, currency: r.currency, status: r.status, issueDate: r.issue_date, dueDate: r.due_date, note: r.note, token: r.token, paidAt: r.paid_at, createdAt: r.created_at });

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const monthOf = (v: string | undefined) => (v && MONTH_RE.test(v) ? v : new Date().toISOString().slice(0, 7));
function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1 + by, 1));
  return d.toISOString().slice(0, 7);
}

finance.get('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const month = monthOf(c.req.query('month'));
  const from = shiftMonth(month, -5);
  const [tx, byMonth, budgets, invoices, points, totals, dues, recurring, goals] = await Promise.all([
    db.prepare('SELECT * FROM finance_transactions WHERE user_id = ? AND date LIKE ? ORDER BY date DESC, created_at DESC LIMIT 300').bind(user.id, `${month}%`).all<TxRow>(),
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
    db.prepare("SELECT * FROM finance_dues WHERE user_id = ? ORDER BY CASE status WHEN 'open' THEN 0 ELSE 1 END, due_date IS NULL, due_date LIMIT 200").bind(user.id).all<DueRow>(),
    db.prepare('SELECT * FROM finance_recurring WHERE user_id = ? ORDER BY active DESC, next_date').bind(user.id).all<RecRow>(),
    db
      .prepare(
        `SELECT g.*, (SELECT COALESCE(SUM(amount_cents), 0) FROM finance_transactions t WHERE t.user_id = g.user_id AND t.kind = 'income' AND t.date >= g.start_date AND (g.deadline IS NULL OR t.date <= g.deadline)) AS earned
         FROM finance_goals g WHERE g.user_id = ? ORDER BY g.created_at DESC`,
      )
      .bind(user.id)
      .all<GoalRow>(),
  ]);
  const list = tx.results.map(toTx);
  const incomeCents = list.filter((t) => t.kind === 'income').reduce((a, t) => a + t.amountCents, 0);
  const expenseCents = list.filter((t) => t.kind === 'expense').reduce((a, t) => a + t.amountCents, 0);
  const cat = new Map<string, { category: string; kind: 'income' | 'expense'; cents: number }>();
  for (const t of list) {
    const k = `${t.kind}:${t.category}`;
    cat.set(k, { category: t.category, kind: t.kind, cents: (cat.get(k)?.cents ?? 0) + t.amountCents });
  }
  const months: FinanceSummary['months'] = [];
  for (let i = 5; i >= 0; i -= 1) {
    const m = shiftMonth(month, -i);
    months.push({ month: m, incomeCents: byMonth.results.find((r) => r.m === m && r.kind === 'income')?.cents ?? 0, expenseCents: byMonth.results.find((r) => r.m === m && r.kind === 'expense')?.cents ?? 0 });
  }
  const budgetList: FinanceBudget[] = budgets.results.map((b) => ({ category: b.category, monthlyCents: b.monthly_cents, spentCents: cat.get(`expense:${b.category}`)?.cents ?? 0 }));
  const inv = invoices.results.map(toInvoice);
  const today = new Date().toISOString().slice(0, 10);
  const currency = list[0]?.currency ?? inv[0]?.currency ?? 'INR';
  const summary: FinanceSummary = {
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
    dues: dues.results.map(toDue),
    owedToMeCents: dues.results.filter((d) => d.status === 'open' && d.direction === 'owed').reduce((a, d) => a + d.amount_cents, 0),
    iOweCents: dues.results.filter((d) => d.status === 'open' && d.direction === 'owe').reduce((a, d) => a + d.amount_cents, 0),
    recurring: recurring.results.map(toRec),
    goals: goals.results.map(toGoal),
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
  const today = now.slice(0, 10);
  const stmts = [
    db.prepare("UPDATE finance_dues SET status = 'settled', settled_at = ? WHERE id = ?").bind(now, d.id),
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
  const n = await runRecurring(c.env.DB);
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
finance.post('/invoices', async (c) => {
  const db = c.env.DB;
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
  const total = items.reduce((a, i) => a + i.quantity * i.unitCents, 0);
  const year = new Date().getFullYear();
  const count = await db.prepare('SELECT COUNT(*) AS n FROM invoices WHERE user_id = ? AND number LIKE ?').bind(user.id, `INV-${year}-%`).first<{ n: number }>();
  const number = `INV-${year}-${String((count?.n ?? 0) + 1).padStart(3, '0')}`;
  const id = newId();
  const dueDate = typeof body.dueDate === 'string' && DATE_RE.test(body.dueDate) ? body.dueDate : null;
  await db
    .prepare("INSERT INTO invoices (id, user_id, number, client_name, client_email, items_json, total_cents, currency, status, issue_date, due_date, note, token, paid_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, NULL, ?)")
    .bind(id, user.id, number, clientName, str(body.clientEmail, 120), JSON.stringify(items), total, str(body.currency, 3, 'INR').toUpperCase() || 'INR', new Date().toISOString().slice(0, 10), dueDate, str(body.note, 500), randomCode(12), nowIso())
    .run();
  const row = await db.prepare(`${INV_SELECT} WHERE i.id = ?`).bind(id).first<InvRow>();
  return c.json({ invoice: row ? toInvoice(row) : null }, 201);
});

// Marking an invoice paid books the income; voiding a paid one takes it back out.
finance.patch('/invoices/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const prev = await db.prepare(`${INV_SELECT} WHERE i.id = ? AND i.user_id = ?`).bind(c.req.param('id'), user.id).first<InvRow>();
  if (!prev) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<{ status?: string }>().catch(() => ({}) as { status?: string });
  const status = oneOf(body.status, INVOICE_STATUSES, prev.status);
  const now = nowIso();
  const stmts = [db.prepare('UPDATE invoices SET status = ?, paid_at = CASE WHEN ? = \'paid\' THEN COALESCE(paid_at, ?) ELSE paid_at END WHERE id = ?').bind(status, status, now, prev.id)];
  if (status === 'paid' && prev.status !== 'paid') {
    stmts.push(
      db
        .prepare("INSERT INTO finance_transactions (id, user_id, kind, amount_cents, currency, category, note, date, source, ref, created_at) VALUES (?, ?, 'income', ?, ?, 'Brand deal', ?, ?, 'invoice', ?, ?)")
        .bind(newId(), user.id, prev.total_cents, prev.currency, `Invoice ${prev.number}, ${prev.client_name}`, now.slice(0, 10), prev.id, now),
    );
  }
  if (status !== 'paid' && prev.status === 'paid') stmts.push(db.prepare("DELETE FROM finance_transactions WHERE user_id = ? AND source = 'invoice' AND ref = ?").bind(user.id, prev.id));
  await db.batch(stmts);
  const row = await db.prepare(`${INV_SELECT} WHERE i.id = ?`).bind(prev.id).first<InvRow>();
  return c.json({ invoice: row ? toInvoice(row) : null });
});

finance.delete('/invoices/:id', async (c) => {
  const res = await c.env.DB.prepare("DELETE FROM invoices WHERE id = ? AND user_id = ? AND status = 'draft'").bind(c.req.param('id'), c.get('user').id).run();
  if (res.meta.changes === 0) return c.json({ error: 'only drafts can be deleted; void the others' }, 400);
  return c.json({ ok: true });
});

/** Public: the client opens /i/<token>. Mounted at /public/invoices. */
export const publicInvoices = new Hono<AppEnv>();
publicInvoices.get('/:token', async (c) => {
  const row = await c.env.DB.prepare(`${INV_SELECT} WHERE i.token = ? AND i.status != 'draft'`).bind(c.req.param('token').toUpperCase()).first<InvRow>();
  if (!row) return c.json({ error: 'no invoice at this link' }, 404);
  return c.json({ invoice: toInvoice(row) });
});
