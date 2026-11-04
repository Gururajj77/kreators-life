import type { InvoiceDoc } from './invoice.ts';

// ---------------------------------------------------------------------------
// Finance: a creator's money, kept simple
// ---------------------------------------------------------------------------

export const INCOME_CATEGORIES = ['Brand deal', 'Content reward', 'Courses', 'Products', 'Sessions', 'Affiliate', 'Ad revenue', 'Other income'] as const;
export const EXPENSE_CATEGORIES = ['Equipment', 'Software', 'Travel', 'Team', 'Marketing', 'Fees', 'Taxes', 'Other expense'] as const;

/** A share of one transaction that belongs to someone else, for example an editor's cut of a brand deal. */
export interface FinanceSplit {
  name: string;
  cents: number;
  status: 'due' | 'paid';
}

export interface FinanceTransaction {
  id: string;
  kind: 'income' | 'expense';
  amountCents: number;
  currency: string;
  category: string;
  /** Who it came from or went to. */
  counterparty: string;
  note: string;
  /** YYYY-MM-DD */
  date: string;
  /** manual: typed in. invoice: an invoice marked paid. due: a due settled. recurring: posted on schedule. */
  source: 'manual' | 'invoice' | 'due' | 'recurring';
  ref: string | null;
  splits: FinanceSplit[];
  createdAt: string;
}

/** Money someone owes you, or you owe someone. Settling it books the transaction. */
export interface FinanceDue {
  id: string;
  direction: 'owe' | 'owed';
  counterparty: string;
  amountCents: number;
  currency: string;
  category: string;
  note: string;
  dueDate: string | null;
  recurring: 'none' | 'monthly';
  status: 'open' | 'settled';
  settledAt: string | null;
  createdAt: string;
}

/** Posted automatically every month on a day you pick. */
export interface FinanceRecurring {
  id: string;
  kind: 'income' | 'expense';
  amountCents: number;
  currency: string;
  category: string;
  counterparty: string;
  note: string;
  dayOfMonth: number;
  nextDate: string;
  active: boolean;
  createdAt: string;
}

/** save: you put money aside toward it. earn: income since the start counts toward it. */
export interface FinanceGoal {
  id: string;
  title: string;
  kind: 'save' | 'earn';
  targetCents: number;
  progressCents: number;
  startDate: string;
  deadline: string | null;
  createdAt: string;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitCents: number;
}

export const INVOICE_STATUSES = ['draft', 'sent', 'paid', 'void'] as const;

export interface Invoice {
  id: string;
  number: string;
  ownerName: string;
  ownerHandle: string | null;
  clientName: string;
  clientEmail: string;
  items: InvoiceItem[];
  totalCents: number;
  currency: string;
  status: (typeof INVOICE_STATUSES)[number];
  issueDate: string;
  dueDate: string | null;
  note: string;
  /** The public link is /i/<token>. */
  token: string;
  paidAt: string | null;
  createdAt: string;
  /** The designed invoice. Older ones have the empty design. */
  doc: InvoiceDoc;
  /** The Agency client it was made for, when it was. */
  agencyClientId: string | null;
  /** When it was last changed after the client could see it. */
  revisedAt: string | null;
}

export interface FinanceBudget {
  category: string;
  monthlyCents: number;
  spentCents: number;
}

export interface FinanceSummary {
  /** YYYY-MM */
  month: string;
  currency: string;
  incomeCents: number;
  expenseCents: number;
  netCents: number;
  /** Points earned on the platform this month: sales, affiliate shares, content rewards. */
  platformPoints: number;
  byCategory: { category: string; kind: 'income' | 'expense'; cents: number }[];
  /** The last six months, oldest first. */
  months: { month: string; incomeCents: number; expenseCents: number }[];
  budgets: FinanceBudget[];
  openInvoicesCents: number;
  overdueInvoices: number;
  transactions: FinanceTransaction[];
  invoices: Invoice[];
  /** Since the beginning. */
  totals: { incomeCents: number; expenseCents: number; netCents: number; platformPoints: number };
  dues: FinanceDue[];
  owedToMeCents: number;
  iOweCents: number;
  /**
   * Agency invoices sent and not yet paid, owed to the person, one line a currency (whole cents, never mixed across currencies), with how
   * many and how many are past their due day. A paid one is already income in the transactions; a draft or a void one is not owed.
   */
  owedToYou: { currency: string; cents: number; count: number; overdue: number }[];
  recurring: FinanceRecurring[];
  goals: FinanceGoal[];
}

/** Whole currency units with two decimals, e.g. 1234.50. */
/**
 * An amount typed in whole units ("1,250.50", "1.005") as integer cents, read from the digits and never through a float, so 1.005 is 101 and
 * not 100. Anything that is not a plain decimal is NaN, and an empty field is 0. A third decimal rounds half up.
 */
export function typedCents(typed: string | number): number {
  const t = String(typed).trim().replace(/[\s,₹$€£]/g, '');
  if (t === '') return 0;
  const m = /^(-?)(\d*)(?:\.(\d*))?$/.exec(t);
  if (!m || (m[2] === '' && !m[3])) return Number.NaN;
  const frac = (m[3] ?? '').padEnd(3, '0');
  const whole = Number(m[2] || '0') * 100 + Number(frac.slice(0, 2)) + (Number(frac[2]) >= 5 ? 1 : 0);
  return m[1] ? -whole : whole;
}
/**
 * The ways a product can be paid for, from its own prices, and the one rule the server and the screens share. A product with a points price
 * can be bought with points; one with a money price can be bought with money; one with both takes either; one with neither is free; a
 * pay-what-you-want product is always in points. A product priced in money only is never bought with points, so sending `pay: 'points'`
 * for it gets nothing.
 */
export function productPayWays(p: { pricePoints: number; priceCents: number; pwyw?: boolean }): { points: boolean; money: boolean; free: boolean } {
  const free = p.pricePoints <= 0 && p.priceCents <= 0 && !p.pwyw;
  return { points: Boolean(p.pwyw) || p.pricePoints > 0 || free, money: p.priceCents > 0, free };
}

export function money(cents: number, currency = 'INR'): string {
  const symbol = currency === 'INR' ? '₹' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : `${currency} `;
  // Integer cents in: the whole part and the cents are split as integers, so no float is ever rounded. Rupees group in
  // lakh and crore (en-IN, 1,00,000); every other currency groups in thousands (en-US, 100,000), whatever the runtime.
  const abs = Math.abs(Math.round(cents));
  const rest = abs % 100;
  const whole = ((abs - rest) / 100).toLocaleString(currency === 'INR' ? 'en-IN' : 'en-US', { maximumFractionDigits: 0 });
  return `${cents < 0 ? '-' : ''}${symbol}${whole}${rest === 0 ? '' : `.${String(rest).padStart(2, '0')}`}`;
}

/** A fee in basis points with integer maths. */
export function feeBps(amount: number, bps: number): number {
  return Math.round((amount * bps) / 10_000);
}
