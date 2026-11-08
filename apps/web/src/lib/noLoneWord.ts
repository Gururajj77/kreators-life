import { useEffect, type RefObject } from 'react';

/* No lone last word on a phone or a tablet (the paper beside the sidebar is about as narrow), for the typed paper (an agreement, a document) where CSS cannot do it: the owner's paper is plain
   editable text, so a nowrap span cannot go in, and `text-wrap: balance` gives up past six lines while `pretty` leaves some alone.
   Under the laptop width each clause, list line and heading whose last line holds one word gets a little right padding (from 0.75em up to
   4.5em, the smallest that works) so the word before it comes down too. Only the box narrows: the words, paper and laptops are
   untouched (the padding is a screen-only rule in app.css), and the region being typed in is left as it is until focus leaves. */

const NARROW = 'screen and (max-width: 63.99rem)';
const STEP_EM = 0.75;
const MAX_STEPS = 6;
const PARTS = '.legal-clause, .legal-list li, .legal-sec-h';

/* A word in the text, or an empty blank whose placeholder ("Your content format") is drawn by CSS and reads as words on screen. */
type Word = { node: Text; at: number; len: number } | { box: Element };

function lineTop(range: Range, w: Word, which: 'start' | 'end'): number | null {
  let rects: DOMRect[];
  if ('box' in w) rects = [...w.box.getClientRects()].filter((r) => r.width > 0);
  else {
    range.setStart(w.node, w.at);
    range.setEnd(w.node, w.at + w.len);
    rects = [...range.getClientRects()].filter((r) => r.width > 0);
  }
  const r = which === 'start' ? rects[0] : rects.at(-1);
  return r ? Math.round(r.top) : null;
}

/* The last line holds one word when it does not also hold the start of the word before it. A word broken at its hyphen ("short-" /
   "form consumption.") counts as alone too, since the founder reads that as half a word left behind. */
function endsAlone(el: HTMLElement): boolean {
  const words: Word[] = [];
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    if (n instanceof Element) {
      if (n.matches('.paper-var [data-empty][data-placeholder]:not([data-placeholder=""])')) words.push({ box: n });
      continue;
    }
    const node = n as Text;
    for (const m of node.data.matchAll(/\S+/g)) words.push({ node, at: m.index ?? 0, len: m[0].length });
  }
  const first = words[0];
  const last = words.at(-1);
  const before = words.at(-2);
  if (!first || !last || !before) return false;
  const range = document.createRange();
  const top = lineTop(range, first, 'start');
  const end = lineTop(range, last, 'end');
  // A blank's placeholder can wrap inside itself; its last piece on the last line is enough.
  const prev = lineTop(range, before, 'box' in before ? 'end' : 'start');
  if (top === null || end === null || prev === null) return false;
  return Math.abs(end - top) > 2 && Math.abs(end - prev) > 2;
}

export function useNoLoneWord(ref: RefObject<HTMLElement | null>, on: boolean) {
  useEffect(() => {
    const root = ref.current;
    if (!root || !on || typeof ResizeObserver === 'undefined') return;
    const narrow = window.matchMedia(NARROW);
    let frame = 0;
    const run = () => {
      frame = 0;
      for (const el of root.querySelectorAll<HTMLElement>(PARTS)) {
        if (el.contains(document.activeElement)) continue;
        delete el.dataset.loneTrim;
        el.style.removeProperty('--lone-trim');
        if (!narrow.matches || !endsAlone(el)) continue;
        let fixed = false;
        for (let step = 1; step <= MAX_STEPS && !fixed; step += 1) {
          el.dataset.loneTrim = '';
          el.style.setProperty('--lone-trim', `${step * STEP_EM}em`);
          fixed = !endsAlone(el);
        }
        if (!fixed) {
          delete el.dataset.loneTrim;
          el.style.removeProperty('--lone-trim');
        }
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(run);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(root);
    narrow.addEventListener('change', schedule);
    root.addEventListener('focusout', schedule);
    void document.fonts?.ready.then(schedule);
    schedule();
    return () => {
      observer.disconnect();
      narrow.removeEventListener('change', schedule);
      root.removeEventListener('focusout', schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [ref, on]);
}
