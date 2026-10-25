import { KIND_META, KINDS, RELATIONSHIP_BY_KEY, type NodeKind, type RelationshipKey } from '@kreators/shared';
import gsap from 'gsap';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Avatar } from './Avatar';

/** The six layers, tip first: task on top, foundation at the base. */
const LAYERS: NodeKind[] = [...KINDS].reverse();

interface Props {
  /** Which pillar's colour to draw in. */
  relationship: RelationshipKey;
  /** Real words for each layer, when a pillar is already set up. Falls back to the built-in examples. */
  words?: Partial<Record<NodeKind, string>>;
  /** Play the tick ripple on mount. */
  autoplay?: boolean;
  /** Compact: no explanation list under the stack, just the stack and one line of text. */
  compact?: boolean;
  /** When set, the layers are buttons and this one is outlined. */
  selected?: NodeKind | null;
  onSelect?: (kind: NodeKind) => void;
  className?: string;
}

/**
 * The pyramid that explains a pillar. Six layers stack up from the base (a foundation) to the tip (a task).
 * A check lands on the tip, then a glow runs down layer by layer, so it is plain that one small tick makes
 * the whole pyramid stronger. Tap the stack to see it again. Drawn with GSAP; honours reduced motion.
 */
export function Pyramid({ relationship, words = {}, autoplay = false, compact = false, selected = null, onSelect, className = '' }: Props) {
  const rel = RELATIONSHIP_BY_KEY[relationship];
  const root = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<NodeKind | null>(null);
  const [played, setPlayed] = useState(0);
  const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Layers stack in on mount, base first.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const rows = Array.from(el.querySelectorAll<HTMLElement>('[data-layer]')).reverse();
    if (reduce) {
      gsap.set(rows, { opacity: 1, y: 0, scaleX: 1 });
      return;
    }
    const tl = gsap.timeline();
    tl.fromTo(rows, { opacity: 0, y: 24, scaleX: 0.6 }, { opacity: 1, y: 0, scaleX: 1, duration: 0.45, stagger: 0.12, ease: 'back.out(1.6)' });
    if (autoplay) tl.add(() => setPlayed((n) => n + 1), '+=0.4');
    return () => {
      tl.kill();
    };
  }, [autoplay, reduce]);

  // The ripple: a tick lands on the task, then the glow runs down to the foundation.
  useEffect(() => {
    if (played === 0) return;
    const el = root.current;
    if (!el) return;
    const rows = Array.from(el.querySelectorAll<HTMLElement>('[data-layer]'));
    const tick = el.querySelector<HTMLElement>('[data-tick]');
    const glows = rows.map((r) => r.querySelector<HTMLElement>('[data-glow]'));
    if (reduce) {
      setActive('pillar');
      return;
    }
    const tl = gsap.timeline({ onComplete: () => setActive(null) });
    if (tick) tl.fromTo(tick, { scale: 0, rotate: -30 }, { scale: 1, rotate: 0, duration: 0.35, ease: 'back.out(2)' });
    rows.forEach((row, i) => {
      const kind = row.dataset.layer as NodeKind;
      tl.add(() => setActive(kind), i === 0 ? '+=0.1' : '+=0.05');
      tl.to(row, { scale: 1.04, duration: 0.18, ease: 'power2.out' }, '<');
      if (glows[i]) tl.fromTo(glows[i], { opacity: 0 }, { opacity: 0.6, duration: 0.18 }, '<');
      tl.to(row, { scale: 1, duration: 0.25, ease: 'power2.inOut' });
      if (glows[i]) tl.to(glows[i], { opacity: 0, duration: 0.4 }, '<');
    });
    if (tick) tl.to(tick, { scale: 0, duration: 0.3, ease: 'power2.in' }, '+=0.6');
    return () => {
      tl.kill();
    };
  }, [played, reduce]);

  const text = (k: NodeKind) => words[k] ?? KIND_META[k].example;
  // With no layer buttons, the whole stack is one button: a tap plays the ripple again.
  const Stack = onSelect ? 'div' : 'button';

  return (
    <div ref={root} className={className}>
      <Stack
        type={onSelect ? undefined : 'button'}
        onClick={onSelect ? undefined : () => setPlayed((n) => n + 1)}
        aria-label={onSelect ? undefined : 'Tick a task and watch the glow run down the pyramid'}
        className={`relative mx-auto flex w-full max-w-[420px] flex-col items-center gap-xs border-0 bg-transparent p-0 text-inherit ${onSelect ? '' : 'cursor-pointer'}`}
      >
        {/* the tick that lands on the tip */}
        <span data-tick className="absolute -top-sm right-[8%] z-10 flex size-[32px] items-center justify-center rounded-pill bg-card shadow-toy-soft" style={{ transform: 'scale(0)' }} aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke={rel.color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </span>
        {LAYERS.map((k, i) => {
          const meta = KIND_META[k];
          const width = 52 + i * 9.6; // tip 52%, base 100%
          const strength = 1 - i * 0.1;
          const on = active === k || selected === k;
          const Tag = onSelect ? 'button' : 'div';
          return (
            <Tag
              key={k}
              type={onSelect ? 'button' : undefined}
              onClick={onSelect ? () => onSelect(k) : undefined}
              aria-pressed={onSelect ? selected === k : undefined}
              data-layer={k}
              className={`relative flex min-h-[48px] items-center justify-center rounded-pill text-center will-change-transform ${onSelect ? 'toy cursor-pointer' : ''}`}
              style={
                {
                  width: `${width}%`,
                  background: `color-mix(in oklab, ${rel.color} ${Math.round(strength * 100)}%, white)`,
                  // Only the strong fills near the tip take white; the paler layers toward the base take brown, so every word reads.
                  color: strength >= 0.8 ? 'var(--color-on-fill)' : 'var(--color-ink-fixed)',
                  outline: on ? '3px solid var(--color-ink)' : 'none',
                  outlineOffset: 2,
                } as CSSProperties
              }
            >
              <span data-glow className="pointer-events-none absolute inset-0 rounded-pill bg-white" style={{ opacity: 0 }} aria-hidden="true" />
              <span className="relative px-sm text-[14px] font-extrabold leading-tight text-balance">
                {meta.label}
                <span className="block text-[12px] font-bold opacity-90 text-balance">{text(k)}</span>
              </span>
            </Tag>
          );
        })}
        <span className="mt-xs flex items-center gap-xs text-[12px] font-bold text-ink-soft" aria-hidden="true">
          <Avatar relationship={relationship} size={28} decorative still />
          {rel.character} holds this one up.
        </span>
      </Stack>

      {!compact && (
        <ol className="mt-md flex list-none flex-col gap-xs p-0 m-0">
          {LAYERS.map((k) => {
            const meta = KIND_META[k];
            const on = active === k;
            return (
              <li key={k} className={`flex items-start gap-sm rounded-tile p-sm transition-colors ${on ? 'bg-card shadow-toy-soft' : ''}`}>
                <span className="flex size-[28px] shrink-0 items-center justify-center rounded-pill text-[12px] font-extrabold" style={{ background: rel.color, color: rel.text }} aria-hidden="true">
                  {meta.rung}
                </span>
                <span className="min-w-0">
                  <span className="block text-[16px] font-bold">{meta.label}</span>
                  <span className="block text-[14px] font-semibold text-ink-soft">{meta.explain}</span>
                </span>
              </li>
            );
          })}
        </ol>
      )}

      <p className="mt-sm m-0 text-center text-[14px] font-semibold text-ink-soft">
        Tick a task and the glow runs down to the base. {onSelect ? 'Tap a layer to read about it.' : 'Tap the pyramid to see it again.'}
      </p>
    </div>
  );
}
