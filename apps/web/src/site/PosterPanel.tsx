import type { ReactNode } from 'react';
import { RELATIONSHIP_BY_KEY, type RelationshipKey } from '@kreators/shared';
import { Avatar, type Mood } from '../components/Avatar';

/**
 * A poster: a coloured fill (the pillar's gradient), a bold two-part headline whose second half is quieter, a soft wave across the
 * lower third and the pillar's guide peeking up from the bottom edge. Everything on the fill reads `--color-on-fill`, which app.css
 * turns dark on orange and yellow, as the contrast rule says. Use it as the half of a card that catches the eye; the reading text sits beside it on the card.
 */
export function PosterPanel({ pillar, title, quiet, mood = 'happy', children, className = '' }: { pillar: RelationshipKey; title: ReactNode; quiet?: ReactNode; mood?: Mood; children?: ReactNode; className?: string }) {
  const r = RELATIONSHIP_BY_KEY[pillar];
  return (
    <div className={`relative isolate flex min-h-[260px] flex-col overflow-hidden rounded-tile p-md bg-r${r.floor} text-on-fill ${className}`}>
      <p className="relative z-10 m-0 type-hook text-display-3 leading-[1.05]">
        {title}
        {quiet && (
          <>
            {' '}
            <span className="block opacity-75">{quiet}</span>
          </>
        )}
      </p>
      <svg className="pointer-events-none absolute inset-x-0 bottom-0 -z-0 h-[45%] w-full" viewBox="0 0 200 90" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 40 C40 10 80 60 120 34 C150 16 180 22 200 30 L200 90 L0 90 Z" fill="currentColor" opacity="0.14" />
        <path d="M0 62 C50 44 90 80 140 58 C170 46 190 52 200 56 L200 90 L0 90 Z" fill="currentColor" opacity="0.1" />
      </svg>
      {/* The foot: the label lined up at the bottom left (the card rule: words at the top, facts at the foot), the guide peeking up at the
          bottom right, so a poster stretched beside a long list keeps something at both ends instead of words floating at the top. */}
      <div className="relative z-10 mt-auto flex items-end justify-between gap-sm pt-md">
        {children ? <div className="min-w-0 pb-xs text-subhead font-medium opacity-90">{children}</div> : <span />}
        <div className="-mb-xl -mr-xs shrink-0" aria-hidden="true">
          <Avatar relationship={pillar} size={132} mood={mood} still />
        </div>
      </div>
    </div>
  );
}
