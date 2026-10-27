import { type DayType } from '@kreators/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { api } from '../lib/api';
import { useAuthed } from '../lib/queries';
import { CheckRow } from './CheckRow';

const chip = (on: boolean) => `min-h-[44px] rounded-pill border-2 px-sm text-[14px] font-bold ${on ? 'border-ink bg-ink text-on-ink' : 'border-line bg-card'}`;

/**
 * The routine from the strategy session, on Daily: the morning steps as tick rows (done only when every one
 * is ticked), the day's other blocks as a timeline, and the week's dots. Without a session, one quiet row.
 */
export function RoutineSection({ date }: { date: string }) {
  const qc = useQueryClient();
  const q = useAuthed(['session', date], () => api.session(date));
  const mark = useMutation({
    mutationFn: (body: { dayType: DayType; steps: string[] }) => api.markRoutineDay({ date, ...body }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['session'] }),
  });
  const d = q.data;
  if (!d) return null;
  if (!d.routine) {
    return (
      <section className="mt-lg" aria-labelledby="routine-heading">
        <h2 id="routine-heading" className="text-[18px]">
          Your routine
        </h2>
        <Link to="/session" className="toy toy-soft mt-sm flex items-center gap-sm rounded-tile bg-card p-sm text-ink">
          <span className="flex size-[40px] shrink-0 items-center justify-center rounded-pill bg-paper text-[20px]" aria-hidden="true">
            🧭
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] font-bold">Run the strategy session</span>
            <span className="block text-[14px] font-semibold text-ink-soft">Twenty minutes: the map, your day, a routine and a contract.</span>
          </span>
        </Link>
      </section>
    );
  }
  const dayType: DayType = d.today?.dayType ?? 'general';
  const blocks = dayType === 'general' ? d.routine.general : d.routine.exceptional;
  const morning = blocks.find((b) => b.key === 'morning');
  const ticked = new Set(d.today?.steps ?? []);
  const toggle = (step: string) => {
    const next = new Set(ticked);
    if (next.has(step)) next.delete(step);
    else next.add(step);
    mark.mutate({ dayType, steps: [...next] });
  };
  const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  return (
    <section className="mt-lg" aria-labelledby="routine-heading">
      <div className="flex items-center justify-between gap-sm">
        <h2 id="routine-heading" className="text-[18px]">
          Your routine
        </h2>
        <span className="text-[12px] font-bold text-ink-soft">
          {d.week.done} of 7 this week{d.contract ? `, ${d.contract.minDays} is the deal` : ''}
        </span>
      </div>
      <ul className="mt-xs flex list-none gap-xs p-0 m-0" aria-label="This week">
        {d.week.days.map((v, i) => (
          <li key={i} className={`flex size-[28px] items-center justify-center rounded-pill text-[11px] font-extrabold ${v === true ? 'bg-r4 text-on-fill' : v === false ? 'bg-line text-ink-soft' : 'bg-paper text-ink-mute'}`} title={v === true ? 'done' : v === false ? 'not all steps' : 'nothing yet'}>
            {labels[(new Date(`${date}T00:00:00`).getDay() + 6 + i - 6 + 7) % 7]}
          </li>
        ))}
      </ul>
      {d.routine.practices.affirmation && <p className="mt-sm m-0 rounded-tile bg-paper p-sm text-[14px] font-bold">“{d.routine.practices.affirmation}”</p>}
      <div className="mt-sm flex gap-xs">
        {(['general', 'exceptional'] as const).map((t) => (
          <button key={t} type="button" className={chip(dayType === t)} onClick={() => mark.mutate({ dayType: t, steps: [...ticked] })} disabled={mark.isPending}>
            {t === 'general' ? 'Normal day' : 'Exceptional day'}
          </button>
        ))}
      </div>
      {morning && (
        <div className="mt-sm flex flex-col gap-xs">
          <p className="m-0 text-[14px] font-bold">
            Morning routine, {morning.start} to {morning.end}
            {d.today?.done ? '. Done.' : ''}
          </p>
          {morning.steps.map((step) => (
            <CheckRow key={step} checked={ticked.has(step)} onToggle={() => toggle(step)} title={step} busy={mark.isPending} />
          ))}
        </div>
      )}
      <ol className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
        {blocks
          .filter((b) => b.key !== 'morning')
          .map((b) => (
            <li key={b.key} className="flex items-start gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
              <span className="w-[100px] shrink-0 text-[12px] font-bold text-ink-soft">
                {b.start} to {b.end}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-bold">{b.name}</span>
                <span className="block text-[12px] font-semibold text-ink-soft">{b.note}</span>
              </span>
            </li>
          ))}
      </ol>
    </section>
  );
}
