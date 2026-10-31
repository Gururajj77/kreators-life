import { PLAN_DAY_MINUTES, RELATIONSHIP_BY_KEY, minutesLabel2, type PlanStrength, type WeekPlan as WeekPlanData, type WeekPlanSuggestion } from '@kreators/shared';
import { useState } from 'react';
import { api } from '../lib/api';
import { prettyDate, todayLocal } from '../lib/date';
import { useAuthed, useRefreshAll } from '../lib/queries';
import { tie } from '../lib/text';
import { Button } from './Button';
import { Inert } from './Inert';
import { Ring } from './Ring';
import { Sheet } from './Sheet';
import { StatusTag } from './StatusTag';

/** The words on this sheet, in short plain sentences. */
const COPY = {
  button: 'Plan my week',
  title: 'Plan my week',
  lede: 'Seven days from today. Each task with no day gets a suggested one. Nothing changes until you keep them.',
  hours: 'Hours of planned work a day',
  strength: 'Plan strength',
  strengthLede: 'Days with something planned, days that are not overloaded, and tasks that say how long they take.',
  now: 'Now',
  with: 'With all of these',
  week: 'The week',
  suggestions: 'Suggested days',
  keep: 'Keep what fits',
  skip: 'Skip them all',
  look: 'Worth a look',
  empty: 'You have no open tasks to plan. Add a few, then come back.',
  allPlaced: 'Every open task already has a day.',
  over: 'Over',
  loading: 'Planning your week.',
  failed: 'The plan did not load. Try again in a moment.',
  noneKept: 'Tick at least one suggestion to keep.',
} as const;

const HOURS_KEY = 'kreators.planHours';
const readHours = (): number => {
  try {
    const n = Number(localStorage.getItem(HOURS_KEY));
    return Number.isFinite(n) && n >= 1 && n <= 12 ? Math.round(n) : PLAN_DAY_MINUTES / 60;
  } catch {
    return PLAN_DAY_MINUTES / 60;
  }
};
const saveHours = (n: number) => {
  try {
    localStorage.setItem(HOURS_KEY, String(n));
  } catch {
    // not kept here, still used for this plan
  }
};

const weekday = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short' });
const dayOption = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const tone = (s: PlanStrength) => (s.label === 'Strong' ? 'good' : s.label === 'Fair' ? 'warn' : 'neutral');

