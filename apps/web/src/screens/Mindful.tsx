import { useMutation } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../components/Button';
import { useCelebrate } from '../components/Celebration';
import { Screen } from '../components/Screen';
import { api } from '../lib/api';
import { todayLocal } from '../lib/date';
import { useLogs, useRefreshAll, useWellbeing } from '../lib/queries';

const LENGTHS = [1, 3, 5, 10];

export function Mindful() {
  const refresh = useRefreshAll();
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

  return (
    <Screen>
      <header className="pt-lg">
        <Link to="/wellbeing" className="inline-flex min-h-[44px] items-center gap-xs font-bold text-ink-soft">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
          Wellbeing
        </Link>
        <h1 className="text-[30px]">Mindful minutes</h1>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">{total} minutes this week. Breathe with the circle: in as it grows, out as it shrinks.</p>
      </header>

      <section className="mt-md rounded-card p-md text-center" style={{ background: 'var(--tint-green)' }} aria-live="polite">
        <div className="mx-auto flex h-[200px] w-[200px] items-center justify-center">
          <motion.div
            className="flex size-[120px] items-center justify-center rounded-pill bg-r4 font-display text-[30px] font-extrabold text-ink"
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

      <section className="mt-lg" aria-labelledby="hist-heading">
        <h2 id="hist-heading" className="text-[24px]">
          Sessions
        </h2>
        {logs.data && logs.data.logs.length === 0 && <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">No sessions yet. Even one minute counts.</p>}
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {logs.data?.logs.map((l) => (
            <li key={l.id} className="flex items-center gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
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
