import { useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { MoreHorizontal } from 'lucide-react';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { Sheet } from './Sheet';

export interface MoreMenuItem {
  key: string;
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  /** Red, for a destructive action (block, remove, delete). */
  destructive?: boolean;
  disabled?: boolean;
  /** A few quiet words after the label, such as "2 new" or "On". */
  hint?: string;
  /** Asks twice: the first tap shows these words and keeps the menu open, the second does it. */
  confirm?: string;
}

/**
 * The rest of a row's actions, tucked behind one "More" button instead of sitting beside the one or two that matter as
 * equal pills (HIG: a row of several equal buttons has no hierarchy). Opens as a `Sheet`, the kit's own dialog surface,
 * so every action is a plain full-width row with room for its label, not a cramped icon-only strip, and gets the same
 * focus trap, Escape-to-close and phone/laptop behaviour as every other sheet in the app.
 *
 * Optional, for the paper editor: `open` and `onOpenChange` make it controlled (a long press opens it), `trigger` replaces the
 * round button (or `null` draws none), and `title` names the sheet.
 */
export function MoreMenu({
  items,
  label = 'More actions',
  open: openProp,
  onOpenChange,
  trigger,
  title = 'More',
  children,
}: {
  items: MoreMenuItem[];
  label?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ((open: () => void) => ReactNode) | null;
  title?: string;
  /** Anything drawn above the list in the same sheet. */
  children?: ReactNode;
}) {
  const [own, setOwn] = useState(false);
  const [armed, setArmed] = useState<string | null>(null);
  const open = openProp ?? own;
  const setOpen = (v: boolean) => {
    if (!v) setArmed(null);
    if (onOpenChange) onOpenChange(v);
    else setOwn(v);
  };
  if (items.length === 0) return null;
  // One action needs no menu: one tap on a round icon button instead (wave 15). A menu with its own trigger, or one that asks
  // twice, stays a menu.
  const only = items.length === 1 ? items[0] : undefined;
  if (only && trigger === undefined && !only.confirm) {
    return <IconButton icon={only.icon ?? MoreHorizontal} label={only.label} onClick={only.onSelect} disabled={only.disabled} opens />;
  }
  return (
    <>
      {trigger === undefined ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={label}
          aria-haspopup="dialog"
          className="toy toy-soft flex min-h-[44px] min-w-[44px] items-center justify-center rounded-pill text-ink-soft hover:text-ink"
        >
          <Icon icon={MoreHorizontal} size={20} />
        </button>
      ) : trigger === null ? null : (
        trigger(() => setOpen(true))
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title={title}>
        {children}
        <ul className="flex list-none flex-col gap-xs p-0 m-0">
          {items.map((it) => (
            <li key={it.key}>
              <button
                type="button"
                disabled={it.disabled}
                onClick={() => {
                  if (it.confirm && armed !== it.key) {
                    setArmed(it.key);
                    return;
                  }
                  setOpen(false);
                  it.onSelect();
                }}
                className={`toy toy-soft flex min-h-[48px] w-full items-center gap-sm rounded-tile px-sm text-left text-[16px] font-bold disabled:opacity-50 ${it.destructive ? 'text-r1' : 'text-ink'}`}
              >
                {it.icon && <Icon icon={it.icon} size={20} />}
                <span className="min-w-0 flex-1">{it.confirm && armed === it.key ? it.confirm : it.label}</span>
                {it.hint && <span className="shrink-0 text-[14px] font-semibold text-ink-mute">{it.hint}</span>}
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}