/** One reading of how strong a plan is: a ring with the score, the label, and the three parts as small bars. */
function Strength({ title, s }: { title: string; s: PlanStrength }) {
  return (
    <div className="min-w-0 flex-1 rounded-tile bg-paper p-sm">
      <p className="m-0 text-[12px] font-extrabold uppercase tracking-wide text-ink-soft">{title}</p>
      <div className="mt-xs flex items-center gap-sm">
        <Ring value={s.score / 100} size={56} stroke={7} color="var(--color-r4)" label={`${title}: plan strength ${s.score} out of 100`}>
          <span className="font-display text-[16px] font-extrabold">{s.score}</span>
        </Ring>
        <StatusTag tone={tone(s)}>{s.label}</StatusTag>
      </div>
      <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0">
        {s.parts.map((p) => (
          <li key={p.name}>
            <span className="block text-[12px] font-semibold text-ink-soft">{tie(p.name)}</span>
            <span className="mt-xs block h-[6px] overflow-hidden rounded-pill bg-line" aria-hidden="true">
              <span className="block h-full rounded-pill bg-r4" style={{ width: `${Math.round((p.score / p.max) * 100)}%` }} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The sheet's body. It is made again whenever a new plan arrives, so the ticks and days start from what the plan suggested. */
function PlanBody({ plan, onDone }: { plan: WeekPlanData; onDone: (kept: number, failed: number) => void }) {
  const refresh = useRefreshAll();
  const [on, setOn] = useState<Record<string, boolean>>(() => Object.fromEntries(plan.suggestions.map((s) => [s.id, true])));
  const [day, setDay] = useState<Record<string, string>>(() => Object.fromEntries(plan.suggestions.map((s) => [s.id, s.day])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const kept = plan.suggestions.filter((s) => on[s.id]);

  // The strip follows the ticks and the days, so a change is seen at once.
  const added = new Map<string, number>();
  for (const s of kept) added.set(day[s.id]!, (added.get(day[s.id]!) ?? 0) + s.estimateMin);
  const peak = Math.max(plan.capacityMin, ...plan.days.map((d) => d.plannedMin + (added.get(d.date) ?? 0)));

  const keep = async () => {
    if (kept.length === 0) {
      setError(COPY.noneKept);
      return;
    }
    setBusy(true);
    setError('');
    let ok = 0;
    // One at a time through the ordinary edit, so every rule on a task still applies.
    for (const s of kept) {
      try {
        await api.updateNode(s.id, { doDate: day[s.id]! });
        ok += 1;
      } catch {
        // counted below
      }
    }
    refresh();
    setBusy(false);
    onDone(ok, kept.length - ok);
  };

  return (
    <div className="flex flex-col gap-md">
      <section aria-labelledby="plan-strength-heading">
        <h3 id="plan-strength-heading" className="text-[18px]">
          {COPY.strength}
        </h3>
        <p className="mt-xs m-0 text-[12px] font-bold text-ink-soft">{COPY.strengthLede}</p>
        <div className="mt-xs flex flex-col gap-xs md:flex-row">
          <Strength title={COPY.now} s={plan.strengthNow} />
          <Strength title={COPY.with} s={plan.strengthWith} />
        </div>
      </section>

      <section aria-labelledby="plan-week-heading">
        <h3 id="plan-week-heading" className="text-[18px]">
          {COPY.week}
        </h3>
        <ul className="mt-xs grid list-none grid-cols-7 gap-xs p-0 m-0">
          {plan.days.map((d) => {
            const extra = added.get(d.date) ?? 0;
            const total = d.plannedMin + extra;
            const over = total > plan.capacityMin;
            return (
              <li key={d.date} className="min-w-0 text-center" aria-label={`${prettyDate(d.date)}: ${minutesLabel2(d.plannedMin)} planned, ${minutesLabel2(extra)} suggested`}>
                <div className="mx-auto flex h-[72px] w-full max-w-[40px] flex-col justify-end overflow-hidden rounded-tile bg-line" aria-hidden="true">
                  <div className="w-full bg-r4" style={{ height: `${Math.round((extra / peak) * 100)}%` }} />
                  <div className="w-full bg-r5" style={{ height: `${Math.round((d.plannedMin / peak) * 100)}%` }} />
                </div>
                <p className="mt-xs m-0 text-[12px] font-extrabold">{weekday(d.date)}</p>
                <p className="m-0 text-[12px] font-semibold text-ink-soft">{total > 0 ? minutesLabel2(total) : '0'}</p>
                {over && <StatusTag tone="bad">{COPY.over}</StatusTag>}
              </li>
            );
          })}
        </ul>
        <p className="mt-xs m-0 text-[12px] font-semibold text-ink-soft">Blue is already planned. Green is what you would add.</p>
      </section>

      <section aria-labelledby="plan-suggest-heading">
        <h3 id="plan-suggest-heading" className="text-[18px]">
          {COPY.suggestions}
        </h3>
        {plan.suggestions.length === 0 ? (
          <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">{COPY.allPlaced}</p>
        ) : (
          <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0">
            {plan.suggestions.map((s: WeekPlanSuggestion) => (
              <li key={s.id} className="flex items-start gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
                <input type="checkbox" checked={on[s.id] ?? false} onChange={(e) => setOn((o) => ({ ...o, [s.id]: e.target.checked }))} aria-label={`Keep ${s.title}`} className="mt-xs size-[24px] shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="m-0 flex items-center gap-xs text-[16px] font-bold leading-snug">
                    <span className="inline-block size-[10px] shrink-0 rounded-pill" style={{ background: RELATIONSHIP_BY_KEY[s.relationship].color }} aria-hidden="true" />
                    <span className="min-w-0">
                      <Inert text={s.title} />
                    </span>
                  </p>
                  <p className="m-0 text-[12px] font-semibold text-ink-soft">
                    {minutesLabel2(s.estimateMin)}, {s.reason.toLowerCase()}
                  </p>
                  <label className="mt-xs block text-[12px] font-bold text-ink-soft">
                    Day
                    <select value={day[s.id]} onChange={(e) => setDay((d) => ({ ...d, [s.id]: e.target.value }))} className="mt-xs block min-h-[44px] w-full rounded-pill border-2 border-line bg-card-strong px-sm text-[14px] font-bold text-ink">
                      {plan.days.map((d) => (
                        <option key={d.date} value={d.date}>
                          {dayOption(d.date)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {(plan.notes.length > 0 || plan.noRoom.length > 0) && (
        <section aria-labelledby="plan-look-heading">
          <h3 id="plan-look-heading" className="text-[18px]">
            {COPY.look}
          </h3>
          <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0">
            {plan.notes.map((n) => (
              <li key={n} className="m-0 rounded-tile bg-paper p-sm text-[14px] font-semibold">
                {tie(n)}
              </li>
            ))}
          </ul>
          {plan.noRoom.length > 0 && (
            <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0" aria-label="Tasks with no room this week">
              {plan.noRoom.slice(0, 5).map((t) => (
                <li key={t.id} className="text-[12px] font-bold text-ink-soft">
                  No room: <Inert text={t.title} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {error && (
        <p role="alert" className="m-0 text-[14px] font-bold">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-xs">
        {plan.suggestions.length > 0 && (
          <Button onClick={keep} disabled={busy}>
            {busy ? 'Keeping' : `${COPY.keep} (${kept.length})`}
          </Button>
        )}
        <Button variant="outline" onClick={() => onDone(0, 0)} disabled={busy}>
          {plan.suggestions.length > 0 ? COPY.skip : 'Close'}
        </Button>
      </div>
    </div>
  );
}

/** The "Plan my week" button for Daily, its sheet, and a short line after the plan is kept. */
export function WeekPlanButton() {
  const date = todayLocal();
  const [open, setOpen] = useState(false);
  const [hours, setHours] = useState(readHours);
  const [said, setSaid] = useState('');
  const q = useAuthed(['today', 'week-plan', date, hours], () => api.weekPlan(date, hours), open);
  const plan = q.data?.plan;
  const setH = (n: number) => {
    const next = Math.max(1, Math.min(12, n));
    setHours(next);
    saveHours(next);
  };
  const done = (kept: number, failed: number) => {
    setOpen(false);
    setSaid(kept === 0 && failed === 0 ? '' : failed > 0 ? `${kept} ${kept === 1 ? 'task now has' : 'tasks now have'} a day. ${failed} did not save.` : `${kept} ${kept === 1 ? 'task now has' : 'tasks now have'} a day.`);
  };
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setSaid('');
          setOpen(true);
        }}
      >
        {COPY.button}
      </Button>
      {said && (
        <p role="status" className="m-0 basis-full text-right text-[12px] font-bold text-ink-soft">
          {said}
        </p>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title={COPY.title}>
        <div className="pb-md">
          <p className="m-0 text-[14px] font-semibold text-ink-soft">{COPY.lede}</p>
          <div className="mt-sm flex items-center justify-between gap-sm rounded-tile bg-paper p-sm">
            <span className="text-[14px] font-bold">{COPY.hours}</span>
            <span className="flex items-center gap-xs">
              <button type="button" onClick={() => setH(hours - 1)} disabled={hours <= 1} aria-label="One hour less" className="toy toy-soft min-h-[44px] min-w-[44px] rounded-pill border border-line bg-card-strong text-[18px] font-extrabold disabled:opacity-50">
                &minus;
              </button>
              <span className="min-w-[32px] text-center font-display text-[20px] font-extrabold" aria-live="polite">
                {hours}
              </span>
              <button type="button" onClick={() => setH(hours + 1)} disabled={hours >= 12} aria-label="One hour more" className="toy toy-soft min-h-[44px] min-w-[44px] rounded-pill border border-line bg-card-strong text-[18px] font-extrabold disabled:opacity-50">
                +
              </button>
            </span>
          </div>
          <div className="mt-md">
            {q.isPending && (
              <p role="status" className="m-0 text-[14px] font-bold text-ink-soft">
                {COPY.loading}
              </p>
            )}
            {q.isError && (
              <p role="alert" className="m-0 text-[14px] font-bold">
                {COPY.failed}
              </p>
            )}
            {plan && plan.suggestions.length === 0 && plan.days.every((d) => d.tasks === 0) && plan.noRoom.length === 0 ? (
              <p className="m-0 text-[14px] font-semibold text-ink-soft">{COPY.empty}</p>
            ) : (
              plan && <PlanBody key={`${hours}:${plan.suggestions.map((s) => `${s.id}${s.day}`).join()}`} plan={plan} onDone={done} />
            )}
          </div>
        </div>
      </Sheet>
    </>
  );
}
