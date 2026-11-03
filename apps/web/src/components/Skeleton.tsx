import { createContext, useContext, useLayoutEffect, useRef, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { useRunning } from './fx/env';

/**
 * Loading placeholders. Every block in one loading region shares one calm diagonal light sweep (learned from a
 * shimmering skeleton wrapper, built here): each block's band is as big as the whole region and is shifted back
 * by the block's own offset inside it, so the band reads as one pass over the region instead of each block
 * flickering on its own. Only transform moves (app.css, the `fx-skel` block); the region sets `data-run` so
 * nothing sweeps off screen or in a hidden tab, and under reduced motion the blocks stay plain and still.
 */

/** True inside a region that measures and runs its own blocks. */
const InRegion = createContext(false);

/** Measures every block inside the region: the region's size on the region, each block's offset on the block. */
function useSkelLayout(ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const region = ref.current;
    if (!region) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const box = region.getBoundingClientRect();
      region.style.setProperty('--skel-w', `${Math.round(box.width)}px`);
      region.style.setProperty('--skel-h', `${Math.round(box.height)}px`);
      region.querySelectorAll<HTMLElement>('.fx-skel').forEach((el) => {
        // A block inside a nested region (a SkeletonList inside a Busy) is measured by that region, never by this one too.
        if (el === region || el.parentElement?.closest('.fx-skel-region') !== region) return;
        const r = el.getBoundingClientRect();
        el.style.setProperty('--skel-x', `${Math.round(r.left - box.left)}px`);
        el.style.setProperty('--skel-y', `${Math.round(r.top - box.top)}px`);
      });
    };
    const later = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(later);
    ro?.observe(region);
    const mo = typeof MutationObserver === 'undefined' ? null : new MutationObserver(later);
    mo?.observe(region, { childList: true, subtree: true });
    return () => {
      ro?.disconnect();
      mo?.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [ref]);
}

/** The region's ref, its measuring and its `data-run`. */
function useSkelRegion<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useSkelLayout(ref);
  const running = useRunning(ref);
  return { ref, running };
}

/** A block standing alone (not inside a Busy or SkeletonList) is its own region. */
function LoneSkeleton({ className, style }: { className: string; style?: CSSProperties }) {
  const { ref, running } = useSkelRegion<HTMLDivElement>();
  return <div ref={ref} aria-hidden="true" style={style} data-run={running} className={`fx-skel fx-skel-region rounded-tile bg-line/60 ${className}`} />;
}

/**
 * A quiet placeholder block shown while a screen's main content loads. It only reserves the space the real
 * content will take, so nothing jumps when it arrives. Hidden from screen readers (the wrapper says "Loading").
 */
export function Skeleton({ className = '', style }: { className?: string; style?: CSSProperties }) {
  const inRegion = useContext(InRegion);
  if (!inRegion) return <LoneSkeleton className={className} style={style} />;
  return <div aria-hidden="true" style={style} className={`fx-skel rounded-tile bg-line/60 ${className}`} />;
}

/** One card-shaped placeholder: a title bar and a few lines. */
export function SkeletonCard({ lines = 2, className = '' }: { lines?: number; className?: string }) {
  const inRegion = useContext(InRegion);
  const card = (
    <div aria-hidden="true" className={`rounded-card bg-card p-md shadow-toy-soft ${className}`}>
      <Skeleton className="h-[16px] w-1/3" />
      <div className="mt-sm flex flex-col gap-xs">
        {Array.from({ length: lines }, (_, i) => (
          <Skeleton key={i} className={`h-[12px] ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />
        ))}
      </div>
    </div>
  );
  return inRegion ? card : <SkelRegion>{card}</SkelRegion>;
}

/** A plain wrapper that makes its blocks one sweep (used by a card shown on its own). */
function SkelRegion({ children }: { children: ReactNode }) {
  const { ref, running } = useSkelRegion<HTMLDivElement>();
  return (
    <div ref={ref} data-run={running} className="fx-skel-region">
      <InRegion.Provider value={true}>{children}</InRegion.Provider>
    </div>
  );
}

/** A stack of card placeholders. `label` is read out once to screen readers. */
export function SkeletonList({ count = 3, lines = 2, label = 'Loading', className = '' }: { count?: number; lines?: number; label?: string; className?: string }) {
  const { ref, running } = useSkelRegion<HTMLDivElement>();
  return (
    <div ref={ref} role="status" aria-busy="true" data-run={running} className={`fx-skel-region flex flex-col gap-sm ${className}`}>
      <span className="sr-only">{label}</span>
      <InRegion.Provider value={true}>
        {Array.from({ length: count }, (_, i) => (
          <SkeletonCard key={i} lines={lines} />
        ))}
      </InRegion.Provider>
    </div>
  );
}

/** A busy region: wraps placeholders so assistive tech hears one "Loading", the region is marked busy and its blocks sweep as one. */
export function Busy({ label = 'Loading', className = '', children }: { label?: string; className?: string; children: ReactNode }) {
  const { ref, running } = useSkelRegion<HTMLDivElement>();
  return (
    <div ref={ref} role="status" aria-busy="true" data-run={running} className={`fx-skel-region ${className}`}>
      <span className="sr-only">{label}</span>
      <InRegion.Provider value={true}>{children}</InRegion.Provider>
    </div>
  );
}
