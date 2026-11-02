import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

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
