import { CARD_GAME_BY_KEY, RELATIONSHIP_BY_KEY, type CardGamePlay, type PlayCard, type PlayDeck } from '@kreators/shared';
import { useQueryClient } from '@tanstack/react-query';
import gsap from 'gsap';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { Link, useParams } from 'react-router';
import { Button } from '../components/Button';
import { Avatar } from '../components/Avatar';
import { ExpandButton } from '../components/ExpandButton';
import { Eraser, FlipHorizontal2, Shuffle } from 'lucide-react';
import { HeroBlobs } from '../components/Hero';
import { PageHeader } from '../components/PageHeader';
import { StatusTag } from '../components/StatusTag';
import { Busy, Skeleton } from '../components/Skeleton';
import { tick } from '../components/fx/haptics';
import { Screen } from '../components/Screen';
import { Section } from '../components/Section';
import { Sheet } from '../components/Sheet';
import { useCardGame } from '../lib/queries';
import { WaterButton } from '../components/Reminders';
import { FocusPill } from '../components/FocusPill';
import { useFocus } from '../lib/store';
import { AnimatedIcon } from '../components/AnimatedIcon';
import { TabRow } from '../components/TabRow';
import { Segmented } from '../components/fx/Segmented';
import { fillVar } from '../lib/relFill';
import { tie } from '../lib/text';
import { ToggleChevron } from '../components/ToggleMark';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** A mouse or pen lifts a card once it has moved this far; a finger lifts it after a still press (moving first scrolls the page). */
const MOUSE_SLOP = 6;
const TOUCH_SLOP = 8;
const TOUCH_HOLD_MS = 250;

const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function shuffled(n: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

interface OnTable {
  uid: number;
  deck: string;
  idx: number;
  x: number;
  y: number;
  z: number;
  flipped: boolean;
  /** Where it was dealt from, for the first move only. */
  from: { x: number; y: number };
  /** Dealt when no spot was left that kept every other card's title in sight (the table was full). */
  crowded?: boolean;
}

/** The share of a card's height, from the top, that holds its deck band and title: no new card may land on it. */
const BAND = 0.38;
const GAP = 8;

/**
 * Where a new card goes. First a spot clear of every card and the pile (their boxes do not touch, with 8px between), the one
 * highest up and nearest the middle across. When none is left the card is cascaded: it sits a band and a title below a card already there and 12px to
 * the right, so that card's deck band and title stay readable and tappable; it never lands on any card's band or on the pile.
 * Only when even that is gone is the table full, and the card takes the spot that covers the least of anyone's band.
 */
function placeCard(cards: { x: number; y: number }[], pile: { x: number; y: number; w: number; h: number }, w: number, h: number, box: { w: number; h: number }, lookahead = true): { x: number; y: number; crowded: boolean } {
  const maxX = Math.max(0, box.w - w - GAP);
  const maxY = Math.max(0, box.h - h - GAP);
  const band = Math.round(h * BAND);
  const rects = [{ ...pile, band: pile.h }, ...cards.map((c) => ({ x: c.x, y: c.y, w, h, band }))];
  const mid = { x: maxX / 2, y: maxY / 2 };
  const span = (a0: number, a1: number, b0: number, b1: number) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
  const clear = (x: number, y: number) => rects.every((r) => x >= r.x + r.w + GAP || x + w + GAP <= r.x || y >= r.y + r.h + GAP || y + h + GAP <= r.y);
  const bandCover = (x: number, y: number) => rects.reduce((t, r) => { const ox = span(x, x + w, r.x, r.x + r.w); const oy = span(y, y + h, r.y, r.y + r.band); return ox > 0 && oy > 0 ? t + ox * oy : t; }, 0);
  const bodyCover = (x: number, y: number) => rects.reduce((t, r) => t + span(x, x + w, r.x, r.x + r.w) * span(y, y + h, r.y, r.y + r.h), 0);
  // Top first, then nearest the middle across, so the cards fill the table from the top down and nothing drifts to one side.
  const toMid = (x: number, y: number) => Math.abs(x - mid.x) + y * 2;
  const axis = (max: number) => {
    const out: number[] = [];
    for (let v = Math.min(GAP, max); v < max; v += GAP) out.push(v);
    out.push(max);
    return out;
  };
  const xs = axis(maxX);
  const ys = axis(maxY);

  // On a narrow table (a phone) room is tight, so of the spots this rule allows the one that leaves room for the most cards after
  // it is taken (counted by dealing on with the plain rule); ties, and every wide table, go to the spot nearest the middle.
  const look = lookahead && box.w < 520;
  const roomAfter = (s: { x: number; y: number }) => {
    const next = [...cards, s];
    for (let n = 0; n < 10; n += 1) {
      const p = placeCard(next, pile, w, h, box, false);
      if (p.crowded) return n;
      next.push(p);
    }
    return 10;
  };
  const pick = <T extends { x: number; y: number; o: number; d: number }>(list: T[]): T | null => {
    if (list.length === 0) return null;
    const sorted = [...list].sort((a, b) => a.o - b.o || a.d - b.d);
    if (!look) return sorted[0]!;
    let top = sorted[0]!;
    let most = -1;
    for (const s of sorted.filter((_, i) => i % 2 === 0 || list.length < 40)) {
      const r = roomAfter(s);
      if (r > most) {
        most = r;
        top = s;
      }
    }
    return top;
  };

  const clearSpots: { x: number; y: number; o: number; d: number }[] = [];
  for (const y of ys) for (const x of xs) if (clear(x, y)) clearSpots.push({ x, y, o: 0, d: toMid(x, y) });
  const best = pick(clearSpots);
  if (best) return { x: best.x, y: best.y, crowded: false };

  // The cascade: below each card's band, a little to the right (or to the left where the right edge is near).
  const cascades: { x: number; y: number; o: number; d: number }[] = [];
  for (const c of cards) {
    const y = c.y + band;
    if (y > maxY) continue;
    for (const x of [c.x + 12, c.x - 12]) {
      if (x < 0 || x > maxX) continue;
      if (bandCover(x, y) > 0) continue;
      cascades.push({ x, y, o: bodyCover(x, y), d: toMid(x, y) });
    }
  }
  const cascade = pick(cascades);
  if (cascade) return { x: cascade.x, y: cascade.y, crowded: false };

  // Any spot that still leaves every band in sight, then, with the table full, the one that hides the least.
  let free: { x: number; y: number; o: number; d: number } | null = null;
  let least: { x: number; y: number; o: number; d: number } | null = null;
  for (const y of ys) for (const x of xs) {
    const b = bandCover(x, y);
    const d = toMid(x, y);
    if (b === 0) { const o = bodyCover(x, y); if (!free || o < free.o || (o === free.o && d < free.d)) free = { x, y, o, d }; }
    else if (!least || b < least.o || (b === least.o && d < least.d)) least = { x, y, o: b, d };
  }
  if (free) return { x: free.x, y: free.y, crowded: false };
  return { x: least?.x ?? 0, y: least?.y ?? 0, crowded: true };
}

/** A relationship's fill from its theme token (lib/relFill.ts), deepening toward --fill-shade. The token in the inline style is what
 *  app.css reads to turn `--color-on-fill` dark on orange and yellow, so text in it always reads. */
const fill = (rel: { floor: number }): CSSProperties => {
  const c = fillVar(rel);
  return { background: `linear-gradient(135deg, ${c}, color-mix(in oklab, ${c} 72%, var(--fill-shade)))` };
};

/** True while the box's content is taller than the box, measured again whenever the box or anything in it changes size. */
function useCut<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [cut, setCut] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setCut(el.scrollHeight > el.clientHeight + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    for (const k of el.children) ro.observe(k);
    return () => ro.disconnect();
  }, []);
  return [ref, cut] as const;
}

