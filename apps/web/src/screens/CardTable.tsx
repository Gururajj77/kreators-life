import { CARD_GAME_BY_KEY, RELATIONSHIP_BY_KEY, type CardGamePlay, type PlayCard, type PlayDeck } from '@kreators/shared';
import { useQueryClient } from '@tanstack/react-query';
import gsap from 'gsap';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { Link, useParams } from 'react-router';
import { Button } from '../components/Button';
import { HeroBlobs } from '../components/Hero';
import { BackLink } from '../components/PageHeader';
import { Screen } from '../components/Screen';
import { Section } from '../components/Section';
import { Sheet } from '../components/Sheet';
import { useCardGame } from '../lib/queries';
import { WaterButton } from '../components/Reminders';
import { useFocus } from '../lib/store';

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
}

const fill = (color: string): CSSProperties => ({ background: `linear-gradient(135deg, ${color}, color-mix(in oklab, ${color} 72%, var(--fill-shade)))` });

/** The back of every card in a game: its colour, its flower, its name. A deck can add its own line. */
function Cover({ game, deck, size }: { game: CardGamePlay; deck?: PlayDeck; size: number }) {
  const rel = RELATIONSHIP_BY_KEY[game.accent];
  return (
    <div className="relative flex size-full flex-col items-center justify-center gap-xs overflow-hidden rounded-tile p-sm text-center text-on-fill" style={fill(rel.color)}>
      <HeroBlobs seed={game.key} opacity={0.2} />
      <span className="relative leading-none" style={{ fontSize: size * 0.28 }} aria-hidden="true">
        {game.emoji}
      </span>
      <span className="relative font-display font-extrabold leading-[1.15]" style={{ fontSize: Math.max(14, size * 0.1) }}>
        {game.name}
      </span>
      {deck && <span className="relative text-[12px] font-bold opacity-90">{deck.name}</span>}
      {deck?.hint && <span className="relative text-[12px] font-semibold leading-[1.3]">{deck.hint}</span>}
    </div>
  );
}

/** One side of a card with words on it. */
function Face({ game, deck, label, title, text, list, size, onRead }: { game: CardGamePlay; deck: PlayDeck; label?: string; title?: string; text: string; list?: string[]; size: number; onRead: () => void }) {
  const rel = RELATIONSHIP_BY_KEY[game.accent];
  const long = text.length + (list?.join('').length ?? 0) > 150;
  return (
    <div className="flex size-full flex-col overflow-hidden rounded-tile border border-line bg-card-strong text-ink">
      <div className="flex items-center justify-between gap-xs px-sm py-xs text-on-fill" style={fill(rel.color)}>
        <span className="truncate text-[12px] font-extrabold">{deck.name}</span>
        {label && <span className="shrink-0 rounded-pill bg-white/20 px-xs text-[12px] font-extrabold">{label}</span>}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-xs p-sm">
        {title && <p className="m-0 font-display font-extrabold leading-[1.2]" style={{ fontSize: Math.max(15, size * 0.095) }}>{title}</p>}
        {text && <p className="m-0 font-semibold leading-[1.35]" style={{ fontSize: Math.max(13, size * (long ? 0.066 : 0.08)), display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: list ? 4 : long ? 7 : 9, overflow: 'hidden' }}>{text}</p>}
        {list && list.length > 0 && (
          <ul className="m-0 list-disc pl-md font-semibold text-ink-soft" style={{ fontSize: Math.max(12, size * 0.062) }}>
            {list.slice(0, 2).map((x) => (
              <li key={x} className="line-clamp-2">{x}</li>
            ))}
          </ul>
        )}
        {(long || (list && list.length > 2)) && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onRead();
            }}
            className="mt-auto self-start text-[12px] font-extrabold underline underline-offset-4"
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
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number; moved: boolean; nx: number; ny: number } | null>(null);
  const first = useRef(true);
  const h = Math.round(size * 1.4);

  // The deal: from the pile to its spot. Afterwards the position is set outright, so a drag never fights an animation.
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    if (first.current) {
      first.current = false;
      if (reduced()) gsap.set(el, { x: t.x, y: t.y });
      else gsap.fromTo(el, { x: t.from.x, y: t.from.y, rotation: -8, scale: 0.9 }, { x: t.x, y: t.y, rotation: 0, scale: 1, duration: 0.45, ease: 'power3.out' });
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
    el.dataset.set = '1';
    if (reduced()) gsap.set(el, { rotateY: t.flipped ? 180 : 0 });
    else gsap.to(el, { rotateY: t.flipped ? 180 : 0, duration: 0.5, ease: 'power2.inOut' });
  }, [t.flipped]);

  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { sx: e.clientX, sy: e.clientY, ox: t.x, oy: t.y, moved: false, nx: t.x, ny: t.y };
    onRaise(t.uid);
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) < 5) return;
    d.moved = true;
    d.nx = Math.min(Math.max(0, d.ox + dx), Math.max(0, box.w - size));
    d.ny = Math.min(Math.max(0, d.oy + dy), Math.max(0, box.h - h));
    if (root.current) gsap.set(root.current, { x: d.nx, y: d.ny });
  };
  const up = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.moved) onMove(t.uid, d.nx, d.ny);
    else onFlip(t.uid);
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
      onPointerUp={up}
      onPointerCancel={up}
      onKeyDown={key}
      className="absolute top-0 left-0 cursor-grab touch-none select-none outline-none active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-ink"
      style={{ width: size, height: h, zIndex: t.z, perspective: 900 }}
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

