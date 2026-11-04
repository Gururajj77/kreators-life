import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { BrandMark } from '../components/BrandMark';
import { Ornament, Posy } from '../components/Hero';
import { useSession } from '../lib/store';
import { useFocusSession } from '../lib/focusSession';
import { FocusPill } from '../components/FocusPill';
import { useTheme } from '../lib/theme';
import { ThemeToggle } from '../components/ThemeToggle';
import { Segmented } from '../components/fx/Segmented';
import { useSlider } from '../components/fx/useSlider';
import { SITE_PRIMARY_SM } from './buttons';

/** Where "Go to app" goes: straight in for people with a session, to sign in for everyone else. */
export function useAppEntry(): string {
  const token = useSession((s) => s.token);
  return token ? '/home' : '/signin';
}

export function Logo() {
  return (
    <Link to="/" className="inline-flex min-h-[44px] shrink-0 items-center whitespace-nowrap text-[22px]">
      <BrandMark />
    </Link>
  );
}

/**
 * The frame of the public site. `minimal` is for pages a client opens from a link (the agency client page, invoices, agreements, documents):
 * the header keeps only the logo and the theme switch, with no Explore, Sign in or Go to app; the footer and its privacy links stay.
 */
export function SiteLayout({ children, wide = true, minimal = false }: { children: ReactNode; wide?: boolean; minimal?: boolean }) {
  const entry = useAppEntry();
  const token = useSession((s) => s.token);
  // Signed in with a focus clock running or paused: the pill sits beside the wordmark (in its place on a phone, where the header is tight).
  const clock = useFocusSession((s) => s.snap.active) && Boolean(token);
  const themeMode = useTheme((s) => s.mode);
  const setThemeMode = useTheme((s) => s.setMode);
  // Two classes, because Tailwind 4 orders `inline-flex` after `hidden`: a link that carries both would always show.
  const navBase =
    'relative min-h-[44px] shrink-0 items-center whitespace-nowrap rounded-pill px-sm text-[16px] font-bold text-ink-soft transition-colors hover:text-ink aria-[current=page]:text-ink';
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
    <div className="min-h-dvh overflow-x-clip text-ink">
      <div ref={top} aria-hidden="true" className="pointer-events-none absolute top-0 left-0 h-xs w-xs" />
      <header data-scrolled={scrolled ? '' : undefined} className="fx-header safe-top relative z-30 md:sticky md:top-0">
        {/* The header and the footer are the same width on every page, like the home page; only the reading column narrows. */}
        <div className="mx-auto flex min-w-0 max-w-[1080px] items-center justify-between gap-sm px-md py-xs">
          {clock ? (
            <span className="flex min-w-0 items-center gap-xs">
              <span className="hidden md:flex">
                <Logo />
              </span>
              <FocusPill compact />
            </span>
          ) : (
            <Logo />
          )}
          {minimal ? (
            <ThemeToggle />
          ) : (
            <nav ref={slide.ref} aria-label="Site" className="fx-slide fx-slide-paper flex min-w-0 items-center gap-xs">
              <NavLink to="/explore" className={navWide}>
                Explore
              </NavLink>
              <NavLink to="/features" end className={navWide}>
                Features
              </NavLink>
              <NavLink to="/7rp" className={navWide}>
                7RP
              </NavLink>
              <a href="/#brands" className={navWide}>
                For brands
              </a>
              {!token && (
                <Link to="/signin" className={navWide}>
                  Sign in
                </Link>
              )}
              <Link
                to={entry}
                className={`${SITE_PRIMARY_SM} shrink-0 whitespace-nowrap max-[380px]:px-sm`}
              >
                Go to app
              </Link>
              <ThemeToggle />
            </nav>
          )}
        </div>
      </header>
      <main className={`mx-auto ${wide ? 'max-w-[1080px]' : 'max-w-[720px]'} px-md md:px-lg lg:px-xl pb-xl`}>{children}</main>
      <footer
        className="relative mt-xl overflow-hidden rounded-t-card bg-card shadow-toy-soft"
        // Like land under a dusk sky: indigo and sky blue above, then green, then the brown earth at the bottom, so the page ends on something solid.
        style={{
          backgroundImage:
            'linear-gradient(180deg, color-mix(in oklab, var(--color-r6) 14%, transparent), color-mix(in oklab, var(--color-r5) 12%, transparent) 30%, color-mix(in oklab, var(--color-r4) 12%, transparent) 62%, color-mix(in oklab, var(--color-earth) 20%, transparent))',
        }}
      >
        <Posy tone="ink" kind="lotus" className="right-0 bottom-0" />
        {/* A row only from lg: on a tablet the four link columns, the words and the theme switch did not fit side by side. */}
        <div className="relative mx-auto flex max-w-[1080px] flex-col gap-md px-md py-lg lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Logo />
            <p className="mt-xs m-0 max-w-[420px] text-[14px] font-semibold text-ink-soft">
              A daily game for the seven relationships, with a creator’s tools built in. One small act a day, for all seven. Free to start, free to stay.
            </p>
          </div>
          {/* Columns as wide as their words, each link on one line: equal columns ran "Subprocessors" into "Copyright" and left "choices" alone. */}
          <nav aria-label="Footer" className="grid grid-cols-2 gap-xs whitespace-nowrap text-[14px] font-bold text-ink-soft sm:grid-cols-[repeat(4,max-content)] sm:gap-x-md">
            <Link to="/explore" className="min-h-[44px] hover:text-ink">
              Explore
            </Link>
            <Link to="/7rp" className="min-h-[44px] hover:text-ink">
              7RP
            </Link>
            <Link to="/features" className="min-h-[44px] hover:text-ink">
              Features
            </Link>
            <Link to="/features/books" className="min-h-[44px] hover:text-ink">
              Books
            </Link>
            <a href="/#brands" className="min-h-[44px] hover:text-ink">
              For brands
            </a>
            <Link to="/features/help" className="min-h-[44px] hover:text-ink">
              Help
            </Link>
            {/* Like the header: sign-in without a session, the app (Home) with one. */}
            <Link to={entry} className="min-h-[44px] hover:text-ink">
              {token ? 'Go to app' : 'Sign in'}
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
            <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('kreators:open-consent'))} className="flex min-h-[44px] items-start text-left hover:text-ink">
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
        <p className="relative m-0 px-md text-center text-[12px] font-semibold text-ink-mute">
          Your journal and wellbeing are never shown to brands, staff, the leaderboard or Club selection.
        </p>
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
