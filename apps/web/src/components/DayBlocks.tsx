import { RELATIONSHIP_BY_KEY, blockTimeLabel, dayBlocks, minutesLabel2, type Node } from '@kreators/shared';
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
export function DayBlocks({ tasks }: { tasks: readonly Node[] }) {
  const d = dayBlocks(tasks);
  if (d.blocks.length === 0) return null;
  const byId = new Map(tasks.map((t) => [t.id, t]));
  return (
    <div role="group" className="mt-md" aria-labelledby="blocks-heading">
      <h3 id="blocks-heading" className="text-[16px]">
        {COPY.title}
      </h3>
      <p className="mt-xs m-0 text-[12px] font-bold text-ink-soft">{COPY.lede}</p>
      <ol className="mt-xs flex list-none flex-col gap-xs p-0 m-0" aria-label={COPY.title}>
        {d.blocks.map((b, i) => {
          const gap = i > 0 ? d.free.find((f) => f.end === b.start) : undefined;
          const rel = RELATIONSHIP_BY_KEY[byId.get(b.id)?.relationship ?? 'self'];
          return (
            <li key={b.id} className="flex list-none flex-col gap-xs">
              {gap && (
                <p className="m-0 rounded-tile border-2 border-dashed border-line px-sm py-xs text-[12px] font-bold text-ink-mute">
                  {COPY.free} {minutesLabel2(gap.end - gap.start)}, {blockTimeLabel(gap.start)} to {blockTimeLabel(gap.end)}
                </p>
              )}
              <div className="flex items-stretch gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
                <span className="w-[6px] shrink-0 self-stretch rounded-pill" style={{ background: rel.color }} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="m-0 text-[12px] font-extrabold uppercase tracking-wide text-ink-soft">
                    {blockTimeLabel(b.start)} to {blockTimeLabel(b.end)}, {minutesLabel2(b.end - b.start)}
                  </p>
                  <p className="m-0 text-[16px] font-bold leading-snug">
                    <Inert text={b.title} />
                  </p>
                </div>
                {b.overlaps && <StatusTag tone="warn">{COPY.overlaps}</StatusTag>}
              </div>
            </li>
          );
        })}
      </ol>
      {d.untimed > 0 && <p className="mt-xs m-0 text-[12px] font-bold text-ink-soft">{d.untimed === 1 ? '1 task has no time yet.' : `${d.untimed} tasks have no time yet.`}</p>}
    </div>
  );
}
