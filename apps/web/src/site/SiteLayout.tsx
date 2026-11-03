import { RELATIONSHIPS } from '@kreators/shared';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { Avatar } from '../components/Avatar';
import { Ornament, Posy } from '../components/Hero';
import { useSession } from '../lib/store';
import { useTheme } from '../lib/theme';
import { ThemeToggle } from '../components/ThemeToggle';
import { Segmented } from '../components/fx/Segmented';
import { useSlider } from '../components/fx/useSlider';

/** Where "Go to app" goes: straight in for people with a session, to sign in for everyone else. */
export function useAppEntry(): string {
  const token = useSession((s) => s.token);
  return token ? '/home' : '/signin';
}

export function Logo() {
  return (
    <Link to="/" className="inline-flex min-h-[44px] shrink-0 items-center gap-xs whitespace-nowrap font-display text-[20px] font-extrabold tracking-tight">
      <span className="flex items-end gap-[2px] max-[380px]:hidden" aria-hidden="true">
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
  // Two classes, because Tailwind 4 orders `inline-flex` after `hidden`: a link that carries both would always show.
  const navBase = 'relative min-h-[44px] shrink-0 items-center whitespace-nowrap rounded-pill px-sm text-[16px] font-bold text-ink-soft transition-colors hover:text-ink aria-[current=page]:text-ink';
  // Phones keep only the logo, "Go to app" and the theme button; the rest comes back from the laptop breakpoint.
  const navWide = `hidden lg:inline-flex ${navBase}`;
  // The header frosts once the page has moved: a one-pixel marker at the very top tells us when it has left the screen (no scroll listener).
  const top = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const el = top.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setScrolled(!e?.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  // A pill that glides to the page you are on.
  const { pathname } = useLocation();
  const slide = useSlider<HTMLElement>('[aria-current="page"]', pathname);
  return (
    <div className="min-h-dvh text-ink">
      <div ref={top} aria-hidden="true" className="pointer-events-none absolute top-0 left-0 h-xs w-xs" />
      <header data-scrolled={scrolled ? '' : undefined} className="fx-header safe-top relative z-30 md:sticky md:top-0">
        <div className={`mx-auto flex min-w-0 ${wide ? 'max-w-[1080px]' : 'max-w-[720px]'} items-center justify-between gap-sm px-md py-xs`}>
          <Logo />
          <nav ref={slide.ref} aria-label="Site" className="fx-slide fx-slide-paper flex min-w-0 items-center gap-xs">
            <NavLink to="/explore" className={navWide}>
              Explore
            </NavLink>
            {wide && (
              <NavLink to="/features" end className={navWide}>
                Features
              </NavLink>
            )}
            {wide && (
              <NavLink to="/7rp" className={navWide}>
                7RP
              </NavLink>
            )}
            {wide && (
              <a href="/#brands" className={navWide}>
                For brands
              </a>
            )}
            {!token && (
              <Link to="/signin" className={navWide}>
                Sign in
              </Link>
            )}
            <Link to={entry} className="toy inline-flex min-h-[44px] shrink-0 items-center whitespace-nowrap rounded-pill bg-ink px-md text-[16px] font-bold text-on-ink max-[380px]:px-sm">
              Go to app
            </Link>
            <ThemeToggle />
          </nav>
        </div>
      </header>
      <main className={`mx-auto ${wide ? 'max-w-[1080px]' : 'max-w-[720px]'} px-md md:px-lg lg:px-xl pb-2xl`}>{children}</main>
      <footer
        className="relative mt-xl overflow-hidden rounded-t-card bg-card shadow-toy-soft"
        // Like land under a dusk sky: indigo and sky blue above, then green, then the brown earth at the bottom, so the page ends on something solid.
        style={{ backgroundImage: 'linear-gradient(180deg, color-mix(in oklab, var(--color-r6) 14%, transparent), color-mix(in oklab, var(--color-r5) 12%, transparent) 30%, color-mix(in oklab, var(--color-r4) 12%, transparent) 62%, color-mix(in oklab, var(--color-earth) 20%, transparent))' }}
      >
        <Posy tone="ink" kind="lotus" className="right-0 bottom-0" />
        <div className={`relative mx-auto flex ${wide ? 'max-w-[1080px]' : 'max-w-[720px]'} flex-col gap-md px-md py-lg md:flex-row md:items-start md:justify-between`}>
          <div>
            <Logo />
            <p className="mt-xs m-0 max-w-[420px] text-[14px] font-semibold text-ink-soft">A daily game for the seven relationships that make a life, with the tools a creator needs built in. One small act a day, for all seven. Free to start, free to stay.</p>
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-xs text-[14px] font-bold text-ink-soft sm:grid-cols-3">
            <Link to="/explore" className="min-h-[44px] hover:text-ink">
              Explore
            </Link>
            <Link to="/7rp" className="min-h-[44px] hover:text-ink">
              7RP
            </Link>
            <Link to="/features" className="min-h-[44px] hover:text-ink">
              Features
            </Link>
            <a href="/#brands" className="min-h-[44px] hover:text-ink">
              For brands
            </a>
            <Link to="/features/help" className="min-h-[44px] hover:text-ink">
              Help
            </Link>
            <Link to="/signin" className="min-h-[44px] hover:text-ink">
              Sign in
            </Link>
            <Link to="/pricing" className="min-h-[44px] hover:text-ink">
              Pricing
            </Link>
            <Link to="/terms" className="min-h-[44px] hover:text-ink">
              Terms
            </Link>
            <Link to="/privacy" className="min-h-[44px] hover:text-ink">
              Privacy
            </Link>
            <Link to="/refunds" className="min-h-[44px] hover:text-ink">
              Refunds
            </Link>
            <Link to="/contact" className="min-h-[44px] hover:text-ink">
              Contact
            </Link>
            <Link to="/subprocessors" className="min-h-[44px] hover:text-ink">
              Subprocessors
            </Link>
            <Link to="/copyright" className="min-h-[44px] hover:text-ink">
              Copyright
            </Link>
            <Link to="/licences" className="min-h-[44px] hover:text-ink">
              Licences
            </Link>
            <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('kreators:open-consent'))} className="min-h-[44px] text-left hover:text-ink">
              Privacy choices
            </button>
          </nav>
          <Segmented
            label="Theme"
            value={themeMode}
            onChange={setThemeMode}
            options={[
              { value: 'system', label: 'Auto' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </div>
        <Ornament className="mt-xs" />
        <p className="relative m-0 px-md text-center text-[12px] font-semibold text-ink-mute">Your journal and wellbeing numbers are never shown to brands, staff, the leaderboard or Club selection.</p>
        <p className="relative m-0 px-md pb-lg text-center text-[12px] font-semibold text-ink-mute">
          Built with ❤️ by{' '}
          <a href="https://brandingbum.com" target="_blank" rel="noopener noreferrer" className="font-bold underline underline-offset-4 hover:text-ink">
            BrandingBum
          </a>
        </p>
        <div className="relative flex h-[8px]" aria-hidden="true" data-footer-ground>
          <span className="flex-1" style={{ background: 'var(--color-r6)' }} />
          <span className="flex-1" style={{ background: 'var(--color-r5)' }} />
          <span className="flex-1" style={{ background: 'var(--color-r4)' }} />
          <span className="flex-1" style={{ background: 'var(--color-earth)' }} />
        </div>
      </footer>
    </div>
  );
}
