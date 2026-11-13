import { RELATIONSHIP_BY_KEY, blockOfTask, mondayOf, taskIsHabit, type Node } from '@kreators/shared';
import { m as motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useRefreshAll } from '../lib/queries';
import { errorText } from './ErrorLine';
import { focusHeadingAfter } from '../lib/focusHeading';
import { sayStatus } from '../lib/sayStatus';
import { ListChecks } from 'lucide-react';
import { dueLabel, todayLocal, clockOf } from '../lib/date';
import { useTimeBlocks } from '../lib/useTimeBlocks';
import { minutesUntil, useNow } from '../lib/useNow';
import { CheckRow, RowClose } from './CheckRow';
import { Icon } from './Icon';
import { PriorityChip, TaskTags } from './TaskMarks';
import { FactTag, IconTag } from './FactTag';
import { StatusTag } from './StatusTag';
import { pillarTick } from '../lib/relFill';
import { TAG_FILTER_HINT_ID, useTagFilter } from '../lib/taskTagFilter';

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
  // Done early (2026-11-13, the frictionless pass): the lock note offers the way past it, the ordinary do-date change to today. Today is
  // always before the do date here, so it never passes the due date. Shown only after a tap on the locked box, so nothing changes at rest.
  const refresh = useRefreshAll({ insights: true });
  const moveToday = useMutation({ mutationFn: () => api.updateNode(task.id, { doDate: today }), onSuccess: () => refresh() });
  // The button goes with the note once the move lands, so the keyboard's place moves to the row's box (or, when the row left this list,
  // the list's heading) and the move is said (review 2026-11-13).
  const moveNow = (btn: HTMLElement) => {
    const box = btn.closest('p')?.previousElementSibling?.querySelector<HTMLInputElement>('input[type="checkbox"]') ?? null;
    const heading = btn.closest('section')?.querySelector<HTMLElement>('h2[id]')?.id;
    moveToday.mutate(undefined, {
      onSuccess: () =>
        void refresh().then(() => {
          sayStatus('Moved to today. Tick it when it is done.');
          requestAnimationFrame(() => requestAnimationFrame(() => (box?.isConnected ? box.focus({ preventScroll: true }) : focusHeadingAfter(heading))));
        }),
    });
  };
  const steps = task.subtaskTotal ? (
    <StatusTag tone="neutral" mark={<Icon icon={ListChecks} size={12} />} title="Subtasks done">
      {task.subtaskDone ?? 0}/{task.subtaskTotal}
    </StatusTag>
  ) : null;

  // In a list that filters by its tags (Daily's Tasks, a pillar page's Tasks to do; 2026-11-13) the tags are filter buttons, the same look
  // at rest; the time chip filters by the block its time falls in, only on Daily and only when it falls in one.
  const tags = useTagFilter();
  const when = [task.dueTime ? clockOf(task.dueTime) : null, task.estimateMin ? `${task.estimateMin} min` : null].filter(Boolean).join(' · ');
  // The block mark draws only once its block is found in the same cached read TaskTags uses (TaskBlockMark), so a row whose block is
  // its only mark never grows an empty band while that read loads, fails or misses the id.
  const blocks = useTimeBlocks(mondayOf(todayLocal()), Boolean(task.timeBlockId) || Boolean(tags?.filter.time && task.dueTime));
  const hasBlock = Boolean(task.timeBlockId && blocks.data?.blocks.some((b) => b.id === task.timeBlockId));
  const timeBlock = tags?.filter.time && when ? blockOfTask(task, tags.filter.slots) : null;
  const timeBlockName = timeBlock ? blocks.data?.blocks.find((b) => b.id === timeBlock.blockId)?.name : undefined;
  const timeChip = when && !done ? (
    <FactTag kind="when" press={tags && timeBlock && timeBlockName ? tags.press(`block:${timeBlock.blockId}`, timeBlockName, `${when}, ${timeBlockName}`) : undefined}>
      {when}
    </FactTag>
  ) : null;
  const pillarPress = tags?.filter.pillar ? tags.press(`pillar:${rel.key}`, rel.name) : null;
  const pillarClass = 'inline-flex min-h-[24px] items-center rounded-pill px-xs text-caption font-medium whitespace-nowrap';
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
      className="relative"
      // Escape closes a plan open in place and hands focus back to the card (2026-11-13), unless a popup opened from the plan, or a
      // control inside it that closes on Escape itself, took the key first.
      onKeyDown={
        onEdit && editOpen
          ? (e) => {
              if (e.key !== 'Escape' || e.defaultPrevented) return;
              if (e.target instanceof Element && e.target.closest('[role="dialog"], [aria-modal="true"]')) return;
              e.preventDefault();
              const opener = e.currentTarget.querySelector<HTMLElement>('[data-row-open]');
              onEdit();
              opener?.focus();
            }
          : undefined
      }
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
        lockAction={
          early ? (
            <>
              <button
                type="button"
                onClick={(e) => moveNow(e.currentTarget)}
                disabled={moveToday.isPending}
                className="tap-pad relative z-[1] cursor-pointer font-semibold underline underline-offset-4 disabled:opacity-60"
              >
                {moveToday.isPending ? 'Moving…' : 'Move it to today'}
              </button>
              {moveToday.error && <span className="block">{errorText(moveToday.error)}</span>}
            </>
          ) : null
        }
        lockedMessage={early ? `For ${dueLabel(task.doDate, today)?.text.toLowerCase() ?? task.doDate}. Tick it on the day.` : wait > 0 ? `Ready in ${wait} ${wait === 1 ? 'minute' : 'minutes'}. Do it first, then tick it.` : null}
        marks={
          hasMarks || badge || steps ? (
            <>
              {badge}
              {steps}
              <TaskTags task={task} priority={false} />
            </>
          ) : null
        }
        // The time sits directly left of the pillar (2026-11-13, the founder), and the two wrap together.
        time={timeChip}
        corner={<PriorityChip priority={task.priority} filter />}
        foot={
          pillarTag ? (
            pillarPress ? (
              <button type="button" data-tag-filter="" aria-label={pillarPress.label} aria-describedby={TAG_FILTER_HINT_ID} aria-pressed={pillarPress.pressed} onClick={pillarPress.onPress} className={`${pillarClass} relative z-[1] cursor-pointer`} style={{ background: `var(--soft-${rel.key})`, color: `var(--deep-${rel.key})` }}>
                {rel.name}
              </button>
            ) : (
              <span className={pillarClass} style={{ background: `var(--soft-${rel.key})`, color: `var(--deep-${rel.key})` }}>
                {rel.name}
              </span>
            )
          ) : null
        }
        open={onEdit ? { onOpen: onEdit, label: editLabel ?? 'Edit', expanded: editOpen, controls: editControls, outside: true } : undefined}
      />
      {/* While the plan is open in place, its close stands outside the card and stays in view down the plan (RowClose, 2026-11-13); it
          comes right after the card in the page's order, so the keyboard meets it before the plan's fields. */}
      {onEdit && editOpen && <RowClose onClose={onEdit} label={`Close the plan for ${task.title}`} />}
      {panel}
    </motion.li>
  );
}
