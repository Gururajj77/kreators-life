import type { ReactNode } from 'react';

interface Props {
  id: string;
  title: ReactNode;
  lede?: ReactNode;
  /** A link or button on the heading's right, for example "See all". */
  action?: ReactNode;
  /** On a laptop, span both columns. */
  span?: boolean;
  className?: string;
  children: ReactNode;
}

/** One titled block on a screen. Same heading size and gap everywhere, so the eye can skim. */
export function Section({ id, title, lede, action, span = false, className = '', children }: Props) {
  return (
    <section className={`mt-lg ${span ? 'span-all' : ''} ${className}`} aria-labelledby={id}>
      <div className="flex items-end justify-between gap-sm">
        <div className="min-w-0">
          <h2 id={id} className="text-[24px]">
            {title}
          </h2>
          {lede && <p className="mt-xs m-0 text-pretty text-[14px] font-semibold text-ink-soft">{lede}</p>}
        </div>
        {action && <div className="shrink-0 pb-xs">{action}</div>}
      </div>
      <div className="mt-sm">{children}</div>
    </section>
  );
}

/** The quiet link on a section heading: "See all", "Open finance". */
export function SeeAll({ to, children }: { to: string; children: ReactNode }) {
  return (
    <a href={to} className="inline-flex min-h-[44px] items-center gap-xs text-[14px] font-bold text-ink-mute underline-offset-4 hover:text-ink hover:underline">
      {children}
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 5l7 7-7 7" />
      </svg>
    </a>
  );
}
