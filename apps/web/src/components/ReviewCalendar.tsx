import { blockTimeLabel, PERIOD_KINDS, PERIOD_META, REVIEW_REMINDER_TIME, REVIEW_SCHEDULE_NAME_MAX, addDays, type Period, type PeriodKind, type Repeat, type ReviewSchedule } from '@kreators/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import gsap from 'gsap';
import { Bell, Check, type LucideIcon } from 'lucide-react';
import { api } from '../lib/api';
import { prettyDate } from '../lib/date';
import { focusHeadingAfter } from '../lib/focusHeading';
import { useAuthed } from '../lib/queries';
import { tie } from '../lib/text';
import { Button } from './Button';
import { CalendarGrid } from './Charts';
import { CloseButton } from './CloseButton';
import { Fold } from './Fold';
import { Inert } from './Inert';
import { periodCell, periodGrid } from './PeriodFilter';
import { RepeatPicker } from './RepeatPicker';
import { SkeletonList } from './Skeleton';
import { Sheet } from './Sheet';
import { StatusTag } from './StatusTag';
import { Toggle } from './Toggle';
import { FIELD } from '../lib/ui';

/** The words on this panel, in short plain sentences. */
const COPY = {
  lede: 'Pick a day to plan a look back. You get a note in your inbox on that day.',
  legend: 'A bell is a reminder. A tick is a review you wrote. A dot is a daily review.',
  empty: 'Nothing is scheduled yet. Tap a day, or schedule one here.',
  note: 'You get a note in your inbox on the day. On the first day of a week, month, quarter, half year or year it opens the one that just ended. A daily review set before noon opens the day before.',
  pastOnce: 'Pick today or a day to come, so the reminder has a day to fall on.',
} as const;

const timeText = (t: string): string => blockTimeLabel(Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)));
const nameOf = (s: { name: string; kind: PeriodKind }) => s.name || PERIOD_META[s.kind].name;

interface FormState {
  existing: ReviewSchedule | null;
  day: string;
}

/**
 * The review calendar: a month with a bell on the days a review reminder falls on and a tick on the day a written review ended. Tap a day to see
 * what is on it or to add a reminder there; a reminder can repeat the way a task repeats. The next few are listed under the grid.
 */
