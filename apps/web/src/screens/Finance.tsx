import { EXPENSE_CATEGORIES, formatCount, INCOME_CATEGORIES, LOCALE, money, MONTH_RE, monthShift, type FinanceDue, type FinanceGoal, type FinanceRecurring, type FinanceSplit, type FinanceSummary, type FinanceTransaction, typedCents } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { PeriodPanel } from '../components/PeriodPanel';
import { Button } from '../components/Button';
import { Donut, Legend, MultiLine, StatTile } from '../components/Charts';
import { Pager, usePage } from '../components/Pager';
import { AppCover } from '../components/AppCover';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { ConfirmDelete } from '../components/ConfirmDelete';
import { Toggle } from '../components/Toggle';
import { api } from '../lib/api';
import { shortDate, todayLocal } from '../lib/date';
import { FIELD, FIELD_LINE } from '../lib/ui';
import { useParamState } from '../lib/useParamState';
import { Fold } from '../components/Fold';

import { useAuthed } from '../lib/queries';
import { EmergenceSlot } from '../components/EmergenceSlot';

const monthName = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString(LOCALE, { month: 'short', year: 'numeric' });
const shortMonth = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString(LOCALE, { month: 'short' });
const day = (d: string) => shortDate(d);
const shiftMonth = monthShift;
/** A typed amount in cents through `typedCents` ("1,250.50" and "₹1.005" read right, a minus kept); junk reads as 0, so the form stays shut. */
const toCents = (v: string): number => {
  const c = typedCents(v);
  return Number.isInteger(c) ? c : 0;
};

type SheetKind = 'income' | 'expense' | 'budgets' | 'due' | 'recurring' | 'goal' | null;

