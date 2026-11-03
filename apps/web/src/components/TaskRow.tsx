import { RELATIONSHIP_BY_KEY, timeLabel, type Node } from '@kreators/shared';
import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
import { ListChecks, Pencil } from 'lucide-react';
import { dueLabel } from '../lib/date';
import { minutesUntil, useNow } from '../lib/useNow';
import { CheckRow } from './CheckRow';
import { Icon } from './Icon';
import { TaskTags } from './TaskPlan';
import { FactTag, IconTag } from './FactTag';
import { StatusTag } from './StatusTag';

interface Props {
  task: Node;
  today: string;
  /** Small line under the title, e.g. the relationship or the project. */
  subtitle?: string;
  busy?: boolean;
  hint?: string | null;
  onToggle: () => void;
  onEdit?: () => void;
  /** Opened under the row: the task's plan, its subtasks and its focus button. */
  panel?: ReactNode;
  /** Text for the edit button, when it opens a panel. */
  editLabel?: string;
}

export function TaskRow({ task, today, subtitle, busy = false, hint = null, onToggle, onEdit, panel, editLabel }: Props) {
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

  const when = [task.dueTime ? timeLabel(task.dueTime) : null, task.estimateMin ? `${task.estimateMin} min` : null].filter(Boolean).join(' · ');
  const timeChip = when && !done ? <FactTag kind="when">{when}</FactTag> : null;
  // A task a life coach added says so; it ticks and pays like any other.
  const hasMarks = task.priority !== null || task.remind || Boolean(task.repeat) || Boolean(task.fromPillar) || Boolean(task.fromCoach) || Boolean(task.forReview);
  const badge =
    wait > 0 ? (
      <IconTag tone="neutral" icon="Hourglass">{`Ready in ${wait} min`}</IconTag>
    ) : due ? (
      <StatusTag tone={due.overdue ? 'bad' : due.text === 'Today' ? 'warn' : 'neutral'}>{due.overdue || due.text === 'Today' ? due.text : `Due ${due.text}`}</StatusTag>
    ) : null;

  return (
    <motion.li
      data-pillar={rel.key}
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
        color={rel.color}
        deep={`var(--deep-${rel.key})`}
        text={rel.text}
        busy={busy}
        strike
        hint={hint}
        lockedMessage={early ? `For ${dueLabel(task.doDate, today)?.text.toLowerCase() ?? task.doDate}. Tick it on the day.` : wait > 0 ? `Ready in ${wait} ${wait === 1 ? 'minute' : 'minutes'}. Do it first, then tick it.` : null}
        badge={
          (hasMarks || badge || timeChip || steps) ? (
            <span className="flex flex-wrap justify-end gap-xs">
              <TaskTags task={task} />
              {steps}
              {timeChip}
              {badge}
            </span>
          ) : null
        }
        aside={
          onEdit ? (
            <button
              type="button"
              onClick={onEdit}
              aria-label={`${editLabel ?? 'Edit'} "${task.title}"`}
              className="toy toy-soft flex w-[48px] shrink-0 items-center justify-center rounded-tile bg-card text-ink-soft hover:text-ink"
            >
              <Icon icon={Pencil} size={20} strokeWidth={2.6} />
            </button>
          ) : undefined
        }
      />
      {panel}
    </motion.li>
  );
}