export function ReviewCalendar({ today, onOpenPeriod }: { today: string; onOpenPeriod: (p: Period) => void }) {
  const qc = useQueryClient();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [picked, setPicked] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const q = useAuthed(['reviews', 'schedule', month], () => api.reviewSchedule(month));
  const d = q.data;
  const refresh = () => qc.invalidateQueries({ queryKey: ['reviews', 'schedule'] });

  // Daily reviews would mark every day, so they never take a day's mark (2026-11-07): one written is a small dot under the day, and a
  // daily reminder rings no bell (it is listed under Coming up). The tick and the bell stay for the longer reviews.
  const marks: Record<string, { color: string; icon?: LucideIcon }> = {};
  const dots: Record<string, boolean> = {};
  for (const [day, v] of Object.entries(d?.days ?? {})) {
    if (v.written.some((w) => w.kind !== 'day')) marks[day] = { color: 'var(--color-r4)', icon: Check };
    else if (v.scheduled.some((x) => x.kind !== 'day')) marks[day] = { color: 'var(--color-r5)', icon: Bell };
    if (v.written.some((w) => w.kind === 'day')) dots[day] = true;
  }
  const schedules = d?.schedules ?? [];
  const coming = schedules.filter((s) => s.enabled && s.nextOn).sort((a, b) => (a.nextOn ?? '').localeCompare(b.nextOn ?? '')).slice(0, 3);
  const others = schedules.filter((s) => !coming.includes(s));
  const toggle = useMutation({ mutationFn: (v: { id: string; enabled: boolean }) => api.reviewScheduleUpdate(v.id, { enabled: v.enabled }), onSuccess: refresh });

  const row = (s: ReviewSchedule) => (
    <li key={s.id} className="rounded-tile bg-card p-sm shadow-toy-soft">
      <div className="flex items-start justify-between gap-sm">
        <div className="min-w-0">
          <p className="m-0 text-card-title">
            <Inert text={nameOf(s)} />
          </p>
          <p className="m-0 text-card-note text-ink-soft">{tie(`${s.nextOn ? prettyDate(s.nextOn) : 'No day left'} at ${timeText(s.time)}, ${s.label.toLowerCase()}`)}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setForm({ existing: s, day: s.anchor })}>
          Edit
        </Button>
      </div>
      <div className="mt-xs">
        <Toggle compact on={s.enabled} onChange={(enabled) => toggle.mutate({ id: s.id, enabled })} label="Remind me" />
      </div>
    </li>
  );

  return (
    <section className="mt-lg" aria-labelledby="rcal-heading">
      <h2 id="rcal-heading" className="text-title2">
        Review calendar
      </h2>
      <p className="mt-xs m-0 text-balance text-subhead text-ink-soft">{COPY.lede}</p>
      <div className="mt-sm rounded-card bg-card p-md shadow-toy-soft">
        <CalendarGrid month={month} marks={marks} dots={dots} dotLabel="a daily review written" label="Review calendar" today={today} selected={picked} onPick={(day) => setPicked(day)} onMonth={(m) => {
            setMonth(m);
            setPicked(null);
          }} />
        <p className="mt-sm m-0 text-caption text-ink-soft">{COPY.legend}</p>
      </div>
      {/* The day tapped opens here, under the calendar, never in a popup; the day keeps its ring on the grid. */}
      <DayPanel
        day={picked}
        data={picked ? d?.days[picked] : undefined}
        loading={q.isPending}
        schedules={schedules}
        onClose={() => setPicked(null)}
        onAdd={(day) => setForm({ existing: null, day })}
        onEdit={(s) => setForm({ existing: s, day: s.anchor })}
        onOpen={(p) => {
          setPicked(null);
          onOpenPeriod(p);
        }}
        onChanged={refresh}
      />
      {q.isError && (
        <p role="alert" className="mt-sm m-0 text-subhead">
          The calendar did not load. Try again in a moment.
        </p>
      )}

      {/* "Coming up" and its line at the left, Schedule a review at the right, level with the words' last line (the founder, 2026-11-06);
          on a phone the button takes the full width under the words (the founder, 2026-11-08). The button keeps its look. */}
      <div className="mt-md flex flex-wrap items-end justify-between gap-sm">
        <div className="min-w-0 basis-full sm:flex-[1_1_220px] sm:basis-auto">
          <h3 className="m-0 text-headline">Coming up</h3>
          {coming.length === 0 && <p className="mt-xs m-0 text-subhead text-ink-soft">{COPY.empty}</p>}
        </div>
        <div className="w-full sm:ml-auto sm:w-auto">
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => setForm({ existing: null, day: today >= `${month}-01` && today.slice(0, 7) === month ? today : `${month}-01` })}>
            Schedule a review
          </Button>
        </div>
      </div>
      {coming.length > 0 && <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0">{coming.map(row)}</ul>}
      {others.length > 0 && (
        <Fold className="mt-xs" title="All scheduled reviews" hint={String(schedules.length)}>
          <ul className="flex list-none flex-col gap-xs p-0 m-0">{others.map(row)}</ul>
        </Fold>
      )}

      <ScheduleForm state={form} today={today} onClose={() => setForm(null)} onSaved={refresh} />
    </section>
  );
}

/**
 * Removing a scheduled review, once or a whole repeating series, is a second tap, not a sheet (the founder, 2026-11-06: a reminder schedule
 * is a small remove): it holds no words of the person's, reviews they wrote stay and it can be set again. The first tap turns the label to
 * "Tap again to …" on solid red and says the reviews stay; it lapses after four seconds. The button's look at rest does not change.
 */
function RemoveTwice({ series, pending, size, onArm, onRemove }: { series: boolean; pending: boolean; size?: 'sm'; onArm: () => void; onRemove: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(t);
  }, [armed]);
  const rest = series ? 'Remove the series' : 'Remove';
  return (
    <>
      <Button
        variant="outline"
        size={size}
        disabled={pending}
        className={armed ? 'red-armed' : ''}
        onClick={() => {
          if (armed) {
            setArmed(false);
            onRemove();
          } else {
            onArm();
            setArmed(true);
          }
        }}
      >
        <span aria-live="polite">{armed ? `Tap again to ${rest.toLowerCase()}` : rest}</span>
      </Button>
      {armed && <span className="order-last basis-full text-caption text-ink-soft">Reviews you wrote stay.</span>}
    </>
  );
}

type DayData = { scheduled: { id: string; kind: PeriodKind; time: string; name: string }[]; written: { kind: PeriodKind; start: string; end: string; name?: string }[] };

