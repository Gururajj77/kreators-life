import type { ReactNode } from 'react';

/**
 * A round glass button by a dark panel (the `.mf-round` look of Breathe and focus): a name for screen readers, and the same name as a
 * tooltip on hover and keyboard focus. `at` says which way the tooltip leans so it stays on screen. Mindfulness's tools and the water
 * block's both use it.
 */
export function RoundButton({ at, label, onClick, opens = false, pressed, children }: { at: 'tl' | 'tr' | 'br' | 'bc'; label: string; onClick: () => void; /** It opens a dialog. */ opens?: boolean; /** A switch that stays on. */ pressed?: boolean; children: ReactNode }) {
  return (
    <button type="button" className="mf-round toy" data-at={at} data-tip={label} aria-label={label} aria-haspopup={opens ? 'dialog' : undefined} aria-pressed={pressed} onClick={onClick}>
      {children}
    </button>
  );
}
