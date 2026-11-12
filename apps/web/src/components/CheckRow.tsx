import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import gsap from 'gsap';
import { Check, Clock, Pencil } from 'lucide-react';
import { Icon } from './Icon';
import { ToggleIcon } from './ToggleMark';

/** What tapping a row's words opens, for a row that has something to open (a task's plan or its edit sheet). */
export interface CheckRowOpen {
  onOpen: () => void;
  /** The open control's words before the title: "Plan", "Close the plan for", "Edit". Its name is `${label} ${title}`. */
  label: string;
  /** Set only when it opens a panel in place under the row: the control then carries `aria-expanded` (and `aria-controls`), and the
   *  small edit button's pencil turns into a cross while open. Leave it off when it opens a Sheet, which has its own close. */
  expanded?: boolean;
  /** The id of the panel it opens in place, for `aria-controls`. */
  controls?: string;
  /** Draw the small edit button at the card's top right (default true). */
  edit?: boolean;
}

interface Props {
  checked: boolean;
  /** Called when the box is ticked or unticked. Not called while locked or busy. */
  onToggle: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Box color when ticked, the hard shadow under it, and the tick's color. */
  color?: string;
  deep?: string;
  text?: string;
  /** The empty box's edge, when `color` is too light to hold 3:1 on glass (orange and yellow take their deep colour). Defaults to `color`. */
  edge?: string;
  busy?: boolean;
  /** When set, tapping the box shows this instead of toggling, for example a wait or a once-a-day rule. */
  lockedMessage?: string | null;
  /** A small pill after the subtitle, like a due date or a countdown. */
  badge?: ReactNode;
  /** Strike the title through when ticked. Right for tasks, wrong for "I checked in". */
  strike?: boolean;
  /** Error or note from the last tap, shown right under the row. */
  hint?: string | null;
  /** Something next to the row that is not part of the card, like a More button or a play link. */
  aside?: ReactNode;
  /** A tag for the row's top right corner on a phone (a task's priority). From the tablet width up it sits at the row's right, after `foot`. */
  corner?: ReactNode;
  /** A tag for the row's bottom right corner on a phone (a task's pillar). From the tablet width up it sits at the row's right, before `corner`. */
  foot?: ReactNode;
  /** The row's other marks (a task's Remember, Habit, For review, time, due): at the row's right with `corner` and `foot` on a laptop; on a phone across the row's foot, each line filled, so the title keeps its width. */
  marks?: ReactNode;
  /** Tapping the words opens this instead of ticking (a task's plan or edit sheet); the box alone ticks. Without it the words tick too. */
  open?: CheckRowOpen;
  large?: boolean;
}

/**
 * The tick box itself, the one look. It only draws: the real checkbox and the row around it are the caller's (CheckRow's box, or the
 * Apps page's Select mode). `edge` is the empty box's border when it differs from `color`.
 * When the box goes from empty to ticked, the tick draws itself in (its stroke runs from start to end); never on the first paint, and
 * under reduced motion it is only set.
 */
export function CheckMark({ checked, color, deep, text, edge, locked = false, busy = false, large = false }: { checked: boolean; color: string; deep: string; text: string; edge?: string; locked?: boolean; busy?: boolean; large?: boolean }) {
  const box = useRef<HTMLSpanElement>(null);
  const was = useRef(checked);
  useEffect(() => {
    const before = was.current;
    was.current = checked;
    if (!checked || before) return;
    const path = box.current?.querySelector('path');
    if (!path) return;
    const len = path.getTotalLength();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(path, { strokeDasharray: 'none', strokeDashoffset: 0 });
      return;
    }
    const tween = gsap.fromTo(path, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 0.3, ease: 'power2.out', onComplete: () => void gsap.set(path, { strokeDasharray: 'none' }) });
    return () => {
      tween.kill();
    };
  }, [checked]);
  return (
    <span
      ref={box}
      aria-hidden="true"
      className={`check-box flex shrink-0 items-center justify-center rounded-[10px] border-[3px] ${large ? 'size-[40px]' : 'size-[32px]'} ${busy ? 'animate-pulse' : ''}`}
      style={{
        borderColor: locked && !checked ? 'var(--color-ink-mute)' : checked ? color : (edge ?? color),
        background: checked ? color : 'var(--color-card)',
        boxShadow: `0 3px 0 0 ${locked && !checked ? 'var(--color-line)' : deep}`,
      }}
    >
      {checked ? (
        <Icon icon={Check} size={22} strokeWidth={3} color={text} />
      ) : locked ? (
        <Icon icon={Clock} size={18} color="var(--color-ink-soft)" />
      ) : (
        <Icon icon={Check} size={22} strokeWidth={3} color={color} className="check-preview" />
      )}
    </span>
  );
}

