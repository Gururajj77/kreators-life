import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { BrandMark } from '../components/BrandMark';
import { useSession } from '../lib/store';
import { useFocusSession } from '../lib/focusSession';
import { FocusPill } from '../components/FocusPill';
import { useTheme } from '../lib/theme';
import { ThemeToggle } from '../components/ThemeToggle';
import { Segmented } from '../components/fx/Segmented';
import { useSlider } from '../components/fx/useSlider';
import { SITE_PRIMARY_SM } from './buttons';
import { setConsentSlot } from '../lib/consentSlot';

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
    'relative min-h-[44px] shrink-0 items-center whitespace-nowrap rounded-pill px-sm text-callout text-ink-soft transition-colors hover:text-ink aria-[current=page]:text-ink';
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
        <div className="mx-auto flex min-w-0 max-w-[1080px] items-center justify-between gap-sm px-md py-xs md:px-lg lg:px-xl">
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
      {/* On a phone the privacy card, while it asks, sits here in the page's flow (ConsentPopup portals into it), so it covers nothing. */}
      <div ref={setConsentSlot} className="mx-auto max-w-[720px] px-md empty:hidden md:hidden" />
      <main className={`mx-auto ${wide ? 'max-w-[1080px]' : 'max-w-[720px]'} px-md md:px-lg lg:px-xl pb-xl`}>{children}</main>
      {/* The footer (2026-11-05, laid out after the founder's FyndFlow footer): the brand and a glass card on the left, the links in three
          headed columns on the right, a hairline, then a bottom bar (who built it on the left, the main policies on the right), the
          privacy line, and the wordmark rising out of the foot behind fluted glass, over the four-colour ground. */}
      <footer className="site-footer relative mt-xl overflow-hidden rounded-t-card">
        <div className="relative mx-auto max-w-[1080px] px-md pt-xl md:px-lg lg:px-xl">
          <div className="grid gap-lg lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:gap-xl">
            <div>
              <Logo />
              <div className="mt-sm rounded-tile bg-card-strong p-md shadow-toy-soft">
                <p className="m-0 text-subhead font-medium text-ink">One small act a day, for all seven.</p>
                <p className="mt-xs m-0 text-subhead text-ink-soft">A daily game for the seven relationships, with a creator’s tools built in. Free to start, free to stay.</p>
                <Segmented
                  label="Theme"
                  value={themeMode}
                  onChange={setThemeMode}
                  className="mt-md"
                  options={[
                    { value: 'system', label: 'Auto' },
                    { value: 'light', label: 'Light' },
                    { value: 'dark', label: 'Dark' },
                  ]}
                />
              </div>
            </div>
            {/* Three columns, each with its heading; on a phone the first two side by side and Legal across both, its links in two columns. */}
            <nav aria-label="Footer" className="grid grid-cols-2 gap-x-md gap-y-lg sm:grid-cols-3">
              <FooterGroup title="Explore">
                <FooterLink to="/explore">Explore</FooterLink>
                <FooterLink to="/7rp">7RP</FooterLink>
                <FooterLink to="/features">Features</FooterLink>
                <FooterLink to="/features/books">Books</FooterLink>
                <FooterLink href="/#brands">For brands</FooterLink>
              </FooterGroup>
              <FooterGroup title="Get started">
                {/* Like the header: sign-in without a session, the app (Home) with one. */}
                <FooterLink to={entry}>{token ? 'Go to app' : 'Sign in'}</FooterLink>
                <FooterLink to="/pricing">Pricing</FooterLink>
                <FooterLink to="/features/help">Help</FooterLink>
                <FooterLink to="/contact">Contact</FooterLink>
              </FooterGroup>
              <FooterGroup title="Legal" className="col-span-2 sm:col-span-1" listClassName="grid grid-cols-2 gap-x-md sm:grid-cols-1">
                <FooterLink to="/refunds">Refunds</FooterLink>
                <FooterLink to="/subprocessors">Subprocessors</FooterLink>
                <FooterLink to="/copyright">Copyright</FooterLink>
                <FooterLink to="/licences">Licences</FooterLink>
              </FooterGroup>
            </nav>
          </div>
          <div className="mt-xl flex flex-wrap-reverse items-center justify-between gap-x-lg gap-y-xs border-t border-line pt-sm text-subhead text-ink-soft">
            <p className="m-0 py-xs">
              © {new Date().getFullYear()} kreators.app. Built <span className="whitespace-nowrap">with ❤️</span> in India by{' '}
              <a href="https://brandingbum.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-ink underline underline-offset-4 hover:text-ink-soft">
                BrandingBum
              </a>
            </p>
            <ul className="m-0 flex list-none flex-wrap gap-x-md p-0">
              <li>
                <Link to="/terms" className="flex min-h-[44px] min-w-[44px] items-center hover:text-ink">
                  Terms
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="flex min-h-[44px] min-w-[44px] items-center hover:text-ink">
                  Privacy
                </Link>
              </li>
              <li>
                <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('kreators:open-consent'))} className="flex min-h-[44px] min-w-[44px] items-center hover:text-ink">
                  Privacy choices
                </button>
              </li>
            </ul>
          </div>
          <p className="mt-xs m-0 text-caption text-ink-mute">Your journal and wellbeing are never shown to brands, staff, the leaderboard or Club selection.</p>
          <p className="mt-xs m-0 text-caption text-ink-mute">
            kreators.app cannot help in an emergency. If you might hurt yourself, call your local emergency number or go to the nearest hospital, and tell someone you trust. In India, call Tele-MANAS on 14416, day or night.
          </p>
        </div>
        {/* The wordmark, as big as the footer is wide, seen through fluted glass and cut by the ground: drawn by CSS (::before), so it is
            never read twice and never a text node. It is a link home (the founder, 2026-11-05): its name is the aria-label, and on
            hover or keyboard focus it rises a little and its fade lessens (".site-footer-mark" in app.css). */}
        <Link to="/" className="site-footer-mark" aria-label="kreators.app, back to the home page" />
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

/** A footer column: a small heading over its links. */
function FooterGroup({ title, children, className = '', listClassName = '' }: { title: string; children: ReactNode; className?: string; listClassName?: string }) {
  return (
    <div className={className}>
      <h2 className="m-0 type-eyebrow text-ink-mute">{title}</h2>
      <ul className={`mt-xs m-0 list-none p-0 ${listClassName}`}>{children}</ul>
    </div>
  );
}

/** One footer link: on its own line, 44px tall, its words never wrapped. */
function FooterLink({ to, href, children }: { to?: string; href?: string; children: ReactNode }) {
  const cls = 'flex min-h-[44px] items-center whitespace-nowrap text-subhead text-ink-soft hover:text-ink';
  return <li>{href ? <a href={href} className={cls}>{children}</a> : <Link to={to ?? '/'} className={cls}>{children}</Link>}</li>;
}