/** The back of every card in a game: its colour, its flower, its name. A deck can add its own line. On the pile the count badge sits in
 *  the bottom corner, so the words end above it (`badge`). */
function Cover({ game, deck, size, badge = false, onHint }: { game: CardGamePlay; deck?: PlayDeck; size: number; badge?: boolean; onHint?: (shown: boolean) => void }) {
  const rel = RELATIONSHIP_BY_KEY[game.accent];
  // A deck's hint is shown on the cover only while it fits whole (a phone's pile is small); never cut mid-sentence. `onHint` tells the table, which then shows it beside the pile.
  const ref = useRef<HTMLDivElement>(null);
  const [hideHint, setHideHint] = useState(false);
  useLayoutEffect(() => setHideHint(false), [size, deck?.key]);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && deck?.hint && !hideHint && el.scrollHeight > el.clientHeight + 1) setHideHint(true);
  });
  const shown = Boolean(deck?.hint) && !hideHint;
  useEffect(() => onHint?.(shown), [shown, onHint]);
  return (
    <div ref={ref} className={`relative flex size-full flex-col items-center justify-center gap-xs overflow-hidden rounded-tile p-sm text-center text-on-fill ${badge ? 'pb-lg' : ''}`} style={fill(rel)}>
      <HeroBlobs seed={game.key} opacity={0.2} />
      {/* The game's guide in place of an emoji, as on the Games tiles. */}
      <span className="relative" aria-hidden="true">
        <Avatar relationship={game.accent} size={Math.round(size * 0.26)} decorative />
      </span>
      {/* A long name is set a size smaller, so its last two words fit one line together and none is left alone. */}
      <span className="relative text-balance font-display font-bold leading-[1.15]" style={{ fontSize: game.name.length > 24 ? Math.max(12, size * 0.087) : Math.max(14, size * 0.1) }}>
        {game.name.length > 24 ? tie(game.name) : game.name}
      </span>
      {deck && <span className="relative text-balance text-caption opacity-90">{deck.name}</span>}
      {shown && <span className="relative text-balance text-caption leading-[1.3]">{deck?.hint}</span>}
    </div>
  );
}

