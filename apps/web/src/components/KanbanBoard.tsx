import type { BoardColumn } from '@kreators/shared';
import gsap from 'gsap';
import { ArrowLeftRight } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { Button } from './Button';
import { prefersReducedMotion } from './fx/env';
import { tick } from './fx/haptics';
import { Icon } from './Icon';
import { Sheet } from './Sheet';
import { StatusTag } from './StatusTag';

interface Props<T extends { id: string }> {
  columns: readonly (BoardColumn<T> & { name: string; note?: ReactNode })[];
  /** One card: keep it to a title, its tags and one line of facts. */
  card: (item: T, column: string) => ReactNode;
  /** The card's name, read out on its Move button ("Move Launch video"). */
  itemLabel: (item: T) => string;
  /** Move a card to another column. When it is missing the cards cannot be moved, only read. */
  onMove?: (item: T, from: string, to: string) => void;
  /** Ask for more cards in a column ("Show more"). */
  onMore?: (column: string) => void;
  /** What the Move menu may offer for a card; defaults to every other column. */
  canMoveTo?: (item: T, from: string, to: string) => boolean;
  empty?: string;
}

/** The fade at the right edge while the board has more columns to the right: a hint that it scrolls. */
const FADE: CSSProperties = {
  maskImage: 'linear-gradient(to right, black calc(100% - 64px), transparent)',
  WebkitMaskImage: 'linear-gradient(to right, black calc(100% - 64px), transparent)',
};

/** A mouse or pen lifts a card after this much movement; a finger after holding still this long (moving further first scrolls instead). */
const MOUSE_SLOP = 6;
const TOUCH_SLOP = 8;
const TOUCH_HOLD_MS = 250;
/** How near the board's side edge the pointer must be for the board to scroll while dragging, and the fastest it scrolls a frame. */
const EDGE = 56;
const EDGE_SPEED = 14;

/** The drag the screen draws: which card, where it came from, the column under the pointer and the gap opened there. */
interface Drag<T> {
  item: T;
  from: string;
  /** The column under the pointer, or null outside every column. */
  over: string | null;
  /** True when `over` may take the card (another column that canMoveTo allows). */
  ok: boolean;
  /** Where the gap opens among the column's other cards. */
  gap: number;
  /** The card's size and place when it was lifted (the clone starts there; the gap is its height). */
  rect: { left: number; top: number; width: number; height: number };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * A kanban board: a column for each stage with its name and count, cards that can be dragged to another column, and on every card one
 * 44px Move button that opens a sheet of the columns it may go to (for a keyboard or anyone who prefers it). A long column ends in "Show more".
 * The columns sit side by side at a readable width (260px at least) and the board scrolls sideways inside itself on every screen, so
 * the page never does; while there is more to the right, the right edge fades.
 *
 * Dragging is pointer events, so it works with a mouse, a pen and a finger: a mouse or pen lifts a card after 6px, a finger after a
 * 250ms press that has not moved (until then the board and the page scroll as usual). The lifted card leaves a dashed slot of its own
 * height, a copy follows the pointer and leans with its speed, the column under it lights and opens a gap where it would land while
 * the other cards slide aside (FLIP in GSAP), and near the board's side edge the board scrolls. Dropping glides the copy into the gap
 * and then moves the card; dropping at home, outside any column or pressing Escape glides it back. Under reduced motion nothing tilts,
 * glides or slides: the copy follows the pointer directly and cards jump into place. Nothing runs while nobody drags.
 */
export function KanbanBoard<T extends { id: string }>({ columns, card, itemLabel, onMove, onMore, canMoveTo, empty = 'Nothing here' }: Props<T>) {
  const [moving, setMoving] = useState<{ item: T; from: string } | null>(null);
  const [drag, setDragState] = useState<Drag<T> | null>(null);
  /** A card just dropped elsewhere: kept out of its old column until the new columns arrive, so it never flashes back. */
  const [landing, setLanding] = useState<{ item: T; id: string; from: string; to: string; gap: number } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const clone = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);

