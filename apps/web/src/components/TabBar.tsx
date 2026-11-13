import { BADGE_META, badgeRoleOf, RELATIONSHIP_BY_KEY, groupStartsOpen, MODULE_GROUPS, orderInGroup, type ModuleGroup } from '@kreators/shared';
import { useEffect, useState, type ReactNode } from 'react';
import { Bell, CircleUserRound, Landmark, LayoutGrid, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { AnimatedIcon, type AnimatedName } from './AnimatedIcon';
import { AppIcon } from './AppIcon';
import { FocusPill } from './FocusPill';
import { Fold } from './Fold';
import { Icon } from './Icon';
import { StatusTag } from './StatusTag';
import { useFocusSession } from '../lib/focusSession';
import { useSlider } from './fx/useSlider';
import { Link, NavLink, useLocation } from 'react-router';
import { useAppPrefs, useGroupOrder, useModules } from '../lib/modules';
import { useMe } from '../lib/queries';
import { BrandMark } from './BrandMark';
import { RoleBadge } from './RoleBadge';
import { Sheet } from './Sheet';
import { SignOut } from './SignOut';
import { ThemeToggle } from './ThemeToggle';

// The five tabs wear the same icons as their apps in the registry (Home, Daily, Pillars), then Apps and Profile.
// lucide draws outlines only, so the tab you are on is shown by the sliding ink circle behind it, not by a fill.
// Home (a house) and Daily (a sun) have a matching useanimations drawing, so they play once when the tab becomes the page you
// are on and when the pointer or the keyboard reaches them; Pillars, Apps and Profile have no matching animation and stay lucide.
const TABS: { to: string; label: string; icon: (on: boolean, size: number) => ReactNode }[] = [
  { to: '/home', label: 'Home', icon: (on, size) => <AnimatedIcon name="home" size={size} playWhen={on} /> },
  { to: '/today', label: 'Daily', icon: (on, size) => <AnimatedIcon name="sun" size={size} playWhen={on} /> },
  { to: '/tower', label: 'Pillars', icon: (_, size) => <Icon icon={Landmark} size={size} /> },
  { to: '/apps', label: 'Apps', icon: (_, size) => <Icon icon={LayoutGrid} size={size} /> },
  { to: '/you', label: 'Profile', icon: (_, size) => <Icon icon={CircleUserRound} size={size} /> },
];

// An app in the sidebar plays its icon when its registry icon has a matching animation (the same picture, moving).
// The Inbox bell stays still on purpose: the useanimations bells end on a struck-through bell, which reads as "muted".
const ANIMATED_APP_ICON: Record<string, AnimatedName> = {
  House: 'home',
  Sun: 'sun',
  Compass: 'explore',
  Moon: 'moon',
  Wind: 'wind',
  BookOpen: 'bookOpen',
  ShoppingBag: 'shoppingBag',
  ShoppingCart: 'shoppingCart',
  TrendingUp: 'trendingUp',
  Target: 'target',
  Tv: 'tv',
  Link: 'link',
  Settings: 'settings',
};

function NavAppIcon({ name, size, on }: { name: string; size: number; on: boolean }) {
  const animated = ANIMATED_APP_ICON[name];
  return animated ? <AnimatedIcon name={animated} size={size} playWhen={on} /> : <AppIcon name={name} size={size} />;
}

/** The unread count beside the Inbox in a list: a tag in the red tone, the number its word. */
function UnreadTag({ n }: { n: number }) {
  return (
    <StatusTag tone="bad" className="ml-auto" title={`${n} unread`}>
      {n > 9 ? '9+' : n}
      <span className="sr-only"> unread</span>
    </StatusTag>
  );
}

/**
 * The Inbox bell: at the top of the sidebar on a tablet and a laptop, and left of the theme button in a phone's top-right corner (2026-11-07,
 * the founder). A round button in the theme button's own look, with the unread count on it, so no tab carries the count any more.
 */
function BellLink({ unread }: { unread: number }) {
  const label = unread > 0 ? `Inbox, ${unread} unread` : 'Inbox';
  return (
    <NavLink to="/inbox" aria-label={label} data-tip={label} className="toy toy-soft relative flex size-[44px] shrink-0 items-center justify-center rounded-pill bg-card-strong text-ink-soft hover:text-ink">
      <Icon icon={Bell} size={22} />
      {unread > 0 && (
        <span aria-hidden="true" className="absolute -top-[2px] -right-[2px] flex min-w-[18px] items-center justify-center rounded-pill bg-r1 px-[4px] text-caption2 font-semibold leading-[18px] text-on-fill">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </NavLink>
  );
}

const inside = (path: string, at: string) => at === path || at.startsWith(`${path}/`);

const SIDEBAR_GROUPS: ModuleGroup[] = ['earn', 'creator', 'community', 'wellbeing', 'core', 'manage'];

/** Whether the laptop sidebar is folded to its icons: kept on this device, and set on <html> as data-nav so --nav-w follows it. */
function useNavMini(): [boolean, (v: boolean) => void] {
  const [mini, setMini] = useState(() => {
    try {
      return localStorage.getItem('kreators.navMini') === '1';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    document.documentElement.dataset.nav = mini ? 'mini' : 'full';
    try {
      localStorage.setItem('kreators.navMini', mini ? '1' : '0');
    } catch {
      // private window: it still works for this visit
    }
  }, [mini]);
  return [mini, setMini];
}

export function TabBar() {
  const [mini, setMini] = useNavMini();
  const me = useMe();
  const unread = me.data?.unread ?? 0;
  const { modules } = useModules();
  const groupOrder = useGroupOrder(SIDEBAR_GROUPS);
  const loc = useLocation();
  const focusActive = useFocusSession((s) => s.snap.active);
  // The filled circle (phone) and the filled pill (laptop) behind the page you are on glide from tab to tab; until they are placed the tab keeps its own fill.
  const bottom = useSlider<HTMLUListElement>('[aria-current="page"] .tab-icon', loc.pathname);
  const side = useSlider<HTMLUListElement>('[aria-current="page"]', loc.pathname);
  const sidebarApps = modules.filter((m) => m.on && !m.locked);
  // The person's arrangement (Profile, Features): the apps they placed come first in each group, and each group starts open or closed
  // as they picked (Contribution and Essentials open until they pick).
  const prefs = useAppPrefs();
  const appsOf = (g: ModuleGroup) => orderInGroup(sidebarApps.filter((m) => m.group === g), prefs.order[g]);
  // Phone: the sidebar's app groups live behind a menu button at the top right.
  const [menu, setMenu] = useState(false);
  useEffect(() => setMenu(false), [loc.pathname]);
  // The sidebar's groups (and the phone menu's) start as the person picked, Contribution and Essentials open until then, and the group
  // of the app you are in opens; a tap opens or folds any of them for this visit, and moving to another page opens that page's group
  // without folding what you opened.
  const groupOf = (at: string) => sidebarApps.find((m) => inside(m.path, at))?.group;
  const [openGroups, setOpenGroups] = useState<Partial<Record<ModuleGroup, boolean>>>(() => {
    const g = groupOf(loc.pathname);
    return g ? { [g]: true } : {};
  });
  const here = groupOf(loc.pathname);
  useEffect(() => {
    if (here) setOpenGroups((s) => (s[here] ? s : { ...s, [here]: true }));
  }, [loc.pathname, here]);
  return (
    <>
      {/* Phone: tabs along the bottom. */}
      <nav aria-label="Main" data-tabbar="" className="fx-bar safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line md:hidden">
        <ul ref={bottom.ref} className="fx-slide mx-auto flex max-w-[480px] list-none items-stretch justify-around p-0 m-0">
          {TABS.map((t) => (
            <li key={t.to} className="flex-1">
              <NavLink
                to={t.to}
                className={({ isActive }) =>
                  `tab flex min-h-[72px] flex-col items-center justify-center gap-[6px] pt-sm pb-xs text-caption2 transition-colors ${isActive ? 'text-ink' : 'text-ink-soft hover:text-ink'}`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={`tab-icon relative flex size-[36px] items-center justify-center rounded-pill transition-colors ${isActive ? (bottom.ready ? 'text-on-ink' : 'bg-ink text-on-ink') : ''}`}>
                      {t.icon(isActive, 24)}
                    </span>
                    {t.label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      {/* Phone: the brand in the top-left corner; the Inbox bell with its count, theme, then the apps menu, in the top-right. The name drops on narrow phones. They sit at the top of the page and scroll away with it, so they never cover the content. A running or paused focus clock takes this spot instead, on every page, until it stops. */}
      <div className="safe-top absolute top-sm left-md z-30 md:hidden">
        {focusActive ? (
          <FocusPill compact />
        ) : (
          <Link to="/home" aria-label="kreators.app, home" className="toy toy-soft flex min-h-[44px] min-w-[44px] items-center justify-center gap-xs whitespace-nowrap rounded-pill bg-card-strong px-sm font-display text-[16px] font-bold tracking-tight">
            <BrandMark compact />
          </Link>
        )}
      </div>
      <div className="safe-top absolute top-sm right-md z-30 flex items-center gap-xs md:hidden">
        <BellLink unread={unread} />
        <ThemeToggle />
        <button
          type="button"
          onClick={() => setMenu(true)}
          aria-label="Apps menu"
          aria-expanded={menu}
          className="toy toy-soft flex size-[44px] items-center justify-center rounded-pill bg-card-strong text-ink-soft hover:text-ink"
        >
          <AnimatedIcon name="menu" size={24} active={menu} />
        </button>
      </div>
      <Sheet open={menu} onClose={() => setMenu(false)} title="Your apps">
        {me.data && (
          <p className="m-0 flex items-center gap-xs text-eyebrow uppercase text-ink-soft">
            <RoleBadge role={badgeRoleOf(me.data.user)} size={20} />
            {BADGE_META[badgeRoleOf(me.data.user)].name}
          </p>
        )}
        {sidebarApps.length === 0 && <p className="mt-sm m-0 text-footnote text-ink-soft">Every app is hidden. Show some from Apps.</p>}
        {groupOrder.map((g) => {
          const list = appsOf(g);
          if (list.length === 0) return null;
          return (
            <section key={g} className="mt-sm" aria-label={MODULE_GROUPS[g]}>
              <Fold
                tone="plain"
                open={openGroups[g] ?? groupStartsOpen(prefs, g)}
                onOpenChange={(o) => setOpenGroups((s) => ({ ...s, [g]: o }))}
                title={<span className="text-eyebrow uppercase text-ink-soft">{MODULE_GROUPS[g]}</span>}
              >
                <ul className="flex list-none flex-col p-0 m-0">
                  {list.map((m) => (
                    <li key={m.key}>
                      <NavLink to={m.path} className={({ isActive }) => `toy flex min-h-[48px] items-center gap-sm rounded-pill px-sm text-callout transition-colors ${isActive ? 'bg-ink text-on-ink' : 'text-ink hover:bg-paper'}`}>
                        {({ isActive }) => (
                          <>
                            <NavAppIcon name={m.icon} size={20} on={isActive} />
                            <span className="truncate">{m.name}</span>
                            {m.key === 'notifications' && unread > 0 && <UnreadTag n={unread} />}
                          </>
                        )}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </Fold>
            </section>
          );
        })}
        <div className="mt-lg flex items-center justify-between gap-sm">
          <Link to="/" className="inline-flex min-h-[44px] items-center text-caption text-ink-soft hover:text-ink">
            About kreators.app
          </Link>
          <SignOut />
        </div>
      </Sheet>
      {/* Laptop: a sidebar on the left. */}
      <nav aria-label="Main" data-mini={mini || undefined} className="nav-side safe-top fixed inset-y-0 left-0 z-30 hidden w-[var(--nav-w)] flex-col overflow-x-hidden overflow-y-auto border-r border-line bg-card px-sm py-md md:flex">
        {focusActive ? (
          // The running clock stays in sight while the sidebar scrolls (sticky at its top, on the sidebar's own surface); folded, it is a
          // round dot with the minutes, rippling each second.
          <div className={`sticky top-0 z-10 -mx-sm bg-card px-sm pt-sm pb-xs ${mini ? 'flex justify-center' : ''}`}>
            {mini ? <FocusPill dot /> : <FocusPill />}
          </div>
        ) : (
          // The safe area takes the sidebar's own top padding, so the logo keeps its room from the top and left edges itself.
          <div className={`mt-sm flex items-center gap-xs ${mini ? 'justify-center' : ''}`}>
            <Link to="/home" aria-label="kreators.app, home" className={`flex min-h-[44px] items-center gap-xs font-display text-[18px] font-bold ${mini ? 'justify-center' : 'px-sm'}`}>
              {mini ? (
                <span aria-hidden="true" className="flex items-baseline text-[22px] leading-none">
                  k<span className="brand-dot" />
                </span>
              ) : (
                <BrandMark />
              )}
            </Link>
          </div>
        )}
        {/* Your role, right under the logo, as a tag in its own colour, with the bell and the theme button beside it. Folded, the theme button with the bell under it, above Home. */}
        <div className={`mt-xs flex min-h-[44px] items-center gap-xs ${mini ? 'flex-col justify-center' : 'justify-between'}`}>
          {!mini && me.data ? (
            (() => {
              const role = badgeRoleOf(me.data.user);
              const rel = RELATIONSHIP_BY_KEY[BADGE_META[role].accent];
              return (
                <span className="inline-flex min-h-[32px] items-center gap-xs whitespace-nowrap rounded-pill py-[4px] pr-sm pl-[4px] text-caption font-medium" style={{ background: `var(--soft-${rel.key})`, color: `var(--deep-${rel.key})` }}>
                  <RoleBadge role={role} size={24} named />
                  {BADGE_META[role].name}
                </span>
              );
            })()
          ) : (
            !mini && <span />
          )}
          {mini ? (
            <>
              <ThemeToggle />
              <BellLink unread={unread} />
            </>
          ) : (
            <div className="flex shrink-0 items-center gap-xs">
              <BellLink unread={unread} />
              <ThemeToggle />
            </div>
          )}
        </div>
        <ul ref={side.ref} className="fx-slide mt-md flex list-none flex-col gap-xs p-0 m-0">
          {TABS.map((t) => (
            <li key={t.to}>
              <NavLink to={t.to} aria-label={mini ? t.label : undefined} data-tip={mini ? t.label : undefined} data-tip-at="right" className={({ isActive }) => `tab relative flex min-h-[48px] items-center gap-sm rounded-pill text-callout font-medium transition-colors ${mini ? 'justify-center px-0' : 'px-sm'} ${isActive ? (side.ready ? 'text-on-ink' : 'bg-ink text-on-ink') : 'text-ink-soft hover:bg-paper hover:text-ink'}`}>
                {({ isActive }) => (
                  <>
                    <span className="relative flex size-[28px] items-center justify-center">{t.icon(isActive, 24)}</span>
                    {!mini && t.label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
        {/* The apps that are on, under their category, folded away until you open one or step inside it. Switch more on from Apps. */}
        <div className="mt-md flex flex-col gap-xs">
          {groupOrder.map((g) => {
            const list = appsOf(g);
            if (list.length === 0) return null;
            // Folded: only the main tabs; the apps come back when the sidebar opens.
            if (mini) return null;
            return (
              <Fold
                key={g}
                tone="plain"
                open={openGroups[g] ?? groupStartsOpen(prefs, g)}
                onOpenChange={(o) => setOpenGroups((s) => ({ ...s, [g]: o }))}
                title={<span className="text-eyebrow uppercase text-ink-soft">{MODULE_GROUPS[g]}</span>}
              >
                <ul className="flex list-none flex-col gap-xs p-0 pb-xs m-0">
                  {list.map((m) => (
                    <li key={m.key}>
                      <NavLink to={m.path} className={({ isActive }) => `tab flex min-h-[44px] items-center gap-xs rounded-pill px-sm text-subhead transition-colors ${isActive ? 'bg-line text-ink' : 'text-ink-soft hover:bg-paper hover:text-ink'}`}>
                        {({ isActive }) => (
                          <>
                            <NavAppIcon name={m.icon} size={18} on={isActive} />
                            <span className="truncate">{m.name}</span>
                            {m.key === 'notifications' && unread > 0 && <UnreadTag n={unread} />}
                          </>
                        )}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </Fold>
            );
          })}
        </div>
        <div className={`mt-auto flex flex-col gap-xs pt-md ${mini ? 'items-center' : 'px-xs'}`}>
          <SignOut className={mini ? '' : 'w-full'} iconOnly={mini} />
          {!mini && (
            <Link to="/" className="inline-flex min-h-[44px] items-center text-caption text-ink-soft hover:text-ink">
              About kreators.app
            </Link>
          )}
        </div>
      </nav>
      {/* Fold the sidebar to its main tabs, or open it again (kept on this device): a round button half over the sidebar's edge, at the
          top while it is open and at the foot while it is folded. */}
      <button type="button" onClick={() => setMini(!mini)} aria-pressed={mini} aria-label={mini ? 'Open the sidebar' : 'Fold the sidebar'} data-tip={mini ? 'Open the sidebar' : 'Fold the sidebar'} data-tip-at="right" data-mini={mini || undefined} className="nav-fold toy toy-soft fixed z-40 hidden size-[36px] items-center justify-center rounded-pill border border-line bg-card-strong text-ink-soft hover:text-ink md:flex">
        <Icon icon={mini ? PanelLeftOpen : PanelLeftClose} size={18} className="nav-fold-icon" />
      </button>
    </>
  );
}
