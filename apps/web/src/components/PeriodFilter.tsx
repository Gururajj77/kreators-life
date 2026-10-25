import { PERIOD_KINDS, PERIOD_META, periodFor, periodLabel, periodShift, type Period } from '@kreators/shared';

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
      <div role="group" aria-label="Period" className="-mx-xs flex gap-xs overflow-x-auto px-xs py-xs scrollbar-none">
        {PERIOD_KINDS.map((k) => {
          const on = k === period.kind;
          return (
            <button
              key={k}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(periodFor(k, today))}
              className={`toy min-h-[44px] shrink-0 rounded-pill border-2 px-md text-[14px] font-bold ${on ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card text-ink'}`}
            >
              {PERIOD_META[k].short}
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-sm">
        <button type="button" onClick={() => onChange(periodShift(period, -1))} aria-label={`The ${PERIOD_META[period.kind].short.toLowerCase()} before`} className="toy toy-soft flex size-[44px] shrink-0 items-center justify-center rounded-pill bg-card text-[18px] font-extrabold">
          ‹
        </button>
        <p className="m-0 min-w-0 truncate text-center text-[16px] font-extrabold">{periodLabel(period)}</p>
        <button type="button" onClick={() => onChange(next)} disabled={!canNext} aria-label={`The ${PERIOD_META[period.kind].short.toLowerCase()} after`} className="toy toy-soft flex size-[44px] shrink-0 items-center justify-center rounded-pill bg-card text-[18px] font-extrabold disabled:opacity-40">
          ›
        </button>
      </div>
    </div>
  );
}
