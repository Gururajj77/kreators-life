import { PRIORITIES, RELATIONSHIP_BY_KEY, MONTH_TASKS_MAX, isoWeekday, monthGrid, monthShift, priorityTag, timeLabel, type KindDay, type MonthProject, type MonthTask, type TodayMonthResponse, LOCALE } from '@kreators/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router';
import { Check, Repeat as RepeatIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../lib/api';
import { dueLabel, prettyDate, weekday, clockOf } from '../lib/date';
import { printAs } from '../lib/printDoc';
import { useAuthed, useRefreshAll } from '../lib/queries';
import { useActionQueue } from '../lib/useActionQueue';
import { tbClass, tbStyle } from '../lib/blockColor';
import { FIELD, FIELD_LINE } from '../lib/ui';
import { ErrorLine } from './ErrorLine';
import { minutesUntil, useNow } from '../lib/useNow';
import { Button } from './Button';
import { useCelebrate } from './Celebration';
import { CheckRow } from './CheckRow';
import { Fold } from './Fold';
import { Icon } from './Icon';
import { Sheet } from './Sheet';
import { Skeleton } from './Skeleton';
import { planBody, planOf, planProblem, PriorityChip, TaskPlanFields, type Plan } from './TaskPlan';
import { FactTag } from './FactTag';
import { StatusTag } from './StatusTag';

const COPY = {
  lede: 'Tap a day to see its tasks or add one. A task sits on its do date, or on its due date when it has no do date.',
  legend: 'A number is tasks still to do. A tick means every task that day is done.',
  // One line for both dots, so "dot" never means two things unsaid (2026-11-06).
  dots: 'The small dot beside a task is its priority.',
  kinds: 'The small dot is the priority, the coloured dot beside the date is the kind of day. Open a day to change it.',
  empty: 'Nothing planned on this day yet.',
  noProject: 'Tasks need a project. Set up a pillar first, then come back to add one here.',
  past: 'This day has passed. The task shows on Daily as late, and a new task can be ticked ten minutes after you write it.',
  more: `This month has more than ${MONTH_TASKS_MAX} tasks. The first ${MONTH_TASKS_MAX} are shown.`,
} as const;

const monthName = (month: string, long = true) => new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1).toLocaleDateString(LOCALE, { month: long ? 'long' : 'short', year: 'numeric' });
const dayNumber = (day: string) => Number(day.slice(8, 10));

