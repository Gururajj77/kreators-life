import { useId, useState, type CSSProperties, type ReactNode } from 'react';

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
  large?: boolean;
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
  color = '#2B1D3A',
  deep = '#15101f',
  text = '#FFFFFF',
  busy = false,
  lockedMessage = null,
  badge,
  strike = false,
  hint = null,
  aside,
  large = false,
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
          className={`check-row toy toy-soft flex min-w-0 flex-1 cursor-pointer select-none items-center gap-sm rounded-tile bg-card p-sm has-[input:focus-visible]:outline-[3px] has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-ink ${large ? 'min-h-[64px]' : 'min-h-[56px]'}`}
          style={{ '--check-color': locked && !checked ? '#A39AAE' : color } as CSSProperties}
        >
          <input
            type="checkbox"
            className="sr-only"
            checked={checked}
            onChange={handle}
            aria-describedby={note ? `${id}-note` : undefined}
            aria-busy={busy || undefined}
          />
          <span
            aria-hidden="true"
            className={`check-box flex shrink-0 items-center justify-center rounded-[10px] border-[3px] ${large ? 'size-[40px]' : 'size-[32px]'} ${busy ? 'animate-pulse' : ''}`}
            style={{
              borderColor: locked && !checked ? '#A39AAE' : color,
              background: checked ? color : '#fff',
              boxShadow: `0 3px 0 0 ${locked && !checked ? '#EFE4DA' : deep}`,
            }}
          >
            {checked ? (
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke={text} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            ) : locked ? (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#6B5F78" strokeWidth="2.6" strokeLinecap="round">
                <circle cx="12" cy="12" r="8.5" />
                <path d="M12 7.5V12l3 2" />
              </svg>
            ) : (
              <svg className="check-preview" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className={`block text-[16px] font-bold leading-snug ${checked && strike ? 'text-ink-mute line-through' : ''}`}>{title}</span>
            {(subtitle || badge) && (
              <span className="flex flex-wrap items-center gap-x-xs">
                {subtitle && <span className="text-[13px] font-semibold text-ink-soft">{subtitle}</span>}
                {badge}
              </span>
            )}
          </span>
        </label>
        {aside}
      </div>
      {note && (
        <p id={`${id}-note`} role="status" className="mt-xs m-0 rounded-tile bg-paper px-sm py-xs text-[13px] font-bold">
          {note}
        </p>
      )}
    </div>
  );
}
