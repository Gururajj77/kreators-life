import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { STICKY_CLOSE_CHANGED } from '../StickyClose';

/**
 * The large title's small twin. Wrap the page's own <h1>; once it has scrolled up past the top, a small centred copy of the title fades in
 * on a blurred bar at the top of the screen (the iOS large-title behaviour), and goes again when the title returns. Only opacity and
 * transform change, the bar is fixed so nothing moves in the page, and it is hidden from screen readers (the real heading is the one
 * that counts). Pointer-events are off, so it never covers a control.
 */
export function CondensedTitle({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setOn(Boolean(e) && !e?.isIntersecting && (e?.boundingClientRect.bottom ?? 0) < 0), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  // The bar's coming and going moves the line a sticky close or its slim bar sticks under (`--sc-cond` in app.css). The observer says so
  // after the scroll that caused it, so a single jump (a hash, On this page) would leave them read against the old line: say it.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    window.dispatchEvent(new Event(STICKY_CLOSE_CHANGED));
  }, [on]);
  return (
    <>
      <div ref={ref} className={className}>
        {children}
      </div>
      {title && typeof document !== 'undefined' &&
        createPortal(
          <div aria-hidden="true" data-on={on ? '' : undefined} className="fx-condensed fx-bar">
            <span>{title}</span>
          </div>,
          document.body,
        )}
    </>
  );
}
