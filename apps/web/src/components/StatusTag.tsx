import type { TagTone } from '@kreators/shared';

/** The colours a status wears: a pale wash, and a dot in the relationship colour. The word is always there, so colour is never the only sign. */
const TONE: Record<TagTone, { bg: string; dot: string }> = {
  neutral: { bg: 'var(--tint-brown)', dot: 'var(--color-ink-mute)' },
  info: { bg: 'var(--tint-sky)', dot: 'var(--color-r5)' },
  good: { bg: 'var(--tint-green)', dot: 'var(--color-r4)' },
  warn: { bg: 'var(--tint-yellow)', dot: 'var(--color-r3)' },
  bad: { bg: 'var(--tint-red)', dot: 'var(--color-r1)' },
};

/** A small status tag: a dot and a word on a pale wash. Used for the stage of a deliverable, a client's status, an invoice or an agreement. */
export function StatusTag({ tone, children, title }: { tone: TagTone; children: string; title?: string }) {
  const t = TONE[tone];
  return (
    <span title={title} className="inline-flex shrink-0 items-center gap-xs rounded-pill px-sm text-[12px] font-extrabold leading-[24px] text-ink" style={{ background: t.bg }}>
      <span aria-hidden="true" className="inline-block size-[8px] rounded-pill" style={{ background: t.dot }} />
      {children}
    </span>
  );
}
