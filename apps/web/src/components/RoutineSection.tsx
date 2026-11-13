import { minutesLabel, stepsMinutes, type BlockKey, type DayType, type SessionResponse } from '@kreators/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { Link } from 'react-router';
import { api } from '../lib/api';
import { useAuthed } from '../lib/queries';
import { chip } from './Chat';
import { CheckRow } from './CheckRow';
import { Icon } from './Icon';
import { Skeleton } from './Skeleton';
import { Compass } from 'lucide-react';
import { clockOf } from '../lib/date';


/**
 * The routine from the strategy session, on Daily: the morning steps as tick rows (the day is done only when every one
 * is ticked), the day's other blocks as tick rows too (2026-11-13, the founder: a tick for each, paying nothing and never
 * moving the day's done), and the week's dots. Without a session, one quiet row.
 */
export function RoutineSection({ date }: { date: string }) {
  const qc = useQueryClient();
  const key = ['session', date];
  const q = useAuthed(key, () => api.session(date));
  // A tick shows at once and every row stays tappable while it saves (2026-11-12: one shared busy flag locked all the rows, and a tick
  // sent before the last save came back carried the old set and undid it). Each save sends the whole set as it stands, the saves go out
  // one after another so the server ends on the last one, and only the answer to the newest save is written back.
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const latest = useRef(0);
  const mark = useMutation({
    mutationFn: (body: { dayType: DayType; steps: string[]; blocks: BlockKey[]; n: number }) => {
      const send = chain.current.catch(() => undefined).then(() => api.markRoutineDay({ date, dayType: body.dayType, steps: body.steps, blocks: body.blocks }));
      chain.current = send;
      return send;
    },
    onMutate: async (body) => {
      await qc.cancelQueries({ queryKey: key });
      const before = qc.getQueryData<SessionResponse>(key);
      if (before?.routine) {
        const morning = (body.dayType === 'general' ? before.routine.general : before.routine.exceptional).find((b) => b.key === 'morning')?.steps ?? [];
        const done = morning.length > 0 && morning.every((s) => body.steps.includes(s));
        qc.setQueryData<SessionResponse>(key, { ...before, today: { day: date, dayType: body.dayType, steps: body.steps, blocks: body.blocks, done } });
      }
      return { before };
    },
    onSuccess: (res, body) => {
      if (body.n === latest.current) qc.setQueryData(key, res);
    },
    onError: (_e, body, ctx) => {
      if (body.n === latest.current) {
        if (ctx?.before) qc.setQueryData(key, ctx.before);
        void qc.invalidateQueries({ queryKey: ['session'] });
      }
    },
    onSettled: (_r, _e, body) => {
      // Other screens that read the session (the life map, Pillars) catch up once the last save is in.
      if (body.n === latest.current) void qc.invalidateQueries({ queryKey: ['session'], predicate: (x) => x.queryKey[1] !== date });
    },
  });
  const save = (dayType: DayType, steps: string[], blocks: BlockKey[]) => mark.mutate({ dayType, steps, blocks, n: ++latest.current });
  const d = q.data;
  // While /session loads, a title and a row of the no-routine card's size keep the place, so the small act below does not move.
  if (q.isPending) {
    return (
      <div className="mt-lg" aria-hidden="true">
        <Skeleton className="h-[1lh] w-1/3 text-title2" />
        <Skeleton className="mt-sm h-[84px] w-full md:h-[68px]" />
      </div>
    );
  }
  if (!d) return null;
  if (!d.routine) {
    return (
      <section className="mt-lg" aria-labelledby="routine-heading">
        <h2 id="routine-heading" className="text-title2">
          Your routine
        </h2>
        <Link to="/session" className="toy toy-soft mt-sm flex items-center gap-sm rounded-tile bg-card p-sm text-ink">
          <span className="flex size-[40px] shrink-0 items-center justify-center rounded-pill bg-paper text-ink-soft" aria-hidden="true">
            <Icon icon={Compass} size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-card-title">Run the strategy session</span>
            <span className="block text-card-note text-ink-soft">A few minutes: the map, your day, a routine and a contract.</span>
          </span>
        </Link>
      </section>
    );
  }
  const dayType: DayType = d.today?.dayType ?? 'general';
  const blocks = dayType === 'general' ? d.routine.general : d.routine.exceptional;
  const morning = blocks.find((b) => b.key === 'morning');
  const ticked = new Set(d.today?.steps ?? []);
  const blocksDone = new Set(d.today?.blocks ?? []);
  const toggle = (step: string) => {
    const next = new Set(ticked);
    if (next.has(step)) next.delete(step);
    else next.add(step);
    save(dayType, [...next], [...blocksDone]);
  };
  const toggleBlock = (key: BlockKey) => {
    const next = new Set(blocksDone);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    save(dayType, [...ticked], [...next]);
  };
  const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  return (
    <section className="mt-lg" aria-labelledby="routine-heading">
      <div className="flex items-center justify-between gap-sm">
        <h2 id="routine-heading" className="text-title2">
          Your routine
        </h2>
        <span className="text-caption text-ink-soft">
          {d.week.done} of 7 this week{d.contract ? `, ${d.contract.minDays} is the deal` : ''}
        </span>
      </div>
      <ul className="mt-xs flex list-none gap-xs p-0 m-0" aria-label="This week">
        {d.week.days.map((v, i) => (
          <li key={i} className={`flex size-[28px] items-center justify-center rounded-pill text-caption2 font-semibold ${v === true ? 'bg-r4 text-on-fill' : v === false ? 'bg-line text-ink-soft' : 'bg-paper text-ink-mute'}`} title={v === true ? 'done' : v === false ? 'not all steps' : 'nothing yet'}>
            {labels[(new Date(`${date}T00:00:00`).getDay() + 6 + i - 6 + 7) % 7]}
          </li>
        ))}
      </ul>
      {d.routine.practices.affirmation && <p className="mt-sm m-0 rounded-tile bg-paper p-sm text-subhead font-semibold">“{d.routine.practices.affirmation}”</p>}
      <div className="mt-sm flex gap-xs">
        {(['general', 'exceptional'] as const).map((t) => (
          <button key={t} type="button" className={chip(dayType === t)} onClick={() => save(t, [...ticked], [...blocksDone])} aria-pressed={dayType === t}>
            {t === 'general' ? 'Normal day' : 'Exceptional day'}
          </button>
        ))}
      </div>
      {morning && (
        <div className="mt-sm flex flex-col gap-xs">
          <p className="m-0 text-subhead font-semibold">
            Morning routine, {clockOf(morning.start)} to {clockOf(morning.end)}
            {stepsMinutes(morning) > 0 ? `, ${minutesLabel(stepsMinutes(morning))} of steps` : ''}
            {d.today?.done ? '. Done.' : ''}
          </p>
          {morning.steps.map((step, i) => (
            <CheckRow key={step} checked={ticked.has(step)} onToggle={() => toggle(step)} title={step} subtitle={morning.minutes?.[i] ? minutesLabel(morning.minutes[i]!) : undefined} />
          ))}
        </div>
      )}
      <p id="routine-rest" className="mt-sm m-0 text-subhead font-semibold">
        The rest of your day
      </p>
      <ol className="mt-xs flex list-none flex-col gap-xs p-0 m-0" aria-labelledby="routine-rest">
        {blocks
          .filter((b) => b.key !== 'morning')
          .map((b) => (
            <li key={b.key}>
              <CheckRow
                checked={blocksDone.has(b.key)}
                onToggle={() => toggleBlock(b.key)}
                title={b.name}
                subtitle={
                  <>
                    <span className="whitespace-nowrap">
                      {clockOf(b.start)} to {clockOf(b.end)}
                    </span>
                    {b.note ? `. ${b.note}` : ''}
                  </>
                }
              />
            </li>
          ))}
      </ol>
    </section>
  );
}
