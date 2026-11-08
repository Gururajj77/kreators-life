import type { Node, RippleEvent } from '@kreators/shared';
import { AnimatePresence } from 'motion/react';
import { createContext, Suspense, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { lazyNamed } from '../lib/lazy';
import { useSession } from '../lib/store';

// The overlay (confetti, the climb and the badge medals) is its own chunk (2026-11-07), fetched once the first screen is drawn for someone
// signed in, so it is there before the first tick, and by `celebrate` itself if it is not.
const loadOverlay = () => import('./CelebrationOverlay');
const Overlay = lazyNamed(loadOverlay, 'CelebrationOverlay');

export interface Celebration {
  title: string;
  totalXp: number;
  points: number;
  ripple: RippleEvent[];
  newBadges: string[];
  projectCleared: Node | null;
  color: string;
}

const Ctx = createContext<{ celebrate: (c: Partial<Celebration>) => void }>({ celebrate: () => {} });

export const useCelebrate = () => useContext(Ctx).celebrate;

export function CelebrationProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<(Celebration & { seq: number }) | null>(null);

  const celebrate = useCallback((c: Partial<Celebration>) => {
    void loadOverlay().catch(() => undefined);
    setActive((prev) => ({
      title: 'Nice',
      totalXp: 0,
      points: 0,
      ripple: [],
      newBadges: [],
      projectCleared: null,
      color: '#262626',
      ...c,
      seq: (prev?.seq ?? 0) + 1,
    }));
  }, []);

  const signedIn = useSession((s) => Boolean(s.token));
  useEffect(() => {
    if (!signedIn) return;
    const fetchIt = () => void loadOverlay().catch(() => undefined);
    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(fetchIt, { timeout: 3000 });
      return () => cancelIdleCallback(id);
    }
    const t = window.setTimeout(fetchIt, 1500);
    return () => window.clearTimeout(t);
  }, [signedIn]);

  useEffect(() => {
    if (!active) return;
    const ms = 2600 + active.ripple.length * 220 + active.newBadges.length * 600;
    const t = setTimeout(() => setActive(null), ms);
    return () => clearTimeout(t);
  }, [active]);

  // One object for as long as `celebrate` is the same, so showing or hiding the overlay does not re-render every screen that asks for it.
  const value = useMemo(() => ({ celebrate }), [celebrate]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <AnimatePresence>
        {active && (
          <Suspense key={active.seq} fallback={null}>
            <Overlay c={active} />
          </Suspense>
        )}
      </AnimatePresence>
    </Ctx.Provider>
  );
}

