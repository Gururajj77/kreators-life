import { BADGE_META, badgeRoleOf, MODULE_GROUPS, type ModuleGroup } from '@kreators/shared';
import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { useModules } from '../lib/modules';
import { useMe } from '../lib/queries';
import { BrandMark } from './BrandMark';
import { RoleBadge } from './RoleBadge';
import { Sheet } from './Sheet';
import { SignOut } from './SignOut';
import { ThemeToggle } from './ThemeToggle';

const TABS = [
  {
    to: '/home',
    label: 'Home',
    icon: (
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 11.5 12 4l9 7.5" />
        <path d="M5.5 10v10h13V10" />
        <path d="M10 20v-6h4v6" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    to: '/today',
    label: 'Daily',
    icon: (
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <circle cx="12" cy="12" r="4.5" fill="currentColor" stroke="none" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" />
      </svg>
    ),
  },
  {
    to: '/tower',
    label: 'Pillars',
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
    label: 'Profile',
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

const SIDEBAR_GROUPS: ModuleGroup[] = ['earn', 'creator', 'community', 'wellbeing', 'core', 'manage'];

export function TabBar() {
  const me = useMe();
  const unread = me.data?.unread ?? 0;
  const { modules } = useModules();
  const loc = useLocation();
  const sidebarApps = modules.filter((m) => m.on && !m.locked);
  // Phone: the sidebar's app groups live behind a menu button at the top right.
  const [menu, setMenu] = useState(false);
  useEffect(() => setMenu(false), [loc.pathname]);
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
                  `tab flex min-h-[72px] flex-col items-center justify-center gap-[6px] pt-sm pb-xs text-[12px] font-bold transition-colors ${isActive ? 'text-ink' : 'text-ink-soft hover:text-ink'}`
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
      {/* Phone: the brand in the top-left corner; theme, then the apps menu, in the top-right. The name drops on narrow phones. They sit at the top of the page and scroll away with it, so they never cover the content. */}
      <div className="safe-top absolute top-sm left-md z-30 md:hidden">
        <Link to="/home" aria-label="kreators.app, home" className="toy toy-soft flex min-h-[44px] min-w-[44px] items-center justify-center gap-xs whitespace-nowrap rounded-pill bg-card px-sm font-display text-[16px] font-extrabold tracking-tight">
          <BrandMark size={14} compact />
        </Link>
      </div>
      <div className="safe-top absolute top-sm right-md z-30 flex items-center gap-xs md:hidden">
        <ThemeToggle />
        <button
          type="button"
          onClick={() => setMenu(true)}
          aria-label="Apps menu"
          aria-expanded={menu}
          className="toy toy-soft flex size-[44px] items-center justify-center rounded-pill bg-card text-ink-soft hover:text-ink"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
      </div>
      <Sheet open={menu} onClose={() => setMenu(false)} title="Your apps">
        {me.data && (
          <p className="m-0 flex items-center gap-xs text-[12px] font-extrabold uppercase tracking-wide text-ink-soft">
            <RoleBadge role={badgeRoleOf(me.data.user)} size={20} />
            {BADGE_META[badgeRoleOf(me.data.user)].name}
          </p>
        )}
        {sidebarApps.length === 0 && <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">Nothing switched on yet. Pick apps under Apps.</p>}
        {SIDEBAR_GROUPS.map((g) => {
          const list = sidebarApps.filter((m) => m.group === g);
          if (list.length === 0) return null;
          return (
            <section key={g} className="mt-md" aria-label={MODULE_GROUPS[g]}>
              <h3 className="m-0 px-xs text-[12px] font-extrabold uppercase tracking-wide text-ink-soft" style={{ fontFamily: 'var(--font-body)' }}>
                {MODULE_GROUPS[g]}
              </h3>
              <ul className="mt-xs flex list-none flex-col p-0 m-0">
                {list.map((m) => (
                  <li key={m.key}>
                    <NavLink to={m.path} className={({ isActive }) => `toy flex min-h-[48px] items-center gap-sm rounded-pill px-sm text-[16px] font-bold transition-colors ${isActive ? 'bg-ink text-on-ink' : 'text-ink hover:bg-paper'}`}>
                      <span className="text-[20px] leading-none" aria-hidden="true">
                        {m.emoji}
                      </span>
                      <span className="truncate">{m.name}</span>
                      {m.key === 'notifications' && unread > 0 && <span className="ml-auto rounded-pill bg-r1 px-xs text-[11px] font-extrabold leading-[18px] text-on-fill">{unread > 9 ? '9+' : unread}</span>}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
        <div className="mt-lg flex items-center justify-between gap-sm">
          <Link to="/" className="text-[12px] font-bold text-ink-soft hover:text-ink">
            About kreators.app
          </Link>
          <SignOut />
        </div>
      </Sheet>
      {/* Laptop: a sidebar on the left. */}
      <nav aria-label="Main" className="safe-top fixed inset-y-0 left-0 z-30 hidden w-[240px] flex-col overflow-y-auto border-r border-line bg-card px-sm py-md md:flex">
        <Link to="/home" className="flex min-h-[44px] items-center gap-xs px-xs font-display text-[18px] font-extrabold">
          <BrandMark />
        </Link>
        {/* Your role, right under the logo: creator, staff or admin. The theme button sits beside it. */}
        <div className="mt-xs flex min-h-[44px] items-center justify-between gap-xs px-xs">
          {me.data ? (
            <p className="m-0 flex items-center gap-xs text-[12px] font-extrabold uppercase tracking-wide text-ink-soft">
              <RoleBadge role={badgeRoleOf(me.data.user)} size={20} />
              {BADGE_META[badgeRoleOf(me.data.user)].name}
            </p>
          ) : (
            <span />
          )}
          <ThemeToggle />
        </div>
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
        {/* The apps that are on, under their category, folded away until you open one or step inside it. Switch more on from Apps. */}
        <div className="mt-md flex flex-col gap-sm">
          {SIDEBAR_GROUPS.map((g) => {
            const list = sidebarApps.filter((m) => m.group === g);
            if (list.length === 0) return null;
            return (
              <details key={g} open={list.some((m) => loc.pathname === m.path || loc.pathname.startsWith(`${m.path}/`))} className="group">
                <summary className="flex min-h-[40px] cursor-pointer items-center justify-between rounded-pill px-xs text-[12px] font-extrabold uppercase tracking-wide text-ink-soft">
                  {MODULE_GROUPS[g]}
                  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="chev">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </summary>
                <ul className="mt-xs flex list-none flex-col gap-xs p-0 pb-xs m-0">
                  {list.map((m) => (
                    <li key={m.key}>
                      <NavLink to={m.path} className={({ isActive }) => `tab flex min-h-[40px] items-center gap-xs rounded-pill px-sm text-[14px] font-bold transition-colors ${isActive ? 'bg-paper text-ink' : 'text-ink-soft hover:bg-paper hover:text-ink'}`}>
                        <span className="text-[16px] leading-none" aria-hidden="true">
                          {m.emoji}
                        </span>
                        <span className="truncate">{m.name}</span>
                        {m.key === 'notifications' && unread > 0 && <span className="ml-auto rounded-pill bg-r1 px-xs text-[11px] font-extrabold leading-[18px] text-on-fill">{unread > 9 ? '9+' : unread}</span>}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </details>
            );
          })}
        </div>
        <div className="mt-auto flex flex-col gap-xs px-xs pt-md">
          <SignOut className="w-full" />
          <Link to="/" className="inline-flex min-h-[44px] items-center text-[12px] font-bold text-ink-soft hover:text-ink">
            About kreators.app
          </Link>
        </div>
      </nav>
    </>
  );
}
