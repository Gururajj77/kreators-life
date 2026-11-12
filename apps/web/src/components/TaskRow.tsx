import { RELATIONSHIP_BY_KEY, mondayOf, taskIsHabit, type Node } from '@kreators/shared';
import { m as motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
import { ListChecks } from 'lucide-react';
import { dueLabel, todayLocal, clockOf } from '../lib/date';
import { useTimeBlocks } from '../lib/useTimeBlocks';
import { minutesUntil, useNow } from '../lib/useNow';
import { CheckRow } from './CheckRow';
import { Icon } from './Icon';
import { PriorityChip, TaskTags } from './TaskMarks';
import { FactTag, IconTag } from './FactTag';
import { StatusTag } from './StatusTag';
import { pillarTick } from '../lib/relFill';

interface Props {
  task: Node;
  today: string;
  /** Small line under the title, e.g. the relationship or the project. */
  subtitle?: string;
  busy?: boolean;
  hint?: string | null;
  /** Ticks or unticks the task: the box in front of the row. */
  onToggle: () => void;
  /** What tapping the task itself opens (its plan in place, or the edit sheet). The card's small edit button at its top right does the
   *  same. Leave it off and the words tick like the box (Done today). */
  onEdit?: () => void;
  /** Opened under the row: the task's plan, its subtasks and its focus button. */
  panel?: ReactNode;
  /** The open control's words before the title ("Plan", "Close the plan for"); "Edit" when left off. */
  editLabel?: string;
  /** Tapping the task opens `panel` in place: whether it is open now. The control then carries `aria-expanded` and the small edit
   *  button's pencil turns into a cross while open (`ToggleIcon`). Leave it off when it opens a Sheet, which has its own close. */
  editOpen?: boolean;
  /** The id of the opened panel, for `aria-controls`. */
  editControls?: string;
  /** Show the task's pillar as a tag (on a pillar's own page every task is that pillar, so it is left off). */
  pillarTag?: boolean;
}

export function TaskRow({ task, today, subtitle, busy = false, hint = null, onToggle, onEdit, panel, editLabel, editOpen, editControls, pillarTag = true }: Props) {
  const reduce = useReducedMotion();
  const now = useNow();
  const rel = RELATIONSHIP_BY_KEY[task.relationship];
  const done = task.status === 'done';
  const wait = done ? 0 : minutesUntil(task.readyAt, now);
  // The deadline shows as a badge; only the do date holds a tick back.
  const due = done ? null : dueLabel(task.dueDate, today);
  const early = !done && Boolean(task.doDate && task.doDate > today);
  const steps = task.subtaskTotal ? (
    <StatusTag tone="neutral" mark={<Icon icon={ListChecks} size={12} />} title="Subtasks done">
      {task.subtaskDone ?? 0}/{task.subtaskTotal}
    </StatusTag>
  ) : null;

  const when = [task.dueTime ? clockOf(task.dueTime) : null, task.estimateMin ? `${task.estimateMin} min` : null].filter(Boolean).join(' · ');
  const timeChip = when && !done ? <FactTag kind="when">{when}</FactTag> : null;
  // The block mark draws only once its block is found in the same cached read TaskTags uses (TaskBlockMark), so a row whose block is
  // its only mark never grows an empty band while that read loads, fails or misses the id.
  const blocks = useTimeBlocks(mondayOf(todayLocal()), Boolean(task.timeBlockId));
  const hasBlock = Boolean(task.timeBlockId && blocks.data?.blocks.some((b) => b.id === task.timeBlockId));
  // A task a life coach added says so; it ticks and pays like any other.
  const hasMarks = task.remind || Boolean(task.repeat && taskIsHabit(task)) || Boolean(task.fromPillar) || Boolean(task.fromCoach) || Boolean(task.forReview) || Boolean(task.lifeArea) || Boolean(task.openKind) || hasBlock;
  const badge =
    wait > 0 ? (
      <IconTag tone="neutral" icon="Hourglass">{`Ready in ${wait} min`}</IconTag>
    ) : due ? (
      <StatusTag tone={due.overdue ? 'bad' : due.text === 'Today' ? 'warn' : 'neutral'}>{due.overdue || due.text === 'Today' ? due.text : `Due ${due.text}`}</StatusTag>
    ) : null;

  return (
    <motion.li
      data-pillar={rel.key}
      data-task-id={task.id}
      layout={!reduce}
      initial={{ opacity: 0, y: reduce ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: reduce ? 0 : 48 }}
    >
      <CheckRow
        checked={done}
        onToggle={onToggle}
        title={task.title}
        subtitle={subtitle}
        // The box in the pillar's own colour, from the tuned tokens (orange and yellow take the dark tick, and their empty edge their deep colour).
        {...pillarTick(rel)}
        busy={busy}
        strike
        hint={hint}
        lockedMessage={early ? `For ${dueLabel(task.doDate, today)?.text.toLowerCase() ?? task.doDate}. Tick it on the day.` : wait > 0 ? `Ready in ${wait} ${wait === 1 ? 'minute' : 'minutes'}. Do it first, then tick it.` : null}
        marks={
          hasMarks || badge || timeChip || steps ? (
            <>
              {badge}
              {timeChip}
              {steps}
              <TaskTags task={task} priority={false} />
            </>
          ) : null
        }
        corner={<PriorityChip priority={task.priority} />}
        foot={
          pillarTag ? (
            <span className="inline-flex min-h-[24px] items-center rounded-pill px-xs text-caption font-medium whitespace-nowrap" style={{ background: `var(--soft-${rel.key})`, color: `var(--deep-${rel.key})` }}>
              {rel.name}
            </span>
          ) : null
        }
        open={onEdit ? { onOpen: onEdit, label: editLabel ?? 'Edit', expanded: editOpen, controls: editControls } : undefined}
      />
      {panel}
    </motion.li>
  );
}
