import { lazy, Suspense, useEffect, useRef, useState, useSyncExternalStore, type ComponentType, type LazyExoticComponent } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Archive,
  BellOff,
  Bookmark,
  Calendar,
  CircleHelp,
  Copy,
  Download,
  Eye,
  EyeOff,
  LoaderCircle,
  LockOpen,
  Maximize,
  Menu,
  Mic,
  MicOff,
  Minimize,
  Mouse,
  Plus,
  Settings,
  SkipForward,
  Square,
  SquarePen,
  Trash2,
  TriangleAlert,
  UserPlus,
  Volume2,
} from 'lucide-react';
import { APP_ICONS } from '../lib/appIcons';
// The glyphs the app registry already draws come from its map, so they stay in the `icons-app` chunk and out of the entry.
const { Activity, Bell, BookOpen, CircleAlert, Compass, Heart, House, Link, Lock, Mail, Moon, Search, Share2, ShoppingBag, ShoppingCart, SquareCheck, Star, Sun, Target, TrendingUp, Tv, VolumeX, Wind, X } = APP_ICONS;
import { Icon, type IconSize } from './Icon';

// The animated icons from useanimations.com (react-useanimations, MIT). Its player draws SVG paths itself:
// no eval, no new Function (checked by grep over index.mjs and every lib file listed here), and one injected <style>
// that the policy's style-src 'unsafe-inline' already allows.
// The player (`vendor-useanimations`) and each animation (its own small chunk, vite.config.ts) load lazily through import(),
// after the first paint, and the lucide glyph stands in until then, so nothing jumps and a failed download keeps the still glyph.
// Reduced motion: hovers stay still and toggles jump to the end (the player's own), and a looping icon shows its lucide still.
// The icon reacts to the button or link it sits in (hover, keyboard focus, click), not only to the pointer on the glyph itself.
// Seven of them have a "knockout" layer, a stroke in the page colour that cuts a gap round a slash (notification,
// notification2, visibility, visibility2, download, microphone, volume); `.ua-knock` in app.css makes it transparent, since glass has no one colour to paint it in.
// Not used on purpose: the CheckRow tick (it is drawn to the row's own size and colours) and chevrons.

type Still = { off: LucideIcon; on?: LucideIcon; filledOn?: boolean };

