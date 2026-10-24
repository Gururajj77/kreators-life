import { useId, type ReactNode } from 'react';

interface Props {
  on: boolean;
  onChange: (on: boolean) => void;
  label: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
  color?: string;
}

/** A switch row. The whole row is the tap target. */
export function Toggle({ on, onChange, label, hint, disabled = false, color = '#9BB068' }: Props) {
  const id = useId();
  return (
    <label className={`flex min-h-[56px] cursor-pointer select-none items-center gap-sm rounded-tile bg-card p-sm shadow-toy-soft ${disabled ? 'opacity-60' : ''}`}>
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-bold leading-snug" id={`${id}-l`}>
          {label}
        </span>
        {hint && <span className="block text-[14px] font-semibold text-ink-soft">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby={`${id}-l`}
        disabled={disabled}
        onClick={() => onChange(!on)}
        className="relative h-[32px] w-[56px] shrink-0 rounded-pill transition-colors"
        style={{ background: on ? color : 'var(--color-line)' }}
      >
        <span className="absolute top-[4px] block size-[24px] rounded-pill bg-white shadow-toy-soft transition-[left]" style={{ left: on ? 28 : 4 }} aria-hidden="true" />
      </button>
    </label>
  );
}
