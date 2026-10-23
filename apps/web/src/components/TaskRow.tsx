import { RELATIONSHIP_BY_KEY, type Node } from '@kreators/shared';
import { motion, useReducedMotion } from 'motion/react';
import { dueLabel } from '../lib/date';

interface Props {
  task: Node;
  today: string;
  /** Small line under the title, e.g. the relationship or the project. */
  subtitle?: string;
  busy?: boolean;
  onToggle: () => void;
  onOpen?: () => void;
}

export function TaskRow({ task, today, subtitle, busy = false, onToggle, onOpen }: Props) {
  const reduce = useReducedMotion();
  const rel = RELATIONSHIP_BY_KEY[task.relationship];
  const due = task.status === 'done' ? null : dueLabel(task.dueDate, today);
  const done = task.status === 'done';

  return (
    <motion.li
      layout={!reduce}
      initial={{ opacity: 0, y: reduce ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: reduce ? 0 : 48 }}
      className="flex items-center gap-sm rounded-tile bg-card p-sm shadow-toy-soft"
    >
      <button
        type="button"
        aria-pressed={done}
        aria-label={done ? `Mark "${task.title}" as not done` : `Complete "${task.title}"`}
        onClick={onToggle}
        disabled={busy}
        className="toy flex size-[44px] shrink-0 items-center justify-center rounded-pill border-[3px] disabled:opacity-60"
        style={{ borderColor: rel.color, background: done ? rel.color : '#fff', boxShadow: `0 4px 0 0 ${rel.deep}` }}
      >
        {done && (
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke={rel.text} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        )}
      </button>

      {onOpen ? (
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 rounded-tile text-left" aria-label={`Edit "${task.title}"`}>
          <TaskText title={task.title} done={done} subtitle={subtitle} />
        </button>
      ) : (
        <div className="min-w-0 flex-1">
          <TaskText title={task.title} done={done} subtitle={subtitle} />
        </div>
      )}

      {due && (
        <span
          className={`shrink-0 rounded-pill px-sm py-xs text-[12px] font-extrabold ${due.overdue ? 'bg-r1 text-ink' : due.text === 'Today' ? 'bg-ink text-white' : 'bg-paper text-ink-soft'}`}
        >
          {due.text}
        </span>
      )}
    </motion.li>
  );
}

function TaskText({ title, done, subtitle }: { title: string; done: boolean; subtitle?: string }) {
  return (
    <>
      <p className={`m-0 truncate text-[16px] font-bold ${done ? 'text-ink-mute line-through' : ''}`}>{title}</p>
      {subtitle && <p className="m-0 truncate text-[13px] font-semibold text-ink-soft">{subtitle}</p>}
    </>
  );
}
