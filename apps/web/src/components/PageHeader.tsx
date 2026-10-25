import type { MouseEvent, ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';

/** The way back, one step up. A small round button so it reads as a control, not a label. */
export function BackLink({ to, children, inherit = false }: { to: string; children: ReactNode; inherit?: boolean }) {
  const nav = useNavigate();
  // Go back one page when this tab has one, so the page you left keeps its filters and scroll; otherwise go up.
  const back = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) {
      e.preventDefault();
      nav(-1);
    }
  };
  return (
    <Link to={to} onClick={back} className={`-ml-xs inline-flex min-h-[44px] items-center gap-xs rounded-pill pr-sm pl-xs text-[14px] font-bold transition-colors ${inherit ? '' : 'text-ink-soft hover:text-ink'}`}>
      <span className={`flex size-[32px] items-center justify-center rounded-pill shadow-toy-soft ${inherit ? 'bg-white/30' : 'bg-card text-ink'}`} aria-hidden="true">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </span>
      {children}
    </Link>
  );
}

interface Props {
  back?: { to: string; label: string };
  /** A small line above the title, like the date. */
  eyebrow?: ReactNode;
  title: ReactNode;
  lede?: ReactNode;
  /** Something on the title's right, like a streak pill or a primary button. */
  aside?: ReactNode;
  children?: ReactNode;
}

/** Every screen opens the same way: the way back, the title, one line on what this is, then the controls. */
export function PageHeader({ back, eyebrow, title, lede, aside, children }: Props) {
  return (
    <header className="pt-lg">
      {back && <BackLink to={back.to}>{back.label}</BackLink>}
      {eyebrow && <p className="m-0 text-[14px] font-bold text-ink-soft">{eyebrow}</p>}
      <div className="flex items-center justify-between gap-sm">
        <h1 className="min-w-0 text-[30px]">{title}</h1>
        {aside && <div className="shrink-0">{aside}</div>}
      </div>
      {lede && <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">{lede}</p>}
      {children}
    </header>
  );
}