/**
 * One day of the calendar, in a card right under it: the reminders that fall on it (Edit opens the schedule form, Remove is a second tap,
 * `RemoveTwice`) and the reviews written for a period that ended on it. Focus moves to its heading when a day is picked; Escape or
 * the close button folds it and hands focus back to the day that opened it. Its buttons are outlines, so the screen keeps one solid one.
 */
function DayPanel({ day, data, loading, schedules, onClose, onAdd, onEdit, onOpen, onChanged }: { day: string | null; data: DayData | undefined; loading: boolean; schedules: ReviewSchedule[]; onClose: () => void; onAdd: (day: string) => void; onEdit: (s: ReviewSchedule) => void; onOpen: (p: Period) => void; onChanged: () => void }) {
  const box = useRef<HTMLElement>(null);
  const head = useRef<HTMLHeadingElement>(null);
  const back = useRef<HTMLElement | null>(null);
  const remove = useMutation({
    mutationFn: (id: string) => api.reviewScheduleRemove(id),
    onSuccess: () => {
      onChanged();
      // The removed row's Remove button is gone, so focus cannot stay on it: bring it to the day's heading instead.
      requestAnimationFrame(() => head.current?.focus({ preventScroll: true }));
    },
  });
  useEffect(() => {
    remove.reset(); // a failed remove on another day does not follow the person here
    if (!day) return;
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
  }, [day]);
  if (!day) return null;
  const close = () => {
    const to = back.current;
    back.current = null;
    onClose();
    to?.focus({ preventScroll: true });
  };
  const scheduled = data?.scheduled ?? [];
  const written = data?.written ?? [];
  return (
    <section
      ref={box}
      aria-labelledby="rcal-day-heading"
      className="mt-sm rounded-card bg-card p-md shadow-toy-soft"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !e.defaultPrevented && box.current?.contains(e.target as Node)) {
          e.preventDefault();
          close();
        }
      }}
    >
      <div className="flex items-start justify-between gap-sm">
        <h3 id="rcal-day-heading" ref={head} tabIndex={-1} className="m-0 min-w-0 text-title3 outline-none">
          {prettyDate(day)}
        </h3>
        <CloseButton onClick={close} label="Close this day" />
      </div>
      <div className="mt-sm flex flex-col gap-sm">
        {loading && data === undefined ? (
          <SkeletonList count={1} label="Loading this day" />
        ) : (
          scheduled.length === 0 && written.length === 0 && <p className="m-0 text-subhead text-ink-soft">Nothing on this day yet.</p>
        )}
        {scheduled.map((s) => {
          const full = schedules.find((x) => x.id === s.id);
          const series = Boolean(full?.repeat);
          return (
            <div key={`${day}-${s.id}`} className="rounded-tile bg-paper p-sm">
              <p className="m-0 text-card-title">
                <Inert text={nameOf(s)} />
              </p>
              <p className="m-0 text-card-note text-ink-soft">{`Reminder at ${timeText(s.time)}${full ? `, ${full.label.toLowerCase()}` : ''}`}</p>
              <div className="mt-xs flex flex-wrap items-center gap-xs">
                <RemoveTwice series={series} size="sm" pending={remove.isPending} onArm={() => remove.reset()} onRemove={() => remove.mutate(s.id)} />
                {full && (
                  <Button variant="outline" size="sm" className="ml-auto" onClick={() => onEdit(full)}>
                    Edit
                  </Button>
                )}
              </div>
            </div>
          );
        })}
        {written.map((w) => (
          <div key={`${w.kind}-${w.start}`} className="flex items-center justify-between gap-sm rounded-tile bg-paper p-sm">
            <div className="min-w-0">
              <StatusTag tone="good">Written</StatusTag>
              <p className="mt-xs m-0 text-subhead text-ink-soft">{tie(`${w.name ?? PERIOD_META[w.kind].name} for ${w.start === w.end ? prettyDate(w.start) : `${prettyDate(w.start)} to ${prettyDate(w.end)}`}`)}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => onOpen({ kind: w.kind, start: w.start, end: w.end })}>
              Open it
            </Button>
          </div>
        ))}
        {remove.isError && (
          <p role="alert" className="m-0 text-subhead text-r1">
            {(remove.error as Error | null)?.message || 'That did not work. Try again.'}
          </p>
        )}
        <Button variant="outline" full onClick={() => onAdd(day)}>
          Add a review reminder on this day
        </Button>
      </div>
    </section>
  );
}

