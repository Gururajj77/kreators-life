import { LIFE_AREA_ORDER, LIFE_AREAS, OPEN_KINDS, PRIORITIES, RELATIONSHIPS, addDays, type OpenKind, blockOfTask, blocksInDay, mondayOf, openDay, templateForDate, type TodayResponse, type LifeAreaKey, type MonthProject, type Node, type Priority, type RelationshipKey, type Repeat, type TemplateSlot, type TimeBlock, type TimeBlocksResponse } from '@kreators/shared';
import { blockMismatch, blockMismatchLine, blockUsedMin } from '@kreators/shared/blockHints';
import { OPEN_ENDINGS, OPEN_KIND_META } from '@kreators/shared/openBusiness';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { X } from 'lucide-react';
import { api, type TaskPlanBody } from '../lib/api';
import { Icon } from './Icon';
import { useAuthed, useRefreshAll } from '../lib/queries';
import { RepeatPicker } from './RepeatPicker';
import { RulerPicker } from './RulerPicker';
import { Toggle } from './Toggle';
import { FIELD, FIELD_LINE } from '../lib/ui';
import { useTimeBlocks } from '../lib/useTimeBlocks';
import { todayLocal, clockOf, dayLabel, slotRange } from '../lib/date';
import { ConfirmDelete, DELETE_BTN } from './ConfirmDelete';
import { FieldLabel } from './Field';

// The row's marks live in TaskMarks.tsx (in the first download); this file is the plan form, loaded when a plan opens.
export { AreaTag, BlockMark, OpenTag, PriorityChip, TaskTags } from './TaskMarks';

const ESTIMATES = [15, 25, 45, 60, 90];

/** A day's slots and blocks from the week's answer: the blocks with a slot that day in clock order, then the person's other blocks. */
export function blocksForDay(data: TimeBlocksResponse | undefined, date: string): { slots: TemplateSlot[]; inDay: TimeBlock[]; other: TimeBlock[] } {
  if (!data) return { slots: [], inDay: [], other: [] };
  const overrides: Record<string, string> = Object.create(null);
  for (const o of data.overrides) overrides[o.date] = o.templateId;
  const ids = new Set(data.templates.map((t) => t.id));
  const { templateId } = templateForDate(date, { overrides, pattern: data.pattern, defaultId: data.defaultTemplateId, exists: (id) => ids.has(id) });
  const slots = data.templates.find((t) => t.id === templateId)?.slots ?? [];
  const inDay = blocksInDay(slots, data.blocks);
  return { slots, inDay, other: data.blocks.filter((b) => !inDay.includes(b)) };
}

/**
 * "Time block": By its time first (no block picked: the block its time falls in holds it on Daily), then the blocks of the task's day
 * in clock order, then the person's other blocks. The blocks come from that day's template, so a Deep work day lists Deep work first.
 */
