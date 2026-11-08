import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router';
import { scrollToTarget, topBarHeight } from '../lib/landOnHash';
import { useFocus } from '../lib/store';
import { dialogOpen } from '../lib/useDialogFocus';

/**
 * "On this page" (2026-11-07, the founder: small dashes at the top right that act as a scroll and, hovered, say the name of each section).
 * At rest one button at the top right, under the top bar: a stack of small dashes, one for each heading of the page, the one being read
 * darker and longer. A mouse that points at it opens a small card to its left with the headings by name; a click on a dash or a row goes
 * there. A keyboard or a finger opens the card with the button instead, and goes from its rows.
 *
 * Nothing lists its own headings: they are read from the page's `main`. Mounted once in Root for the `md` test (so a phone never downloads
 * it), and it stays away from a screen whose right gutter cannot hold it (`ROOM`), a page with fewer than two headings, a page that cannot
 * scroll (`MIN_SCROLL`, the founder, 2026-11-07: a dash there would only light its row), focus mode and the pages in `NEVER`. It calls no API and never touches the address, so a tab or a switch keeps its place and Back never walks through sections.
 * It draws into the page's own `[data-contents-slot]` (Screen and SiteLayout, just before `main`), so a keyboard meets it before the page and
 * not after every control in it.
 */

/** One conversation or one table, with nothing to jump between: the two chats, the vibe check, Welcome and the card table. */
const NEVER = /^\/(onboarding|session|vibe-check|start|cards\/[^/]+)(\/|$)/;
/** Not a section of the page, wherever it sits in `main`: a list's rows (a list whose items are the page's sections says so, as the books do), menus, a sheet, what is hidden from people or from screen readers, sideways rows of cards, search answers. */
const NOT_A_SECTION = 'li:not([data-contents-section]), nav, footer, dialog, [role="dialog"], [aria-hidden="true"], [hidden], [inert], .sr-only, .scroll-row, [aria-label="Search results"]';
const CARD = '.rounded-card, .rounded-tile, .toy, article';
/** Past this many rows a page's third-level headings go; the card still scrolls for a page with more sections than that (/privacy has 27). */
const MAX_ROWS = 20;
const BUTTON_WIDTH = 44;
/** The button, and the 32px a band of the page may grow into the gutter (the public hero, a sticky bar, a sideways row). */
const ROOM = BUTTON_WIDTH + 32;
/** How far a page must be able to scroll for the dashes to do anything. A few pixels of slack in a page that fits the window is not scrolling. */
const MIN_SCROLL = 64;
const PASS_MS = 200;
const OPEN_MS = 100;
const CLOSE_MS = 260;
/** A heading counts as the one being read from a little under where going to it lands (`GAP` in landOnHash.ts, 16px under the bar). */
const READ_LINE = 24;
/** The person moving the page themselves, which ends going to a heading, and the longest it waits for the window to arrive. */
const TOOK_OVER = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;
const LAND_MS = 3000;

interface Row {
  el: HTMLElement;
  key: number;
  depth: number;
  name: string;
}

const KEYS = new WeakMap<Element, number>();
let nextKey = 1;
function keyOf(el: Element): number {
  let key = KEYS.get(el);
  if (!key) {
    key = nextKey++;
    KEYS.set(el, key);
  }
  return key;
}

/** A title on one of a row of cards, not a section: an h3 beside one card like it, an h2 beside two. Two big cards with an h2 each are sections (Fitness's Log movement and How you ate). */
function cardTitle(h: HTMLElement): boolean {
  const card = h.parentElement?.closest(CARD);
  const row = card?.parentElement;
  if (!card || !row) return false;
  let others = 0;
  for (const sib of row.children) {
    if (sib !== card && sib.matches(CARD) && sib.querySelector(h.tagName)) others += 1;
  }
  return others >= (h.tagName === 'H3' ? 1 : 2);
}

function seen(h: HTMLElement): boolean {
  if (typeof h.checkVisibility === 'function' && !h.checkVisibility({ checkVisibilityCSS: true })) return false;
  return h.getBoundingClientRect().height > 0;
}

