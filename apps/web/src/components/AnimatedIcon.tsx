import { lazy, Suspense, useEffect, useState, type ComponentType, type LazyExoticComponent } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Copy, LoaderCircle, Maximize, Menu, Minimize, Search, Settings, Star, Trash2, X } from 'lucide-react';
import { Icon, type IconSize } from './Icon';

// The eight animated icons from useanimations.com (react-useanimations, MIT). Its player draws SVG paths itself:
// no eval, no new Function, one injected <style> that the policy's style-src 'unsafe-inline' already allows.
// Each animation and the player load lazily (vite puts the player in `vendor-useanimations`), after the first paint,
// and the lucide glyph stands in until then, so nothing jumps and a failed download keeps the still glyph.
// Reduced motion is the player's own: loops show their first frame, hovers stay still, toggles jump to the end.
// Not used on purpose (see the icons audit): the CheckRow tick, chevrons, the bell, the volume and anything with a knockout layer.

type Still = { off: LucideIcon; on?: LucideIcon };

const ANIMATIONS = {
  menu: { load: () => import('react-useanimations/lib/menu'), still: { off: Menu, on: X } },
  searchToX: { load: () => import('react-useanimations/lib/searchToX'), still: { off: Search, on: X } },
  settings: { load: () => import('react-useanimations/lib/settings'), still: { off: Settings } },
  trash: { load: () => import('react-useanimations/lib/trash'), still: { off: Trash2 } },
  star: { load: () => import('react-useanimations/lib/star'), still: { off: Star } },
  copy: { load: () => import('react-useanimations/lib/copy'), still: { off: Copy } },
  maximizeMinimize: { load: () => import('react-useanimations/lib/maximizeMinimize'), still: { off: Maximize, on: Minimize } },
  loading: { load: () => import('react-useanimations/lib/loading'), still: { off: LoaderCircle } },
} satisfies Record<string, { load: () => Promise<{ default: unknown }>; still: Still }>;

export type AnimatedName = keyof typeof ANIMATIONS;

type Props = { size: IconSize; active?: boolean; className?: string };

function StillGlyph({ name, size, active, className }: Props & { name: AnimatedName }) {
  const s: Still = ANIMATIONS[name].still;
  const filled = name === 'star' && active;
  return <Icon icon={active && s.on ? s.on : s.off} size={size} filled={filled} className={`${name === 'loading' ? 'animate-spin motion-reduce:animate-none' : ''} ${className ?? ''}`} />;
}

const loaded = new Map<AnimatedName, LazyExoticComponent<ComponentType<Props>>>();

function lazyFor(name: AnimatedName) {
  let c = loaded.get(name);
  if (!c) {
    c = lazy(async () => {
      try {
        const [player, data] = await Promise.all([import('react-useanimations'), ANIMATIONS[name].load()]);
        const UseAnimations = player.default;
        const animation = data.default;
        // The Lottie artboard is 32 units round a 24-unit glyph with a 2-unit stroke, so drawing it at 4/3 of the size
        // with a negative margin gives the same footprint and stroke as a lucide icon at `size`.
        const Drawn = ({ size, active, className }: Props) => (
          <UseAnimations
            animation={animation}
            size={(size * 4) / 3}
            style={{ margin: -size / 6 }}
            active={active}
            strokeColor="currentColor"
            fillColor="currentColor"
            className={className}
          />
        );
        return { default: Drawn };
      } catch {
        return { default: (p: Props) => <StillGlyph name={name} {...p} /> };
      }
    });
    loaded.set(name, c);
  }
  return c;
}

/** When the page is idle after its first paint; a timer where the browser has no idle callback. */
function whenIdle(run: () => void): () => void {
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(run, { timeout: 2500 });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(run, 400);
  return () => window.clearTimeout(id);
}

/**
 * An animated icon, always decorative: the button around it owns the accessible name and any
 * `aria-expanded` or `aria-pressed`. `active` is the screen's own state for the toggles (menu open, search has text,
 * focus mode on, a star picked).
 */
export function AnimatedIcon({ name, size = 20, active, className }: { name: AnimatedName; size?: IconSize; active?: boolean; className?: string }) {
  const [ready, setReady] = useState(() => loaded.has(name));
  useEffect(() => {
    if (ready) return;
    return whenIdle(() => setReady(true));
  }, [ready]);
  const still = <StillGlyph name={name} size={size} active={active} className={className} />;
  if (!ready) return still;
  const Drawn = lazyFor(name);
  return (
    <Suspense fallback={still}>
      <Drawn size={size} active={active} className={className} />
    </Suspense>
  );
}