export function TimeBlockSelect({ value, onChange, day, time }: { value: string | null; onChange: (id: string | null) => void; /** The day it is planned for. */ day: string; /** Its time, "HH:MM" or empty. */ time: string }) {
  const q = useTimeBlocks(mondayOf(day));
  const { slots, inDay, other } = blocksForDay(q.data, day);
  const all = [...inDay, ...other];
  const picked = value ? all.find((b) => b.id === value) : undefined;
  const byTime = value ? null : blockOfTask({ timeBlockId: null, dueTime: time || null }, slots);
  const timeBlock = byTime ? all.find((b) => b.id === byTime.blockId) : undefined;
  // Nobody's blocks yet and nothing picked: there is nothing to choose from, so the field stays away.
  if (q.data && all.length === 0 && !value) return null;
  const hint = picked
    ? inDay.includes(picked)
      ? `It sits in ${picked.name} on Daily, whatever its time.`
      : `It sits in ${picked.name}, which is not in this day's plan.`
    : timeBlock
      ? `By its time it falls in ${timeBlock.name}.`
      : time
        ? `At ${clockOf(time)} it falls between this day's blocks, so it sits outside them. Pick one to place it.`
        : 'With no time, Plan my week suggests a block. Pick one to place it now.';
  return (
    <label className="block">
      <span className="block text-subhead font-semibold">Time block</span>
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} className={FIELD}>
        <option value="">By its time</option>
        {value && !picked && <option value={value}>Where it is now</option>}
        {inDay.length > 0 && (
          <optgroup label="In the day">
            {inDay.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </optgroup>
        )}
        {other.length > 0 && (
          <optgroup label="Other blocks">
            {other.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </optgroup>
        )}
      </select>
      <span className="mt-xs block text-caption text-ink-soft">{hint}</span>
    </label>
  );
}

/**
 * Under the time: when it falls in a block meant for another area or pillar and a block of that day fits better (`blockMismatch`), one
 * quiet line and a "Use <block>'s time" link that sets the time to the free start Daily's Move it would pick. Words only: it never stops
 * a save. When Daily's answer for that day is already read (the form opened from Daily, or Daily seen today), it passes the same load,
 * timed tasks and time now as Daily's line, so both name the same block and time; otherwise it reads the blocks alone.
 */
function TimeFitHint({ plan, pillar, day, taskId, onUse, className = '' }: { plan: Plan; pillar: RelationshipKey; day: string; taskId?: string; onUse: (time: string) => void; className?: string }) {
  const q = useTimeBlocks(mondayOf(day));
  const qc = useQueryClient();
  const { slots, inDay, other } = blocksForDay(q.data, day);
  const daily = qc
    .getQueriesData<TodayResponse>({ queryKey: ['today', day] })
    .map(([, d]) => d)
    .find((d) => d?.day?.date === day && d.day.slotPlannedMin);
  const used = daily?.day ? blockUsedMin(daily.day.slots, daily.day.slotPlannedMin) : undefined;
  const taken = (daily?.tasks ?? []).filter((x) => x.id !== taskId && x.dueTime && openDay(x) === day);
  const now = new Date();
  const after = day === todayLocal() ? now.getHours() * 60 + now.getMinutes() : null;
  const m = blockMismatch({ timeBlockId: null, dueTime: plan.time, lifeArea: plan.lifeArea, relationship: pillar, priority: plan.priority, estimateMin: Number(plan.minutes) > 0 ? Number(plan.minutes) : null }, slots, [...inDay, ...other], { used, taken, after });
  if (!m) return null;
  return (
    <p className={`m-0 text-caption text-ink-soft ${className}`} data-time-fit={m.better.id}>
      {blockMismatchLine(m, slotRange)}{' '}
      <button type="button" onClick={() => onUse(m.start)} className="relative font-semibold text-ink underline underline-offset-4 after:absolute after:inset-x-0 after:top-1/2 after:h-[44px] after:-translate-y-1/2 after:content-['']">
        Use {m.better.name}’s time
      </button>
    </p>
  );
}

/** "Area of life": No area, then the five in their one order. Optional; it never changes what a tick pays. */
export function AreaSelect({ value, onChange }: { value: LifeAreaKey | null; onChange: (a: LifeAreaKey | null) => void }) {
  return (
    <label className="block">
      <span className="block text-subhead font-semibold">Area of life</span>
      <select value={value ?? ''} onChange={(e) => onChange((e.target.value || null) as LifeAreaKey | null)} className={FIELD}>
        <option value="">No area</option>
        {LIFE_AREA_ORDER.map((k) => (
          <option key={k} value={k}>
            {LIFE_AREAS[k].name}
          </option>
        ))}
      </select>
      <span className="mt-xs block text-caption text-ink-soft">{value ? `It wears the ${LIFE_AREAS[value].name} tag, and a tick counts toward that area in Life.` : 'Optional. Pick one to tag it and count it in Life. It never changes what a tick pays.'}</span>
    </label>
  );
}

/** Its kind of open business (Close the unfinished, 2026-11-07): none, or one of the three. A tag and Daily's Unfinished business view only. */
export function OpenKindSelect({ value, onChange }: { value: OpenKind | null; onChange: (k: OpenKind | null) => void }) {
  return (
    <label className="block">
      <span className="block text-subhead font-semibold">Bottleneck</span>
      <select value={value ?? ''} onChange={(e) => onChange((e.target.value || null) as OpenKind | null)} className={FIELD}>
        <option value="">None</option>
        {OPEN_KINDS.map((k) => (
          <option key={k} value={k}>
            {OPEN_KIND_META[k].name}
          </option>
        ))}
      </select>
      <span className="mt-xs block text-caption text-ink-soft">{value ? OPEN_KIND_META[value].question : 'Optional. Mark something left open, to end it.'}</span>
    </label>
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
  /** The area of life it is for, or null for none. */
  lifeArea: LifeAreaKey | null;
  /** The time block it was put in, or null: by its time. */
  timeBlockId: string | null;
  /** Its kind of open business, or null for none. */
  openKind: OpenKind | null;
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
  lifeArea: n?.lifeArea ?? null,
  timeBlockId: n?.timeBlockId ?? null,
  openKind: n?.openKind ?? null,
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
    lifeArea: p.lifeArea,
    timeBlockId: p.timeBlockId,
    openKind: p.openKind,
  };
};
/** The same check the server makes, so the person hears it before they save. */
export const planProblem = (p: Plan): string | null =>
  p.doDate && p.dueDate && p.doDate > p.dueDate ? 'Do it on or before the day it is due.' : p.repeat && !p.doDate && !p.dueDate ? 'Pick a do date or a due date for it to repeat from.' : null;

/** The fields of a task's plan: when to do it, when it is due, how it repeats, its priority, its area of life and time block, a reminder, a time and a length. */
export function TaskPlanFields({ plan, onChange, today, pillar, taskId }: { plan: Plan; onChange: (p: Plan) => void; today: string; /** The task's pillar, for the hint when its time falls in a block meant for others. */ pillar?: RelationshipKey; /** The task being edited (none for a new one), left out of the timed tasks the hint steps past. */ taskId?: string }) {
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
      {/* The area and the block side by side from the tablet width; each its own line on a phone. */}
      <div className="grid gap-md sm:grid-cols-2">
        <AreaSelect value={plan.lifeArea} onChange={(lifeArea) => set({ lifeArea })} />
        <TimeBlockSelect value={plan.timeBlockId} onChange={(timeBlockId) => set({ timeBlockId })} day={plan.doDate || plan.dueDate || today} time={plan.time} />
      </div>
      <OpenKindSelect value={plan.openKind} onChange={(openKind) => set({ openKind })} />

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
      {/* Right under the time and minutes on a phone; from the tablet width, under the whole row (the chips stay beside the fields). */}
      {pillar && !plan.timeBlockId && plan.time && <TimeFitHint plan={plan} pillar={pillar} taskId={taskId} day={plan.doDate || plan.dueDate || today} onUse={(time) => set({ time })} className="w-full sm:order-last" />}
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
      <div>
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
      {/* The helper line for the time and the minutes (with their quick picks and the ruler), so every field here has one (2026-11-06). */}
      <p className="mt-xs m-0 text-caption text-ink-soft">The time puts it in its block on Daily and times its note. The minutes set how long Start focus runs.</p>
      </div>
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

/** The look of the panel's own actions (Start focus), so the three endings sit beside it as its equals. */
const ACTION = 'toy toy-soft inline-flex min-h-[48px] items-center justify-center rounded-pill border-2 border-line bg-card px-md text-subhead font-medium';

/**
 * The three ways to end a task marked Unfinished, Unresolved or Undecided (Close the unfinished, 2026-11-07), shown only while it carries a
 * kind: Do it puts it on today, Give it a time and date sets a day and a time with Remember on (a form in place), and Let it go is the archive,
 * on a second tap since it comes back from Let go in Daily's Unfinished business view. Each is the ordinary PATCH /nodes/:id; `onPlan` keeps
 * the form above in step, so a later Save never puts the old day back, and `onGone` runs once a task is let go.
 */
export function TaskEndings({ task, today, onPlan, onGone }: { task: Node; today: string; onPlan?: (patch: Partial<Plan>) => void; onGone?: () => void }) {
  const refresh = useRefreshAll();
  const [timing, setTiming] = useState(false);
  const [day, setDay] = useState(() => (task.doDate && task.doDate > today ? task.doDate : addDays(today, 1)));
  const [time, setTime] = useState(task.dueTime ?? '09:00');
  const [armed, setArmed] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  // The day it was moved to here, so a sheet holding the task as it was opened still knows it is on today now.
  const [movedTo, setMovedTo] = useState<string | null>(null);
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(t);
  }, [armed]);
  const run = useMutation({
    mutationFn: (v: { body: TaskPlanBody & { status?: 'archived' }; said: string; plan?: Partial<Plan>; gone?: boolean }) => api.updateNode(task.id, v.body),
    onSuccess: (_r, v) => {
      if (v.plan) onPlan?.(v.plan);
      if (v.plan?.doDate) setMovedTo(v.plan.doDate);
      setTiming(false);
      setSaid(v.said);
      void refresh();
      if (v.gone) onGone?.();
    },
  });
  if (!task.openKind || task.status !== 'active') return null;
  const opens = movedTo ?? openDay(task);
  const onToday = Boolean(opens && opens <= today);
  const formId = `end-time-${task.id}`;
  const movesDue = Boolean(task.dueDate && day && day > task.dueDate);
  return (
    <div>
      <span className="block text-subhead font-semibold">End it</span>
      <p className="mt-xs m-0 text-caption text-ink-soft">{OPEN_KIND_META[task.openKind].question}</p>
      <div className="mt-xs grid gap-xs sm:flex sm:flex-wrap" role="group" aria-label={`End “${task.title}”`}>
        {onToday ? (
          <span className="inline-flex min-h-[48px] items-center px-xs text-subhead text-ink-soft">On today. Tick it when it is done.</span>
        ) : (
          <button type="button" disabled={run.isPending} onClick={() => run.mutate({ body: { doDate: today }, said: `“${task.title}” is on today's tasks.`, plan: { doDate: today } })} className={ACTION}>
            {OPEN_ENDINGS.doIt.name}
          </button>
        )}
        <button type="button" aria-expanded={timing} aria-controls={timing ? formId : undefined} disabled={run.isPending} onClick={() => setTiming((v) => !v)} className={ACTION}>
          {OPEN_ENDINGS.time.name}
        </button>
        <button
          type="button"
          disabled={run.isPending}
          aria-label={armed ? `Tap again to let it go: ${task.title}` : `${OPEN_ENDINGS.letGo.name}: ${task.title}`}
          onClick={() => {
            if (!armed) return setArmed(true);
            setArmed(false);
            run.mutate({ body: { status: 'archived' }, said: `Let go of “${task.title}”.`, gone: true });
          }}
          className={`${ACTION} ${armed ? 'red-armed' : ''}`}
        >
          <span aria-live="polite">{armed ? 'Tap again to let it go' : OPEN_ENDINGS.letGo.name}</span>
        </button>
      </div>
      {timing && (
        <form
          id={formId}
          className="mt-xs flex flex-wrap items-end gap-xs"
          aria-label={`Give “${task.title}” a time and date`}
          onSubmit={(e) => {
            e.preventDefault();
            // A due day before the day picked (a late one, most often) moves with it, as the line under the form says, since a do date
            // after its due date is refused (four-check, 2026-11-07: a late task could never be given a time).
            const due = movesDue ? { dueDate: day } : {};
            if (day) run.mutate({ body: { doDate: day, ...due, dueTime: time || null, remind: true }, said: `“${task.title}” is set for ${day === today ? 'today' : dayLabel(day)}${time ? ` at ${clockOf(time)}` : ''}, with a reminder.`, plan: { doDate: day, ...due, time, remind: true } });
          }}
        >
          <label className="min-w-[160px] flex-1">
            <span className="block text-subhead font-semibold">Day</span>
            <input type="date" required min={today} value={day} onChange={(e) => setDay(e.target.value)} className={FIELD} />
          </label>
          <label className="min-w-[120px] flex-1">
            <span className="block text-subhead font-semibold">Time</span>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={FIELD} />
          </label>
          <button type="submit" disabled={run.isPending || !day} className={ACTION}>
            Save the time
          </button>
          {movesDue && <p className="m-0 w-full text-caption text-ink-soft">Its due day moves to this day too.</p>}
        </form>
      )}
      <p className="mt-xs m-0 text-caption text-ink-soft">{OPEN_ENDINGS.letGo.line}</p>
      {run.isError ? (
        <p role="alert" className="mt-xs m-0 text-subhead">
          {run.error instanceof Error ? run.error.message : 'That did not work. Try again.'}
        </p>
      ) : (
        said && (
          <p role="status" className="mt-xs m-0 text-subhead text-ink-soft">
            {said}
          </p>
        )
      )}
    </div>
  );
}

