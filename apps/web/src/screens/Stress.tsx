import { STRESS_LEVELS, STRESSORS } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../components/Button';
import { WeekBars } from '../components/Charts';
import { Screen } from '../components/Screen';
import { api } from '../lib/api';
import { todayLocal } from '../lib/date';
import { useLogs, useRefreshAll, useWellbeing } from '../lib/queries';

const DAY = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function Stress() {
  const refresh = useRefreshAll();
  const wb = useWellbeing();
  const logs = useLogs('stress', 30);
  const today = todayLocal();
  const current = logs.data?.logs.find((l) => l.date === today) ?? null;
  const [level, setLevel] = useState(current?.value ?? 2);
  const [picked, setPicked] = useState<string[]>((current?.extra.stressors as string[] | undefined) ?? []);
  const save = useMutation({ mutationFn: () => api.log('stress', { date: today, value: level, extra: { stressors: picked } }), onSuccess: () => refresh() });

  return (
    <Screen>
      <header className="pt-lg">
        <Link to="/wellbeing" className="inline-flex min-h-[44px] items-center gap-xs font-bold text-ink-soft">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
          Wellbeing
        </Link>
        <h1 className="text-[30px]">Stress</h1>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Name the level and what is behind it. Naming it is half the work.</p>
      </header>

      <section className="mt-md rounded-card p-md" style={{ background: 'var(--tint-orange)' }} aria-labelledby="level-heading">
        <h2 id="level-heading" className="text-[24px]">
          Right now
        </h2>
        <p className="mt-md text-center font-display text-[36px] font-extrabold leading-none">{STRESS_LEVELS[level - 1]}</p>
        <input type="range" min={1} max={5} value={level} onChange={(e) => setLevel(Number(e.target.value))} aria-label="Stress level" className="mt-md w-full accent-ink" />
        <p className="mt-md m-0 text-[14px] font-bold">What is behind it</p>
        <div className="mt-xs flex flex-wrap gap-xs" role="group" aria-label="Stressors">
          {STRESSORS.map((s) => {
            const on = picked.includes(s);
            return (
              <button
                key={s}
                type="button"
                aria-pressed={on}
                onClick={() => setPicked((p) => (on ? p.filter((x) => x !== s) : [...p, s]))}
                className={`rounded-pill border-2 px-sm py-xs text-[14px] font-bold ${on ? 'border-ink bg-ink text-on-ink' : 'border-line bg-card'}`}
              >
                {s}
              </button>
            );
          })}
        </div>
        {level >= 4 && (
          <p className="mt-md m-0 rounded-tile bg-card p-sm text-[14px] font-semibold">
            That is a lot. Try the{' '}
            <Link to="/knowledge/res-breath-446" className="underline underline-offset-4">
              4-4-6 breath
            </Link>{' '}
            or{' '}
            <Link to="/mindful" className="underline underline-offset-4">
              three mindful minutes
            </Link>
            .
          </p>
        )}
        <Button full size="lg" className="mt-md" onClick={() => save.mutate()} disabled={save.isPending}>
          {current ? 'Update today' : 'Save today'}
        </Button>
      </section>

      <section className="mt-lg" aria-labelledby="week-heading">
        <h2 id="week-heading" className="text-[24px]">
          This week
        </h2>
        <div className="mt-sm rounded-card bg-card p-md shadow-toy-soft">
          {wb.data && <WeekBars values={wb.data.week.map((w) => w.stress)} max={5} color="#FB8728" labels={wb.data.week.map((w) => DAY[new Date(`${w.date}T00:00:00`).getDay()] ?? '')} label="Stress by day" />}
        </div>
      </section>

      <section className="mt-lg" aria-labelledby="hist-heading">
        <h2 id="hist-heading" className="text-[24px]">
          Days
        </h2>
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {logs.data?.logs.map((l) => (
            <li key={l.id} className="rounded-tile bg-card p-sm shadow-toy-soft">
              <p className="m-0 text-[16px] font-bold">{STRESS_LEVELS[Math.round(l.value) - 1]}</p>
              <p className="m-0 text-[14px] font-semibold text-ink-soft">
                {new Date(`${l.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                {Array.isArray(l.extra.stressors) && l.extra.stressors.length > 0 ? `. ${(l.extra.stressors as string[]).join(', ')}` : ''}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </Screen>
  );
}