function headingsIn(main: Element): Row[] {
  const found: { el: HTMLElement; level: number; name: string }[] = [];
  for (const el of main.querySelectorAll<HTMLElement>('h1, h2, h3')) {
    if (el.closest(NOT_A_SECTION) || cardTitle(el) || !seen(el)) continue;
    // A heading with more in it than its name (How it works, with its toggle's line) says which words are its name.
    const name = (el.dataset.contents ?? el.innerText).replace(/\s+/g, ' ').trim();
    // An agreement's title is both the screen's heading and the paper's, one under the other: one row.
    if (name && name !== found.at(-1)?.name) found.push({ el, level: Number(el.tagName[1]), name });
  }
  const kept = found.length > MAX_ROWS ? found.filter((f) => f.level < 3) : found;
  const top = Math.min(...kept.map((f) => f.level));
  return kept.map((f) => ({ el: f.el, key: keyOf(f.el), depth: f.level - top, name: f.name }));
}

function sameRows(a: Row[], b: Row[]): boolean {
  return a.length === b.length && a.every((r, i) => r.el === b[i]?.el && r.name === b[i]?.name && r.depth === b[i]?.depth);
}

/** Whether the window has room at the right of the page's column. A guide standing out in that margin (GuideLine, from 1200px) reaches further than any band, so it counts by itself. */
function roomBeside(main: Element): boolean {
  const width = document.documentElement.clientWidth;
  const column = main.getBoundingClientRect().right - (parseFloat(getComputedStyle(main).paddingRight) || 0);
  if (width - column < ROOM) return false;
  return Array.from(main.querySelectorAll('.guide-right')).every((guide) => width - guide.getBoundingClientRect().right >= BUTTON_WIDTH);
}

function quietNode(node: Node): boolean {
  const el = node instanceof Element ? node : node.parentElement;
  return Boolean(el?.closest('[data-rect-quiet]'));
}

/** Whether a change in the page can change the rows: a ticking clock's never does, and of the words that change only a heading's do. */
function matters(r: MutationRecord): boolean {
  if (quietNode(r.target)) return false;
  return r.type !== 'characterData' || Boolean(r.target.parentElement?.closest('h1, h2, h3'));
}

