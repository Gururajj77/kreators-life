import gsap from 'gsap';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { prefersReducedMotion, useRunning } from './env';

/** How long each phrase stays before the next fades in. */
const PHRASE_MS = 2400;

/** "12 s", then "1 min 5 s": time passing, in words a glance reads. */
export function elapsedLabel(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return rest ? `${m} min ${rest} s` : `${m} min`;
}

/**
 * A line that says a long job is alive: a short phrase about what the job does, with a soft band of light passing
 * over it, and the seconds since it began. Learned from the AI typing indicators and loading buttons in UI kits,
 * built here: the phrase is drawn twice, the bright copy inside a narrow window that GSAP slides across with
 * transform alone (the copy inside slides back by the same amount, so the letters stay put and only the light
 * moves). The phrases fade from one to the next every few seconds; with `loop` off they stop on the last one, for
 * a job whose steps come in order. Screen readers hear `label` once (role=status); the moving parts are hidden
 * from them. The sweep and the phrases run only while the line is on screen and the tab is visible (`useRunning`);
 * reduced motion holds the first phrase still and only the seconds change.
 */
export function WorkingLine({ label, phrases, since, loop = true, className = '' }: { label: string; phrases: readonly string[]; since?: number; loop?: boolean; className?: string }) {
  const root = useRef<HTMLSpanElement>(null);
  const wrap = useRef<HTMLSpanElement>(null);
  const win = useRef<HTMLSpanElement>(null);
  const bright = useRef<HTMLSpanElement>(null);
  const running = useRunning(root);
  const [start] = useState(() => since ?? Date.now());
  const begin = since ?? start;
  const [now, setNow] = useState(() => Date.now());
  const [idx, setIdx] = useState(0);
  const [still, setStill] = useState(prefersReducedMotion);
  const list = phrases.length ? phrases : [label];
  const phrase = list[Math.min(idx, list.length - 1)]!;

  // A setting can change while the page is open.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setStill(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  // The seconds, worked out from the start each time, so a pause off screen never loses any.
  useEffect(() => {
    setNow(Date.now());
    if (!running) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [running]);

  // The next phrase: the old one fades out, the new one fades in (below).
  useEffect(() => {
    if (!running || still || list.length < 2) return;
    if (!loop && idx >= list.length - 1) return;
    let fade: gsap.core.Tween | null = null;
    const t = window.setTimeout(() => {
      const el = wrap.current;
      const next = () => setIdx((i) => (loop ? (i + 1) % list.length : Math.min(i + 1, list.length - 1)));
      if (!el) return next();
      fade = gsap.to(el, { opacity: 0, duration: 0.2, ease: 'power1.in', onComplete: next });
    }, PHRASE_MS);
    return () => {
      window.clearTimeout(t);
      // A fade cut short (the line left the screen, or the job ended) never leaves the words half drawn.
      if (fade?.isActive()) {
        fade.kill();
        if (wrap.current) gsap.set(wrap.current, { opacity: 1 });
      }
    };
  }, [running, still, loop, idx, list.length]);

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    if (still) gsap.set(el, { opacity: 1 });
    else gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power1.out' });
  }, [idx, still]);

  // The band of light: the window crosses the phrase, the bright copy inside it holds still against the page.
  useLayoutEffect(() => {
    const w = wrap.current;
    const b = win.current;
    const c = bright.current;
    if (!w || !b || !c) return;
    if (still || !running) {
      gsap.set(b, { opacity: 0, x: 0 });
      gsap.set(c, { x: 0 });
      return;
    }
    const width = w.offsetWidth;
    const band = Math.max(32, Math.round(width * 0.4));
    gsap.set(b, { opacity: 1, width: band });
    const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.5 });
    tl.fromTo(b, { x: -band }, { x: width, duration: 1.6, ease: 'sine.inOut' }, 0);
    tl.fromTo(c, { x: band }, { x: -width, duration: 1.6, ease: 'sine.inOut' }, 0);
    return () => {
      tl.kill();
    };
  }, [still, running, phrase]);

  return (
    <span ref={root} role="status" className={`inline-flex min-w-0 items-baseline gap-xs text-subhead ${className}`}>
      <span className="sr-only">{label}</span>
      <span ref={wrap} aria-hidden="true" className="relative inline-block min-w-0 overflow-hidden whitespace-nowrap align-bottom text-ink-soft">
        {phrase}…
        <span ref={win} className="pointer-events-none absolute inset-y-0 left-0 overflow-hidden opacity-0" style={{ maskImage: 'linear-gradient(90deg, transparent, black 35%, black 65%, transparent)', WebkitMaskImage: 'linear-gradient(90deg, transparent, black 35%, black 65%, transparent)' }}>
          <span ref={bright} className="absolute inset-y-0 left-0 whitespace-nowrap text-ink">
            {phrase}…
          </span>
        </span>
      </span>
      <span aria-hidden="true" className="shrink-0 tabular-nums text-caption text-ink-mute">
        {elapsedLabel((now - begin) / 1000)}
      </span>
    </span>
  );
}
