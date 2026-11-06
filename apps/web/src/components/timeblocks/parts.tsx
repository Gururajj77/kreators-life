import { LIFE_AREAS, RELATIONSHIP_BY_KEY, slotLength, slotOrder, slotRangeLabel, spanLabel, type LifeAreaKey, type RelationshipKey, type TemplateSlot, type TimeBlock, type BlockColor } from '@kreators/shared';
import { tbClass, tbStyle } from '../../lib/blockColor';

// The refresh after a time-blocks write lives in lib/timeBlocksRefresh.ts (Daily's picker uses it too); passed on here.
export { useTimeBlocksRefresh } from '../../lib/timeBlocksRefresh';

/** The free stretches of a day (15 minutes or more) that no slot covers, each from its start; midnight is crossed like a slot. */
export function freeRuns(slots: readonly TemplateSlot[]): { start: number; end: number }[] {
  const cov = new Uint8Array(1440);
  for (const s of slots) {
    const n = slotLength(s);
    for (let m = 0; m < n; m++) cov[(s.start + m) % 1440] = 1;
  }
  const first = cov.indexOf(1);
  if (first < 0) return [{ start: 0, end: 0 }];
  const runs: { start: number; end: number }[] = [];
  let i = 0;
  while (i < 1440) {
    if (cov[(first + i) % 1440]) {
      i++;
      continue;
    }
    let j = i;
    while (j < 1440 && !cov[(first + j) % 1440]) j++;
    if (j - i >= 15) runs.push({ start: (first + i) % 1440, end: (first + j) % 1440 });
    i = j;
  }
  return runs;
}

/** A small tag in a pillar's soft colour (the pillar tag every task row wears). */
export function PillarTag({ pillar, lead = '' }: { pillar: RelationshipKey; lead?: string }) {
  const rel = RELATIONSHIP_BY_KEY[pillar];
  return (
    <span className="inline-flex min-h-[24px] items-center rounded-pill px-xs text-caption font-medium whitespace-nowrap" style={{ background: `var(--soft-${pillar})`, color: `var(--deep-${pillar})` }}>
      {lead}
      {rel.name}
    </span>
  );
}

/** A small neutral tag for an area of life. */
export function AreaTag({ area }: { area: LifeAreaKey }) {
  return <span className="inline-flex min-h-[24px] items-center rounded-pill bg-line px-xs text-caption font-medium whitespace-nowrap text-ink-soft">{LIFE_AREAS[area].name}</span>;
}

/**
 * A template's book source with every page group kept whole: "p. 168" and a range like "197–198" are each a nowrap span, so a line
 * never breaks after "197–" (the founder, 2026-11-06). The words between still wrap as usual.
 */
export function SourceText({ text }: { text: string }) {
  const parts = text.split(/(pp?\. \d+(?:–\d+)?|\d+–\d+)/);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <span key={i} className="whitespace-nowrap">
            {p}
          </span>
        ) : (
          p
        ),
      )}
    </>
  );
}

/** A block's dot and name, the mark a task wears in a block. */
export function BlockName({ block }: { block: Pick<TimeBlock, 'name' | 'color'> }) {
  return (
    <span className={`${tbClass(block.color)} inline-flex min-w-0 items-center gap-xs`} style={tbStyle(block.color)}>
      <span className="tb-dot" aria-hidden="true" />
      <span className="min-w-0">{block.name}</span>
    </span>
  );
}

/**
 * A template's day as one strip, midnight to midnight, each slot a part in its block's colour (a slot over midnight is two parts).
 * Decoration only: the slots are read out as text for screen readers.
 */
export function DayStrip({ slots, blocks, className = '' }: { slots: readonly TemplateSlot[]; blocks: ReadonlyMap<string, TimeBlock>; className?: string }) {
  const parts: { key: string; color: BlockColor; left: number; width: number }[] = [];
  slots.forEach((s, i) => {
    const color = blocks.get(s.blockId)?.color ?? 'slate';
    const len = slotLength(s);
    const first = Math.min(len, 1440 - s.start);
    parts.push({ key: `${i}a`, color, left: s.start, width: first });
    if (len > first) parts.push({ key: `${i}b`, color, left: 0, width: len - first });
  });
  const said = slotOrder(slots)
    .map((s) => `${blocks.get(s.blockId)?.name ?? 'A block'} ${slotRangeLabel(s)}`)
    .join(', ');
  return (
    <>
      <div className={`tb-strip ${className}`} aria-hidden="true">
        {parts.map((p) => (
          <span key={p.key} className={tbClass(p.color)} style={tbStyle(p.color, { left: `${(p.left / 1440) * 100}%`, width: `${(p.width / 1440) * 100}%` })} />
        ))}
      </div>
      <span className="sr-only">{said ? `The day: ${said}.` : 'No blocks yet.'}</span>
    </>
  );
}

/** The day as a list in clock order: each slot with its colour band, name, times, length and tag, and the free stretches between. */
export function DayTimeline({ slots, blocks }: { slots: readonly TemplateSlot[]; blocks: ReadonlyMap<string, TimeBlock> }) {
  const items = [
    ...slots.map((s, i) => ({ key: `s${i}`, start: s.start, slot: s })),
    ...freeRuns(slots).map((r, i) => ({ key: `f${i}`, start: r.start, free: r })),
  ].sort((a, b) => a.start - b.start);
  if (slots.length === 0) return <p className="m-0 text-subhead text-ink-soft">No blocks on this day yet. Edit its template below to add some.</p>;
  return (
    <ol className="m-0 flex list-none flex-col gap-xs p-0">
      {items.map((it) => {
        if ('free' in it && it.free) {
          return (
            <li key={it.key} className="flex items-center gap-sm rounded-tile border border-dashed border-line px-sm py-xs">
              <span className="text-subhead text-ink-soft">Free</span>
              <span className="ml-auto text-footnote text-ink-soft">
                <span className="whitespace-nowrap">{slotRangeLabel(it.free)}</span> · {spanLabel(slotLength(it.free))}
              </span>
            </li>
          );
        }
        const s = (it as { slot: TemplateSlot }).slot;
        const b = blocks.get(s.blockId);
        return (
          <li key={it.key} className={`tb-box ${tbClass(b?.color, 'tb-slate')} flex gap-sm rounded-tile px-sm py-sm`} style={tbStyle(b?.color)}>
            <span className="tb-band" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block text-headline">{b?.name ?? 'A block'}</span>
              <span className="mt-[2px] block text-footnote text-ink-soft">
                <span className="whitespace-nowrap">{slotRangeLabel(s)}</span> · {spanLabel(slotLength(s))}
                {b?.tag ? ` · ${b.tag}` : ''}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
