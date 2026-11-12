import gsap from 'gsap';
import { useReducedMotion } from 'motion/react';
import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { useModule } from '../lib/modules';
import { useKept } from '../lib/kept';
import { useMe } from '../lib/queries';
import { Avatar } from './Avatar';

/**
 * The assistant's button is in the first download; its panel (the flows, the chat, the receipts: the bulk of components/Assistant.tsx)
 * downloads the first time a pointer or the keyboard reaches the button, or when a kept chat reopens it, so it never weighs on the first paint.
 */
const loadPanelModule = () => import('./Assistant');
let started: Promise<unknown> | null = null;
const loadPanel = () => {
  started ??= loadPanelModule().catch(() => {
    started = null;
  });
};
const AssistantPanel = lazy(() => loadPanelModule().then((m) => ({ default: m.AssistantPanel })));

/** The smart tips' placement (lib/tipGeometry.ts), fetched the first time the bubble shows, so the first download never carries it. */
type Geometry = typeof import('../lib/tipGeometry');
let geometry: Geometry | null = null;
let geometryLoading: Promise<Geometry | null> | null = null;
const loadGeometry = () =>
  (geometryLoading ??= import('../lib/tipGeometry')
    .then((m) => (geometry = m))
    .catch(() => {
      geometryLoading = null;
      return null;
    }));

/**
 * The round button at the bottom right, on every screen inside the app: above the tab bar on a phone, in the
 * corner on a laptop. Bumling sits in it, bobbing and blinking, and gives a small hop every few seconds; pointing at
 * it (or reaching it with the keyboard) makes him jump and brings up "Chat with AI assistant" above it; a phone never shows
 * that text by itself, because space is tight. It opens the
 * panel over the page. Hidden on the Companion, which is a chat of its own, and when the team has switched the
 * assistant off. Motion is GSAP; with reduced motion he stays put and the bubble just appears.
 */
