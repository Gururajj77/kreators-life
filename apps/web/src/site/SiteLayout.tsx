import { RELATIONSHIPS } from '@kreators/shared';
import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router';
import { Avatar } from '../components/Avatar';
import { useSession } from '../lib/store';
import { useTheme, type ThemeMode } from '../lib/theme';
import { ThemeToggle } from '../components/ThemeToggle';

/** Where "Go to app" goes: straight in for people with a session, to sign in for everyone else. */
export function useAppEntry(): string {
  const token = useSession((s) => s.token);
  return token ? '/home' : '/signin';
}

export function Logo() {
  return (
    <Link to="/" className="inline-flex min-h-[44px] shrink-0 items-center gap-xs whitespace-nowrap font-display text-[20px] font-extrabold tracking-tight">
      <span className="flex items-end gap-[2px]" aria-hidden="true">
        {RELATIONSHIPS.slice(0, 3).map((r, i) => (
          <Avatar key={r.key} relationship={r.key} size={18 + i * 4} decorative still />
        ))}
      </span>
      kreators.app
    </Link>
  );
}

export function SiteLayout({ children, wide = true }: { children: ReactNode; wide?: boolean }) {
  const entry = useAppEntry();
  const token = useSession((s) => s.token);
  const themeMode = useTheme((s) => s.mode);
  const setThemeMode = useTheme((s) => s.setMode);
  const nav = 'inline-flex min-h-[44px] shrink-0 items-center whitespace-nowrap rounded-pill px-sm text-[16px] font-bold text-ink-soft transition-colors hover:text-ink aria-[current=page]:text-ink';
  return (
    <div className="min-h-dvh bg-paper text-ink">
      <header className="safe-top sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
        <div className={`mx-auto flex ${wide ? 'max-w-[1080px]' : 'max-w-[720px]'} items-center justify-between gap-sm px-md py-xs`}>
          <Logo />
          <nav aria-label="Site" className="flex items-center gap-xs">
            <NavLink to="/explore" className={nav}>
              Explore
            </NavLink>
            {wide && (
              <a href="/#features" className={`${nav} hidden sm:inline-flex`}>
                Features
              </a>
            )}
            {wide && (
              <a href="/#brands" className={`${nav} hidden md:inline-flex`}>
                For brands
              </a>
            )}
            {!token && (
              <Link to="/signin" className={`${nav} hidden sm:inline-flex`}>
                Sign in
              </Link>
            )}
            <Link to={entry} className="toy inline-flex min-h-[44px] shrink-0 items-center whitespace-nowrap rounded-pill bg-ink px-md text-[16px] font-bold text-on-ink">
              Go to app
            </Link>
            <ThemeToggle />
          </nav>
        </div>
      </header>
      <main className={`mx-auto ${wide ? 'max-w-[1080px]' : 'max-w-[720px]'} px-md pb-2xl`}>{children}</main>
      <footer className="border-t border-line">
        <div className={`mx-auto flex ${wide ? 'max-w-[1080px]' : 'max-w-[720px]'} flex-col gap-md px-md py-lg md:flex-row md:items-start md:justify-between`}>
          <div>
            <Logo />
            <p className="mt-xs m-0 max-w-[420px] text-[14px] font-semibold text-ink-soft">A daily game for the seven relationships that make a life, and every tool a creator needs to learn, earn, meet people and stay well.</p>
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-xs text-[14px] font-bold text-ink-soft sm:grid-cols-3">
            <Link to="/explore" className="min-h-[32px] hover:text-ink">
              Explore listings
            </Link>
            <a href="/#floors" className="min-h-[32px] hover:text-ink">
              Seven pillars
            </a>
            <a href="/#features" className="min-h-[32px] hover:text-ink">
              Features
            </a>
            <a href="/#brands" className="min-h-[32px] hover:text-ink">
              For brands
            </a>
            <Link to="/features/help" className="min-h-[32px] hover:text-ink">
              Help
            </Link>
            <Link to="/signin" className="min-h-[32px] hover:text-ink">
              Sign in
            </Link>
            <Link to="/pricing" className="min-h-[32px] hover:text-ink">
              Pricing
            </Link>
            <Link to="/terms" className="min-h-[32px] hover:text-ink">
              Terms
            </Link>
            <Link to="/privacy" className="min-h-[32px] hover:text-ink">
              Privacy
            </Link>
            <Link to="/refunds" className="min-h-[32px] hover:text-ink">
              Refunds
            </Link>
            <Link to="/contact" className="min-h-[32px] hover:text-ink">
              Contact
            </Link>
          </nav>
          <div className="flex gap-xs" role="group" aria-label="Theme">
            {(
              [
                ['system', 'Auto'],
                ['light', 'Light'],
                ['dark', 'Dark'],
              ] as [ThemeMode, string][]
            ).map(([m, label]) => (
              <button key={m} type="button" aria-pressed={themeMode === m} onClick={() => setThemeMode(m)} className={`toy min-h-[40px] rounded-pill border-2 px-sm text-[14px] font-bold ${themeMode === m ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <p className="m-0 px-md pb-lg text-center text-[12px] font-semibold text-ink-mute">Your journal and wellbeing numbers are never shown to brands, staff, the leaderboard or Club selection.</p>
      </footer>
    </div>
  );
}
