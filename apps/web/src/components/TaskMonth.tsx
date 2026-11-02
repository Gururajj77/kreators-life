import { PRIORITIES, RELATIONSHIP_BY_KEY, MONTH_TASKS_MAX, monthGrid, monthShift, priorityTag, timeLabel, type MonthProject, type MonthTask } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router';
import { api } from '../lib/api';
import { dueLabel, prettyDate } from '../lib/date';
import { useAuthed, useRefreshAll } from '../lib/queries';
import { useActionQueue } from '../lib/useActionQueue';
import { minutesUntil, useNow } from '../lib/useNow';
import { Button } from './Button';
import { useCelebrate } from './Celebration';
import { CheckRow } from './CheckRow';
import { Fold } from './Fold';
import { Sheet } from './Sheet';
import { Skeleton } from './Skeleton';
import { planBody, planOf, planProblem, PriorityChip, TaskPlanFields, type Plan } from './TaskPlan';

const COPY = {
  lede: 'Tap a day to see its tasks or add one. A task sits on its do date, or on its due date when it has no do date.',
  legend: 'A number is tasks still to do. A tick means every task that day is done. The dot is the priority.',
  empty: 'Nothing planned on this day yet.',
  noProject: 'Tasks need a project. Set up a pillar first, then come back to add one here.',
  past: 'This day has passed. The task shows on Daily as late, and a new task can be ticked ten minutes after you write it.',
  more: `This month has more than ${MONTH_TASKS_MAX} tasks. The first ${MONTH_TASKS_MAX} are shown.`,
} as const;

const monthName = (month: string, long = true) => new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1).toLocaleDateString(undefined, { month: long ? 'long' : 'short', year: 'numeric' });
const weekday = (day: string, style: 'long' | 'short' | 'narrow') => new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { weekday: style });
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

  const print = () => {
    const before = document.title;
    const restore = () => {
      document.title = before;
      document.body.classList.remove('printing-month');
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);
    document.title = `Tasks ${month}`;
    document.body.classList.add('printing-month');
    window.print();
  };

  const arrow = 'toy toy-flat flex size-[44px] items-center justify-center rounded-pill text-ink-soft hover:text-ink';
  const cellHeight = 'min-h-[64px] sm:min-h-[96px]';
  const ring = (day: string) => (day === today || day === picked ? { outline: '2px solid var(--color-ink)', outlineOffset: 2 } : undefined);

  return (
    <div className="rounded-card bg-card p-md shadow-toy-soft">
      <p className="m-0 text-balance text-[14px] font-semibold text-ink-soft">{COPY.lede}</p>
      <div className="mt-sm flex items-center justify-between gap-xs">
        <button type="button" className={arrow} onClick={() => setMonth(monthShift(month, -1))} aria-label="Previous month">
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
        <span className="text-center text-[16px] font-extrabold" aria-live="polite">
          {monthName(month)}
        </span>
        <button type="button" className={arrow} onClick={() => setMonth(monthShift(month, 1))} aria-label="Next month">
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      </div>

      {q.isPending && <Skeleton className="mt-sm h-[320px]" />}
      {q.isError && (
        <div role="alert" className="mt-sm">
          <p className="m-0 text-[14px] font-bold">The calendar did not load.</p>
          <Button variant="outline" size="sm" className="mt-xs" onClick={() => q.refetch()}>
            Try again
          </Button>
        </div>
      )}

      {d && (
        <>
          <div role="group" aria-label={`Tasks in ${monthName(month)}`} className="mt-sm grid grid-cols-7 gap-xs">
            {weeks[0]?.map((day) => (
              <span key={day} className="text-center text-[12px] font-extrabold text-ink-soft" aria-hidden="true">
                <span className="sm:hidden">{weekday(day, 'narrow')}</span>
                <span className="hidden sm:inline">{weekday(day, 'short')}</span>
              </span>
            ))}
            {weeks.flat().map((day) => {
              if (day.slice(0, 7) !== month) return <span key={day} aria-hidden="true" className={cellHeight} />;
              const list = byDay.get(day) ?? [];
              const open = list.filter((t) => t.status === 'active').length;
              const done = list.length - open;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => setPicked(day)}
                  aria-label={`${prettyDate(day)}, ${list.length === 0 ? 'no tasks' : `${list.length} ${list.length === 1 ? 'task' : 'tasks'}${done > 0 ? `, ${done} done` : ''}`}`}
                  style={ring(day)}
                  className={`toy toy-flat flex min-w-0 flex-col items-stretch gap-xs rounded-tile bg-paper p-xs text-left ${cellHeight}`}
                >
                  <span className="flex items-center justify-between gap-xs">
                    <span className="text-[14px] font-extrabold">{dayNumber(day)}</span>
                    {open > 0 ? (
                      <span className="rounded-pill bg-ink px-xs text-[12px] font-extrabold leading-[20px] text-on-ink">{open}</span>
                    ) : done > 0 ? (
                      <span className="rounded-pill bg-card px-xs text-[12px] font-extrabold leading-[20px] text-ink-soft">✓</span>
                    ) : null}
                  </span>
                  <span className="hidden min-w-0 flex-col gap-xs sm:flex">
                    {list.slice(0, 2).map((t) => (
                      <span key={t.id} className={`flex min-w-0 items-center gap-xs ${t.priority === null ? '' : `pri-${t.priority}`}`}>
                        <span aria-hidden="true" className="size-[8px] shrink-0 rounded-pill" style={{ background: 'var(--pri, var(--color-ink-mute))' }} />
                        <span className={`min-w-0 truncate text-[12px] font-semibold ${t.status === 'done' ? 'text-ink-soft line-through' : ''}`}>{t.title}</span>
                      </span>
                    ))}
                    {list.length > 2 && <span className="text-[12px] font-bold text-ink-soft">+{list.length - 2} more</span>}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-sm m-0 text-[12px] font-semibold text-ink-soft">{COPY.legend}</p>
          {d.more && <p className="mt-xs m-0 text-[12px] font-bold">{COPY.more}</p>}
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

      <DaySheet day={picked} tasks={picked ? (byDay.get(picked) ?? []) : []} projects={d?.projects ?? []} today={today} queue={queue} onClose={() => setPicked(null)} />
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
  const when = [t.time ? timeLabel(t.time) : null, t.estimateMin ? `${t.estimateMin} min` : null].filter(Boolean).join(' · ');
  const chip = 'rounded-pill bg-paper px-xs text-[12px] font-extrabold leading-[20px] text-ink-soft';
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
    <li>
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
              <span className={chip} title={t.repeat}>
                🔁 Habit
              </span>
            )}
            {when && !done && <span className={chip}>{when}</span>}
            {due?.overdue && <span className="rounded-pill bg-r1 px-xs text-[12px] font-extrabold leading-[20px] text-on-fill">{due.text}</span>}
          </span>
        }
      />
    </li>
  );
}