  /** The live drag, read by the window listeners (state alone would be stale inside them). */
  const live = useRef<Drag<T> | null>(null);
  /** Pointer bookkeeping for one press: where it began, where it is, how fast it moves sideways, and the listeners to take off. */
  const press = useRef<{
    id: number;
    touch: boolean;
    startX: number;
    startY: number;
    x: number;
    y: number;
    lastT: number;
    vx: number;
    lifted: boolean;
    settling: boolean;
    timer: number | null;
    raf: number | null;
    li: HTMLElement;
    item: T;
    from: string;
    cleanup: () => void;
  } | null>(null);
  /** Where each card sat before a layout change, for the FLIP slide. */
  const before = useRef<Map<string, number> | null>(null);
  const quick = useRef<{ x: gsap.QuickToFunc; y: gsap.QuickToFunc; r: gsap.QuickToFunc } | null>(null);

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setMore(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }, []);
  useEffect(() => {
    measure();
    const el = scroller.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, columns]);

  // A finger that is dragging must not scroll the page or the board. Only a listener that is not passive can say so, and it must be
  // there before the touch starts, so it sits on the board for good and does nothing unless a card is lifted.
  useEffect(() => {
    const el = scroller.current;
    if (!el || !onMove) return;
    const stop = (e: TouchEvent) => {
      if (press.current?.lifted) e.preventDefault();
    };
    el.addEventListener('touchmove', stop, { passive: false });
    return () => el.removeEventListener('touchmove', stop);
  }, [onMove]);

  // The dropped card stays hidden in its old column until the columns change (or a few seconds pass, if the move was refused).
  useEffect(() => {
    if (!landing) return;
    const still = columns.find((c) => c.stage === landing.from)?.items.some((i) => i.id === landing.id);
    if (!still) {
      setLanding(null);
      return;
    }
    const t = window.setTimeout(() => setLanding(null), 4000);
    return () => window.clearTimeout(t);
  }, [columns, landing]);

  // Take everything off if the board goes while a card is held.
  useEffect(
    () => () => {
      press.current?.cleanup();
      press.current = null;
    },
    [],
  );

  /** Note where every card sits now, so the next render can slide them from there. */
  const snapshot = () => {
    const el = scroller.current;
    if (!el || prefersReducedMotion()) return;
    const map = new Map<string, number>();
    el.querySelectorAll<HTMLElement>('[data-kcard]').forEach((li) => map.set(li.dataset.kcard ?? '', li.getBoundingClientRect().top));
    before.current = map;
  };

  const setDrag = (next: Drag<T> | null) => {
    const prev = live.current;
    const layoutChanged = !prev || !next || prev.over !== next.over || prev.ok !== next.ok || prev.gap !== next.gap;
    live.current = next;
    if (layoutChanged) {
      snapshot();
      setDragState(next);
    }
  };

  // FLIP: after a gap opens or closes, every card that moved starts where it was and slides to its new place.
  useLayoutEffect(() => {
    const map = before.current;
    before.current = null;
    const el = scroller.current;
    if (!map || !el) return;
    el.querySelectorAll<HTMLElement>('[data-kcard]').forEach((li) => {
      const was = map.get(li.dataset.kcard ?? '');
      if (was === undefined || li.offsetParent === null) return;
      gsap.killTweensOf(li);
      gsap.set(li, { clearProps: 'transform' });
      const delta = was - li.getBoundingClientRect().top;
      if (Math.abs(delta) > 0.5) gsap.fromTo(li, { y: delta }, { y: 0, duration: 0.25, ease: 'power3.out', clearProps: 'transform' });
    });
  });

  // The copy appears where the card was, grows a little and from then on follows the pointer.
  useLayoutEffect(() => {
    const c = clone.current;
    const p = press.current;
    if (!c || !p || !drag) return;
    const still = prefersReducedMotion();
    gsap.set(c, { x: p.x - p.startX, y: p.y - p.startY, rotation: 0, scale: still ? 1.03 : 1 });
    if (still) {
      quick.current = null;
      return;
    }
    gsap.to(c, { scale: 1.03, duration: 0.18, ease: 'power2.out' });
    quick.current = {
      x: gsap.quickTo(c, 'x', { duration: 0.12, ease: 'power3.out' }),
      y: gsap.quickTo(c, 'y', { duration: 0.12, ease: 'power3.out' }),
      r: gsap.quickTo(c, 'rotation', { duration: 0.25, ease: 'power2.out' }),
    };
    // Only when a new card is lifted, not on every gap change.
  }, [drag?.item.id, drag?.from]);

  /** Which column is under the pointer, whether it may take the card, and where among its cards the gap goes. */
  const hitTest = () => {
    const p = press.current;
    const d = live.current;
    const el = scroller.current;
    if (!p || !d || !el) return;
    const under = document.elementFromPoint(p.x, p.y);
    const sec = under?.closest<HTMLElement>('[data-kcol]');
    const col = sec && el.contains(sec) ? (sec.dataset.kcol ?? null) : null;
    const ok = col !== null && col !== d.from && (!canMoveTo || canMoveTo(d.item, d.from, col));
    let gap = 0;
    if (ok && sec) {
      sec.querySelectorAll<HTMLElement>('[data-kcard]').forEach((li) => {
        if (li.dataset.kcard === d.item.id) return;
        // Where the card is settling to, not where a slide has it this frame, so the gap does not flicker while cards move.
        const r = li.getBoundingClientRect();
        const sliding = Number(gsap.getProperty(li, 'y')) || 0;
        if (r.top - sliding + r.height / 2 < p.y) gap++;
      });
    }
    document.documentElement.classList.toggle('kanban-no', col !== null && col !== d.from && !ok);
    setDrag({ ...d, over: col, ok, gap: ok ? gap : 0 });
  };

  /** One frame of a drag: lean back towards upright when the pointer rests, and scroll the board when the pointer is at its edge. */
  const frame = () => {
    const p = press.current;
    const el = scroller.current;
    if (!p || !p.lifted || p.settling || !el) return;
    if (performance.now() - p.lastT > 40) p.vx *= 0.7;
    quick.current?.r(clamp(p.vx * 0.04, -8, 8));
    const r = el.getBoundingClientRect();
    let speed = 0;
    if (p.x < r.left + EDGE) speed = -Math.ceil(((r.left + EDGE - p.x) / EDGE) * EDGE_SPEED);
    else if (p.x > r.right - EDGE) speed = Math.ceil(((p.x - (r.right - EDGE)) / EDGE) * EDGE_SPEED);
    if (speed !== 0) {
      const was = el.scrollLeft;
      el.scrollLeft = was + clamp(speed, -EDGE_SPEED, EDGE_SPEED);
      if (el.scrollLeft !== was) hitTest();
    }
    p.raf = requestAnimationFrame(frame);
  };

  const lift = () => {
    const p = press.current;
    if (!p || p.lifted) return;
    const r = p.li.getBoundingClientRect();
    p.lifted = true;
    p.lastT = performance.now();
    if (p.timer !== null) window.clearTimeout(p.timer);
    p.timer = null;
    window.getSelection()?.removeAllRanges();
    document.documentElement.classList.add('kanban-drag');
    tick();
    setDrag({ item: p.item, from: p.from, over: p.from, ok: false, gap: 0, rect: { left: r.left, top: r.top, width: r.width, height: r.height } });
    p.raf = requestAnimationFrame(frame);
  };

  /** Ends the drag: the copy glides into the gap (or home) and then the card moves. */
  const drop = (cancel: boolean) => {
    const p = press.current;
    const d = live.current;
    if (!p || !d || p.settling) return;
    p.settling = true;
    if (p.raf !== null) cancelAnimationFrame(p.raf);
    p.raf = null;
    const to = !cancel && d.ok && d.over ? d.over : null;
    // Going home from over another column: close that gap and show the home slot first, so there is somewhere to glide to.
    if (!to && d.ok) flushSync(() => setDrag({ ...d, over: null, ok: false, gap: 0 }));
    const el = scroller.current;
    const slot = el?.querySelector<HTMLElement>(to ? '[data-kgap]' : `[data-kcard="${CSS.escape(d.item.id)}"]`);
    const finish = () => {
      p.cleanup();
      press.current = null;
      quick.current = null;
      if (to) {
        setLanding({ item: d.item, id: d.item.id, from: d.from, to, gap: d.gap });
        onMove?.(d.item, d.from, to);
      }
      tick();
      setDrag(null);
    };
    const c = clone.current;
    if (!c || !slot || prefersReducedMotion()) {
      finish();
      return;
    }
    const r = slot.getBoundingClientRect();
    gsap.killTweensOf(c);
    gsap.to(c, { x: r.left - d.rect.left, y: r.top - d.rect.top, rotation: 0, scale: 1, duration: 0.3, ease: 'power3.out', onComplete: finish });
  };

  const onPressStart = (e: ReactPointerEvent<HTMLLIElement>, item: T, from: string) => {
    if (!onMove || press.current || !e.isPrimary) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if ((e.target as Element).closest('[data-kmove]')) return; // the Move button opens its sheet, never a drag
    const touch = e.pointerType === 'touch';
    const pid = e.pointerId;

    const move = (ev: PointerEvent) => {
      const p = press.current;
      if (!p || ev.pointerId !== pid || p.settling) return;
      const now = performance.now();
      if (p.lifted) {
        const dt = now - p.lastT;
        // Sideways speed in px a second, smoothed, and held to what the lean can show (8 degrees is 200 px/s), so it settles quickly.
        if (dt > 0) p.vx = clamp(p.vx * 0.6 + ((ev.clientX - p.x) / dt) * 1000 * 0.4, -300, 300);
      }
      p.x = ev.clientX;
      p.y = ev.clientY;
      p.lastT = now;
      if (!p.lifted) {
        const dist = Math.hypot(p.x - p.startX, p.y - p.startY);
        if (p.touch) {
          if (dist > TOUCH_SLOP) end(); // a swipe: let the board and page scroll
        } else if (dist > MOUSE_SLOP) lift();
        return;
      }
      ev.preventDefault();
      const c = clone.current;
      const dx = p.x - p.startX;
      const dy = p.y - p.startY;
      if (quick.current) {
        quick.current.x(dx);
        quick.current.y(dy);
      } else if (c) gsap.set(c, { x: dx, y: dy });
      hitTest();
    };
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== pid) return;
      const p = press.current;
      if (!p) return;
      if (!p.lifted) return end();
      // The pointer that let go of a card also lets go of a click on whatever is under it: swallow that one click.
      const swallow = (ce: MouseEvent) => {
        ce.preventDefault();
        ce.stopPropagation();
      };
      window.addEventListener('click', swallow, { capture: true, once: true });
      window.setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0);
      drop(false);
    };
    const cancelled = (ev: PointerEvent) => {
      if (ev.pointerId !== pid) return;
      const p = press.current;
      if (!p) return;
      if (!p.lifted) end(); // the browser took the touch to scroll
      else drop(true);
    };
    const key = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape' && press.current?.lifted) {
        ev.preventDefault();
        drop(true);
      }
    };
    const menu = (ev: Event) => ev.preventDefault();
    const li = e.currentTarget;
    const cleanup = () => {
      const p = press.current;
      if (p?.timer != null) window.clearTimeout(p.timer);
      if (p?.raf != null) cancelAnimationFrame(p.raf);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancelled);
      window.removeEventListener('keydown', key, true);
      li.removeEventListener('contextmenu', menu);
      li.style.touchAction = '';
      document.documentElement.classList.remove('kanban-drag', 'kanban-no');
    };
    const end = () => {
      cleanup();
      press.current = null;
    };

    press.current = {
      id: pid,
      touch,
      startX: e.clientX,
      startY: e.clientY,
      x: e.clientX,
      y: e.clientY,
      lastT: performance.now(),
      vx: 0,
      lifted: false,
      settling: false,
      timer: null,
      raf: null,
      li,
      item,
      from,
      cleanup,
    };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancelled);
    window.addEventListener('keydown', key, true);
    if (touch) {
      li.addEventListener('contextmenu', menu);
      press.current.timer = window.setTimeout(() => {
        const p = press.current;
        if (!p || p.lifted) return;
        li.style.touchAction = 'none';
        lift();
      }, TOUCH_HOLD_MS);
    }
  };

  const targets = moving ? columns.filter((c) => c.stage !== moving.from && (!canMoveTo || canMoveTo(moving.item, moving.from, c.stage))) : [];
  const gapSlot = drag ? <li key="kanban-gap" data-kgap="" aria-hidden="true" className="kanban-slot rounded-tile border-2 border-dashed border-line" style={{ height: drag.rect.height }} /> : null;

  return (
    <>
      <div ref={scroller} onScroll={measure} style={more ? FADE : undefined} className="scroll-row flex items-stretch gap-sm">
        {columns.map((col) => {
          const gapHere = drag !== null && drag.ok && drag.over === col.stage;
          const shown = col.items.filter((i) => !(landing && landing.id === i.id && landing.from === col.stage));
          // Until the new columns arrive, the dropped card waits where it was dropped (the server then sorts it into its place).
          if (landing && landing.to === col.stage && !shown.some((i) => i.id === landing.id)) shown.splice(clamp(landing.gap, 0, shown.length), 0, landing.item);
          const rows: ReactNode[] = shown.map((item) => {
            const held = drag !== null && drag.item.id === item.id && drag.from === col.stage;
            // The held card's place: a dashed slot while it is over home or nowhere, gone (the column closes up) while it is over another.
            const away = held && drag.ok;
            return (
              <li
                key={item.id}
                data-kcard={item.id}
                onPointerDown={onMove ? (e) => onPressStart(e, item, col.stage) : undefined}
                onDragStart={onMove ? (e) => e.preventDefault() : undefined}
                className={`flex items-start gap-xs rounded-tile bg-card-strong p-sm shadow-toy-soft ${onMove ? 'kanban-card cursor-grab active:cursor-grabbing' : ''} ${held ? 'kanban-home' : ''} ${away ? 'kanban-away' : ''}`}
              >
                <div className="min-w-0 flex-1">{card(item, col.stage)}</div>
                {onMove && (
                  <button
                    type="button"
                    data-kmove=""
                    onClick={() => setMoving({ item, from: col.stage })}
                    aria-label={`Move ${itemLabel(item)}`}
                    aria-haspopup="dialog"
                    className="toy toy-soft flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-pill text-ink-soft hover:text-ink"
                  >
                    <Icon icon={ArrowLeftRight} size={18} />
                  </button>
                )}
              </li>
            );
          });
          if (gapHere) {
            const others = rows.filter((_, i) => shown[i]?.id !== drag.item.id);
            others.splice(clamp(drag.gap, 0, others.length), 0, gapSlot);
            rows.splice(0, rows.length, ...others);
          }
          return (
            <section
              key={col.stage}
              data-kcol={col.stage}
              aria-label={`${col.name}, ${col.total}`}
              className={`w-[260px] min-w-[260px] shrink-0 rounded-card p-sm md:w-[280px] ${gapHere ? 'bg-card-strong ring-2 ring-ink/30' : 'bg-card'}`}
            >
              <header className="flex items-baseline justify-between gap-xs">
                <h3 className="m-0 text-[16px] font-extrabold">{col.name}</h3>
                <StatusTag tone="neutral" title={`${col.total} in ${col.name}`}>{String(col.total)}</StatusTag>
              </header>
              {col.note && <p className="m-0 text-[12px] font-bold text-ink-soft">{col.note}</p>}
              <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0">{rows}</ul>
              {shown.length === 0 && !gapHere && <p className="mt-xs m-0 rounded-tile border-2 border-dashed border-line p-sm text-center text-[12px] font-bold text-ink-mute">{empty}</p>}
              {onMore && col.total > col.items.length && (
                <div className="mt-xs">
                  <Button variant="outline" size="sm" full onClick={() => onMore(col.stage)}>
                    Show more ({col.total - col.items.length})
                  </Button>
                </div>
              )}
            </section>
          );
        })}
      </div>
      {drag &&
        createPortal(
          <div
            ref={clone}
            aria-hidden="true"
            inert
            className="kanban-clone flex items-start gap-xs rounded-tile bg-card-strong p-sm shadow-toy"
            style={{ left: drag.rect.left, top: drag.rect.top, width: drag.rect.width }}
          >
            <div className="min-w-0 flex-1">{card(drag.item, drag.from)}</div>
            <span className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-pill text-ink-soft">
              <Icon icon={ArrowLeftRight} size={18} />
            </span>
          </div>,
          document.body,
        )}
      {onMove && (
        <Sheet open={moving !== null} onClose={() => setMoving(null)} title={moving ? `Move ${itemLabel(moving.item)}` : 'Move'}>
          {targets.length === 0 ? (
            <p className="m-0 text-[14px] font-semibold text-ink-soft">This one cannot move from here.</p>
          ) : (
            <ul className="fx-inset">
              {targets.map((c) => (
                <li key={c.stage}>
                  <button
                    type="button"
                    className="fx-row text-[16px] font-bold text-ink"
                    onClick={() => {
                      const m = moving;
                      setMoving(null);
                      if (m) onMove(m.item, m.from, c.stage);
                    }}
                  >
                    <span className="min-w-0 flex-1">{c.name}</span>
                    <span className="text-[12px] font-extrabold text-ink-mute">{c.total}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Sheet>
      )}
    </>
  );
}
