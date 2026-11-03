import { useEffect } from 'react';
import type { RelationshipKey } from '@kreators/shared';

/**
 * Wear a pillar's colour on this page: hovers, washes and the dark-mode glow follow it (`:root[data-accent]` in app.css), the same
 * way an app's screen wears its own through Gate. Put back what was there when the page leaves.
 */
export function usePillarAccent(pillar: RelationshipKey | null | undefined) {
  useEffect(() => {
    if (!pillar) return;
    const root = document.documentElement;
    const before = root.dataset.accent;
    root.dataset.accent = pillar;
    return () => {
      if (before) root.dataset.accent = before;
      else delete root.dataset.accent;
    };
  }, [pillar]);
}