const ICON_ENTER = 'M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3';
const ICON_EXIT = 'M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3';

/** The fullscreen button: corner brackets pointing out to enter, pointing in to leave. */
function FocusButton({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      aria-label={on ? 'Leave focus mode' : 'Focus mode: hide the menu and the assistant'}
      title={on ? 'Leave focus mode (Esc)' : 'Focus mode'}
      className="toy toy-soft flex min-h-[44px] min-w-[44px] items-center justify-center gap-xs rounded-pill border border-line bg-card-strong px-sm text-[14px] font-bold text-ink"
    >
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d={on ? ICON_EXIT : ICON_ENTER} />
      </svg>
      <span className="hidden sm:inline">{on ? 'Leave focus' : 'Focus mode'}</span>
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
  const [special, setSpecial] = useState<string | null>(null);
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
  const size = Math.round(Math.min(210, Math.max(132, box.w * (narrow ? 0.42 : 0.2))));
  const height = Math.round(size * 1.4);
  const pileX = 16;
  const pileY = 16;
  const left = piles[deck.key]?.length ?? 0;

  const draw = useCallback(() => {
    const pile = piles[deck.key] ?? [];
    const idx = pile[pile.length - 1];
    if (idx === undefined) {
      setSaid(`${deck.name} is out of cards. Tap Shuffle to gather them again.`);
      return;
    }
    setPiles((p) => ({ ...p, [deck.key]: pile.slice(0, -1) }));
    setTable((cur) => {
      // Cards go anywhere on the table, the whole of it. Each new card takes the open spot nearest the middle that does not sit on another
      // card or the pile; once the middle is full it works outwards, left and right alike, so nothing drifts to one side.
      const n = uid.current;
      const maxX = Math.max(0, box.w - size - 8);
      const maxY = Math.max(0, box.h - height - 8);
      const step = Math.max(24, Math.round(size * 0.3));
      const others = [{ x: pileX, y: pileY }, ...cur.map((c) => ({ x: c.x, y: c.y }))];
      const mid = { x: maxX / 2, y: maxY / 2 };
      let best = { x: 8, y: 8, score: -Infinity };
      for (let gy = 8; gy <= Math.max(8, maxY); gy += step) {
        for (let gx = 8; gx <= Math.max(8, maxX); gx += step) {
          const x0 = Math.min(maxX, gx + ((n * 7) % 13) - 6);
          const y0 = Math.min(maxY, gy + ((n * 11) % 13) - 6);
          // How far the nearest card is, counted only up to a card and a bit: past that, the spot is as good as any.
          const near = Math.min(...others.map((o) => Math.hypot(o.x - x0, o.y - y0)), size * 1.1);
          const score = near - 0.5 * Math.hypot(x0 - mid.x, y0 - mid.y);
          if (score > best.score) best = { x: x0, y: y0, score };
        }
      }
      const x = Math.max(0, best.x);
      const y = Math.max(0, best.y);
      zTop.current += 1;
      return [...cur, { uid: uid.current++, deck: deck.key, idx, x: Math.round(x), y: Math.round(y), z: zTop.current, flipped: false, from: { x: pileX, y: pileY } }];
    });
    setSaid(`Drew a card from ${deck.name}. ${pile.length - 1} left.`);
  }, [piles, deck, size, height, box.w, box.h]);

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

  // In focus mode the whole table is one screen-sized column: the buttons on top, the table filling what is left, so on a phone it never runs past the screen.
  return (
    <div
      className={focus ? 'fixed inset-0 z-40 flex flex-col gap-sm overflow-hidden px-md' : undefined}
      style={focus ? { paddingTop: 'calc(var(--spacing-md) + env(safe-area-inset-top))', paddingBottom: 'calc(var(--spacing-md) + env(safe-area-inset-bottom))' } : undefined}
    >
      {/* A game with one deck has nothing to choose, so in focus mode the lone button (it only repeats the name) goes. Several decks keep theirs. */}
      <div className={`scroll-row flex shrink-0 gap-xs ${focus ? '' : 'mt-md'} ${focus && game.decks.length === 1 ? 'hidden' : ''}`} role="group" aria-label="Decks">
        {game.decks.map((d) => (
          <button key={d.key} type="button" aria-pressed={d.key === deck.key} onClick={() => setDeckKey(d.key)} className={`toy min-h-[44px] shrink-0 rounded-pill border-2 px-md text-[14px] font-bold ${d.key === deck.key ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
            {d.name} <span className="font-semibold opacity-70">{piles[d.key]?.length ?? 0}</span>
          </button>
        ))}
      </div>

      <div className={`flex shrink-0 flex-wrap items-center gap-xs ${focus ? '' : 'mt-sm'}`}>
        <Button size="sm" onClick={draw} disabled={left === 0}>
          Draw a card
        </Button>
        <Button size="sm" variant="outline" onClick={shuffle}>
          Shuffle
        </Button>
        <Button size="sm" variant="outline" onClick={flipAll} disabled={table.length === 0}>
          Flip all
        </Button>
        <Button size="sm" variant="ghost" onClick={clear} disabled={table.length === 0}>
          Clear table
        </Button>
        <span className="text-[14px] font-bold text-ink-soft">{left} left in {deck.name}</span>
        <div className="ml-auto flex items-center gap-xs">
          <WaterButton />
          <FocusButton on={focus} onClick={() => onFocus(!focus)} />
        </div>
      </div>
      <p className="sr-only" role="status" aria-live="polite">{said}</p>

      <div ref={boxRef} className={`focus-target relative overflow-hidden rounded-card border border-line bg-card ${focus ? 'min-h-0 flex-1' : 'mt-sm'}`} style={{ ...(focus ? { minHeight: 0 } : { minHeight: narrow ? 480 : 580 }), isolation: 'isolate', background: `linear-gradient(160deg, var(--soft-${rel.key}), transparent 70%)` }} aria-label="Card table">
        <button
          ref={pileRef}
          type="button"
          onClick={draw}
          aria-label={left ? `Draw a card from ${deck.name}. ${left} left.` : `${deck.name} is empty`}
          className="absolute"
          style={{ left: pileX, top: pileY, width: size, height, zIndex: 1 }}
        >
          {left === 0 ? (
            <span className="flex size-full items-center justify-center rounded-tile border-2 border-dashed border-line p-sm text-center text-[14px] font-bold text-ink-soft">Empty. Tap Shuffle.</span>
          ) : (
            <>
              {[2, 1, 0].filter((k) => k < left).map((k) => (
                <span key={k} className="absolute inset-0" style={{ transform: `translate(${k * 3}px, ${k * 3}px)`, zIndex: 3 - k }}>
                  <Cover game={game} deck={deck} size={size} />
                </span>
              ))}
              <span className="absolute right-xs bottom-xs rounded-pill bg-card-strong px-xs text-[12px] font-extrabold text-ink" style={{ zIndex: 5 }}>{left}</span>
            </>
          )}
        </button>
        {table.length === 0 && <p className="absolute m-0 text-[14px] font-semibold text-ink-soft" style={{ left: pileX + size + 32, top: 32, right: 16 }}>Tap the pile to draw. Tap a card to flip it. Drag it where you like.</p>}
        {table.map((t) => {
          const d = byKey[t.deck];
          const c = d?.cards[t.idx];
          if (!d || !c) return null;
          return <TableCard key={t.uid} game={game} deck={d} card={c} t={t} size={size} box={box} onRaise={raise} onMove={move} onFlip={flip} onRead={read} />;
        })}
      </div>

      {!focus && (
      <>
      <Section id="how-to-play" title="How to play" className="focus-dimmable">
        <p className="m-0 text-[14px] font-semibold text-ink-soft">{game.howTo}</p>
      </Section>
      {game.special && game.special.length > 0 && (
        <Section id="special-cards" title="Special cards" className="focus-dimmable">
          <ul className="m-0 flex list-none flex-col gap-xs p-0">
            {game.special.map((s) => (
              <li key={s} className="rounded-tile bg-card p-sm text-[14px] font-semibold shadow-toy-soft">{s}</li>
            ))}
          </ul>
          {game.specialNote && <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">{game.specialNote}</p>}
          <Button className="mt-sm" size="sm" variant="outline" onClick={() => setSpecial(game.special![Math.floor(Math.random() * game.special!.length)]!)}>
            Draw a special card
          </Button>
        </Section>
      )}
      {game.rules && game.rules.length > 0 && (
        <Section id="house-rules" title="House rules" className="focus-dimmable">
          <ul className="m-0 flex list-none flex-col gap-xs p-0">
            {game.rules.map((s) => (
              <li key={s} className="rounded-tile bg-card p-sm text-[14px] font-semibold shadow-toy-soft">{s}</li>
            ))}
          </ul>
        </Section>
      )}

      </>
      )}

      <Sheet open={reading !== null} onClose={() => setReading(null)} title={reading ? reading.card.title ?? reading.deck.name : ''}>
        {reading && (
          <div className="flex flex-col gap-xs">
            <p className="m-0 text-[12px] font-extrabold text-ink-soft">{reading.deck.name}{(reading.side === 'a' ? reading.card.label : reading.card.alt?.label) ? `, ${reading.side === 'a' ? reading.card.label : reading.card.alt?.label}` : ''}</p>
            {(reading.side === 'a' ? reading.card.text : reading.card.alt?.text) && <p className="m-0 text-[16px] font-semibold">{reading.side === 'a' ? reading.card.text : reading.card.alt?.text}</p>}
            {reading.side === 'a' && reading.card.list && (
              <ul className="m-0 list-disc pl-md text-[14px] font-semibold text-ink-soft">
                {reading.card.list.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Sheet>
      <Sheet open={special !== null} onClose={() => setSpecial(null)} title="Special card">
        <p className="m-0 text-[18px] font-bold">{special}</p>
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
    <Screen howTo={false} tabs={!focus} wide={focus} className="focus-scope">
      <header className={`focus-dimmable pt-lg ${focus ? 'hidden' : ''}`}>
        <BackLink to="/cards">Games</BackLink>
        <h1 className="text-[30px]">
          <span aria-hidden="true">{info?.emoji} </span>
          {info?.name ?? 'Card game'}
        </h1>
        {info && <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">{info.tagline}</p>}
      </header>
      {q.isPending && (
        <p className="mt-md text-[14px] font-bold text-ink-soft" role="status">
          Shuffling the deck
        </p>
      )}
      {q.isError && (
        <div className="mt-md rounded-card bg-card p-md shadow-toy-soft" role="alert">
          <p className="m-0 font-bold">{err || 'Could not open this game.'}</p>
          {info ? (
            <Link to="/rewards#games" className="toy mt-sm inline-flex min-h-[48px] items-center justify-center rounded-pill bg-ink px-md text-[16px] font-bold text-on-ink">
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
