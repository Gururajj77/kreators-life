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
      <div className={`flex justify-between gap-sm ${tools ? 'flex-wrap items-end' : 'items-start'}`}>
        <div className={tools ? 'min-w-0 flex-[1_1_220px]' : 'min-w-0'}>
          <h2 id={id} className="text-title2">
            {title}
          </h2>
          {lede && <p className="mt-xs m-0 text-balance text-subhead text-ink-soft">{lede}</p>}
        </div>
        {/* The action sits level with the title, at the top of the block, never down by the line under it. It is as tall as one line of the title and centres on it, so a 44px link or button still has its full tap area. */}
        {action && <div className="flex h-[1.2em] shrink-0 items-center text-[24px] leading-none">{action}</div>}
        {tools && <div className="ml-auto shrink-0">{tools}</div>}
      </div>
      <div className="mt-sm">{children}</div>
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
