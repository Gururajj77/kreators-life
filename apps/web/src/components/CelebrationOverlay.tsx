import { BADGES, KIND_META, RELATIONSHIPS } from '@kreators/shared';
import { m as motion, useReducedMotion } from 'motion/react';
import { useMemo } from 'react';
import { BadgeMedal } from './BadgeArt';
import type { Celebration } from './Celebration';
import { fillFor, ON_FILL } from '../lib/relFill';

// The celebration's overlay, out of Celebration.tsx (2026-11-07): the provider stays in the first download, this loads after it.
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

export function CelebrationOverlay({ c }: { c: Celebration }) {
  const reduce = useReducedMotion();
  // Show the ripple climbing: task at the bottom, pillar at the top.
  const climb = [...c.ripple];
  // The pillar's colour as a pill of its tuned fill with the text that reads on it (2026-11-12, the founder: the yellow "+N" could not be
  // read on the card, which is cream in dark mode). Words in the pillar's own colour vanished there; a fill carries its own ground, and
  // orange and yellow take the dark ink by app.css's on-fill rule.
  const pill = { background: fillFor(c.color), color: ON_FILL };
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
          className="rounded-card bg-ink p-md text-on-ink shadow-[0_8px_0_0_rgba(22,21,19,0.15)]"
          initial={{ y: reduce ? 0 : 24, scale: reduce ? 1 : 0.96 }}
          animate={{ y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        >
          <div className="flex items-baseline justify-between gap-sm">
            <span className="text-title2">{c.title}</span>
            <span className="flex shrink-0 gap-xs">
              {c.totalXp > 0 && (
                <span className="rounded-pill px-sm py-xs text-subhead font-medium" style={pill}>
                  +{c.totalXp} xp
                </span>
              )}
              {c.points > 0 && <span className="rounded-pill bg-paper px-sm py-xs text-subhead font-medium text-ink">+{c.points} points</span>}
            </span>
          </div>
          {climb.length > 0 && (
            <ul className="mt-sm flex list-none flex-col-reverse gap-xs p-0 m-0">
              {climb.map((e, i) => (
                <motion.li
                  key={e.id}
                  className="flex items-center justify-between gap-sm text-subhead"
                  initial={{ opacity: 0, y: reduce ? 0 : 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: reduce ? 0 : 0.25 + i * 0.22 }}
                >
                  <span className="truncate">
                    <span className="font-semibold">{KIND_META[e.kind].label}</span>
                    <span className="text-on-ink/70"> {e.title}</span>
                  </span>
                  <span className="shrink-0 rounded-pill px-xs font-semibold" style={pill}>
                    +{e.amount}
                  </span>
                </motion.li>
              ))}
            </ul>
          )}
          {c.projectCleared && (
            <p className="mt-sm rounded-tile bg-on-ink/10 px-sm py-xs text-subhead font-semibold m-0">Project cleared: {c.projectCleared.title}</p>
          )}
          {c.newBadges.length > 0 && (
            <ul className="mt-sm flex list-none flex-wrap gap-xs p-0 m-0">
              {c.newBadges.map((k) => {
                const b = BADGES.find((x) => x.key === k);
                return (
                  <li key={k} className="flex items-center gap-xs rounded-pill bg-on-ink py-xs pl-xs pr-sm text-subhead font-medium text-ink">
                    <BadgeMedal k={k} size="sm" shine decorative />
                    <span>New badge: {b?.name ?? k}</span>
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
