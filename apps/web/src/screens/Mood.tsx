import { MOODS, LOCALE } from '@kreators/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { PeriodPanel } from '../components/PeriodPanel';
import { Sheet } from '../components/Sheet';
import { Button } from '../components/Button';
import { AreaLine, CalendarGrid, EmojiRow } from '../components/Charts';
import { MoodFace } from '../components/MoodFace';
import { BackLink } from '../components/PageHeader';
import { Screen } from '../components/Screen';
import { api } from '../lib/api';
import { lastDays, shortDay, todayLocal } from '../lib/date';
import { useLogs, useRefreshAll, useWellbeing } from '../lib/queries';
import { EmergenceSlot } from '../components/EmergenceSlot';

const DAY = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function Mood() {
  const refresh = useRefreshAll();
  const wb = useWellbeing();
  const logs = useLogs('mood', 30);
  // The calendar reads a year, so any month can be opened; a tapped day opens its sheet.
  const year = useLogs('mood', 365);
  const [month, setMonth] = useState(todayLocal().slice(0, 7));
  const [day, setDay] = useState<string | null>(null);
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
      <div style={{ background: `linear-gradient(135deg, ${mood.color}, color-mix(in oklab, ${mood.color} 72%, var(--fill-shade)))`, color: mood.text }}>
        <div className="mood-top safe-top mx-auto w-full max-w-[480px] px-md pb-lg pt-md md:ml-[240px] md:max-w-[1040px] md:px-lg lg:mx-auto lg:pl-[240px]">
          <BackLink to="/wellbeing" inherit>
            Wellbeing
          </BackLink>
          <h1 className="mt-sm text-center text-large-title">How are you feeling today?</h1>
          <div className="my-md flex justify-center">
            <MoodFace value={mood.value} size={140} color="rgba(255,255,255,0.22)" face="var(--color-on-fill)" label={mood.name} />
          </div>
          <p className="m-0 text-center text-title3">I am feeling {mood.name.toLowerCase()}</p>
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
                className="toy flex min-h-[64px] flex-col items-center justify-center gap-xs rounded-tile bg-card-strong text-caption text-ink"
                style={value === m.value ? { outline: '3px solid var(--color-on-fill)', outlineOffset: 2 } : undefined}
              >
                <MoodFace value={m.value} size={28} />
                {m.name}
              </button>
            ))}
          </div>
          {!why && (
            <Button full variant="light" className="mt-md" onClick={() => setWhy(true)}>
              {current ? `Update today (${MOODS.find((m) => m.value === current.value)?.name})` : 'Set mood'}
            </Button>
          )}
        </div>
      </div>

      <Screen>
        {why && (
          <section className="mt-lg rounded-card bg-card p-md shadow-toy-soft" aria-labelledby="why-heading">
            <h2 id="why-heading" className="text-title2">
              Why do you feel {mood.name.toLowerCase()}?
            </h2>
            <p className="mt-xs m-0 text-subhead text-ink-soft">Three quick sliders. They help the score explain itself later.</p>
            {(
              [
                ['How active were you?', active, setActive],
                ['How well did you eat?', ate, setAte],
                ['How was your sleep?', slept, setSlept],
              ] as const
            ).map(([label, v, set]) => (
              <label key={label} className="mt-md block">
                <span className="flex justify-between text-subhead font-semibold">
                  <span>{label}</span>
                  <span>{v} of 5</span>
                </span>
                <input type="range" min={1} max={5} value={v} onChange={(e) => set(Number(e.target.value))} className="mt-xs w-full accent-ink" />
              </label>
            ))}
            <label className="mt-md block">
              <span className="block text-subhead font-semibold">Anything else</span>
              <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Optional" className="mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-body" />
            </label>
            {save.isError && (
              <p role="alert" className="mt-sm m-0 rounded-tile bg-r1/15 p-sm text-subhead">
                {save.error instanceof Error ? save.error.message : 'Could not save.'}
              </p>
            )}
            <Button full size="lg" className="mt-md" onClick={() => save.mutate()} disabled={save.isPending}>
              Save today&rsquo;s mood
            </Button>
          </section>
        )}

        <section className="mt-lg" aria-labelledby="week-heading">
          <h2 id="week-heading" className="text-title2">
            This week
          </h2>
          <div className="mt-sm rounded-card bg-card p-md shadow-toy-soft">
            {wb.data && (
              <>
                <AreaLine values={wb.data.week.map((w) => w.mood)} max={5} min={1} color="var(--color-r3)" label="Mood by day this week" height={120} />
                <div className="mt-sm">
                  <EmojiRow
                    items={wb.data.week.map((w) => {
                      const m = w.mood === null ? null : (MOODS.find((x) => x.value === w.mood) ?? null);
                      return { label: DAY[new Date(`${w.date}T00:00:00`).getDay()] ?? '', color: m?.color ?? null, mood: m?.value ?? null };
                    })}
                  />
                </div>
              </>
            )}
          </div>
        </section>

        <MoodDaySheet date={day} existing={(year.data?.logs ?? []).find((l) => l.date === day) ?? null} onClose={() => setDay(null)} onChanged={refresh} />

        <PeriodPanel id="mood-period" parts={['wellbeing']} />
        <EmergenceSlot app="mood" max={2} />
        <section className="mt-lg" aria-labelledby="thirty-heading">
          <h2 id="thirty-heading" className="text-title2">
            Last 30 days
          </h2>
          <div className="mt-sm rounded-card bg-card p-md shadow-toy-soft">
            {(() => {
              const days = lastDays(30);
              const byDay = new Map((logs.data?.logs ?? []).map((l) => [l.date, l.value]));
              return <AreaLine values={days.map((d) => byDay.get(d) ?? null)} max={5} min={1} color="var(--color-r3)" labels={days.map(shortDay)} height={140} label="Mood over the last thirty days" />;
            })()}
          </div>
        </section>

        <section className="mt-lg" aria-labelledby="month-heading">
          <h2 id="month-heading" className="text-title2">
            This month
          </h2>
          <div className="mt-sm rounded-card bg-card p-md shadow-toy-soft">
            <CalendarGrid
              month={month}
              today={today}
              maxDate={today}
              selected={day}
              onMonth={setMonth}
              onPick={setDay}
              marks={Object.fromEntries((year.data?.logs ?? []).map((l) => {
                const m = MOODS.find((x) => x.value === Math.round(l.value)) ?? MOODS[2]!;
                return [l.date, { color: m.color, mood: m.value }];
              }))}
              label="Mood calendar. Tap a day to add, change or remove its mood."
            />
          </div>
        </section>

        <section className="mt-lg" aria-labelledby="hist-heading">
          <h2 id="hist-heading" className="text-title2">
            My mood
          </h2>
          {logs.data && logs.data.logs.length === 0 && <p className="mt-xs m-0 text-subhead text-ink-soft">Nothing logged yet. Today is a good day to start.</p>}
          <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
            {logs.data?.logs.map((l) => {
              const m = MOODS.find((x) => x.value === Math.round(l.value)) ?? MOODS[2]!;
              return (
                <li key={l.id} className={`flex items-center gap-sm rounded-tile bg-card p-sm shadow-toy-soft`}>
                  <MoodFace value={m.value} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-headline">{m.name}</span>
                    <span className="block truncate text-subhead text-ink-soft">
                      {new Date(`${l.date}T00:00:00`).toLocaleDateString(LOCALE, { weekday: 'short', month: 'short', day: 'numeric' })}
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

/** One day of the mood calendar: pick or change the face, add a note, or take the day's mood away. */
function MoodDaySheet({ date, existing, onClose, onChanged }: { date: string | null; existing: { id: string; value: number; note: string } | null; onClose: () => void; onChanged: () => void }) {
  const [value, setValue] = useState(3);
  const [note, setNote] = useState('');
  const [asking, setAsking] = useState(false);
  useEffect(() => {
    setValue(existing ? Math.round(existing.value) : 3);
    setNote(existing?.note ?? '');
    setAsking(false);
  }, [date, existing?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const qc = useQueryClient();
  const done = () => {
    void qc.invalidateQueries({ queryKey: ['logs'] });
    onChanged();
    onClose();
  };
  const save = useMutation({ mutationFn: () => api.log('mood', { date: date!, value, note }), onSuccess: done });
  const remove = useMutation({ mutationFn: () => api.deleteLog('mood', existing!.id), onSuccess: done });
  const pretty = date ? new Date(`${date}T00:00:00`).toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' }) : '';
  const failed = save.error ?? remove.error;
  return (
    <Sheet open={date !== null} onClose={onClose} title={pretty}>
      <div className="flex flex-col gap-md pb-xl">
        <p className="m-0 text-subhead text-ink-soft">{existing ? 'Change how this day felt, or take it away.' : 'How did this day feel?'}</p>
        <div className="grid grid-cols-5 gap-xs" role="group" aria-label="Pick a mood">
          {MOODS.map((m) => (
            <button key={m.value} type="button" aria-pressed={value === m.value} onClick={() => setValue(m.value)} className={`toy flex min-h-[64px] flex-col items-center justify-center gap-xs rounded-tile border-2 text-caption ${value === m.value ? 'border-ink bg-card-strong' : 'toy-soft border-line bg-card'}`}>
              <MoodFace value={m.value} size={28} />
              {m.name}
            </button>
          ))}
        </div>
        <label className="block">
          <span className="block text-subhead font-semibold">A note (optional)</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className="mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-body" />
        </label>
        {failed && <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-subhead">{failed instanceof Error ? failed.message : 'That did not save.'}</p>}
        <Button full size="lg" onClick={() => save.mutate()} disabled={save.isPending}>
          {existing ? 'Save this day' : 'Add this day'}
        </Button>
        {existing && !asking && (
          <Button full variant="outline" onClick={() => setAsking(true)} disabled={remove.isPending}>
            Remove this day
          </Button>
        )}
        {existing && asking && (
          <div className="grid gap-sm rounded-tile bg-card p-sm" role="group" aria-label="Remove this day’s mood?">
            <p className="m-0 text-headline">Remove this day’s mood?</p>
            <p className="m-0 text-subhead text-ink-soft">It comes off your calendar and charts. This cannot be undone.</p>
            {remove.isError && <p className="m-0 text-subhead text-r1">That did not work. Try again.</p>}
            <div className="flex flex-wrap gap-xs">
              <button
                type="button"
                disabled={remove.isPending}
                onClick={() => remove.mutate()}
                className="toy inline-flex min-h-[48px] items-center justify-center rounded-pill bg-r1 px-md text-callout text-on-fill disabled:opacity-50"
              >
                Yes, delete it
              </button>
              <Button variant="outline" onClick={() => setAsking(false)}>
                Keep it
              </Button>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}