const ANIMATIONS = {
  // `menu2`, not `menu`: the first one ends on a bun-like shape, not a cross (seen in the icon gallery, 2026-11-03).
  menu: { load: () => import('react-useanimations/lib/menu2'), still: { off: Menu, on: X } },
  searchToX: { load: () => import('react-useanimations/lib/searchToX'), still: { off: Search, on: X } },
  settings: { load: () => import('react-useanimations/lib/settings'), still: { off: Settings } },
  trash: { load: () => import('react-useanimations/lib/trash'), still: { off: Trash2 } },
  star: { load: () => import('react-useanimations/lib/star'), still: { off: Star, filledOn: true } },
  copy: { load: () => import('react-useanimations/lib/copy'), still: { off: Copy } },
  maximizeMinimize: { load: () => import('react-useanimations/lib/maximizeMinimize'), still: { off: Maximize, on: Minimize } },
  loading: { load: () => import('react-useanimations/lib/loading'), still: { off: LoaderCircle }, loop: true },
  home: { load: () => import('react-useanimations/lib/home'), still: { off: House } },
  calendar: { load: () => import('react-useanimations/lib/calendar'), still: { off: Calendar } },
  explore: { load: () => import('react-useanimations/lib/explore'), still: { off: Compass } },
  notification: { load: () => import('react-useanimations/lib/notification'), still: { off: Bell, on: BellOff } },
  notification2: { load: () => import('react-useanimations/lib/notification2'), still: { off: Bell } },
  plusToX: { load: () => import('react-useanimations/lib/plusToX'), still: { off: Plus, on: X } },
  visibility: { load: () => import('react-useanimations/lib/visibility'), still: { off: Eye, on: EyeOff } },
  visibility2: { load: () => import('react-useanimations/lib/visibility2'), still: { off: Eye, on: EyeOff } },
  download: { load: () => import('react-useanimations/lib/download'), still: { off: Download } },
  share: { load: () => import('react-useanimations/lib/share'), still: { off: Share2 } },
  mail: { load: () => import('react-useanimations/lib/mail'), still: { off: Mail } },
  lock: { load: () => import('react-useanimations/lib/lock'), still: { off: Lock, on: LockOpen } },
  archive: { load: () => import('react-useanimations/lib/archive'), still: { off: Archive } },
  heart: { load: () => import('react-useanimations/lib/heart'), still: { off: Heart, filledOn: true } },
  bookmark: { load: () => import('react-useanimations/lib/bookmark'), still: { off: Bookmark, filledOn: true } },
  userPlus: { load: () => import('react-useanimations/lib/userPlus'), still: { off: UserPlus } },
  help: { load: () => import('react-useanimations/lib/help'), still: { off: CircleHelp }, loop: true },
  alertCircle: { load: () => import('react-useanimations/lib/alertCircle'), still: { off: CircleAlert }, loop: true },
  alertTriangle: { load: () => import('react-useanimations/lib/alertTriangle'), still: { off: TriangleAlert }, loop: true },
  skipForward: { load: () => import('react-useanimations/lib/skipForward'), still: { off: SkipForward } },
  checkBox: { load: () => import('react-useanimations/lib/checkBox'), still: { off: Square, on: SquareCheck } },
  scrollDown: { load: () => import('react-useanimations/lib/scrollDown'), still: { off: Mouse }, loop: true },
  activity: { load: () => import('react-useanimations/lib/activity'), still: { off: Activity }, loop: true },
  edit: { load: () => import('react-useanimations/lib/edit'), still: { off: SquarePen } },
  microphone: { load: () => import('react-useanimations/lib/microphone'), still: { off: Mic, on: MicOff } },
  volume: { load: () => import('react-useanimations/lib/volume'), still: { off: Volume2, on: VolumeX } },
  // The sidebar's apps that have a matching animation, so an app keeps the one icon it wears everywhere (lib/appIcons).
  sun: { load: () => import('react-useanimations/lib/sun'), still: { off: Sun } },
  moon: { load: () => import('react-useanimations/lib/moon'), still: { off: Moon } },
  wind: { load: () => import('react-useanimations/lib/wind'), still: { off: Wind } },
  bookOpen: { load: () => import('react-useanimations/lib/bookOpen'), still: { off: BookOpen } },
  shoppingBag: { load: () => import('react-useanimations/lib/shoppingBag'), still: { off: ShoppingBag } },
  shoppingCart: { load: () => import('react-useanimations/lib/shoppingCart'), still: { off: ShoppingCart } },
  trendingUp: { load: () => import('react-useanimations/lib/trendingUp'), still: { off: TrendingUp } },
  target: { load: () => import('react-useanimations/lib/target'), still: { off: Target } },
  tv: { load: () => import('react-useanimations/lib/tv'), still: { off: Tv } },
  link: { load: () => import('react-useanimations/lib/link'), still: { off: Link } },
} satisfies Record<string, { load: () => Promise<{ default: unknown }>; still: Still; loop?: boolean }>;

export type AnimatedName = keyof typeof ANIMATIONS;
/** Every registered name, for the icon gallery and tests. */
export const ANIMATED_NAMES = Object.keys(ANIMATIONS) as AnimatedName[];

/**
 * How an icon plays: the player's own words, plus `hover-bounce` (ours): a hover plays it to its end and straight back,
 * whether or not the pointer stays (the padlock lifts and falls back; it never rests open on a locked button).
 */
export type Interaction = 'loop' | 'click-toggle' | 'click-replay' | 'hover' | 'hover-loop' | 'hover-replay' | 'hover-bounce';

