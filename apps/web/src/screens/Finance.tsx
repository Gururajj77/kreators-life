import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, money, type FinanceDue, type FinanceGoal, type FinanceRecurring, type FinanceSplit, type FinanceSummary, type FinanceTransaction, type Invoice, type InvoiceItem } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { PeriodPanel } from '../components/PeriodPanel';
import { Button } from '../components/Button';
import { Donut, Legend, MultiLine } from '../components/Charts';
import { BackLink } from '../components/PageHeader';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { Toggle } from '../components/Toggle';
import { api } from '../lib/api';
import { useAuthed } from '../lib/queries';

const field = 'mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]';
const monthName = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
const shortMonth = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString(undefined, { month: 'short' });
const day = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1 + by, 1)).toISOString().slice(0, 7);
}
const toCents = (v: string) => Math.round(Number(v.replace(/[^0-9.]/g, '')) * 100);
const todayIso = () => new Date().toISOString().slice(0, 10);

type SheetKind = 'income' | 'expense' | 'invoice' | 'budgets' | 'due' | 'recurring' | 'goal' | null;

/** Money in, money out, who it was with, what is owed, what repeats, and where you are heading. Private to the person. */
export function Finance() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const q = useAuthed(['finance', month], () => api.finance(month));
  const d = q.data;
  const [sheet, setSheet] = useState<SheetKind>(null);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const refetch = () => void q.refetch();

  return (
    <Screen>
      <header className="pt-lg">
        <BackLink to="/apps">Apps</BackLink>
        <h1 className="text-[30px]">Finance</h1>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Money in, money out, who with, what is owed, what repeats, and your goals. Only you can see this.</p>
        {d && (
          <div className="mt-md grid grid-cols-2 gap-xs md:grid-cols-4" aria-label="All time">
            <Stat label="earned, all time" value={money(d.totals.incomeCents, d.currency)} tone="var(--tint-green)" />
            <Stat label="spent, all time" value={money(d.totals.expenseCents, d.currency)} tone="var(--tint-red)" />
            <Stat label="kept" value={money(d.totals.netCents, d.currency)} tone={d.totals.netCents >= 0 ? 'var(--tint-yellow)' : 'var(--tint-red)'} />
            <Stat label="platform points, all time" value={d.totals.platformPoints.toLocaleString()} tone="var(--tint-purple)" />
          </div>
        )}
        <div className="mt-md flex flex-wrap gap-xs">
          <Button variant="outline" onClick={() => setSheet('income')}>
            Money in
          </Button>
          <Button variant="outline" onClick={() => setSheet('expense')}>
            Money out
          </Button>
          <Button variant="outline" onClick={() => setSheet('due')}>
            Someone owes
          </Button>
          <Button variant="outline" onClick={() => setSheet('recurring')}>
            Repeats monthly
          </Button>
          <Button variant="outline" onClick={() => setSheet('invoice')}>
            New invoice
          </Button>
          <Button variant="outline" onClick={() => setSheet('goal')}>
            New goal
          </Button>
        </div>
      </header>

      {q.isError && (
        <p role="alert" className="span-all mt-md m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
          Could not load your numbers. Try again in a moment.
        </p>
      )}

      {d && (
        <>
          <PeriodPanel id="finance-period" parts={['finance', 'shop']} />
          <section className="mt-lg" aria-labelledby="month-heading">
            <div className="flex items-center justify-between gap-xs">
              <button type="button" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month" className="toy toy-soft flex size-[44px] items-center justify-center rounded-pill bg-card text-[18px] font-extrabold">
                ‹
              </button>
              <h2 id="month-heading" className="m-0 text-[24px]">
                {monthName(month)}
              </h2>
              <button type="button" onClick={() => setMonth(shiftMonth(month, 1))} disabled={month >= thisMonth} aria-label="Next month" className="toy toy-soft flex size-[44px] items-center justify-center rounded-pill bg-card text-[18px] font-extrabold disabled:opacity-40">
                ›
              </button>
            </div>
            <div className="mt-sm grid grid-cols-2 gap-xs" aria-label="This month">
              <Stat label="in" value={money(d.incomeCents, d.currency)} tone="var(--tint-green)" />
              <Stat label="out" value={money(d.expenseCents, d.currency)} tone="var(--tint-red)" />
              <Stat label="net" value={money(d.netCents, d.currency)} tone={d.netCents >= 0 ? 'var(--tint-yellow)' : 'var(--tint-red)'} />
              <Stat label="platform points" value={d.platformPoints.toLocaleString()} tone="var(--tint-purple)" />
            </div>
            <MonthBars months={d.months} currency={d.currency} />
            <CategoryDonut byCategory={d.byCategory} currency={d.currency} />
          </section>

          <section className="mt-lg" aria-labelledby="owed-heading">
            <h2 id="owed-heading" className="text-[24px]">
              Owed
            </h2>
            <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">
              {d.owedToMeCents > 0 || d.iOweCents > 0 ? (
                <>
                  <span className="font-extrabold text-ink">{money(d.owedToMeCents, d.currency)}</span> coming to you, <span className="font-extrabold text-ink">{money(d.iOweCents, d.currency)}</span> to pay out.
                </>
              ) : (
                'Nothing outstanding. Add what someone owes you, or what you owe someone, and settle it when the money moves.'
              )}
            </p>
            <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
              {d.dues
                .filter((x) => x.status === 'open')
                .map((x) => (
                  <DueRow key={x.id} due={x} currency={d.currency} onChange={refetch} />
                ))}
            </ul>
            {d.dues.some((x) => x.status === 'settled') && (
              <details className="mt-xs">
                <summary className="cursor-pointer text-[14px] font-bold text-ink-soft">Settled</summary>
                <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0">
                  {d.dues
                    .filter((x) => x.status === 'settled')
                    .map((x) => (
                      <DueRow key={x.id} due={x} currency={d.currency} onChange={refetch} />
                    ))}
                </ul>
              </details>
            )}
          </section>

          <section className="mt-lg" aria-labelledby="goals-heading">
            <h2 id="goals-heading" className="text-[24px]">
              Goals
            </h2>
            {d.goals.length === 0 && <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">A saving goal fills as you put money aside. An earning goal fills from income by itself.</p>}
            <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
              {d.goals.map((g) => (
                <GoalRow key={g.id} goal={g} currency={d.currency} onChange={refetch} />
              ))}
            </ul>
          </section>

          <section className="mt-lg" aria-labelledby="recurring-heading">
            <h2 id="recurring-heading" className="text-[24px]">
              Repeats monthly
            </h2>
            {d.recurring.length === 0 && <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Subscriptions, rent, a retainer. Posted on the day you pick, every month.</p>}
            <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
              {d.recurring.map((r) => (
                <RecurringRow key={r.id} r={r} currency={d.currency} onChange={refetch} />
              ))}
            </ul>
          </section>

          {d.byCategory.length > 0 && (
            <section className="mt-lg" aria-labelledby="cats-heading">
              <h2 id="cats-heading" className="text-[24px]">
                By category
              </h2>
              <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
                {d.byCategory.map((c) => {
                  const total = c.kind === 'income' ? d.incomeCents : d.expenseCents;
                  return (
                    <li key={`${c.kind}-${c.category}`} className="rounded-tile bg-card p-sm shadow-toy-soft">
                      <div className="flex items-baseline justify-between gap-sm">
                        <p className="m-0 text-[16px] font-bold">
                          {c.category} <span className="text-[12px] font-extrabold uppercase text-ink-mute">{c.kind === 'income' ? 'in' : 'out'}</span>
                        </p>
                        <p className="m-0 text-[16px] font-extrabold">{money(c.cents, d.currency)}</p>
                      </div>
                      <div className="mt-xs h-[8px] overflow-hidden rounded-pill bg-line" aria-hidden="true">
                        <div className={`h-full rounded-pill ${c.kind === 'income' ? 'bg-r4' : 'bg-r2'}`} style={{ width: `${Math.round((c.cents / Math.max(1, total)) * 100)}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section className="mt-lg" aria-labelledby="budgets-heading">
            <div className="flex items-center justify-between gap-sm">
              <h2 id="budgets-heading" className="text-[24px]">
                Budgets
              </h2>
              <Button variant="ghost" onClick={() => setSheet('budgets')}>
                {d.budgets.length ? 'Edit' : 'Set budgets'}
              </Button>
            </div>
            {d.budgets.length === 0 && <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">A monthly ceiling per expense category. The bar fills as you spend.</p>}
            <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
              {d.budgets.map((b) => {
                const pct = Math.round((b.spentCents / Math.max(1, b.monthlyCents)) * 100);
                return (
                  <li key={b.category} className="rounded-tile bg-card p-sm shadow-toy-soft">
                    <div className="flex items-baseline justify-between gap-sm">
                      <p className="m-0 text-[16px] font-bold">{b.category}</p>
                      <p className={`m-0 text-[14px] font-extrabold ${pct > 100 ? 'text-r1' : 'text-ink-soft'}`}>
                        {money(b.spentCents, d.currency)} of {money(b.monthlyCents, d.currency)}
                      </p>
                    </div>
                    <div className="mt-xs h-[8px] overflow-hidden rounded-pill bg-line" aria-hidden="true">
                      <div className={`h-full rounded-pill ${pct > 100 ? 'bg-r1' : pct > 80 ? 'bg-r3' : 'bg-r4'}`} style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="mt-lg" aria-labelledby="invoices-heading">
            <h2 id="invoices-heading" className="text-[24px]">
              Invoices
            </h2>
            {(d.openInvoicesCents > 0 || d.overdueInvoices > 0) && (
              <p className="mt-xs m-0 text-[14px] font-bold text-ink-soft">
                {money(d.openInvoicesCents, d.currency)} invoiced and waiting{d.overdueInvoices > 0 ? `, ${d.overdueInvoices} overdue` : ''}.
              </p>
            )}
            {d.invoices.length === 0 && <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Send a link, get paid, mark it paid. The income books itself.</p>}
            <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
              {d.invoices.map((inv) => (
                <InvoiceRow key={inv.id} inv={inv} onChange={refetch} />
              ))}
            </ul>
          </section>

          <section className="mt-lg" aria-labelledby="tx-heading">
            <h2 id="tx-heading" className="text-[24px]">
              Entries, {monthName(month)}
            </h2>
            {d.transactions.length === 0 && <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Nothing logged this month yet.</p>}
            <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
              {d.transactions.map((t) => (
                <TxRow key={t.id} t={t} currency={d.currency} onChange={refetch} />
              ))}
            </ul>
          </section>

          <AddSheet kind={sheet === 'income' || sheet === 'expense' ? sheet : null} onClose={() => setSheet(null)} onDone={refetch} />
          <DueSheet open={sheet === 'due'} onClose={() => setSheet(null)} onDone={refetch} />
          <RecurringSheet open={sheet === 'recurring'} onClose={() => setSheet(null)} onDone={refetch} />
          <GoalSheet open={sheet === 'goal'} onClose={() => setSheet(null)} onDone={refetch} />
          <InvoiceSheet open={sheet === 'invoice'} currency={d.currency} onClose={() => setSheet(null)} onDone={refetch} />
          <BudgetSheet open={sheet === 'budgets'} summary={d} onClose={() => setSheet(null)} onDone={refetch} />
        </>
      )}
    </Screen>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-tile p-sm" style={{ background: tone }}>
      <p className="m-0 truncate font-display text-[22px] font-extrabold leading-none">{value}</p>
      <p className="mt-xs m-0 text-[12px] font-bold text-ink-soft">{label}</p>
    </div>
  );
}

function MonthBars({ months, currency }: { months: FinanceSummary['months']; currency: string }) {
  const max = Math.max(1, ...months.flatMap((m) => [m.incomeCents, m.expenseCents]));
  const last = months.at(-1);
  return (
    <div className="mt-sm rounded-tile bg-card p-sm shadow-toy-soft">
      <MultiLine
        series={[
          { values: months.map((m) => m.incomeCents), color: 'var(--color-r4)', label: 'in' },
          { values: months.map((m) => m.expenseCents), color: 'var(--color-r2)', label: 'out' },
        ]}
        max={max}
        labels={months.map((m) => shortMonth(m.month))}
        allLabels
        height={160}
        yFormat={(v) => money(Math.round(v / 100) * 100, currency)}
        empty="No money logged in the last six months"
        label="Income and expenses by month"
      />
      {last && (
        <p className="mt-xs m-0 text-[12px] font-bold text-ink-soft">
          {shortMonth(last.month)}: {money(last.incomeCents, currency)} in, {money(last.expenseCents, currency)} out.
        </p>
      )}
    </div>
  );
}

function TxRow({ t, currency, onChange }: { t: FinanceTransaction; currency: string; onChange: () => void }) {
  const del = useMutation({ mutationFn: () => api.deleteTransaction(t.id), onSuccess: onChange });
  const paySplit = useMutation({
    mutationFn: (i: number) => api.updateTransaction(t.id, { splits: t.splits.map((s, j) => (j === i ? { ...s, status: s.status === 'paid' ? 'due' : 'paid' } : s)) }),
    onSuccess: onChange,
  });
  const sign = t.kind === 'income' ? '+' : '−';
  return (
    <li className={`rounded-tile bg-card p-sm shadow-toy-soft`}>
      <div className="flex items-center gap-sm">
        <span className={`flex size-[40px] shrink-0 items-center justify-center rounded-pill text-[16px] font-extrabold ${t.kind === 'income' ? 'bg-r4 text-on-fill' : 'bg-r2 text-on-fill'}`} aria-hidden="true">
          {sign}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-bold"> {t.category}
            {t.counterparty ? <span className="font-semibold text-ink-soft"> {t.kind === 'income' ? 'from' : 'to'} {t.counterparty}</span> : ''}
          </span>
          <span className="block truncate text-[14px] font-semibold text-ink-soft">
            {day(t.date)}
            {t.note ? `, ${t.note}` : ''}
            {t.source === 'invoice' ? ', from an invoice' : t.source === 'due' ? ', settled a due' : t.source === 'recurring' ? ', monthly' : ''}
          </span>
        </span>
        <span className="shrink-0 text-[16px] font-extrabold">{money(t.kind === 'income' ? t.amountCents : -t.amountCents, t.currency || currency)}</span>
        {t.source === 'manual' && (
          <button type="button" onClick={() => del.mutate()} disabled={del.isPending} aria-label="Remove" className="toy toy-soft flex size-[40px] shrink-0 items-center justify-center rounded-pill bg-paper text-ink-soft">
            ×
          </button>
        )}
      </div>
      {t.splits.length > 0 && (
        <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0 pl-xl">
          {t.splits.map((s, i) => (
            <li key={`${s.name}-${i}`} className="flex items-center justify-between gap-xs text-[14px] font-semibold text-ink-soft">
              <span>
                {s.name}’s share {money(s.cents, t.currency || currency)}
              </span>
              <button type="button" onClick={() => paySplit.mutate(i)} disabled={paySplit.isPending} className={`toy toy-soft min-h-[32px] rounded-pill px-sm text-[12px] font-extrabold ${s.status === 'paid' ? 'bg-r4 text-on-fill' : 'bg-paper'}`}>
                {s.status === 'paid' ? 'Paid' : 'Mark paid'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function DueRow({ due, currency, onChange }: { due: FinanceDue; currency: string; onChange: () => void }) {
  const settle = useMutation({ mutationFn: () => api.settleDue(due.id), onSuccess: onChange });
  const del = useMutation({ mutationFn: () => api.deleteDue(due.id), onSuccess: onChange });
  const overdue = due.status === 'open' && due.dueDate && due.dueDate < todayIso();
  return (
    <li className={`rounded-tile bg-card p-sm shadow-toy-soft ${due.status === 'settled' ? 'opacity-70' : ''}`}>
      <div className="flex items-center gap-sm">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-bold">
            {due.direction === 'owed' ? `${due.counterparty} owes you` : `You owe ${due.counterparty}`}
          </span>
          <span className={`block text-[14px] font-semibold ${overdue ? 'text-r1' : 'text-ink-soft'}`}>
            {due.dueDate ? `${overdue ? 'was due' : 'due'} ${day(due.dueDate)}` : 'no date'}
            {due.recurring === 'monthly' ? ', every month' : ''}
            {due.note ? `, ${due.note}` : ''}
            {due.settledAt ? `, settled ${new Date(due.settledAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}` : ''}
          </span>
        </span>
        <span className="shrink-0 text-[16px] font-extrabold">{money(due.amountCents, due.currency || currency)}</span>
      </div>
      {due.status === 'open' && (
        <div className="mt-xs flex gap-xs">
          <Button onClick={() => settle.mutate()} disabled={settle.isPending}>
            {due.direction === 'owed' ? 'Received' : 'Paid'}
          </Button>
          <Button variant="ghost" onClick={() => del.mutate()} disabled={del.isPending}>
            Remove
          </Button>
        </div>
      )}
    </li>
  );
}

function RecurringRow({ r, currency, onChange }: { r: FinanceRecurring; currency: string; onChange: () => void }) {
  const set = useMutation({ mutationFn: (active: boolean) => api.setRecurring(r.id, active), onSuccess: onChange });
  const del = useMutation({ mutationFn: () => api.deleteRecurring(r.id), onSuccess: onChange });
  return (
    <li className="rounded-tile bg-card p-sm shadow-toy-soft">
      <Toggle
        on={r.active}
        onChange={(on) => set.mutate(on)}
        label={`${r.kind === 'income' ? '+' : '−'}${money(r.amountCents, r.currency || currency)} ${r.category}${r.counterparty ? `, ${r.counterparty}` : ''}`}
        hint={`Day ${r.dayOfMonth} of the month, next on ${day(r.nextDate)}${r.note ? `, ${r.note}` : ''}`}
        disabled={set.isPending}
      />
      <Button variant="ghost" className="mt-xs" onClick={() => del.mutate()} disabled={del.isPending}>
        Remove
      </Button>
    </li>
  );
}

function GoalRow({ goal, currency, onChange }: { goal: FinanceGoal; currency: string; onChange: () => void }) {
  const [amount, setAmount] = useState('');
  const add = useMutation({
    mutationFn: () => api.addToGoal(goal.id, toCents(amount)),
    onSuccess: () => {
      setAmount('');
      onChange();
    },
  });
  const del = useMutation({ mutationFn: () => api.deleteGoal(goal.id), onSuccess: onChange });
  const pct = Math.min(100, Math.round((goal.progressCents / Math.max(1, goal.targetCents)) * 100));
  return (
    <li className="rounded-tile bg-card p-sm shadow-toy-soft">
      <div className="flex items-baseline justify-between gap-sm">
        <p className="m-0 text-[16px] font-bold">
          {goal.title} <span className="text-[12px] font-extrabold uppercase text-ink-mute">{goal.kind === 'earn' ? 'earn' : 'save'}</span>
        </p>
        <p className="m-0 text-[14px] font-extrabold text-ink-soft">
          {money(goal.progressCents, currency)} of {money(goal.targetCents, currency)}
        </p>
      </div>
      <div className="mt-xs h-[8px] overflow-hidden rounded-pill bg-line" aria-hidden="true">
        <div className={`h-full rounded-pill ${pct >= 100 ? 'bg-r4' : 'bg-r6'}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-xs m-0 text-[12px] font-bold text-ink-soft">
        {pct}%{goal.deadline ? `, by ${day(goal.deadline)}` : ''}
        {goal.kind === 'earn' ? `, counting income since ${day(goal.startDate)}` : ''}
      </p>
      <div className="mt-xs flex flex-wrap items-center gap-xs">
        {goal.kind === 'save' && (
          <form
            className="flex gap-xs"
            onSubmit={(e) => {
              e.preventDefault();
              if (toCents(amount) !== 0) add.mutate();
            }}
          >
            <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Put aside" aria-label="Amount to put aside" className="w-[140px] rounded-pill border-2 border-line bg-paper px-sm py-xs text-[14px]" />
            <Button variant="outline" type="submit" disabled={add.isPending || toCents(amount) === 0}>
              Add
            </Button>
          </form>
        )}
        <Button variant="ghost" onClick={() => del.mutate()} disabled={del.isPending}>
          Remove
        </Button>
      </div>
    </li>
  );
}

function InvoiceRow({ inv, onChange }: { inv: Invoice; onChange: () => void }) {
  const set = useMutation({ mutationFn: (status: Invoice['status']) => api.setInvoice(inv.id, status), onSuccess: onChange });
  const del = useMutation({ mutationFn: () => api.deleteInvoice(inv.id), onSuccess: onChange });
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/i/${inv.token}`;
  const tone = inv.status === 'paid' ? 'bg-r4 text-on-fill' : inv.status === 'sent' ? 'bg-r3 text-ink-fixed' : inv.status === 'void' ? 'bg-line text-ink' : 'bg-paper text-ink-soft';
  return (
    <li className="rounded-tile bg-card p-sm shadow-toy-soft">
      <div className="flex items-baseline justify-between gap-sm">
        <p className="m-0 text-[16px] font-bold">
          {inv.number} <span className="font-semibold text-ink-soft">{inv.clientName}</span>
        </p>
        <p className="m-0 text-[16px] font-extrabold">{money(inv.totalCents, inv.currency)}</p>
      </div>
      <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">
        <span className={`rounded-pill px-xs text-[12px] font-extrabold leading-[20px] ${tone}`}>{inv.status}</span>
        {inv.dueDate ? ` due ${day(inv.dueDate)}` : ''}
        {inv.paidAt ? `, paid ${new Date(inv.paidAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}` : ''}
      </p>
      <div className="mt-xs flex flex-wrap gap-xs">
        {inv.status === 'draft' && (
          <Button onClick={() => set.mutate('sent')} disabled={set.isPending}>
            Mark sent
          </Button>
        )}
        {inv.status === 'sent' && (
          <Button onClick={() => set.mutate('paid')} disabled={set.isPending}>
            Mark paid
          </Button>
        )}
        {inv.status !== 'void' && inv.status !== 'draft' && (
          <Button variant="ghost" onClick={() => set.mutate('void')} disabled={set.isPending}>
            Void
          </Button>
        )}
        {inv.status === 'draft' && (
          <Button variant="ghost" onClick={() => del.mutate()} disabled={del.isPending}>
            Delete
          </Button>
        )}
        {inv.status !== 'draft' && (
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(link).then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1500);
              });
            }}
            className="toy toy-soft inline-flex min-h-[48px] items-center rounded-pill bg-paper px-sm text-[14px] font-bold"
          >
            {copied ? 'Copied' : 'Copy link'}
          </button>
        )}
        {inv.status !== 'draft' && (
          <Link to={`/i/${inv.token}`} className="inline-flex min-h-[48px] items-center text-[14px] font-bold text-ink-soft underline-offset-4 hover:underline">
            Open
          </Link>
        )}
      </div>
    </li>
  );
}

function CategoryChips({ cats, value, onChange }: { cats: readonly string[]; value: string; onChange: (c: string) => void }) {
  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="text-[14px] font-bold">Category</legend>
      <div className="mt-xs flex flex-wrap gap-xs">
        {cats.map((c) => (
          <button key={c} type="button" aria-pressed={value === c} onClick={() => onChange(c)} className={`rounded-pill border-2 px-sm py-xs text-[14px] font-bold ${value === c ? 'border-ink bg-ink text-on-ink' : 'border-line bg-card'}`}>
            {c}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function AddSheet({ kind, onClose, onDone }: { kind: 'income' | 'expense' | null; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayIso);
  const [splits, setSplits] = useState<{ name: string; amount: string }[]>([]);
  const cats = kind === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  const cat = category || cats[0];
  const cleanSplits: FinanceSplit[] = splits.filter((s) => s.name.trim() && toCents(s.amount) > 0).map((s) => ({ name: s.name.trim(), cents: toCents(s.amount), status: 'due' }));
  const splitTotal = cleanSplits.reduce((a, s) => a + s.cents, 0);
  const add = useMutation({
    mutationFn: () => api.addTransaction({ kind: kind ?? 'income', amountCents: toCents(amount), category: cat, counterparty, note, date, splits: cleanSplits }),
    onSuccess: () => {
      setAmount('');
      setNote('');
      setCounterparty('');
      setSplits([]);
      onDone();
      onClose();
    },
  });
  return (
    <Sheet open={kind !== null} onClose={onClose} title={kind === 'expense' ? 'Money out' : 'Money in'}>
      <form
        className="flex flex-col gap-md"
        onSubmit={(e) => {
          e.preventDefault();
          if (toCents(amount) > 0 && splitTotal <= toCents(amount)) add.mutate();
        }}
      >
        <div className="grid grid-cols-2 gap-xs">
          <label className="block">
            <span className="block text-[14px] font-bold">Amount</span>
            <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" autoFocus required className={field} />
          </label>
          <label className="block">
            <span className="block text-[14px] font-bold">{kind === 'expense' ? 'To whom' : 'From whom'}</span>
            <input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} maxLength={80} placeholder={kind === 'expense' ? 'Editor, landlord, a tool' : 'A brand, a client'} className={field} />
          </label>
        </div>
        <CategoryChips cats={cats} value={cat} onChange={setCategory} />
        <div className="grid grid-cols-2 gap-xs">
          <label className="block">
            <span className="block text-[14px] font-bold">Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
          </label>
          <label className="block">
            <span className="block text-[14px] font-bold">Note</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} className={field} />
          </label>
        </div>
        <fieldset className="m-0 border-0 p-0">
          <legend className="text-[14px] font-bold">Splits (optional)</legend>
          <p className="m-0 text-[12px] font-semibold text-ink-soft">Shares of this amount that belong to other people, for example an editor’s cut. Each one shows as owed until you mark it paid.</p>
          <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0">
            {splits.map((s, i) => (
              <li key={i} className="grid grid-cols-[1fr_120px_44px] gap-xs">
                <input aria-label="Name" value={s.name} onChange={(e) => setSplits(splits.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder="Who" className="rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]" />
                <input aria-label="Share" inputMode="decimal" value={s.amount} onChange={(e) => setSplits(splits.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} placeholder="0.00" className="rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]" />
                <button type="button" onClick={() => setSplits(splits.filter((_, j) => j !== i))} aria-label="Remove split" className="toy toy-soft rounded-tile bg-paper text-ink-soft">
                  ×
                </button>
              </li>
            ))}
          </ul>
          <Button variant="ghost" className="mt-xs" onClick={() => setSplits([...splits, { name: '', amount: '' }])}>
            Add a split
          </Button>
          {splitTotal > toCents(amount) && toCents(amount) > 0 && (
            <p role="alert" className="m-0 text-[14px] font-bold text-r1">
              Splits add up to more than the amount.
            </p>
          )}
        </fieldset>
        {add.isError && (
          <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
            {add.error instanceof Error ? add.error.message : 'Could not save it.'}
          </p>
        )}
        <Button type="submit" size="lg" full disabled={add.isPending || toCents(amount) <= 0 || splitTotal > toCents(amount)}>
          Save
        </Button>
      </form>
    </Sheet>
  );
}

function DueSheet({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [direction, setDirection] = useState<'owed' | 'owe'>('owed');
  const [counterparty, setCounterparty] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [recurring, setRecurring] = useState(false);
  const [note, setNote] = useState('');
  const cats = direction === 'owe' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  const cat = category || cats[0];
  const add = useMutation({
    mutationFn: () => api.addDue({ direction, counterparty, amountCents: toCents(amount), category: cat, note, dueDate: dueDate || null, recurring: recurring ? 'monthly' : 'none' }),
    onSuccess: () => {
      setCounterparty('');
      setAmount('');
      setNote('');
      onDone();
      onClose();
    },
  });
  return (
    <Sheet open={open} onClose={onClose} title="Owed">
      <form
        className="flex flex-col gap-md"
        onSubmit={(e) => {
          e.preventDefault();
          if (counterparty.trim() && toCents(amount) > 0) add.mutate();
        }}
      >
        <div className="grid grid-cols-2 gap-xs" role="group" aria-label="Direction">
          {(
            [
              ['owed', 'Someone owes me'],
              ['owe', 'I owe someone'],
            ] as const
          ).map(([k, label]) => (
            <button key={k} type="button" aria-pressed={direction === k} onClick={() => { setDirection(k); setCategory(''); }} className={`toy min-h-[48px] rounded-pill border-2 text-[14px] font-bold ${direction === k ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-xs">
          <label className="block">
            <span className="block text-[14px] font-bold">Who</span>
            <input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} required maxLength={80} autoFocus className={field} />
          </label>
          <label className="block">
            <span className="block text-[14px] font-bold">Amount</span>
            <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" required className={field} />
          </label>
        </div>
        <CategoryChips cats={cats} value={cat} onChange={setCategory} />
        <div className="grid grid-cols-2 gap-xs">
          <label className="block">
            <span className="block text-[14px] font-bold">Due by</span>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={field} />
          </label>
          <label className="block">
            <span className="block text-[14px] font-bold">Note</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} className={field} />
          </label>
        </div>
        <Toggle on={recurring} onChange={setRecurring} label="Every month" hint="When you settle it, next month’s comes up by itself." />
        {add.isError && (
          <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
            {add.error instanceof Error ? add.error.message : 'Could not save it.'}
          </p>
        )}
        <Button type="submit" size="lg" full disabled={add.isPending || !counterparty.trim() || toCents(amount) <= 0}>
          Save
        </Button>
      </form>
    </Sheet>
  );
}

function RecurringSheet({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [kind, setKind] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [dayOfMonth, setDayOfMonth] = useState('1');
  const [note, setNote] = useState('');
  const cats = kind === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  const cat = category || cats[0];
  const add = useMutation({
    mutationFn: () => api.addRecurring({ kind, amountCents: toCents(amount), category: cat, counterparty, note, dayOfMonth: Number(dayOfMonth) || 1 }),
    onSuccess: () => {
      setAmount('');
      setCounterparty('');
      setNote('');
      onDone();
      onClose();
    },
  });
  return (
    <Sheet open={open} onClose={onClose} title="Repeats monthly">
      <form
        className="flex flex-col gap-md"
        onSubmit={(e) => {
          e.preventDefault();
          if (toCents(amount) > 0) add.mutate();
        }}
      >
        <div className="grid grid-cols-2 gap-xs" role="group" aria-label="Kind">
          {(
            [
              ['expense', 'Goes out'],
              ['income', 'Comes in'],
            ] as const
          ).map(([k, label]) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => { setKind(k); setCategory(''); }} className={`toy min-h-[48px] rounded-pill border-2 text-[14px] font-bold ${kind === k ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-xs">
          <label className="block">
            <span className="block text-[14px] font-bold">Amount</span>
            <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" required autoFocus className={field} />
          </label>
          <label className="block">
            <span className="block text-[14px] font-bold">Day of the month</span>
            <input type="number" min={1} max={28} value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)} className={field} />
          </label>
        </div>
        <CategoryChips cats={cats} value={cat} onChange={setCategory} />
        <div className="grid grid-cols-2 gap-xs">
          <label className="block">
            <span className="block text-[14px] font-bold">{kind === 'expense' ? 'To whom' : 'From whom'}</span>
            <input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} maxLength={80} className={field} />
          </label>
          <label className="block">
            <span className="block text-[14px] font-bold">Note</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} className={field} />
          </label>
        </div>
        <p className="m-0 text-[14px] font-semibold text-ink-soft">Posted to your entries on that day each month, starting with the next one.</p>
        <Button type="submit" size="lg" full disabled={add.isPending || toCents(amount) <= 0}>
          Save
        </Button>
      </form>
    </Sheet>
  );
}

function GoalSheet({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<'save' | 'earn'>('save');
  const [target, setTarget] = useState('');
  const [deadline, setDeadline] = useState('');
  const add = useMutation({
    mutationFn: () => api.addGoal({ title, kind, targetCents: toCents(target), deadline: deadline || null }),
    onSuccess: () => {
      setTitle('');
      setTarget('');
      onDone();
      onClose();
    },
  });
  return (
    <Sheet open={open} onClose={onClose} title="New goal">
      <form
        className="flex flex-col gap-md"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim() && toCents(target) > 0) add.mutate();
        }}
      >
        <label className="block">
          <span className="block text-[14px] font-bold">What for</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} autoFocus placeholder="A new camera, three months of rent" className={field} />
        </label>
        <div className="grid grid-cols-2 gap-xs" role="group" aria-label="Kind">
          {(
            [
              ['save', 'Save up'],
              ['earn', 'Earn'],
            ] as const
          ).map(([k, label]) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={`toy min-h-[48px] rounded-pill border-2 text-[14px] font-bold ${kind === k ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
              {label}
            </button>
          ))}
        </div>
        <p className="m-0 text-[14px] font-semibold text-ink-soft">{kind === 'save' ? 'You add what you put aside; the bar fills as you do.' : 'Income from today until the deadline counts toward it by itself.'}</p>
        <div className="grid grid-cols-2 gap-xs">
          <label className="block">
            <span className="block text-[14px] font-bold">Target</span>
            <input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="0.00" required className={field} />
          </label>
          <label className="block">
            <span className="block text-[14px] font-bold">By (optional)</span>
            <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={field} />
          </label>
        </div>
        <Button type="submit" size="lg" full disabled={add.isPending || !title.trim() || toCents(target) <= 0}>
          Save goal
        </Button>
      </form>
    </Sheet>
  );
}

function InvoiceSheet({ open, currency, onClose, onDone }: { open: boolean; currency: string; onClose: () => void; onDone: () => void }) {
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');
  const [items, setItems] = useState<{ description: string; quantity: string; unit: string }[]>([{ description: '', quantity: '1', unit: '' }]);
  const lines: InvoiceItem[] = items.filter((i) => i.description.trim()).map((i) => ({ description: i.description.trim(), quantity: Math.max(1, Number(i.quantity) || 1), unitCents: toCents(i.unit) }));
  const total = lines.reduce((a, l) => a + l.quantity * l.unitCents, 0);
  const create = useMutation({
    mutationFn: () => api.createInvoice({ clientName, clientEmail, items: lines, dueDate: dueDate || null, note, currency }),
    onSuccess: () => {
      setClientName('');
      setClientEmail('');
      setItems([{ description: '', quantity: '1', unit: '' }]);
      onDone();
      onClose();
    },
  });
  return (
    <Sheet open={open} onClose={onClose} title="New invoice">
      <form
        className="flex flex-col gap-md"
        onSubmit={(e) => {
          e.preventDefault();
          if (clientName.trim() && lines.length) create.mutate();
        }}
      >
        <label className="block">
          <span className="block text-[14px] font-bold">Client</span>
          <input value={clientName} onChange={(e) => setClientName(e.target.value)} required maxLength={120} className={field} />
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">Client email (optional)</span>
          <input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} className={field} />
        </label>
        <fieldset className="m-0 border-0 p-0">
          <legend className="text-[14px] font-bold">Lines</legend>
          <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0">
            {items.map((it, i) => (
              <li key={i} className="grid grid-cols-[1fr_64px_96px] gap-xs">
                <input aria-label="Description" value={it.description} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} placeholder="Reel, 60 seconds" className="rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]" />
                <input aria-label="Quantity" inputMode="numeric" value={it.quantity} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))} className="rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]" />
                <input aria-label="Unit price" inputMode="decimal" value={it.unit} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)))} placeholder="0.00" className="rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]" />
              </li>
            ))}
          </ul>
          <Button variant="ghost" className="mt-xs" onClick={() => setItems([...items, { description: '', quantity: '1', unit: '' }])}>
            Add a line
          </Button>
        </fieldset>
        <div className="grid grid-cols-2 gap-xs">
          <label className="block">
            <span className="block text-[14px] font-bold">Due</span>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={field} />
          </label>
          <label className="block">
            <span className="block text-[14px] font-bold">Note</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Bank details, terms" className={field} />
          </label>
        </div>
        <p className="m-0 text-[18px] font-extrabold">Total {money(total, currency)}</p>
        {create.isError && (
          <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
            {create.error instanceof Error ? create.error.message : 'Could not create it.'}
          </p>
        )}
        <Button type="submit" size="lg" full disabled={create.isPending || !clientName.trim() || lines.length === 0}>
          Create draft
        </Button>
      </form>
    </Sheet>
  );
}

function BudgetSheet({ open, summary, onClose, onDone }: { open: boolean; summary: FinanceSummary; onClose: () => void; onDone: () => void }) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(summary.budgets.map((b) => [b.category, String(b.monthlyCents / 100)])));
  const save = useMutation({
    mutationFn: () => api.setBudgets(EXPENSE_CATEGORIES.map((c) => ({ category: c, monthlyCents: toCents(values[c] ?? '') })).filter((b) => b.monthlyCents > 0)),
    onSuccess: () => {
      onDone();
      onClose();
    },
  });
  return (
    <Sheet open={open} onClose={onClose} title="Monthly budgets">
      <form
        className="flex flex-col gap-sm"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        {EXPENSE_CATEGORIES.map((c) => (
          <label key={c} className="grid grid-cols-[1fr_120px] items-center gap-xs">
            <span className="text-[14px] font-bold">{c}</span>
            <input inputMode="decimal" value={values[c] ?? ''} onChange={(e) => setValues({ ...values, [c]: e.target.value })} placeholder="0" className="rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]" />
          </label>
        ))}
        <Button type="submit" size="lg" full disabled={save.isPending}>
          Save budgets
        </Button>
      </form>
    </Sheet>
  );
}

