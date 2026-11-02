import { prefersReducedMotion } from './env';

const COLOURS = ['var(--color-r1)', 'var(--color-r2)', 'var(--color-r3)', 'var(--color-r4)', 'var(--color-r5)', 'var(--color-r6)', 'var(--color-r7)'];
const COUNT = 12;
let live = 0;

/**
 * A small burst of confetti dots from the middle of an element (a click's reward). Twelve dots in a fixed layer above the page, each
 * removed when its tween ends; at most two bursts at once. Nothing under reduced motion. GSAP loads the first time it is used.
 */
export function burstFrom(el: Element | null): void {
  if (!el || live >= 2 || prefersReducedMotion()) return;
  const r = el.getBoundingClientRect();
  live++;
  void import('gsap').then(({ default: gsap }) => {
    const layer = document.createElement('div');
    layer.setAttribute('aria-hidden', 'true');
    layer.className = 'fx-burst';
    layer.style.left = `${r.left + r.width / 2}px`;
    layer.style.top = `${r.top + r.height / 2}px`;
    const dots: HTMLElement[] = [];
    for (let i = 0; i < COUNT; i++) {
      const dot = document.createElement('span');
      dot.className = 'fx-burst-dot';
      dot.style.background = COLOURS[i % COLOURS.length] ?? COLOURS[0]!;
      layer.appendChild(dot);
      dots.push(dot);
    }
    document.body.appendChild(layer);
    const done = () => {
      layer.remove();
      live = Math.max(0, live - 1);
    };
    gsap.to(dots, {
      x: (i: number) => Math.cos((i / COUNT) * Math.PI * 2 + 0.3) * (44 + (i % 3) * 14),
      y: (i: number) => Math.sin((i / COUNT) * Math.PI * 2 + 0.3) * (44 + (i % 3) * 14) + 10,
      scale: 0.2,
      opacity: 0,
      duration: 0.7,
      ease: 'power3.out',
      stagger: 0.01,
      onComplete: done,
      onInterrupt: done,
    });
  });
}
