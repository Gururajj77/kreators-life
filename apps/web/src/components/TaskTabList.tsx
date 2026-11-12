import { TASK_TAB_PAGE_SIZE, TASK_TAB_PAGE_SIZES, TASK_TAB_PREFIX, addDays, openDay, taskTabOf, type Node, type TaskSort, type TodayTabResponse } from '@kreators/shared';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence } from 'motion/react';
import { api } from '../lib/api';
import { dayLabel } from '../lib/date';
import { keys, useAuthed } from '../lib/queries';
import { useSession } from '../lib/store';
import type { useActionQueue } from '../lib/useActionQueue';
import { Button } from './Button';
import { DailyTask } from './DailyTask';
import { Pager, usePage } from './Pager';
import { SkeletonList } from './Skeleton';

/** Past due and Upcoming: ten a page by default, 10, 25 or 50 (`TASK_TAB_PAGE_SIZES`). */
const TAB_PAGES = { sizes: TASK_TAB_PAGE_SIZES, fallback: TASK_TAB_PAGE_SIZE };

type ListTab = keyof typeof TASK_TAB_PREFIX;

/** The quiet words over a run of one day's tasks: Yesterday and Tomorrow by name, any other day as "Fri, 14 Nov". */
function dayName(day: string, today: string): string {
  if (day === addDays(today, 1)) return 'Tomorrow';
  if (day === addDays(today, -1)) return 'Yesterday';
  return dayLabel(day);
}
/** The same inside a sentence ("From yesterday"), where a relative day is not a name. */
const dayInLine = (day: string, today: string): string => (day === addDays(today, 1) || day === addDays(today, -1) ? dayName(day, today).toLowerCase() : dayLabel(day));

/** Runs of tasks on the same day, in the order the server sent them. */
function byDay(rows: readonly Node[]): { day: string; rows: Node[] }[] {
  const out: { day: string; rows: Node[] }[] = [];
  for (const t of rows) {
    const d = openDay(t) ?? '';
    const last = out[out.length - 1];
    if (last && last.day === d) last.rows.push(t);
    else out.push({ day: d, rows: [t] });
  }
  return out;
}

/**
 * Daily's Past due and Upcoming tabs (2026-11-12, the founder): one tab's open tasks, a page at a time (`GET /today/past-due`, prefix `pd`;
 * `GET /today/upcoming`, prefix `uc`), each the same row as the main list. Past due goes oldest first, or by priority or due date when the
 * Sort row says so; Upcoming soonest first. A list in day order carries a small day name over each day's run. An Upcoming task with a do
 * date keeps TaskRow's "Tick it on the day" lock; a due date never holds a tick back.
 */
