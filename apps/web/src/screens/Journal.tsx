import { addDays, MODULE_BY_KEY, MOODS, STRESSORS, type JournalEntry } from '@kreators/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Suspense, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { PeriodPanel } from '../components/PeriodPanel';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { CalendarGrid } from '../components/Charts';
import { CloseButton } from '../components/CloseButton';
import { Hero } from '../components/Hero';
import { MoodFace } from '../components/MoodFace';
import { BackLink } from '../components/PageHeader';
import { RemindersSection } from '../components/Reminders';
import { Screen } from '../components/Screen';
import { SkeletonList } from '../components/Skeleton';
import { Sheet } from '../components/Sheet';
import { api } from '../lib/api';
import { FIELD, RED_YES } from '../lib/ui';
import { todayLocal, dateTime, fullDay, inZone } from '../lib/date';
import { lazyNamed } from '../lib/lazy';
import { useJournal, useRefreshAll } from '../lib/queries';
import { Pager, usePage } from '../components/Pager';
import { AppIcon } from '../components/AppIcon';
import { EmergenceSlot } from '../components/EmergenceSlot';
import { GratitudeCard, GratitudeLines } from '../components/GratitudeCard';

// The prompt list is a large block of text, so it downloads only when the Journal opens.
const JournalPrompt = lazyNamed(() => import('../components/JournalPrompt'), 'JournalPrompt');

