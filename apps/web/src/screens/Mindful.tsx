import { LOCALE } from '@kreators/shared';
import { FocusDashboard } from '../components/FocusDashboard';
import { PeriodPanel } from '../components/PeriodPanel';
import { AreaLine, Donut, Legend } from '../components/Charts';
import { Hero, HeroNumber } from '../components/Hero';
import { BackLink } from '../components/PageHeader';
import { Screen } from '../components/Screen';
import { lastDays, shortDay } from '../lib/date';
import { useLogs, useWellbeing } from '../lib/queries';
import { useFocusPortal } from '../lib/focusPortal';
import { Icon } from '../components/Icon';
import { Wind } from 'lucide-react';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AnimatedIcon } from '../components/AnimatedIcon';
import { Button } from '../components/Button';
import { Sheet } from '../components/Sheet';
import { api } from '../lib/api';
import { useRefreshAll } from '../lib/queries';
import { EmergenceSlot } from '../components/EmergenceSlot';

export function Mindful() {
  const wb = useWellbeing();
  const logs = useLogs('mindful', 30);
  const setFocusSlot = useFocusPortal((s) => s.setTarget);
  const total = wb.data?.parts.find((p) => p.kind === 'mindful')?.latest ?? 0;
  const buckets = [
    { label: 'One minute', color: 'var(--color-r3)', test: (m: number) => m <= 1 },
    { label: 'Three', color: 'var(--color-r4)', test: (m: number) => m > 1 && m <= 3 },
    { label: 'Five', color: 'var(--color-r2)', test: (m: number) => m > 3 && m <= 5 },
    { label: 'More than five', color: 'var(--color-r6)', test: (m: number) => m > 5 },
  ].map((b) => ({ ...b, value: (logs.data?.logs ?? []).filter((l) => b.test(l.value)).reduce((s, l) => s + l.value, 0) }));
  const monthTotal = buckets.reduce((s, b) => s + b.value, 0);
  // A session can be deleted (never edited): the person's own line, asked once more first. Logging pays no xp, so nothing is taken back.
  const refresh = useRefreshAll();
  const [toDelete, setToDelete] = useState<{ id: string; label: string } | null>(null);
  const remove = useMutation({ mutationFn: (id: string) => api.deleteLog('mindful', id), onSuccess: () => (setToDelete(null), refresh()) });
  const when = (iso: string) => new Date(iso).toLocaleString(LOCALE, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  return (
    <Screen>
      <header className="pt-lg">
        <BackLink to="/wellbeing">Wellbeing</BackLink>
        <h1 className="text-large-title">Mindfulness</h1>
        <p className="mt-xs m-0 text-subhead text-ink-soft">Breathe with the circle, or work in focus sessions with breaks.</p>
      </header>

      {wb.data && (
        <Hero color="var(--color-r4)" deep="var(--deep-lover_partner)" className="mt-md" character="lover_partner" mood={total >= 30 ? "excited" : "happy"}>
          <HeroNumber value={total} unit="min" label="mindful minutes this week" />
        </Hero>
      )}


      {/* One panel for breathing and focus (Breathe is its first tab). FocusRounds itself lives in FocusRoundsHost, mounted once so a
          running clock survives leaving this page; this slot is where it draws while Mindful is the screen showing (lib/focusPortal.ts). */}
      <div ref={setFocusSlot} />

      <FocusDashboard />

      <PeriodPanel id="mindful-period" parts={['wellbeing']} />
      <EmergenceSlot app="mindful" max={2} />
      <section className="mt-lg" aria-labelledby="thirty-heading">
        <h2 id="thirty-heading" className="text-title2">
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
        <h2 id="how-heading" className="text-title2">
          How you breathe
        </h2>
        <div className="mt-sm flex items-center gap-md rounded-card bg-card p-md shadow-toy-soft">
          <Donut segments={buckets.map((b) => ({ value: b.value, color: b.color, label: b.label }))} size={132} stroke={20} label="Minutes by session length, last thirty days">
            <span className="flex flex-col items-center leading-none">
              <span className="text-title2 type-figure">{monthTotal}</span>
              <span className="mt-xs text-caption text-ink-soft">min</span>
            </span>
          </Donut>
          <div className="min-w-0 flex-1">
            <p className="m-0 text-subhead">By session length, last thirty days</p>
            <div className="mt-xs">
              <Legend items={buckets.map((b) => ({ color: b.color, label: b.label, text: `${b.value} min` }))} />
            </div>
          </div>
        </div>
      </section>

      <section className="mt-lg" aria-labelledby="hist-heading">
        <h2 id="hist-heading" className="text-title2">
          Sessions
        </h2>
        {logs.data && logs.data.logs.length === 0 && <p className="mt-xs m-0 text-subhead text-ink-soft">No sessions yet. Pick a length above and start. Even one minute counts.</p>}
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {logs.data?.logs.map((l) => (
            <li key={l.id} className={`flex items-center gap-sm rounded-tile bg-card p-sm shadow-toy-soft`}>
              <span className="flex size-[40px] shrink-0 items-center justify-center rounded-pill bg-r4 text-on-fill" aria-hidden="true">
                <Icon icon={Wind} size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-headline">
                  {l.value} {l.value === 1 ? 'minute' : 'minutes'}
                </span>
                <span className="block text-subhead text-ink-soft">{when(l.createdAt)}</span>
              </span>
              <button
                type="button"
                onClick={() => setToDelete({ id: l.id, label: `${l.value} ${l.value === 1 ? 'minute' : 'minutes'}, ${when(l.createdAt)}` })}
                aria-label={`Delete the session of ${l.value} ${l.value === 1 ? 'minute' : 'minutes'} on ${when(l.createdAt)}`}
                title="Delete"
                className="toy toy-flat flex size-[44px] shrink-0 items-center justify-center rounded-pill text-ink-soft hover:text-r1"
              >
                <AnimatedIcon name="trash" size={20} />
              </button>
            </li>
          ))}
        </ul>
        <Sheet open={toDelete !== null} onClose={() => setToDelete(null)} title="Delete this session?">
          <div className="grid gap-md pb-xl">
            <p className="m-0 text-callout text-ink-soft">{toDelete?.label}. Its minutes come off your totals and charts. This cannot be undone.</p>
            {remove.isError && <p className="m-0 text-subhead text-r1">That did not work. Try again.</p>}
            <div className="flex flex-wrap gap-xs">
              <button
                type="button"
                disabled={remove.isPending}
                onClick={() => toDelete && remove.mutate(toDelete.id)}
                className="toy inline-flex min-h-[48px] items-center justify-center rounded-pill bg-r1 px-md text-callout text-on-fill disabled:opacity-50"
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
