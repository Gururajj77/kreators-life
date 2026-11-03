import { blockTimeLabel, PERIOD_KINDS, PERIOD_META, REVIEW_REMINDER_TIME, REVIEW_SCHEDULE_NAME_MAX, addDays, type Period, type PeriodKind, type Repeat, type ReviewSchedule } from '@kreators/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { Bell, Check, type LucideIcon } from 'lucide-react';
import { api } from '../lib/api';
import { prettyDate } from '../lib/date';
import { useAuthed } from '../lib/queries';
import { tie } from '../lib/text';
import { Button } from './Button';
import { CalendarGrid } from './Charts';
import { Fold } from './Fold';
import { Inert } from './Inert';
import { RepeatPicker } from './RepeatPicker';
import { Sheet } from './Sheet';
import { StatusTag } from './StatusTag';
import { Toggle } from './Toggle';
import { FIELD } from '../lib/ui';

/** The words on this panel, in short plain sentences. */
const COPY = {
  lede: 'Pick a day to plan a look back. You get a note in your inbox on that day.',
  legend: 'A bell is a reminder. A tick is a review you wrote.',
  empty: 'Nothing is scheduled yet. Tap a day, or use the button below.',
  note: 'You get a note in your inbox on the day. On the first day of a week, month, quarter or half year it opens the one that just ended.',
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

  const marks: Record<string, { color: string; icon?: LucideIcon }> = {};
  for (const [day, v] of Object.entries(d?.days ?? {})) {
    if (v.written.length > 0) marks[day] = { color: 'var(--color-r4)', icon: Check };
    else if (v.scheduled.length > 0) marks[day] = { color: 'var(--color-r5)', icon: Bell };
  }
  const schedules = d?.schedules ?? [];
  const coming = schedules.filter((s) => s.enabled && s.nextOn).sort((a, b) => (a.nextOn ?? '').localeCompare(b.nextOn ?? '')).slice(0, 3);
  const others = schedules.filter((s) => !coming.includes(s));
  const toggle = useMutation({ mutationFn: (v: { id: string; enabled: boolean }) => api.reviewScheduleUpdate(v.id, { enabled: v.enabled }), onSuccess: refresh });

  const row = (s: ReviewSchedule) => (
    <li key={s.id} className="rounded-tile bg-card p-sm shadow-toy-soft">
      <div className="flex items-start justify-between gap-sm">
        <div className="min-w-0">
          <p className="m-0 text-[16px] font-extrabold">
            <Inert text={nameOf(s)} />
          </p>
          <p className="m-0 text-[14px] font-semibold text-ink-soft">{tie(`${s.nextOn ? prettyDate(s.nextOn) : 'No day left'} at ${timeText(s.time)}, ${s.label.toLowerCase()}`)}</p>
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
      <h2 id="rcal-heading" className="text-[24px]">
        Review calendar
      </h2>
      <p className="mt-xs m-0 text-balance text-[14px] font-semibold text-ink-soft">{COPY.lede}</p>
      <div className="mt-sm rounded-card bg-card p-md shadow-toy-soft">
        <CalendarGrid month={month} marks={marks} label="Review calendar" today={today} selected={picked} onPick={(day) => setPicked(day)} onMonth={setMonth} />
        <p className="mt-sm m-0 text-[12px] font-semibold text-ink-soft">{COPY.legend}</p>
      </div>
      {q.isError && (
        <p role="alert" className="mt-sm m-0 text-[14px] font-bold">
          The calendar did not load. Try again in a moment.
        </p>
      )}

      <h3 className="mt-md text-[16px]">Coming up</h3>
      {coming.length === 0 ? (
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">{COPY.empty}</p>
      ) : (
        <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0">{coming.map(row)}</ul>
      )}
      {others.length > 0 && (
        <Fold className="mt-xs" title="All scheduled reviews" hint={String(schedules.length)}>
          <ul className="flex list-none flex-col gap-xs p-0 m-0">{others.map(row)}</ul>
        </Fold>
      )}
      <div className="mt-sm">
        <Button variant="outline" onClick={() => setForm({ existing: null, day: today >= `${month}-01` && today.slice(0, 7) === month ? today : `${month}-01` })}>
          Schedule a review
        </Button>
      </div>

      <DaySheet
        day={picked}
        data={picked ? d?.days[picked] : undefined}
        schedules={schedules}
        onClose={() => setPicked(null)}
        onAdd={(day) => {
          setPicked(null);
          setForm({ existing: null, day });
        }}
        onEdit={(s) => {
          setPicked(null);
          setForm({ existing: s, day: s.anchor });
        }}
        onOpen={(p) => {
          setPicked(null);
          onOpenPeriod(p);
        }}
        onChanged={refresh}
      />
      <ScheduleForm state={form} today={today} onClose={() => setForm(null)} onSaved={refresh} />
    </section>
  );
}

