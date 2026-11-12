import { STRESS_LEVELS, STRESSORS } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { PeriodPanel } from '../components/PeriodPanel';
import { Button } from '../components/Button';
import { AnimatedIcon } from '../components/AnimatedIcon';
import { Sheet } from '../components/Sheet';
import { AreaLine, Bubbles, Gauge, PillBars } from '../components/Charts';
import { Hero } from '../components/Hero';
import { BackLink } from '../components/PageHeader';
import { Screen } from '../components/Screen';
import { api } from '../lib/api';
import { lastDays, shortDay, todayLocal, dayLabel } from '../lib/date';
import { useLogs, useRefreshAll, useWellbeing } from '../lib/queries';
import { EmergenceSlot } from '../components/EmergenceSlot';
import { RED_YES } from '../lib/ui';

const DAY = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function Stress() {
  const refresh = useRefreshAll();
  const wb = useWellbeing();
  const logs = useLogs('stress', 30);
  const today = todayLocal();
  const current = logs.data?.logs.find((l) => l.date === today) ?? null;
  // The form fills once the entries arrive (and again on a new day), like Mood. Each field keeps its own touch for the day,
  // so a field the person moved stays as they set it and the other still takes the logged value.
  // With nothing logged today it starts from the last level logged, with nothing picked; with nothing at all, from 2.
  const [level, setLevel] = useState(2);
  const [picked, setPicked] = useState<string[]>([]);
  const [touched, setTouched] = useState<{ day: string; level?: boolean; stressors?: boolean }>({ day: '' });
  useEffect(() => {
    if (!logs.data) return;
    const t = touched.day === today ? touched : { day: today };
    const last = current ? null : logs.data.logs.reduce<(typeof logs.data.logs)[number] | null>((a, l) => (l.date < today && (!a || l.date > a.date) ? l : a), null);
    if (!t.level) setLevel(current ? current.value : last?.value ?? 2);
    if (!t.stressors) setPicked(current && Array.isArray(current.extra.stressors) ? (current.extra.stressors as string[]) : []);
  }, [logs.data, current, today, touched]);
  const touch = (field: 'level' | 'stressors') => setTouched((t) => ({ ...(t.day === today ? t : { day: today }), [field]: true }));
  const save = useMutation({ mutationFn: () => api.log('stress', { date: today, value: level, extra: { stressors: picked } }), onSuccess: () => refresh() });
  const latest = wb.data?.parts.find((p) => p.kind === 'stress')?.latest ?? null;
  const avg7 = wb.data?.parts.find((p) => p.kind === 'stress')?.avg7 ?? null;
  const [toDelete, setToDelete] = useState<{ id: string; label: string } | null>(null);
  const remove = useMutation({ mutationFn: (id: string) => api.deleteLog('stress', id), onSuccess: () => (setToDelete(null), refresh()) });
  const counts = new Map<string, number>();
  for (const l of logs.data?.logs ?? []) for (const s of (Array.isArray(l.extra.stressors) ? (l.extra.stressors as string[]) : [])) counts.set(s, (counts.get(s) ?? 0) + 1);
  const BUBBLE_COLORS = ['var(--color-r2)', 'var(--color-r4)', 'var(--color-r6)', 'var(--color-r5)', 'var(--color-r1)', 'var(--color-r7)', 'var(--color-r3)', 'var(--color-ink)'];

  return (
    <Screen>
      <header className="pt-lg">
        <BackLink to="/wellbeing">Wellbeing</BackLink>
        <h1 className="text-large-title">Stress</h1>
        <p className="mt-xs m-0 text-subhead text-ink-soft">Name the level and what is behind it. Naming it is half the work.</p>
        {wb.data && (
          // Life's hero: this week's average as a gauge (calm is a full ring), its word, and Pip, whose mood follows it.
          <Hero color="var(--color-r2)" deep="var(--deep-friendship)" className="mt-md" character="friendship" mood={avg7 === null ? 'happy' : avg7 >= 4 ? 'sleepy' : avg7 <= 2 ? 'excited' : 'happy'}>
            <p className="m-0 text-eyebrow uppercase opacity-90">Stress this week</p>
            {/* A phone stacks the word and its line under the gauge, so they keep the card's width instead of a sliver beside it. */}
            <div className="mt-xs flex flex-col items-start gap-xs sm:flex-row sm:items-center sm:gap-md">
              <Gauge value={avg7 === null ? 0 : (5 - avg7) / 4} size={128} stroke={14} color="var(--color-on-fill)" track="rgba(255,255,255,0.3)" label={avg7 === null ? 'Nothing logged this week' : `Average ${avg7.toFixed(1)} of 5`}>
                <span className="text-figure-lg type-figure">{avg7 === null ? '–' : avg7.toFixed(1)}</span>
              </Gauge>
              <div className="min-w-0">
                <p className="m-0 text-title1">{avg7 === null ? 'Nothing yet' : avg7 <= 2 ? 'Calm' : avg7 < 3.5 ? 'Steady' : 'Strained'}</p>
                <p className="mt-xs m-0 text-subhead opacity-90">{latest === null ? 'Log today to start the week.' : `Latest: ${STRESS_LEVELS[Math.round(latest) - 1] ?? ''}. Out of 5, lower is calmer.`}</p>
              </div>
            </div>
          </Hero>
        )}
      </header>


      <section data-pillar="friendship" className="mt-md rounded-card p-md" style={{ background: 'var(--tint-orange)' }} aria-labelledby="level-heading">
        <h2 id="level-heading" className="text-title2">
          Right now
        </h2>
        <p className="mt-md text-center text-large-title leading-none">{STRESS_LEVELS[level - 1]}</p>
        <input type="range" min={1} max={5} value={level} onChange={(e) => (touch('level'), setLevel(Number(e.target.value)))} aria-label="Stress level" className="mt-md h-[44px] w-full cursor-pointer accent-ink" />
        <p className="mt-md m-0 text-subhead font-semibold">What is behind it</p>
        <div className="fill-row-all mt-xs flex flex-wrap gap-xs" role="group" aria-label="Stressors">
          {STRESSORS.map((s) => {
            const on = picked.includes(s);
            return (
              <button
                key={s}
                type="button"
                aria-pressed={on}
                onClick={() => (touch('stressors'), setPicked((p) => (on ? p.filter((x) => x !== s) : [...p, s])))}
                className={`min-h-[36px] md:min-h-[44px] tap-pad rounded-pill border-2 px-sm py-0 md:py-xs text-subhead font-medium ${on ? 'border-ink bg-ink text-on-ink' : 'border-line bg-card'}`}
              >
                {s}
              </button>
            );
          })}
        </div>
        {level >= 4 && (
          <p className="mt-md m-0 rounded-tile bg-card p-sm text-subhead">
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
        <Button full size="lg" className="mt-md" onClick={() => save.mutate()} disabled={save.isPending || !logs.data}>
          {current ? 'Update today' : 'Save today'}
        </Button>
      </section>

      <section className="mt-lg" aria-labelledby="week-heading">
        <h2 id="week-heading" className="text-title2">
          This week
        </h2>
        <div className="mt-sm rounded-card bg-card p-md shadow-toy-soft">
          {wb.data && <PillBars allLabels values={wb.data.week.map((w) => w.stress)} max={5} color="var(--color-r2)" labels={wb.data.week.map((w) => DAY[new Date(`${w.date}T00:00:00`).getDay()] ?? '')} label="Stress by day" />}
        </div>
      </section>

      <PeriodPanel id="stress-period" parts={['wellbeing']} />
      <EmergenceSlot app="stress" max={2} />
      <section className="mt-lg" aria-labelledby="thirty-heading">
        <h2 id="thirty-heading" className="text-title2">
          Last 30 days
        </h2>
        <div className="mt-sm rounded-card bg-card p-md shadow-toy-soft">
          {(() => {
            const days = lastDays(30);
            const byDay = new Map((logs.data?.logs ?? []).map((l) => [l.date, l.value]));
            return <AreaLine values={days.map((d) => byDay.get(d) ?? null)} max={5} min={1} color="var(--color-r2)" labels={days.map(shortDay)} height={140} label="Stress level over the last thirty days" />;
          })()}
          <p className="mt-xs m-0 text-caption text-ink-soft">Lower is calmer. A line that climbs for a week is worth a word with someone.</p>
        </div>
      </section>

      <section className="mt-lg" aria-labelledby="behind-heading">
        <h2 id="behind-heading" className="text-title2">
          What is behind it
        </h2>
        <p className="mt-xs m-0 text-subhead text-ink-soft">How often each stressor came up in the last thirty days. The biggest bubble is the one to look at first.</p>
        <div className="mt-sm rounded-card bg-card p-md shadow-toy-soft">
          <Bubbles items={[...counts.entries()].map(([label, value], i) => ({ label, value, color: BUBBLE_COLORS[i % BUBBLE_COLORS.length] ?? 'var(--color-r2)' }))} label="Stressors by how often they came up" />
        </div>
      </section>

      {/* No heading over nothing: with no entry yet the list and its title wait (the delete sheet portals out, so it still opens). */}
      <section className="mt-lg" aria-labelledby="hist-heading" hidden={!logs.data?.logs.length}>
        <h2 id="hist-heading" className="text-title2">
          Days
        </h2>
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {logs.data?.logs.map((l) => (
            <li key={l.id} className={`flex items-center gap-sm rounded-tile bg-card p-sm shadow-toy-soft`}>
              <span className="min-w-0 flex-1">
                <span className="block text-card-title">
                  {STRESS_LEVELS[Math.round(l.value) - 1]}
                </span>
                <span className="block text-card-note text-ink-soft">
                  {dayLabel(l.date)}
                  {Array.isArray(l.extra.stressors) && l.extra.stressors.length > 0 ? `. ${(l.extra.stressors as string[]).join(', ')}` : ''}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setToDelete({ id: l.id, label: `${STRESS_LEVELS[Math.round(l.value) - 1] ?? 'This day'} on ${dayLabel(l.date)}` })}
                aria-label={`Delete the day of ${dayLabel(l.date)}`}
                data-tip="Delete"
                className="toy toy-flat flex size-[44px] shrink-0 items-center justify-center rounded-pill text-ink-soft hover:text-r1"
              >
                <AnimatedIcon name="trash" size={20} />
              </button>
            </li>
          ))}
        </ul>
        <Sheet open={toDelete !== null} onClose={() => setToDelete(null)} title="Delete this day?">
          <div className="grid gap-md pb-xl">
            <p className="m-0 text-callout text-ink-soft">{toDelete?.label}. It comes off your charts. This cannot be undone.</p>
            {remove.isError && <p className="m-0 text-subhead text-r1">That did not work. Try again.</p>}
            <div className="flex flex-wrap gap-xs">
              <button
                type="button"
                disabled={remove.isPending}
                onClick={() => toDelete && remove.mutate(toDelete.id)}
                className={RED_YES}
              >
                Yes, delete it
              </button>
              <Button variant="outline" onClick={() => setToDelete(null)}>
                Keep it
              </Button>
            </div>
          </div>
        </Sheet>
      </section>
    </Screen>
  );
}