/** One side of a card with words on it. What does not fit is cut by the body's box with a fade, and Read all shows whenever anything is cut. */
function Face({ game, deck, label, title, text, list, size, onRead }: { game: CardGamePlay; deck: PlayDeck; label?: string; title?: string; text: string; list?: string[]; size: number; onRead: () => void }) {
  const rel = RELATIONSHIP_BY_KEY[game.accent];
  const long = text.length + (list?.join('').length ?? 0) > 150;
  const [body, cut] = useCut<HTMLDivElement>();
  const more = cut || (list?.length ?? 0) > 2;
  return (
    <div data-card-face className="flex size-full flex-col overflow-hidden rounded-tile border border-line bg-card-strong text-ink">
      <div className="flex items-center justify-between gap-xs px-sm py-xs text-on-fill" style={fill(rel)}>
        <span className="truncate text-caption font-semibold">{deck.name}</span>
        {label && <span className="shrink-0 rounded-pill bg-on-fill/20 px-xs text-caption font-medium">{label}</span>}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-xs p-sm">
        <div ref={body} data-card-body className="relative flex min-h-0 flex-1 flex-col gap-xs overflow-hidden">
          {title && <p className="m-0 font-display font-bold leading-[1.2] text-ink" style={{ fontSize: Math.max(15, size * 0.095) }}>{title}</p>}
          {text && <p className="m-0 leading-[1.35] text-ink-soft" style={{ fontSize: Math.max(13, size * (long ? 0.066 : 0.08)) }}>{text}</p>}
          {list && list.length > 0 && (
            <ul className="m-0 list-disc pl-md text-ink-soft" style={{ fontSize: Math.max(12, size * 0.062) }}>
              {list.slice(0, 2).map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          )}
          {cut && <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-lg" style={{ background: 'linear-gradient(to bottom, transparent, var(--card-strong))' }} />}
        </div>
        {more && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onRead();
            }}
            className="mt-auto inline-flex min-h-[44px] items-center self-start text-caption font-semibold underline underline-offset-4"
          >
            Read all
          </button>
        )}
      </div>
    </div>
  );
}

