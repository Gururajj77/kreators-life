import { useEffect, useId, useRef, useState } from 'react';
import { tick } from './fx/haptics';

export interface ChipOption {
  value: number;
  label: string;
}

/**
 * A small setting on the focus panel: a tiny label, and under it the value as a chip that opens a short list of choices. Arrow keys move
 * through the list, Enter picks, Escape closes and puts focus back on the chip, and a tap anywhere else closes it. The owner keeps the value.
 */
export function ChipSelect({ label, value, valueLabel, options, onChange }: { label: string; value: number; valueLabel: string; options: readonly ChipOption[]; onChange: (v: number) => void }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const chip = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', away);
    return () => window.removeEventListener('pointerdown', away);
  }, [open]);
  // The list takes focus when it opens, on the chosen row, and that row is scrolled into view.
  useEffect(() => {
    if (!open) return;
    list.current?.focus({ preventScroll: true });
    list.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [open]);

  const openIt = () => {
    const at = options.findIndex((o) => o.value === value);
    setActive(at < 0 ? 0 : at);
    setOpen(true);
  };
  const close = (back: boolean) => {
    setOpen(false);
    if (back) chip.current?.focus();
  };
  const pick = (i: number) => {
    const o = options[i];
    if (!o) return;
    if (o.value !== value) tick();
    onChange(o.value);
    close(true);
  };
  const move = (to: number) => {
    const i = Math.min(options.length - 1, Math.max(0, to));
    setActive(i);
    list.current?.querySelectorAll<HTMLElement>('[role="option"]')[i]?.scrollIntoView({ block: 'nearest' });
  };

  return (
    <div ref={box} className="mf-set">
      <span className="mf-set-label" id={`${id}-l`}>
        {label}
      </span>
      <button ref={chip} type="button" className="mf-set-chip toy" aria-haspopup="listbox" aria-expanded={open} aria-labelledby={`${id}-l ${id}-v`} onClick={() => (open ? close(false) : openIt())}>
        <span id={`${id}-v`}>{valueLabel}</span>
        <svg aria-hidden="true" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <ul
          ref={list}
          role="listbox"
          tabIndex={-1}
          aria-labelledby={`${id}-l`}
          aria-activedescendant={`${id}-o${active}`}
          className="mf-pop"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              close(true);
            } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              move(active + 1);
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              move(active - 1);
            } else if (e.key === 'Home') {
              e.preventDefault();
              move(0);
            } else if (e.key === 'End') {
              e.preventDefault();
              move(options.length - 1);
            } else if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              pick(active);
            } else if (e.key === 'Tab') close(false);
          }}
        >
          {options.map((o, i) => (
            <li key={o.value} id={`${id}-o${i}`} role="option" aria-selected={o.value === value} data-active={i === active ? '' : undefined} className="mf-opt" onPointerEnter={() => setActive(i)} onClick={() => pick(i)}>
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
