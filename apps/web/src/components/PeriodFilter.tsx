import { PERIOD_KINDS, PERIOD_META, periodFor, periodLabel, periodShift, type Period } from '@kreators/shared';

const PERIOD_ITEMS = PERIOD_KINDS.map((k) => ({ key: k, label: PERIOD_META[k].short }));

interface Props {
  period: Period;
  onChange: (p: Period) => void;
  /** The person's local date; nothing after its period can be picked. */
  today: string;
}

/** Week, month, quarter or half year, and arrows to step through them. The same control on every dashboard and in Reviews. */
export function PeriodFilter({ period, onChange, today }: Props) {
  const next = periodShift(period, 1);
  const canNext = next.start <= today;
  return (
    <div className="flex flex-col gap-xs">
      {/* The four periods span the full width in equal parts (2026-11-06, the founder: "make the top menu items span to full width,
          responsive"); four short words always fit one row, so no All overflow is needed. */}
      {/* Dynamic by the room it has, not the screen: one row of four while the row is 23rem or wider (in rem, so a larger text size
          asks for more room), two by two below that, so "Half year" never squeezes against its edge. */}
      <div role="group" aria-label="Period" className="@container">
        <div className="grid grid-cols-4 gap-xs @max-[23rem]:grid-cols-2">
        {PERIOD_ITEMS.map((it) => {
          const on = it.key === period.kind;
          return (
            <button
              key={it.key}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(periodFor(it.key, today))}
              className={`toy min-h-[44px] min-w-0 rounded-pill border-2 px-xs text-subhead font-medium sm:px-md ${on ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card text-ink'}`}
            >
              <span className="whitespace-nowrap">{it.label}</span>
            </button>
          );
        })}
        </div>
      </div>
      <div className="flex items-center justify-between gap-sm">
        <button type="button" onClick={() => onChange(periodShift(period, -1))} aria-label={`The ${PERIOD_META[period.kind].short.toLowerCase()} before`} className="toy toy-soft flex size-[44px] shrink-0 items-center justify-center rounded-pill bg-card text-headline">
          ‹
        </button>
        <p className="m-0 min-w-0 truncate text-center text-headline">{periodLabel(period)}</p>
        <button type="button" onClick={() => onChange(next)} disabled={!canNext} aria-label={`The ${PERIOD_META[period.kind].short.toLowerCase()} after`} className="toy toy-soft flex size-[44px] shrink-0 items-center justify-center rounded-pill bg-card text-headline disabled:opacity-40">
          ›
        </button>
      </div>
    </div>
  );
}
