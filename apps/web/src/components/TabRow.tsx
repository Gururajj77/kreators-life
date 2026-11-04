import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
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
 * A row of tabs that never wraps into a wall of pills and never scrolls sideways or cuts its last pill: it shows the first few, in the
 * order given (most important first), at most `MAX_WIDE` from the tablet width up and `MAX_NARROW` on a phone, and fewer when they do not
 * fit, with one "All" button at the right end that opens a list of every tab (the showing one marked). The tab that is showing is always
 * visible: if it would fall past the shown ones, it takes the last visible place instead. Same pill look as the rows it replaces (picked
 * solid, the rest glass), so nothing changes at rest.
 *
 * Two more uses, for rows that jump rather than pick: without a `value` nothing is marked picked (no aria-pressed), and with `href` every
 * pill is a link (an in-page `#anchor`); a link chosen from the All list closes the list and then scrolls to its section.
 */
const MAX_WIDE = 5;
const MAX_NARROW = 3;
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
}) {
  const row = useRef<HTMLDivElement>(null);
  const measure = useRef<HTMLDivElement>(null);
  const leadRef = useRef<HTMLSpanElement>(null);
  // Which tabs show: 'all', or their indexes ("0,3"), with "|s" when the one that shows must wrap inside its pill.
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
      const cap = window.matchMedia('(min-width: 768px)').matches ? MAX_WIDE : MAX_NARROW;
      const pills = [...ruler.querySelectorAll<HTMLElement>('[data-pill]')].map((p) => p.offsetWidth);
      const more = ruler.querySelector<HTMLElement>('[data-more]')?.offsetWidth ?? 96;
      const gap = 8;
      const all = pills.reduce((t, w) => t + w, 0) + gap * Math.max(0, pills.length - 1);
      if (all <= width && pills.length <= cap) {
        setFits('all');
        return;
      }
      // The showing tab's own width is kept first, so a long one picked from the list never pushes the row past its edge.
      const picked = value === undefined ? -1 : items.findIndex((i) => i.key === value);
      const keep: number[] = picked >= 0 ? [picked] : [];
      let used = more + (picked >= 0 ? gap + pills[picked]! : 0);
      for (let i = 0; i < pills.length && keep.length < cap; i += 1) {
        if (i === picked) continue;
        if (used + gap + pills[i]! > width) break;
        used += gap + pills[i]!;
        keep.push(i);
      }
      if (!keep.length) keep.push(0);
      keep.sort((a, b) => a - b);
      // Even alone beside All it is too wide (a long name on a narrow phone): it then wraps inside its pill instead of being cut.
      const squeeze = keep.length === 1 && more + gap + pills[keep[0]!]! > width;
      setFits(`${keep.join(',')}${squeeze ? '|s' : ''}`);
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
  }, [items, value]);

  // The showing tab is never hidden: the measure keeps its place first, then fills the rest in order.
  const [keys, squeezed] = fits.split('|');
  const shown = keys === 'all' ? [...items] : keys!.split(',').map((n) => items[Number(n)]).filter((i): i is TabRowItem<K> => !!i);
  if (value !== undefined && !shown.some((i) => i.key === value)) {
    const p = items.find((i) => i.key === value);
    if (p) shown.splice(Math.max(0, shown.length - 1), 1, p);
  }
  const squeeze = squeezed === 's' && shown.length === 1;
  const hidden = items.filter((i) => !shown.includes(i));
  const pressed = (k: K) => (value === undefined ? undefined : k === value);
  // When some tabs are behind All, the shown ones share the free width, so the row reaches All with no gap.
  const fill = hidden.length > 0 ? 'flex-1 justify-center text-center' : '';
  const pill = (on: boolean, disabled = false, wrap = false) =>
    `${wrap ? 'min-w-[44px] whitespace-normal text-balance' : 'shrink-0 whitespace-nowrap'} ${pillClass ? pillClass(on, disabled) : `toy min-h-[44px] rounded-pill border-2 px-sm py-xs text-[14px] font-bold ${on ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}`;

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
        el.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      }),
    );
  };

  const one = (i: TabRowItem<K>) => {
    if (i.disabled)
      return (
        <span key={i.key} data-pillar={i.pillar} title={i.title} className={`${pill(false, true, squeeze)} ${fill}`}>
          {i.label}
        </span>
      );
    if (href)
      return (
        <a key={i.key} data-pillar={i.pillar} href={href(i.key)} aria-current={value !== undefined && i.key === value ? 'true' : undefined} onClick={() => onChange?.(i.key)} className={`${pill(i.key === value, false, squeeze)} ${fill}`}>
          {i.label}
        </a>
      );
    return (
      <button key={i.key} data-pillar={i.pillar} type="button" aria-pressed={pressed(i.key)} onClick={() => onChange?.(i.key)} className={`${pill(i.key === value, false, squeeze)} ${fill}`}>
        {i.label}
      </button>
    );
  };

  return (
    <div className={`relative min-w-0 ${className}`}>
      <div ref={row} role="group" aria-label={label} className={`flex min-w-0 items-center gap-xs ${align === 'end' ? 'justify-end' : ''}`}>
        {lead && (
          <span ref={leadRef} className="shrink-0 text-[14px] font-bold text-ink-soft">
            {lead}
          </span>
        )}
        {shown.map(one)}
        {hidden.length > 0 && (
          <button type="button" aria-haspopup="dialog" aria-label={`All ${items.length}: ${label}`} onClick={() => setOpen(true)} className={`${pill(false)} inline-flex items-center gap-xs px-md!`}>
            <Icon icon={LayoutGrid} size={16} />
            All
          </button>
        )}
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
                <span title={i.title} className="flex min-h-[48px] w-full items-center rounded-tile bg-line px-sm text-left text-[16px] font-bold text-ink-soft line-through">
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
                  className="toy toy-flat flex min-h-[48px] w-full items-center rounded-tile bg-paper px-sm text-left text-[16px] font-bold aria-[current=true]:bg-ink aria-[current=true]:text-on-ink"
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
                  className="toy toy-flat flex min-h-[48px] w-full items-center rounded-tile bg-paper px-sm text-left text-[16px] font-bold aria-pressed:bg-ink aria-pressed:text-on-ink"
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
