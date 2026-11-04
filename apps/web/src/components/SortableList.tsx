import gsap from 'gsap';
import { GripVertical } from 'lucide-react';
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { prefersReducedMotion } from './fx/env';
import { tick } from './fx/haptics';
import { Icon } from './Icon';

/** The KanbanBoard's feel: a mouse or pen lifts a row after this much movement; a finger after holding still this long (moving first scrolls). */
const MOUSE_SLOP = 6;
const TOUCH_SLOP = 8;
const TOUCH_HOLD_MS = 250;
/** How near the screen's top or bottom edge the pointer must be for the page to scroll while dragging, and the fastest it scrolls a frame. */
const EDGE = 72;
const EDGE_SPEED = 14;

interface Props<T> {
  items: readonly T[];
  keyOf: (item: T) => string;
  /** Called once a row lands somewhere new (also by the Move up and Move down buttons the row draws itself). */
  onMove: (from: number, to: number) => void;
  /** One row. `handle` is the drag handle to place in it (44 by 44, pointer only; the keyboard uses Move up and Move down). */
  children: (item: T, index: number, handle: ReactNode) => ReactNode;
  className?: string;
}

/**
 * A list whose rows can be put in another order by dragging a handle, with the KanbanBoard's fluid feel: pointer events, so a mouse,
 * a pen and a finger all work; a finger lifts a row after a short hold that has not moved, so a swipe over a handle still scrolls the
 * page. The lifted row follows the pointer, the others slide aside where it would land (GSAP), the page scrolls near the screen's
 * edge, Escape puts it back, and dropping glides it into its gap. Under reduced motion nothing glides: rows jump into place. The order
 * shows at once and holds while the screen saves it.
 */
