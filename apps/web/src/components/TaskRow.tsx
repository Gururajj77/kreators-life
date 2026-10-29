import { RELATIONSHIP_BY_KEY, timeLabel, type Node } from '@kreators/shared';
import { motion, useReducedMotion } from 'motion/react';
import { dueLabel } from '../lib/date';
import { minutesUntil, useNow } from '../lib/useNow';
import { CheckRow } from './CheckRow';

interface Props {
  task: Node;
  today: string;
  /** Small line under the title, e.g. the relationship or the project. */
  subtitle?: string;
  busy?: boolean;
  hint?: string | null;
  onToggle: () => void;
  onEdit?: () => void;
}

export function TaskRow({ task, today, subtitle, busy = false, hint = null, onToggle, onEdit }: Props) {
  const reduce = useReducedMotion();
  const now = useNow();
  const rel = RELATIONSHIP_BY_KEY[task.relationship];
  const done = task.status === 'done';
  const wait = done ? 0 : minutesUntil(task.readyAt, now);
  const due = done ? null : dueLabel(task.dueDate, today);
  const early = !done && Boolean(task.dueDate && task.dueDate > today);

  const when = [task.dueTime ? timeLabel(task.dueTime) : null, task.estimateMin ? `${task.estimateMin} min` : null].filter(Boolean).join(' · ');
  const timeChip = when && !done ? <span className="rounded-pill bg-paper px-xs text-[12px] font-extrabold leading-[20px] text-ink-soft">{when}</span> : null;
  // A task a life coach added says so; it ticks and pays like any other.
  const coachChip = task.fromCoach ? <span className="rounded-pill bg-paper px-xs text-[12px] font-extrabold leading-[20px] text-ink-soft">From your coach</span> : null;
  const badge =
    wait > 0 ? (
      <span className="rounded-pill bg-paper px-xs text-[12px] font-extrabold leading-[20px] text-ink-soft">Ready in {wait} min</span>
    ) : due ? (
      <span
        className={`rounded-pill px-xs text-[12px] font-extrabold leading-[20px] ${due.overdue ? 'bg-r1 text-on-fill' : due.text === 'Today' ? 'bg-ink text-on-ink' : 'bg-paper text-ink-soft'}`}
      >
        {due.text}
      </span>
    ) : null;

  return (
    <motion.li
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
        lockedMessage={early ? `For ${dueLabel(task.dueDate, today)?.text.toLowerCase() ?? task.dueDate}. Tick it on the day.` : wait > 0 ? `Ready in ${wait} ${wait === 1 ? 'minute' : 'minutes'}. Do it first, then tick it.` : null}
        badge={
          badge || timeChip || coachChip ? (
            <span className="flex flex-wrap justify-end gap-xs">
              {coachChip}
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
              aria-label={`Edit "${task.title}"`}
              className="toy toy-soft flex w-[48px] shrink-0 items-center justify-center rounded-tile bg-card text-ink-soft hover:text-ink"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 20h4L19 9l-4-4L4 16v4z" />
                <path d="M13.5 6.5l4 4" />
              </svg>
            </button>
          ) : undefined
        }
      />
    </motion.li>
  );
}