export function Assistant() {
  const me = useMe();
  const loc = useLocation();
  const mod = useModule('assistant');
  const [open, setOpen] = useKept(`assistant-open:${me.data?.user.id ?? 'none'}`, 'open', false);
  const button = useRef<HTMLButtonElement>(null);
  // Opened with the button: focus goes into the panel, and comes back to the button when it folds away.
  const byButton = useRef(false);
  const body = useRef<HTMLSpanElement>(null);
  const tip = useRef<HTMLSpanElement>(null);
  const arrow = useRef<HTMLSpanElement>(null);
  const pointing = useRef(false);
  const [eager, setEager] = useState(false);
  const reduce = useReducedMotion();

  // When the panel folds away after the button opened it, focus goes back to the button.
  useEffect(() => {
    if (open || !byButton.current) return;
    byButton.current = false;
    button.current?.focus({ preventScroll: true });
  }, [open]);

  // He pops in, then every few seconds gives a little hop and a wiggle, so the button reads as someone to talk to.
  useLayoutEffect(() => {
    const el = button.current;
    const him = body.current;
    if (!el || !him) return;
    if (reduce) {
      gsap.set(el, { scale: 1, opacity: 1 });
      gsap.set(him, { y: 0, rotation: 0 });
      return;
    }
    // Once in, the inline transform goes, so the button's own hover lift (the toy class) works again.
    gsap.fromTo(el, { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.35, ease: 'back.out(2.2)', onComplete: () => void gsap.set(el, { clearProps: 'transform,opacity' }) });
    // One hop, played from a plain timer: a repeating timeline stays active through its wait and keeps GSAP's ticker awake on every
    // page, while between these hops nothing is running and the ticker sleeps.
    const hop = gsap
      .timeline({ paused: true })
      .to(him, { y: -7, duration: 0.18, ease: 'power2.out' })
      .to(him, { y: 0, duration: 0.32, ease: 'bounce.out' })
      .to(him, { rotation: -10, duration: 0.1, ease: 'sine.inOut' }, '-=0.1')
      .to(him, { rotation: 8, duration: 0.12, ease: 'sine.inOut' })
      .to(him, { rotation: 0, duration: 0.14, ease: 'sine.out' });
    let timer = 0;
    const next = () => {
      hop.restart();
      timer = window.setTimeout(next, 5000 + hop.duration() * 1000);
    };
    timer = window.setTimeout(next, 2000);
    return () => {
      window.clearTimeout(timer);
      hop.kill();
    };
  }, [open, reduce]);

  /**
   * The bubble goes in the empty room by the button (the smart tips' rule, 2026-11-12): above it, its right end level with the
   * button's, unless something is drawn there, then at its left. Until the rule has loaded it keeps its old place above.
   */
  const placeBubble = (m: Geometry) => {
    const t = tip.current;
    const b = button.current;
    if (!t || !b) return;
    t.style.right = 'auto';
    t.style.bottom = 'auto';
    t.style.margin = '0';
    const spot = m.placeTip(
      b,
      t,
      [
        ['top', 'end'],
        ['left', 'center'],
      ],
      t.offsetParent,
    );
    // The little point under the bubble aims at the button only from where it always stood.
    if (arrow.current) arrow.current.hidden = !(spot.side === 'top' && spot.align === 'end');
  };

  /** The bubble by the button, and his jump, when a mouse points at it or the keyboard reaches it. */
  const point = (on: boolean) => {
    setEager(on);
    pointing.current = on;
    const t = tip.current;
    const him = body.current;
    if (!t || !him) return;
    if (on) {
      if (geometry) placeBubble(geometry);
      else
        void loadGeometry().then((m) => {
          if (m && pointing.current) placeBubble(m);
        });
    }
    if (reduce) {
      gsap.set(t, { autoAlpha: on ? 1 : 0, y: 0 });
      return;
    }
    gsap.to(t, { autoAlpha: on ? 1 : 0, y: on ? 0 : 6, duration: 0.2, ease: 'power2.out', overwrite: true });
    if (on) gsap.fromTo(him, { y: 0, scale: 1 }, { y: -6, scale: 1.08, duration: 0.18, ease: 'power2.out', yoyo: true, repeat: 1, overwrite: 'auto' });
  };

  // The bubble and the jump belong to a mouse pointing at the button (or the keyboard reaching it). A phone never gets them on its own: that space is the page's.
  if (!mod?.available || loc.pathname.startsWith('/companion')) return null;
  if (open)
    return (
      <Suspense fallback={null}>
        <AssistantPanel onClose={() => setOpen(false)} focusIn={byButton.current} />
      </Suspense>
    );
  return (
    <div className="fixed right-md bottom-[calc(var(--spacing-xl)+var(--spacing-lg)+env(safe-area-inset-bottom))] lift-over-sticky z-40 md:bottom-md">
      <span
        ref={tip}
        id="assistant-tip"
        role="tooltip"
        className="tip-card pointer-events-none absolute right-0 bottom-full mb-sm whitespace-nowrap rounded-pill border border-line px-sm py-xs text-subhead font-medium shadow-toy-soft"
        style={{ opacity: 0, visibility: 'hidden' }}
      >
        Chat with AI assistant
        <span ref={arrow} aria-hidden="true" className="tip-card absolute top-full right-[22px] -mt-[5px] size-[10px] rotate-45 border-r border-b border-line" />
      </span>
      <button
        ref={button}
        type="button"
        onClick={() => {
          byButton.current = true;
          setOpen(true);
        }}
        onPointerEnter={(e) => {
          loadPanel();
          if (e.pointerType !== 'touch') point(true);
        }}
        onPointerDown={loadPanel}
        onPointerLeave={() => point(false)}
        onFocus={(e) => {
          loadPanel();
          if (e.currentTarget.matches(':focus-visible')) point(true);
        }}
        onBlur={() => point(false)}
        aria-label="Open the assistant"
        aria-describedby="assistant-tip"
        className="toy toy-soft flex size-[60px] items-center justify-center rounded-pill border-2 border-line bg-card"
      >
        <span ref={body} className="flex" aria-hidden="true">
          <Avatar relationship="bumling" size={40} mood={eager ? 'excited' : 'happy'} decorative />
        </span>
      </button>
    </div>
  );
}