/** The month calendar on Daily: every day a button with the tasks planned on it. Tap a day to see them, tick them or add one; print the month on paper. */
export function TaskMonth({ today }: { today: string }) {
  const refresh = useRefreshAll();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [picked, setPicked] = useState<string | null>(null);
  const q = useAuthed(['today', 'month', month, today], () => api.todayMonth(month, today));
  const queue = useActionQueue(refresh);
  const d = q.data;
  const weeks = useMemo(() => monthGrid(month), [month]);
  const byDay = useMemo(() => {
    const m = new Map<string, MonthTask[]>();
    for (const t of d?.tasks ?? []) m.set(t.day, [...(m.get(t.day) ?? []), t]);
    return m;
  }, [d]);
  const kindOn = useMemo(() => new Map((d?.kinds?.days ?? []).map((k) => [k.date, k])), [d]);
  const kindTpl = (k: KindDay | undefined) => (k?.templateId ? d?.kinds?.templates.find((t) => t.id === k.templateId) : undefined);

  const print = () => printAs(`Tasks ${month}`, 'printing-month');

  const arrow = 'toy toy-flat flex size-[44px] items-center justify-center rounded-pill text-ink-soft hover:text-ink';
  const cellHeight = 'min-h-[64px] sm:min-h-[96px]';
  const ring = (day: string) => (day === today || day === picked ? { outline: '2px solid var(--color-ink)', outlineOffset: 2 } : undefined);

  return (
    <div className="rounded-card bg-card p-md shadow-toy-soft">
      <p className="m-0 text-balance text-subhead text-ink-soft">{COPY.lede}</p>
      <div className="mt-sm flex items-center justify-between gap-xs">
        <button type="button" className={arrow} onClick={() => setMonth(monthShift(month, -1))} aria-label="Previous month">
          <Icon icon={ChevronLeft} size={16} strokeWidth={3} />
        </button>
        <span className="text-center text-headline" aria-live="polite">
          {monthName(month)}
        </span>
        <button type="button" className={arrow} onClick={() => setMonth(monthShift(month, 1))} aria-label="Next month">
          <Icon icon={ChevronRight} size={16} strokeWidth={3} />
        </button>
      </div>

      {q.isPending && <Skeleton className="mt-sm h-[320px]" />}
      {q.isError && (
        <div role="alert" className="mt-sm flex flex-wrap-reverse items-center justify-between gap-sm">
          <p className="m-0 min-w-0 flex-1 basis-[60%] text-subhead font-semibold">The calendar did not load.</p>
          <Button variant="outline" size="sm" onClick={() => q.refetch()}>
            Try again
          </Button>
        </div>
      )}

      {d && (
        <>
          <div role="group" aria-label={`Tasks in ${monthName(month)}`} className="mt-sm grid grid-cols-7 gap-xs">
            {weeks[0]?.map((day) => (
              <span key={day} className="text-center text-caption text-ink-soft" aria-hidden="true">
                <span className="sm:hidden">{weekday(day, 'narrow')}</span>
                <span className="hidden sm:inline">{weekday(day, 'short')}</span>
              </span>
            ))}
            {weeks.flat().map((day) => {
              if (day.slice(0, 7) !== month) return <span key={day} aria-hidden="true" className={cellHeight} />;
              const list = byDay.get(day) ?? [];
              const open = list.filter((t) => t.status === 'active').length;
              const done = list.length - open;
              const kind = kindTpl(kindOn.get(day));
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => setPicked(day)}
                  aria-label={`${prettyDate(day)}${kind ? `, ${kind.name}` : ''}, ${list.length === 0 ? 'no tasks' : `${list.length} ${list.length === 1 ? 'task' : 'tasks'}${done > 0 ? `, ${done} done` : ''}`}`}
                  style={ring(day)}
                  className={`toy toy-flat relative before:absolute before:-inset-x-[4px] before:inset-y-0 before:content-[''] flex min-w-0 flex-col items-stretch gap-xs rounded-tile bg-paper p-xs text-left ${cellHeight}`}
                >
                  {/* Wraps in a phone's narrow cell, so the count drops under the date and its kind's dot instead of covering them. */}
                  <span className="flex flex-wrap items-center justify-between gap-xs">
                    <span className={`flex min-w-0 items-center gap-xs ${kind ? tbClass(kind.color) : ''}`} style={kind ? tbStyle(kind.color) : undefined}>
                      <span className="text-subhead font-semibold">{dayNumber(day)}</span>
                      {kind && <span className="tb-dot" title={kind.name} aria-hidden="true" />}
                    </span>
                    {open > 0 ? (
                      <span className="rounded-pill bg-ink px-xs text-caption font-medium leading-[20px] text-on-ink">{open}</span>
                    ) : done > 0 ? (
                      <span className="flex size-[20px] items-center justify-center rounded-pill bg-card text-ink-soft">
                        <Icon icon={Check} size={12} strokeWidth={3} />
                      </span>
                    ) : null}
                  </span>
                  <span className="hidden min-w-0 flex-col gap-xs sm:flex">
                    {list.slice(0, 2).map((t) => (
                      <span key={t.id} className={`flex min-w-0 items-center gap-xs ${t.priority === null ? '' : `pri-${t.priority}`}`}>
                        <span aria-hidden="true" className="size-[8px] shrink-0 rounded-pill" style={{ background: 'var(--pri, var(--color-ink-mute))' }} />
                        <span className={`min-w-0 truncate text-caption ${t.status === 'done' ? 'text-ink-soft line-through' : ''}`}>{t.title}</span>
                      </span>
                    ))}
                    {list.length > 2 && <span className="text-caption text-ink-soft">+{list.length - 2} more</span>}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-sm m-0 text-caption text-ink-soft">{COPY.legend}</p>
          <p className="mt-xs m-0 text-caption text-ink-soft">{d.kinds?.days.some((k) => k.templateId) ? COPY.kinds : COPY.dots}</p>
          {d.more && <p className="mt-xs m-0 text-caption">{COPY.more}</p>}
          <div className="mt-sm flex flex-wrap items-center gap-xs">
            <Button variant="outline" size="sm" onClick={print}>
              Print this month
            </Button>
            {month !== today.slice(0, 7) && (
              <Button variant="ghost" size="sm" onClick={() => setMonth(today.slice(0, 7))}>
                Back to this month
              </Button>
            )}
          </div>
          <MonthPrint month={month} weeks={weeks} byDay={byDay} more={d.more} />
        </>
      )}

      <DaySheet day={picked} tasks={picked ? (byDay.get(picked) ?? []) : []} projects={d?.projects ?? []} kinds={d?.kinds} today={today} queue={queue} onClose={() => setPicked(null)} />
    </div>
  );
}

/** One task in a day's list: a tick row in its pillar's colour, with its priority, time and habit marks. */
function DayTask({ t, today, queue }: { t: MonthTask; today: string; queue: ReturnType<typeof useActionQueue> }) {
  const celebrate = useCelebrate();
  const now = useNow();
  const rel = RELATIONSHIP_BY_KEY[t.relationship];
  const done = t.status === 'done';
  const wait = done ? 0 : minutesUntil(t.readyAt, now);
  const early = !done && Boolean(t.doDate && t.doDate > today);
  const due = done ? null : dueLabel(t.dueDate, today);
  const when = [t.time ? clockOf(t.time) : null, t.estimateMin ? `${t.estimateMin} min` : null].filter(Boolean).join(' · ');
  const tick = () =>
    queue.run(t.id, async () => {
      if (done) {
        await api.uncomplete(t.id);
        return;
      }
      const r = await api.complete(t.id, today);
      celebrate({ title: r.capped ? 'Done. Daily xp limit reached, so this one was for you' : 'Ripple', totalXp: r.totalXp, ripple: r.ripple, newBadges: r.newBadges, projectCleared: r.projectCleared, color: RELATIONSHIP_BY_KEY[r.node.relationship].color });
    });
  return (
    <li data-pillar={rel.key}>
      <CheckRow
        checked={done}
        onToggle={tick}
        title={t.title}
        subtitle={rel.name}
        color={rel.color}
        deep={`var(--deep-${rel.key})`}
        text={rel.text}
        busy={queue.isPending(t.id)}
        hint={queue.hint(t.id)}
        strike
        lockedMessage={early ? `For ${dueLabel(t.doDate, today)?.text.toLowerCase() ?? t.doDate}. Tick it on the day.` : wait > 0 ? `Ready in ${wait} ${wait === 1 ? 'minute' : 'minutes'}. Do it first, then tick it.` : null}
        badge={
          <span className="flex flex-wrap justify-end gap-xs">
            <PriorityChip priority={t.priority} />
            {t.repeat && (
              <StatusTag tone="good" mark={<Icon icon={RepeatIcon} size={12} />} title={t.repeat}>
                Habit
              </StatusTag>
            )}
            {when && !done && <FactTag kind="when">{when}</FactTag>}
            {due?.overdue && <StatusTag tone="bad">{due.text}</StatusTag>}
          </span>
        }
      />
    </li>
  );
}

/** A day opened: its tasks to tick, and a form to add one with the day already picked. */
function DaySheet({ day, tasks, projects, kinds, today, queue, onClose }: { day: string | null; tasks: MonthTask[]; projects: MonthProject[]; kinds: TodayMonthResponse['kinds']; today: string; queue: ReturnType<typeof useActionQueue>; onClose: () => void }) {
  return (
    <Sheet open={day !== null} onClose={onClose} title={day ? prettyDate(day) : ''}>
      {day && (
        <div className="flex flex-col gap-md pb-xl">
          {kinds && kinds.templates.length > 0 && <DayKind key={day} day={day} kinds={kinds} />}
          {tasks.length === 0 ? (
            <p className="m-0 text-subhead text-ink-soft">{COPY.empty}</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-xs p-0">
              {tasks.map((t) => (
                <DayTask key={t.id} t={t} today={today} queue={queue} />
              ))}
            </ul>
          )}
          <Fold key={day} title="Add a task on this day" adds defaultOpen={tasks.length === 0}>
            <AddOnDay day={day} today={today} projects={projects} />
          </Fold>
        </div>
      )}
    </Sheet>
  );
}

/**
 * The day's kind (2026-11-06): its day template, set for this date or given by the weekly pattern, and a select to set it for this date
 * (past or future) through the ordinary PUT /time-blocks/days; "Follow your week" clears the date's own pick. The default template's days
 * have no kind and count in no tally.
 */
function DayKind({ day, kinds }: { day: string; kinds: NonNullable<TodayMonthResponse['kinds']> }) {
  const qc = useQueryClient();
  const k = kinds.days.find((x) => x.date === day);
  const byId = new Map(kinds.templates.map((t) => [t.id, t]));
  const weekId = kinds.pattern[isoWeekday(day) - 1];
  const week = (weekId && byId.get(weekId)) || byId.get(kinds.defaultId);
  const own = k?.from === 'date' ? (k.templateId ?? kinds.defaultId) : '';
  const kind = k?.templateId ? byId.get(k.templateId) : undefined;
  const save = useMutation({
    mutationFn: (id: string | null) => api.setDayTemplates([day], id),
    onSuccess: () => {
      for (const key of ['today', 'timeBlocks', 'weekPlan', 'dayType', 'insights', 'reviews'] as const) void qc.invalidateQueries({ queryKey: [key] });
    },
  });
  const where = k?.from === null ? 'Before your account began, so it counts as no kind.' : !kind ? `No kind: ${byId.get(kinds.defaultId)?.name ?? 'your default'} days count as none.` : k?.from === 'date' ? 'Set for this day only.' : 'From your usual week.';
  return (
    <div className={`rounded-tile bg-paper p-sm ${kind ? tbClass(kind.color) : ''}`} style={kind ? tbStyle(kind.color) : undefined}>
      <label className="flex flex-wrap items-center gap-xs">
        <span className="flex shrink-0 items-center gap-xs text-subhead font-semibold">
          {kind && <span className="tb-dot" aria-hidden="true" />}
          Kind of day
        </span>
        <select className={`${FIELD_LINE} min-w-0 flex-1`} value={own} disabled={save.isPending} onChange={(e) => save.mutate(e.target.value || null)}>
          <option value="">Follow your week ({week?.name ?? 'your default'})</option>
          {kinds.templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      {/* The line under the select on the left and "Edit kind of day" at its bottom right, as on Daily's own note (DayTypeNote); the
          link's 44px tap area is its ::after, so it adds no height. */}
      <div className="mt-xs flex flex-wrap items-end justify-between gap-x-sm">
        <p className="m-0 min-w-0 flex-[1_1_200px] text-caption text-ink-soft" aria-live="polite">
          {save.isPending ? 'Saving…' : where}
        </p>
        <Link to="/time-blocks" className="relative ml-auto whitespace-nowrap text-caption font-semibold text-ink underline underline-offset-4 after:absolute after:inset-x-0 after:top-1/2 after:h-[44px] after:-translate-y-1/2 after:content-['']">
          Edit kind of day
        </Link>
      </div>
      {save.error ? <ErrorLine e={save.error} className="mt-xs" /> : null}
    </div>
  );
}

/**
 * "Add a task" under Daily's list: the same form the month's day sheet uses, with the do date set to the person's today. The projects
 * come from this month's answer (the same read as the calendar), fetched when the fold first opens.
 */
export function AddTaskForm({ today, onAdded, autoFocus = false, projects, note }: { /** A pillar's page sends its own projects, so nothing is read and the task stays on that pillar. */ projects?: MonthProject[]; /** One quiet line above the button. */ note?: string;  today: string; /** Told the title and do date once a task is saved (Daily closes its fold and says so). */ onAdded?: (title: string, doDate: string | null) => void; autoFocus?: boolean }) {
  const month = today.slice(0, 7);
  const q = useAuthed(['today', 'month', month, today], () => api.todayMonth(month, today), projects === undefined);
  const list = projects ?? q.data?.projects;
  return list ? <AddOnDay day={today} today={today} projects={list} onAdded={onAdded} autoFocus={autoFocus} note={note} /> : <Skeleton className="h-[240px]" />;
}

/** The add form: a title, the project it holds up, and the ordinary task plan with the do date set to the day. It goes through the same route the pillar page uses. */
function AddOnDay({ day, today, projects, onAdded, autoFocus = false, note }: { day: string; today: string; projects: MonthProject[]; onAdded?: (title: string, doDate: string | null) => void; autoFocus?: boolean; note?: string }) {
  // A new task (perhaps repeating) changes what an Emerging card offers, so it is read again at once.
  const refresh = useRefreshAll({ insights: true });
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '');
  const [plan, setPlan] = useState<Plan>(() => planOf(null, day));
  const project = projects.find((p) => p.id === projectId) ?? projects[0] ?? null;
  const create = useMutation({
    mutationFn: () => {
      if (!project) throw new Error(COPY.noProject);
      return api.createNode({ kind: 'task', parentId: project.id, relationship: project.relationship, title: title.trim(), ...planBody(plan) });
    },
    onSuccess: () => {
      refresh();
      onAdded?.(title.trim(), plan.doDate || null);
      setTitle('');
      setPlan(planOf(null, day));
    },
  });

  if (projects.length === 0) {
    return (
      <div className="flex flex-wrap-reverse items-center justify-between gap-sm rounded-tile bg-paper p-sm">
        <p className="m-0 min-w-0 flex-1 basis-[60%] text-subhead text-ink-soft">{COPY.noProject}</p>
        <Link to="/tower" className="toy inline-flex min-h-[48px] items-center rounded-pill bg-ink px-md font-semibold text-on-ink">
          Set up a pillar
        </Link>
      </div>
    );
  }
  return (
    <form
      className="flex flex-col gap-md rounded-tile bg-paper p-sm"
      onSubmit={(e) => {
        e.preventDefault();
        if (title.trim()) create.mutate();
      }}
    >
      {/* A helper line under every field, like the plan fields below (2026-11-06), and the one field look (FIELD). */}
      <label className="block">
        <span className="block text-subhead font-semibold">What is the task?</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus={autoFocus} maxLength={140} required placeholder="One clear thing you can finish" className={FIELD} />
        <span className="mt-xs block text-caption text-ink-soft">A few words, up to 140 letters. It is the title on Daily.</span>
      </label>
      <label className="block">
        <span className="block text-subhead font-semibold">Which project does it hold up?</span>
        <select value={project?.id ?? ''} onChange={(e) => setProjectId(e.target.value)} className={FIELD}>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title} ({RELATIONSHIP_BY_KEY[p.relationship].name})
            </option>
          ))}
        </select>
        <span className="mt-xs block text-caption text-ink-soft">A tick on it counts toward that project and its pillar.</span>
      </label>
      <TaskPlanFields
        plan={plan}
        onChange={(next) => {
          create.reset();
          setPlan(next);
        }}
        today={today}
        pillar={project?.relationship}
      />
      {day < today && <p className="m-0 text-balance text-caption text-ink-soft">{COPY.past}</p>}
      {note && <p className="m-0 text-balance text-caption text-ink-soft">{note}</p>}
      {create.isError && (
        <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-subhead">
          {create.error instanceof Error ? create.error.message : 'Could not add it. Try again.'}
        </p>
      )}
      <Button type="submit" size="lg" full disabled={create.isPending || !title.trim() || planProblem(plan) !== null}>
        {create.isSuccess && !create.isPending ? 'Added. Add another' : 'Add task'}
      </Button>
    </form>
  );
}

