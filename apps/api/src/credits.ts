import { AGENT_LIMITS, AGENTS, isPaidPlan, planName, PLAN_DAYS, PLANS, spendSplit, type AgentKey, type CreditAccount, type CreditEntry, type CreditReason, type PlanKey } from '@kreators/shared';
import { newId, nowIso } from './db';

/**
 * Credits: what typing to the assistant (and later the other agents) runs on. One account row per person holds the
 * plan, its period and two balances, and every move is a ledger row. A plan's credits last for its period and do
 * not carry over; extra credits (top-ups and team grants) stay until used. Plan credits are spent first. Until
 * payments are live, only an admin starts a plan or adds credits, and every change is audited by the caller.
 */

export interface AccountRow {
  user_id: string;
  plan: string;
  plan_started_at: string | null;
  plan_until: string | null;
  plan_credits: number;
  extra_credits: number;
  updated_at: string;
}

interface LedgerRow {
  id: string;
  bucket: 'plan' | 'extra';
  amount: number;
  reason: CreditReason;
  agent: string | null;
  input_tokens: number;
  output_tokens: number;
  note: string;
  created_at: string;
}

const empty = (userId: string): AccountRow => ({ user_id: userId, plan: 'none', plan_started_at: null, plan_until: null, plan_credits: 0, extra_credits: 0, updated_at: '' });