export function Journal() {
  const pg = usePage();
  const q = useJournal(pg.query);
  const refresh = useRefreshAll();
  const [editing, setEditing] = useState<JournalEntry | null | 'new'>(null);
  // The calendar: the month on show, the day tapped, and the date a new entry is written for.
  const [month, setMonth] = useState(todayLocal().slice(0, 7));
  const [day, setDay] = useState<string | null>(null);
  const [newFor, setNewFor] = useState<string | undefined>(undefined);
  // A prompt the person chose to write about: it sets the new entry's title and its first line. It lives only in this screen, never on the server.
  const [start, setStart] = useState<{ title: string; body: string } | null>(null);
  // Gratitude for the day: the day on show in its card (today, or a day opened from the calendar) and its heading, for focus.
  const [gratDay, setGratDay] = useState(todayLocal());
  const gratHead = useRef<HTMLHeadingElement>(null);
  const openGratitude = (date: string) => {
    setGratDay(date);
    window.requestAnimationFrame(() => {
      gratHead.current?.focus({ preventScroll: true });
      gratHead.current?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    });
  };
  const monthQ = useQuery({ queryKey: ['journal-days', month], queryFn: () => api.journalDays(month) });
  const gratitudeDots = Object.fromEntries((monthQ.data?.gratitude ?? []).map((d) => [d, true]));
  const marks = Object.fromEntries(
    (monthQ.data?.days ?? []).map((d) => {
      const m = d.emotion ? MOODS.find((x) => x.value === d.emotion) : null;
      return [d.date, { color: m?.color ?? 'var(--color-r4)', mood: m?.value }];
    }),
  );
  const entries = q.data?.entries ?? [];
  const stats = q.data?.stats;

  return (
    <Screen>
      <header className="pt-lg">
        <BackLink to="/wellbeing">Wellbeing</BackLink>
        <h1 className="text-large-title">Journal</h1>
      </header>

      {/* New entry is this screen's one solid button, so the glass tap is an outline here. */}
      <RemindersSection quiet />

      {stats && (
        <Hero color="var(--color-r5)" deep="var(--deep-self)" className="mt-md">
          {/* The dew drop stands in front of the flower in the corner, so the calendar below can use the whole width, on a phone too. */}
          <span className="absolute top-0 right-0 z-10" aria-hidden="true">
            <Avatar relationship="self" size={72} mood={stats.thisMonth > 0 ? 'happy' : 'sleepy'} decorative />
          </span>
          <div className="pr-xl">
            <p className="m-0 text-figure-hero type-figure leading-none">{stats.total}</p>
            <p className="mt-xs m-0 text-headline">{stats.total === 1 ? 'entry' : 'entries'} so far, {stats.thisMonth} this month</p>
          </div>
          <div className="mt-md flex gap-xs">
            <span className="inline-flex items-center gap-xs rounded-pill bg-card px-sm py-xs text-subhead font-medium text-ink">
              <span className="block size-[10px] rounded-pill bg-r4" aria-hidden="true" />
              {stats.positive} positive
            </span>
            <span className="inline-flex items-center gap-xs rounded-pill bg-card px-sm py-xs text-subhead font-medium text-ink">
              <span className="block size-[10px] rounded-pill bg-r2" aria-hidden="true" />
              {stats.negative} heavy
            </span>
          </div>
          <div className="mt-md rounded-tile bg-ink-fixed/20 p-sm max-[380px]:px-0">
            {/* Under 380px the tile gives its sides to the calendar, so each day stays a 44px target; the eyebrow keeps its inset. */}
            <p className="m-0 text-eyebrow uppercase opacity-90 max-[380px]:px-sm">This month</p>
            <div className="mt-xs">
              <CalendarGrid onFill month={month} today={todayLocal()} maxDate={todayLocal()} selected={day} onMonth={setMonth} onPick={setDay} marks={marks} dots={gratitudeDots} dotLabel="gratitude written" label="Journal calendar. A dot under a day means gratitude was written. Tap a day to read, add or change what it holds." />
            </div>
          </div>
        </Hero>
      )}
      {/* The day tapped on the calendar opens here, under it, never in a popup: its entries and a way to write another. */}
      <DayPanel
        date={day}
        onClose={() => setDay(null)}
        onOpen={(e) => {
          setNewFor(undefined);
          setEditing(e);
        }}
        onNew={(date) => {
          setNewFor(date);
          setEditing('new');
        }}
        onGratitude={openGratitude}
      />
      <Button full size="lg" className="mt-md" onClick={() => setEditing('new')}>
        New entry
      </Button>

      <GratitudeCard ref={gratHead} day={gratDay} onDay={openGratitude} />

      <Suspense fallback={null}>
        <JournalPrompt
          onWrite={(s) => {
            setNewFor(undefined);
            setStart(s);
            setEditing('new');
          }}
        />
      </Suspense>

      <PeriodPanel id="journal-period" parts={['journal', 'wellbeing']} />
      <EmergenceSlot app="journal" max={2} />
      <section className="mt-lg" aria-labelledby="entries-heading">
        <h2 id="entries-heading" className="text-title2">
          My journals
        </h2>
        {q.isPending && <SkeletonList className="mt-sm" count={3} lines={2} label="Opening your journal" />}
        {!q.isPending && entries.length === 0 && <p className="mt-xs m-0 text-subhead text-ink-soft">Nothing written yet. This page is only for you. Write what is on your mind.</p>}
        <ol className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {entries.map((e) => {
            const m = e.emotion ? MOODS.find((x) => x.value === e.emotion) : null;
            return (
              <li key={e.id}>
                <button type="button" onClick={() => setEditing(e)} className={`toy toy-soft flex w-full items-start gap-sm rounded-tile bg-card p-sm text-left`}>
                  {m ? (
                    <MoodFace value={m.value} size={40} />
                  ) : (
                    <span className="flex size-[40px] shrink-0 items-center justify-center rounded-pill bg-paper text-ink-soft">
                      <AppIcon name={MODULE_BY_KEY.journal?.icon} size={20} />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-card-title">
                      {e.title}
                    </span>
                    <span className="block text-card-note text-ink-soft">
                      {dateTime(e.createdAt)}
                      {e.stressors.length ? `. ${e.stressors.join(', ')}` : ''}
                    </span>
                    <span className="mt-xs block text-card-prose">{e.body.slice(0, 140)}{e.body.length > 140 ? '…' : ''}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        <Pager page={q.data?.page} label="entries" />
      </section>

      <EntrySheet
        entry={editing}
        date={newFor}
        start={start}
        onClose={() => {
          setEditing(null);
          setNewFor(undefined);
          setStart(null);
        }}
        onSaved={() => {
          refresh();
          void monthQ.refetch();
        }}
      />
    </Screen>
  );
}

/**
 * One day of the calendar, shown in a card right under it (the day keeps its ring on the calendar): what was written that day, a way to
 * open each entry, and a way to add another. Focus moves to its heading when a day is picked; Escape or the close button folds it and
 * hands focus back to the day that opened it. New entry stays the screen's one solid button, so the panel's button is an outline.
 */
function DayPanel({ date, onClose, onOpen, onNew, onGratitude }: { date: string | null; onClose: () => void; onOpen: (e: JournalEntry) => void; onNew: (date: string) => void; onGratitude: (date: string) => void }) {
  const q = useQuery({ queryKey: ['journal-day', date], queryFn: () => api.journalDay(date!), enabled: Boolean(date) });
  const entries = q.data?.entries ?? [];
  // The day's gratitude, read only here; today and yesterday open in the gratitude card to change.
  const g = useQuery({ queryKey: ['gratitude', date], queryFn: () => api.gratitude(date!), enabled: Boolean(date) });
  const thankful = (g.data?.gratitude?.lines ?? []).filter((l) => l.text.trim());
  const today = todayLocal();
  const canChange = date === today || date === addDays(today, -1);
  const pretty = date ? fullDay(date) : '';
  const box = useRef<HTMLElement>(null);
  const head = useRef<HTMLHeadingElement>(null);
  const back = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!date) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const from = document.activeElement;
    if (from instanceof HTMLElement && !box.current?.contains(from)) back.current = from;
    head.current?.focus({ preventScroll: true });
    head.current?.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
    const el = box.current;
    if (!el) return;
    if (reduced) {
      gsap.set(el, { opacity: 1, y: 0 });
      return;
    }
    const tween = gsap.fromTo(el, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.3, ease: 'expo.out' });
    return () => {
      tween.kill();
    };
  }, [date]);
  if (!date) return null;
  const close = () => {
    const to = back.current;
    back.current = null;
    onClose();
    to?.focus({ preventScroll: true });
  };
  return (
    <section
      ref={box}
      aria-labelledby="journal-day-heading"
      className="mt-md rounded-card bg-card p-md shadow-toy-soft"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !e.defaultPrevented && box.current?.contains(e.target as Node)) {
          e.preventDefault();
          close();
        }
      }}
    >
      <div className="flex items-start justify-between gap-sm">
        <h2 id="journal-day-heading" ref={head} tabIndex={-1} className="m-0 min-w-0 text-title3 outline-none">
          {pretty}
        </h2>
        <CloseButton onClick={close} label="Close this day" />
      </div>
      <div className="mt-sm flex flex-col gap-sm">
        {q.isPending && <SkeletonList count={1} lines={2} label="Opening" />}
        {q.data && entries.length === 0 && <p className="m-0 text-subhead text-ink-soft">Nothing written on this day yet.</p>}
        {entries.length > 0 && (
          <ul className="m-0 flex list-none flex-col gap-xs p-0">
            {entries.map((e) => {
              const m = e.emotion ? MOODS.find((x) => x.value === e.emotion) : null;
              return (
                <li key={e.id}>
                  <button type="button" onClick={() => onOpen(e)} className="toy toy-soft flex w-full items-center gap-sm rounded-tile bg-paper p-sm text-left">
                    {m && <MoodFace value={m.value} size={36} />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-card-title">{e.title}</span>
                      <span className="block truncate text-card-note text-ink-soft">{e.body}</span>
                    </span>
                    <span className="text-subhead text-ink-soft">Edit</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <Button variant="outline" full onClick={() => onNew(date)}>
          {entries.length > 0 ? 'Add another entry for this day' : 'Write an entry for this day'}
        </Button>
        {g.data && (thankful.length > 0 || canChange) && (
          <div className="mt-xs flex flex-col gap-sm rounded-tile bg-paper p-sm">
            <h3 className="m-0 text-headline">Gratitude</h3>
            {thankful.length > 0 ? <GratitudeLines lines={thankful} /> : <p className="m-0 text-subhead text-ink-soft">No gratitude written on this day yet.</p>}
            {canChange && (
              <Button variant="outline" full onClick={() => onGratitude(date)}>
                {thankful.length > 0 ? 'Change this day’s gratitude' : 'Write gratitude for this day'}
              </Button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function EntrySheet({ entry, date, start, onClose, onSaved }: { entry: JournalEntry | null | 'new'; date?: string; start?: { title: string; body: string } | null; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [emotion, setEmotion] = useState<number | null>(null);
  const [stress, setStress] = useState(2);
  const [stressors, setStressors] = useState<string[]>([]);
  const [asking, setAsking] = useState(false);
  const existing = entry && entry !== 'new' ? entry : null;
  const qc = useQueryClient();

  useEffect(() => {
    setTitle(existing?.title ?? start?.title ?? '');
    setBody(existing?.body ?? start?.body ?? '');
    setEmotion(existing?.emotion ?? null);
    setStress(existing?.stress ?? 2);
    setStressors(existing?.stressors ?? []);
    setAsking(false);
  }, [entry]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useMutation({
    mutationFn: () => (existing ? api.updateEntry(existing.id, { title, body, emotion, stress, stressors }) : api.createEntry({ title, body, emotion, stress, stressors, ...(date ? { date } : {}) })),
    onSuccess: () => {
      onSaved();
      void qc.invalidateQueries({ queryKey: ['journal-day'] });
      onClose();
    },
  });
  const remove = useMutation({
    mutationFn: () => api.deleteEntry(existing!.id),
    onSuccess: () => {
      onSaved();
      void qc.invalidateQueries({ queryKey: ['journal-day'] });
      onClose();
    },
  });
  const words = body.trim() ? body.trim().split(/\s+/).length : 0;

  return (
    <Sheet open={entry !== null} onClose={onClose} title={existing ? 'Edit entry' : date ? `New entry for ${inZone(date, { day: 'numeric', month: 'long' })}` : 'New entry'}>
      <form
        className="flex flex-col gap-md"
        onSubmit={(e) => {
          e.preventDefault();
          if (body.trim() || title.trim()) save.mutate();
        }}
      >
        <label className="block">
          <span className="block text-subhead font-semibold">Title</span>
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Feeling good today" className={FIELD} />
        </label>
        <label className="block">
          <span className="flex justify-between text-subhead">
            <span>Say anything that is on your mind</span>
            <span className="text-ink-soft">{words} words</span>
          </span>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} rows={6} className={FIELD} />
        </label>
        <fieldset className="m-0 border-0 p-0">
          <legend className="text-subhead font-semibold">Emotion</legend>
          <div className="mt-xs grid grid-cols-5 gap-xs">
            {MOODS.map((m) => (
              <button key={m.value} type="button" aria-pressed={emotion === m.value} onClick={() => setEmotion(emotion === m.value ? null : m.value)} className="toy toy-soft flex min-h-[56px] flex-col items-center justify-center rounded-tile bg-card text-caption" style={emotion === m.value ? { background: m.color, color: m.text } : undefined}>
                <MoodFace value={m.value} size={28} />
                {m.name}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="block">
          <span className="flex justify-between text-subhead font-semibold">
            <span>Stress level</span>
            <span>{stress} of 5</span>
          </span>
          <input type="range" min={1} max={5} value={stress} onChange={(e) => setStress(Number(e.target.value))} className="mt-xs w-full accent-ink" />
        </label>
        <fieldset className="m-0 border-0 p-0">
          <legend className="text-subhead font-semibold">Stressor</legend>
          <div className="fill-row mt-xs flex flex-wrap gap-xs">
            {STRESSORS.map((s) => {
              const on = stressors.includes(s);
              return (
                <button key={s} type="button" aria-pressed={on} onClick={() => setStressors((p) => (on ? p.filter((x) => x !== s) : [...p, s]))} className={`min-h-[44px] rounded-pill border-2 px-sm py-xs text-subhead font-medium ${on ? 'border-ink bg-ink text-on-ink' : 'border-line bg-card'}`}>
                  {s}
                </button>
              );
            })}
          </div>
        </fieldset>
        {save.isError && (
          <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-subhead">
            {save.error instanceof Error ? save.error.message : 'Could not save.'}
          </p>
        )}
        {/* The main save takes the free width, with Delete at its right on the same line (the founder's form rule, 2026-11-06). */}
        <div className="flex flex-wrap items-center gap-xs">
          <Button type="submit" size="lg" className="flex-1" disabled={save.isPending || (!body.trim() && !title.trim())}>
            {existing ? 'Save changes' : 'Save entry'}
          </Button>
          {existing && !asking && (
            <Button variant="ghost" disabled={remove.isPending} onClick={() => setAsking(true)}>
              Delete entry
            </Button>
          )}
        </div>
        {existing && asking && (
          <div className="grid gap-sm rounded-tile bg-card p-sm" role="group" aria-label="Delete this entry?">
            <p className="m-0 text-headline">Delete this entry?</p>
            <p className="m-0 text-subhead text-ink-soft">Its words are gone for good. This cannot be undone.</p>
            {remove.isError && <p className="m-0 text-subhead text-r1">That did not work. Try again.</p>}
            <div className="flex flex-wrap gap-xs">
              <button
                type="button"
                disabled={remove.isPending}
                onClick={() => remove.mutate()}
                className={RED_YES}
              >
                Yes, delete it
              </button>
              <Button variant="outline" onClick={() => setAsking(false)}>
                Keep it
              </Button>
            </div>
          </div>
        )}
      </form>
    </Sheet>
  );
}
