import { RELATIONSHIP_BY_KEY, repeatLabel, taskIsHabit, type Node } from '@kreators/shared';
import { clockOf, shortDay } from '../lib/date';
import { Button } from './Button';
import { FactTag } from './FactTag';
import { PriorityChip } from './TaskPlan';
import { StatusTag } from './StatusTag';

/** A task as the coach sees it: the title, its plan, whether a coach added it, and a way to change it while it is open. */
export function TaskLine({ t, onEdit, today }: { t: Node; onEdit?: () => void; today?: string }) {
  const day = t.doDate ?? t.dueDate;
  const when = day ? `${shortDay(day)}${t.dueTime ? `, ${clockOf(t.dueTime)}` : ''}` : null;
  const late = today && t.status === 'active' && t.dueDate && t.dueDate < today;
  const open = t.status === 'active';
  const hasFoot = t.fromCoach || when !== null || t.repeat || t.priority !== null || (onEdit && open);
  return (
    <li data-pillar={t.relationship} className="rounded-tile bg-card p-sm shadow-toy-soft">
      <div className="flex items-start gap-xs">
        <span className="mt-xs size-[12px] shrink-0 rounded-pill" style={{ background: RELATIONSHIP_BY_KEY[t.relationship].color }} aria-hidden="true" />
        <span className={`min-w-0 flex-1 text-subhead font-semibold ${t.status === 'done' ? 'text-ink-soft line-through' : ''}`}>{t.title}</span>
        <PriorityChip priority={t.priority} />
      </div>
      {hasFoot && (
        <div className="mt-xs flex items-end justify-between gap-xs">
          <span className="fill-row flex min-w-0 flex-1 flex-wrap items-center justify-end gap-xs">
            {t.status === 'done' && <StatusTag tone="good">Done</StatusTag>}
            {late && <StatusTag tone="warn">Overdue</StatusTag>}
            {t.repeat && <StatusTag tone="calm">{taskIsHabit(t) ? 'Habit' : repeatLabel(t.repeat)}</StatusTag>}
            {t.fromCoach && <StatusTag tone="deep">From a coach</StatusTag>}
            {when && <FactTag kind="when">{when}</FactTag>}
          </span>
          {onEdit && open && (
            <Button size="sm" variant="ghost" className="shrink-0" onClick={onEdit}>
              Change
            </Button>
          )}
        </div>
      )}
    </li>
  );
}