export function PageContents() {
  const { pathname } = useLocation();
  const focus = useFocus((s) => s.on);
  const off = focus || NEVER.test(pathname);
  const [rows, setRows] = useState<Row[]>([]);
  const [roomy, setRoomy] = useState(false);
  const [scrolls, setScrolls] = useState(false);
  const [current, setCurrent] = useState(0);
  const [open, setOpen] = useState(false);
  /** The row a mouse on the dashes is pointing at. */
  const [pointed, setPointed] = useState<number | null>(null);
  const [slot, setSlot] = useState<Element | null>(null);
  const shown = !off && roomy && scrolls && rows.length >= 2;

  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const stack = useRef<HTMLSpanElement>(null);
  const card = useRef<HTMLElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const cardId = useId();
  /** Opened by a keyboard or a finger: it stays until asked to close, where a mouse's closes on leaving. */
  const pinned = useRef(false);
  const lastPointer = useRef('');
  const wait = useRef(0);
  const readLine = useRef(READ_LINE);
  const slotNow = useRef<Element | null>(null);
  /** A mouse is on the card's rows, so they stay where they are. */
  const overCard = useRef(false);
  /** The heading a row or a dash asked for, how near the window has come, until the person scrolls on. */
  const going = useRef<{ el: HTMLElement; line: number; off: number } | null>(null);
  /** Ends the wait for the window to arrive (see `go`). */
  const stopLanding = useRef<(() => void) | null>(null);
  // The rows are built the first time the card opens, so a page that never opens it holds only its dashes.
  const built = useRef(false);
  if (open) built.current = true;

  const read = useCallback(() => {
    const main = document.querySelector('main');
    const found = main ? headingsIn(main) : [];
    setRows((had) => (sameRows(had, found) ? had : found));
    setRoomy(main ? roomBeside(main) : false);
    readLine.current = topBarHeight() + READ_LINE;
    slotNow.current = document.querySelector('[data-contents-slot]');
    setSlot(slotNow.current);
  }, []);

  // One pass at most every 200ms however much the page changes. A ticking clock (data-rect-quiet) never starts one, and neither do sheets,
  // which are portalled outside the root.
  useEffect(() => {
    if (off) {
      setRows((had) => (had.length ? [] : had));
      return;
    }
    let timer = 0;
    const soon = () => {
      if (timer) return;
      timer = window.setTimeout(() => {
        timer = 0;
        read();
      }, PASS_MS);
    };
    const changes = new MutationObserver((records) => {
      if (!records.some(matters)) return;
      // The slot went with its page: find the next page's now, so the dashes do not blink on a page change.
      if (slotNow.current && !slotNow.current.isConnected) read();
      else soon();
    });
    changes.observe(document.getElementById('root') ?? document.body, { childList: true, subtree: true, characterData: true });
    window.addEventListener('resize', soon, { passive: true });
    read();
    return () => {
      changes.disconnect();
      window.removeEventListener('resize', soon);
      window.clearTimeout(timer);
    };
  }, [off, read]);

  // Whether the page can scroll, read whenever the page or the window changes size, so a page that grows long (a Fold opening, late data, a
  // shorter window) gets its dashes and one that shrinks loses them. It reads one number and nothing else, so a page that keeps moving costs little.
  useEffect(() => {
    if (off) return;
    const check = () => setScrolls(document.documentElement.scrollHeight - window.innerHeight >= MIN_SCROLL);
    const sizes = new ResizeObserver(check);
    sizes.observe(document.getElementById('root') ?? document.body);
    window.addEventListener('resize', check, { passive: true });
    check();
    return () => {
      sizes.disconnect();
      window.removeEventListener('resize', check);
    };
  }, [off, pathname]);

  // The section being read: the last heading that has come up to the line, at most once a frame. The headings of a page's last screen can never
  // reach the line, so over that last screen the line slides down to the window's foot: each still gets its turn, and the last one on screen is
  // the one at the very end. At the very top it is always the first. What a row or a dash asked for stays the one until the person scrolls on,
  // though the page may end before it reaches the line and another heading may stand level with it.
  useEffect(() => {
    if (!shown) return;
    let frame = 0;
    const look = () => {
      frame = 0;
      const asked = going.current;
      if (asked) {
        const off = Math.abs(asked.el.getBoundingClientRect().top - asked.line);
        const at = off <= asked.off + 2 ? rows.findIndex((r) => r.el === asked.el) : -1;
        if (at >= 0) {
          asked.off = Math.min(asked.off, off);
          setCurrent(at);
          return;
        }
        going.current = null;
      }
      const y = window.scrollY;
      if (y <= 1) {
        setCurrent(0);
        return;
      }
      const screen = window.innerHeight;
      const end = document.documentElement.scrollHeight - screen;
      const last = Math.min(end, screen);
      const slide = last > 0 ? Math.max(0, Math.min(1, (y + 2 - (end - last)) / last)) : 0;
      const line = readLine.current + slide * Math.max(0, screen - readLine.current);
      let at = 0;
      rows.forEach((r, i) => {
        if (r.el.getBoundingClientRect().top <= line) at = i;
      });
      setCurrent(at);
    };
    const ask = () => {
      if (!frame) frame = requestAnimationFrame(look);
    };
    window.addEventListener('scroll', ask, { passive: true });
    window.addEventListener('resize', ask, { passive: true });
    ask();
    return () => {
      window.removeEventListener('scroll', ask);
      window.removeEventListener('resize', ask);
      cancelAnimationFrame(frame);
    };
  }, [shown, rows]);

  const closeNow = useCallback(() => {
    window.clearTimeout(wait.current);
    pinned.current = false;
    setOpen(false);
    setPointed(null);
    overCard.current = false;
  }, []);

  useEffect(
    () => () => {
      window.clearTimeout(wait.current);
      stopLanding.current?.();
    },
    [],
  );
  // A page change closes it.
  useEffect(() => closeNow(), [pathname, shown, closeNow]);
  useEffect(() => {
    if (open) read();
  }, [open, read]);

  // Escape closes it and hands focus back; a tap outside closes it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape' || dialogOpen()) return;
      const inside = root.current?.contains(document.activeElement);
      closeNow();
      if (inside) button.current?.focus();
    };
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) closeNow();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown, true);
    };
  }, [open, closeNow]);

  // The row that matters stays in sight inside the card: the one a dash points at, else the one being read, but never under a mouse that is on
  // the rows (a click there sets the page moving, and the row must not run away from the pointer) or one crossing from a dash to its row.
  const inSight = useCallback((i: number) => {
    const box = card.current;
    const row = list.current?.children[i] as HTMLElement | undefined;
    if (!box || !row) return;
    const edge = 8;
    const top = row.offsetTop;
    const bottom = top + row.offsetHeight;
    if (top - edge < box.scrollTop) box.scrollTop = top - edge;
    else if (bottom + edge > box.scrollTop + box.clientHeight) box.scrollTop = bottom + edge - box.clientHeight;
  }, []);
  useEffect(() => {
    if (open && pointed !== null) inSight(pointed);
  }, [open, pointed, inSight]);
  const pointedNow = useRef(pointed);
  pointedNow.current = pointed;
  useEffect(() => {
    if (open && pointedNow.current === null && !overCard.current) inSight(current);
  }, [open, current, inSight]);

  // A name the card cuts short keeps its whole words in the row's title; one that fits needs no tooltip.
  useEffect(() => {
    if (!open) return;
    for (const row of list.current?.querySelectorAll('button') ?? []) {
      const words = row.firstElementChild;
      if (words && words.scrollWidth > words.clientWidth) row.title = words.textContent ?? '';
      else row.removeAttribute('title');
    }
  }, [open, rows]);

  if (!shown) return null;

  const later =(fn: () => void, ms: number) => {
    window.clearTimeout(wait.current);
    wait.current = window.setTimeout(fn, ms);
  };

  const go = (i: number, takeFocus: boolean) => {
    const h = rows[i]?.el;
    if (!h?.isConnected) return;
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // The page's first heading is its title: going there goes back to the top, with the cover or the header it sits in.
    const toTop = i === 0 && h.getBoundingClientRect().top + window.scrollY < window.innerHeight;
    const goThere = () => {
      going.current = { el: h, line: readLine.current, off: Math.abs(h.getBoundingClientRect().top - readLine.current) };
      setCurrent(i);
      if (toTop) window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
      else scrollToTarget(h, smooth);
    };
    stopLanding.current?.();
    goThere();
    if (smooth) {
      // A picture or a late section above it can move it a little while the window goes there, so once the window stops it goes there again,
      // unless the person took over or the window is somewhere else by then. A browser with no scrollend event only misses that second go.
      const arrived = () => {
        stopLanding.current?.();
        if (h.isConnected && Math.abs(h.getBoundingClientRect().top - readLine.current) < window.innerHeight / 4) goThere();
      };
      const timer = window.setTimeout(() => stopLanding.current?.(), LAND_MS);
      const stop = () => {
        window.clearTimeout(timer);
        window.removeEventListener('scrollend', arrived);
        for (const e of TOOK_OVER) window.removeEventListener(e, stop, { capture: true });
        stopLanding.current = null;
      };
      window.addEventListener('scrollend', arrived);
      for (const e of TOOK_OVER) window.addEventListener(e, stop, { passive: true, capture: true });
      stopLanding.current = stop;
    }
    if (!takeFocus) return;
    // Only for the keyboard, and only for as long as it stands there; a mouse never moves focus to a heading, so it never draws a ring.
    if (!h.hasAttribute('tabindex') && !h.isContentEditable) {
      h.setAttribute('tabindex', '-1');
      h.addEventListener('blur', () => h.removeAttribute('tabindex'), { once: true });
    }
    h.focus({ preventScroll: true });
  };

  /** Which dash a pointer is at, from where it is: the one button holds them all, so there is no row of tiny targets. */
  const dashAt = (y: number) => {
    const first = stack.current?.firstElementChild?.getBoundingClientRect();
    if (!first || first.height <= 0) return 0;
    return Math.max(0, Math.min(rows.length - 1, Math.floor((y - first.top) / first.height)));
  };

  const onDashes = (e: MouseEvent) => {
    // A mouse goes to the dash under it. `detail` is 0 for Enter or Space; a finger cannot aim at a 2px dash, so it opens the card too.
    if (e.detail !== 0 && lastPointer.current === 'mouse') {
      go(dashAt(e.clientY), false);
      return;
    }
    if (open) {
      closeNow();
    } else {
      window.clearTimeout(wait.current);
      pinned.current = true;
      setOpen(true);
    }
  };

  const onRow = (e: MouseEvent, i: number) => {
    const keyboard = e.detail === 0;
    go(i, keyboard);
    if (keyboard || lastPointer.current !== 'mouse') closeNow();
  };

  const onArrow = (e: KeyboardEvent) => {
    if (!open || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return;
    const items = Array.from(list.current?.querySelectorAll('button') ?? []);
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = at < 0 ? current : at + (e.key === 'ArrowDown' ? 1 : -1);
    items[Math.max(0, Math.min(items.length - 1, next))]?.focus();
    e.preventDefault();
  };

  const ui = (
    <div
      ref={root}
      className="page-contents no-print"
      data-rect-quiet=""
      style={{ '--pc-n': rows.length } as CSSProperties}
      onPointerDown={(e) => {
        lastPointer.current = e.pointerType;
      }}
      onPointerEnter={(e) => {
        if (e.pointerType === 'mouse') later(() => setOpen(true), OPEN_MS);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType !== 'mouse') return;
        if (pinned.current) window.clearTimeout(wait.current);
        else later(closeNow, CLOSE_MS);
      }}
      onBlur={(e) => {
        const to = e.relatedTarget as Node | null;
        if (pinned.current && to && !root.current?.contains(to)) closeNow();
      }}
      onKeyDown={onArrow}
    >
      <button
        ref={button}
        type="button"
        className="pc-dashes"
        aria-label="On this page"
        aria-expanded={open}
        aria-controls={cardId}
        onClick={onDashes}
        onPointerMove={(e) => {
          if (e.pointerType === 'mouse') setPointed(dashAt(e.clientY));
        }}
        onPointerLeave={() => setPointed(null)}
      >
        <span ref={stack} className="pc-stack" aria-hidden="true">
          {rows.map((r, i) => (
            <span key={r.key} className="pc-slot" data-depth={r.depth} data-now={i === current ? '' : undefined} data-pointed={i === pointed ? '' : undefined}>
              <span className="pc-dash" />
            </span>
          ))}
        </span>
      </button>
      <nav
        ref={card}
        id={cardId}
        aria-label="On this page"
        className="pc-card rounded-tile border border-line bg-card-strong text-footnote shadow-toy-soft"
        data-open={open ? '' : undefined}
        onPointerEnter={(e) => {
          if (e.pointerType === 'mouse') overCard.current = true;
        }}
        onPointerLeave={() => {
          overCard.current = false;
        }}
      >
        {built.current && (
          <ul ref={list} className="m-0 list-none p-0">
            {rows.map((r, i) => (
              <li key={r.key}>
                <button type="button" className="pc-row" data-depth={r.depth} data-pointed={i === pointed ? '' : undefined} aria-current={i === current ? 'location' : undefined} onClick={(e) => onRow(e, i)}>
                  <span className="min-w-0 truncate">{r.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </nav>
    </div>
  );
  return slot ? createPortal(ui, slot) : ui;
}
