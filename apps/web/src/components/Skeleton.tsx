import type { CSSProperties, ReactNode } from 'react';

/**
 * A quiet placeholder block shown while a screen's main content loads. It only reserves the space the real
 * content will take, so nothing jumps when it arrives. Hidden from screen readers (the wrapper says "Loading"),
 * and it stops pulsing when the person asked for less motion.
 */
export function Skeleton({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return <div aria-hidden="true" style={style} className={`animate-pulse rounded-tile bg-line/60 motion-reduce:animate-none ${className}`} />;
}

/** One card-shaped placeholder: a title bar and a few lines. */
export function SkeletonCard({ lines = 2, className = '' }: { lines?: number; className?: string }) {
  return (
    <div aria-hidden="true" className={`rounded-card bg-card p-md shadow-toy-soft ${className}`}>
      <Skeleton className="h-[16px] w-1/3" />
      <div className="mt-sm flex flex-col gap-xs">
        {Array.from({ length: lines }, (_, i) => (
          <Skeleton key={i} className={`h-[12px] ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />
        ))}
      </div>
    </div>
  );
}

/** A stack of card placeholders. `label` is read out once to screen readers. */
export function SkeletonList({ count = 3, lines = 2, label = 'Loading', className = '' }: { count?: number; lines?: number; label?: string; className?: string }) {
  return (
    <div role="status" aria-busy="true" className={`flex flex-col gap-sm ${className}`}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} lines={lines} />
      ))}
    </div>
  );
}

/** A busy region: wraps placeholders so assistive tech hears one "Loading" and the region is marked busy. */
export function Busy({ label = 'Loading', className = '', children }: { label?: string; className?: string; children: ReactNode }) {
  return (
    <div role="status" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
