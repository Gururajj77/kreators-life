import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowUpRight } from 'lucide-react';
import { Icon } from './Icon';

interface Props {
  id: string;
  title: ReactNode;
  lede?: ReactNode;
  /** A link or button on the heading's right, for example "See all". */
  action?: ReactNode;
  /** Controls at the heading's right, level with the bottom of its line (a filter's segments), as Breathe and focus sets its round
   * buttons; on a narrow phone they wrap under the words, at the right. */
  tools?: ReactNode;
  /** On a laptop, span both columns. */
  span?: boolean;
  className?: string;
  children: ReactNode;
}

/** One titled block on a screen. Same heading size and gap everywhere, so the eye can skim. */
export function Section({ id, title, lede, action, tools, span = false, className = '', children }: Props) {
  return (
    <section className={`mt-lg ${span ? 'span-all' : ''} ${className}`} aria-labelledby={id}>
      {tools ? (
        <div className="flex flex-wrap items-end justify-between gap-sm">
          <div className="min-w-0 flex-[1_1_220px]">
            <h2 id={id} className="text-title2">
              {title}
            </h2>
            {lede && <p className="mt-xs m-0 text-balance text-subhead text-ink-soft">{lede}</p>}
          </div>
          <div className="ml-auto shrink-0">{tools}</div>
        </div>
      ) : (
        // A button (anything rounded, with an edge) reaches past the one-line box it sits in, so beside one the line under the title keeps
        // to the title's column, and with no line the heading keeps 8px more under it, so the button never touches what follows.
        <div className={`group/sh grid grid-cols-[minmax(0,1fr)_auto] gap-x-sm ${lede ? '' : 'has-[>div_.rounded-pill]:pb-xs'}`}>
          <h2 id={id} className="min-w-0 text-title2">
            {title}
          </h2>
          {/* The action sits level with the title's first line, at the top of the block, never down by the line under it. Its box is one
              line of the title tall and centres on it, so a 44px link or button still has its full tap area. */}
          {action && <div className="col-start-2 row-start-1 flex h-[var(--text-title2--line-height)] shrink-0 items-center text-[24px] leading-none">{action}</div>}
          {/* Beside a link the line under the title takes the block's whole width, under the link too, so a long link ("See what's
              emerging") never squeezes it into a narrow column on a phone. */}
          {lede && <p className="col-span-full mt-xs m-0 text-balance text-subhead text-ink-soft group-has-[>div_.rounded-pill]/sh:col-span-1">{lede}</p>}
        </div>
      )}
      {/* Children that draw nothing leave no 12px band. */}
      <div className="mt-sm empty:hidden">{children}</div>
    </section>
  );
}

/** The quiet link on a section heading: "See all", "Open finance". */
export function SeeAll({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="inline-flex min-h-[44px] items-center gap-xs text-subhead font-medium text-ink-mute underline-offset-4 hover:text-ink hover:underline">
      {children}
      <Icon icon={ArrowUpRight} size={16} />
    </Link>
  );
}