function ScheduleForm({ state, today, onClose, onSaved }: { state: FormState | null; today: string; onClose: () => void; onSaved: () => void }) {
  const open = state !== null;
  const existing = state?.existing ?? null;
  const [kind, setKind] = useState<PeriodKind>('week');
  const [day, setDay] = useState(today);
  const [time, setTime] = useState<string>(REVIEW_REMINDER_TIME);
  const [repeat, setRepeat] = useState<Repeat | null>(null);
  const [name, setName] = useState('');
  // A deliberate seed: each time the sheet opens it starts from the reminder or the day it was opened with.
  useEffect(() => {
    if (!state) return;
    setKind(state.existing?.kind ?? 'week');
    setDay(state.day || addDays(today, 1));
    setTime(state.existing?.time ?? REVIEW_REMINDER_TIME);
    setRepeat(state.existing?.repeat ?? null);
    setName(state.existing?.name ?? '');
    save.reset(); // a failed save or remove from the last time the form was open is not shown again
    remove.reset();
  }, [state, today]);
  const problem = !repeat && day < today ? COPY.pastOnce : null;
  const save = useMutation({
    mutationFn: () => {
      const body = { kind, anchor: day, time, repeat, name: name.trim() };
      return existing ? api.reviewScheduleUpdate(existing.id, body).then(() => undefined) : api.reviewScheduleAdd(body).then(() => undefined);
    },
    onSuccess: () => {
      onSaved();
      onClose();
    },
  });
  const remove = useMutation({
    mutationFn: () => api.reviewScheduleRemove(existing!.id),
    onSuccess: () => {
      onSaved();
      onClose();
      // The row that opened this form goes with it, so the keyboard's place moves to the calendar's heading.
      focusHeadingAfter('rcal-heading');
    },
  });
  return (
    <Sheet open={open} onClose={onClose} title={existing ? 'Change a scheduled review' : 'Schedule a review'}>
      <form
        className="flex flex-col gap-md pb-xl"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          if (!problem) save.mutate();
        }}
      >
        <div>
          <span className="block text-subhead font-semibold">Which review</span>
          {/* Six reviews since the day came (2026-11-07): one row where there is room, else three over three, never one pill alone. */}
          <div className="@container mt-xs" role="group" aria-label="Which review">
            <div className={periodGrid(PERIOD_KINDS.length)}>
              {PERIOD_KINDS.map((k, i) => (
                <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={`toy min-h-[36px] md:min-h-[44px] tap-pad min-w-0 rounded-pill border-2 px-xs text-subhead font-medium ${periodCell(i, PERIOD_KINDS.length)} ${kind === k ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
                  <span className="whitespace-nowrap">{PERIOD_META[k].short}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-xs">
          <label className="block">
            <span className="block text-subhead font-semibold">First day</span>
            <input type="date" required value={day} onChange={(e) => setDay(e.target.value)} className={FIELD} />
          </label>
          <label className="block">
            <span className="block text-subhead font-semibold">Time</span>
            <input type="time" required value={time} onChange={(e) => setTime(e.target.value)} className={FIELD} />
          </label>
        </div>
        <RepeatPicker value={repeat} anchor={day} onChange={setRepeat} onAnchor={setDay} />
        <label className="block">
          <span className="block text-subhead font-semibold">Name (optional)</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={REVIEW_SCHEDULE_NAME_MAX} placeholder="Sunday look back" className={FIELD} />
        </label>
        <p className="m-0 text-caption text-ink-soft">{COPY.note}</p>
        {problem && (
          <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-subhead">
            {problem}
          </p>
        )}
        {save.isError && (
          <p role="alert" className="m-0 text-subhead">
            {(save.error as Error | null)?.message || 'That did not save. Try again.'}
          </p>
        )}
        {remove.isError && (
          <p role="alert" className="m-0 text-subhead text-r1">
            {(remove.error as Error | null)?.message || 'That did not work. Try again.'}
          </p>
        )}
        <div className="flex flex-wrap gap-xs">
          <Button type="submit" disabled={Boolean(problem) || save.isPending || !day}>
            {save.isPending ? 'Saving' : existing ? 'Save changes' : 'Schedule it'}
          </Button>
          {existing && <RemoveTwice series={Boolean(existing.repeat)} pending={remove.isPending} onArm={() => remove.reset()} onRemove={() => remove.mutate()} />}
        </div>
      </form>
    </Sheet>
  );
}
