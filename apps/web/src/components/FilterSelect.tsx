import { useId } from 'react';
import { SELECT_SM } from '../lib/ui';

/**
 * A filter that picks one value from a list: a short label and a dropdown, in place of a long row of pills. Put several side by side
 * in `FilterBar`; each takes the free width of its cell, so on a phone (one per line) the dropdown fills the line beside its label.
 */
export function FilterSelect<K extends string>({ label, value, items, onChange }: { label: string; value: K; items: readonly { key: K; label: string }[]; onChange: (k: K) => void }) {
  const id = useId();
  return (
    <div className="flex min-w-0 items-center gap-xs">
      <label htmlFor={id} className="w-[76px] shrink-0 text-[14px] font-bold text-ink-soft md:w-auto">
        {label}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as K)} className={`${SELECT_SM} min-w-0 flex-1`}>
        {items.map((i) => (
          <option key={i.key} value={i.key}>
            {i.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Filters in one line from the tablet width up (as many columns as filters), one per line on a phone. */
export function FilterBar({ children, label = 'Filters', count }: { children: React.ReactNode; label?: string; count: number }) {
  return (
    <div role="group" aria-label={label} className={`grid gap-xs md:gap-md ${count >= 3 ? 'md:grid-cols-3' : count === 2 ? 'md:grid-cols-2' : ''}`}>
      {children}
    </div>
  );
}