function TableCard({ game, deck, card, t, size, box, onRaise, onMove, onFlip, onRead }: { game: CardGamePlay; deck: PlayDeck; card: PlayCard; t: OnTable; size: number; box: { w: number; h: number }; onRaise: (uid: number) => void; onMove: (uid: number, x: number, y: number) => void; onFlip: (uid: number) => void; onRead: (card: PlayCard, deck: PlayDeck, side: 'a' | 'b') => void }) {
  const root = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    sx: number;
    sy: number;
    ox: number;
    oy: number;
    nx: number;
    ny: number;
    /** Picked up: it follows the pointer, a little bigger, leaning with its sideways speed. */
    lifted: boolean;
    touch: boolean;
    timer: number | null;
    lx: number;
    lt: number;
    vx: number;
    lean: gsap.QuickToFunc | null;
    rest: number | null;
  } | null>(null);
  const first = useRef(true);
  const h = Math.round(size * 1.4);

  // The deal: from the pile to its spot. Afterwards the position is set outright, so a drag never fights an animation.
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    if (first.current) {
      first.current = false;
      if (reduced()) gsap.set(el, { x: t.x, y: t.y });
      else {
        // It leaves the pile leaning left on one draw and right on the next (the pile sits at one side, so the way it travels would
        // turn them all one way), a little more the further it goes, and swings just past level as it lands.
        const dist = Math.hypot(t.x - t.from.x, t.y - t.from.y);
        const side = t.uid % 2 ? 1 : -1;
        const start = side * clamp(6 + dist / 50, 6, 14) * (t.uid % 3 === 0 ? 0.75 : 1);
        gsap
          .timeline()
          .fromTo(el, { x: t.from.x, y: t.from.y, rotation: start, scale: 0.9 }, { x: t.x, y: t.y, rotation: -start * 0.18, scale: 1, duration: 0.45, ease: 'power3.out' })
          .to(el, { rotation: 0, duration: 0.25, ease: 'power2.out' });
      }
      return;
    }
    gsap.set(el, { x: t.x, y: t.y });
  }, [t.x, t.y, t.from.x, t.from.y]);

  const shown = useRef(t.flipped);
  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    if (shown.current === t.flipped && el.dataset.set) return;
    shown.current = t.flipped;
    const firstSet = !el.dataset.set;
    el.dataset.set = '1';
    if (firstSet || reduced()) {
      gsap.set(el, { rotateY: t.flipped ? 180 : 0 });
      return;
    }
    // The card turns over and rises a little while it does, so it feels picked up, not spun on the spot.
    const tl = gsap.timeline();
    tl.to(el, { rotateY: t.flipped ? 180 : 0, duration: 0.5, ease: 'power2.inOut' }, 0);
    if (root.current) tl.to(root.current, { scale: 1.04, duration: 0.25, ease: 'power2.out' }, 0).to(root.current, { scale: 1, duration: 0.25, ease: 'power2.in' }, 0.25);
    return () => {
      tl.progress(1).kill();
    };
  }, [t.flipped]);

  // A finger that has lifted a card must not scroll the page. Only a listener that is not passive can say so, and it must be there before the
  // touch starts, so it sits on the card for good and does nothing unless the card is lifted (the same as KanbanBoard).
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const stop = (e: TouchEvent) => {
      if (drag.current?.lifted) e.preventDefault();
    };
    el.addEventListener('touchmove', stop, { passive: false });
    return () => {
      el.removeEventListener('touchmove', stop);
      const d = drag.current;
      if (d?.timer != null) window.clearTimeout(d.timer);
      if (d?.rest != null) window.clearTimeout(d.rest);
      drag.current = null;
      gsap.killTweensOf(el);
    };
  }, []);

  const lift = () => {
    const d = drag.current;
    if (!d || d.lifted) return;
    d.lifted = true;
    if (d.timer !== null) window.clearTimeout(d.timer);
    d.timer = null;
    tick();
    const el = root.current;
    if (!el || reduced()) return;
    gsap.to(el, { scale: 1.03, duration: 0.18, ease: 'power2.out' });
    d.lean = gsap.quickTo(el, 'rotation', { duration: 0.25, ease: 'power2.out' });
  };
  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const touch = e.pointerType === 'touch';
    drag.current = { sx: e.clientX, sy: e.clientY, ox: t.x, oy: t.y, nx: t.x, ny: t.y, lifted: false, touch, timer: null, lx: e.clientX, lt: performance.now(), vx: 0, lean: null, rest: null };
    if (touch) drag.current.timer = window.setTimeout(lift, TOUCH_HOLD_MS);
    onRaise(t.uid);
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.lifted) {
      const dist = Math.hypot(dx, dy);
      if (d.touch) {
        // A swipe before the hold: the page scrolls, and the card is left where it is.
        if (dist > TOUCH_SLOP) {
          if (d.timer !== null) window.clearTimeout(d.timer);
          drag.current = null;
        }
        return;
      }
      if (dist < MOUSE_SLOP) return;
      lift();
    }
    const now = performance.now();
    const dt = now - d.lt;
    // Sideways speed in px a second, smoothed and held to what the lean can show (8 degrees at 200 px/s).
    if (dt > 0) d.vx = clamp(d.vx * 0.6 + ((e.clientX - d.lx) / dt) * 1000 * 0.4, -300, 300);
    d.lx = e.clientX;
    d.lt = now;
    if (d.lean) {
      d.lean(clamp(d.vx * 0.04, -8, 8));
      // When the pointer rests the card stands up straight again.
      if (d.rest !== null) window.clearTimeout(d.rest);
      d.rest = window.setTimeout(() => {
        if (drag.current === d) {
          d.vx = 0;
          d.lean?.(0);
        }
      }, 80);
    }
    d.nx = Math.min(Math.max(0, d.ox + dx), Math.max(0, box.w - size));
    d.ny = Math.min(Math.max(0, d.oy + dy), Math.max(0, box.h - h));
    if (root.current) gsap.set(root.current, { x: d.nx, y: d.ny });
  };
  const end = (cancelled: boolean) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.timer !== null) window.clearTimeout(d.timer);
    if (d.rest !== null) window.clearTimeout(d.rest);
    if (d.lifted) {
      // Set down: it glides back to upright and its own size.
      const el = root.current;
      if (el && !reduced()) gsap.to(el, { rotation: 0, scale: 1, duration: 0.3, ease: 'power3.out' });
      onMove(t.uid, d.nx, d.ny);
    } else if (!cancelled) onFlip(t.uid);
  };
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = 16;
    const to = (dx: number, dy: number) => {
      e.preventDefault();
      onMove(t.uid, Math.min(Math.max(0, t.x + dx), Math.max(0, box.w - size)), Math.min(Math.max(0, t.y + dy), Math.max(0, box.h - h)));
    };
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onFlip(t.uid);
    } else if (e.key === 'ArrowLeft') to(-step, 0);
    else if (e.key === 'ArrowRight') to(step, 0);
    else if (e.key === 'ArrowUp') to(0, -step);
    else if (e.key === 'ArrowDown') to(0, step);
  };

  const sideA = { label: card.label, title: card.title, text: card.text, list: card.list };
  return (
    <div
      ref={root}
      role="button"
      tabIndex={0}
      aria-label={`${card.title ?? card.label ?? deck.name}: ${card.text || card.list?.[0] || ''}. ${t.flipped ? 'Showing the other side.' : ''} Press Enter to flip, arrow keys to move.`}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={() => end(false)}
      onPointerCancel={() => end(true)}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={key}
      data-table-card
      data-crowded={t.crowded ? '1' : undefined}
      className="absolute top-0 left-0 cursor-grab select-none outline-none active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-ink"
      style={{ width: size, height: h, zIndex: t.z, perspective: 900, WebkitTouchCallout: 'none' }}
    >
      <div ref={inner} className="relative size-full shadow-toy-soft" style={{ transformStyle: 'preserve-3d', borderRadius: 'var(--radius-tile)' }}>
        <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>
          <Face game={game} deck={deck} {...sideA} size={size} onRead={() => onRead(card, deck, 'a')} />
        </div>
        <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
          {card.alt ? <Face game={game} deck={deck} label={card.alt.label} text={card.alt.text} size={size} onRead={() => onRead(card, deck, 'b')} /> : <Cover game={game} deck={deck} size={size} />}
        </div>
      </div>
    </div>
  );
}

