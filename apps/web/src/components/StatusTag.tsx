import type { ReactNode } from 'react';
import type { TagTone } from '@kreators/shared';

/**
 * The colours a tag wears: a pale wash, and a dot (or a small icon) in the relationship colour. The word is always
 * there, so colour is never the only sign. The five status tones say how something stands; `calm`, `warm` and `deep`
 * are for tags that are facts, not states (a day, a place, places left).
 */
export const TONE: Record<TagTone, { bg: string; dot: string; ink: string }> = {
  neutral: { bg: 'var(--tint-brown)', dot: 'var(--color-ink-mute)', ink: 'var(--deep-earth)' },
  info: { bg: 'var(--tint-sky)', dot: 'var(--color-r5)', ink: 'var(--deep-self)' },
  good: { bg: 'var(--tint-green)', dot: 'var(--color-r4)', ink: 'var(--deep-lover_partner)' },
  warn: { bg: 'var(--tint-yellow)', dot: 'var(--color-r3)', ink: 'var(--deep-parent_child)' },
  bad: { bg: 'var(--tint-red)', dot: 'var(--color-r1)', ink: 'var(--deep-servant_leader)' },
  calm: { bg: 'var(--tint-indigo)', dot: 'var(--color-r6)', ink: 'var(--deep-guru)' },
  warm: { bg: 'var(--tint-orange)', dot: 'var(--color-r2)', ink: 'var(--deep-friendship)' },
  deep: { bg: 'var(--tint-purple)', dot: 'var(--color-r7)', ink: 'var(--deep-divine)' },
};

/**
 * A small tag: a dot and a word on a pale wash. Used for the stage of a deliverable, a client's status, an invoice or
 * an agreement, and (through `FactTag`) for every fact on a card. `mark` replaces the dot with a small icon.
 */
export function StatusTag({ tone, children, title, mark, fit = false, className = '' }: { tone: TagTone; children: ReactNode; title?: string; mark?: ReactNode; /** Lets a long tag truncate to one line, its full words in `title` (a tag in a card's corner). */ fit?: boolean; className?: string }) {
  const t = TONE[tone];
  const tip = title ?? (fit && typeof children === 'string' ? children : undefined);
  return (
    <span title={tip} className={`tag inline-flex items-center gap-xs rounded-pill px-sm text-caption font-medium leading-[24px] text-ink ${fit ? 'min-w-0 max-w-full shrink' : 'shrink-0'} ${className}`} style={{ background: t.bg }}>
      {mark ? (
        <span aria-hidden="true" className="inline-flex shrink-0" style={{ color: t.ink }}>
          {mark}
        </span>
      ) : (
        <span aria-hidden="true" className="inline-block size-[8px] shrink-0 rounded-pill" style={{ background: t.dot }} />
      )}
      {fit ? <span className="min-w-0 truncate">{children}</span> : children}
    </span>
  );
}