const ledger = (db: D1Database, userId: string, row: { bucket: 'plan' | 'extra'; amount: number; reason: CreditReason; agent?: AgentKey | null; model?: string; input?: number; output?: number; note?: string; actorId?: string | null }, at: string) =>
  db
    .prepare('INSERT INTO credit_ledger (id, user_id, bucket, amount, reason, agent, model, input_tokens, output_tokens, note, actor_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(newId(), userId, row.bucket, row.amount, row.reason, row.agent ?? null, row.model ?? '', row.input ?? 0, row.output ?? 0, (row.note ?? '').slice(0, 200), row.actorId ?? null, at);

const upsert = (db: D1Database, a: AccountRow) =>
  db
    .prepare(
      `INSERT INTO credit_accounts (user_id, plan, plan_started_at, plan_until, plan_credits, extra_credits, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET plan = excluded.plan, plan_started_at = excluded.plan_started_at, plan_until = excluded.plan_until,
         plan_credits = excluded.plan_credits, extra_credits = excluded.extra_credits, updated_at = excluded.updated_at`,
    )
    .bind(a.user_id, a.plan, a.plan_started_at, a.plan_until, a.plan_credits, a.extra_credits, a.updated_at);

/** The Pro mark on the profile follows the plan: any plan is Pro, no plan is not. */
const proMark = (db: D1Database, userId: string, on: boolean, at: string) => [
  db.prepare('UPDATE users SET is_pro = ? WHERE id = ?').bind(on ? 1 : 0, userId),
  on
    ? db.prepare("INSERT OR IGNORE INTO honors (user_id, honor_key, note, awarded_at) VALUES (?, 'pro', 'Pro membership', ?)").bind(userId, at)
    : db.prepare("DELETE FROM honors WHERE user_id = ? AND honor_key = 'pro'").bind(userId),
];

/** The person's account. A plan whose time is up is closed first: its unused credits expire, the extra ones stay. */
export async function accountOf(db: D1Database, userId: string): Promise<AccountRow> {
  const row = await db.prepare('SELECT * FROM credit_accounts WHERE user_id = ?').bind(userId).first<AccountRow>();
  if (!row) return empty(userId);
  const now = nowIso();
  if (row.plan !== 'none' && (!isPaidPlan(row.plan) || (row.plan_until !== null && row.plan_until <= now))) {
    const closed: AccountRow = { ...row, plan: 'none', plan_started_at: null, plan_until: null, plan_credits: 0, updated_at: now };
    const stmts = [upsert(db, closed), ...proMark(db, userId, false, now)];
    if (row.plan_credits > 0) stmts.push(ledger(db, userId, { bucket: 'plan', amount: -row.plan_credits, reason: 'expire', note: `${planName(row.plan)} ended` }, now));
    await db.batch(stmts);
    return closed;
  }
  return row;
}

/** Credits each agent spent in the last 24 hours. */
export async function usedToday(db: D1Database, userId: string): Promise<Record<AgentKey, number>> {
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const rows = await db
    .prepare("SELECT agent, -SUM(amount) AS n FROM credit_ledger WHERE user_id = ? AND reason = 'usage' AND created_at >= ? GROUP BY agent")
    .bind(userId, since)
    .all<{ agent: string; n: number }>();
  const out = Object.fromEntries(AGENTS.map((a) => [a, 0])) as Record<AgentKey, number>;
  for (const r of rows.results) if ((AGENTS as readonly string[]).includes(r.agent)) out[r.agent as AgentKey] = r.n ?? 0;
  return out;
}

export function toAccount(row: AccountRow, used: Record<AgentKey, number>): CreditAccount {
  const plan: PlanKey = isPaidPlan(row.plan) ? row.plan : 'none';
  return {
    plan,
    planName: planName(plan),
    planUntil: plan === 'none' ? null : row.plan_until,
    planCredits: plan === 'none' ? 0 : row.plan_credits,
    extraCredits: row.extra_credits,
    total: (plan === 'none' ? 0 : row.plan_credits) + row.extra_credits,
    limits: plan === 'none' ? null : AGENT_LIMITS[plan],
    usedToday: used,
  };
}

export async function creditAccount(db: D1Database, userId: string): Promise<CreditAccount> {
  const [row, used] = await Promise.all([accountOf(db, userId), usedToday(db, userId)]);
  return toAccount(row, used);
}

/**
 * Start a plan for `days`, or end it with `none`. The plan's credits are granted fresh; whatever was left of the
 * last plan's credits expires. The caller audits it.
 */
export async function setPlan(db: D1Database, userId: string, plan: PlanKey, days: number, actorId: string | null): Promise<AccountRow> {
  const prev = await accountOf(db, userId);
  const now = nowIso();
  const stmts: D1PreparedStatement[] = [];
  if (prev.plan_credits > 0) stmts.push(ledger(db, userId, { bucket: 'plan', amount: -prev.plan_credits, reason: 'expire', note: plan === 'none' ? `${planName(prev.plan)} switched off` : `Moved to ${planName(plan)}`, actorId }, now));
  const span = Math.max(1, Math.min(366, Math.round(days) || PLAN_DAYS));
  const next: AccountRow = isPaidPlan(plan)
    ? { ...prev, plan, plan_started_at: now, plan_until: new Date(Date.now() + span * 86_400_000).toISOString(), plan_credits: PLANS[plan].credits, updated_at: now }
    : { ...prev, plan: 'none', plan_started_at: null, plan_until: null, plan_credits: 0, updated_at: now };
  stmts.push(upsert(db, next), ...proMark(db, userId, isPaidPlan(plan), now));
  if (isPaidPlan(plan)) stmts.push(ledger(db, userId, { bucket: 'plan', amount: PLANS[plan].credits, reason: 'plan', note: `${PLANS[plan].name} for ${span} days`, actorId }, now));
  await db.batch(stmts);
  return next;
}

/** Extra credits from the team (or, once payments are live, a top-up). They stay until used. */
export async function addCredits(db: D1Database, userId: string, credits: number, reason: 'admin' | 'topup', note: string, actorId: string | null): Promise<AccountRow> {
  const prev = await accountOf(db, userId);
  const now = nowIso();
  const next: AccountRow = { ...prev, extra_credits: prev.extra_credits + credits, updated_at: now };
  await db.batch([upsert(db, next), ledger(db, userId, { bucket: 'extra', amount: credits, reason, note, actorId }, now)]);
  return next;
}

/**
 * Take what one message cost, plan credits first, never below zero. The tokens are kept on the row, so the books
 * show what the credits paid for. Returns what was taken and what is left.
 */
export async function spend(db: D1Database, userId: string, agent: AgentKey, cost: number, tokens: { input: number; output: number }, model: string): Promise<{ spent: number; left: number }> {
  const prev = await accountOf(db, userId);
  if (cost <= 0) {
    // A free model costs nothing, but the row still says which model answered and how many tokens it took.
    if (tokens.input || tokens.output) await ledger(db, userId, { bucket: 'plan', amount: 0, reason: 'usage', agent, model, input: tokens.input, output: tokens.output }, nowIso()).run();
    return { spent: 0, left: prev.plan_credits + prev.extra_credits };
  }
  const split = spendSplit(cost, prev.plan_credits, prev.extra_credits);
  const now = nowIso();
  const stmts = [
    db
      .prepare('UPDATE credit_accounts SET plan_credits = MAX(0, plan_credits - ?), extra_credits = MAX(0, extra_credits - ?), updated_at = ? WHERE user_id = ?')
      .bind(split.plan, split.extra, now, userId),
  ];
  // The tokens go on the first row, so a message's tokens are counted once.
  let first = true;
  for (const bucket of ['plan', 'extra'] as const) {
    if (split[bucket] <= 0) continue;
    stmts.push(ledger(db, userId, { bucket, amount: -split[bucket], reason: 'usage', agent, model, input: first ? tokens.input : 0, output: first ? tokens.output : 0 }, now));
    first = false;
  }
  await db.batch(stmts);
  const spent = split.plan + split.extra;
  return { spent, left: prev.plan_credits + prev.extra_credits - spent };
}

/** Credits used per day for the last thirty days, oldest first. Days are UTC days, as they are stored. */
export async function usageByDay(db: D1Database, userId: string): Promise<{ date: string; credits: number }[]> {
  const today = new Date();
  const days = Array.from({ length: 30 }, (_, i) => new Date(today.getTime() - (29 - i) * 86_400_000).toISOString().slice(0, 10));
  const rows = await db
    .prepare("SELECT substr(created_at, 1, 10) AS d, -SUM(amount) AS n FROM credit_ledger WHERE user_id = ? AND reason = 'usage' AND created_at >= ? GROUP BY d")
    .bind(userId, `${days[0]}T00:00:00`)
    .all<{ d: string; n: number }>();
  const by = new Map(rows.results.map((r) => [r.d, r.n ?? 0]));
  return days.map((date) => ({ date, credits: by.get(date) ?? 0 }));
}

export function toEntry(r: LedgerRow): CreditEntry {
  return {
    id: r.id,
    bucket: r.bucket,
    amount: r.amount,
    reason: r.reason,
    agent: (AGENTS as readonly string[]).includes(r.agent ?? '') ? (r.agent as AgentKey) : null,
    note: r.note,
    tokens: r.input_tokens || r.output_tokens ? { input: r.input_tokens, output: r.output_tokens } : null,
    createdAt: r.created_at,
  };
}
export type { LedgerRow };
