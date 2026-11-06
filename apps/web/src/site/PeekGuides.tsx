import { RELATIONSHIPS } from '@kreators/shared';
import type { CSSProperties } from 'react';
import { Avatar } from '../components/Avatar';

/**
 * The seven guides peeking up from the foot of a page's closing call to action (the home's first, then /features and /7rp at the
 * founder's ask, 2026-11-06). Each is drawn whole and pushed down by `.peek-guide`; the card's own edge (overflow hidden, no bottom
 * padding) cuts them, so they seem to look up from below it. Decoration only.
 */
export function PeekGuides() {
  return (
    <div className="peek-row relative z-10 mt-lg flex justify-center gap-xs sm:gap-md" aria-hidden="true">
      {RELATIONSHIPS.map((r, i) => (
        // Each takes a seventh of the row up to 72px, so all seven fit a phone and none is cut at the side.
        <div key={r.key} className="peek-guide w-[12%] max-w-[72px]" style={{ '--peek-delay': `${i * 0.12}s` } as CSSProperties}>
          <Avatar relationship={r.key} size={72} mood={i % 2 ? 'happy' : 'excited'} decorative className="block h-auto w-full" />
        </div>
      ))}
    </div>
  );
}
