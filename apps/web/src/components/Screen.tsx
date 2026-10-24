import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Leave room for the tab bar (phone) or the sidebar (laptop). */
  tabs?: boolean;
  /** On wide screens, lay sections out in two columns. Off for forms and focused flows. */
  columns?: boolean;
  className?: string;
}

/**
 * The page frame. On a phone it is a single 480px column with the tab bar below.
 * On a laptop the tab bar becomes a sidebar on the left and the content uses the width:
 * the header spans both columns, then sections flow into two.
 */
export function Screen({ children, tabs = true, columns = tabs, className = '' }: Props) {
  const width = tabs ? 'max-w-[480px] md:ml-[240px] md:max-w-[1040px] lg:mx-auto lg:pl-[240px]' : 'max-w-[480px] md:max-w-[640px]';
  return (
    <main className={`safe-top screen mx-auto w-full px-md md:px-lg ${width} ${tabs ? 'pb-2xl md:pb-lg' : 'pb-lg'} ${columns ? 'screen-columns' : ''} ${className}`}>{children}</main>
  );
}
