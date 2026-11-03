import type { ReactNode } from 'react';
import { characterTitle, type Host } from '@kreators/shared';
import { motion } from 'motion/react';
import { Avatar, type Mood } from '../components/Avatar';
import { useRise } from './SevenRP';

/**
 * A guide steps in and says one plain line, so the public pages read like a conversation, not a brochure. The guide sits on the
 * left or the right (alternate them down a page), its name and role under it, the line in a speech bubble pointing at it.
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
  return (
    <motion.figure {...rise} className={`m-0 flex items-end gap-sm ${right ? 'flex-row-reverse' : ''} ${className}`}>
      <div className="flex shrink-0 flex-col items-center" style={{ width: Math.max(88, size + 16) }}>
        <Avatar relationship={host} size={size} mood={mood} decorative />
        <figcaption className="mt-xs text-center text-[12px] leading-tight font-bold text-ink-mute">{characterTitle(host)}</figcaption>
      </div>
      <blockquote className={`relative m-0 mb-lg max-w-[520px] rounded-card bg-card-strong px-md py-sm text-[18px] leading-snug font-bold text-balance shadow-toy-soft ${right ? 'rounded-br-[8px]' : 'rounded-bl-[8px]'}`}>
        <span className="sr-only">{characterTitle(host)} says: </span>
        {children}
      </blockquote>
    </motion.figure>
  );
}