/** A day opened: its tasks to tick, and a form to add one with the day already picked. */
function DaySheet({ day, tasks, projects, today, queue, onClose }: { day: string | null; tasks: MonthTask[]; projects: MonthProject[]; today: string; queue: ReturnType<typeof useActionQueue>; onClose: () => void }) {
  return (
    <Sheet open={day !== null} onClose={onClose} title={day ? prettyDate(day) : ''}>
      {day && (
        <div className="flex flex-col gap-md pb-xl">
          {tasks.length === 0 ? (
            <p className="m-0 text-[14px] font-semibold text-ink-soft">{COPY.empty}</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-xs p-0">
              {tasks.map((t) => (
                <DayTask key={t.id} t={t} today={today} queue={queue} />
              ))}
            </ul>
          )}
          <Fold key={day} title="Add a task on this day" defaultOpen={tasks.length === 0}>
            <AddOnDay day={day} today={today} projects={projects} />
          </Fold>
        </div>
      )}
    </Sheet>
  );
}

/** The add form: a title, the project it holds up, and the ordinary task plan with the do date set to the day. It goes through the same route the pillar page uses. */
function AddOnDay({ day, today, projects }: { day: string; today: string; projects: MonthProject[] }) {
  const refresh = useRefreshAll();
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
      setTitle('');
      setPlan(planOf(null, day));
    },
  });

  if (projects.length === 0) {
    return (
      <div className="rounded-tile bg-paper p-sm">
        <p className="m-0 text-[14px] font-semibold text-ink-soft">{COPY.noProject}</p>
        <Link to="/tower" className="toy mt-sm inline-flex min-h-[48px] items-center rounded-pill bg-ink px-md font-bold text-on-ink">
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
      <label className="block">
        <span className="block text-[14px] font-bold">What is the task?</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} required placeholder="One clear thing you can finish" className="mt-xs w-full rounded-tile border-2 border-line bg-card px-sm py-sm text-[16px]" />
      </label>
      <label className="block">
        <span className="block text-[14px] font-bold">Which project does it hold up?</span>
        <select value={project?.id ?? ''} onChange={(e) => setProjectId(e.target.value)} className="mt-xs w-full rounded-tile border-2 border-line bg-card px-sm py-sm text-[16px]">
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title} ({RELATIONSHIP_BY_KEY[p.relationship].name})
            </option>
          ))}
        </select>
      </label>
      <TaskPlanFields
        plan={plan}
        onChange={(next) => {
          create.reset();
          setPlan(next);
        }}
        today={today}
      />
      {day < today && <p className="m-0 text-balance text-[12px] font-semibold text-ink-soft">{COPY.past}</p>}
      {create.isError && (
        <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
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
      <p className="mp-legend">Printed from kreators.app on {new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
    </div>,
    document.body,
  );
}
