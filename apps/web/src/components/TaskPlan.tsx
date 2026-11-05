import { PRIORITIES, RELATIONSHIPS, addDays, priorityTag, repeatLabel, openDay, taskIsHabit, type MonthProject, type Node, type Priority, type Repeat } from '@kreators/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { Bell, ClipboardCheck, Landmark, Repeat as RepeatIcon, X } from 'lucide-react';
import { api, type TaskPlanBody } from '../lib/api';
import { Icon } from './Icon';
import { useAuthed, useRefreshAll } from '../lib/queries';
import { RepeatPicker } from './RepeatPicker';
import { RulerPicker } from './RulerPicker';
import { Toggle } from './Toggle';
import { FIELD } from '../lib/ui';
import { StatusTag } from './StatusTag';

const CHIP = 'inline-flex shrink-0 items-center rounded-pill px-sm text-caption font-medium leading-[24px]';
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
export function TaskTags({ task, priority = true }: { task: Node; /** False where the row shows the priority in its own corner. */ priority?: boolean }) {
  return (
    <>
      {priority && <PriorityChip priority={task.priority} />}
      {task.remind && (
        <StatusTag tone="warn" mark={<Icon icon={Bell} size={12} />}>
          Remember
        </StatusTag>
      )}
      {task.forReview && (
        <StatusTag tone="info" mark={<Icon icon={ClipboardCheck} size={12} />}>
          For review
        </StatusTag>
      )}
      {task.repeat && taskIsHabit(task) && (
        <StatusTag tone="good" mark={<Icon icon={RepeatIcon} size={12} />} title={repeatLabel(task.repeat, openDay(task))}>
          Habit
        </StatusTag>
      )}
      {task.fromPillar && (
        <StatusTag tone="calm" mark={<Icon icon={Landmark} size={12} />}>
          From pillar
        </StatusTag>
      )}
      {task.fromCoach && <StatusTag tone="deep">From your coach</StatusTag>}
    </>
  );
}

