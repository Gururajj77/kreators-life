import { useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { LayoutGrid } from 'lucide-react';
import { Icon } from './Icon';
import { Sheet } from './Sheet';

export interface TabRowItem<K extends string> {
  key: K;
  label: ReactNode;
  /** The plain words, for the All list and screen readers when the label is not plain text. */
  name?: string;
  /** Shown but not pickable (a part someone does not share, say): drawn as a plain mark, with `title` saying why. */
  disabled?: boolean;
  title?: string;
  /** The pillar this pill belongs to, for rows whose pills wear their pillar's colour. */
  pillar?: string;
}

/**
 * A row of tabs that never wraps into a wall of pills and never cuts a pill at a plain edge.
 *
 * When every pill fits it is one plain row. When they do not (the founder, 2026-11-07: "on mobile the tags and filters can be right
 * scroll items, keep the all button stick on right"):
 * - on a phone, and in any row under 34rem of width (a tablet's column beside the sidebar), it is one line of every pill that scrolls
 *   sideways (touch, a mouse wheel, the arrow keys), with "All" pinned at the right end on its own surface and a soft fade before it
 *   while more lies past the edge; the picked pill is scrolled into view on load and on every change, and pills snap to the row's start
 *   so none rests half hidden.
 * - on a wider row it shows the first few, in the order given (most important first), at most `MAX_WIDE`, with "All" at the right end;
 *   the tab that is showing always keeps a place. If fewer than that fit, it scrolls like a phone's.
 * "All" opens a list of every tab (the showing one marked). Same pill look as the rows it replaces (picked solid, the rest glass).
 *
 * Two more uses, for rows that jump rather than pick: without a `value` nothing is marked picked (no aria-pressed), and with `href` every
 * pill is a link (an in-page `#anchor`); a link chosen from the All list closes the list and then scrolls to its section.
 */
const MAX_WIDE = 5;
/** A row narrower than this (34rem) scrolls sideways when its pills do not fit, as on a phone. */
const NARROW_ROW = 544;
/** The app's own `md` (width and height, see app.css), so a phone on its side is still a phone. */
const MD = '(min-width: 48rem) and (min-height: 30rem)';
/** The end fade (32px) less the strip's own padding (8px): what a pill resting at the start must leave free. */
const FADE_ROOM = 24;
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Where the pill nearest the row's start rests (each pill snaps to the start, past the strip's padding). */
function restingLeft(strip: HTMLElement, pill: HTMLElement) {
  return pill.offsetLeft - (parseFloat(getComputedStyle(strip).scrollPaddingLeft) || 0);
}

/** Scroll the strip so this pill shows whole, clear of the fade, by resting it at the start (a snap position, so it stays put). */
function bringIn(strip: HTMLElement, pill: HTMLElement, behavior: ScrollBehavior) {
  const left = restingLeft(strip, pill);
  const end = strip.scrollWidth - strip.clientWidth;
  const fade = parseFloat(getComputedStyle(strip).scrollPaddingRight) || 0;
  const inView = left >= strip.scrollLeft - 1 && (strip.scrollLeft >= end - 1 || pill.offsetLeft + pill.offsetWidth + fade <= strip.scrollLeft + strip.clientWidth + 1);
  if (!inView) strip.scrollTo({ left: Math.min(left, end), behavior });
}

