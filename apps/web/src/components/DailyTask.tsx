import type { Node } from '@kreators/shared';
import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { lazyNamed } from '../lib/lazy';
import type { useActionQueue } from '../lib/useActionQueue';
import { Skeleton } from './Skeleton';
import { TaskRow } from './TaskRow';

// A task's plan form downloads the first time a plan is opened, so the whole form stays out of the first download.
const TaskPanel = lazyNamed(() => import('./TaskPlan'), 'TaskPanel');

/**
 * A task on Daily with its plan panel one tap away: the main list, "N more waiting", the grouped views, and the Past due and Upcoming tabs
 * (2026-11-12) all draw this one row.
 */
export function DailyTask({ t, date, queue, onToggle, subtitle, focus = false, below }: { t: Node; date: string; queue: ReturnType<typeof useActionQueue>; onToggle: () => void; subtitle?: string; focus?: boolean; /** A quiet line under the row (a block suggestion or a mismatch, from the grouped view). */ below?: ReactNode }) {
  // A reminder note opens Daily on its task (`?task=<id>`): that task starts with its plan open and is scrolled into view, once.
  const [open, setOpen] = useState(focus);
  useEffect(() => {
    if (!focus) return;
    const el = document.getElementById(`task-plan-${t.id}`);
    el?.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [focus, t.id]);
  return (
    <TaskRow
      task={t}
      today={date}
      subtitle={subtitle}
      busy={queue.isPending(t.id)}
      hint={queue.hint(t.id)}
      onToggle={onToggle}
      onEdit={() => setOpen((v) => !v)}
      editLabel={open ? 'Close the plan for' : 'Plan'}
      editOpen={open}
      editControls={`task-plan-${t.id}`}
      panel={
        below || open ? (
          <>
            {below}
            {open && (
              <div id={`task-plan-${t.id}`}>
                <Suspense fallback={<Skeleton className="mt-xs h-[240px]" />}>
                  <TaskPanel task={t} today={date} />
                </Suspense>
              </div>
            )}
          </>
        ) : null
      }
    />
  );
}