function DaySheet({ day, data, schedules, onClose, onAdd, onEdit, onOpen, onChanged }: { day: string | null; data: { scheduled: { id: string; kind: PeriodKind; time: string; name: string }[]; written: { kind: PeriodKind; start: string; end: string }[] } | undefined; schedules: ReviewSchedule[]; onClose: () => void; onAdd: (day: string) => void; onEdit: (s: ReviewSchedule) => void; onOpen: (p: Period) => void; onChanged: () => void }) {
  const [sure, setSure] = useState<string | null>(null);
  useEffect(() => setSure(null), [day]);
  const remove = useMutation({
    mutationFn: (id: string) => api.reviewScheduleRemove(id),
    onSuccess: () => {
      onChanged();
      setSure(null);
    },
  });
  const scheduled = data?.scheduled ?? [];
  const written = data?.written ?? [];
  return (
    <Sheet open={day !== null} onClose={onClose} title={day ? prettyDate(day) : ''}>
      <div className="flex flex-col gap-sm pb-xl">
        {scheduled.length === 0 && written.length === 0 && <p className="m-0 text-[14px] font-semibold text-ink-soft">Nothing on this day yet.</p>}
        {scheduled.map((s) => {
          const full = schedules.find((x) => x.id === s.id);
          const series = Boolean(full?.repeat);
          return (
            <div key={s.id} className="rounded-tile bg-paper p-sm">
              <p className="m-0 text-[16px] font-extrabold">
                <Inert text={nameOf(s)} />
              </p>
              <p className="m-0 text-[14px] font-semibold text-ink-soft">{`Reminder at ${timeText(s.time)}${full ? `, ${full.label.toLowerCase()}` : ''}`}</p>
              <div className="mt-xs flex flex-wrap gap-xs">
                {full && (
                  <Button variant="outline" size="sm" onClick={() => onEdit(full)}>
                    Edit
                  </Button>
                )}
                <Button variant="outline" size="sm" disabled={remove.isPending} onClick={() => (sure === s.id ? remove.mutate(s.id) : setSure(s.id))}>
                  {sure === s.id ? (series ? 'Tap again to remove the whole series' : 'Tap again to remove') : series ? 'Remove the series' : 'Remove'}
                </Button>
              </div>
            </div>
          );
        })}
        {written.map((w) => (
          <div key={`${w.kind}-${w.start}`} className="flex items-center justify-between gap-sm rounded-tile bg-paper p-sm">
            <div className="min-w-0">
              <StatusTag tone="good">Written</StatusTag>
              <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">{tie(`${PERIOD_META[w.kind].name} for ${prettyDate(w.start)} to ${prettyDate(w.end)}`)}</p>
            </div>
            <Button size="sm" onClick={() => onOpen({ kind: w.kind, start: w.start, end: w.end })}>
              Open it
            </Button>
          </div>
        ))}
        {remove.isError && (
          <p role="alert" className="m-0 text-[14px] font-bold">
            That did not work. Try again.
          </p>
        )}
        {day && (
          <Button full onClick={() => onAdd(day)}>
            Add a review reminder on this day
          </Button>
        )}
      </div>
    </Sheet>
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
  const [sure, setSure] = useState(false);
  useEffect(() => {
    if (!state) return;
    setKind(state.existing?.kind ?? 'week');
    setDay(state.day || addDays(today, 1));
    setTime(state.existing?.time ?? REVIEW_REMINDER_TIME);
    setRepeat(state.existing?.repeat ?? null);
    setName(state.existing?.name ?? '');
    setSure(false);
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
          <span className="block text-[14px] font-bold">Which review</span>
          <div className="mt-xs flex flex-wrap gap-xs" role="group" aria-label="Which review">
            {PERIOD_KINDS.map((k) => (
              <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={`toy min-h-[44px] rounded-pill border-2 px-sm text-[14px] font-bold ${kind === k ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
                {PERIOD_META[k].short}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-xs">
          <label className="block">
            <span className="block text-[14px] font-bold">First day</span>
            <input type="date" required value={day} onChange={(e) => setDay(e.target.value)} className={FIELD} />
          </label>
          <label className="block">
            <span className="block text-[14px] font-bold">Time</span>
            <input type="time" required value={time} onChange={(e) => setTime(e.target.value)} className={FIELD} />
          </label>
        </div>
        <RepeatPicker value={repeat} anchor={day} onChange={setRepeat} onAnchor={setDay} />
        <label className="block">
          <span className="block text-[14px] font-bold">Name (optional)</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={REVIEW_SCHEDULE_NAME_MAX} placeholder="Sunday look back" className={FIELD} />
        </label>
        <p className="m-0 text-[12px] font-semibold text-ink-soft">{COPY.note}</p>
        {problem && (
          <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
            {problem}
          </p>
        )}
        {(save.isError || remove.isError) && (
          <p role="alert" className="m-0 text-[14px] font-bold">
            {((save.error ?? remove.error) as Error | null)?.message || 'That did not save. Try again.'}
          </p>
        )}
        <div className="flex flex-wrap gap-xs">
          <Button type="submit" disabled={Boolean(problem) || save.isPending || !day}>
            {save.isPending ? 'Saving' : existing ? 'Save changes' : 'Schedule it'}
          </Button>
          {existing && (
            <Button variant="outline" disabled={remove.isPending} onClick={() => (sure ? remove.mutate() : setSure(true))}>
              {sure ? 'Tap again to remove' : repeat ? 'Remove the series' : 'Remove'}
            </Button>
          )}
        </div>
      </form>
    </Sheet>
  );
}
