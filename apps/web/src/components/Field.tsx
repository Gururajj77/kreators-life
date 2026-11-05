import type { ReactNode } from 'react';
import { LABEL } from '../lib/ui';

/** A label with its words above the field it wraps, and an optional quiet hint under the words. */
export function FieldLabel({ label, hint, children, className = '' }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className={LABEL}>{label}</span>
      {hint && <span className="block text-caption text-ink-soft">{hint}</span>}
      {children}
    </label>
  );
}