/** The fullscreen button: corner brackets pointing out to enter, pointing in to leave. */
function FocusButton({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      aria-label={on ? 'Leave focus mode' : 'Focus mode: hide the menu and the assistant'}
      title={on ? 'Leave focus mode (Esc)' : 'Focus mode'}
      className="toy toy-soft flex min-h-[44px] min-w-[44px] items-center justify-center gap-xs rounded-pill border border-line bg-card-strong px-sm text-subhead font-medium text-ink"
    >
      {/* The animated maximize/minimize icon: corners out to enter, in to leave (the still lucide glyph until it loads). */}
      <AnimatedIcon name="maximizeMinimize" size={22} active={on} />
      {/* Words on a wide phone and from the laptop width; beside a tablet's sidebar the toolbar needs the room to stay on one line. */}
      <span className="hidden sm:inline md:hidden lg:inline">{on ? 'Leave focus' : 'Focus mode'}</span>
    </button>
  );
}

function Table({ game, focus, onFocus }: { game: CardGamePlay; focus: boolean; onFocus: (on: boolean) => void }) {
  const rel = RELATIONSHIP_BY_KEY[game.accent];
  const [deckKey, setDeckKey] = useState(game.decks[0]?.key ?? '');
  const deck = game.decks.find((d) => d.key === deckKey) ?? game.decks[0]!;
  const [piles, setPiles] = useState<Record<string, number[]>>(() => Object.fromEntries(game.decks.map((d) => [d.key, shuffled(d.cards.length)])));
  const [table, setTable] = useState<OnTable[]>([]);
  const [said, setSaid] = useState('');
  const [reading, setReading] = useState<{ card: PlayCard; deck: PlayDeck; side: 'a' | 'b' } | null>(null);
  // A drawn special card shows under its button, in the rules card itself; a small toggle hides it and shows it again.
  const [special, setSpecial] = useState<string | null>(null);
  const [specialShown, setSpecialShown] = useState(true);
  const zTop = useRef(1);
  const uid = useRef(1);
  const pileRef = useRef<HTMLButtonElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 360, h: 460 });

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const read = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const narrow = box.w < 520;
  // The card's size follows the table's width, but never asks for more height than the table has to give: on a short table
  // (a phone on its side in focus mode) this keeps enough room to lay several cards out without stacking them.
  const size = Math.round(Math.min(210, Math.max(132, Math.min(box.w * (narrow ? 0.42 : 0.24), box.h / 1.9))));
  const height = Math.round(size * 1.4);
  const pileX = 16;
  const pileY = 16;
  const left = piles[deck.key]?.length ?? 0;
  // Whether the top of the pile could show the deck's hint whole; when it could not, the line beside the pile carries it.
  const [pileHint, setPileHint] = useState(true);

  // When the table changes size (focus mode on or off, a phone turning, a window resized) every card is brought back onto it. Positions are
  // scaled to the new size, so the cards keep their arrangement and none is left outside the edge.
  const lastBox = useRef({ w: box.w, h: box.h, size, height });
  useEffect(() => {
    const prev = lastBox.current;
    lastBox.current = { w: box.w, h: box.h, size, height };
    const oldMaxX = Math.max(1, prev.w - prev.size - 8);
    const oldMaxY = Math.max(1, prev.h - prev.height - 8);
    const maxX = Math.max(0, box.w - size - 8);
    const maxY = Math.max(0, box.h - height - 8);
    if (oldMaxX === maxX && oldMaxY === maxY) return;
    setTable((cur) =>
      cur.map((t) => ({ ...t, x: Math.min(maxX, Math.max(0, Math.round((t.x * maxX) / oldMaxX))), y: Math.min(maxY, Math.max(0, Math.round((t.y * maxY) / oldMaxY))) })),
    );
  }, [box.w, box.h, size, height]);

  const draw = useCallback(() => {
    const pile = piles[deck.key] ?? [];
    const idx = pile[pile.length - 1];
    if (idx === undefined) {
      setSaid(`${deck.name} is out of cards. Tap Shuffle to gather them again.`);
      return;
    }
    setPiles((p) => ({ ...p, [deck.key]: pile.slice(0, -1) }));
    // Cards go anywhere on the table, the whole of it: a clear spot first, then a cascade that keeps every title in sight (placeCard).
    // The pile is counted with the 6px its stacked backs stand out by.
    const spot = placeCard(table, { x: pileX, y: pileY, w: size + 6, h: height + 6 }, size, height, box);
    zTop.current += 1;
    const card: OnTable = { uid: uid.current++, deck: deck.key, idx, x: Math.round(spot.x), y: Math.round(spot.y), z: zTop.current, flipped: false, from: { x: pileX, y: pileY }, crowded: spot.crowded };
    setTable((cur) => [...cur, card]);
    setSaid(`Drew a card from ${deck.name}. ${pile.length - 1} left.`);
  }, [piles, deck, size, height, box, table]);

  const shuffle = () => {
    // Every card of this deck on the table goes back, and the pile is shuffled.
    setTable((cur) => cur.filter((t) => t.deck !== deck.key));
    setPiles((p) => ({ ...p, [deck.key]: shuffled(deck.cards.length) }));
    setSaid(`Shuffled ${deck.name}. ${deck.cards.length} cards.`);
    const el = pileRef.current;
    if (el && !reduced()) gsap.fromTo(el, { rotation: -4 }, { rotation: 0, duration: 0.6, ease: 'elastic.out(1, 0.35)' });
  };
  const clear = () => {
    setTable([]);
    setPiles(Object.fromEntries(game.decks.map((d) => [d.key, shuffled(d.cards.length)])));
    setSaid('Cleared the table and shuffled every deck.');
  };
  const flipAll = () => setTable((cur) => cur.map((t) => ({ ...t, flipped: !cur.every((x) => x.flipped) })));

  const raise = useCallback((id: number) => {
    zTop.current += 1;
    const z = zTop.current;
    setTable((cur) => cur.map((t) => (t.uid === id ? { ...t, z } : t)));
  }, []);
  const move = useCallback((id: number, x: number, y: number) => setTable((cur) => cur.map((t) => (t.uid === id ? { ...t, x, y } : t))), []);
  const flip = useCallback((id: number) => setTable((cur) => cur.map((t) => (t.uid === id ? { ...t, flipped: !t.flipped } : t))), []);
  const read = useCallback((card: PlayCard, d: PlayDeck, side: 'a' | 'b') => setReading({ card, deck: d, side }), []);

  const byKey = useMemo(() => Object.fromEntries(game.decks.map((d) => [d.key, d])), [game]);
  const counts = game.decks.map((d) => piles[d.key]?.length ?? 0).join(',');
  const deckTabs = useMemo(
    () =>
      game.decks.map((d) => ({
        key: d.key,
        name: d.name,
        label: (
          <>
            {d.name} <span className="opacity-70">{piles[d.key]?.length ?? 0}</span>
          </>
        ),
      })),
    [game, counts], // eslint-disable-line react-hooks/exhaustive-deps
  );
  // How to play, house rules and special cards are one block with tabs, most important first; a tab shows only when it has something.
  const guide = [
    { value: 'how' as const, label: 'Basics' },
    ...(game.rules && game.rules.length > 0 ? [{ value: 'rules' as const, label: 'House rules' }] : []),
    ...(game.special && game.special.length > 0 ? [{ value: 'special' as const, label: 'Special cards' }] : []),
  ];
  const [guideTab, setGuideTab] = useState<'how' | 'rules' | 'special'>('how');
  const shownGuide = guide.some((g) => g.value === guideTab) ? guideTab : 'how';

  // In focus mode the whole table is one screen-sized column: the buttons on top, the table filling what is left, so on a phone it never runs past the screen.
  return (
    <div
      data-pillar={game.accent}
      className={focus ? 'fixed inset-0 z-40 flex flex-col gap-sm overflow-hidden px-md' : undefined}
      style={focus ? { paddingTop: 'calc(var(--spacing-md) + env(safe-area-inset-top))', paddingBottom: 'calc(var(--spacing-md) + env(safe-area-inset-bottom))' } : undefined}
    >
      {/* A game with one deck has nothing to choose, so in focus mode the lone button (it only repeats the name) goes. Several decks keep theirs. */}
      {/* The decks as one row: as many as fit, the rest behind More, the picked one always in view (TabRow keeps these pills' own look). */}
      <TabRow
        label="Decks"
        items={deckTabs}
        value={deck.key}
        onChange={setDeckKey}
        className={`shrink-0 ${focus ? '' : 'mt-md'} ${focus && game.decks.length === 1 ? 'hidden' : ''}`}
        pillClass={(on) => `toy min-h-[36px] md:min-h-[44px] tap-pad rounded-pill border-2 px-md text-subhead font-medium ${on ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}
      />

      {/* One row: Draw (the one solid button), then Shuffle, Flip all and Clear table as round icons, water and focus mode at the right. How many
          cards are left is on the deck pill and the pile, and read out by the live line below. */}
      <div className={`fill-row flex shrink-0 flex-wrap items-center gap-xs ${focus ? '' : 'mt-sm'}`}>
        <Button size="sm" onClick={draw} disabled={left === 0}>
          Draw a card
        </Button>
        {/* The table's other actions as round icons; on a laptop each one's words slide out on hover. */}
        <ExpandButton icon={Shuffle} label="Shuffle" onClick={shuffle} />
        <ExpandButton icon={FlipHorizontal2} label="Flip all" onClick={flipAll} disabled={table.length === 0} />
        <ExpandButton icon={Eraser} label="Clear table" onClick={clear} disabled={table.length === 0} />
        <div className="ml-auto flex shrink-0 items-center gap-xs">
          {/* Focus mode takes the menu (and with it the corner pill) away, so a running focus clock shows here, small, instead. */}
          {focus && <FocusPill compact />}
          <WaterButton />
          <FocusButton on={focus} onClick={() => onFocus(!focus)} />
        </div>
      </div>
      <p className="sr-only" role="status" aria-live="polite">{said}</p>

      <div ref={boxRef} className={`focus-target relative overflow-hidden rounded-card border border-line bg-card ${focus ? 'min-h-0 flex-1' : 'mt-sm'}`} style={{ ...(focus ? { minHeight: 0 } : { minHeight: narrow ? 480 : 580 }), isolation: 'isolate', background: `linear-gradient(160deg, color-mix(in oklab, ${fillVar(rel)} 14%, transparent), transparent 70%)` }} aria-label="Card table">
        <button
          ref={pileRef}
          type="button"
          onClick={draw}
          aria-label={left ? `Draw a card from ${deck.name}. ${left} left.` : `${deck.name} is empty`}
          className="absolute"
          style={{ left: pileX, top: pileY, width: size, height, zIndex: 1 }}
        >
          {left === 0 ? (
            <span className="flex size-full items-center justify-center rounded-tile border-2 border-dashed border-line p-sm text-center text-subhead text-ink-soft">Empty. Tap Shuffle.</span>
          ) : (
            <>
              {[2, 1, 0].filter((k) => k < left).map((k) => (
                <span key={k} className="absolute inset-0" style={{ transform: `translate(${k * 3}px, ${k * 3}px)`, zIndex: 3 - k }}>
                  <Cover game={game} deck={deck} size={size} badge onHint={k === 0 ? setPileHint : undefined} />
                </span>
              ))}
              <span className="absolute right-xs bottom-xs" style={{ zIndex: 5 }}>
                <StatusTag tone="neutral">{`${left} left`}</StatusTag>
              </span>
            </>
          )}
        </button>
        {table.length === 0 && (
          <div className="absolute text-subhead text-ink-soft" style={{ left: pileX + size + 32, top: 32, right: 16 }}>
            {!pileHint && deck.hint && left > 0 && <p className="mb-sm mt-0 text-ink">{deck.hint}</p>}
            <p className="m-0">Tap the pile to draw. Tap a card to flip it. Drag it where you like.</p>
          </div>
        )}
        {table.map((t) => {
          const d = byKey[t.deck];
          const c = d?.cards[t.idx];
          if (!d || !c) return null;
          return <TableCard key={t.uid} game={game} deck={d} card={c} t={t} size={size} box={box} onRaise={raise} onMove={move} onFlip={flip} onRead={read} />;
        })}
      </div>

      {!focus && (
      <>
      {/* The Rules tabs at the section's top right, level with its title (the founder, 2026-11-06, as Section tools); on a narrow phone
          they wrap under it, still at the right. */}
      <Section id="how-to-play" title="How to play" className="focus-dimmable" tools={guide.length > 1 ? <Segmented label="Rules" value={shownGuide} onChange={setGuideTab} options={guide} /> : undefined}>
        <div className="rounded-card bg-card p-md shadow-toy-soft">
          {/* The rules are read at the table, so they are a reading block (full lines, exempt from the phone's density rule). */}
          {shownGuide === 'how' && <p className="prose-long m-0 text-prose text-ink-soft">{game.howTo}</p>}
          {shownGuide === 'rules' && game.rules && (
            <ul className="m-0 list-none divide-y divide-line p-0">
              {game.rules.map((s) => (
                <li key={s} className="py-sm text-subhead first:pt-0 last:pb-0">{s}</li>
              ))}
            </ul>
          )}
          {shownGuide === 'special' && game.special && (
            <>
              <ul className="m-0 list-none divide-y divide-line p-0">
                {game.special.map((s) => (
                  <li key={s} className="py-sm text-subhead first:pt-0 last:pb-0">{s}</li>
                ))}
              </ul>
              {game.specialNote && <p className="mt-sm m-0 text-subhead text-ink-soft">{game.specialNote}</p>}
              <div className="mt-sm flex flex-wrap items-center gap-xs">
                <Button
                  size="sm"
                  variant="outline"
                  aria-controls="special-card"
                  onClick={() => {
                    setSpecial(game.special![Math.floor(Math.random() * game.special!.length)]!);
                    setSpecialShown(true);
                  }}
                >
                  Draw a special card
                </Button>
                {special !== null && (
                  <button
                    type="button"
                    aria-expanded={specialShown}
                    aria-controls="special-card"
                    onClick={() => setSpecialShown((v) => !v)}
                    className="toy toy-flat inline-flex min-h-[44px] items-center gap-xs rounded-pill px-sm text-subhead text-ink-soft"
                  >
                    {specialShown ? 'Hide the card' : 'Show the card'}
                    <ToggleChevron open={specialShown} size={14} />
                  </button>
                )}
              </div>
              <div id="special-card" aria-live="polite">
                {special !== null && specialShown && (
                  <div className="mt-xs rounded-tile bg-paper p-sm">
                    <p className="m-0 text-caption text-ink-soft">Special card</p>
                    <p className="mt-xs m-0 text-headline">{special}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </Section>

      </>
      )}

      <Sheet open={reading !== null} onClose={() => setReading(null)} title={reading ? reading.card.title ?? reading.deck.name : ''}>
        {reading && (
          <div className="flex flex-col gap-xs">
            <p className="m-0 text-caption text-ink-soft">{reading.deck.name}{(reading.side === 'a' ? reading.card.label : reading.card.alt?.label) ? `, ${reading.side === 'a' ? reading.card.label : reading.card.alt?.label}` : ''}</p>
            {(reading.side === 'a' ? reading.card.text : reading.card.alt?.text) && <p className="m-0 text-callout">{reading.side === 'a' ? reading.card.text : reading.card.alt?.text}</p>}
            {reading.side === 'a' && reading.card.list && (
              <ul className="m-0 list-disc pl-md text-subhead text-ink-soft">
                {reading.card.list.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Sheet>
    </div>
  );
}

export function CardTable() {
  const focus = useFocus((s) => s.on);
  const setFocus = useFocus((s) => s.set);
  const { game: key = '' } = useParams();

  // Focus mode: the menu and the assistant step aside, and the browser's own fullscreen is asked for where it exists (not on every phone).
  const enter = (on: boolean) => {
    setFocus(on);
    try {
      if (on && !document.fullscreenElement) void document.documentElement.requestFullscreen?.().catch(() => undefined);
      if (!on && document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    } catch {
      // no fullscreen here: the app-level focus still works
    }
  };
  useEffect(() => {
    if (!focus) return;
    const key = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && enter(false);
    const fs = () => !document.fullscreenElement && setFocus(false);
    window.addEventListener('keydown', key);
    document.addEventListener('fullscreenchange', fs);
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', key);
      document.removeEventListener('fullscreenchange', fs);
      document.documentElement.style.overflow = prev;
    };
  }, [focus]); // eslint-disable-line react-hooks/exhaustive-deps
  // Leaving the table always leaves focus mode.
  useEffect(() => () => {
    setFocus(false);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
  }, [setFocus]);
  const q = useCardGame(key);
  const qc = useQueryClient();
  const info = CARD_GAME_BY_KEY[key];
  const data = q.data?.game;
  const err = q.error instanceof Error ? q.error.message : '';

  return (
    <Screen howTo={false} tabs={!focus} wide={focus} className="focus-scope card-table-scope">
      {/* The header is the screen's first child, so on a phone it clears the floating logo; app.css (card-table-scope) dims it like the rest. */}
      {!focus && <PageHeader back={{ to: '/cards', label: 'Games' }} title={tie(info?.name ?? 'Card game')} lede={info?.tagline} />}
      {q.isPending && (
        <Busy label="Shuffling the deck">
          <div className="mt-md flex gap-xs">
            <Skeleton className="h-[44px] w-[120px] rounded-pill" />
            <Skeleton className="h-[44px] w-[120px] rounded-pill" />
          </div>
          <Skeleton className="mt-sm h-[480px] w-full rounded-card" />
        </Busy>
      )}
      {q.isError && (
        <div className="mt-md rounded-card bg-card p-md shadow-toy-soft" role="alert">
          <p className="m-0 font-semibold">{err || 'Could not open this game.'}</p>
          {info ? (
            <Link to="/rewards#games" className="toy mt-sm inline-flex min-h-[40px] md:min-h-[48px] tap-pad items-center justify-center rounded-pill bg-ink px-md text-headline text-on-ink">
              Unlock it in Rewards
            </Link>
          ) : (
            <Button variant="outline" className="mt-sm" onClick={() => qc.invalidateQueries({ queryKey: ['cards'] })}>
              Try again
            </Button>
          )}
        </div>
      )}
      {data && <Table key={data.key} game={data} focus={focus} onFocus={enter} />}
    </Screen>
  );
}
