import { HIDDEN_PAGE_PREFIX, taskHideOf, taskHideState, type Node } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import { keys, useAuthed, useRefreshAll } from '../lib/queries';
import type { useActionQueue } from '../lib/useActionQueue';
import { DailyTask } from './DailyTask';
import { Fold } from './Fold';
import { Pager, TEN_A_PAGE, usePage } from './Pager';
import { SkeletonList } from './Skeleton';
import { focusAfterHide } from '../lib/focusHeading';
import { sayStatus } from '../lib/sayStatus';
import { Button } from './Button';
import { useId } from 'react';

/**
 * Hidden tasks (2026-11-12, the founder: "tasks that go under a toggle tab below called hidden tasks"): the last fold of Daily's Tasks
 * section, closed by default, its count beside it, shown only while a task is hidden on the day. Opened, it reads GET /today/hidden, ten a page
 * (10, 25 or 50, prefix `hd`), Until tomorrow first: each an ordinary task row (a tick pays and counts like any, the do-date lock kept, its plan
 * one tap away) with its state and an outline Unhide under it. Whole: the Area filter and the Bottlenecks view never cut it.
 */
export function HiddenTasks({ date, total, queue, onToggle, focusTask, className = 'mt-md' }: { date: string; total: number; queue: ReturnType<typeof useActionQueue>; onToggle: (id: string) => void; focusTask: string | null; /** Its room above: a fold's 8px right under Tasks' other folds, a section's 16px after a list (Daily decides). */ className?: string }) {
  const pg = usePage(HIDDEN_PAGE_PREFIX, TEN_A_PAGE);
  if (total <= 0 && pg.page === 1) return null;
  // An address that names a page or a size of this list opens it, so Back and a shared link land on the page they show.
  return (
    <Fold id="hidden-tasks" className={className} title="Hidden tasks" hint={String(total)} defaultOpen={pg.page !== 1 || pg.size !== TEN_A_PAGE.fallback}>
      <HiddenList date={date} pg={pg} queue={queue} onToggle={onToggle} focusTask={focusTask} />
    </Fold>
  );
}

function HiddenList({ date, pg, queue, onToggle, focusTask }: { date: string; pg: ReturnType<typeof usePage>; queue: ReturnType<typeof useActionQueue>; onToggle: (id: string) => void; focusTask: string | null }) {
  const q = useAuthed([...keys.today(date), 'hidden', pg.query], () => api.todayHidden(date, pg.query));
  if (q.isPending) return <SkeletonList className="mt-xs" count={2} lines={1} label="Loading hidden tasks" />;
  if (q.isError) return <p role="alert" className="mt-xs m-0 text-subhead">Could not load the hidden tasks. Try again in a moment.</p>;
  return (
    <>
      <p className="m-0 text-caption text-ink-soft">Out of your lists, with no reminders. A tick still counts.</p>
      <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0">
        {q.data.tasks.map((t) => (
          <DailyTask key={t.id} t={t} date={date} queue={queue} focus={t.id === focusTask} onToggle={() => onToggle(t.id)} below={<HiddenFoot task={t} date={date} />} belowWhileClosed />
        ))}
      </ul>
      <Pager page={q.data.page} prefix={HIDDEN_PAGE_PREFIX} label="hidden tasks" only={TEN_A_PAGE} />
    </>
  );
}

/**
 * Under a hidden task: how long it stays hidden, at the left, and an outline Unhide at the right (on a narrow phone, Unhide on top), both
 * under the card rather than its box (the box column, 44px, is kept clear). Unhide says the state as its description, and the news goes
 * through the app's one live region, since the row leaves this list. Daily's Hidden tasks and a pillar page's Hidden fold (2026-11-13)
 * both draw it; the pillar page names where the task goes back to (`back`) and its own fold and heading for the keyboard (`place`).
 */
export function HiddenFoot({ task, date, back = 'on Daily', place }: { task: Node; date: string; back?: string; place?: { fold: string; heading: string } }) {
  const refresh = useRefreshAll();
  const stateId = useId();
  const unhide = useMutation({
    mutationFn: () => api.hideTask(task.id, null, date),
    onSuccess: () => {
      sayStatus(`“${task.title}” is back ${back}.`);
      focusAfterHide(refresh(), false, place);
    },
  });
  const hide = taskHideOf(task.hiddenUntil, date);
  return (
    <div className="mt-xs flex">
      <span aria-hidden="true" className="w-[44px] shrink-0 self-start" />
      <div className="flex min-w-0 flex-1 flex-wrap-reverse items-center justify-between gap-sm">
        <p id={stateId} className="m-0 min-w-0 flex-1 basis-[60%] text-caption text-ink-soft">
          {hide ? taskHideState(hide) : `Back ${back}`}
          {unhide.isError && <span role="alert"> Could not unhide it. Try again.</span>}
        </p>
        <Button variant="outline" size="sm" disabled={unhide.isPending} onClick={() => unhide.mutate()} aria-label={`Unhide “${task.title}”`} aria-describedby={stateId}>
          Unhide
        </Button>
      </div>
    </div>
  );
}
