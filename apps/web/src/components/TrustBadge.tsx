import type { TrustScore } from '@kreators/shared';
import { useId, useState, type KeyboardEvent } from 'react';
import { Ring } from './Ring';
import { ToggleChevron } from './ToggleMark';

/**
 * How much a person has proved, as a ring and a word. Tap it and what it is made of folds out right under it (xp, points, a best
 * streak, time here, sales and honors), in the page itself, never a sheet: it sits inside the listing sheet too, and a sheet over a
 * sheet is what the founder asked to be rid of (2026-11-06). Escape folds it back. Nothing in it can be typed in.
 */
export function TrustBadge({ trust, onInk = false, size = 'md' }: { trust: TrustScore; onInk?: boolean; size?: 'sm' | 'md' }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const ring = size === 'sm' ? 32 : 40;
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && open) {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    }
  };
  return (
    <div className="trust-badge inline-flex max-w-full flex-col items-start" data-open={open ? '' : undefined} onKeyDown={onKey}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={id}
        aria-label={`Trust ${trust.score} of 100, ${trust.label}. See what it is made of`}
        className={`toy toy-soft inline-flex min-h-[36px] md:min-h-[44px] tap-pad items-center gap-xs rounded-pill px-sm text-subhead font-medium ${onInk ? 'bg-on-ink/15 text-on-ink' : 'bg-paper text-ink'}`}
      >
        <Ring value={trust.score / 100} size={ring} stroke={4} color={onInk ? 'var(--color-on-ink)' : 'var(--color-r4)'} track={onInk ? 'color-mix(in oklab, var(--color-on-ink) 30%, transparent)' : 'var(--color-line)'} label="">
          <span className="text-caption font-semibold">{trust.score}</span>
        </Ring>
        {trust.label}
        <ToggleChevron open={open} size={14} />
      </button>
      {open && (
        <div id={id} role="region" aria-label={`Trust ${trust.score} of 100`} className="trust-badge-panel mt-xs w-[300px] max-w-[calc(100vw-64px)] rounded-tile bg-card-strong p-sm text-left text-ink shadow-toy-soft">
          <p className="m-0 text-headline">Trust {trust.score} of 100</p>
          <p className="mt-xs m-0 text-footnote text-ink-soft">{trust.label}. Built only from what this person earned here, by showing up and doing the work. Nothing in it can be typed in.</p>
          <ul className="mt-sm m-0 flex list-none flex-col gap-sm p-0">
            {trust.parts.map((p) => (
              <li key={p.label}>
                <div className="flex items-baseline justify-between gap-sm">
                  <span className="text-subhead font-semibold">{p.label}</span>
                  <span className="text-footnote text-ink-soft">{p.value}</span>
                </div>
                <span className="mt-xs block h-[8px] overflow-hidden rounded-pill bg-line" aria-hidden="true">
                  <span className="block h-full rounded-pill bg-r4" style={{ width: `${p.score}%` }} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
