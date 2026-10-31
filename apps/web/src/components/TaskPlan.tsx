import { PRIORITIES, REPEAT_KINDS, addDays, priorityTag, repeatLabel, type Node, type Priority, type Repeat, type RepeatKind } from '@kreators/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { api, type TaskPlanBody } from '../lib/api';
import { useRefreshAll } from '../lib/queries';
import { Toggle } from './Toggle';

const FIELD = 'mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]';
const CHIP = 'rounded-pill px-xs text-[12px] font-extrabold leading-[20px]';
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const ESTIMATES = [15, 25, 45, 60, 90];

/** A priority tag in its colour: P0 red, P1 orange, P2 purple, P3 grey. */
export function PriorityChip({ priority }: { priority: Priority | null }) {
  if (priority === null) return null;
  return (
    <span className={`pri-${priority} pri-chip ${CHIP}`} title={PRIORITIES[priority]!.name}>
      {priorityTag(priority)}
    </span>
  );
}

/**
 * The marks on a task, so a person can tell kinds of task apart at a glance: its priority, Remember (it will remind them on the day),
 * Habit (it comes back on its own), From pillar (the strategy session or the vibe check made it) and From your coach.
 */
export function TaskTags({ task }: { task: Node }) {
  const plain = `${CHIP} bg-paper text-ink-soft`;
  return (
    <>
      <PriorityChip priority={task.priority} />
      {task.remind && <span className={plain}>🔔 Remember</span>}
      {task.repeat && <span className={plain} title={repeatLabel(task.repeat, task.doDate ?? task.dueDate)}>🔁 Habit</span>}
      {task.fromPillar && <span className={plain}>🏛 From pillar</span>}
      {task.fromCoach && <span className={plain}>From your coach</span>}
    </>
  );
}

/** Four coloured buttons, P0 to P3, and a way to clear it. */
export function PriorityPicker({ value, onChange }: { value: Priority | null; onChange: (p: Priority | null) => void }) {
  return (
    <div>
      <span className="block text-[14px] font-bold">Priority</span>
      <div className="mt-xs flex flex-wrap gap-xs" role="group" aria-label="Priority">
        {PRIORITIES.map((p) => (
          <button key={p.value} type="button" aria-pressed={value === p.value} onClick={() => onChange(value === p.value ? null : p.value)} className={`pri-${p.value} pri-chip toy min-h-[44px] rounded-pill px-sm text-[14px] font-bold`}>
            {p.tag} {p.name}
          </button>
        ))}
      </div>
      <p className="mt-xs m-0 text-[12px] font-semibold text-ink-soft">{value === null ? 'Pick one to sort by it. It never changes what a tick pays.' : PRIORITIES[value]!.blurb}</p>
    </div>
  );
}

/** Everything a task can be planned with, as the text a form holds. */
export interface Plan {
  doDate: string;
  dueDate: string;
  repeat: Repeat | null;
  priority: Priority | null;
  remind: boolean;
  time: string;
  minutes: string;
}
export const planOf = (n?: Node | null, doDate = ''): Plan => ({
  doDate: n?.doDate ?? doDate,
  dueDate: n?.dueDate ?? '',
  repeat: n?.repeat ?? null,
  priority: n?.priority ?? null,
  remind: n?.remind ?? false,
  time: n?.dueTime ?? '',
  minutes: n?.estimateMin ? String(n.estimateMin) : '',
});
export const planBody = (p: Plan): TaskPlanBody => {
  const dated = Boolean(p.doDate || p.dueDate);
  return {
    doDate: p.doDate || null,
    dueDate: p.dueDate || null,
    repeat: dated ? p.repeat : null,
    priority: p.priority,
    remind: p.remind && dated,
    dueTime: p.time || null,
    estimateMin: Number(p.minutes) > 0 ? Number(p.minutes) : null,
  };
};
/** The same check the server makes, so the person hears it before they save. */
export const planProblem = (p: Plan): string | null =>
  p.doDate && p.dueDate && p.doDate > p.dueDate ? 'Do it on or before the day it is due.' : p.repeat && !p.doDate && !p.dueDate ? 'Pick a do date or a due date for it to repeat from.' : null;

