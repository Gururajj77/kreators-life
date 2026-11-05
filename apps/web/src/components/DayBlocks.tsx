import { RELATIONSHIP_BY_KEY, blockTimeLabel, dayBlocks, minutesLabel2, type FocusRoundRow, type Node } from '@kreators/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { todayLocal } from '../lib/date';
import { useSession } from '../lib/store';
import { Inert } from './Inert';
import { StatusTag } from './StatusTag';

const COPY = {
  title: 'Time blocks',
  lede: 'Your timed tasks laid out as the day runs, with the free time between them.',
  free: 'Free',
  overlaps: 'Overlaps',
} as const;

/**
 * The day as blocks: the tasks that have a time, each as long as its estimate (thirty minutes when it has none), in order, with the free
 * stretches between them. Only for a day with at least one timed task. A block is read-only: a task's time is changed in its own plan panel.
 */
export function DayBlocks({ tasks, sessions }: { tasks: readonly Node[]; /** Today's finished focus sessions; read here when not given. */ sessions?: readonly Pick<FocusRoundRow, 'nodeId' | 'minutes' | 'createdAt'>[] }) {
  const d = dayBlocks(tasks);
  const token = useSession((st) => st.token);
  const day = todayLocal();
  // The same query the focus panel's Today list reads, so a session finished there shows here at once.
  const own = useQuery({ queryKey: ['focus-today', day], queryFn: () => api.focusToday(day), enabled: Boolean(token) && sessions === undefined && d.blocks.length > 0, staleTime: 30_000 });
  if (d.blocks.length === 0) return null;
  const byId = new Map(tasks.map((t) => [t.id, t]));
  // Minutes already focused on each task today: a faint bar beside its block, read-only.
  const focused = new Map<string, number>();
  for (const r of sessions ?? own.data?.rounds ?? []) if (r.nodeId) focused.set(r.nodeId, (focused.get(r.nodeId) ?? 0) + r.minutes);
  return (
    <div role="group" className="mt-md" aria-labelledby="blocks-heading">
      <h3 id="blocks-heading" className="text-headline">
        {COPY.title}
      </h3>
      <p className="mt-xs m-0 text-caption text-ink-soft">{COPY.lede}</p>
      <ol className="mt-sm flex list-none flex-col gap-xs p-0 m-0" aria-label={COPY.title}>
        {d.blocks.map((b, i) => {
          const gap = i > 0 ? d.free.find((f) => f.end === b.start) : undefined;
          const rel = RELATIONSHIP_BY_KEY[byId.get(b.id)?.relationship ?? 'self'];
          return (
            <li key={b.id} className="flex list-none flex-col gap-xs">
              {gap && (
                <p className="m-0 rounded-tile border-2 border-dashed border-line px-sm py-xs text-caption text-ink-mute">
                  {COPY.free} {minutesLabel2(gap.end - gap.start)}, {blockTimeLabel(gap.start)} to {blockTimeLabel(gap.end)}
                </p>
              )}
              <div className="flex items-stretch gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
                <span className="w-[6px] shrink-0 self-stretch rounded-pill" style={{ background: rel.color }} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="m-0 text-eyebrow uppercase text-ink-soft">
                    {blockTimeLabel(b.start)} to {blockTimeLabel(b.end)}, {minutesLabel2(b.end - b.start)}
                  </p>
                  <p className="m-0 text-headline">
                    <Inert text={b.title} />
                  </p>
                  {focused.has(b.id) && (
                    <div className="mt-xs flex items-center gap-xs" data-focused={focused.get(b.id)}>
                      <span className="h-[6px] min-w-0 flex-1 overflow-hidden rounded-pill bg-line" aria-hidden="true">
                        <span className="block h-full rounded-pill opacity-50" style={{ width: `${Math.min(100, Math.round(((focused.get(b.id) ?? 0) / Math.max(1, b.end - b.start)) * 100))}%`, background: rel.color }} />
                      </span>
                      <span className="shrink-0 text-caption text-ink-soft">Focused {minutesLabel2(focused.get(b.id) ?? 0)}</span>
                    </div>
                  )}
                </div>
                {b.overlaps && <StatusTag tone="warn">{COPY.overlaps}</StatusTag>}
              </div>
            </li>
          );
        })}
      </ol>
      {d.untimed > 0 && <p className="mt-xs m-0 text-caption text-ink-soft">{d.untimed === 1 ? '1 task has no time yet.' : `${d.untimed} tasks have no time yet.`}</p>}
    </div>
  );
}
