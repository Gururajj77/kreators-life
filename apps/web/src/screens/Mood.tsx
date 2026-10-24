import { MOODS } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../components/Button';
import { WeekBars } from '../components/Charts';
import { Screen } from '../components/Screen';
import { api } from '../lib/api';
import { todayLocal } from '../lib/date';
import { useLogs, useRefreshAll, useWellbeing } from '../lib/queries';

const DAY = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function Mood() {
  const refresh = useRefreshAll();
  const wb = useWellbeing();
  const logs = useLogs('mood', 30);
  const today = todayLocal();
  const current = logs.data?.logs.find((l) => l.date === today) ?? null;
  const [value, setValue] = useState<number>(3);
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (current && !touched) setValue(current.value);
  }, [current, touched]);
  const [why, setWhy] = useState(false);
  const [active, setActive] = useState(3);
  const [ate, setAte] = useState(3);
  const [slept, setSlept] = useState(3);
  const [note, setNote] = useState('');
  const mood = MOODS.find((m) => m.value === value) ?? MOODS[2]!;

  const save = useMutation({
    mutationFn: () => api.log('mood', { date: today, value, extra: why ? { active, ate, slept } : {}, note }),
    onSuccess: () => {
      refresh();
      setWhy(false);
    },
  });

  return (
    <>
      <div className="transition-colors" style={{ background: mood.color, color: mood.text }}>
        <div className="safe-top mx-auto w-full max-w-[480px] px-md pb-lg pt-md">
          <Link to="/wellbeing" className="inline-flex min-h-[44px] items-center gap-xs font-bold">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 5l-7 7 7 7" />
            </svg>
            Wellbeing
          </Link>
          <h1 className="mt-sm text-center text-[30px]">How are you feeling today?</h1>
          <p className="my-md text-center text-[96px] leading-none" aria-hidden="true">
            {mood.emoji}
          </p>
          <p className="m-0 text-center text-[20px] font-extrabold">I am feeling {mood.name.toLowerCase()}</p>
          <div className="mt-md grid grid-cols-5 gap-xs" role="group" aria-label="Pick a mood">
            {MOODS.map((m) => (
              <button
                key={m.value}
                type="button"
                aria-pressed={value === m.value}
                onClick={() => {
                  setTouched(true);
                  setValue(m.value);
                }}
                className="toy flex min-h-[64px] flex-col items-center justify-center gap-xs rounded-tile bg-white/90 text-[12px] font-bold text-ink-fixed"
                style={value === m.value ? { outline: '3px solid #4F3422', outlineOffset: 2 } : undefined}
              >
                <span className="text-[24px]" aria-hidden="true">
                  {m.emoji}
                </span>
                {m.name}
              </button>
            ))}
          </div>
          {!why && (
            <Button full className="mt-md" onClick={() => setWhy(true)}>
              {current ? `Update today (${MOODS.find((m) => m.value === current.value)?.name})` : 'Set mood'}
            </Button>
          )}
        </div>
      </div>

      <Screen>
        {why && (
          <section className="mt-lg rounded-card bg-card p-md shadow-toy-soft" aria-labelledby="why-heading">
            <h2 id="why-heading" className="text-[24px]">
              Why do you feel {mood.name.toLowerCase()}?
            </h2>
            <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Three quick sliders. They help the score explain itself later.</p>
            {(
              [
                ['How active were you?', active, setActive],
                ['How well did you eat?', ate, setAte],
                ['How was your sleep?', slept, setSlept],
              ] as const
            ).map(([label, v, set]) => (
              <label key={label} className="mt-md block">
                <span className="flex justify-between text-[14px] font-bold">
                  <span>{label}</span>
                  <span>{v} of 5</span>
                </span>
                <input type="range" min={1} max={5} value={v} onChange={(e) => set(Number(e.target.value))} className="mt-xs w-full accent-ink" />
              </label>
            ))}
            <label className="mt-md block">
              <span className="block text-[14px] font-bold">Anything else</span>
              <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Optional" className="mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]" />
            </label>
            {save.isError && (
              <p role="alert" className="mt-sm m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
                {save.error instanceof Error ? save.error.message : 'Could not save.'}
              </p>
            )}
            <Button full size="lg" className="mt-md" onClick={() => save.mutate()} disabled={save.isPending}>
              Save today&rsquo;s mood
            </Button>
          </section>
        )}

        <section className="mt-lg" aria-labelledby="week-heading">
          <h2 id="week-heading" className="text-[24px]">
            This week
          </h2>
          <div className="mt-sm rounded-card bg-card p-md shadow-toy-soft">
            {wb.data && (
              <WeekBars values={wb.data.week.map((w) => w.mood)} max={5} color="#FACC15" labels={wb.data.week.map((w) => DAY[new Date(`${w.date}T00:00:00`).getDay()] ?? '')} label="Mood by day this week" />
            )}
          </div>
        </section>

        <section className="mt-lg" aria-labelledby="hist-heading">
          <h2 id="hist-heading" className="text-[24px]">
            My mood
          </h2>
          {logs.data && logs.data.logs.length === 0 && <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Nothing logged yet. Today is a good day to start.</p>}
          <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
            {logs.data?.logs.map((l) => {
              const m = MOODS.find((x) => x.value === Math.round(l.value)) ?? MOODS[2]!;
              return (
                <li key={l.id} className="flex items-center gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
                  <span className="flex size-[40px] shrink-0 items-center justify-center rounded-pill text-[20px]" style={{ background: m.color }} aria-hidden="true">
                    {m.emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16px] font-bold">{m.name}</span>
                    <span className="block truncate text-[14px] font-semibold text-ink-soft">
                      {new Date(`${l.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                      {l.note ? `. ${l.note}` : ''}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      </Screen>
    </>
  );
}
