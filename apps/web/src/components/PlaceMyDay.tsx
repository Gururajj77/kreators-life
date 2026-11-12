import { formatCount, minuteOf, openDay, type Node, type TimeBlock, type TodayResponse } from '@kreators/shared';
import { autoPlace, blockUsedMin, type AutoNoRoom, type AutoPlaced, type AutoPlan } from '@kreators/shared/blockHints';
import { useMutation } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { api } from '../lib/api';
import { clockAt } from '../lib/date';
import { useRefreshAll } from '../lib/queries';
import { Button } from './Button';
import { ErrorLine } from './ErrorLine';
import { StatusTag } from './StatusTag';

/** The plan and quick ways into it: where each placed task goes and why the others do not fit. */
export interface DayPlacement extends AutoPlan {
  /** Loose tasks past the 50 GET /today sends, which this plan did not read (the 50 are the ones that matter most to it). */
  beyond: number;
  byId: Map<string, AutoPlaced>;
  missById: Map<string, AutoNoRoom>;
}

/**
 * Place my day (2026-11-12, the founder's decision 3): the plan `autoPlace` makes for the day's open tasks with no block and no time (GET
 * /today `looseTasks`), worked out on read and never written until "Place my day" is tapped. One rule for Daily's Your day and its By time
 * block view, read from the same answer (`useDailyAnswer`), so both show the same plan. Room is the server's minutes in each block
 * (`slotPlannedMin`, only the slots still to come on today) and what this plan placed; every timed task of the day (`timedSpans`, whatever
 * the six shown or the Area cut, so any cut of the day gives the same plan) is never overlapped; on today nothing goes in time already gone
 * (`after`). A task that repeats is never placed. Null while there is no plan of the day to place into.
 */
export function dayPlacement(a: TodayResponse | undefined, after: number | null): DayPlacement | null {
  if (!a?.day || a.day.slots.length === 0) return null;
  const loose = a.looseTasks ?? [];
  // An answer from before `timedSpans` (an older server for a moment around a deploy) falls back to the timed tasks it lists.
  const taken = a.timedSpans
    ? a.timedSpans.map((x) => ({ dueTime: x.dueTime, estimateMin: x.min }))
    : a.tasks.filter((t) => t.status === 'active' && minuteOf(t.dueTime) !== null && openDay(t) === a.date).map((t) => ({ dueTime: t.dueTime, estimateMin: t.estimateMin }));
  const plan = loose.length
    ? autoPlace(
        loose.map((t) => ({ id: t.id, priority: t.priority, dueDate: t.dueDate, dueTime: t.dueTime, timeBlockId: t.timeBlockId ?? null, fromPillar: t.fromPillar, estimateMin: t.estimateMin, lifeArea: t.lifeArea, relationship: t.relationship, repeats: Boolean(t.repeat) })),
        { slots: a.day.slots, blocks: a.day.blocks, used: blockUsedMin(a.day.slots, a.day.slotPlannedMin, after), taken, after },
      )
    : { placed: [], noRoom: [] };
  const beyond = Math.max(0, (a.looseTotal ?? loose.length) - loose.length);
  return { ...plan, beyond, byId: new Map(plan.placed.map((p) => [p.taskId, p])), missById: new Map(plan.noRoom.map((m) => [m.taskId, m])) };
}

/** "10:00 am to 10:30 am": a placed task's time on the clock, in the person's format. */
export function placedRange(p: Pick<AutoPlaced, 'start' | 'end'>): string {
  return `${clockAt(minuteOf(p.start) ?? 0)} to ${clockAt(minuteOf(p.end) ?? 0)}`;
}

const tasksWord = (n: number) => (n === 1 ? '1 task' : `${n} tasks`);