export function TabRow<K extends string>({
  items,
  value,
  onChange,
  href,
  label,
  className = '',
  pillClass,
  align = 'start',
  lead,
  max,
  natural = false,
}: {
  items: readonly TabRowItem<K>[];
  value?: K;
  onChange?: (k: K) => void;
  /** Link mode: each pill is an anchor to this address. */
  href?: (k: K) => string;
  label: string;
  className?: string;
  /** The row's own pill look, so a screen keeps exactly the pills it had; only the overflow changes. */
  pillClass?: (on: boolean, disabled?: boolean) => string;
  /** Where the pills sit in the row: from the left (the default) or gathered at the right. */
  align?: 'start' | 'end';
  /** Words that open the row ("Sort by"): they travel with the pills, so with `align="end"` they sit right beside them. */
  lead?: ReactNode;
  /** At most this many pills before All, whatever the width (Inbox keeps three, the founder 2026-11-07). */
  max?: number;
  /** Pills keep their own width even when some are behind All, instead of sharing the free width; under 34rem of the nearest @container they fill their line again (Inbox, the founder 2026-11-07). */
  natural?: boolean;
}) {
  const row = useRef<HTMLDivElement>(null);
  const measure = useRef<HTMLDivElement>(null);
  const leadRef = useRef<HTMLSpanElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const settled = useRef(false);
  // Which tabs show: 'all'; 'scroll' (every pill on one sideways line), with "|1,4" for pills too wide even alone, which wrap inside;
  // or, on a wide row, their indexes ("0,3").
  const [fits, setFits] = useState('all');
  const [open, setOpen] = useState(false);

  useLayoutEffect(() => {
    const box = row.current;
    const ruler = measure.current;
    if (!box || !ruler) return;
    let live = true;
    const work = () => {
      if (!live) return;
      const width = box.clientWidth - (leadRef.current ? leadRef.current.offsetWidth + 8 : 0);
      const narrow = !window.matchMedia(MD).matches || box.clientWidth < NARROW_ROW;
      const cap = narrow ? Infinity : Math.min(max ?? Infinity, MAX_WIDE);
      const pills = [...ruler.querySelectorAll<HTMLElement>('[data-pill]')].map((p) => p.offsetWidth);
      const more = ruler.querySelector<HTMLElement>('[data-more]')?.offsetWidth ?? 96;
      const gap = 8;
      const all = pills.reduce((t, w) => t + w, 0) + gap * Math.max(0, pills.length - 1);
      if (all <= width && pills.length <= cap) {
        setFits('all');
        return;
      }
      const scroll = () => {
        // A pill wider than the line less its end fade could never show whole: it wraps inside itself instead (`data-wrap`, app.css).
        const room = width - more - gap - FADE_ROOM;
        const wide = pills.flatMap((w, i) => (w > room ? [i] : []));
        setFits(wide.length ? `scroll|${wide.join(',')}` : 'scroll');
      };
      if (narrow) return scroll();
      // A wide row: the showing tab's own width is kept first, so a long one picked from the list never pushes the row past its edge.
      const picked = value === undefined ? -1 : items.findIndex((i) => i.key === value);
      const keep: number[] = picked >= 0 ? [picked] : [];
      let used = more + (picked >= 0 ? gap + pills[picked]! : 0);
      for (let i = 0; i < pills.length && keep.length < cap; i += 1) {
        if (i === picked) continue;
        if (used + gap + pills[i]! > width) break;
        used += gap + pills[i]!;
        keep.push(i);
      }
      // Fewer than the usual few fit (long names, a narrow column): the row scrolls, like a phone's.
      if (keep.length < Math.min(cap, pills.length) || used > width) return scroll();
      keep.sort((a, b) => a - b);
      setFits(keep.join(','));
    };
    work();
    // The self-hosted fonts can arrive after the first measure and widen every pill.
    document.fonts?.ready.then(work).catch(() => {});
    const ro = new ResizeObserver(work);
    ro.observe(box);
    return () => {
      live = false;
      ro.disconnect();
    };
  }, [items, value, max]);

  const [keys, extra] = fits.split('|');
  const scrolling = keys === 'scroll';

  // The sideways line: the picked pill in view (at once on load, gliding on a change), the fades kept true, and a mouse wheel that
  // turns the row instead of the page while the row has somewhere to go.
  useLayoutEffect(() => {
    const el = strip.current;
    if (!el) {
      settled.current = false;
      return;
    }
    const edges = () => {
      el.toggleAttribute('data-more-start', el.scrollLeft > 1);
      el.toggleAttribute('data-more-end', el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    };
    const pick = value === undefined ? null : [...el.children].find((c): c is HTMLElement => c instanceof HTMLElement && c.dataset.key === value);
    if (pick) bringIn(el, pick, settled.current && !reduced() ? 'smooth' : 'auto');
    settled.current = true;
    edges();
    let idle = 0;
    const settle = () => {
      el.style.scrollSnapType = '';
      const pills = [...el.children].filter((c): c is HTMLElement => c instanceof HTMLElement);
      const near = pills.reduce<HTMLElement | null>((b, p) => (!b || Math.abs(restingLeft(el, p) - el.scrollLeft) < Math.abs(restingLeft(el, b) - el.scrollLeft) ? p : b), null);
      if (near && el.scrollLeft < el.scrollWidth - el.clientWidth - 1) el.scrollTo({ left: restingLeft(el, near), behavior: reduced() ? 'auto' : 'smooth' });
    };
    const wheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
      const d = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? el.clientWidth : 1);
      const end = el.scrollWidth - el.clientWidth;
      if (end <= 1 || (d < 0 && el.scrollLeft <= 0) || (d > 0 && el.scrollLeft >= end - 1)) return;
      e.preventDefault();
      el.style.scrollSnapType = 'none';
      el.scrollLeft += d;
      window.clearTimeout(idle);
      idle = window.setTimeout(settle, 160);
    };
    el.addEventListener('scroll', edges, { passive: true });
    el.addEventListener('wheel', wheel, { passive: false });
    const ro = new ResizeObserver(edges);
    ro.observe(el);
    return () => {
      window.clearTimeout(idle);
      el.removeEventListener('scroll', edges);
      el.removeEventListener('wheel', wheel);
      ro.disconnect();
    };
  }, [fits, value]);

  // The showing tab is never hidden: the measure keeps its place first, then fills the rest in order.
  const wraps = new Set(scrolling && extra ? extra.split(',').map(Number) : []);
  const shown = keys === 'all' || scrolling ? [...items] : keys!.split(',').map((n) => items[Number(n)]).filter((i): i is TabRowItem<K> => !!i);
  if (value !== undefined && !shown.some((i) => i.key === value)) {
    const p = items.find((i) => i.key === value);
    if (p) shown.splice(Math.max(0, shown.length - 1), 1, p);
  }
  const hidden = items.filter((i) => !shown.includes(i));
  const withAll = scrolling || hidden.length > 0;
  const pressed = (k: K) => (value === undefined ? undefined : k === value);
  // When some tabs are behind All on a wide row, the shown ones share the free width, so the row reaches All with no gap.
  // `natural` keeps them their own width, except in a row under 34rem of its container (a phone), where the line is theirs alone.
  // A sideways line keeps every pill its own width.
  const fill = scrolling || hidden.length === 0 ? '' : natural ? '@max-[34rem]:flex-1 @max-[34rem]:justify-center @max-[34rem]:text-center' : 'flex-1 justify-center text-center';
  const pill = (on: boolean, disabled = false, wrap = false) =>
    `${wrap ? 'min-w-[44px] shrink-0 whitespace-normal text-balance' : 'shrink-0 whitespace-nowrap'} ${pillClass ? pillClass(on, disabled) : `toy min-h-[36px] md:min-h-[44px] tap-pad rounded-pill border-2 px-sm ${wrap ? 'py-xs' : 'py-0 md:py-xs'} text-subhead font-medium ${on ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}`;

  /** A link picked from the All list: the list closes first (it holds the page still), then the section is brought into view. */
  const jump = (k: K) => {
    const to = href?.(k);
    setOpen(false);
    onChange?.(k);
    if (!to?.startsWith('#')) return;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const el = document.getElementById(decodeURIComponent(to.slice(1)));
        if (!el) return;
        el.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' });
      }),
    );
  };

  /** The arrow keys, Home and End move between the pills of the sideways line (Tab still reaches each one, as before). */
  const arrows = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key) || e.altKey || e.metaKey || e.ctrlKey) return;
    const list = [...e.currentTarget.querySelectorAll<HTMLElement>('button, a[href]')];
    const at = list.findIndex((el) => el === document.activeElement);
    if (at < 0) return;
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? list.length - 1 : at + (e.key === 'ArrowRight' ? 1 : -1);
    const to = list[Math.max(0, Math.min(list.length - 1, next))];
    if (!to) return;
    e.preventDefault();
    to.focus();
  };

  const one = (i: TabRowItem<K>) => {
    const wrap = scrolling ? wraps.has(items.indexOf(i)) : false;
    if (i.disabled)
      return (
        <span key={i.key} data-key={i.key} data-wrap={wrap || undefined} data-pillar={i.pillar} title={i.title} className={`${pill(false, true, wrap)} ${fill}`}>
          {i.label}
        </span>
      );
    if (href)
      return (
        <a key={i.key} data-key={i.key} data-wrap={wrap || undefined} data-pillar={i.pillar} href={href(i.key)} aria-current={value !== undefined && i.key === value ? 'true' : undefined} onClick={() => onChange?.(i.key)} className={`${pill(i.key === value, false, wrap)} ${fill}`}>
          {i.label}
        </a>
      );
    return (
      <button key={i.key} data-key={i.key} data-wrap={wrap || undefined} data-pillar={i.pillar} type="button" aria-pressed={pressed(i.key)} onClick={() => onChange?.(i.key)} className={`${pill(i.key === value, false, wrap)} ${fill}`}>
        {i.label}
      </button>
    );
  };

  const allButton = (
    <button type="button" data-pinned-all aria-haspopup="dialog" aria-label={`All ${items.length}: ${label}`} onClick={() => setOpen(true)} className={`${pill(false)} inline-flex items-center gap-xs px-md!`}>
      <Icon icon={LayoutGrid} size={16} />
      All
    </button>
  );

  return (
    <div className={`relative min-w-0 ${className}`}>
      <div ref={row} role="group" aria-label={label} className={`flex min-w-0 items-center gap-xs ${align === 'end' ? 'justify-end' : ''}`}>
        {lead && (
          <span ref={leadRef} className="shrink-0 text-subhead text-ink-soft">
            {lead}
          </span>
        )}
        {scrolling ? (
          <div
            ref={strip}
            data-pinned-scroll
            className="tab-scroll"
            onKeyDown={arrows}
            onFocus={(e) => {
              // Tab or an arrow key landed on a pill: show it whole (the browser's own focus scroll can leave it under the fade or the snap).
              const p = e.target.closest<HTMLElement>('[data-key]');
              if (p && p.parentElement === e.currentTarget) bringIn(e.currentTarget, p, reduced() ? 'auto' : 'smooth');
            }}
          >
            {shown.map(one)}
          </div>
        ) : (
          shown.map(one)
        )}
        {withAll && allButton}
      </div>
      {/* An invisible copy of every pill, to know how wide each one is, inside a box of no size so it never widens the page. */}
      <div aria-hidden="true" className="pointer-events-none invisible absolute top-0 left-0 h-0 w-0 overflow-hidden">
        <div ref={measure} className="flex gap-xs" style={{ width: 'max-content' }}>
          {items.map((i) => (
            <span key={i.key} data-pill className={pill(false, i.disabled)}>
              {i.label}
            </span>
          ))}
          <span data-more className={`${pill(false)} inline-flex items-center gap-xs px-md!`}>
            <Icon icon={LayoutGrid} size={16} />
            All
          </span>
        </div>
      </div>
      <Sheet open={open} onClose={() => setOpen(false)} title={label}>
        <ul className="m-0 flex list-none flex-col gap-xs p-0">
          {items.map((i) => (
            <li key={i.key}>
              {i.disabled ? (
                <span title={i.title} className="flex min-h-[48px] w-full items-center rounded-tile bg-line px-sm text-left text-body text-ink-soft line-through">
                  {i.name ?? i.label}
                </span>
              ) : href ? (
                <a
                  href={href(i.key)}
                  aria-current={value !== undefined && i.key === value ? 'true' : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    jump(i.key);
                  }}
                  className="toy toy-flat flex min-h-[48px] w-full items-center rounded-tile bg-paper px-sm text-left text-body aria-[current=true]:bg-ink aria-[current=true]:text-on-ink"
                >
                  {i.name ?? i.label}
                </a>
              ) : (
                <button
                  type="button"
                  aria-pressed={pressed(i.key)}
                  onClick={() => {
                    onChange?.(i.key);
                    setOpen(false);
                  }}
                  className="toy toy-flat flex min-h-[48px] w-full items-center rounded-tile bg-paper px-sm text-left text-body aria-pressed:bg-ink aria-pressed:text-on-ink"
                >
                  {i.name ?? i.label}
                </button>
              )}
            </li>
          ))}
        </ul>
      </Sheet>
    </div>
  );
}
