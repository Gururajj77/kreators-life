import type { ReactNode } from 'react';
import { HowItWorks } from './HowTo';

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
  className?: string;
}

/**
 * The page frame. On a phone it is a single 480px column with the tab bar below.
 * On a laptop the tab bar becomes a sidebar on the left and the content uses the width as one
 * column. Home alone asks for two, so its metric cards sit side by side.
 */
export function Screen({ children, tabs = true, columns = false, wide = false, howTo = true, className = '' }: Props) {
  const width = tabs ? 'max-w-[480px] md:ml-[240px] md:max-w-[1040px] lg:mx-auto lg:pl-[240px]' : wide ? 'max-w-[480px] md:max-w-[1200px]' : 'max-w-[480px] md:max-w-[640px]';
  return (
    <main className={`safe-top screen mx-auto w-full px-md md:w-auto md:px-lg ${width} ${tabs ? 'pb-2xl md:pb-lg' : 'pb-lg'} ${columns ? 'screen-columns' : ''} ${className}`}>
      {children}
      {howTo && <HowItWorks />}
    </main>
  );
}