/** The fields of a task's plan: when to do it, when it is due, how it repeats, its priority, a reminder, a time and a length. */
export function TaskPlanFields({ plan, onChange, today }: { plan: Plan; onChange: (p: Plan) => void; today: string }) {
  const set = (patch: Partial<Plan>) => onChange({ ...plan, ...patch });
  const dated = Boolean(plan.doDate || plan.dueDate);
  const rule = plan.repeat;
  const setRule = (patch: Partial<Repeat>) => rule && set({ repeat: { ...rule, ...patch } });
  const problem = planProblem(plan);
  return (
    <div className="flex flex-col gap-md">
      <div>
        <span className="block text-[14px] font-bold">Do on</span>
        <div className="mt-xs flex flex-wrap gap-xs">
          {[
            { name: 'Today', day: today },
            { name: 'Tomorrow', day: addDays(today, 1) },
            { name: 'Next week', day: addDays(today, 7) },
          ].map((q) => (
            <button key={q.name} type="button" aria-pressed={plan.doDate === q.day} onClick={() => set({ doDate: plan.doDate === q.day ? '' : q.day })} className={`toy min-h-[44px] rounded-pill border-2 px-sm text-[14px] font-bold ${plan.doDate === q.day ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
              {q.name}
            </button>
          ))}
        </div>
        <input type="date" aria-label="Do date" value={plan.doDate} onChange={(e) => set({ doDate: e.target.value })} className={FIELD} />
        <p className="mt-xs m-0 text-[12px] font-semibold text-ink-soft">{plan.doDate ? 'It shows on Daily from this day. It cannot be ticked before.' : 'No do date: it waits in the list below Tasks on Daily until you pick a day.'}</p>
      </div>
      <label className="block">
        <span className="block text-[14px] font-bold">Due by</span>
        <input type="date" value={plan.dueDate} min={plan.doDate || undefined} onChange={(e) => set({ dueDate: e.target.value })} className={FIELD} />
        <span className="mt-xs block text-[12px] font-semibold text-ink-soft">The deadline. It shows Overdue after this day, and never stops you ticking it.</span>
      </label>
      {problem && (
        <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
          {problem}
        </p>
      )}

      <PriorityPicker value={plan.priority} onChange={(priority) => set({ priority })} />

      <div>
        <label className="block">
          <span className="block text-[14px] font-bold">Repeat</span>
          <select
            value={rule?.kind ?? 'none'}
            onChange={(e) => set({ repeat: e.target.value === 'none' ? null : { kind: e.target.value as RepeatKind, every: rule?.every ?? 1, days: [], until: rule?.until ?? null } })}
            className={FIELD}
          >
            <option value="none">Does not repeat</option>
            {REPEAT_KINDS.map((k) => (
              <option key={k.key} value={k.key}>
                {k.name}
              </option>
            ))}
          </select>
        </label>
        {rule && (
          <div className="mt-xs flex flex-col gap-xs">
            {rule.kind !== 'weekdays' && (
              <label className="flex items-center gap-xs text-[14px] font-bold">
                Every
                <input type="number" min={1} max={52} value={rule.every} onChange={(e) => setRule({ every: Math.min(52, Math.max(1, Math.round(Number(e.target.value)) || 1)) })} className="w-[72px] rounded-tile border-2 border-line bg-paper px-sm py-xs text-[16px]" />
                {REPEAT_KINDS.find((k) => k.key === rule.kind)?.unit}
                {rule.every === 1 ? '' : 's'}
              </label>
            )}
            {rule.kind === 'weekly' && (
              <div className="flex flex-wrap gap-xs" role="group" aria-label="Days of the week">
                {WEEKDAYS.map((d, i) => {
                  const n = i + 1;
                  const on = rule.days.includes(n);
                  return (
                    <button key={d} type="button" aria-pressed={on} onClick={() => setRule({ days: on ? rule.days.filter((x) => x !== n) : [...rule.days, n].sort() })} className={`toy min-h-[44px] min-w-[44px] rounded-pill border-2 px-xs text-[14px] font-bold ${on ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
                      {d}
                    </button>
                  );
                })}
              </div>
            )}
            <label className="block">
              <span className="block text-[14px] font-bold">Stop after (optional)</span>
              <input type="date" value={rule.until ?? ''} onChange={(e) => setRule({ until: e.target.value || null })} className={FIELD} />
            </label>
            <p className="m-0 text-[12px] font-semibold text-ink-soft">
              {repeatLabel(rule, plan.doDate || plan.dueDate || null)}. Tick it and the next one is made for you. A repeating task is a habit.
            </p>
          </div>
        )}
      </div>

      <Toggle
        on={plan.remind && dated}
        disabled={!dated}
        onChange={(remind) => set({ remind })}
        label="Remember"
        hint={dated ? 'A note lands in your inbox on the day, at its time (9:00 when it has none).' : 'Pick a do date or a due date first.'}
        compact
      />

      <div className="grid grid-cols-2 gap-xs">
        <label className="block">
          <span className="block text-[14px] font-bold">Time (optional)</span>
          <input type="time" value={plan.time} onChange={(e) => set({ time: e.target.value })} className={FIELD} />
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">Minutes (optional)</span>
          <input type="number" min={5} max={600} step={5} value={plan.minutes} onChange={(e) => set({ minutes: e.target.value })} placeholder="25" className={FIELD} />
        </label>
      </div>
      <div className="flex flex-wrap gap-xs" role="group" aria-label="How long it should take">
        {ESTIMATES.map((m) => (
          <button key={m} type="button" aria-pressed={plan.minutes === String(m)} onClick={() => set({ minutes: plan.minutes === String(m) ? '' : String(m) })} className={`toy min-h-[44px] rounded-pill border-2 px-sm text-[14px] font-bold ${plan.minutes === String(m) ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
            {m >= 60 ? `${m / 60} h` : `${m} min`}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Opens Mindful minutes ready to focus on this task, for as long as its estimate says. */
export function StartFocus({ task, className = '' }: { task: Node; className?: string }) {
  const min = task.estimateMin ?? 25;
  return (
    <Link to={`/mindful?task=${task.id}&min=${min}#focus-heading`} className={`toy toy-soft inline-flex min-h-[48px] items-center justify-center rounded-pill border-2 border-line bg-card px-md text-[14px] font-bold ${className}`}>
      Start focus, {min} min
    </Link>
  );
}

/** A task's checklist: add a line, tick it, remove it. Pays nothing and never stops the task being ticked. */
export function Subtasks({ task }: { task: Node }) {
  const refresh = useRefreshAll();
  const [title, setTitle] = useState('');
  const list = useQuery({ queryKey: ['subtasks', task.id], queryFn: () => api.subtasks(task.id) });
  const done = (list.data?.subtasks ?? []).filter((s) => s.done).length;
  const total = list.data?.subtasks.length ?? 0;
  const after = () => {
    void list.refetch();
    refresh();
  };
  const add = useMutation({ mutationFn: () => api.addSubtask(task.id, title.trim()), onSuccess: () => { setTitle(''); after(); } });
  const tick = useMutation({ mutationFn: (v: { id: string; done: boolean }) => api.editSubtask(v.id, { done: v.done }), onSuccess: after });
  const remove = useMutation({ mutationFn: (id: string) => api.deleteSubtask(id), onSuccess: after });
  return (
    <div>
      <div className="flex items-baseline justify-between gap-sm">
        <span className="block text-[14px] font-bold">Subtasks</span>
        {total > 0 && <span className="text-[12px] font-bold text-ink-soft">{done} of {total} done</span>}
      </div>
      <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0">
        {list.data?.subtasks.map((s) => (
          <li key={s.id} className="toy flex items-center gap-xs rounded-tile bg-paper px-sm">
            <label className="flex min-h-[44px] min-w-0 flex-1 cursor-pointer items-center gap-sm">
              <input type="checkbox" checked={s.done} onChange={(e) => tick.mutate({ id: s.id, done: e.target.checked })} className="size-[20px] shrink-0" />
              <span className={`min-w-0 break-words text-[16px] font-semibold ${s.done ? 'text-ink-soft line-through' : ''}`}>{s.title}</span>
            </label>
            <button type="button" onClick={() => remove.mutate(s.id)} aria-label={`Remove "${s.title}"`} className="min-h-[44px] min-w-[44px] text-[18px] font-bold text-ink-soft hover:text-ink">
              ×
            </button>
          </li>
        ))}
      </ul>
      <form
        className="mt-xs flex gap-xs"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim()) add.mutate();
        }}
      >
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} placeholder="Add a small step" aria-label="New subtask" className="min-w-0 flex-1 rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]" />
        <button type="submit" disabled={add.isPending || !title.trim()} className="toy min-h-[48px] rounded-pill bg-ink px-md text-[14px] font-bold text-on-ink disabled:opacity-60">
          Add
        </button>
      </form>
      {add.isError && (
        <p role="alert" className="mt-xs m-0 text-[14px] font-bold">
          {add.error instanceof Error ? add.error.message : 'Could not add it.'}
        </p>
      )}
    </div>
  );
}

