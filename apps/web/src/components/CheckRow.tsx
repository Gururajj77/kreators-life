import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import gsap from 'gsap';
import { Check, Clock } from 'lucide-react';
import { Icon } from './Icon';

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
  busy?: boolean;
  /** When set, tapping shows this instead of toggling, for example a wait or a once-a-day rule. */
  lockedMessage?: string | null;
  /** A small pill after the subtitle, like a due date or a countdown. */
  badge?: ReactNode;
  /** Strike the title through when ticked. Right for tasks, wrong for "I checked in". */
  strike?: boolean;
  /** Error or note from the last tap, shown right under the row. */
  hint?: string | null;
  /** Something next to the row that is not part of the tap target, like an edit button. */
  aside?: ReactNode;
  /** A tag for the row's top right corner on a phone (a task's priority). From the tablet width up it sits at the row's right, after `foot`. */
  corner?: ReactNode;
  /** A tag for the row's bottom right corner on a phone (a task's pillar). From the tablet width up it sits at the row's right, before `corner`. */
  foot?: ReactNode;
  /** The row's other marks (a task's Remember, Habit, For review, time, due): at the row's right with `corner` and `foot` on a laptop; on a phone across the row's foot, each line filled, so the title keeps its width. */
  marks?: ReactNode;
  large?: boolean;
}

/**
 * The tick box itself, the one look. It only draws: the real checkbox and the row around it are the caller's, which sets `--check-color`.
 * When the box goes from empty to ticked, the tick draws itself in (its stroke runs from start to end); never on the first paint, and
 * under reduced motion it is only set.
 */
export function CheckMark({ checked, color, deep, text, locked = false, busy = false, large = false }: { checked: boolean; color: string; deep: string; text: string; locked?: boolean; busy?: boolean; large?: boolean }) {
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
        borderColor: locked && !checked ? 'var(--color-ink-mute)' : color,
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
 * The one way to record an action anywhere in the app: a row with a checkbox.
 * The whole row is the tap target, and it is a real checkbox for screen readers.
 */
export function CheckRow({
  checked,
  onToggle,
  title,
  subtitle,
  color = 'var(--color-ink)',
  deep = 'var(--color-shadow)',
  text = 'var(--color-on-ink)',
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
}: Props) {
  const id = useId();
  // After a tap on a locked row, show the live reason. It updates as a wait
  // counts down and disappears on its own once the row unlocks.
  const [asked, setAsked] = useState(false);
  const locked = Boolean(lockedMessage);
  const note = hint ?? (asked && locked ? lockedMessage : null);

  const handle = () => {
    if (busy) return;
    if (locked) {
      setAsked(true);
      return;
    }
    setAsked(false);
    onToggle();
  };

  return (
    <div>
      <div className="flex items-stretch gap-xs">
        <label
          className={`check-row toy toy-soft flex min-w-0 flex-1 cursor-pointer select-none flex-wrap items-center gap-sm md:flex-nowrap rounded-tile bg-card p-sm has-[input:focus-visible]:outline-[3px] has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-ink ${large ? 'min-h-[64px]' : 'min-h-[56px]'}`}
          style={{ '--check-color': locked && !checked ? 'var(--color-ink-mute)' : color } as CSSProperties}
        >
          <input
            type="checkbox"
            className="sr-only"
            checked={checked}
            onChange={handle}
            aria-describedby={note ? `${id}-note` : undefined}
            aria-busy={busy || undefined}
          />
          <CheckMark checked={checked} color={color} deep={deep} text={text} locked={locked} busy={busy} large={large} />
          <span className="min-w-0 flex-1">
            <span className={`block ${subtitle ? 'text-row-title' : 'text-body'} ${checked && strike ? 'text-ink-mute line-through' : ''}`}>{title}</span>
            {(subtitle || badge) && (
              // The badge sits beside the note, or under it with xs between when the line is full (it touched the note's descenders).
              <span className="flex flex-wrap items-center gap-xs">
                {subtitle && <span className="text-card-note text-ink-soft">{subtitle}</span>}
                {badge}
              </span>
            )}
          </span>
          {(corner || foot || marks) && (
            // Every tag sits at the right (2026-11-05). A phone: the corner tag at the top right and the foot tag under it or at the bottom
            // right, the other marks across the row's foot (below). A laptop: one row at the right, the marks first, then the foot, then the corner at the far
            // right; a long set wraps, right-aligned, and never takes more than half the row.
            <span className="flex shrink-0 flex-col items-end justify-between gap-xs self-stretch md:max-w-[50%] md:flex-row-reverse md:flex-wrap md:items-center md:justify-start md:self-center">
              {corner ?? <span aria-hidden="true" />}
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
        </label>
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
