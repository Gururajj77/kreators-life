import { formatCount, money as sharedMoney, periodFor, type Period } from '@kreators/shared';
import { Suspense, useState } from 'react';
import { api } from '../lib/api';
import { todayLocal } from '../lib/date';
import { lazyNamed } from '../lib/lazy';
import { useAuthed } from '../lib/queries';
import { PeriodFilter } from './PeriodFilter';
import { Section, SeeAll } from './Section';

/**
 * The parts a "By period" block or Reviews can show. The fuller ones (2026-11-07): `tasksMore` (habits ticked, P0 and P1 done, overdue, routine days),
 * `water`, `focus`, `moneyMore` (budgets over, dues at the end, savings goals) and `supplements` (Reviews only; the server sends it nowhere
 * else).
 */
export type SummaryPart = 'daily' | 'tasksMore' | 'kinds' | 'notToDo' | 'wellbeing' | 'water' | 'focus' | 'fitness' | 'supplements' | 'journal' | 'finance' | 'moneyMore' | 'shop' | 'school' | 'work' | 'people';

/** The tiles themselves are their own chunk (components/SummaryTiles.tsx, 2026-11-07), downloaded after the first paint. */
const SummaryTiles = lazyNamed(() => import('./SummaryTiles'), 'SummaryTiles');

/** A whole-unit amount for a tile (no cents), unlike shared `money()`, which keeps them. To the nearest whole rupee (or dollar), with its symbol and the person's grouping: "₹12,500". Integer maths only. */
export const moneyRounded = (cents: number, currency: string) => sharedMoney(Math.round(cents / 100) * 100, currency);

/** @deprecated The old name, kept only until ListingSheet (owned by another stream) imports `moneyRounded`; prefer shared `money()`. */
export const money = moneyRounded;

/** "up 3 on the week before", "same as the month before", or what was missing. */
export function delta(now: number | null, before: number | null, previous: string, digits = 0): string {
  if (now === null) return 'nothing logged';
  if (before === null) return `nothing logged ${previous}`;
  const d = now - before;
  if (Math.abs(d) < (digits ? 0.05 : 0.5)) return `same as ${previous}`;
  const text = digits ? Math.abs(d).toFixed(digits) : formatCount(Math.abs(d));
  return `${d > 0 ? 'up' : 'down'} ${text} on ${previous}`;
}

/** The same for money, from whole cents: "up ₹12,54,500 on the week before". */
export function moneyDelta(nowCents: number, beforeCents: number, previous: string, currency: string): string {
  const d = Math.round(nowCents / 100) - Math.round(beforeCents / 100);
  if (d === 0) return `same as ${previous}`;
  return `${d > 0 ? 'up' : 'down'} ${moneyRounded(Math.abs(d) * 100, currency)} on ${previous}`;
}

export function usePeriodSummary(period: Period) {
  return useAuthed(['reviews', 'summary', period.kind, period.start], () => api.reviewSummary(period.kind, period.start));
}

/** The period filter and its numbers, dropped into any dashboard. Which parts show is the dashboard's choice. */
export function PeriodPanel({ id, parts, title = 'By period', span = false, keep, whole }: { id: string; parts: readonly SummaryPart[]; title?: string; span?: boolean; /** Which tiles and links stay, by the page they open (Home drops those of apps that are off). */ keep?: (to: string | undefined) => boolean; /** Why this block stays one even block past the limit (`TileGroups`); Home's alone. */ whole?: string }) {
  const today = todayLocal();
  const [period, setPeriod] = useState<Period>(() => periodFor('week', today));
  const q = usePeriodSummary(period);
  return (
    <Section
      id={id}
      title={title}
      lede="The same numbers by day, week, month, quarter or half year, next to the one before."
      span={span}
      action={!keep || keep('/reviews') ? <SeeAll to="/reviews">Review it</SeeAll> : undefined}
    >
      <PeriodFilter period={period} onChange={setPeriod} today={today} />
      <div className="mt-sm">
        {q.data ? (
          <Suspense fallback={<p className="m-0 text-subhead text-ink-soft" role="status">Adding up your numbers</p>}>
            <SummaryTiles summary={q.data} parts={parts} keep={keep} whole={whole} />
          </Suspense>
        ) : (
          <p className="m-0 text-subhead text-ink-soft" role="status">
            {q.isError ? 'Could not load this period. Try another one.' : 'Adding up your numbers'}
          </p>
        )}
      </div>
    </Section>
  );
}
