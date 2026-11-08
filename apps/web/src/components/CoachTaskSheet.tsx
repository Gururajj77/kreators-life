import { KIND_META, RELATIONSHIP_BY_KEY, type CoachTaskInput, type Node, type Priority, type Repeat } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api';
import { FIELD } from '../lib/ui';
import { Button } from './Button';
import { ErrorLine } from './ErrorLine';
import { RepeatPicker } from './RepeatPicker';
import { Sheet } from './Sheet';
import { PriorityPicker } from './TaskPlan';
import { Toggle } from './Toggle';

export type CoachEditing = { mode: 'add'; parentId: string; title?: string; habit?: boolean } | { mode: 'edit'; task: Node };

/**
 * Add a task under one of the student's projects, or change an open one: what the student's own form sets where it makes sense (title, do date, due
 * date, priority, repeat, the habit flag, length, time, note), never a time block, which stays the student's. The student ticks it; nobody else
 * does. The server writes the change log and tells them.
 */
export function CoachTaskSheet({ studentId, editing, projects, onClose, onDone }: { studentId: string; editing: CoachEditing | null; projects: Node[]; onClose: () => void; onDone: () => void }) {
  const task = editing?.mode === 'edit' ? editing.task : null;
  const add = editing?.mode === 'add' ? editing : null;
  const [parentId, setParentId] = useState(add?.parentId ?? '');
  const [title, setTitle] = useState(task?.title ?? add?.title ?? '');
  const [doDate, setDoDate] = useState(task?.doDate ?? '');
  const [dueDate, setDueDate] = useState(task?.dueDate ?? '');
  const [repeat, setRepeatRaw] = useState<Repeat | null>(task?.repeat ?? null);
  const [repeatTouched, setRepeatTouched] = useState(false);
  const [habit, setHabitRaw] = useState(task?.habit ?? add?.habit ?? true);
  const [habitTouched, setHabitTouched] = useState(false);
  const [priority, setPriority] = useState<Priority | null>(task?.priority ?? null);
  const [dueTime, setDueTime] = useState(task?.dueTime ?? '');
  const [minutes, setMinutes] = useState(task?.estimateMin ? String(task.estimateMin) : '');
  const [note, setNote] = useState(task?.note ?? '');
  const dated = Boolean(doDate || dueDate);
  const problem = doDate && dueDate && doDate > dueDate ? 'Do it on or before the day it is due.' : repeat && !dated ? 'Pick a do date or a due date for it to repeat from.' : null;
  const save = useMutation({
    mutationFn: () => {
      const common = { title, note, doDate: doDate || null, dueDate: dueDate || null, dueTime: dueTime || null, estimateMin: Number(minutes) > 0 ? Number(minutes) : null, priority };
      if (!task) {
        const body: CoachTaskInput = { parentId, ...common, repeat: dated ? repeat : null, habit: dated && repeat ? habit : null };
        return api.coachAddTask(studentId, body);
      }
      // Only what was touched, so a change to the words never reads as a change to the plan in the log.
      const dropped = !dated && Boolean(task.repeat);
      return api.coachEditTask(studentId, task.id, { ...common, ...(repeatTouched || dropped ? { repeat: dated ? repeat : null } : {}), ...(habitTouched ? { habit } : {}) });
    },
    onSuccess: () => {
      onDone();
      onClose();
    },
  });
  return (
    <Sheet open={Boolean(editing)} onClose={onClose} title={task ? 'Change the task' : 'Add a task'}>
      <form
        className="flex flex-col gap-md pb-xl"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim() && (task || parentId) && !problem) save.mutate();
        }}
      >
        {!task && (
          <label className="block">
            <span className="block text-subhead font-semibold">Under which project</span>
            <select value={parentId} onChange={(e) => setParentId(e.target.value)} required className={FIELD}>
              <option value="">Pick a project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {RELATIONSHIP_BY_KEY[p.relationship].name}: {p.title}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block">
          <span className="block text-subhead font-semibold">The task</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={140} placeholder={KIND_META.task.prompt} className={FIELD} />
        </label>
        <div className="grid gap-sm sm:grid-cols-2">
          <label className="block">
            <span className="block text-subhead font-semibold">Do on</span>
            <input type="date" value={doDate} onChange={(e) => setDoDate(e.target.value)} className={FIELD} />
          </label>
          <label className="block">
            <span className="block text-subhead font-semibold">Due by</span>
            <input type="date" value={dueDate} min={doDate || undefined} onChange={(e) => setDueDate(e.target.value)} className={FIELD} />
          </label>
        </div>
        {problem && (
          <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-subhead">
            {problem}
          </p>
        )}
        <PriorityPicker value={priority} onChange={setPriority} />
        <RepeatPicker
          value={repeat}
          anchor={doDate || dueDate}
          onChange={(r) => {
            setRepeatRaw(r);
            setRepeatTouched(true);
          }}
          onAnchor={doDate || dueDate ? (day) => (doDate || !dueDate ? setDoDate(day) : setDueDate(day)) : undefined}
          note="They tick it and the next one is made for them."
        />
        {repeat && dated && (
          <Toggle
            on={habit}
            onChange={(on) => {
              setHabitRaw(on);
              setHabitTouched(true);
            }}
            label="Count it as a habit"
            hint={habit ? 'It wears the Habit tag.' : 'No Habit tag: it only comes back.'}
            compact
          />
        )}
        <div className="grid grid-cols-2 gap-sm">
          <label className="block">
            <span className="block text-subhead font-semibold">Time</span>
            <input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} className={FIELD} />
          </label>
          <label className="block">
            <span className="block text-subhead font-semibold">Minutes</span>
            <input type="number" min={1} max={600} value={minutes} onChange={(e) => setMinutes(e.target.value)} className={FIELD} />
          </label>
        </div>
        <label className="block">
          <span className="block text-subhead font-semibold">A note, optional</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} className={FIELD} />
        </label>
        <p className="m-0 text-subhead text-ink-soft">{task ? 'Renaming a task starts its wait again. The change goes in the change log and to their inbox.' : 'It shows as From your coach. It waits and pays like their own tasks, and only they tick it.'}</p>
        <ErrorLine e={save.error} />
        <Button type="submit" size="lg" full disabled={save.isPending || !title.trim() || (!task && !parentId) || Boolean(problem)}>
          {task ? 'Save the change' : 'Add the task'}
        </Button>
      </form>
    </Sheet>
  );
}
