import { useRef, type CSSProperties, type ReactNode } from 'react';
import { useRunning } from './env';

/**
 * A row that drifts sideways, forever, pausing under the pointer or the keyboard and while off screen or in a hidden tab. CSS only: the
 * items are drawn twice and the track slides half its width. The second copy is `inert` (not read, not focusable). Reduced motion turns it
 * into a plain row that scrolls by hand. `label` names the list for screen readers.
 */
export function Marquee({ children, label, duration = 90, reverse = false, className = '' }: { children: ReactNode; label: string; duration?: number; reverse?: boolean; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const running = useRunning(ref);
  return (
    <div ref={ref} role="region" aria-label={label} data-run={running} data-reverse={reverse || undefined} className={`fx-marquee ${className}`} style={{ '--fx-dur': `${duration}s` } as CSSProperties}>
      <div className="fx-marquee-track">
        <ul className="fx-marquee-set">{children}</ul>
        <ul className="fx-marquee-set fx-marquee-copy" aria-hidden="true" inert>
          {children}
        </ul>
      </div>
    </div>
  );
}
