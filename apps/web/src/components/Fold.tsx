import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatedIcon } from './AnimatedIcon';
import { ToggleChevron } from './ToggleMark';

/**
 * A small fold-out in the app's own style: the title is a rounded flat button with a chevron, tinted while open, and what it holds sits
 * under it. Use it instead of a bare `<details>`, which has no corners, no chevron and a hover of its own.
 * `adds`: the fold opens a form that adds something ("Add a task", "Add your own"), so its mark is a plus that turns into a cross
 * while open (the useanimations plusToX) instead of a chevron.
 * `tone="plain"`: no fill until hovered or open, for a fold inside navigation (the laptop sidebar's app groups).
 * When it folds while focus was inside it (a Cancel, a cross, Escape or a save in the form it holds), the folded content takes the
 * focused element with it, so focus goes back to the fold's own button instead of falling to the page (2026-11-06).
 */
export function Fold({
  id: landId,
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
  /** An id a link's hash can name (`/today#supplements`): the link lands here and opens the fold (lib/useLandOnHash.ts). */
  id?: string;
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
    // Its own state is what it shows while nobody holds it, so a tap while a screen holds it (Select on Apps) leaves that as it was.
    if (openProp === undefined) setOwn(next);
    onOpenChange?.(next);
  };
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const focusInside = useRef(false);
  const wasOpen = useRef(open);
  useLayoutEffect(() => {
    const closed = wasOpen.current && !open;
    wasOpen.current = open;
    if (!closed || !focusInside.current) return;
    const now = document.activeElement;
    if (!now || now === document.body) button.current?.focus();
  }, [open]);
  // A title on two lines keeps the same inner margin a one-line row has inside its 44px (py-xs leaves a one-line row as it was).
  const fill = tone === 'plain' ? 'px-xs hover:bg-line' : 'px-sm py-xs bg-paper aria-expanded:bg-line';
  return (
    <div
      id={landId}
      className={className}
      onFocus={() => {
        focusInside.current = true;
      }}
      onBlur={(e) => {
        // Focus that moved to another element outside is gone; a blur with no new element (a focused field being removed, where a
        // browser fires one) keeps the mark, so the fold can still hand focus back.
        const to = e.relatedTarget as Node | null;
        if (to && !e.currentTarget.contains(to)) focusInside.current = false;
      }}
    >
      <button ref={button} type="button" aria-expanded={open} aria-controls={id} data-land-open={landId ? '' : undefined} onClick={() => setOpen((o) => !o)} className={`toy toy-flat flex min-h-[44px] w-full items-center justify-between gap-sm rounded-tile text-left ${fill}`}>
        {/* The title takes the row's width (flex-1), so its box never shrinks to its words and the rectangle fixer can even a two-line title. */}
        <span className="min-w-0 flex-1">
          <span className="text-headline">{title}</span>
          {hint !== undefined && hint !== '' && <span className="ml-xs inline-block max-w-[calc(100%-var(--spacing-xs))] text-callout text-ink-soft">{hint}</span>}
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
