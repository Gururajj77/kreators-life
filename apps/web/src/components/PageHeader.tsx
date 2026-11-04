import type { MouseEvent, ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { CondensedTitle } from './fx/CondensedTitle';
import { ChevronLeft } from 'lucide-react';
import { Icon } from './Icon';
import { AppCover } from './AppCover';

/**
 * The way back, one step up. A small round button so it reads as a control, not a label. A screen that lives inside a page's own address
 * (a part of Discover opened with ?more=) passes `onBack` to close itself, since going back a page would leave the whole app screen.
 */
export function BackLink({ to, children, inherit = false, onBack }: { to: string; children: ReactNode; inherit?: boolean; onBack?: () => void }) {
  const nav = useNavigate();
  // Go back one page when this tab has one, so the page you left keeps its filters and scroll; otherwise go up.
  const back = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if (onBack) {
      e.preventDefault();
      onBack();
      return;
    }
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) {
      e.preventDefault();
      nav(-1);
    }
  };
  return (
    <Link to={to} onClick={back} data-back="" className={`back-link -ml-xs inline-flex min-h-[44px] items-center gap-xs rounded-pill pr-sm pl-xs text-[14px] font-bold transition-colors ${inherit ? '' : 'text-ink-soft hover:text-ink'}`}>
      <span className={`back-link-dot flex size-[32px] items-center justify-center rounded-pill shadow-toy-soft ${inherit ? 'bg-white/30' : 'bg-card text-ink'}`} aria-hidden="true">
        <Icon icon={ChevronLeft} size={18} className="back-link-chev" />
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

/**
 * Every screen opens the same way: the way back, the title, one line on what this is, then the controls. A screen with a way back and a
 * helper line is an app screen, so its header is the app's cover card (`AppCover`: back at the top left, the title and its line at the bottom right,
 * the actions on that line's left, over the app's own picture). Without one (Home, Daily, Pillars, Profile) it is the plain title.
 */
export function PageHeader({ back, eyebrow, title, lede, aside, children }: Props) {
  // Founder (2026-11-04): an app header with helper text is a cover card; one without helper text stays plain.
  if (back && lede) {
    return (
      <AppCover back={back} eyebrow={eyebrow} title={title} lede={lede} actions={aside}>
        {children}
      </AppCover>
    );
  }
  return (
    <header className="pt-lg">
      {back && <BackLink to={back.to}>{back.label}</BackLink>}
      {eyebrow && <p className="m-0 text-[14px] font-bold text-ink-soft">{eyebrow}</p>}
      <div className="flex items-center justify-between gap-sm">
        <CondensedTitle className="min-w-0" title={typeof title === 'string' ? title : ''}>
          <h1 className="type-large min-w-0">{title}</h1>
        </CondensedTitle>
        {aside && <div className="shrink-0">{aside}</div>}
      </div>
      {lede && <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">{lede}</p>}
      {children}
    </header>
  );
}