/**
 * The month as a paper calendar. It is not on screen: the Print button gives the body the class `printing-month`, and app.css then shows only this
 * sheet, black on white, on a landscape page. It is drawn into the page's own body so no parent can clip it.
 */
function MonthPrint({ month, weeks, byDay, more }: { month: string; weeks: string[][]; byDay: Map<string, MonthTask[]>; more: boolean }) {
  return createPortal(
    <div className="month-print-sheet" aria-hidden="true">
      <div className="mp-title">Tasks, {monthName(month)}</div>
      <div className="mp-week mp-head">
        {weeks[0]?.map((day) => (
          <span key={day}>{weekday(day, 'long')}</span>
        ))}
      </div>
      {weeks.map((week) => (
        <div key={week[0]} className="mp-week">
          {week.map((day) => {
            const inMonth = day.slice(0, 7) === month;
            return (
              <div key={day} className={inMonth ? 'mp-day' : 'mp-day mp-out'}>
                {inMonth && <span className="mp-num">{dayNumber(day)}</span>}
                {inMonth &&
                  (byDay.get(day) ?? []).map((t) => (
                    <p key={t.id} className="mp-task">
                      <span className="mp-box">{t.status === 'done' ? '☑' : '☐'}</span> {t.time ? `${timeLabel(t.time)} ` : ''}
                      <span className={t.status === 'done' ? 'mp-done' : ''}>{t.title}</span>
                      {t.priority !== null && <b> {priorityTag(t.priority)}</b>}
                    </p>
                  ))}
              </div>
            );
          })}
        </div>
      ))}
      <p className="mp-legend">
        ☐ to do &nbsp; ☑ done &nbsp; {PRIORITIES.map((p) => `${p.tag} ${p.name.toLowerCase()}`).join(' · ')}
        {more ? ` · The first ${MONTH_TASKS_MAX} tasks of the month` : ''}
      </p>
      <p className="mp-legend">Printed from kreators.app on {new Date().toLocaleDateString(LOCALE, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
    </div>,
    document.body,
  );
}
