import { LIFE_AREAS, PRIORITIES, mondayOf, priorityTag, repeatLabel, openDay, taskIsHabit, type LifeAreaKey, type Node, type Priority, type TimeBlock } from '@kreators/shared';
import { tbClass, tbStyle } from '../lib/blockColor';
import { Bell, ClipboardCheck, Landmark, Repeat as RepeatIcon } from 'lucide-react';
import { Icon } from './Icon';
import { todayLocal } from '../lib/date';
import { useTimeBlocks } from '../lib/useTimeBlocks';
import { StatusTag } from './StatusTag';
import { IconTag } from './FactTag';

// The marks a task row wears, kept apart from the plan form (TaskPlan.tsx) so a task row on Daily does not pull the whole form into
// the first download; the form loads when a task's plan is opened. TaskPlan re-exports these, so its importers are unchanged.

export const CHIP = 'inline-flex shrink-0 items-center rounded-pill px-sm text-caption font-medium leading-[24px]';

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
 * Habit (it comes back on its own), From pillar (the strategy session or the vibe check made it), From your coach and the area of
 * life it is for (its icon and its name, never the icon alone).
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
      {task.lifeArea && <AreaTag area={task.lifeArea} />}
      {task.timeBlockId && <TaskBlockMark id={task.timeBlockId} />}
    </>
  );
}

/** The time block a task was put in, as a quiet tag: the block's colour dot and its name (the word is always shown). */
export function BlockMark({ block }: { block: Pick<TimeBlock, 'name' | 'color'> }) {
  return (
    <StatusTag tone="neutral" title={`Time block: ${block.name}`} mark={<span className={`tb-dot ${tbClass(block.color)}`} style={tbStyle(block.color)} />}>
      {block.name}
    </StatusTag>
  );
}

/** Looks the block up in the person's blocks (the same read as Time blocks, cached), so a row only needs the id. */
function TaskBlockMark({ id }: { id: string }) {
  const q = useTimeBlocks(mondayOf(todayLocal()));
  const block = q.data?.blocks.find((b) => b.id === id);
  return block ? <BlockMark block={block} /> : null;
}

/** The area of life a task is for, as a quiet tag: the area's icon and its name. */
export function AreaTag({ area }: { area: LifeAreaKey }) {
  const a = LIFE_AREAS[area];
  return (
    <IconTag tone="neutral" icon={a.icon} title={`Area of life: ${a.name}`}>
      {a.name}
    </IconTag>
  );
}