/** Four coloured buttons, P0 to P3, and a way to clear it. */
export function PriorityPicker({ value, onChange }: { value: Priority | null; onChange: (p: Priority | null) => void }) {
  return (
    <div>
      <span className="block text-subhead font-semibold">Priority</span>
      {/* Two columns of equal buttons on a phone (P0 and P1, then P2 and P3), four in a row from the tablet width. */}
      <div className="mt-xs grid grid-cols-2 gap-xs sm:grid-cols-4" role="group" aria-label="Priority">
        {PRIORITIES.map((p) => (
          <button key={p.value} type="button" aria-pressed={value === p.value} onClick={() => onChange(value === p.value ? null : p.value)} className={`pri-${p.value} pri-chip toy min-h-[44px] w-full whitespace-nowrap rounded-pill px-xs text-subhead font-medium`}>
            {p.tag} {p.name}
          </button>
        ))}
      </div>
      <p className="mt-xs m-0 text-caption text-ink-soft">{value === null ? 'Pick one to sort by it. It never changes what a tick pays.' : PRIORITIES[value]!.blurb}</p>
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
  forReview: boolean;
  /** "Count it as a habit", only read while it repeats. On unless the person said no. */
  habit: boolean;
  time: string;
  minutes: string;
}
export const planOf = (n?: Node | null, doDate = ''): Plan => ({
  doDate: n?.doDate ?? doDate,
  dueDate: n?.dueDate ?? '',
  repeat: n?.repeat ?? null,
  priority: n?.priority ?? null,
  remind: n?.remind ?? false,
  forReview: n?.forReview ?? false,
  habit: n?.habit ?? true,
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
    remind: p.remind,
    forReview: p.forReview,
    habit: dated && p.repeat ? p.habit : null,
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
  const problem = planProblem(plan);
  return (
    <div className="flex flex-col gap-md">
      <div>
        <span className="block text-subhead font-semibold">Do on</span>
        <div className="flex flex-wrap items-end gap-xs">
          <input type="date" aria-label="Do date" value={plan.doDate} onChange={(e) => set({ doDate: e.target.value })} className={`${FIELD} min-w-[200px] flex-1`} />
          {/* A phone: the three quick days as one even row across the full width under the date; wider, beside the date at its right. */}
          <div className="grid w-full grid-cols-3 gap-xs sm:ml-auto sm:flex sm:w-auto sm:flex-wrap sm:justify-end" role="group" aria-label="Quick days">
          {[
            { name: 'Today', day: today },
            { name: 'Tomorrow', day: addDays(today, 1) },
            { name: 'Next week', day: addDays(today, 7) },
          ].map((q) => (
            <button key={q.name} type="button" aria-pressed={plan.doDate === q.day} onClick={() => set({ doDate: plan.doDate === q.day ? '' : q.day })} className={`toy min-h-[44px] whitespace-nowrap rounded-pill border-2 px-xs text-subhead font-medium sm:px-sm ${plan.doDate === q.day ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
              {q.name}
            </button>
          ))}
          </div>
        </div>
        <p className="mt-xs m-0 text-caption text-ink-soft">{plan.doDate ? 'It shows on Daily from this day. It cannot be ticked before.' : 'No do date: it waits in the list below Tasks on Daily until you pick a day.'}</p>
      </div>
      <label className="block">
        <span className="block text-subhead font-semibold">Due by</span>
        <input type="date" value={plan.dueDate} min={plan.doDate || undefined} onChange={(e) => set({ dueDate: e.target.value })} className={FIELD} />
        <span className="mt-xs block text-caption text-ink-soft">The deadline. It shows Overdue after this day, and never stops you ticking it.</span>
      </label>
      {problem && (
        <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-subhead">
          {problem}
        </p>
      )}

      <PriorityPicker value={plan.priority} onChange={(priority) => set({ priority })} />

      <RepeatPicker
        value={plan.repeat}
        anchor={plan.doDate || plan.dueDate}
        onChange={(repeat) => set({ repeat })}
        onAnchor={plan.doDate || plan.dueDate ? (day) => (plan.doDate || !plan.dueDate ? set({ doDate: day }) : set({ dueDate: day })) : undefined}
        note="Tick it and the next one is made for you."
      />
      {plan.repeat && dated && (
        <Toggle on={plan.habit} onChange={(habit) => set({ habit })} label="Count it as a habit" hint={plan.habit ? 'It wears the Habit tag.' : 'No Habit tag: it only comes back.'} compact />
      )}

      <Toggle
        on={plan.remind}
        onChange={(remind) => set({ remind })}
        label="Remember"
        hint={dated ? 'Tagged to remember, and a note lands in your inbox on the day, at its time (9:00 when it has none).' : 'Tagged to remember. With no date it waits in To remember on Daily, and gets an inbox note once you pick a day.'}
        compact
      />
      <Toggle on={plan.forReview} onChange={(forReview) => set({ forReview })} label="Bring it to my review" hint="The review for its week, month or quarter lists it, so you can put it into your answers." compact />

      <div className="flex flex-wrap items-end gap-xs">
      <div className="grid min-w-[240px] flex-1 grid-cols-2 gap-xs">
        <label className="block">
          <span className="block text-subhead font-semibold">Time (optional)</span>
          <input type="time" value={plan.time} onChange={(e) => set({ time: e.target.value })} className={FIELD} />
        </label>
        <label className="block">
          <span className="block text-subhead font-semibold">Minutes (optional)</span>
          <input type="number" min={5} max={600} step={5} value={plan.minutes} onChange={(e) => set({ minutes: e.target.value })} placeholder="25" className={FIELD} />
        </label>
      </div>
      {/* On a phone the five chips are one even row across the full width, like the quick days above; wider, at the right. */}
      <div className="grid w-full grid-cols-5 gap-xs sm:ml-auto sm:flex sm:w-auto sm:flex-wrap sm:justify-end" role="group" aria-label="How long it should take">
        {ESTIMATES.map((m) => (
          <button key={m} type="button" aria-pressed={plan.minutes === String(m)} onClick={() => set({ minutes: plan.minutes === String(m) ? '' : String(m) })} className={`toy min-h-[44px] whitespace-nowrap rounded-pill border-2 px-0 text-subhead font-medium sm:px-sm ${plan.minutes === String(m) ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
            {m >= 60 ? `${m / 60} h` : `${m} min`}
          </button>
        ))}
      </div>
      </div>
      {/* The quick picks stay; the ruler is for anything between (5 to 240 minutes). A longer time can still be typed above. */}
      <RulerPicker
        label="Minutes it should take"
        tone="paper"
        accent="r2"
        min={5}
        max={240}
        step={5}
        labelEvery={30}
        majorStep={30}
        defaultValue={25}
        value={Number(plan.minutes) > 0 ? Number(plan.minutes) : null}
        onChange={(v) => set({ minutes: String(v) })}
        format={(v) => (v % 60 === 0 ? `${v / 60}h` : String(v))}
        valueText={(v) => `${v} minutes`}
      />
    </div>
  );
}

/** Opens Mindfulness ready to focus on this task, for as long as its estimate says. */
export function StartFocus({ task, className = '' }: { task: Node; className?: string }) {
  const min = task.estimateMin ?? 25;
  return (
    <Link to={`/mindful?task=${task.id}&min=${min}#focus-heading`} className={`toy toy-soft inline-flex min-h-[48px] items-center justify-center rounded-pill border-2 border-line bg-card px-md text-subhead font-medium ${className}`}>
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
        <span className="block text-subhead font-semibold">Subtasks</span>
        {total > 0 && <span className="text-caption text-ink-soft">{done} of {total} done</span>}
      </div>
      <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0">
        {list.data?.subtasks.map((s) => (
          <li key={s.id} className="toy flex items-center gap-xs rounded-tile bg-paper px-sm">
            <label className="flex min-h-[44px] min-w-0 flex-1 cursor-pointer items-center gap-sm">
              <input type="checkbox" checked={s.done} onChange={(e) => tick.mutate({ id: s.id, done: e.target.checked })} className="size-[20px] shrink-0" />
              <span className={`min-w-0 break-words text-callout ${s.done ? 'text-ink-soft line-through' : ''}`}>{s.title}</span>
            </label>
            <button type="button" onClick={() => remove.mutate(s.id)} aria-label={`Remove "${s.title}"`} className="flex min-h-[44px] min-w-[44px] items-center justify-center text-ink-soft hover:text-ink">
              <Icon icon={X} size={18} />
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
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} placeholder="Add a small step" aria-label="New subtask" className="min-w-0 flex-1 rounded-tile border-2 border-line bg-paper px-sm py-sm text-body" />
        <button type="submit" disabled={add.isPending || !title.trim()} className="toy min-h-[48px] rounded-pill bg-ink px-md text-subhead font-medium text-on-ink disabled:opacity-60">
          Add
        </button>
      </form>
      {add.isError && (
        <p role="alert" className="mt-xs m-0 text-subhead">
          {add.error instanceof Error ? add.error.message : 'Could not add it.'}
        </p>
      )}
    </div>
  );
}

/**
 * The pillar and project an open task holds up: any of the person's active projects, grouped by pillar. Moving it under a project in
 * another pillar moves the task to that pillar (PATCH /nodes/:id with parentId). Used by TaskPanel on Daily and the pillar page's edit sheet.
 */
export function ProjectSelect({ projects, value, onChange }: { projects: MonthProject[]; value: string; onChange: (id: string) => void }) {
  return (
    <label className="block">
      <span className="block text-subhead font-semibold">Pillar and project</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={FIELD}>
        {!projects.some((p) => p.id === value) && <option value={value}>Where it is now</option>}
        {RELATIONSHIPS.map((r) => {
          const here = projects.filter((p) => p.relationship === r.key);
          return here.length > 0 ? (
            <optgroup key={r.key} label={r.name}>
              {here.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </optgroup>
          ) : null;
        })}
      </select>
      <span className="mt-xs block text-caption text-ink-soft">Moving it to a project in another pillar moves the task to that pillar.</span>
    </label>
  );
}

/** The panel under a task on Daily: plan it, break it into subtasks, size it and start a focus session on it. */
export function TaskPanel({ task, today }: { task: Node; today: string }) {
  // A save can change the repeat, the habit pick, the title or the place, which decide what an Emerging card offers.
  const refresh = useRefreshAll({ insights: true });
  const [plan, setPlan] = useState<Plan>(() => planOf(task));
  // The pillar and project it holds up: any of the person's open projects, grouped by pillar. The projects come from this month's
  // answer, the same read the month calendar and "Add a task" use. A ticked task stays where it is.
  const month = today.slice(0, 7);
  const projectsQ = useAuthed(['today', 'month', month, today], () => api.todayMonth(month, today), task.status === 'active');
  const [parentId, setParentId] = useState(task.parentId ?? '');
  const problem = planProblem(plan);
  const save = useMutation({ mutationFn: () => api.updateNode(task.id, { ...planBody(plan), ...(parentId && parentId !== task.parentId ? { parentId } : {}) }), onSuccess: () => refresh() });
  const projects = projectsQ.data?.projects ?? [];
  return (
    <div className="mt-xs flex flex-col gap-md rounded-card bg-card p-md shadow-toy-soft">
      {task.status === 'active' && projects.length > 0 && (
        <ProjectSelect
          projects={projects}
          value={parentId}
          onChange={(id) => {
            save.reset();
            setParentId(id);
          }}
        />
      )}
      <TaskPlanFields
        plan={plan}
        onChange={(next) => {
          save.reset();
          setPlan(next);
        }}
        today={today}
      />
      {save.isError && (
        <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-subhead">
          {save.error instanceof Error ? save.error.message : 'Could not save. Try again.'}
        </p>
      )}
      <button type="button" disabled={save.isPending || problem !== null} onClick={() => save.mutate()} className="toy min-h-[48px] rounded-pill bg-ink px-md text-headline text-on-ink disabled:opacity-60">
        {save.isSuccess && !save.isPending ? 'Saved' : 'Save plan'}
      </button>
      <Subtasks task={task} />
      <StartFocus task={{ ...task, estimateMin: Number(plan.minutes) > 0 ? Number(plan.minutes) : task.estimateMin }} />
    </div>
  );
}