type Props = {
  size: IconSize;
  active?: boolean;
  className?: string;
  interaction?: Interaction;
  playWhen?: boolean;
  playOnShow?: boolean;
};

function StillGlyph({ name, size, active, className }: Props & { name: AnimatedName }) {
  const s: Still = ANIMATIONS[name].still;
  return <Icon icon={active && s.on ? s.on : s.off} size={size} filled={Boolean(active && s.filledOn)} className={`${name === 'loading' ? 'animate-spin motion-reduce:animate-none' : ''} ${className ?? ''}`} />;
}

type Handlers = {
  onClick: (e: unknown) => void;
  onMouseEnter: (e: unknown) => void;
  onMouseLeave: (e: unknown) => void;
  onPointerEnter: (e: unknown) => void;
  onFocus: (e: unknown) => void;
  onBlur: (e: unknown) => void;
};

const loaded = new Map<AnimatedName, LazyExoticComponent<ComponentType<Props>>>();

/** The button, link or summary the icon sits in: it gets the hover, focus and click, so the whole control plays the icon. */
function hostOf(el: HTMLElement): HTMLElement {
  return (el.parentElement?.closest('a,button,summary,label,[role="button"],[role="tab"]') as HTMLElement | null) ?? el.parentElement ?? el;
}

function lazyFor(name: AnimatedName) {
  let c = loaded.get(name);
  if (!c) {
    c = lazy(async () => {
      try {
        const [player, data] = await Promise.all([import('react-useanimations'), ANIMATIONS[name].load()]);
        const UseAnimations = player.default;
        const animation = data.default as Parameters<typeof UseAnimations>[0]['animation'];
        const lottie = (animation as { animationData: { ip?: number; op?: number; fr?: number } }).animationData;
        const playMs = Math.round((((lottie.op ?? 30) - (lottie.ip ?? 0)) / (lottie.fr ?? 30)) * 1000);
        // The Lottie artboard is 32 units round a 24-unit glyph with a 2-unit stroke, so drawing it at 4/3 of the size
        // with a negative margin gives the same footprint and stroke as a lucide icon at `size`.
        const Drawn = ({ size, active, className, interaction, playWhen, playOnShow }: Props) => {
          const span = useRef<HTMLElement | null>(null);
          const handlers = useRef<Handlers | null>(null);
          const bounce = interaction === 'hover-bounce';
          const mode = bounce ? 'hover' : (interaction ?? animation.interaction ?? 'click-replay');
          // One timer that sends a hover back; cleared only when the icon goes, so a tab left quickly never stays mid-way.
          const back = useRef(0);
          const goBack = () => {
            window.clearTimeout(back.current);
            back.current = window.setTimeout(() => handlers.current?.onMouseLeave({ defaultPrevented: false }), playMs);
          };
          useEffect(() => () => window.clearTimeout(back.current), []);
          // The host control drives the player through the player's own event handlers (its `render` prop hands them over).
          useEffect(() => {
            const el = span.current;
            if (!el) return;
            const host = hostOf(el);
            const call = (k: keyof Handlers) => (e: Event) => handlers.current?.[k](e);
            const enter = (e: Event) => {
              handlers.current?.onMouseEnter(e);
              if (bounce) goBack();
            };
            const leave = (e: Event) => {
              if (!bounce) handlers.current?.onMouseLeave(e);
            };
            const pointer = call('onPointerEnter');
            const focus = (e: Event) => {
              handlers.current?.onFocus({ defaultPrevented: e.defaultPrevented, currentTarget: host });
              if (bounce) goBack();
            };
            const blur = (e: Event) => {
              if (!bounce) handlers.current?.onBlur(e);
            };
            const click = call('onClick');
            host.addEventListener('pointerenter', pointer);
            host.addEventListener('mouseenter', enter);
            host.addEventListener('mouseleave', leave);
            host.addEventListener('focusin', focus);
            host.addEventListener('focusout', blur);
            host.addEventListener('click', click);
            return () => {
              host.removeEventListener('pointerenter', pointer);
              host.removeEventListener('mouseenter', enter);
              host.removeEventListener('mouseleave', leave);
              host.removeEventListener('focusin', focus);
              host.removeEventListener('focusout', blur);
              host.removeEventListener('click', click);
            };
          }, []);
          // `playWhen` turning true (a tab becoming the page you are on) plays it once, like a hover; a touch screen too.
          const was = useRef(playOnShow ? false : playWhen);
          useEffect(() => {
            const before = was.current;
            was.current = playWhen;
            if (!playWhen || before) return;
            // Two frames later: the player builds its animation in its own effect, after this one on the first show.
            let id = requestAnimationFrame(() => {
              id = requestAnimationFrame(() => {
                const h = handlers.current;
                if (!h) return;
                if (mode === 'click-replay') return h.onClick({ defaultPrevented: false });
                h.onPointerEnter({ pointerType: 'mouse' });
                h.onMouseEnter({ defaultPrevented: false });
                // A hover icon plays to its end and back; a looping one plays one round and rests on its first frame.
                if (mode === 'hover-loop') h.onMouseLeave({ defaultPrevented: false });
                if (mode === 'hover') goBack();
              });
            });
            return () => cancelAnimationFrame(id);
          }, [playWhen, mode]);
          return (
            <UseAnimations
              animation={animation}
              interaction={interaction === undefined ? undefined : mode}
              size={(size * 4) / 3}
              style={{ margin: -size / 6 }}
              // Controlled for the toggles, so a click on the host never flips it on its own.
              active={mode === 'click-toggle' ? Boolean(active) : active}
              strokeColor="currentColor"
              fillColor="currentColor"
              className={`ua-knock ${className ?? ''}`}
              render={(ev, anim) => {
                handlers.current = ev as unknown as Handlers;
                const { ref, ...rest } = anim;
                return (
                  <span
                    {...rest}
                    ref={(el) => {
                      span.current = el;
                      ref(el);
                    }}
                  />
                );
              }}
            />
          );
        };
        return { default: Drawn };
      } catch {
        return { default: (p: Props) => <StillGlyph name={name} {...p} /> };
      }
    });
    loaded.set(name, c);
  }
  return c;
}