const SLICE_COLORS = ['var(--color-r2)', 'var(--color-r6)', 'var(--color-r3)', 'var(--color-r4)', 'var(--color-r5)', 'var(--color-r1)', 'var(--color-r7)'];

/** Where the month's money went, as the kit draws a share: a donut with a legend beside it. */
function CategoryDonut({ byCategory, currency }: { byCategory: FinanceSummary['byCategory']; currency: string }) {
  const expenses = byCategory.filter((c) => c.kind === 'expense' && c.cents > 0).sort((a, b) => b.cents - a.cents);
  const rows = expenses.length > 0 ? expenses : byCategory.filter((c) => c.kind === 'income' && c.cents > 0).sort((a, b) => b.cents - a.cents);
  const kind = expenses.length > 0 ? 'out' : 'in';
  const top = rows.slice(0, 6);
  const rest = rows.slice(6).reduce((s, c) => s + c.cents, 0);
  const slices = [...top.map((c, i) => ({ value: c.cents, color: SLICE_COLORS[i % SLICE_COLORS.length] ?? 'var(--color-r2)', label: c.category })), ...(rest > 0 ? [{ value: rest, color: 'var(--color-line)', label: 'Everything else' }] : [])];
  const total = slices.reduce((s, c) => s + c.value, 0);
  return (
    <div className="mt-sm flex items-center gap-md rounded-tile bg-card p-sm shadow-toy-soft">
      <Donut segments={slices} size={132} stroke={20} label={`Money ${kind} by category this month`}>
        <span className="flex flex-col items-center leading-none">
          <span className="font-display text-[18px] font-extrabold">{money(total, currency)}</span>
          <span className="mt-xs text-[12px] font-bold text-ink-soft">{kind}</span>
        </span>
      </Donut>
      <div className="min-w-0 flex-1">
        <p className="m-0 text-[14px] font-bold">{kind === 'out' ? 'Where it went' : 'Where it came from'}</p>
        <div className="mt-xs">{slices.length > 0 ? <Legend items={slices.map((c) => ({ color: c.color, label: c.label, text: money(c.value, currency) }))} /> : <p className="m-0 text-[14px] font-semibold text-ink-soft">Nothing this month yet.</p>}</div>
      </div>
    </div>
  );
}