export function SortableList<T>({ items, keyOf, onMove, children, className = '' }: Props<T>) {
  const list = useRef<HTMLUListElement>(null);
  const press = useRef<{ lifted: boolean; cleanup: () => void } | null>(null);
  const sig = items.map(keyOf).join('|');
  // The order just dropped, shown until the saved order arrives (or a few seconds pass, if the save was refused).
  const [held, setHeld] = useState<{ sig: string; keys: string[] } | null>(null);
  const shown = held && held.sig === sig ? held.keys.map((k) => items.find((i) => keyOf(i) === k)).filter((i): i is T => i !== undefined) : items;
  useEffect(() => {
    if (!held) return;
    const t = window.setTimeout(() => setHeld(null), 4000);
    return () => window.clearTimeout(t);
  }, [held]);
  // Once the list moves on (the saved order arrived, or another move or a reset), the held order is spent: forget it, so a later
  // change that returns to the old order never brings the dropped one back.
  useEffect(() => {
    if (held && held.sig !== sig) setHeld(null);
  }, [held, sig]);

  // A finger that is dragging must not scroll the page. Only a listener that is not passive can say so, and it must be there before
  // the touch starts, so it sits on the list for good and does nothing unless a row is lifted.
  useEffect(() => {
    const el = list.current;
    if (!el) return;
    const stop = (e: TouchEvent) => {
      if (press.current?.lifted) e.preventDefault();
    };
    el.addEventListener('touchmove', stop, { passive: false });
    return () => el.removeEventListener('touchmove', stop);
  }, []);
  useEffect(
    () => () => {
      press.current?.cleanup();
      press.current = null;
    },
    [],
  );

  const start = (e: ReactPointerEvent<HTMLElement>, index: number) => {
    if (press.current || !e.isPrimary) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const el = list.current;
    if (!el) return;
    const rows = Array.from(el.querySelectorAll<HTMLElement>(':scope > [data-srow]'));
    const li = rows[index];
    if (!li || rows.length < 2) return;
    const touch = e.pointerType === 'touch';
    const pid = e.pointerId;
    const still = prefersReducedMotion();
    const scroll0 = window.scrollY;
    // Page coordinates, so a page that scrolls while dragging keeps the maths right.
    const tops = rows.map((r) => r.getBoundingClientRect().top + scroll0);
    const heights = rows.map((r) => r.getBoundingClientRect().height);
    const gapPx = rows.length > 1 ? Math.max(0, tops[1]! - (tops[0]! + heights[0]!)) : 0;
    const step = heights[index]! + gapPx;
    const minDy = tops[0]! - tops[index]!;
    const maxDy = tops[rows.length - 1]! + heights[rows.length - 1]! - (tops[index]! + heights[index]!);
    const p = {
      lifted: false,
      settling: false,
      startX: e.clientX,
      startPageY: e.clientY + scroll0,
      x: e.clientX,
      y: e.clientY,
      target: index,
      timer: null as number | null,
      raf: null as number | null,
      cleanup: () => {},
    };

    const dyNow = () => Math.max(minDy, Math.min(maxDy, p.y + window.scrollY - p.startPageY));
    const targetFor = (dy: number) => {
      const mid = tops[index]! + heights[index]! / 2 + dy;
      let t = 0;
      rows.forEach((_, i) => {
        if (i !== index && tops[i]! + heights[i]! / 2 < mid) t++;
      });
      return t;
    };
    const shiftOthers = (t: number) => {
      rows.forEach((r, i) => {
        if (i === index) return;
        const y = index < i && i <= t ? -step : t <= i && i < index ? step : 0;
        if (still) gsap.set(r, { y });
        else
          gsap.to(r, {
            y,
            duration: 0.22,
            ease: 'power3.out',
            overwrite: true,
          });
      });
    };
    const follow = () => {
      const dy = dyNow();
      gsap.set(li, { y: dy });
      const t = targetFor(dy);
      if (t !== p.target) {
        p.target = t;
        shiftOthers(t);
      }
    };
    const frame = () => {
      if (!p.lifted || p.settling) return;
      let speed = 0;
      if (p.y < EDGE) speed = -Math.ceil(((EDGE - p.y) / EDGE) * EDGE_SPEED);
      else if (p.y > window.innerHeight - EDGE) speed = Math.ceil(((p.y - (window.innerHeight - EDGE)) / EDGE) * EDGE_SPEED);
      if (speed !== 0) {
        const was = window.scrollY;
        window.scrollBy(0, speed);
        if (window.scrollY !== was) follow();
      }
      p.raf = requestAnimationFrame(frame);
    };
    const lift = () => {
      if (p.lifted) return;
      p.lifted = true;
      if (p.timer !== null) window.clearTimeout(p.timer);
      p.timer = null;
      window.getSelection()?.removeAllRanges();
      document.documentElement.classList.add('kanban-drag');
      li.classList.add('sort-lifted');
      if (!still) gsap.to(li, { scale: 1.02, duration: 0.15, ease: 'power2.out' });
      tick();
      p.raf = requestAnimationFrame(frame);
    };
    const reset = () => {
      rows.forEach((r) => {
        gsap.killTweensOf(r);
        gsap.set(r, { clearProps: 'transform' });
      });
      li.classList.remove('sort-lifted');
    };
    const drop = (cancel: boolean) => {
      if (p.settling) return;
      p.settling = true;
      if (p.raf !== null) cancelAnimationFrame(p.raf);
      const to = cancel ? index : p.target;
      if (cancel) shiftOthers(index);
      const y = to > index ? tops[to]! + heights[to]! - (tops[index]! + heights[index]!) : to < index ? tops[to]! - tops[index]! : 0;
      const finish = () => {
        p.cleanup();
        press.current = null;
        if (to !== index) {
          const keys = shown.map(keyOf);
          const [k] = keys.splice(index, 1);
          keys.splice(to, 0, k!);
          // The new order is in the DOM before the slides are cleared, so nothing jumps back for a frame.
          flushSync(() => setHeld({ sig, keys }));
        }
        reset();
        tick();
        if (to !== index) onMove(index, to);
      };
      if (still) finish();
      else
        gsap.to(li, {
          y,
          scale: 1,
          duration: 0.24,
          ease: 'power3.out',
          overwrite: true,
          onComplete: finish,
        });
    };

    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== pid || p.settling) return;
      p.x = ev.clientX;
      p.y = ev.clientY;
      if (!p.lifted) {
        const dist = Math.hypot(p.x - p.startX, p.y + window.scrollY - p.startPageY);
        if (touch) {
          if (dist > TOUCH_SLOP) end(); // a swipe: let the page scroll
        } else if (dist > MOUSE_SLOP) lift();
        return;
      }
      ev.preventDefault();
      follow();
    };
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== pid) return;
      if (p.lifted) drop(ev.type === 'pointercancel');
      else end();
    };
    const key = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape' && p.lifted) {
        ev.preventDefault();
        drop(true);
      }
    };
    const end = () => {
      p.cleanup();
      press.current = null;
    };
    p.cleanup = () => {
      if (p.timer !== null) window.clearTimeout(p.timer);
      if (p.raf !== null) cancelAnimationFrame(p.raf);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      window.removeEventListener('keydown', key);
      document.documentElement.classList.remove('kanban-drag');
    };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    window.addEventListener('keydown', key);
    if (touch) p.timer = window.setTimeout(lift, TOUCH_HOLD_MS);
    press.current = p;
  };

  return (
    <ul ref={list} className={className}>
      {shown.map((item, i) => (
        <li key={keyOf(item)} data-srow="">
          {children(
            item,
            i,
            <span
              aria-hidden="true"
              data-drag-handle=""
              onPointerDown={(e) => start(e, i)}
              onContextMenu={(e) => e.preventDefault()}
              className="sort-handle flex size-[44px] shrink-0 cursor-grab items-center justify-center rounded-pill text-ink-mute hover:text-ink"
            >
              <Icon icon={GripVertical} size={20} />
            </span>,
          )}
        </li>
      ))}
    </ul>
  );
}
