import { useRef } from 'react';
import { X } from 'lucide-react';
import { focusHeadingAfter } from '../lib/focusHeading';
import type { TagChip } from '../lib/taskTagFilter';
import { Icon } from './Icon';

/** The chip's look: BacklogTask's day pills on Daily, so a chip is no new look. */
const PILL = 'toy toy-soft inline-flex min-h-[36px] md:min-h-[44px] tap-pad items-center justify-center gap-xs rounded-pill border-2 border-line bg-card px-sm text-subhead font-medium';

/**
 * The filters that are on, above a task list (2026-11-13, the founder: tap a tag to filter this list): one removable chip each ("Remember ✕"),
 * and with two or more a last "Clear filters". Each chip keeps its own width from the left (2026-11-13 gate: filled, one chip ran the
 * column's whole width and read as a bar, not a chip); with Clear filters too, a phone fills each line (`fill-row`), so it never
 * wraps onto a line alone. After an X the
 * keyboard's place moves to the next chip, else the one before, else the list's heading (`heading`, its id), never the page.
 */
export function TagChips({ chips, onRemove, onClear, heading }: { chips: readonly TagChip[]; onRemove: (chip: TagChip) => void; onClear: () => void; heading: string }) {
  const box = useRef<HTMLDivElement>(null);
  if (chips.length === 0) return null;
  const focusAfter = (index: number, left: number) => {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const buttons = [...(box.current?.querySelectorAll<HTMLButtonElement>('button[data-chip]') ?? [])];
        const next = buttons[Math.min(index, buttons.length - 1)];
        if (left > 0 && next) next.focus({ preventScroll: true });
        else focusHeadingAfter(heading);
      }),
    );
  };
  return (
    <div ref={box} role="group" aria-label="Filters" className={`mt-xs flex flex-wrap gap-xs ${chips.length > 1 ? 'fill-row' : ''}`}>
      {chips.map((c, i) => (
        <button
          key={c.token}
          type="button"
          data-chip=""
          aria-label={`Remove filter: ${c.words}`}
          onClick={() => {
            onRemove(c);
            focusAfter(i, chips.length - 1);
          }}
          className={PILL}
        >
          <span>{c.words}</span>
          <Icon icon={X} size={16} />
        </button>
      ))}
      {chips.length > 1 && (
        <button
          type="button"
          onClick={() => {
            onClear();
            focusHeadingAfter(heading);
          }}
          className={PILL}
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