/** A task's checklist: add a line, tick it, remove it (asked first in a sheet). Pays nothing and never stops the task being ticked. */
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
  const [asking, setAsking] = useState<{ id: string; title: string } | null>(null);
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteSubtask(id),
    onSuccess: () => {
      setAsking(null);
      after();
    },
  });
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
            <button
              type="button"
              onClick={() => {
                remove.reset();
                setAsking({ id: s.id, title: s.title });
              }}
              aria-haspopup="dialog"
              aria-label={`Remove "${s.title}"`} className="flex min-h-[44px] min-w-[44px] items-center justify-center text-ink-soft hover:text-ink">
              <Icon icon={X} size={18} />
            </button>
          </li>
        ))}
      </ul>
      <ConfirmDelete
        open={asking !== null}
        title="Remove this subtask?"
        body={asking ? `“${asking.title}” goes from this task's checklist. The task itself stays.` : ''}
        pending={remove.isPending}
        failed={remove.isError}
        onYes={() => asking && remove.mutate(asking.id)}
        onClose={() => setAsking(null)}
        yes="Yes, remove it"
      />
      <form
        className="mt-xs flex gap-xs"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim()) add.mutate();
        }}
      >
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} placeholder="Add a small step" aria-label="New subtask" className={`${FIELD_LINE} min-w-0 flex-1`} />
        <button type="submit" disabled={add.isPending || !title.trim()} className="toy min-h-[48px] rounded-pill bg-ink px-md text-subhead font-medium text-on-ink disabled:opacity-60">
          Add
        </button>
      </form>
      {/* A helper line under this field too, as under every field of the plan above (2026-11-06). */}
      <p className="mt-xs m-0 text-caption text-ink-soft">A checklist for this task. It pays nothing and never stops the tick.</p>
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
  // The task's own words, changed through the same PATCH /nodes/:id as the pillar page's edit sheet (140 characters, never blank).
  const [title, setTitle] = useState(task.title);
  const renamed = title.trim() !== '' && title.trim() !== task.title;
  const problem = title.trim() ? planProblem(plan) : 'Give the task a name.';
  const save = useMutation({ mutationFn: () => api.updateNode(task.id, { ...(renamed ? { title: title.trim() } : {}), ...planBody(plan), ...(parentId && parentId !== task.parentId ? { parentId } : {}) }), onSuccess: () => refresh() });
  // Delete: the pillar page's own remove (DELETE /nodes/:id; its checklist goes with it), asked first.
  const [asking, setAsking] = useState(false);
  const remove = useMutation({ mutationFn: () => api.deleteNode(task.id), onSuccess: () => { setAsking(false); refresh(); } });
  const projects = projectsQ.data?.projects ?? [];
  return (
    <div className="mt-xs flex flex-col gap-md rounded-card bg-card p-md shadow-toy-soft">
      {task.status === 'active' && (
        <FieldLabel label="Task">
          <input
            value={title}
            onChange={(e) => {
              save.reset();
              setTitle(e.target.value);
            }}
            maxLength={140}
            required
            className={FIELD}
          />
          <span className="mt-xs block text-caption text-ink-soft">Changing the words makes it a new task, so the ten-minute wait starts again.</span>
        </FieldLabel>
      )}
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
        pillar={projects.find((p) => p.id === parentId)?.relationship ?? task.relationship}
        taskId={task.id}
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
      <TaskEndings task={task} today={today} onPlan={(patch) => setPlan((p) => ({ ...p, ...patch }))} />
      {task.status === 'active' && (
        <div className="flex justify-end">
          <button
            type="button"
            aria-haspopup="dialog"
            disabled={remove.isPending}
            onClick={() => {
              remove.reset();
              setAsking(true);
            }}
            className={DELETE_BTN}
          >
            Delete task
          </button>
        </div>
      )}
      <ConfirmDelete
        open={asking}
        title="Delete this task?"
        body={`“${task.title}” goes from Daily and its pyramid, with its subtasks. This cannot be undone.`}
        pending={remove.isPending}
        failed={remove.isError}
        error={remove.error instanceof Error ? remove.error.message : undefined}
        onYes={() => remove.mutate()}
        onClose={() => setAsking(false)}
      />
    </div>
  );
}
