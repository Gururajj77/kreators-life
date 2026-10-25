import type { TrustScore } from '@kreators/shared';
import { useState } from 'react';
import { Ring } from './Ring';
import { Sheet } from './Sheet';

/**
 * How much a person has proved, as a ring and a word. Tap it and the sheet shows what it is made of:
 * xp, points, a best streak, time here, sales and honors. Nothing in it can be typed in.
 */
export function TrustBadge({ trust, onInk = false, size = 'md' }: { trust: TrustScore; onInk?: boolean; size?: 'sm' | 'md' }) {
  const [open, setOpen] = useState(false);
  const ring = size === 'sm' ? 32 : 40;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Trust ${trust.score} of 100, ${trust.label}. See what it is made of`}
        className={`toy toy-soft inline-flex min-h-[44px] items-center gap-xs rounded-pill px-sm text-[14px] font-bold ${onInk ? 'bg-on-ink/15 text-on-ink' : 'bg-paper text-ink'}`}
      >
        <Ring value={trust.score / 100} size={ring} stroke={4} color={onInk ? 'var(--color-on-ink)' : 'var(--color-r4)'} track={onInk ? 'color-mix(in oklab, var(--color-on-ink) 30%, transparent)' : 'var(--color-line)'} label="">
          <span className="font-display text-[12px] font-extrabold">{trust.score}</span>
        </Ring>
        {trust.label}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={`Trust ${trust.score} of 100`}>
        <p className="m-0 text-[14px] font-semibold text-ink-soft">{trust.label}. Built only from what this person has earned here, by showing up and doing the work. Nothing in it can be typed in.</p>
        <ul className="mt-md flex list-none flex-col gap-sm p-0 m-0 pb-xl">
          {trust.parts.map((p) => (
            <li key={p.label}>
              <div className="flex items-baseline justify-between gap-sm">
                <span className="text-[16px] font-bold">{p.label}</span>
                <span className="text-[14px] font-semibold text-ink-soft">{p.value}</span>
              </div>
              <span className="mt-xs block h-[8px] overflow-hidden rounded-pill bg-line" aria-hidden="true">
                <span className="block h-full rounded-pill bg-r4" style={{ width: `${p.score}%` }} />
              </span>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}
