import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Leave room for the tab bar. */
  tabs?: boolean;
  className?: string;
}

export function Screen({ children, tabs = true, className = '' }: Props) {
  return (
    <main className={`safe-top mx-auto w-full max-w-[480px] px-md ${tabs ? 'pb-2xl' : 'pb-lg'} ${className}`}>{children}</main>
  );
}
