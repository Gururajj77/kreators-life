import { projectPace, type PaceStatus, type TagTone } from '@kreators/shared';
import { StatusTag } from './StatusTag';

const TONE: Record<Exclude<PaceStatus, 'none'>, TagTone> = { on: 'good', slipping: 'warn', behind: 'bad' };

/**
 * Whether a project is moving as fast as its due day needs: a status tag and one plain line. With `hint` set, a project that has no pace yet
 * (no due day, no tasks) gets one quiet line saying what to add, instead of nothing.
 */
export function PaceTag({ created, dueDate, done, total, today, hint = false }: { created: string; dueDate: string | null; done: number; total: number; today: string; hint?: boolean }) {
  const p = projectPace(created, dueDate, done, total, today);
  if (p.status === 'none') return hint ? <span className="mt-xs block text-[12px] font-semibold text-ink-mute">{p.line}</span> : null;
  return (
    <span className="mt-xs flex flex-wrap items-center gap-xs">
      <StatusTag tone={TONE[p.status]}>{p.label}</StatusTag>
      <span className="text-[12px] font-semibold text-ink-soft">{p.line}</span>
    </span>
  );
}
