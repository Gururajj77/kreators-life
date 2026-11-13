import { useMutation } from '@tanstack/react-query';
import { afterRemove } from '../lib/focusHeading';
import { useEffect, useId, useState } from 'react';
import { addDays } from '@kreators/shared';
import { FIELD } from '../lib/ui';
import { PeriodPanel } from '../components/PeriodPanel';
import { Button } from '../components/Button';
import { AnimatedIcon } from '../components/AnimatedIcon';
import { TapTwiceIcon } from '../components/TapTwiceIcon';
import { ErrorLine } from '../components/ErrorLine';
import { ToggleChevron } from '../components/ToggleMark';
import { useTapTwice } from '../lib/useTapTwice';
import { AreaLine, Donut, PillBars } from '../components/Charts';
import { Hero, HeroNumber } from '../components/Hero';
import { RulerPicker } from '../components/RulerPicker';
import { BackLink } from '../components/PageHeader';
import { Screen } from '../components/Screen';
import { api } from '../lib/api';
import { lastDays, shortDay, todayLocal, dayLabel } from '../lib/date';
import { useLogs, useRefreshAll, useWellbeing } from '../lib/queries';
import { EmergenceSlot } from '../components/EmergenceSlot';

const QUALITY = ['Rough', 'Light', 'Okay', 'Good', 'Deep'];
const DAY = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function Sleep() {
  const refresh = useRefreshAll();
  const wb = useWellbeing();
  const logs = useLogs('sleep', 30);
  const today = todayLocal();
  const current = logs.data?.logs.find((l) => l.date === today) ?? null;
  // The form fills once the nights arrive (and again on a new day), like Mood. Each field keeps its own touch for the day,
  // so a field the person moved stays as they set it and the other still takes the logged value.
  // With nothing logged today it starts from the last night logged; with nothing at all, from 7 hours.
  const [hours, setHours] = useState(7);
  const [quality, setQuality] = useState(3);
  const [touched, setTouched] = useState<{ day: string; hours?: boolean; quality?: boolean }>({ day: '' });
  useEffect(() => {
    if (!logs.data) return;
    const t = touched.day === today ? touched : { day: today };
    const last = current ? null : logs.data.logs.reduce<(typeof logs.data.logs)[number] | null>((a, l) => (l.date < today && (!a || l.date > a.date) ? l : a), null);
    if (!t.hours) setHours(current ? current.value : last?.value ?? 7);
    if (!t.quality) setQuality(current ? Number(current.extra.quality ?? 3) : 3);
  }, [logs.data, current, today, touched]);
  const pickHours = (v: number) => (setTouched((t) => ({ ...(t.day === today ? t : { day: today }), hours: true })), setHours(v));
  const pickQuality = (v: number) => (setTouched((t) => ({ ...(t.day === today ? t : { day: today }), quality: true })), setQuality(v));
  // A night missed (2026-11-13, the frictionless pass): a quiet toggle under Save opens a day field in place, and Save logs that morning's
  // night instead; the server keeps one a day, so logging a day again replaces it. Saved says so for two seconds; an error says why.
  const [earlierOpen, setEarlierOpen] = useState(false);
  const [earlier, setEarlier] = useState('');
  const earlierId = useId();
  const day = earlierOpen && earlier && earlier < today ? earlier : today;
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!saved) return;
    const t = window.setTimeout(() => setSaved(false), 2000);
    return () => window.clearTimeout(t);
  }, [saved]);
  const save = useMutation({
    mutationFn: () => api.log('sleep', { date: day, value: hours, extra: { quality } }),
    onMutate: () => setSaved(false),
    onSuccess: () => {
      setSaved(true);
      refresh();
    },
  });
  const avg = wb.data?.parts.find((p) => p.kind === 'sleep')?.avg7 ?? null;
  // A small personal entry: a second tap removes it (the founder, 2026-11-13), never a popup.
  const ask = useTapTwice<string>();
  const remove = useMutation({ mutationFn: (id: string) => api.deleteLog('sleep', id), onSuccess: () => refresh() });

  return (
    <Screen>
      <header className="pt-lg">
        <BackLink to="/wellbeing">Wellbeing</BackLink>
        <h1 className="text-large-title">Sleep</h1>
        <p className="mt-xs m-0 text-subhead text-ink-soft">{avg === null ? 'Log a few nights and the average shows here.' : `Averaging ${avg.toFixed(1)} hours this week.`}</p>
      </header>

      {wb.data && (
        <Hero color="var(--color-r6)" deep="var(--deep-guru)" className="mt-md" character="guru" characterSize={64} mood={avg !== null && avg >= 7 ? "happy" : "sleepy"}>
          <div className="flex items-center justify-between gap-md">
            <HeroNumber value={avg === null ? '–' : avg.toFixed(1)} unit="h" label={avg === null ? 'No nights logged yet' : avg >= 7 ? 'You are sleeping well' : avg >= 6 ? 'A little short this week' : 'Short on sleep this week'} />
            <Donut segments={[{ value: avg ?? 0, color: 'var(--color-on-fill)', label: 'slept' }, { value: Math.max(0, 8 - (avg ?? 0)), color: 'rgba(255,255,255,0.3)', label: 'to eight' }]} size={112} stroke={14} track="rgba(255,255,255,0.3)" label="Hours a night against eight">
              <span className="text-caption font-semibold">of 8 h</span>
            </Donut>
          </div>
        </Hero>
      )}

      <section data-pillar="divine" className="mt-md rounded-card p-md" style={{ background: 'var(--tint-purple)' }} aria-labelledby="log-heading">
        <h2 id="log-heading" className="text-title2">
          Last night
        </h2>
        <p className="mt-md text-center text-figure-hero type-figure leading-none">
          {hours}
          <span className="text-title3"> hours</span>
        </p>
        <RulerPicker className="mt-md" label="Hours slept" tone="paper" accent="r7" min={0} max={14} step={0.5} labelEvery={2} majorStep={1} value={hours} onChange={pickHours} valueText={(v) => `${v} ${v === 1 ? 'hour' : 'hours'}`} />
        <p className="mt-md m-0 text-subhead font-semibold">Quality</p>
        <div className="mt-xs grid grid-cols-5 gap-xs" role="group" aria-label="Sleep quality">
          {QUALITY.map((q, i) => (
            <button
              key={q}
              type="button"
              aria-pressed={quality === i + 1}
              onClick={() => pickQuality(i + 1)}
              className={`toy min-h-[48px] rounded-tile text-caption ${quality === i + 1 ? 'bg-ink text-on-ink' : 'toy-soft bg-card'}`}
            >
              {q}
            </button>
          ))}
        </div>
        <Button full size="lg" className="mt-md" onClick={() => save.mutate()} disabled={save.isPending || !logs.data || (earlierOpen && day === today)}>
          {day !== today ? `Save the night of ${dayLabel(day)}` : current ? 'Update last night' : 'Save last night'}
        </Button>
        <ErrorLine e={save.error} className="mt-xs" />
        <p role="status" className={`${saved ? 'mt-xs ' : ''}m-0 text-subhead text-ink-soft`}>
          {saved ? 'Saved.' : ''}
        </p>
        <button
          type="button"
          aria-expanded={earlierOpen}
          aria-controls={earlierId}
          onClick={() => setEarlierOpen((o) => !o)}
          className="mt-xs inline-flex min-h-[44px] items-center gap-xs text-subhead font-semibold underline-offset-4 hover:underline"
        >
          Log an earlier night
          <ToggleChevron open={earlierOpen} />
        </button>
        {earlierOpen && (
          <label id={earlierId} className="block">
            <span className="block text-subhead font-semibold">The night of</span>
            <input type="date" value={earlier} max={addDays(today, -1)} onChange={(e) => setEarlier(e.target.value)} className={FIELD} />
          </label>
        )}
      </section>

      <section className="mt-lg" aria-labelledby="week-heading">
        <h2 id="week-heading" className="text-title2">
          This week
        </h2>
        <div className="mt-sm rounded-card bg-card p-md shadow-toy-soft">
          {wb.data && <PillBars allLabels values={wb.data.week.map((w) => w.sleep)} max={10} color="var(--color-r6)" labels={wb.data.week.map((w) => DAY[new Date(`${w.date}T00:00:00`).getDay()] ?? '')} label="Hours of sleep by day" />}
        </div>
      </section>

      <PeriodPanel id="sleep-period" parts={['wellbeing']} />
      <EmergenceSlot app="sleep" max={2} />
      <section className="mt-lg" aria-labelledby="thirty-heading">
        <h2 id="thirty-heading" className="text-title2">
          Last 30 nights
        </h2>
        <div className="mt-sm rounded-card bg-card p-md shadow-toy-soft">
          {(() => {
            const days = lastDays(30);
            const byDay = new Map((logs.data?.logs ?? []).map((l) => [l.date, l.value]));
            return <AreaLine values={days.map((d) => byDay.get(d) ?? null)} max={10} color="var(--color-r6)" labels={days.map(shortDay)} height={140} label="Hours of sleep over the last thirty nights" />;
          })()}
          <p className="mt-xs m-0 text-caption text-ink-soft">Seven to eight hours is the band that scores full marks.</p>
        </div>
      </section>

      {/* No heading over nothing: with no entry yet the list and its title wait. */}
      <section className="mt-lg" aria-labelledby="hist-heading" hidden={!logs.data?.logs.length}>
        <h2 id="hist-heading" className="text-title2">
          Nights
        </h2>
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {logs.data?.logs.map((l) => (
            <li key={l.id} className={`flex items-center gap-sm rounded-tile bg-card p-sm shadow-toy-soft`}>
              <span className="min-w-0 flex-1">
                <span className="block text-card-title">
                  {l.value} hours, {QUALITY[Number(l.extra.quality ?? 3) - 1]?.toLowerCase()}
                </span>
                <span className="block text-card-note text-ink-soft">{dayLabel(l.date)}</span>
              </span>
              <TapTwiceIcon
                armed={ask.isArmed(l.id)}
                onClick={() => {
                  remove.reset();
                  ask.tap(l.id, () => remove.mutate(l.id, { onSuccess: afterRemove('Night deleted.') }));
                }}
                disabled={remove.isPending}
                label={`Delete the night of ${dayLabel(l.date)}`}
                tip="Delete"
                className="toy toy-flat flex size-[44px] shrink-0 items-center justify-center rounded-pill text-ink-soft hover:text-r1"
              >
                <AnimatedIcon name="trash" size={20} />
              </TapTwiceIcon>
            </li>
          ))}
        </ul>
        {remove.isError && <ErrorLine e={remove.error} className="mt-xs" />}
      </section>
    </Screen>
  );
}
