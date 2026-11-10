import type { ReactNode } from 'react';
import { HowItWorks } from './HowTo';
import { SkipLink } from './SkipLink';

interface Props {
  children: ReactNode;
  /** Leave room for the tab bar (phone) or the sidebar (laptop). */
  tabs?: boolean;
  /** On wide screens, let sections flow into two columns. Off everywhere but Home: every app is one full-width column. */
  columns?: boolean;
  /** A standalone screen that needs the whole laptop width, like a console of tables. */
  wide?: boolean;
  /** Every app's main screen ends with its "How it works". A screen with its own section turns this off. */
  howTo?: boolean;
  /** The assistant's round button floats over this screen on a phone (every app screen but the Companion, which hides it). */
  assistant?: boolean;
  className?: string;
}

/**
 * The page frame. On a phone it is a single 480px column with the tab bar below.
 * On a laptop the tab bar becomes a sidebar on the left and the content uses the width as one
 * column. Home alone asks for two, so its metric cards sit side by side.
 */
// From the laptop width the column is centred and keeps the sidebar's width plus one gap on its left (2026-11-05: at 1024 the words met the
// sidebar's edge), and the frame is one gap wider, so the text column keeps its width.
// On a phone the foot keeps 168px (and the safe area) under the last control: the assistant's round button tops out 156px up, so the page's
// last row ends clear of it once scrolled to its end (2026-11-09, the founder's yes to 120px plus 48).
export function Screen({ children, tabs = true, columns = false, wide = false, howTo = true, assistant = true, className = '' }: Props) {
  const width = tabs ? 'max-w-[480px] md:ml-[var(--nav-w)] md:max-w-[1040px] lg:mx-auto lg:max-w-[calc(1040px+var(--spacing-lg))] lg:pl-[calc(var(--nav-w)+var(--spacing-lg))]' : wide ? 'max-w-[480px] md:max-w-[1200px]' : 'max-w-[480px] md:max-w-[640px]';
  return (
    <>
      <SkipLink />
      {/* On this page (PageContents.tsx) draws here, so the keyboard meets it before the page and not after every control in it. */}
      <div data-contents-slot="" className="contents" />
      {/* tabIndex -1 lets the skip link land here; the page itself is not a control, so it draws no ring when it is focused. */}
      <main id="main" tabIndex={-1} className={`safe-top screen focus-visible:outline-none mx-auto w-full px-md md:w-auto md:px-lg ${width} ${tabs ? `${assistant ? 'pb-[calc(var(--spacing-2xl)+var(--spacing-lg)+var(--spacing-md)+env(safe-area-inset-bottom))]' : 'pb-2xl'} md:pb-lg` : 'pb-lg'} ${columns ? 'screen-columns' : ''} ${className}`}>
        {children}
        {howTo && <HowItWorks />}
      </main>
    </>
  );
}