/** The panel under a task on Daily: plan it, break it into subtasks, size it and start a focus session on it. */
export function TaskPanel({ task, today }: { task: Node; today: string }) {
  const refresh = useRefreshAll();
  const [plan, setPlan] = useState<Plan>(() => planOf(task));
  const problem = planProblem(plan);
  const save = useMutation({ mutationFn: () => api.updateNode(task.id, planBody(plan)), onSuccess: () => refresh() });
  return (
    <div className="mt-xs flex flex-col gap-md rounded-card bg-card p-md shadow-toy-soft">
      <TaskPlanFields plan={plan} onChange={setPlan} today={today} />
      {save.isError && (
        <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
          {save.error instanceof Error ? save.error.message : 'Could not save. Try again.'}
        </p>
      )}
      <button type="button" disabled={save.isPending || problem !== null} onClick={() => save.mutate()} className="toy min-h-[48px] rounded-pill bg-ink px-md text-[16px] font-bold text-on-ink disabled:opacity-60">
        {save.isSuccess && !save.isPending ? 'Saved' : 'Save plan'}
      </button>
      <Subtasks task={task} />
      <StartFocus task={{ ...task, estimateMin: Number(plan.minutes) > 0 ? Number(plan.minutes) : task.estimateMin }} />
    </div>
  );
}
