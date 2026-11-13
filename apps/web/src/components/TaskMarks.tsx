import { LIFE_AREAS, PRIORITIES, TASK_TAG_FLAG_WORDS, mondayOf, openTag, priorityTag, repeatLabel, openDay, taskIsHabit, type LifeAreaKey, type Node, type OpenKind, type Priority, type TimeBlock } from '@kreators/shared';
import { tbClass, tbStyle } from '../lib/blockColor';
import { Bell, ClipboardCheck, Landmark, Repeat as RepeatIcon } from 'lucide-react';
import { Icon } from './Icon';
import { todayLocal } from '../lib/date';
import { useTimeBlocks } from '../lib/useTimeBlocks';
import { StatusTag } from './StatusTag';
import { IconTag } from './FactTag';
import { TAG_FILTER_HINT_ID, useTagFilter, type TagPress } from '../lib/taskTagFilter';

// The marks a task row wears, kept apart from the plan form (TaskPlan.tsx) so a task row on Daily does not pull the whole form into
// the first download; the form loads when a task's plan is opened. TaskPlan re-exports these, so its importers are unchanged.

export const CHIP = 'inline-flex shrink-0 items-center rounded-pill px-sm text-caption font-medium leading-[24px]';

/** A priority tag in its colour: P0 red, P1 orange, P2 purple, P3 grey. In a list that filters by its tags (2026-11-13) it is a filter
 *  button with the same look at rest (`press`, or the list's own when `filter` is set). */
export function PriorityChip({ priority, filter = false }: { priority: Priority | null; /** Read the list's tag filter, if the row sits in one. */ filter?: boolean }) {
  const tags = useTagFilter();
  if (priority === null) return null;
  const press = filter && tags ? tags.press(`pri:${priority}`, priorityTag(priority)) : null;
  if (press)
    return (
      <button type="button" data-tag-filter="" className={`pri-${priority} pri-chip ${CHIP} relative z-[1] cursor-pointer`} data-tip={PRIORITIES[priority]!.name} aria-label={press.label} aria-describedby={TAG_FILTER_HINT_ID} aria-pressed={press.pressed} onClick={press.onPress}>
        {priorityTag(priority)}
      </button>
    );
  return (
    <span className={`pri-${priority} pri-chip ${CHIP}`} title={PRIORITIES[priority]!.name}>
      {priorityTag(priority)}
    </span>
  );
}

/**
 * The marks on a task, so a person can tell kinds of task apart at a glance: its priority, Remember (it will remind them on the day),
 * Habit (it comes back on its own), From pillar (the strategy session or the vibe check made it), From your coach, its kind of open
 * business (Unfinished, Unresolved or Undecided) and the area of life it is for (its icon and its name, never the icon alone).
 */
export function TaskTags({ task, priority = true }: { task: Node; /** False where the row shows the priority in its own corner. */ priority?: boolean }) {
  // In a list that filters by its tags (Daily's Tasks, a pillar page's Tasks to do; 2026-11-13) each tag is a filter button, the same look
  // at rest; anywhere else (the month sheet, Hidden tasks, a coach's view) it stays a plain mark.
  const tags = useTagFilter();
  const flag = (token: keyof typeof TASK_TAG_FLAG_WORDS) => tags?.press(token, TASK_TAG_FLAG_WORDS[token]);
  return (
    <>
      {priority && <PriorityChip priority={task.priority} filter />}
      {task.remind && (
        <StatusTag tone="warn" mark={<Icon icon={Bell} size={12} />} press={flag('remember')}>
          Remember
        </StatusTag>
      )}
      {task.forReview && (
        <StatusTag tone="info" mark={<Icon icon={ClipboardCheck} size={12} />} press={flag('review')}>
          For review
        </StatusTag>
      )}
      {task.repeat && taskIsHabit(task) && (
        <StatusTag tone="good" mark={<Icon icon={RepeatIcon} size={12} />} title={repeatLabel(task.repeat, openDay(task))} press={flag('habit')}>
          Habit
        </StatusTag>
      )}
      {task.fromPillar && (
        <StatusTag tone="calm" mark={<Icon icon={Landmark} size={12} />} press={flag('built')}>
          From pillar
        </StatusTag>
      )}
      {task.fromCoach && (
        <StatusTag tone="deep" press={flag('coach')}>
          From your coach
        </StatusTag>
      )}
      {task.openKind && <OpenTag kind={task.openKind} press={tags?.press(`kind:${task.openKind}`, openTag(task.openKind))} />}
      {task.lifeArea && <AreaTag area={task.lifeArea} press={tags?.press(`area:${task.lifeArea}`, LIFE_AREAS[task.lifeArea].name)} />}
      {task.timeBlockId && <TaskBlockMark id={task.timeBlockId} filter={Boolean(tags)} />}
    </>
  );
}

/** The time block a task was put in, as a quiet tag: the block's colour dot and its name (the word is always shown). */
export function BlockMark({ block, press }: { block: Pick<TimeBlock, 'name' | 'color'>; /** A filter button (StatusTag's `press`). */ press?: TagPress }) {
  return (
    <StatusTag tone="neutral" title={`Time block: ${block.name}`} press={press} mark={<span className={`tb-dot ${tbClass(block.color)}`} style={tbStyle(block.color)} />}>
      {block.name}
    </StatusTag>
  );
}

/** Looks the block up in the person's blocks (the same read as Time blocks, cached), so a row only needs the id. */
function TaskBlockMark({ id, filter }: { id: string; filter: boolean }) {
  const q = useTimeBlocks(mondayOf(todayLocal()));
  const tags = useTagFilter();
  const block = q.data?.blocks.find((b) => b.id === id);
  return block ? <BlockMark block={block} press={filter && tags ? tags.press(`block:${id}`, block.name) : undefined} /> : null;
}

/** A task's kind of open business (Close the unfinished), as a warm tag with a puzzle piece (from the shared icon registry): the word is always shown. */
export function OpenTag({ kind, press }: { kind: OpenKind; /** A filter button (StatusTag's `press`). */ press?: TagPress }) {
  return (
    <IconTag tone="warm" icon="Puzzle" title="Bottleneck" className="open-tag" press={press}>
      {openTag(kind)}
    </IconTag>
  );
}

/** The area of life a task is for, as a quiet tag: the area's icon and its name. */
export function AreaTag({ area, press }: { area: LifeAreaKey; /** A filter button (StatusTag's `press`). */ press?: TagPress }) {
  const a = LIFE_AREAS[area];
  return (
    <IconTag tone="neutral" icon={a.icon} title={`Area of life: ${a.name}`} press={press}>
      {a.name}
    </IconTag>
  );
}