/** Money in, money out, who it was with, what is owed, what repeats, and where you are heading. Private to the person. */
export function Finance() {
  const thisMonth = new Date().toISOString().slice(0, 7);
  // The month lives in the URL, so Back and a link keep it; changing it also drops the entries' page, in one navigation (writeParams composes the two).
  const [monthRaw, setMonth] = useParamState('month', thisMonth);
  const month = MONTH_RE.test(monthRaw) && monthRaw <= thisMonth ? monthRaw : thisMonth;
  const txPage = usePage('tx');
  const duPage = usePage('du');
  const q = useAuthed(['finance', month, txPage.query, duPage.query], () => api.finance(month, txPage.query, duPage.query));
  const d = q.data;
  const [sheet, setSheet] = useState<SheetKind>(null);
  const refetch = () => void q.refetch();

  return (
    <Screen>
      <AppCover back={{ to: '/apps', label: 'Apps' }} title="Finance" lede="Money in, money out, who with, what is owed, what repeats, and your goals. Only you can see this.">
        {d && (
          <div className="mt-md grid grid-cols-2 gap-xs md:grid-cols-4" aria-label="All time">
            <Stat label="earned, all time" value={money(d.totals.incomeCents, d.currency)} tone="var(--tint-green)" />
            <Stat label="spent, all time" value={money(d.totals.expenseCents, d.currency)} tone="var(--tint-red)" />
            <Stat label="kept" value={money(d.totals.netCents, d.currency)} tone={d.totals.netCents >= 0 ? 'var(--tint-yellow)' : 'var(--tint-red)'} />
            <Stat label="platform points, all time" value={formatCount(d.totals.platformPoints)} tone="var(--tint-purple)" />
          </div>
        )}
        {/* Logging money is what Finance is for, so Money in and Money out are the two solid buttons; the rest are quieter. */}
        <div className="mt-md grid grid-cols-2 gap-xs">
          <Button full onClick={() => setSheet('income')}>
            Money in
          </Button>
          <Button full onClick={() => setSheet('expense')}>
            Money out
          </Button>
        </div>
        <div className="mt-xs grid grid-cols-2 gap-xs md:grid-cols-4">
          <Button variant="outline" size="sm" full onClick={() => setSheet('due')}>
            Owed
          </Button>
          <Button variant="outline" size="sm" full onClick={() => setSheet('recurring')}>
            Monthly
          </Button>
          <Button variant="outline" size="sm" full onClick={() => setSheet('goal')}>
            Goal
          </Button>
          <Button variant="outline" size="sm" full onClick={() => setSheet('budgets')}>
            Budgets
          </Button>
        </div>
      </AppCover>

      {q.isError && (
        <p role="alert" className="span-all mt-md m-0 rounded-tile bg-r1/15 p-sm text-subhead">
          Could not load your numbers. Try again in a moment.
        </p>
      )}

      {d && (
        <>
          <PeriodPanel id="finance-period" parts={['finance', 'shop']} />
          <EmergenceSlot app="finance" max={2} />
          <section className="mt-lg" aria-labelledby="month-heading">
            <div className="flex items-center justify-between gap-xs">
              <button type="button" onClick={() => { setMonth(shiftMonth(month, -1)); txPage.reset(); }} aria-label="Previous month" className="toy toy-soft flex size-[44px] items-center justify-center rounded-pill bg-card text-headline">
                ‹
              </button>
              <h2 id="month-heading" className="m-0 text-title2">
                {monthName(month)}
              </h2>
              <button type="button" onClick={() => { setMonth(shiftMonth(month, 1)); txPage.reset(); }} disabled={month >= thisMonth} aria-label="Next month" className="toy toy-soft flex size-[44px] items-center justify-center rounded-pill bg-card text-headline disabled:opacity-40">
                ›
              </button>
            </div>
            <div className="mt-sm grid grid-cols-2 gap-xs" aria-label="This month">
              <Stat label="in" value={money(d.incomeCents, d.currency)} tone="var(--tint-green)" />
              <Stat label="out" value={money(d.expenseCents, d.currency)} tone="var(--tint-red)" />
              <Stat label="net" value={money(d.netCents, d.currency)} tone={d.netCents >= 0 ? 'var(--tint-yellow)' : 'var(--tint-red)'} />
              <Stat label="platform points" value={formatCount(d.platformPoints)} tone="var(--tint-purple)" />
            </div>
            <MonthBars months={d.months} currency={d.currency} />
            <CategoryDonut byCategory={d.byCategory} currency={d.currency} />
          </section>

          <section className="mt-lg" aria-labelledby="owed-heading">
            <h2 id="owed-heading" className="text-title2">
              Owed
            </h2>
            <p className="mt-xs m-0 text-subhead text-ink-soft">
              {d.owedToMeCents > 0 || d.iOweCents > 0 ? (
                <>
                  <span className="font-bold text-ink">{money(d.owedToMeCents, d.currency)}</span> coming to you, <span className="font-bold text-ink">{money(d.iOweCents, d.currency)}</span> to pay out.
                </>
              ) : (
                d.owedToYou.length > 0 ? 'Your sent invoices are below. Add anything else someone owes you, or you owe, and settle it when the money moves.' : 'Nothing outstanding. Add what someone owes you, or what you owe someone, and settle it when the money moves.'
              )}
            </p>
            {d.owedToYou.length > 0 && (
              <div className="mt-sm grid grid-cols-1 gap-xs sm:grid-cols-2" data-pillar="self" aria-label="Agency invoices owed to you">
                {d.owedToYou.map((o) => (
                  <StatTile
                    key={o.currency}
                    to="/agency?tab=invoices"
                    label="Owed to you, invoices"
                    value={money(o.cents, o.currency)}
                    tone="var(--tint-sky)"
                    hint={`${o.count} sent and not paid${o.overdue > 0 ? `, ${o.overdue} past due` : ''}. Paid ones count as income.`}
                  />
                ))}
              </div>
            )}
            <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
              {d.dues
                .filter((x) => x.status === 'open')
                .map((x) => (
                  <DueRow key={x.id} due={x} currency={d.currency} onChange={refetch} />
                ))}
            </ul>
            {d.dues.some((x) => x.status === 'settled') && (
              <Fold className="mt-xs" title="Settled" hint={String(d.dues.filter((x) => x.status === 'settled').length)}>
                <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0">
                  {d.dues
                    .filter((x) => x.status === 'settled')
                    .map((x) => (
                      <DueRow key={x.id} due={x} currency={d.currency} onChange={refetch} />
                    ))}
                </ul>
              </Fold>
            )}
            <Pager page={d.duePage} prefix="du" label="dues" />
          </section>

          <section className="mt-lg" aria-labelledby="goals-heading">
            <h2 id="goals-heading" className="text-title2">
              Goals
            </h2>
            {d.goals.length === 0 && <p className="mt-xs m-0 text-subhead text-ink-soft">A saving goal fills as you put money aside. An earning goal fills from income by itself.</p>}
            <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
              {d.goals.map((g) => (
                <GoalRow key={g.id} goal={g} currency={d.currency} onChange={refetch} />
              ))}
            </ul>
          </section>

          <section className="mt-lg" aria-labelledby="recurring-heading">
            <h2 id="recurring-heading" className="text-title2">
              Repeats monthly
            </h2>
            {d.recurring.length === 0 && <p className="mt-xs m-0 text-subhead text-ink-soft">Subscriptions, rent, a retainer. Posted on the day you pick, every month.</p>}
            <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
              {d.recurring.map((r) => (
                <RecurringRow key={r.id} r={r} currency={d.currency} onChange={refetch} />
              ))}
            </ul>
          </section>

          {d.byCategory.length > 0 && (
            <section className="mt-lg" aria-labelledby="cats-heading">
              <h2 id="cats-heading" className="text-title2">
                By category
              </h2>
              <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
                {d.byCategory.map((c) => {
                  const total = c.kind === 'income' ? d.incomeCents : d.expenseCents;
                  return (
                    <li key={`${c.kind}-${c.category}`} className="rounded-tile bg-card p-sm shadow-toy-soft">
                      <div className="flex items-baseline justify-between gap-sm">
                        <p className="m-0 text-headline">
                          {c.category} <span className="text-eyebrow uppercase text-ink-mute">{c.kind === 'income' ? 'in' : 'out'}</span>
                        </p>
                        <p className="m-0 text-headline">{money(c.cents, d.currency)}</p>
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
              <h2 id="budgets-heading" className="text-title2">
                Budgets
              </h2>
              <Button variant="ghost" onClick={() => setSheet('budgets')}>
                {d.budgets.length ? 'Edit' : 'Set budgets'}
              </Button>
            </div>
            {d.budgets.length === 0 && <p className="mt-xs m-0 text-subhead text-ink-soft">A monthly ceiling per expense category. The bar fills as you spend.</p>}
            <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
              {d.budgets.map((b) => {
                const pct = Math.round((b.spentCents / Math.max(1, b.monthlyCents)) * 100);
                return (
                  <li key={b.category} className="rounded-tile bg-card p-sm shadow-toy-soft">
                    <div className="flex items-baseline justify-between gap-sm">
                      <p className="m-0 text-headline">{b.category}</p>
                      <p className={`m-0 text-subhead ${pct > 100 ? 'text-r1' : 'text-ink-soft'}`}>
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

          <section className="mt-lg" aria-labelledby="tx-heading">
            <h2 id="tx-heading" className="text-title2">
              Entries, {monthName(month)}
            </h2>
            {d.transactions.length === 0 && <p className="mt-xs m-0 text-subhead text-ink-soft">Nothing logged this month yet.</p>}
            {d.transactions.some((t) => t.currency && t.currency !== d.currency) && (
              <p className="mt-xs m-0 text-subhead text-ink-soft">The totals count only {d.currency}. Entries in another currency are listed here and not added in.</p>
            )}
            <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
              {d.transactions.map((t) => (
                <TxRow key={t.id} t={t} currency={d.currency} onChange={refetch} />
              ))}
            </ul>
            <Pager page={d.txPage} prefix="tx" label="entries" />
          </section>

          <AddSheet kind={sheet === 'income' || sheet === 'expense' ? sheet : null} onClose={() => setSheet(null)} onDone={refetch} />
          <DueSheet open={sheet === 'due'} onClose={() => setSheet(null)} onDone={refetch} />
          <RecurringSheet open={sheet === 'recurring'} onClose={() => setSheet(null)} onDone={refetch} />
          <GoalSheet open={sheet === 'goal'} onClose={() => setSheet(null)} onDone={refetch} />
          <BudgetSheet open={sheet === 'budgets'} summary={d} onClose={() => setSheet(null)} onDone={refetch} />
        </>
      )}
    </Screen>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-tile p-sm" style={{ background: tone }}>
      <p className="m-0 truncate text-title2 type-figure leading-none">{value}</p>
      <p className="mt-xs m-0 text-caption text-ink-soft">{label}</p>
    </div>
  );
}

function MonthBars({ months, currency }: { months: FinanceSummary['months']; currency: string }) {
  // Six months with nothing logged are all zero, not missing: a floor of one cent would print ₹0 at every y line. Read
  // as no data instead, so the chart's own empty message shows rather than a flat zero axis repeated three times.
  const allZero = months.every((m) => m.incomeCents === 0 && m.expenseCents === 0);
  // The frame still draws its y labels when empty, so give it a round top (₹1,000): ₹0, ₹500, ₹1,000.
  const max = allZero ? 100_000 : Math.max(1, ...months.flatMap((m) => [m.incomeCents, m.expenseCents]));
  const last = months.at(-1);
  return (
    <div className="mt-sm rounded-tile bg-card p-sm shadow-toy-soft">
      <MultiLine
        series={[
          { values: months.map((m) => (allZero ? null : m.incomeCents)), color: 'var(--color-r4)', label: 'in' },
          { values: months.map((m) => (allZero ? null : m.expenseCents)), color: 'var(--color-r2)', label: 'out' },
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
        <p className="mt-xs m-0 text-caption text-ink-soft">
          {shortMonth(last.month)}: {money(last.incomeCents, currency)} in, {money(last.expenseCents, currency)} out.
        </p>
      )}
    </div>
  );
}

function TxRow({ t, currency, onChange }: { t: FinanceTransaction; currency: string; onChange: () => void }) {
  const [asking, setAsking] = useState(false);
  const del = useMutation({
    mutationFn: () => api.deleteTransaction(t.id),
    onSuccess: () => {
      setAsking(false);
      onChange();
    },
  });
  const paySplit = useMutation({
    mutationFn: (i: number) => api.updateTransaction(t.id, { splits: t.splits.map((s, j) => (j === i ? { ...s, status: s.status === 'paid' ? 'due' : 'paid' } : s)) }),
    onSuccess: onChange,
  });
  const sign = t.kind === 'income' ? '+' : '−';
  return (
    <li className={`rounded-tile bg-card p-sm shadow-toy-soft`}>
      <div className="flex items-center gap-sm">
        <span className={`flex size-[40px] shrink-0 items-center justify-center rounded-pill text-headline ${t.kind === 'income' ? 'bg-r4 text-on-fill' : 'bg-r2 text-on-fill'}`} aria-hidden="true">
          {sign}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-card-title"> {t.category}
            {t.counterparty ? <span className="text-ink-soft"> {t.kind === 'income' ? 'from' : 'to'} {t.counterparty}</span> : ''}
          </span>
          <span className="block truncate text-card-note text-ink-soft">
            {day(t.date)}
            {t.note ? `, ${t.note}` : ''}
            {t.source === 'invoice' ? ', from an invoice' : t.source === 'due' ? ', settled a due' : t.source === 'recurring' ? ', monthly' : ''}
          </span>
        </span>
        <span className="shrink-0 text-headline">{money(t.kind === 'income' ? t.amountCents : -t.amountCents, t.currency || currency)}</span>
        {t.source === 'manual' && (
          <button type="button" onClick={() => setAsking(true)} disabled={del.isPending} aria-label="Remove" className="toy toy-soft flex size-[44px] shrink-0 items-center justify-center rounded-pill bg-paper text-ink-soft">
            ×
          </button>
        )}
      </div>
      {t.splits.length > 0 && (
        <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0 pl-xl">
          {t.splits.map((s, i) => (
            <li key={`${s.name}-${i}`} className="flex items-center justify-between gap-xs text-subhead text-ink-soft">
              <span>
                {s.name}’s share {money(s.cents, t.currency || currency)}
              </span>
              <button type="button" onClick={() => paySplit.mutate(i)} disabled={paySplit.isPending} className={`toy toy-soft min-h-[44px] rounded-pill px-sm text-caption font-medium ${s.status === 'paid' ? 'bg-r4 text-on-fill' : 'bg-paper'}`}>
                {s.status === 'paid' ? 'Paid' : 'Mark paid'}
              </button>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDelete
        open={asking}
        title="Delete this transaction?"
        body={`${t.category}, ${money(t.amountCents, t.currency || currency)}, comes off your books and your totals. This cannot be undone.`}
        pending={del.isPending}
        failed={del.isError}
        onYes={() => del.mutate()}
        onClose={() => setAsking(false)}
      />
    </li>
  );
}

function DueRow({ due, currency, onChange }: { due: FinanceDue; currency: string; onChange: () => void }) {
  const settle = useMutation({ mutationFn: () => api.settleDue(due.id, todayLocal()), onSuccess: onChange });
  const [asking, setAsking] = useState(false);
  const del = useMutation({
    mutationFn: () => api.deleteDue(due.id),
    onSuccess: () => {
      setAsking(false);
      onChange();
    },
  });
  const overdue = due.status === 'open' && due.dueDate && due.dueDate < todayLocal();
  return (
    <li className={`rounded-tile bg-card p-sm shadow-toy-soft ${due.status === 'settled' ? 'opacity-70' : ''}`}>
      <div className="flex items-center gap-sm">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-card-title">
            {due.direction === 'owed' ? `${due.counterparty} owes you` : `You owe ${due.counterparty}`}
          </span>
          <span className={`block text-card-note ${overdue ? 'text-r1' : 'text-ink-soft'}`}>
            {due.dueDate ? `${overdue ? 'was due' : 'due'} ${day(due.dueDate)}` : 'no date'}
            {due.recurring === 'monthly' ? ', every month' : ''}
            {due.note ? `, ${due.note}` : ''}
            {due.settledAt ? `, settled ${shortDate(due.settledAt)}` : ''}
          </span>
        </span>
        <span className="shrink-0 text-headline">{money(due.amountCents, due.currency || currency)}</span>
      </div>
      {due.status === 'open' && (
        <div className="mt-xs flex gap-xs">
          <Button onClick={() => settle.mutate()} disabled={settle.isPending}>
            {due.direction === 'owed' ? 'Received' : 'Paid'}
          </Button>
          <Button variant="ghost" onClick={() => setAsking(true)} disabled={del.isPending}>
            Remove
          </Button>
        </div>
      )}
      <ConfirmDelete
        open={asking}
        title="Remove this due?"
        body={`${due.direction === 'owed' ? `What ${due.counterparty} owes you` : `What you owe ${due.counterparty}`} is no longer tracked. This cannot be undone.`}
        yes="Yes, remove it"
        pending={del.isPending}
        failed={del.isError}
        onYes={() => del.mutate()}
        onClose={() => setAsking(false)}
      />
    </li>
  );
}

function RecurringRow({ r, currency, onChange }: { r: FinanceRecurring; currency: string; onChange: () => void }) {
  const set = useMutation({ mutationFn: (active: boolean) => api.setRecurring(r.id, active), onSuccess: onChange });
  const [asking, setAsking] = useState(false);
  const del = useMutation({
    mutationFn: () => api.deleteRecurring(r.id),
    onSuccess: () => {
      setAsking(false);
      onChange();
    },
  });
  return (
    <li className="rounded-tile bg-card p-sm shadow-toy-soft">
      <Toggle
        on={r.active}
        onChange={(on) => set.mutate(on)}
        label={`${r.kind === 'income' ? '+' : '−'}${money(r.amountCents, r.currency || currency)} ${r.category}${r.counterparty ? `, ${r.counterparty}` : ''}`}
        hint={`Day ${r.dayOfMonth} of the month, next on ${day(r.nextDate)}${r.note ? `, ${r.note}` : ''}`}
        disabled={set.isPending}
      />
      <Button variant="ghost" className="mt-xs" onClick={() => setAsking(true)} disabled={del.isPending}>
        Remove
      </Button>
      <ConfirmDelete
        open={asking}
        title="Remove this monthly item?"
        body={`${r.category} stops being added each month. What it already added stays. This cannot be undone.`}
        yes="Yes, remove it"
        pending={del.isPending}
        failed={del.isError}
        onYes={() => del.mutate()}
        onClose={() => setAsking(false)}
      />
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
  const [asking, setAsking] = useState(false);
  const del = useMutation({
    mutationFn: () => api.deleteGoal(goal.id),
    onSuccess: () => {
      setAsking(false);
      onChange();
    },
  });
  const pct = Math.min(100, Math.round((goal.progressCents / Math.max(1, goal.targetCents)) * 100));
  return (
    <li className="rounded-tile bg-card p-sm shadow-toy-soft">
      <div className="flex items-baseline justify-between gap-sm">
        <p className="m-0 text-headline">
          {goal.title} <span className="text-eyebrow uppercase text-ink-mute">{goal.kind === 'earn' ? 'earn' : 'save'}</span>
        </p>
        <p className="m-0 text-subhead text-ink-soft">
          {money(goal.progressCents, currency)} of {money(goal.targetCents, currency)}
        </p>
      </div>
      <div className="mt-xs h-[8px] overflow-hidden rounded-pill bg-line" aria-hidden="true">
        <div className={`h-full rounded-pill ${pct >= 100 ? 'bg-r4' : 'bg-r6'}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-xs m-0 text-caption text-ink-soft">
        {pct}%{goal.deadline ? `, by ${day(goal.deadline)}` : ''}
        {goal.kind === 'earn' ? `, counting income since ${day(goal.startDate)}` : ''}
      </p>
      <div className="mt-xs flex flex-wrap items-center gap-xs">
        {goal.kind === 'save' && (
          // The amount field grows to fill the row, Add beside it and Remove at the end (the form rules, 2026-11-06).
          <form
            className="flex min-w-0 flex-1 basis-[220px] gap-xs"
            onSubmit={(e) => {
              e.preventDefault();
              if (toCents(amount) !== 0) add.mutate();
            }}
          >
            <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Put aside" aria-label="Amount to put aside" className={`${FIELD_LINE} min-w-0 flex-1`} />
            <Button variant="outline" type="submit" disabled={add.isPending || toCents(amount) === 0}>
              Add
            </Button>
          </form>
        )}
        <Button variant="ghost" onClick={() => setAsking(true)} disabled={del.isPending}>
          Remove
        </Button>
      </div>
      <ConfirmDelete
        open={asking}
        title="Remove this goal?"
        body={`“${goal.title}” and its progress are gone. This cannot be undone.`}
        yes="Yes, remove it"
        pending={del.isPending}
        failed={del.isError}
        onYes={() => del.mutate()}
        onClose={() => setAsking(false)}
      />
    </li>
  );
}

function CategoryChips({ cats, value, onChange }: { cats: readonly string[]; value: string; onChange: (c: string) => void }) {
  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="text-subhead font-semibold">Category</legend>
      <div className="mt-xs flex flex-wrap gap-xs">
        {cats.map((c) => (
          <button key={c} type="button" aria-pressed={value === c} onClick={() => onChange(c)} className={`min-h-[44px] rounded-pill border-2 px-sm py-xs text-subhead font-medium ${value === c ? 'border-ink bg-ink text-on-ink' : 'border-line bg-card'}`}>
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
  const [date, setDate] = useState(todayLocal);
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
            <span className="block text-subhead font-semibold">Amount</span>
            <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" autoFocus required className={FIELD} />
          </label>
          <label className="block">
            <span className="block text-subhead font-semibold">{kind === 'expense' ? 'To whom' : 'From whom'}</span>
            <input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} maxLength={80} placeholder={kind === 'expense' ? 'Editor, landlord, a tool' : 'A brand, a client'} className={FIELD} />
          </label>
        </div>
        <CategoryChips cats={cats} value={cat} onChange={setCategory} />
        <div className="grid grid-cols-2 gap-xs">
          <label className="block">
            <span className="block text-subhead font-semibold">Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={FIELD} />
          </label>
          <label className="block">
            <span className="block text-subhead font-semibold">Note</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} className={FIELD} />
          </label>
        </div>
        <fieldset className="m-0 border-0 p-0">
          <legend className="text-subhead font-semibold">Splits (optional)</legend>
          <p className="m-0 text-caption text-ink-soft">Shares that belong to others, like an editor’s cut. Each stays owed until you mark it paid.</p>
          <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0">
            {splits.map((s, i) => (
              <li key={i} className="grid grid-cols-[1fr_120px_44px] gap-xs">
                <input aria-label="Name" value={s.name} onChange={(e) => setSplits(splits.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder="Who" className={FIELD_LINE} />
                <input aria-label="Share" inputMode="decimal" value={s.amount} onChange={(e) => setSplits(splits.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} placeholder="0.00" className={FIELD_LINE} />
                <button type="button" onClick={() => setSplits(splits.filter((_, j) => j !== i))} aria-label="Remove split" className="toy toy-soft rounded-tile bg-paper text-ink-soft">
                  ×
                </button>
              </li>
            ))}
          </ul>
          <Button variant="ghost" className="mt-xs" full onClick={() => setSplits([...splits, { name: '', amount: '' }])}>
            Add a split
          </Button>
          {splitTotal > toCents(amount) && toCents(amount) > 0 && (
            <p role="alert" className="m-0 text-subhead text-r1">
              Splits add up to more than the amount.
            </p>
          )}
        </fieldset>
        {add.isError && (
          <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-subhead">
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
            <button key={k} type="button" aria-pressed={direction === k} onClick={() => { setDirection(k); setCategory(''); }} className={`toy min-h-[48px] rounded-pill border-2 text-subhead font-medium ${direction === k ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-xs">
          <label className="block">
            <span className="block text-subhead font-semibold">Who</span>
            <input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} required maxLength={80} autoFocus className={FIELD} />
          </label>
          <label className="block">
            <span className="block text-subhead font-semibold">Amount</span>
            <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" required className={FIELD} />
          </label>
        </div>
        <CategoryChips cats={cats} value={cat} onChange={setCategory} />
        <div className="grid grid-cols-2 gap-xs">
          <label className="block">
            <span className="block text-subhead font-semibold">Due by</span>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={FIELD} />
          </label>
          <label className="block">
            <span className="block text-subhead font-semibold">Note</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} className={FIELD} />
          </label>
        </div>
        <Toggle on={recurring} onChange={setRecurring} label="Every month" hint="When you settle it, next month’s comes up by itself." />
        {add.isError && (
          <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-subhead">
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
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => { setKind(k); setCategory(''); }} className={`toy min-h-[48px] rounded-pill border-2 text-subhead font-medium ${kind === k ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-xs">
          <label className="block">
            <span className="block text-subhead font-semibold">Amount</span>
            <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" required autoFocus className={FIELD} />
          </label>
          <label className="block">
            <span className="block text-subhead font-semibold">Day of the month</span>
            <input type="number" min={1} max={28} value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)} className={FIELD} />
          </label>
        </div>
        <CategoryChips cats={cats} value={cat} onChange={setCategory} />
        <div className="grid grid-cols-2 gap-xs">
          <label className="block">
            <span className="block text-subhead font-semibold">{kind === 'expense' ? 'To whom' : 'From whom'}</span>
            <input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} maxLength={80} className={FIELD} />
          </label>
          <label className="block">
            <span className="block text-subhead font-semibold">Note</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} className={FIELD} />
          </label>
        </div>
        <p className="m-0 text-subhead text-ink-soft">Posted to your entries on that day each month, starting with the next one.</p>
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
          <span className="block text-subhead font-semibold">What for</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} autoFocus placeholder="A new camera, three months of rent" className={FIELD} />
        </label>
        <div className="grid grid-cols-2 gap-xs" role="group" aria-label="Kind">
          {(
            [
              ['save', 'Save up'],
              ['earn', 'Earn'],
            ] as const
          ).map(([k, label]) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={`toy min-h-[48px] rounded-pill border-2 text-subhead font-medium ${kind === k ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
              {label}
            </button>
          ))}
        </div>
        <p className="m-0 text-subhead text-ink-soft">{kind === 'save' ? 'You add what you put aside; the bar fills as you do.' : 'Income from today until the deadline counts toward it by itself.'}</p>
        <div className="grid grid-cols-2 gap-xs">
          <label className="block">
            <span className="block text-subhead font-semibold">Target</span>
            <input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="0.00" required className={FIELD} />
          </label>
          <label className="block">
            <span className="block text-subhead font-semibold">By (optional)</span>
            <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={FIELD} />
          </label>
        </div>
        <Button type="submit" size="lg" full disabled={add.isPending || !title.trim() || toCents(target) <= 0}>
          Save goal
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
            <span className="text-subhead font-semibold">{c}</span>
            <input inputMode="decimal" value={values[c] ?? ''} onChange={(e) => setValues({ ...values, [c]: e.target.value })} placeholder="0" className={FIELD_LINE} />
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
          <span className="text-title3 type-figure">{money(total, currency)}</span>
          <span className="mt-xs text-caption text-ink-soft">{kind}</span>
        </span>
      </Donut>
      <div className="min-w-0 flex-1">
        <p className="m-0 text-subhead font-semibold">{kind === 'out' ? 'Where it went' : 'Where it came from'}</p>
        <div className="mt-xs">{slices.length > 0 ? <Legend items={slices.map((c) => ({ color: c.color, label: c.label, text: money(c.value, currency) }))} /> : <p className="m-0 text-subhead text-ink-soft">Nothing this month yet.</p>}</div>
      </div>
    </div>
  );
}
