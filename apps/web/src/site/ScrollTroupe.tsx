import { RELATIONSHIPS, type RelationshipKey } from '@kreators/shared';
import { motion, useMotionTemplate, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { Avatar } from '../components/Avatar';

const STEP = 46;

/**
 * The seven characters walk along the bottom of the page as you scroll.
 * Whichever relationship is on screen takes the lead: it steps forward and grows,
 * the others fall into line behind it. With reduced motion they stand still.
 */
export function ScrollTroupe({ active }: { active: RelationshipKey | null }) {
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll();
  // Left edge of the troupe: from near the left to past the middle over the whole page.
  const lead = useTransform(scrollYProgress, [0, 1], [12, 68]);
  const left = useMotionTemplate`${lead}%`;
  const bob = useTransform(scrollYProgress, (v) => Math.sin(v * 48) * 4);

  // The lead goes first; the rest keep their tower order behind it.
  const order = active ? [active, ...RELATIONSHIPS.map((r) => r.key).filter((k) => k !== active)] : RELATIONSHIPS.map((r) => r.key);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 h-[96px]" aria-hidden="true" style={{ background: 'linear-gradient(to top, var(--paper) 55%, transparent)' }}>
      <div className="relative mx-auto h-full max-w-[1080px]">
        {RELATIONSHIPS.map((r) => {
          const i = order.indexOf(r.key);
          const isLead = active === r.key;
          if (reduce) {
            return (
              <div key={r.key} className="absolute bottom-sm" style={{ left: `calc(12% + ${RELATIONSHIPS.indexOf(r) * STEP}px)` }}>
                <Avatar relationship={r.key} size={isLead ? 56 : 40} decorative still mood={isLead ? 'excited' : 'happy'} />
              </div>
            );
          }
          return (
            <motion.div
              key={r.key}
              className="absolute bottom-sm"
              style={{ left, y: isLead ? 0 : bob, zIndex: isLead ? 2 : 1 }}
              animate={{ x: i * STEP, scale: isLead ? 1.35 : 0.9, rotate: isLead ? 0 : (i % 2 ? 4 : -4) }}
              transition={{ type: 'spring', stiffness: 170, damping: 18 }}
            >
              <motion.div animate={isLead ? { y: [0, -14, 0] } : { y: 0 }} transition={isLead ? { duration: 0.6, repeat: 2, ease: 'easeOut' } : { duration: 0.2 }}>
                <Avatar relationship={r.key} size={40} decorative mood={isLead ? 'excited' : 'happy'} />
              </motion.div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
