import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { MoreHorizontal } from 'lucide-react';
import { Icon } from './Icon';
import { Sheet } from './Sheet';

export interface MoreMenuItem {
  key: string;
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  /** Red, for a destructive action (block, remove, delete). */
  destructive?: boolean;
  disabled?: boolean;
}

/**
 * The rest of a row's actions, tucked behind one "More" button instead of sitting beside the one or two that matter as
 * equal pills (HIG: a row of several equal buttons has no hierarchy). Opens as a `Sheet`, the kit's own dialog surface,
 * so every action is a plain full-width row with room for its label, not a cramped icon-only strip, and gets the same
 * focus trap, Escape-to-close and phone/laptop behaviour as every other sheet in the app.
 */
export function MoreMenu({ items, label = 'More actions' }: { items: MoreMenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label}
        aria-haspopup="dialog"
        className="toy toy-soft flex min-h-[44px] min-w-[44px] items-center justify-center rounded-pill text-ink-soft hover:text-ink"
      >
        <Icon icon={MoreHorizontal} size={20} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="More">
        <ul className="flex list-none flex-col gap-xs p-0 m-0">
          {items.map((it) => (
            <li key={it.key}>
              <button
                type="button"
                disabled={it.disabled}
                onClick={() => {
                  setOpen(false);
                  it.onSelect();
                }}
                className={`toy toy-soft flex min-h-[48px] w-full items-center gap-sm rounded-tile px-sm text-left text-[16px] font-bold disabled:opacity-50 ${it.destructive ? 'text-r1' : 'text-ink'}`}
              >
                {it.icon && <Icon icon={it.icon} size={20} />}
                {it.label}
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}