/** What the plan holds, in one line: "3 tasks fit your blocks. 1 has no room today. 1 repeats, so it waits for a time from you." */
function planLine(plan: DayPlacement): string {
  const fit = plan.placed.length;
  const repeats = plan.noRoom.filter((m) => m.reason === 'repeats').length;
  const miss = plan.noRoom.length - repeats;
  const parts = [fit === 0 ? 'No task fits your blocks today.' : `${tasksWord(fit)} ${fit === 1 ? 'fits' : 'fit'} your blocks.`];
  if (miss > 0) parts.push(`${miss === 1 ? '1 has' : `${miss} have`} no room today.`);
  if (repeats > 0) parts.push(`${repeats === 1 ? '1 repeats, so it waits' : `${repeats} repeat, so they wait`} for a time from you.`);
  if (plan.beyond > 0) parts.push(`${formatCount(plan.beyond)} more ${plan.beyond === 1 ? 'waits' : 'wait'} past the first 50.`);
  return parts.join(' ');
}

/** What one Place my day did: "Placed 3 tasks in your day. 1 had changed elsewhere, so it was left as it is." */
function savedLine(saved: number, skipped: number): string {
  const head = saved === 0 ? 'Nothing was placed.' : `Placed ${tasksWord(saved)} in your day.`;
  if (skipped === 0) return head;
  return `${head} ${skipped === 1 ? '1 had changed elsewhere, so it was left as it is.' : `${skipped} had changed elsewhere, so they were left as they are.`}`;
}

/**
 * The one outline "Place my day" in Your day (2026-11-12): what the plan holds in one line at the left, the button at the right, and after a
 * tap one status line saying how many took their time and how many had changed in another tab (POST /nodes/place, which writes each task's
 * time only, guarded on it still having no time and no block). Daily is read again after it; focus moves to the status line, since the
 * button goes once nothing is left to place.
 */
export function PlaceMyDay({ date, plan }: { date: string; plan: DayPlacement }) {
  const refresh = useRefreshAll();
  const [said, setSaid] = useState<string | null>(null);
  const status = useRef<HTMLParagraphElement>(null);
  const place = useMutation({
    mutationFn: () => api.placeDay({ date, items: plan.placed.map((p) => ({ id: p.taskId, dueTime: p.start })) }),
    onMutate: () => setSaid(null),
    onSuccess: (r) => {
      setSaid(savedLine(r.saved, r.skipped.length));
      void refresh().then(() => requestAnimationFrame(() => status.current?.focus()));
    },
  });
  const any = plan.placed.length + plan.noRoom.length > 0;
  if (!any && !said && !place.error) return null;
  return (
    <div className="mt-sm">
      {any && (
        <div className="flex flex-wrap-reverse items-center justify-between gap-sm">
          <p className="m-0 min-w-0 flex-[1_1_60%] text-subhead text-ink-soft">{planLine(plan)}</p>
          {plan.placed.length > 0 && (
            <Button variant="outline" size="sm" className="ml-auto" disabled={place.isPending} onClick={() => place.mutate()}>
              {place.isPending ? 'Placing…' : 'Place my day'}
            </Button>
          )}
        </div>
      )}
      {said && (
        <p ref={status} tabIndex={-1} role="status" className="mt-xs m-0 text-subhead text-ink-soft outline-none">
          {said}
        </p>
      )}
      <ErrorLine e={place.error} className="mt-xs" />
    </div>
  );
}

/** A placed task's mark and words, for a row in Your day: "Placed" and its block and time, or "No room today" and why. */
export function PlacedNote({ t, plan, blocks }: { t: Node; plan: DayPlacement; blocks: readonly TimeBlock[] }) {
  const p = plan.byId.get(t.id);
  if (p) {
    const b = blocks.find((x) => x.id === p.blockId);
    return (
      <span className="mt-xs flex flex-wrap items-center gap-xs text-caption text-ink-soft" data-placed={p.blockId}>
        <StatusTag tone="calm">Placed</StatusTag>
        <span>
          {b?.name ?? 'A block'}, <span className="whitespace-nowrap">{placedRange(p)}</span>
        </span>
      </span>
    );
  }
  const m = plan.missById.get(t.id);
  if (m)
    return (
      <span className="mt-xs flex flex-wrap items-center gap-xs text-caption text-ink-soft" data-no-room>
        <StatusTag tone="neutral">{m.reason === 'repeats' ? 'Not placed' : 'No room today'}</StatusTag>
        <span>{m.line}</span>
      </span>
    );
  return null;
}
