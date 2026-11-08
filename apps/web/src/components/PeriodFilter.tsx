import { DASHBOARD_PERIODS, PERIOD_META, periodFor, periodLabel, periodShift, type Period, type PeriodKind } from '@kreators/shared';

interface Props {
  /** The period picked; null is none yet (Emerging's last eight weeks), which needs `blank`. */
  period: Period | null;
  /** What the row under the pills says while no period is picked. */
  blank?: string;
  onChange: (p: Period) => void;
  /** The person's local date; nothing after its period can be picked. */
  today: string;
  /** The periods on offer: the dashboards' five unless given (Reviews adds the year). */
  kinds?: readonly PeriodKind[];
  /** Which period a tap on a kind opens: the one the day is in unless given (Reviews opens a half or a year by `reviewPeriodNow`). */
  pick?: (kind: PeriodKind, today: string) => Period;
}

/**
 * The grid for a row of periods, by the room it has. Four: one row from 23rem, two by two below. Five (the dashboards, with the day): one
 * row from 30rem, below that three over two, each row filled, so no pill is ever left alone on a line. Six (Reviews, the day to the year,
 * 2026-11-07): one row from 36rem, where "Half year" still fits its sixth, and three over three below.
 */
export const periodGrid = (n: number) =>
  n === 6 ? 'grid grid-cols-3 gap-xs @min-[36rem]:grid-cols-6' : n === 5 ? 'grid grid-cols-6 gap-xs @min-[30rem]:grid-cols-5' : 'grid grid-cols-4 gap-xs @max-[23rem]:grid-cols-2';
export const periodCell = (i: number, n: number) => (n === 5 ? (i < 3 ? 'col-span-2 @min-[30rem]:col-span-1' : 'col-span-3 @min-[30rem]:col-span-1') : '');

/** Day, week, month, quarter or half year (and the year in Reviews), and arrows to step through them. The same control on every dashboard and in Reviews. */
export function PeriodFilter({ period, blank, onChange, today, kinds = DASHBOARD_PERIODS, pick = periodFor }: Props) {
  const next = period ? periodShift(period, 1) : null;
  const canNext = Boolean(next && next.start <= today);
  return (
    <div className="flex flex-col gap-xs">
      {/* The four periods span the full width in equal parts (2026-11-06, the founder: "make the top menu items span to full width,
          responsive"); four short words always fit one row, so no All overflow is needed. */}
      {/* Dynamic by the room it has, not the screen: one row of four while the row is 23rem or wider (in rem, so a larger text size
          asks for more room), two by two below that, so "Half year" never squeezes against its edge (five: see periodGrid). */}
      <div role="group" aria-label="Period" className="@container">
        <div className={periodGrid(kinds.length)}>
        {kinds.map((k, i) => {
          const on = k === period?.kind;
          return (
            <button
              key={k}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(pick(k, today))}
              className={`toy min-h-[44px] min-w-0 rounded-pill border-2 px-xs text-subhead font-medium sm:px-md ${periodCell(i, kinds.length)} ${on ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card text-ink'}`}
            >
              <span className="whitespace-nowrap">{PERIOD_META[k].short}</span>
            </button>
          );
        })}
        </div>
      </div>
      {!period || !next ? (
        <p className="m-0 flex min-h-[44px] items-center justify-center text-headline">{blank}</p>
      ) : (
      <div className="flex items-center justify-between gap-sm">
        <button type="button" onClick={() => onChange(periodShift(period, -1))} aria-label={`The ${PERIOD_META[period.kind].short.toLowerCase()} before`} className="toy toy-soft flex size-[44px] shrink-0 items-center justify-center rounded-pill bg-card text-headline">
          ‹
        </button>
        <p className="m-0 min-w-0 truncate text-center text-headline">{periodLabel(period)}</p>
        <button type="button" onClick={() => onChange(next)} disabled={!canNext} aria-label={`The ${PERIOD_META[period.kind].short.toLowerCase()} after`} className="toy toy-soft flex size-[44px] shrink-0 items-center justify-center rounded-pill bg-card text-headline disabled:opacity-40">
          ›
        </button>
      </div>
      )}
    </div>
  );
}
