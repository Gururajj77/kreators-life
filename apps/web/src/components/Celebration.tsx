import { BADGES, KIND_META, RELATIONSHIPS, type Node, type RippleEvent } from '@kreators/shared';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

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
    setActive((prev) => ({
      title: 'Nice',
      totalXp: 0,
      points: 0,
      ripple: [],
      newBadges: [],
      projectCleared: null,
      color: '#2B1D3A',
      ...c,
      seq: (prev?.seq ?? 0) + 1,
    }));
  }, []);

  useEffect(() => {
    if (!active) return;
    const ms = 2600 + active.ripple.length * 220 + active.newBadges.length * 600;
    const t = setTimeout(() => setActive(null), ms);
    return () => clearTimeout(t);
  }, [active]);

  return (
    <Ctx.Provider value={{ celebrate }}>
      {children}
      <AnimatePresence>{active && <Overlay key={active.seq} c={active} />}</AnimatePresence>
    </Ctx.Provider>
  );
}

const PALETTE = RELATIONSHIPS.map((r) => r.color);

function Confetti() {
  const reduce = useReducedMotion();
  const bits = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        angle: (i / 28) * Math.PI * 2 + (Math.random() - 0.5) * 0.4,
        dist: 90 + Math.random() * 130,
        color: PALETTE[i % PALETTE.length] ?? '#fff',
        w: 6 + Math.random() * 8,
        h: 6 + Math.random() * 10,
        rot: Math.random() * 540,
      })),
    [],
  );
  if (reduce) return null;
  return (
    <div className="pointer-events-none absolute left-1/2 top-[40%]" aria-hidden="true">
      {bits.map((b, i) => (
        <motion.span
          key={i}
          className="absolute block rounded-[2px]"
          style={{ width: b.w, height: b.h, background: b.color }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 0.2, rotate: 0 }}
          animate={{ x: Math.cos(b.angle) * b.dist, y: Math.sin(b.angle) * b.dist + 80, opacity: 0, scale: 1, rotate: b.rot }}
          transition={{ duration: 1.3, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
}

function Overlay({ c }: { c: Celebration }) {
  const reduce = useReducedMotion();
  // Show the ripple climbing: task at the bottom, pillar at the top.
  const climb = [...c.ripple];
  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-[60]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <Confetti />
      <div className="safe-bottom absolute inset-x-0 bottom-[96px] mx-auto w-full max-w-[480px] px-md" role="status" aria-live="polite">
        <motion.div
          className="rounded-card bg-ink p-md text-white shadow-[0_8px_0_0_rgba(43,29,58,0.25)]"
          initial={{ y: reduce ? 0 : 24, scale: reduce ? 1 : 0.96 }}
          animate={{ y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        >
          <div className="flex items-baseline justify-between gap-sm">
            <span className="font-display text-[22px] font-extrabold">{c.title}</span>
            <span className="flex shrink-0 gap-xs">
              {c.totalXp > 0 && (
                <span className="rounded-pill px-sm py-xs text-[14px] font-extrabold text-ink" style={{ background: c.color }}>
                  +{c.totalXp} xp
                </span>
              )}
              {c.points > 0 && <span className="rounded-pill bg-white px-sm py-xs text-[14px] font-extrabold text-ink">+{c.points} points</span>}
            </span>
          </div>
          {climb.length > 0 && (
            <ul className="mt-sm flex list-none flex-col-reverse gap-xs p-0 m-0">
              {climb.map((e, i) => (
                <motion.li
                  key={e.id}
                  className="flex items-center justify-between gap-sm text-[14px]"
                  initial={{ opacity: 0, y: reduce ? 0 : 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: reduce ? 0 : 0.25 + i * 0.22 }}
                >
                  <span className="truncate">
                    <span className="font-bold">{KIND_META[e.kind].label}</span>
                    <span className="text-white/70"> {e.title}</span>
                  </span>
                  <span className="shrink-0 font-extrabold" style={{ color: c.color }}>
                    +{e.amount}
                  </span>
                </motion.li>
              ))}
            </ul>
          )}
          {c.projectCleared && (
            <p className="mt-sm rounded-tile bg-white/10 px-sm py-xs text-[14px] font-bold m-0">Project cleared: {c.projectCleared.title}</p>
          )}
          {c.newBadges.length > 0 && (
            <ul className="mt-sm flex list-none flex-wrap gap-xs p-0 m-0">
              {c.newBadges.map((k) => {
                const b = BADGES.find((x) => x.key === k);
                return (
                  <li key={k} className="rounded-pill bg-white px-sm py-xs text-[13px] font-bold text-ink">
                    New badge {b?.emoji} {b?.name ?? k}
                  </li>
                );
              })}
            </ul>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}