/**
 * The one way to record an action anywhere in the app: a checkbox beside a card (2026-11-12, the founder: "why is the checkbox not
 * seperate and out of the clickable task card itself?"). The row is three things side by side, none inside another: the box at the left,
 * the real checkbox named "Tick <title>" with its own focus ring and hover preview, outside the card; then the card (the toy, holding the
 * words and tags), which is one stretched control laid over its words: with `open` a button that opens the row's plan or edit sheet, with
 * a small edit button at the card's top right for a mouse or a finger (the stretched button is the keyboard's stop, so the small one is
 * hidden from the keyboard and screen readers); without it a label for the same checkbox, so the words still tick; then any `aside`.
 * The keyboard meets the box, then the card, then the aside. The corner, foot and marks keep their places inside the card.
 */
export function CheckRow({
  checked,
  onToggle,
  title,
  subtitle,
  color = 'var(--color-ink)',
  deep = 'var(--color-shadow)',
  text = 'var(--color-on-ink)',
  edge,
  busy = false,
  lockedMessage = null,
  badge,
  strike = false,
  hint = null,
  aside,
  large = false,
  corner,
  foot,
  marks,
  open,
}: Props) {
  const id = useId();
  const openRef = useRef<HTMLButtonElement>(null);
  // After a tap on a locked box, show the live reason. It updates as a wait
  // counts down and disappears on its own once the row unlocks.
  const [asked, setAsked] = useState(false);
  const locked = Boolean(lockedMessage);
  const note = hint ?? (asked && locked ? lockedMessage : null);
  const noteId = note ? `${id}-note` : undefined;
  const described = [subtitle ? `${id}-sub` : null, noteId].filter(Boolean).join(' ') || undefined;

  const handle = () => {
    if (busy) return;
    if (locked) {
      setAsked(true);
      return;
    }
    setAsked(false);
    onToggle();
  };

  const edit =
    open && open.edit !== false ? (
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        data-row-edit=""
        // Never takes focus itself: the stretched control does (so a Sheet hands focus back there, and the keyboard's place is the row).
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          openRef.current?.focus({ preventScroll: true });
          open.onOpen();
        }}
        className="toy toy-flat tap-pad relative z-[1] -my-[4px] flex size-[32px] shrink-0 cursor-pointer items-center justify-center rounded-pill text-ink-soft hover:text-ink"
      >
        {open.expanded === undefined ? <Icon icon={Pencil} size={16} strokeWidth={2.6} /> : <ToggleIcon open={open.expanded} icon={Pencil} size={16} strokeWidth={2.6} />}
      </button>
    ) : null;
  const top = edit ? (
    <span className="flex items-center gap-xs">
      {corner}
      {edit}
    </span>
  ) : (
    (corner ?? <span aria-hidden="true" />)
  );

  return (
    <div>
      {/* The row is three things side by side, none inside another (2026-11-12, the founder): the box, the card, then any aside. */}
      <div data-opens={open ? '' : undefined} className="check-line flex items-stretch gap-xs">
        {/* The box: its own control outside the card, at its left, 44 by 44 to tap. Its column is the card's least height, so the box sits
            on a one-line card's middle and level with the first line of a taller one; on the small box the hit area's spare room lies
            toward the card and the column gives back the gap, so the box stands 12px off the card and its hit area never reaches it. */}
        <div className={`flex shrink-0 items-center self-start ${large ? 'h-[64px]' : 'h-[56px] -mr-xs'}`}>
          <label className="check-hit relative flex size-[44px] shrink-0 cursor-pointer items-center justify-start">
            <input
              id={`${id}-box`}
              type="checkbox"
              className="sr-only"
              checked={checked}
              onChange={handle}
              aria-labelledby={`${id}-tick ${id}-title`}
              aria-describedby={described}
              aria-busy={busy || undefined}
            />
            <CheckMark checked={checked} color={color} deep={deep} text={text} edge={edge} locked={locked} busy={busy} large={large} />
          </label>
        </div>
        <span id={`${id}-tick`} hidden>
          Tick
        </span>
        <div
          className={`check-row toy toy-soft relative flex min-w-0 flex-1 cursor-pointer select-none flex-wrap items-center gap-sm md:flex-nowrap rounded-tile bg-card p-sm has-[[data-row-open]:focus-visible]:outline-[3px] has-[[data-row-open]:focus-visible]:outline-offset-2 has-[[data-row-open]:focus-visible]:outline-ink ${large ? 'min-h-[64px]' : 'min-h-[56px]'}`}
        >
          {open ? (
            <>
              <span id={`${id}-open`} hidden>
                {open.label}
              </span>
              <button
                ref={openRef}
                type="button"
                data-row-open=""
                onClick={open.onOpen}
                aria-labelledby={`${id}-open ${id}-title`}
                aria-describedby={noteId}
                aria-expanded={open.expanded}
                aria-controls={open.expanded ? open.controls : undefined}
                aria-haspopup={open.expanded === undefined ? 'dialog' : undefined}
                className="absolute inset-0 cursor-pointer rounded-tile focus-visible:outline-none"
              />
            </>
          ) : (
            // The words tick too: a second label for the same box, laid over the card, adding no stop for the keyboard.
            <label htmlFor={`${id}-box`} aria-hidden="true" className="absolute inset-0 cursor-pointer rounded-tile" />
          )}
          <span className="min-w-0 flex-1">
            <span id={`${id}-title`} className={`block ${subtitle ? 'text-row-title' : 'text-body'} ${checked && strike ? 'text-ink-mute line-through' : ''}`}>
              {title}
            </span>
            {(subtitle || badge) && (
              // The badge sits beside the note, or under it with xs between when the line is full (it touched the note's descenders).
              <span className="flex flex-wrap items-center gap-xs">
                {subtitle && (
                  <span id={`${id}-sub`} className="text-card-note text-ink-soft">
                    {subtitle}
                  </span>
                )}
                {badge}
              </span>
            )}
          </span>
          {(corner || foot || marks || edit) && (
            // Every tag sits at the right (2026-11-05). A phone: the corner tag (and the small edit button after it, the card's top right)
            // at the top right and the foot tag under it or at the bottom right, the other marks across the row's foot (below). A laptop:
            // one row at the right, the marks first, then the foot, then the corner and the edit button at the far right; a long set wraps,
            // right-aligned, and never takes more than half the row.
            <span className="flex shrink-0 flex-col items-end justify-between gap-xs self-stretch md:max-w-[50%] md:flex-row-reverse md:flex-wrap md:items-center md:justify-start md:self-center">
              {top}
              {/* When the marks wrap, each line fills (as on a phone), so a third mark never stands alone under two (a task's block, 2026-11-06). */}
              {marks && <span className="hidden md:order-3 md:flex md:flex-wrap md:justify-end md:gap-xs md:[&>*]:flex-auto md:[&>*]:justify-center">{marks}</span>}
              {foot ? <span className="md:order-2">{foot}</span> : <span aria-hidden="true" />}
            </span>
          )}
          {marks && (
            // A phone: the marks share the lines across the foot of the row, filling each line so none stands alone, while the title keeps
            // its width and the priority and pillar keep the right.
            <span className="fill-row order-last flex basis-full flex-wrap justify-end gap-xs md:hidden">{marks}</span>
          )}
        </div>
        {aside}
      </div>
      {note && (
        <p id={`${id}-note`} role="status" className="mt-xs m-0 rounded-tile bg-paper px-sm py-xs text-subhead">
          {note}
        </p>
      )}
    </div>
  );
}
