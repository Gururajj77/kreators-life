import { FACT_KIND_META, type FactKind, type IconName, type TagTone } from '@kreators/shared';
import { AppIcon } from './AppIcon';
import { StatusTag } from './StatusTag';

/**
 * A fact on a card, wearing what it means: a price is yellow with coins, free is green with a gift, a place is orange
 * with a map, online is sky with a globe, a day is indigo with a calendar. Built on `StatusTag`, so a fact and a status
 * are one vocabulary. The icon is decorative; the word is always there.
 */
export function FactTag({ kind, children, title, fit, className }: { kind: FactKind; children: string; title?: string; fit?: boolean; className?: string }) {
  const m = FACT_KIND_META[kind];
  return (
    <StatusTag tone={m.tone} title={title ?? (fit ? `${m.name}: ${children}` : m.name)} fit={fit} className={className} mark={<AppIcon name={m.icon} size={12} />}>
      {children}
    </StatusTag>
  );
}

/** A tag with its own tone and icon, for a mark that is not a listing fact (Featured, Not live, a reaction count). */
export function IconTag({ tone, icon, children, title, fit, className }: { tone: TagTone; icon: IconName; children: string; title?: string; fit?: boolean; className?: string }) {
  return (
    <StatusTag tone={tone} title={title} fit={fit} className={className} mark={<AppIcon name={icon} size={12} />}>
      {children}
    </StatusTag>
  );
}
