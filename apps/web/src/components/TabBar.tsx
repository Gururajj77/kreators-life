import { RELATIONSHIPS } from '@kreators/shared';
import { Link, NavLink } from 'react-router';
import { useMe } from '../lib/queries';
import { Avatar } from './Avatar';
import { ThemeToggle } from './ThemeToggle';

const TABS = [
  {
    to: '/today',
    label: 'Today',
    icon: (
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <circle cx="12" cy="12" r="4.5" fill="currentColor" stroke="none" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" />
      </svg>
    ),
  },
  {
    to: '/tower',
    label: 'Tower',
    icon: (
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="currentColor">
        <rect x="3" y="17" width="18" height="4" rx="2" />
        <rect x="5" y="11" width="14" height="4" rx="2" />
        <rect x="7" y="5" width="10" height="4" rx="2" />
      </svg>
    ),
  },
  {
    to: '/apps',
    label: 'Apps',
    icon: (
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="currentColor">
        <rect x="3" y="3" width="8" height="8" rx="2.5" />
        <rect x="13" y="3" width="8" height="8" rx="2.5" />
        <rect x="3" y="13" width="8" height="8" rx="2.5" />
        <rect x="13" y="13" width="8" height="8" rx="2.5" />
      </svg>
    ),
  },
  {
    to: '/you',
    label: 'You',
    icon: (
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <circle cx="12" cy="12" r="9.5" />
        <circle cx="9" cy="10" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="15" cy="10" r="1.2" fill="currentColor" stroke="none" />
        <path d="M8.5 14.5q3.5 3 7 0" />
      </svg>
    ),
  },
];

export function TabBar() {
  const me = useMe();
  const unread = me.data?.unread ?? 0;
  const badge = (to: string) =>
    to === '/apps' && unread > 0 ? (
      <span className="absolute -top-[2px] -right-[2px] flex min-w-[18px] items-center justify-center rounded-pill bg-r1 px-[4px] text-[11px] font-extrabold leading-[18px] text-white" aria-label={`${unread} unread`}>
        {unread > 9 ? '9+' : unread}
      </span>
    ) : null;
  return (
    <>
      {/* Phone: tabs along the bottom. */}
      <nav aria-label="Main" className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card md:hidden">
        <ul className="mx-auto flex max-w-[480px] list-none items-stretch justify-around p-0 m-0">
          {TABS.map((t) => (
            <li key={t.to} className="flex-1">
              <NavLink
                to={t.to}
                className={({ isActive }) =>
                  `tab flex min-h-[64px] flex-col items-center justify-center gap-xs text-[12px] font-bold transition-colors ${isActive ? 'text-ink' : 'text-ink-mute hover:text-ink'}`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={`tab-icon relative flex size-[36px] items-center justify-center rounded-pill transition-colors ${isActive ? 'bg-ink text-on-ink' : ''}`}>
                      {t.icon}
                      {badge(t.to)}
                    </span>
                    {t.label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <ThemeToggle floating className="md:hidden" />
      {/* Laptop: a sidebar on the left. */}
      <nav aria-label="Main" className="safe-top fixed inset-y-0 left-0 z-30 hidden w-[240px] flex-col border-r border-line bg-card px-sm py-md md:flex">
        <Link to="/today" className="flex min-h-[44px] items-center gap-xs px-xs font-display text-[18px] font-extrabold">
          <span className="flex items-end gap-[2px]" aria-hidden="true">
            {RELATIONSHIPS.slice(0, 3).map((r, i) => (
              <Avatar key={r.key} relationship={r.key} size={16 + i * 4} decorative still />
            ))}
          </span>
          Kreators Life
        </Link>
        <ul className="mt-md flex list-none flex-col gap-xs p-0 m-0">
          {TABS.map((t) => (
            <li key={t.to}>
              <NavLink to={t.to} className={({ isActive }) => `tab flex min-h-[48px] items-center gap-sm rounded-pill px-sm text-[16px] font-bold transition-colors ${isActive ? 'bg-ink text-on-ink' : 'text-ink-soft hover:bg-paper hover:text-ink'}`}>
                <span className="relative flex size-[28px] items-center justify-center">
                  {t.icon}
                  {badge(t.to)}
                </span>
                {t.label}
              </NavLink>
            </li>
          ))}
        </ul>
        <div className="mt-auto flex items-center justify-between gap-xs px-xs">
          <Link to="/" className="text-[12px] font-bold text-ink-soft hover:text-ink">
            About Kreators Life
          </Link>
          <ThemeToggle />
        </div>
      </nav>
    </>
  );
}
