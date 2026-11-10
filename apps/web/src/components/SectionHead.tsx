import type { ReactNode } from 'react';

/**
 * Section's heading on its own (the same markup as Section's, kept in step by hand), for a block that keeps its own wrapper and spacing:
 * Admin's tabs. Its own file, so Section in the first download does not grow.
 */
export function SectionHead({ id, title, lede, action }: { id: string; title: ReactNode; lede?: ReactNode; action?: ReactNode }) {
  return (
    // A button (anything rounded, with an edge) reaches past the one-line box it sits in, so beside one the line under the title keeps
    // to the title's column, and with no line the heading keeps 8px more under it, so the button never touches what follows.
    <div className={`group/sh grid grid-cols-[minmax(0,1fr)_auto] gap-x-sm ${lede ? '' : 'has-[>div_.rounded-pill]:pb-xs'}`}>
      <h2 id={id} className="min-w-0 text-title2">
        {title}
      </h2>
      {/* The action sits level with the title's first line, at the top of the block, never down by the line under it. Its box is one
          line of the title tall and centres on it, so a 44px link or button still has its full tap area. */}
      {action && <div className="col-start-2 row-start-1 flex h-[var(--text-title2--line-height)] shrink-0 items-center text-[24px] leading-none">{action}</div>}
      {/* Beside a link the line under the title takes the block's whole width, under the link too, so a long link ("See what's
          emerging") never squeezes it into a narrow column on a phone. */}
      {lede && <p className="col-span-full mt-xs m-0 text-balance text-subhead text-ink-soft group-has-[>div_.rounded-pill]/sh:col-span-1">{lede}</p>}
    </div>
  );
}
