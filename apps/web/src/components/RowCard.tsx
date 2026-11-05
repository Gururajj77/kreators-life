import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { CardHead } from './CardHead';
import { Icon } from './Icon';
import { tie } from '../lib/text';
import './fx/spotlight';

/**
 * One thing in a list, placed the way every card in the app is (the founder's card rules, 2026-11-05): the words start at the top
 * left (an optional lead, like an icon tile or a face, before them), a mark sits in the top right corner (`corner`), the facts line up
 * at the card's foot on the left (`facts`; tags keep their own width on one line and fill each line once they wrap, so none stands alone) and the main action sits at the bottom right:
 * `action` when there is a button, else an arrow that nudges on hover when the whole card is a link (`to`) or a button (`onClick`).
 * A string title keeps its last two words together (`tie`), so it never ends on one word. The card fills its cell (`h-full`), so cards in one row put their tags and actions at the same height. A pointer spotlight follows
 * a mouse; nothing moves under reduced motion.
 */
export function RowCard({
  to,
  onClick,
  label,
  lead,
  title,
  sub,
  corner,
  facts,
  action,
  children,
  className = '',
  titleClass = 'text-card-title',
}: {
  to?: string;
  onClick?: () => void;
  /** The card's accessible name when it is a link or a button and the visible words are not enough. */
  label?: string;
  lead?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  corner?: ReactNode;
  facts?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
  titleClass?: string;
}) {
  const tappable = Boolean(to || onClick);
  const hasFacts = Array.isArray(facts) ? facts.some(Boolean) : Boolean(facts);
  const body = (
    <>
      <CardHead lead={lead} tag={corner}>
        <span className={`block text-balance ${titleClass}`}>{typeof title === 'string' ? tie(title) : title}</span>
        {sub && <span className="block text-card-note text-ink-soft">{sub}</span>}
      </CardHead>
      {children}
      {(hasFacts || action || tappable) && (
        <span className="mt-auto flex items-end justify-between gap-xs pt-sm">
          {/* Not flex-1: the row is as wide as its tags while they fit on one line, and only when they wrap does it take the width, where
              fill-row-all lets the tags fill each line so none stands alone. */}
          <span className="fill-row-all flex min-w-0 flex-wrap gap-xs">{facts}</span>
          {action ?? (tappable ? <Icon icon={to ? ArrowUpRight : ArrowRight} size={16} className="read-arrow mb-xs shrink-0 text-ink-mute" /> : null)}
        </span>
      )}
    </>
  );
  const look = `fx-spot flex h-full w-full min-w-0 flex-col rounded-tile bg-card p-sm text-left text-ink ${tappable ? 'toy toy-soft group' : 'shadow-toy-soft'} ${className}`;
  if (to) {
    return (
      <Link to={to} aria-label={label} className={look}>
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-label={label} className={look}>
        {body}
      </button>
    );
  }
  return <div className={look}>{body}</div>;
}
