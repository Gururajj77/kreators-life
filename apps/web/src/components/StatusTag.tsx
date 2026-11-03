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
export function StatusTag({ tone, children, title, mark, className = '' }: { tone: TagTone; children: ReactNode; title?: string; mark?: ReactNode; className?: string }) {
  const t = TONE[tone];
  return (
    <span title={title} className={`tag inline-flex shrink-0 items-center gap-xs rounded-pill px-sm text-[12px] font-extrabold leading-[24px] text-ink ${className}`} style={{ background: t.bg }}>
      {mark ? (
        <span aria-hidden="true" className="inline-flex" style={{ color: t.ink }}>
          {mark}
        </span>
      ) : (
        <span aria-hidden="true" className="inline-block size-[8px] rounded-pill" style={{ background: t.dot }} />
      )}
      {children}
    </span>
  );
}