export function TaskTabList({
  tab,
  date,
  area,
  areaName,
  sort,
  queue,
  onToggle,
  focusTask,
  onClearArea,
  onPlanWeek,
}: {
  tab: ListTab;
  date: string;
  /** Daily's Area cut, sent to the server like the main list's. */
  area: string;
  /** "for Physical", "with no area", or '' with no area picked. */
  areaName: string;
  /** Past due's order (`taskTabSort`); Upcoming is always by day. */
  sort: TaskSort;
  queue: ReturnType<typeof useActionQueue>;
  onToggle: (id: string) => void;
  focusTask: string | null;
  onClearArea: () => void;
  /** Opens Plan my week, where a late task gets a new day. */
  onPlanWeek: () => void;
}) {
  const prefix = TASK_TAB_PREFIX[tab];
  const pg = usePage(prefix, TAB_PAGES);
  const token = useSession((s) => s.token);
  const order: TaskSort = tab === 'pastdue' ? sort : 'day';
  // Under the day's key, so a tick anywhere on Daily (which reads the day again) reads this page again too. A new page keeps the old rows
  // on screen until it lands, so the list never drops to the loading cards and back.
  const q = useQuery<TodayTabResponse>({
    queryKey: [...keys.today(date), 'tab', tab, area, order, pg.query],
    queryFn: () => (tab === 'pastdue' ? api.todayPastDue(date, pg.query, area, order) : api.todayUpcoming(date, pg.query, area)),
    enabled: Boolean(token),
    placeholderData: (prev) => (prev?.tab === tab ? prev : undefined),
  });
  const label = tab === 'pastdue' ? 'past due tasks' : 'upcoming tasks';
  // A link to one task (`?task=<id>`, a Remember note or a content day's Open it) whose day puts it on this tab but not on the page shown:
  // read it alone and show it first, so it is never lost on a later page.
  const onPage = Boolean(focusTask) && Boolean(q.data?.tasks.some((t) => t.id === focusTask));
  const focusQ = useAuthed(['node', focusTask], () => api.node(focusTask!), Boolean(focusTask) && Boolean(q.data) && !onPage);
  const pinned = !onPage && focusQ.data?.node.status === 'active' && taskTabOf(focusQ.data.node, date) === tab ? focusQ.data.node : null;

  if (q.isPending) return <SkeletonList className="mt-sm" count={3} lines={2} label={`Loading ${label}`} />;
  if (q.isError || !q.data)
    return (
      <div className="mt-sm flex flex-wrap-reverse items-center justify-between gap-sm rounded-card bg-card p-md shadow-toy-soft" role="alert">
        <p className="m-0 min-w-0 flex-1 basis-[60%] font-semibold">Could not load these tasks.</p>
        <Button variant="outline" onClick={() => q.refetch()}>
          Try again
        </Button>
      </div>
    );

  const rows = q.data.tasks;
  if (rows.length === 0 && pg.page === 1 && !pinned) {
    const words = area
      ? tab === 'pastdue'
        ? `Nothing past due ${areaName}.`
        : `Nothing coming up ${areaName}.`
      : tab === 'pastdue'
        ? 'Nothing is past due. Every open task is on time.'
        : 'Nothing is planned after today yet. Plan my week can give your tasks a day.';
    return (
      <div className="mt-sm flex flex-wrap-reverse items-center justify-between gap-sm rounded-card border-2 border-dashed border-line p-md">
        <p className="m-0 min-w-0 flex-1 basis-[60%] text-subhead text-ink-soft">{words}</p>
        {area ? (
          <Button variant="outline" onClick={onClearArea}>
            Show every area
          </Button>
        ) : tab === 'upcoming' ? (
          <Button variant="outline" onClick={onPlanWeek}>
            Plan my week
          </Button>
        ) : null}
      </div>
    );
  }

  const row = (t: Node, subtitle?: string) => <DailyTask key={t.id} t={t} date={date} queue={queue} focus={t.id === focusTask} subtitle={subtitle} onToggle={() => onToggle(t.id)} />;
  const pinId = `${prefix}-opened`;
  return (
    <>
      {pinned && (
        <div role="group" aria-labelledby={pinId} className="mt-sm">
          <p id={pinId} className="m-0 text-eyebrow uppercase text-ink-soft">
            The task you opened
          </p>
          <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0">{row(pinned, openDay(pinned) ? `From ${dayInLine(openDay(pinned)!, date)}` : undefined)}</ul>
        </div>
      )}
      {order === 'day' ? (
        <div className="mt-sm flex flex-col gap-sm">
          {byDay(rows).map((g) => {
            const id = `${prefix}-day-${g.day}`;
            return (
              <div key={g.day} role="group" aria-labelledby={id}>
                <p id={id} className="m-0 text-eyebrow uppercase text-ink-soft">
                  {dayName(g.day, date)}
                </p>
                <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0">
                  <AnimatePresence initial={false}>{g.rows.map((t) => row(t))}</AnimatePresence>
                </ul>
              </div>
            );
          })}
        </div>
      ) : (
        // In another order the day is said on each row, since rows of one day no longer sit together.
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          <AnimatePresence initial={false}>{rows.map((t) => row(t, openDay(t) ? `From ${dayInLine(openDay(t)!, date)}` : undefined))}</AnimatePresence>
        </ul>
      )}
      <Pager page={q.data.page} prefix={prefix} label={label} only={TAB_PAGES} />
      {tab === 'pastdue' && (
        <p className="mt-xs m-0 text-caption text-ink-soft">
          Give them a new day with{' '}
          <button
            type="button"
            onClick={onPlanWeek}
            className="relative underline underline-offset-4 hover:text-ink after:absolute after:left-1/2 after:top-1/2 after:h-[44px] after:w-[max(100%,44px)] after:-translate-x-1/2 after:-translate-y-1/2 after:content-['']"
          >
            Plan my week
          </button>
          .
        </p>
      )}
    </>
  );
}
