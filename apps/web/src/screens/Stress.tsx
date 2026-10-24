import { STRESS_LEVELS, STRESSORS } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../components/Button';
import { AreaLine, Bubbles, PillBars } from '../components/Charts';
import { Hero, HeroNumber } from '../components/Hero';
import { BackLink } from '../components/PageHeader';
import { Screen } from '../components/Screen';
import { api } from '../lib/api';
import { lastDays, shortDay, todayLocal } from '../lib/date';
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
  const latest = wb.data?.parts.find((p) => p.kind === 'stress')?.latest ?? null;
  const counts = new Map<string, number>();
  for (const l of logs.data?.logs ?? []) for (const s of (Array.isArray(l.extra.stressors) ? (l.extra.stressors as string[]) : [])) counts.set(s, (counts.get(s) ?? 0) + 1);
  const BUBBLE_COLORS = ['var(--color-r2)', 'var(--color-r4)', 'var(--color-r6)', 'var(--color-r5)', 'var(--color-r1)', 'var(--color-r7)', 'var(--color-r3)', 'var(--color-ink)'];

  return (
    <Screen>
      <header className="pt-lg">
        <BackLink to="/wellbeing">Wellbeing</BackLink>
        <h1 className="text-[30px]">Stress</h1>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Name the level and what is behind it. Naming it is half the work.</p>
      </header>

      {wb.data && (
        <Hero color="var(--color-r2)" deep="var(--deep-friendship)" className="mt-md" character="friendship" mood={latest !== null && latest >= 4 ? "sleepy" : "happy"}>
          <HeroNumber value={latest === null ? '–' : Math.round(latest)} label={latest === null ? 'Nothing logged this week' : `${STRESS_LEVELS[Math.round(latest) - 1] ?? ''}, your latest`} />
        </Hero>
      )}

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
          {wb.data && <PillBars allLabels values={wb.data.week.map((w) => w.stress)} max={5} color="var(--color-r2)" labels={wb.data.week.map((w) => DAY[new Date(`${w.date}T00:00:00`).getDay()] ?? '')} label="Stress by day" />}
        </div>
      </section>

      <section className="mt-lg" aria-labelledby="thirty-heading">
        <h2 id="thirty-heading" className="text-[24px]">
          Last 30 days
        </h2>
        <div className="mt-sm rounded-card bg-card p-md shadow-toy-soft">
          {(() => {
            const days = lastDays(30);
            const byDay = new Map((logs.data?.logs ?? []).map((l) => [l.date, l.value]));
            return <AreaLine values={days.map((d) => byDay.get(d) ?? null)} max={5} min={1} color="var(--color-r2)" labels={days.map(shortDay)} height={140} label="Stress level over the last thirty days" />;
          })()}
          <p className="mt-xs m-0 text-[12px] font-bold text-ink-soft">Lower is calmer. A line that climbs for a week is worth a word with someone.</p>
        </div>
      </section>

      <section className="mt-lg" aria-labelledby="behind-heading">
        <h2 id="behind-heading" className="text-[24px]">
          What is behind it
        </h2>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">How often each stressor came up in the last thirty days. The biggest bubble is the one to look at first.</p>
        <div className="mt-sm rounded-card bg-card p-md shadow-toy-soft">
          <Bubbles items={[...counts.entries()].map(([label, value], i) => ({ label, value, color: BUBBLE_COLORS[i % BUBBLE_COLORS.length] ?? 'var(--color-r2)' }))} label="Stressors by how often they came up" />
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
