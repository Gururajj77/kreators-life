import type { CSSProperties, ReactNode } from 'react';
import { BUMLING, characterTitle, type Host } from '@kreators/shared';
import { m as motion } from 'motion/react';
import { Avatar, type Mood } from '../components/Avatar';
import { useRise } from './SevenRP';

/**
 * A guide steps in and says one plain line, so the public pages read like a conversation, not a brochure. The guide sits on the
 * left or the right (alternate them down a page), out in the page's margin on a wide screen, its name and role under it, the line
 * written by hand in a drawn blob pointing at it.
 * The line is the app's own voice: what the app does, never a made-up quote from a person.
 */
export function GuideLine({
  host,
  side = 'left',
  mood = 'happy',
  size = 72,
  children,
  className = '',
}: {
  host: Host;
  side?: 'left' | 'right';
  mood?: Mood;
  /** The guide's size in px: 72 beside a section, bigger where the guide is the one picture in a header. */
  size?: number;
  children: ReactNode;
  className?: string;
}) {
  const rise = useRise();
  const right = side === 'right';
  const col = Math.max(88, size + 16);
  // On a phone a big guide (128 in a feature page's header) left the hand-written line about 100px, one word a line; there the guide
  // is held to 72 and its column to 88, so the line keeps room to wrap evenly.
  const phoneSize = Math.min(size, 72);
  const phoneCol = Math.min(col, 88);
  // The speaker's own colour (one of the seven), or a quiet grey for Bumling, who is no pillar: the blob's line and a whisper of its fill.
  const tone = host === BUMLING.key ? 'var(--color-ink-mute)' : `var(--color-r${host === 'servant_leader' ? 1 : host === 'friendship' ? 2 : host === 'parent_child' ? 3 : host === 'lover_partner' ? 4 : host === 'self' ? 5 : host === 'guru' ? 6 : 7})`;
  return (
    // The guide stands out in the page's margin on a wide screen (inside the column on a phone), its name under it, and its line is
    // written by hand inside a drawn blob beside it: speech, never a control (no edge of a button, no fill of a card, no hover).
    <motion.figure
      {...rise}
      className={`guide-line m-0 grid items-center gap-x-md gap-y-xs ${right ? 'guide-right grid-cols-[minmax(0,1fr)_var(--gc-sm)] sm:grid-cols-[minmax(0,1fr)_var(--gc)]' : 'guide-left grid-cols-[var(--gc-sm)_minmax(0,1fr)] sm:grid-cols-[var(--gc)_minmax(0,1fr)]'} ${className}`}
      style={{ '--gc': `${col}px`, '--gc-sm': `${phoneCol}px`, '--av-sm': `${phoneSize}px` } as CSSProperties}
    >
      <div className={`guide-who row-start-1 flex justify-center ${right ? 'col-start-2' : 'col-start-1'}`}>
        <Avatar relationship={host} size={size} mood={mood} decorative className="h-auto max-w-[var(--av-sm)] sm:max-w-none" />
      </div>
      <figcaption className={`guide-who row-start-2 self-start text-center text-caption font-medium text-ink-mute ${right ? 'col-start-2' : 'col-start-1'}`}>{characterTitle(host)}</figcaption>
      <blockquote
        className={`guide-blob relative row-start-1 m-0 max-w-[560px] px-md py-sm text-balance sm:px-lg sm:py-md ${right ? 'col-start-1 justify-self-end' : 'col-start-2 justify-self-start'}`}
        style={{ color: tone }}
      >
        {/* A hand-drawn blob: an uneven loop stretched to the words, its line in the speaker's colour, a whisper of fill, and a little
            curl pointing at the guide. */}
        <svg aria-hidden="true" viewBox="0 0 400 160" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
          <path
            d="M34 22 C96 2 214 6 300 12 C366 17 394 44 392 82 C390 124 352 150 268 154 C170 158 82 160 40 140 C8 124 2 92 8 62 C12 40 18 28 34 22 Z"
            fill="currentColor"
            fillOpacity="0.07"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path d={right ? 'M392 92 C404 98 412 106 418 118' : 'M8 92 C-4 98 -12 106 -18 118'} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="sr-only text-ink">{characterTitle(host)} says: </span>
        <span className="guide-hand relative block text-ink">{children}</span>
      </blockquote>
    </motion.figure>
  );
}
