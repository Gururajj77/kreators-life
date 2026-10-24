import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '../components/Button';
import { AreaLine, Donut, PillBars } from '../components/Charts';
import { Hero, HeroNumber } from '../components/Hero';
import { BackLink } from '../components/PageHeader';
import { Screen } from '../components/Screen';
import { api } from '../lib/api';
import { lastDays, shortDay, todayLocal } from '../lib/date';
import { useLogs, useRefreshAll, useWellbeing } from '../lib/queries';

const QUALITY = ['Rough', 'Light', 'Okay', 'Good', 'Deep'];
const DAY = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function Sleep() {
  const refresh = useRefreshAll();
  const wb = useWellbeing();
  const logs = useLogs('sleep', 30);
  const today = todayLocal();
  const current = logs.data?.logs.find((l) => l.date === today) ?? null;
  const [hours, setHours] = useState(current?.value ?? 7);
  const [quality, setQuality] = useState(Number(current?.extra.quality ?? 3));
  const save = useMutation({ mutationFn: () => api.log('sleep', { date: today, value: hours, extra: { quality } }), onSuccess: () => refresh() });
  const avg = wb.data?.parts.find((p) => p.kind === 'sleep')?.avg7 ?? null;

  return (
    <Screen>
      <header className="pt-lg">
        <BackLink to="/wellbeing">Wellbeing</BackLink>
        <h1 className="text-[30px]">Sleep</h1>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">{avg === null ? 'Log a few nights and the average shows here.' : `Averaging ${avg.toFixed(1)} hours this week.`}</p>
      </header>

      {wb.data && (
        <Hero color="var(--color-r6)" deep="var(--deep-guru)" className="mt-md" character="guru" characterSize={64} mood={avg !== null && avg >= 7 ? "happy" : "sleepy"}>
          <div className="flex items-center justify-between gap-md">
            <HeroNumber value={avg === null ? '–' : avg.toFixed(1)} unit="h" label={avg === null ? 'No nights logged yet' : avg >= 7 ? 'You are sleeping well' : avg >= 6 ? 'A little short this week' : 'Running on empty'} />
            <Donut segments={[{ value: avg ?? 0, color: 'var(--color-on-fill)', label: 'slept' }, { value: Math.max(0, 8 - (avg ?? 0)), color: 'rgba(255,255,255,0.3)', label: 'to eight' }]} size={112} stroke={14} track="rgba(255,255,255,0.3)" label="Hours a night against eight">
              <span className="text-[12px] font-extrabold">of 8 h</span>
            </Donut>
          </div>
        </Hero>
      )}

      <section className="mt-md rounded-card p-md" style={{ background: 'var(--tint-purple)' }} aria-labelledby="log-heading">
        <h2 id="log-heading" className="text-[24px]">
          Last night
        </h2>
        <p className="mt-md text-center font-display text-[60px] font-extrabold leading-none">
          {hours}
          <span className="text-[20px]"> hours</span>
        </p>
        <input type="range" min={0} max={14} step={0.5} value={hours} onChange={(e) => setHours(Number(e.target.value))} aria-label="Hours slept" className="mt-md w-full accent-ink" />
        <p className="mt-md m-0 text-[14px] font-bold">Quality</p>
        <div className="mt-xs grid grid-cols-5 gap-xs" role="group" aria-label="Sleep quality">
          {QUALITY.map((q, i) => (
            <button
              key={q}
              type="button"
              aria-pressed={quality === i + 1}
              onClick={() => setQuality(i + 1)}
              className={`toy min-h-[48px] rounded-tile text-[12px] font-bold ${quality === i + 1 ? 'bg-ink text-on-ink' : 'toy-soft bg-card'}`}
            >
              {q}
            </button>
          ))}
        </div>
        <Button full size="lg" className="mt-md" onClick={() => save.mutate()} disabled={save.isPending}>
          {current ? 'Update last night' : 'Save last night'}
        </Button>
      </section>

      <section className="mt-lg" aria-labelledby="week-heading">
        <h2 id="week-heading" className="text-[24px]">
          This week
        </h2>
        <div className="mt-sm rounded-card bg-card p-md shadow-toy-soft">
          {wb.data && <PillBars allLabels values={wb.data.week.map((w) => w.sleep)} max={10} color="var(--color-r6)" labels={wb.data.week.map((w) => DAY[new Date(`${w.date}T00:00:00`).getDay()] ?? '')} label="Hours of sleep by day" />}
        </div>
      </section>

      <section className="mt-lg" aria-labelledby="thirty-heading">
        <h2 id="thirty-heading" className="text-[24px]">
          Last 30 nights
        </h2>
        <div className="mt-sm rounded-card bg-card p-md shadow-toy-soft">
          {(() => {
            const days = lastDays(30);
            const byDay = new Map((logs.data?.logs ?? []).map((l) => [l.date, l.value]));
            return <AreaLine values={days.map((d) => byDay.get(d) ?? null)} max={10} color="var(--color-r6)" labels={days.map(shortDay)} height={140} label="Hours of sleep over the last thirty nights" />;
          })()}
          <p className="mt-xs m-0 text-[12px] font-bold text-ink-soft">Seven to eight hours is the band that scores full marks.</p>
        </div>
      </section>

      <section className="mt-lg" aria-labelledby="hist-heading">
        <h2 id="hist-heading" className="text-[24px]">
          Nights
        </h2>
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {logs.data?.logs.map((l) => (
            <li key={l.id} className="flex items-center gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-bold">
                  {l.value} hours, {QUALITY[Number(l.extra.quality ?? 3) - 1]?.toLowerCase()}
                </span>
                <span className="block text-[14px] font-semibold text-ink-soft">{new Date(`${l.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </Screen>
  );
}
