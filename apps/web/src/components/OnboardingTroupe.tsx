import { RELATIONSHIP_BY_KEY, type RelationshipKey, characterTitle } from '@kreators/shared';
import gsap from 'gsap';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { Avatar } from './Avatar';

/**
 * The band along the bottom of the vibe check. The character whose floor is being asked about walks
 * from the left edge to the right as its questions are answered; when the floor is done it steps off
 * and the next one steps on. Finished characters wait on the right, the ones still to come on the left.
 * Driven by GSAP; honours reduced motion.
 */
export function OnboardingTroupe({ floors, current, step, steps }: { floors: RelationshipKey[]; current: RelationshipKey | null; step: number; steps: number }) {
  const track = useRef<HTMLDivElement>(null);
  const walker = useRef<HTMLDivElement>(null);
  const prev = useRef<RelationshipKey | null>(null);
  const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const idx = current ? floors.indexOf(current) : floors.length;
  const done = floors.slice(0, Math.max(0, idx));
  const todo = floors.slice(idx + 1);

  // Where the walker should stand for this step, as a share of the track.
  const share = steps <= 1 ? 1 : Math.max(0, Math.min(1, (step - 1) / (steps - 1)));

  useLayoutEffect(() => {
    const el = walker.current;
    const band = track.current;
    if (!el || !band) return;
    // The queue waits on the left and the finished ones on the right, so the walker keeps clear of both.
    const margin = 96;
    const width = Math.max(0, band.clientWidth - 72 - margin * 2);
    const x = margin + width * share;
    if (reduce) {
      gsap.set(el, { x, y: 0, opacity: 1 });
      prev.current = current;
      return;
    }
    if (prev.current !== current) {
      // A new character steps on from the left while the last one has already stepped off.
      gsap.fromTo(el, { x: 8, opacity: 0 }, { x, opacity: 1, duration: 0.7, ease: 'power2.out' });
    } else {
      gsap.to(el, { x, duration: 0.9, ease: 'power2.inOut' });
    }
    // Footsteps: a little bounce while moving.
    gsap.fromTo(el, { y: 0 }, { y: -10, duration: 0.16, yoyo: true, repeat: 3, ease: 'sine.inOut' });
    prev.current = current;
  }, [current, share, reduce]);

  useEffect(() => {
    const el = walker.current;
    return () => {
      if (el) gsap.killTweensOf(el);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20" aria-hidden="true">
      <div ref={track} className="relative mx-auto h-[120px] w-full max-w-[640px] overflow-x-hidden overflow-y-visible pt-sm">
        {/* the ground */}
        <div className="absolute inset-x-0 bottom-0 h-[12px] rounded-t-pill bg-white/40" />
        {/* the ones still to come wait on the left */}
        <div className="absolute bottom-sm left-xs flex -space-x-[12px]">
          {todo.map((k) => (
            <Avatar key={k} relationship={k} size={32} mood="sleepy" decorative className="opacity-70" />
          ))}
        </div>
        {/* the ones done wait on the right */}
        <div className="absolute right-xs bottom-sm flex -space-x-[12px]">
          {done.map((k) => (
            <Avatar key={k} relationship={k} size={36} mood="excited" decorative />
          ))}
        </div>
        {current && (
          <div ref={walker} className="absolute bottom-sm left-0 will-change-transform">
            <Avatar relationship={current} size={64} mood={step >= steps ? 'excited' : 'happy'} decorative className="avatar-hop" />
            <span className="mt-xs block text-center text-[12px] font-extrabold" style={{ color: `var(--deep-${current})` }}>
              {characterTitle(current)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
