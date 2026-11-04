import type { ReactNode } from 'react';

/**
 * A card's first row with its tag in the top right corner (2026-11-04): an optional lead (an icon tile), the title,
 * which keeps the rest of the row so it never runs under the tag, and the tag group, held to half the row and lined up
 * with the first line. Use it only where the corner serves nothing else; pass tags with `fit` so a long one truncates
 * with its full words in `title`. With no tag it is just the title (and the lead).
 */
export function CardHead({ tag, lead, className = '', children }: { tag?: ReactNode; lead?: ReactNode; className?: string; children?: ReactNode }) {
  return (
    <div className={`flex items-start justify-between gap-xs ${className}`}>
      {lead != null && lead !== false && <div className="shrink-0">{lead}</div>}
      <div className="min-w-0 flex-1">{children}</div>
      {tag != null && tag !== false && <div className="flex min-w-0 max-w-[50%] shrink-0 flex-wrap justify-end gap-xs">{tag}</div>}
    </div>
  );
}
