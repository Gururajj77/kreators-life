import { useId, useState, type ReactNode } from 'react';
import { AnimatedIcon } from './AnimatedIcon';
import { ToggleChevron } from './ToggleMark';

/**
 * A small fold-out in the app's own style: the title is a rounded flat button with a chevron, tinted while open, and what it holds sits
 * under it. Use it instead of a bare `<details>`, which has no corners, no chevron and a hover of its own.
 * `adds`: the fold opens a form that adds something ("Add a task", "Add your own"), so its mark is a plus that turns into a cross
 * while open (the useanimations plusToX) instead of a chevron.
 * `tone="plain"`: no fill until hovered or open, for a fold inside navigation (the laptop sidebar's app groups).
 */
export function Fold({
  title,
  hint,
  defaultOpen = false,
  open: openProp,
  onOpenChange,
  adds = false,
  tone = 'paper',
  children,
  className = '',
}: {
  title: ReactNode;
  hint?: ReactNode;
  defaultOpen?: boolean;
  /** Pass `open` and `onOpenChange` when the screen needs to open it itself. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  adds?: boolean;
  tone?: 'paper' | 'plain';
  children: ReactNode;
  className?: string;
}) {
  const [own, setOwn] = useState(defaultOpen);
  const open = openProp ?? own;
  const setOpen = (f: (o: boolean) => boolean) => {
    const next = f(open);
    setOwn(next);
    onOpenChange?.(next);
  };
  const id = useId();
  // A title on two lines keeps the same inner margin a one-line row has inside its 44px (py-xs leaves a one-line row as it was).
  const fill = tone === 'plain' ? 'px-xs hover:bg-line' : 'px-sm py-xs bg-paper aria-expanded:bg-line';
  return (
    <div className={className}>
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)} className={`toy toy-flat flex min-h-[44px] w-full items-center justify-between gap-sm rounded-tile text-left ${fill}`}>
        <span className="min-w-0">
          <span className="text-headline">{title}</span>
          {hint !== undefined && hint !== '' && <span className="ml-xs whitespace-nowrap text-callout text-ink-soft">{hint}</span>}
        </span>
        {adds ? (
          <AnimatedIcon name="plusToX" size={16} active={open} className="text-ink-soft" />
        ) : (
          <ToggleChevron open={open} size={tone === 'plain' ? 14 : 16} className="text-ink-soft" />
        )}
      </button>
      {open && (
        <div id={id} className="mt-xs">
          {children}
        </div>
      )}
    </div>
  );
}
