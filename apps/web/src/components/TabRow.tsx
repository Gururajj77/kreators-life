import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { Icon } from './Icon';
import { Sheet } from './Sheet';

export interface TabRowItem<K extends string> {
  key: K;
  label: ReactNode;
  /** The plain words, for the More list and screen readers when the label is not plain text. */
  name?: string;
}

/**
 * A row of tabs that never wraps into a wall of pills: it shows as many as fit, in the order given (most important first), and puts the
 * rest behind one "More" button that opens a list. The tab that is showing is always visible: if it would fall into the list, it takes
 * the last visible place instead. Same pill look as the rows it replaces (picked solid, the rest glass), so nothing changes at rest.
 */
export function TabRow<K extends string>({ items, value, onChange, label, className = '', pillClass }: { items: readonly TabRowItem<K>[]; value: K; onChange: (k: K) => void; label: string; className?: string; /** The row's own pill look, so a screen keeps exactly the pills it had; only the overflow changes. */ pillClass?: (on: boolean) => string }) {
  const row = useRef<HTMLDivElement>(null);
  const measure = useRef<HTMLDivElement>(null);
  const [fits, setFits] = useState(items.length);
  const [open, setOpen] = useState(false);

  useLayoutEffect(() => {
    const box = row.current;
    const ruler = measure.current;
    if (!box || !ruler) return;
    const work = () => {
      const width = box.clientWidth;
      const pills = [...ruler.querySelectorAll<HTMLElement>('[data-pill]')].map((p) => p.offsetWidth);
      const more = ruler.querySelector<HTMLElement>('[data-more]')?.offsetWidth ?? 96;
      const gap = 8;
      const all = pills.reduce((t, w) => t + w, 0) + gap * Math.max(0, pills.length - 1);
      if (all <= width) {
        setFits(items.length);
        return;
      }
      let used = more;
      let n = 0;
      for (const w of pills) {
        if (used + gap + w > width) break;
        used += gap + w;
        n += 1;
      }
      setFits(Math.max(1, n));
    };
    work();
    const ro = new ResizeObserver(work);
    ro.observe(box);
    return () => ro.disconnect();
  }, [items]);

  const shown = items.slice(0, fits);
  const picked = items.findIndex((i) => i.key === value);
  // The showing tab is never hidden: it takes the last visible place.
  if (picked >= fits && fits > 0) shown[fits - 1] = items[picked]!;
  const hidden = items.filter((i) => !shown.includes(i));
  const pill = (on: boolean) => `shrink-0 whitespace-nowrap ${pillClass ? pillClass(on) : `toy min-h-[44px] rounded-pill border-2 px-sm py-xs text-[14px] font-bold ${on ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}`;

  return (
    <div className={`relative ${className}`}>
      <div ref={row} role="group" aria-label={label} className="flex min-w-0 items-center gap-xs">
        {shown.map((i) => (
          <button key={i.key} type="button" aria-pressed={i.key === value} onClick={() => onChange(i.key)} className={pill(i.key === value)}>
            {i.label}
          </button>
        ))}
        {hidden.length > 0 && (
          <button type="button" aria-haspopup="dialog" onClick={() => setOpen(true)} className={`${pill(false)} inline-flex items-center gap-xs`}>
            More
            <Icon icon={ChevronDown} size={16} />
          </button>
        )}
      </div>
      {/* An invisible copy of every pill, to know how wide each one is, inside a box of no size so it never widens the page. */}
      <div aria-hidden="true" className="pointer-events-none invisible absolute top-0 left-0 h-0 w-0 overflow-hidden">
        <div ref={measure} className="flex gap-xs" style={{ width: 'max-content' }}>
          {items.map((i) => (
            <span key={i.key} data-pill className={pill(false)}>
              {i.label}
            </span>
          ))}
          <span data-more className={`${pill(false)} inline-flex items-center gap-xs`}>
            More
            <Icon icon={ChevronDown} size={16} />
          </span>
        </div>
      </div>
      <Sheet open={open} onClose={() => setOpen(false)} title={label}>
        <ul className="m-0 flex list-none flex-col gap-xs p-0">
          {hidden.map((i) => (
            <li key={i.key}>
              <button
                type="button"
                aria-pressed={i.key === value}
                onClick={() => {
                  onChange(i.key);
                  setOpen(false);
                }}
                className="toy toy-flat flex min-h-[48px] w-full items-center rounded-tile bg-paper px-sm text-left text-[16px] font-bold aria-pressed:bg-ink aria-pressed:text-on-ink"
              >
                {i.name ?? i.label}
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </div>
  );
}
