import { useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { Icon } from './Icon';

/**
 * A small fold-out in the app's own style: the title is a rounded flat button with a chevron, tinted while open, and what it holds sits
 * under it. Use it instead of a bare `<details>`, which has no corners, no chevron and a hover of its own.
 */
export function Fold({ title, hint, defaultOpen = false, open: openProp, onOpenChange, children, className = '' }: { title: ReactNode; hint?: ReactNode; defaultOpen?: boolean; /** Pass `open` and `onOpenChange` when the screen needs to open it itself. */ open?: boolean; onOpenChange?: (open: boolean) => void; children: ReactNode; className?: string }) {
  const [own, setOwn] = useState(defaultOpen);
  const open = openProp ?? own;
  const setOpen = (f: (o: boolean) => boolean) => {
    const next = f(open);
    setOwn(next);
    onOpenChange?.(next);
  };
  const id = useId();
  return (
    <div className={className}>
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)} className="toy toy-flat flex min-h-[44px] w-full items-center justify-between gap-sm rounded-tile bg-paper px-sm text-left aria-expanded:bg-line">
        <span className="min-w-0">
          <span className="text-[16px] font-bold">{title}</span>
          {hint !== undefined && hint !== '' && <span className="ml-xs whitespace-nowrap text-[16px] font-semibold text-ink-soft">{hint}</span>}
        </span>
        <Icon icon={ChevronDown} size={16} className={`text-ink-soft transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div id={id} className="mt-xs">
          {children}
        </div>
      )}
    </div>
  );
}
