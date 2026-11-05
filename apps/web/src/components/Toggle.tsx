import { useId, type CSSProperties, type ReactNode } from 'react';
import { tick } from './fx/haptics';

interface Props {
  on: boolean;
  onChange: (on: boolean) => void;
  label: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
  color?: string;
  /** Just the switch and its label, no card around it. For a switch that sits inside another card. */
  compact?: boolean;
}

/** A switch row. The whole row is the tap target. */
export function Toggle({ on, onChange, label, hint, disabled = false, color = 'var(--color-r4)', compact = false }: Props) {
  const id = useId();
  return (
    <label className={`flex cursor-pointer select-none items-center gap-sm ${compact ? 'min-h-[44px]' : 'min-h-[56px] rounded-tile bg-card p-sm shadow-toy-soft'} ${disabled ? 'opacity-60' : ''}`}>
      <span className="min-w-0 flex-1">
        <span className={`block ${compact ? 'text-subhead text-ink-soft' : 'text-body'}`} id={`${id}-l`}>
          {label}
        </span>
        {hint && <span className="prose-long block text-subhead text-ink-soft">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby={`${id}-l`}
        disabled={disabled}
        onClick={() => {
          tick();
          onChange(!on);
        }}
        className="fx-switch"
        style={{ '--switch-on': color } as CSSProperties}
      >
        <span className="fx-switch-knob" aria-hidden="true" />
      </button>
    </label>
  );
}
