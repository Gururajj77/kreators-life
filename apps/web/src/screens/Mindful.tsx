import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { FocusDashboard } from '../components/FocusDashboard';
import { FocusRounds } from '../components/FocusRounds';
import { PeriodPanel } from '../components/PeriodPanel';
import { Button } from '../components/Button';
import { AreaLine, Donut, Legend } from '../components/Charts';
import { Hero, HeroNumber } from '../components/Hero';
import { useCelebrate } from '../components/Celebration';
import { BackLink } from '../components/PageHeader';
import { Screen } from '../components/Screen';
import { api } from '../lib/api';
import { lastDays, shortDay, todayLocal } from '../lib/date';
import { useLogs, useRefreshAll, useWellbeing } from '../lib/queries';

const LENGTHS = [1, 3, 5, 10];

export function Mindful() {
  const refresh = useRefreshAll();
  const qc = useQueryClient();
  const celebrate = useCelebrate();
  const reduce = useReducedMotion();
  const wb = useWellbeing();
  const logs = useLogs('mindful', 30);
  const [minutes, setMinutes] = useState(3);
  const [left, setLeft] = useState<number | null>(null);
  const timer = useRef<number | null>(null);
  const save = useMutation({
    mutationFn: (m: number) => api.log('mindful', { date: todayLocal(), value: m, extra: { kind: 'breathe' } }),
    onSuccess: (_, m) => {
      refresh();
      celebrate({ title: `${m} mindful ${m === 1 ? 'minute' : 'minutes'} logged`, color: '#9BB068' });
    },
  });

  useEffect(() => {
    if (left === null) return;
    if (left <= 0) {
      setLeft(null);
      save.mutate(minutes);
      return;
    }
    timer.current = window.setTimeout(() => setLeft((l) => (l === null ? null : l - 1)), 1000);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left]);

  const running = left !== null;
  const total = wb.data?.parts.find((p) => p.kind === 'mindful')?.latest ?? 0;
  const buckets = [
    { label: 'One minute', color: 'var(--color-r3)', test: (m: number) => m <= 1 },
    { label: 'Three', color: 'var(--color-r4)', test: (m: number) => m > 1 && m <= 3 },
    { label: 'Five', color: 'var(--color-r2)', test: (m: number) => m > 3 && m <= 5 },
    { label: 'More than five', color: 'var(--color-r6)', test: (m: number) => m > 5 },
  ].map((b) => ({ ...b, value: (logs.data?.logs ?? []).filter((l) => b.test(l.value)).reduce((s, l) => s + l.value, 0) }));
  const monthTotal = buckets.reduce((s, b) => s + b.value, 0);

  return (
    <Screen>
      <header className="pt-lg">
        <BackLink to="/wellbeing">Wellbeing</BackLink>
        <h1 className="text-[30px]">Mindful minutes</h1>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">{total} minutes this week. Breathe with the circle: in as it grows, out as it shrinks. Or work in focus sessions, with breaks to breathe.</p>
      </header>

      {wb.data && (
        <Hero color="var(--color-r4)" deep="var(--deep-lover_partner)" className="mt-md" character="lover_partner" mood={total >= 30 ? "excited" : "happy"}>
          <HeroNumber value={total} unit="min" label="mindful minutes this week" />
        </Hero>
      )}

      <section className="mt-md rounded-card p-md text-center" style={{ background: 'var(--tint-green)' }} aria-live="polite">
        <div className="mx-auto flex h-[200px] w-[200px] items-center justify-center">
          <motion.div
            className="flex size-[120px] items-center justify-center rounded-pill bg-card font-display text-[30px] font-extrabold text-ink shadow-toy-soft"
            animate={running && !reduce ? { scale: [1, 1.5, 1.5, 1] } : { scale: 1 }}
            transition={running && !reduce ? { duration: 10, times: [0, 0.4, 0.5, 1], repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' } : { duration: 0.3 }}
          >
            {running ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : `${minutes}m`}
          </motion.div>
        </div>
        {!running ? (
          <>
            <div className="grid grid-cols-4 gap-xs" role="group" aria-label="Length">
              {LENGTHS.map((m) => (
                <button key={m} type="button" aria-pressed={minutes === m} onClick={() => setMinutes(m)} className={`toy min-h-[48px] rounded-tile text-[14px] font-bold ${minutes === m ? 'bg-ink text-on-ink' : 'toy-soft bg-card'}`}>
                  {m} min
                </button>
              ))}
            </div>
            <Button full size="lg" className="mt-md" onClick={() => setLeft(minutes * 60)}>
              Start
            </Button>
          </>
        ) : (
          <Button variant="outline" full className="mt-md" onClick={() => setLeft(null)}>
            Stop without logging
          </Button>
        )}
      </section>

      <FocusRounds
        onRound={(m, nodeId) => void api.logFocus(m, nodeId, todayLocal()).then(() => qc.invalidateQueries({ queryKey: ['focus'] })).catch(() => undefined)}
        onLog={(m, kind) =>
          void api.log('mindful', { date: todayLocal(), value: m, extra: { kind } }).then(() => {
            refresh();
            celebrate({ title: `${m} mindful ${m === 1 ? 'minute' : 'minutes'} logged`, color: '#9BB068' });
          })
        }
      />

      <FocusDashboard />

      <PeriodPanel id="mindful-period" parts={['wellbeing']} />
      <section className="mt-lg" aria-labelledby="thirty-heading">
        <h2 id="thirty-heading" className="text-[24px]">
          Last 30 days
        </h2>
        <div className="mt-sm rounded-card bg-card p-md shadow-toy-soft">
          {(() => {
            const days = lastDays(30);
            const byDay = new Map<string, number>();
            for (const l of logs.data?.logs ?? []) byDay.set(l.date, (byDay.get(l.date) ?? 0) + l.value);
            const vals = days.map((d) => byDay.get(d) ?? 0);
            return <AreaLine values={vals} max={Math.max(15, ...vals)} color="var(--color-r4)" labels={days.map(shortDay)} height={140} label="Mindful minutes per day over the last thirty days" />;
          })()}
        </div>
      </section>

      <section className="mt-lg" aria-labelledby="how-heading">
        <h2 id="how-heading" className="text-[24px]">
          How you breathe
        </h2>
        <div className="mt-sm flex items-center gap-md rounded-card bg-card p-md shadow-toy-soft">
          <Donut segments={buckets.map((b) => ({ value: b.value, color: b.color, label: b.label }))} size={132} stroke={20} label="Minutes by session length, last thirty days">
            <span className="flex flex-col items-center leading-none">
              <span className="font-display text-[24px] font-extrabold">{monthTotal}</span>
              <span className="mt-xs text-[12px] font-bold text-ink-soft">min</span>
            </span>
          </Donut>
          <div className="min-w-0 flex-1">
            <p className="m-0 text-[14px] font-bold">By session length, last thirty days</p>
            <div className="mt-xs">
              <Legend items={buckets.map((b) => ({ color: b.color, label: b.label, text: `${b.value} min` }))} />
            </div>
          </div>
        </div>
      </section>

      <section className="mt-lg" aria-labelledby="hist-heading">
        <h2 id="hist-heading" className="text-[24px]">
          Sessions
        </h2>
        {logs.data && logs.data.logs.length === 0 && <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">No sessions yet. Pick a length above and start. Even one minute counts.</p>}
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {logs.data?.logs.map((l) => (
            <li key={l.id} className={`flex items-center gap-sm rounded-tile bg-card p-sm shadow-toy-soft`}>
              <span className="flex size-[40px] shrink-0 items-center justify-center rounded-pill bg-r4 text-[18px]" aria-hidden="true">
                🧘
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-bold">
                  {l.value} {l.value === 1 ? 'minute' : 'minutes'}
                </span>
                <span className="block text-[14px] font-semibold text-ink-soft">{new Date(l.createdAt).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </Screen>
  );
}
