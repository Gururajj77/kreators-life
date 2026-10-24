import { MOODS, STRESSORS, type JournalEntry } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Button } from '../components/Button';
import { CalendarGrid } from '../components/Charts';
import { Hero } from '../components/Hero';
import { MoodFace } from '../components/MoodFace';
import { BackLink } from '../components/PageHeader';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { api } from '../lib/api';
import { todayLocal } from '../lib/date';
import { useJournal, useRefreshAll } from '../lib/queries';

export function Journal() {
  const q = useJournal();
  const refresh = useRefreshAll();
  const [editing, setEditing] = useState<JournalEntry | null | 'new'>(null);
  const entries = q.data?.entries ?? [];
  const stats = q.data?.stats;

  return (
    <Screen>
      <header className="pt-lg">
        <BackLink to="/wellbeing">Wellbeing</BackLink>
        <h1 className="text-[30px]">Journal</h1>
      </header>

      {stats && (
        <Hero color="var(--color-r5)" deep="var(--deep-self)" className="mt-md" character="self" mood={stats.thisMonth > 0 ? "happy" : "sleepy"}>
          <p className="m-0 font-display text-[60px] font-extrabold leading-none">{stats.total}</p>
          <p className="mt-xs m-0 text-[16px] font-bold">{stats.total === 1 ? 'entry' : 'entries'} so far, {stats.thisMonth} this month</p>
          <div className="mt-md flex gap-xs">
            <span className="inline-flex items-center gap-xs rounded-pill bg-card px-sm py-xs text-[14px] font-extrabold text-ink">
              <span className="block size-[10px] rounded-pill bg-r4" aria-hidden="true" />
              {stats.positive} positive
            </span>
            <span className="inline-flex items-center gap-xs rounded-pill bg-card px-sm py-xs text-[14px] font-extrabold text-ink">
              <span className="block size-[10px] rounded-pill bg-r2" aria-hidden="true" />
              {stats.negative} heavy
            </span>
          </div>
          <div className="mt-md rounded-tile bg-white/20 p-sm">
            <p className="m-0 text-[12px] font-extrabold uppercase tracking-wide opacity-90">This month</p>
            <div className="mt-xs">
              <CalendarGrid
                onFill
                month={todayLocal().slice(0, 7)}
                today={todayLocal()}
                marks={Object.fromEntries(
                  entries.map((e) => {
                    const m = e.emotion ? MOODS.find((x) => x.value === e.emotion) : null;
                    return [e.createdAt.slice(0, 10), { color: m?.color ?? 'var(--color-r4)', mood: m?.value }];
                  }),
                )}
                label="Days with an entry this month"
              />
            </div>
          </div>
        </Hero>
      )}
      <Button full size="lg" className="mt-md" onClick={() => setEditing('new')}>
        New entry
      </Button>

      <section className="mt-lg" aria-labelledby="entries-heading">
        <h2 id="entries-heading" className="text-[24px]">
          My journals
        </h2>
        {entries.length === 0 && <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Nothing written yet. Say anything that is on your mind.</p>}
        <ol className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {entries.map((e) => {
            const m = e.emotion ? MOODS.find((x) => x.value === e.emotion) : null;
            return (
              <li key={e.id}>
                <button type="button" onClick={() => setEditing(e)} className="toy toy-soft flex w-full items-start gap-sm rounded-tile bg-card p-sm text-left">
                  {m ? (
                    <MoodFace value={m.value} size={40} />
                  ) : (
                    <span className="flex size-[40px] shrink-0 items-center justify-center rounded-pill bg-paper text-[20px]" aria-hidden="true">
                      📝
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px] font-bold">{e.title}</span>
                    <span className="block text-[14px] font-semibold text-ink-soft">
                      {new Date(e.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      {e.stressors.length ? `. ${e.stressors.join(', ')}` : ''}
                    </span>
                    <span className="mt-xs block text-[14px] font-semibold">{e.body.slice(0, 140)}{e.body.length > 140 ? '…' : ''}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      <EntrySheet entry={editing} onClose={() => setEditing(null)} onSaved={refresh} />
    </Screen>
  );
}

function EntrySheet({ entry, onClose, onSaved }: { entry: JournalEntry | null | 'new'; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [emotion, setEmotion] = useState<number | null>(null);
  const [stress, setStress] = useState(2);
  const [stressors, setStressors] = useState<string[]>([]);
  const existing = entry && entry !== 'new' ? entry : null;

  useEffect(() => {
    setTitle(existing?.title ?? '');
    setBody(existing?.body ?? '');
    setEmotion(existing?.emotion ?? null);
    setStress(existing?.stress ?? 2);
    setStressors(existing?.stressors ?? []);
  }, [entry]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useMutation({
    mutationFn: () => (existing ? api.updateEntry(existing.id, { title, body, emotion, stress, stressors }) : api.createEntry({ title, body, emotion, stress, stressors })),
    onSuccess: () => {
      onSaved();
      onClose();
    },
  });
  const remove = useMutation({
    mutationFn: () => api.deleteEntry(existing!.id),
    onSuccess: () => {
      onSaved();
      onClose();
    },
  });
  const words = body.trim() ? body.trim().split(/\s+/).length : 0;

  return (
    <Sheet open={entry !== null} onClose={onClose} title={existing ? 'Edit journal' : 'New journal'}>
      <form
        className="flex flex-col gap-md"
        onSubmit={(e) => {
          e.preventDefault();
          if (body.trim() || title.trim()) save.mutate();
        }}
      >
        <label className="block">
          <span className="block text-[14px] font-bold">Title</span>
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Feeling good today" className="mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]" />
        </label>
        <label className="block">
          <span className="flex justify-between text-[14px] font-bold">
            <span>Say anything that is on your mind</span>
            <span className="text-ink-soft">{words} words</span>
          </span>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} rows={6} className="mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]" />
        </label>
        <fieldset className="m-0 border-0 p-0">
          <legend className="text-[14px] font-bold">Emotion</legend>
          <div className="mt-xs grid grid-cols-5 gap-xs">
            {MOODS.map((m) => (
              <button key={m.value} type="button" aria-pressed={emotion === m.value} onClick={() => setEmotion(emotion === m.value ? null : m.value)} className="toy toy-soft flex min-h-[56px] flex-col items-center justify-center rounded-tile bg-card text-[12px] font-bold" style={emotion === m.value ? { background: m.color, color: m.text } : undefined}>
                <span className="text-[22px]" aria-hidden="true">
                  {m.emoji}
                </span>
                {m.name}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="block">
          <span className="flex justify-between text-[14px] font-bold">
            <span>Stress level</span>
            <span>{stress} of 5</span>
          </span>
          <input type="range" min={1} max={5} value={stress} onChange={(e) => setStress(Number(e.target.value))} className="mt-xs w-full accent-ink" />
        </label>
        <fieldset className="m-0 border-0 p-0">
          <legend className="text-[14px] font-bold">Stressor</legend>
          <div className="mt-xs flex flex-wrap gap-xs">
            {STRESSORS.map((s) => {
              const on = stressors.includes(s);
              return (
                <button key={s} type="button" aria-pressed={on} onClick={() => setStressors((p) => (on ? p.filter((x) => x !== s) : [...p, s]))} className={`rounded-pill border-2 px-sm py-xs text-[14px] font-bold ${on ? 'border-ink bg-ink text-on-ink' : 'border-line bg-card'}`}>
                  {s}
                </button>
              );
            })}
          </div>
        </fieldset>
        {save.isError && (
          <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
            {save.error instanceof Error ? save.error.message : 'Could not save.'}
          </p>
        )}
        <Button type="submit" size="lg" full disabled={save.isPending || (!body.trim() && !title.trim())}>
          {existing ? 'Save changes' : 'Create journal'}
        </Button>
        {existing && (
          <Button variant="ghost" disabled={remove.isPending} onClick={() => window.confirm('Delete this entry?') && remove.mutate()}>
            Delete entry
          </Button>
        )}
      </form>
    </Sheet>
  );
}