const REDUCE = '(prefers-reduced-motion: reduce)';
function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (on) => {
      const m = window.matchMedia?.(REDUCE);
      m?.addEventListener('change', on);
      return () => m?.removeEventListener('change', on);
    },
    () => Boolean(window.matchMedia?.(REDUCE).matches),
    () => false,
  );
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
 * focus mode on, a star picked, a fold open). Hovering or focusing the control it sits in plays a hover icon;
 * `playWhen` plays it once each time it turns true; `interaction` overrides how it plays (`hover-replay` for once).
 */
export function AnimatedIcon({
  name,
  size = 20,
  active,
  className,
  interaction,
  playWhen,
  playOnShow,
}: {
  name: AnimatedName;
  size?: IconSize;
  active?: boolean;
  className?: string;
  interaction?: Interaction;
  playWhen?: boolean;
  /** With `playWhen`: also play when the icon first shows (an error line that just appeared). */
  playOnShow?: boolean;
}) {
  const [ready, setReady] = useState(() => loaded.has(name));
  useEffect(() => {
    if (ready) return;
    return whenIdle(() => setReady(true));
  }, [ready]);
  const reduced = useReducedMotion();
  const still = <StillGlyph name={name} size={size} active={active} className={className} />;
  // A looping icon left to loop shows the still glyph under reduced motion: its first frame can be empty (the spinner's is).
  const loops = 'loop' in ANIMATIONS[name] && (interaction ?? 'loop') === 'loop';
  if (!ready || (reduced && loops)) return still;
  const Drawn = lazyFor(name);
  return (
    <Suspense fallback={still}>
      <Drawn size={size} active={active} className={className} interaction={interaction} playWhen={playWhen} playOnShow={playOnShow} />
    </Suspense>
  );
}
