/* Every block of text reads as a rectangle (the founder, 2026-11-05: "keep all text boxes look like rectangles, not long lines followed
   by short one"). CSS balances every block of up to about six lines (`text-wrap: balance` on html in app.css); a longer block, or a
   short one whose words still fall unevenly, gets here. For each block with a line under RATIO of the widest line above it (since the
   last break made on purpose, so a slow taper counts as much as one short last line), this tries, widest first (the founder,
   2026-11-06: "rectangles can be wider"): the other wrapping at full width (plain for a balanced block, `pretty` for a long one); then
   the first line held shorter so the lines grow going down (the founder's other shape), which leaves the rest of the block at full
   width; then one more line at full width, never ending on one word; and only then a little more padding on the side the text runs out
   to (a few pixels at a time, never past MAX_TRIM, about 6% of its width), alone, with a first line held short, and with one more line.
   Whatever the shape, its widest line never ends up more than MAX_TRIM narrower than the block's widest line was (`wide`), so a fixed
   block keeps its width; only when no such shape makes a rectangle does it go on to the balanced wrap and up to FALLBACK_TRIM (15%)
   narrower, and last of all to the balanced wrap and the lines that grow at any width, since the rectangle comes first and width
   second; all of it inside the same sliced, MAX_TRIES-bounded search. It keeps the first shape that holds, else the best one with the same lines, else nothing. Only the inside of
   the box changes: its outer size, the words and printed paper are untouched. scripts/smoke/rag-probe.js measures the same way and is
   the check. Downloaded after the first paint (Root in App.tsx). */

const RATIO = 0.8;
/** What a fixed block aims for: a little over RATIO, so a line the probe rounds to the pixel still holds. */
const AIM = RATIO + 0.01;
/** The most a block may narrow: the extra side padding, and how much its widest line may lose against the widest line it had (was 0.15,
    which left blocks looking narrow; 2026-11-06). */
const MAX_TRIM = 0.06;
/** The rectangle comes first: when no shape within MAX_TRIM evens a block out (a two-line paragraph that ends on a stub), the search goes
    on with the balanced wrap and up to FALLBACK_TRIM narrower, the width it had before 2026-11-06, rather than leave the stub. */
const FALLBACK_TRIM = 0.15;
/** How much shorter than the rest a first line held short on purpose may be. */
const MAX_FIRST = 0.5;
/** The shortest a first line held short may end up against the line under it: under half, it reads as a stub ("A curated / membership
    with…", "Sleep, / movement and breath."), not as lines that grow. */
const FIRST_FLOOR = 0.5;
/** One block's search runs in slices of SLICE ms between idle moments (the block shown as it was in between), MAX_TRIES shapes at most. */
const SLICE = 8;
const MAX_TRIES = 900;
/** Paper that must match the founder's PDF line for line, what is being typed in, code, and what is not seen. */
const SKIP = '.legal-doc, .legal-root, .legal-invoice, .print-doc, .month-print-sheet, [contenteditable]:not([contenteditable="false"]), pre, code, svg, .sr-only, input, textarea, select, script, style';
/** A line that ends on purpose after one of these (a <br>, or the end of an inline-block) may be followed by a shorter one. */
const ENDS = /[,.;:?!…][”’"')\]]*$/;
/** A first line held short never ends on one of these small words ("What you, as an / admin", "Step three: the / scorecard"): the break
    would cut a phrase in two. */
const SMALL = /^(a|an|the|to|as|of|your|my|our|their|his|her|its)$/i;
const BLOCK = /^(block|list-item|flow-root|table-cell)$/;
const INLINE = /^(inline|contents|inline-block)$/;

type Line = { left: number; right: number; top: number; bottom: number; last: string; words: number; seq: number; node: Text | null; hard: boolean; typed: boolean };
type Kept = { start: string; end: string; wrap: string; max: string };
type Shape = { trim: number; wrap: string; first: number; extra: boolean };

const range = typeof document === 'undefined' ? null : document.createRange();

/** Out of the flow (absolute or fixed, as a screen-reader-only label is): its words sit elsewhere and never share the block's lines. */
function aside(cs: CSSStyleDeclaration): boolean {
  return cs.position === 'absolute' || cs.position === 'fixed';
}

/** The block's lines, in reading order, from its words' rects (a word broken over two lines gives one rect on each); words inside `out`
    are not the block's. */
function linesOf(el: HTMLElement, keepsNewLines: boolean, out: Element[]): Line[] {
  const lines: Line[] = [];
  let cur: Line | null = null;
  let seq = 0;
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    if (n instanceof Element) {
      if (n.tagName === 'BR' && cur) cur.hard = true;
      continue;
    }
    const node = n as Text;
    if (node.parentElement?.closest(SKIP) || out.some((o) => o.contains(node))) continue;
    let prevEnd = 0;
    for (const m of node.data.matchAll(/\S+/g)) {
      seq += 1;
      const at = m.index ?? 0;
      if (keepsNewLines && cur && node.data.slice(prevEnd, at).includes('\n')) {
        cur.hard = true;
        cur.typed = true;
      }
      prevEnd = at + m[0].length;
      range!.setStart(node, at);
      range!.setEnd(node, prevEnd);
      for (const r of range!.getClientRects()) {
        if (r.width <= 0 || r.height <= 0) continue;
        const mid = (r.top + r.bottom) / 2;
        if (cur && mid >= cur.top - 1 && mid <= cur.bottom + 1) {
          cur.left = Math.min(cur.left, r.left);
          cur.right = Math.max(cur.right, r.right);
          cur.top = Math.min(cur.top, r.top);
          cur.bottom = Math.max(cur.bottom, r.bottom);
        } else {
          cur = { left: r.left, right: r.right, top: r.top, bottom: r.bottom, last: '', words: 0, seq: -1, node: null, hard: false, typed: false };
          lines.push(cur);
        }
        if (cur.seq !== seq) cur.words += 1;
        cur.seq = seq;
        cur.last = m[0];
        cur.node = node;
      }
    }
  }
  // A line that ends where an inline-block ends (a phrase kept whole on purpose) ends on purpose too.
  for (const line of lines) {
    if (line.hard || !line.node) continue;
    for (let e = line.node.parentElement; e && e !== el; e = e.parentElement) {
      const d = getComputedStyle(e).display;
      if (d !== 'inline-block' && d !== 'inline-flex') continue;
      range!.setStart(line.node, line.node.data.length);
      range!.setEnd(e, e.childNodes.length);
      if (!/\S/.test(range!.toString())) line.hard = true;
      break;
    }
  }
  return lines;
}

/** The worst share a line has of the widest line above it since the last break made on purpose (a line after one starts the count
    again); 1 when even. The same rule as the probe. */
function worst(lines: Line[]): number {
  let low = 1;
  let widest = 0;
  lines.forEach((line, i) => {
    const w = line.right - line.left;
    const above = lines[i - 1];
    if (!above || (above.hard && (above.typed || ENDS.test(above.last)))) {
      widest = w;
      return;
    }
    if (widest > 0) low = Math.min(low, w / widest);
    widest = Math.max(widest, w);
  });
  return low;
}

/** True when the block's text fits on one line: the cheap test before any word is measured. */
function oneLine(el: HTMLElement): boolean {
  range!.selectNodeContents(el);
  let top = Infinity;
  let bottom = -Infinity;
  let tall = 0;
  for (const r of range!.getClientRects()) {
    if (r.width <= 0) continue;
    top = Math.min(top, r.top);
    bottom = Math.max(bottom, r.bottom);
    tall = Math.max(tall, r.height);
  }
  return !tall || bottom - top < tall * 1.6;
}

export function startRectText(): () => void {
  if (typeof window === 'undefined' || !range || !('ResizeObserver' in window)) return () => {};
  let done = new WeakMap<HTMLElement, string>();
  const kept = new WeakMap<HTMLElement, Kept>();
  /** The shape each block was left in: tried first when it is measured again (a theme change, the fonts arriving), so a block that still
      holds keeps its shape and is never shown back in its uneven one while the search runs. */
  const shapeOf = new WeakMap<HTMLElement, Shape>();
  let timer = 0;
  let idle = 0;
  let queue: HTMLElement[] = [];
  let active: Generator<void, void, void> | null = null;

  const reset = (el: HTMLElement) => {
    const was = kept.get(el);
    if (!was) return;
    el.style.paddingInlineStart = was.start;
    el.style.paddingInlineEnd = was.end;
    el.style.setProperty('text-wrap', was.wrap);
    el.style.maxInlineSize = was.max;
    el.style.removeProperty('--rect-first');
    delete el.dataset.rect;
    delete el.dataset.rectFirst;
    kept.delete(el);
  };

  /** The blocks that hold text of their own and no other block, like the probe's. */
  const blocks = (): HTMLElement[] => {
    const found = new Set<HTMLElement>();
    const owner = new Map<Element, HTMLElement | null>();
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      const t = n as Text;
      const parent = t.parentElement;
      if (!parent || !/\S/.test(t.data)) continue;
      let block = owner.get(parent);
      if (block === undefined) {
        block = null;
        for (let e: HTMLElement | null = parent; e && e !== document.body; e = e.parentElement) {
          const d = getComputedStyle(e).display;
          if (BLOCK.test(d)) {
            block = e;
            break;
          }
          // Text straight inside a flex, grid or table box sits in an anonymous block of its own, which no style reaches: left alone
          // here, and wrapped in a span of its own where it wraps (rag-probe.js measures it).
          if (!INLINE.test(d)) break;
        }
        owner.set(parent, block);
      }
      if (block) found.add(block);
    }
    return [...found].filter((el) => !el.closest(SKIP));
  };

  /** Evens out one block. A generator: it stops for the page every SLICE ms and goes on in the next idle moment. */
  function* fixing(el: HTMLElement): Generator<void, void, void> {
    if (!el.isConnected) return;
    const cs = getComputedStyle(el);
    if (cs.whiteSpace === 'nowrap' || cs.whiteSpace === 'pre' || cs.visibility === 'hidden' || (cs.webkitLineClamp && cs.webkitLineClamp !== 'none')) return;
    const text = el.textContent ?? '';
    // What the block's lines depend on: the room around it (never its own width, which a shape below may pin), its words and its type.
    const key = `${window.innerWidth}|${el.parentElement?.clientWidth}|${text.length}|${text.slice(0, 40)}|${cs.fontWeight}|${cs.fontSize}`;
    if (done.get(el) === key) return;
    reset(el);
    const width = el.offsetWidth;
    // Hidden for now (a folded section, a closed tab): measured once it shows.
    if (!width) return;
    done.set(el, key);
    if (text.trim().split(/\s+/).length < 3 || oneLine(el)) return;
    // Only a block that holds no other: a child with no words, a picture or one out of the flow (a screen-reader-only label) does not count.
    const out: Element[] = [];
    for (const d of el.querySelectorAll('*')) {
      if (out.some((o) => o.contains(d))) continue;
      const dcs = getComputedStyle(d);
      if (aside(dcs)) out.push(d);
      else if (BLOCK.test(dcs.display) && d.tagName !== 'svg' && d.tagName !== 'IMG' && !d.closest('svg') && /\S/.test(d.textContent ?? '')) return;
    }
    const keepsNewLines = /^(pre-wrap|pre-line|break-spaces)$/.test(cs.whiteSpace);
    const lines = linesOf(el, keepsNewLines, out);
    if (lines.length < 2) return;
    const base = worst(lines);
    if (base >= AIM) return;
    const widest = Math.max(...lines.map((l) => l.right - l.left));
    /** How much a shape may narrow the block: MAX_TRIM first, FALLBACK_TRIM once no wide shape holds. */
    let cap = MAX_TRIM;
    /** A shape's widest line may lose at most `cap` of the block's widest line (a pixel spare for rounding), so it stays wide. */
    const wide = (now: Line[]) => Math.max(...now.map((l) => l.right - l.left)) >= widest * (1 - cap) - 1;
    const was: Kept = { start: el.style.paddingInlineStart, end: el.style.paddingInlineEnd, wrap: el.style.getPropertyValue('text-wrap'), max: el.style.maxInlineSize };
    const start = parseFloat(cs.paddingInlineStart) || 0;
    const end = parseFloat(cs.paddingInlineEnd) || 0;
    const align = cs.textAlign;
    const toStart = align === 'right' || align === 'end';
    const inner = width - start - end;
    const step = Math.min(6, Math.max(2, inner * 0.005));
    const other = lines.length > 6 ? 'pretty' : 'wrap';
    const put = ({ trim, wrap, first }: Shape) => {
      const half = align === 'center' ? trim / 2 : 0;
      el.style.paddingInlineStart = `${start + (toStart ? trim : half)}px`;
      el.style.paddingInlineEnd = `${end + (toStart ? 0 : align === 'center' ? half : trim)}px`;
      el.style.setProperty('text-wrap', wrap);
      if (first) {
        el.dataset.rectFirst = toStart ? 'start' : align === 'center' ? 'center' : 'end';
        el.style.setProperty('--rect-first', `${first}px`);
      } else {
        delete el.dataset.rectFirst;
        el.style.removeProperty('--rect-first');
      }
    };
    kept.set(el, was);
    let best: Shape & { score: number } = { score: base, trim: 0, wrap: '', first: 0, extra: false };
    // A shape keeps the block's number of lines (a long one may take one more), so nothing below it moves. An `extra` shape may take one
    // more line still, as long as the last line is not one word.
    const most = lines.length + (lines.length >= 5 ? 1 : 0);
    /** Tries one shape; true when it holds. */
    const holds = (shape: Shape): boolean => {
      put(shape);
      // A box sized to its words would grow with the padding: held at the width it had, so only its inside narrows.
      if (el.offsetWidth !== width) {
        el.style.maxInlineSize = `${width}px`;
        if (el.offsetWidth !== width) return false;
      }
      const now = linesOf(el, keepsNewLines, out);
      if (now.length < lines.length) return false;
      // Never narrower than `cap` under the width the block had (a balanced spread over one more line would otherwise shrink it).
      if (!wide(now)) return false;
      // A first line held short must still read as a line, not a stub.
      const [one, two] = now;
      // (A label that ends on a colon, "Essentials:" over the rest, is a break on purpose, not a stub.)
      if (shape.first && one && two && !/:[”’"')\]]*$/.test(one.last) && one.right - one.left < (two.right - two.left) * FIRST_FLOOR) return false;
      // ... and it ends where a phrase can end, never on a small word ("What you, as an / admin", "Step three: the / scorecard").
      if (shape.first && one && !ENDS.test(one.last) && SMALL.test(one.last.replace(/[^\p{L}]/gu, ''))) return false;
      // Never a short word alone on a line ("To" over the rest), which reads worse than the short line it would mend; a word that ends
      // at a comma or a full stop ("Sleep," over the rest) is a break the founder asked for.
      if (now.some((l) => l.words < 2 && l.right - l.left < inner * 0.25 && !ENDS.test(l.last))) return false;
      if (now.length > most) return shape.extra && now.length <= most + 1 && now.at(-1)!.words >= 2 && worst(now) >= AIM;
      const score = worst(now);
      if (score > best.score + 0.001) best = { ...shape, score };
      return score >= AIM;
    };
    // The first line held shorter needs the ::before in app.css free (centred text also takes as much indent, so it stays centred).
    const free = /^(none|normal)$/.test(getComputedStyle(el, '::before').content);
    const firstMost = inner * (align === 'center' ? MAX_FIRST / 2 : MAX_FIRST);

    /** The shapes at full width (no padding added), in the order they are tried. */
    function* fullWidth(extra: boolean): Generator<Shape> {
      // The other wrapping (the block's own at full width is the shape it already has).
      yield { trim: 0, wrap: other, first: 0, extra };
      if (!free) return;
      // Lines that grow going down, so a short block such as "No streak yet. / Today can be day one." breaks early; every line under the
      // first keeps the full width.
      for (let first = step; first <= firstMost; first += step) yield { trim: 0, wrap: 'wrap', first, extra };
    }
    /** The shapes that narrow the inside, never past `cap`: alone with either wrapping, then with a first line held short. */
    function* narrower(extra: boolean): Generator<Shape> {
      const trimMost = inner * cap;
      for (let trim = step; trim <= trimMost; trim += step) for (const wrap of ['', other]) yield { trim, wrap, first: 0, extra };
      if (!free) return;
      for (let first = inner * 0.03; first <= firstMost; first += inner * 0.03) {
        for (let trim = inner * 0.015; trim <= trimMost; trim += inner * 0.015) yield { trim, wrap: 'wrap', first, extra };
      }
    }
    /** Every shape, widest first: full width with the same lines, full width with one more line, then a little narrower each way; and
        only when none of those makes a rectangle, the balanced wrap and up to FALLBACK_TRIM narrower (a rectangle before width). */
    function* shapes(): Generator<Shape> {
      yield* fullWidth(false);
      yield* fullWidth(true);
      yield* narrower(false);
      yield* narrower(true);
      cap = FALLBACK_TRIM;
      yield { trim: 0, wrap: 'balance', first: 0, extra: false };
      yield* narrower(false);
      yield* narrower(true);
    }
    /** Last of all, a rectangle at any width: the balanced wrap, then the lines that grow, with no cap. A two-line block that ends on a
        stub ("We do not sell … on other / sites.", "Riya ran a free editing workshop, / so the team thanks her.") has no even shape
        within FALLBACK_TRIM, and the rectangle comes before the width (Text is a rectangle, CLAUDE.md). It runs in the same sliced
        loop as the rest, so no block measures in one long task, and is tried even when the shapes above used up MAX_TRIES. */
    function* lastResort(): Generator<Shape> {
      cap = 1;
      yield { trim: 0, wrap: 'balance', first: 0, extra: false };
      yield* fullWidth(false);
    }
    let found: Shape | null = null;
    let finished = false;
    const prior = shapeOf.get(el);
    shapeOf.delete(el);
    /** The shape the block was left in, then every other. */
    function* thenAll(first: Shape): Generator<Shape> {
      yield first;
      yield* shapes();
    }
    try {
      let tries = 0;
      let until = performance.now() + SLICE;
      /** The main search, MAX_TRIES shapes at most, then the last resort's few shapes; one slice clock for both. */
      function* all(): Generator<Shape> {
        for (const shape of prior ? thenAll(prior) : shapes()) {
          yield shape;
          if ((tries += 1) >= MAX_TRIES) break;
        }
        yield* lastResort();
      }
      for (const shape of all()) {
        if (holds(shape)) {
          found = shape;
          break;
        }
        if (performance.now() > until) {
          // The page gets its turn, with the block shown in its best shape so far; on the way back the block must still be the same.
          put(best);
          yield;
          if (!el.isConnected || done.get(el) !== key || el.offsetWidth !== width) return;
          until = performance.now() + SLICE;
        }
      }
      finished = true;
    } finally {
      // Stopped half way (a new run took over): leave the block in the shape it had, and measure it again next time.
      if (!finished) {
        done.delete(el);
        if (prior) {
          put(prior);
          shapeOf.set(el, prior);
        } else reset(el);
      }
    }
    if (!found && best.score <= base + 0.001) {
      reset(el);
      return;
    }
    put(found ?? best);
    el.dataset.rect = '';
    if (el.offsetWidth !== width) reset(el);
    else shapeOf.set(el, found ?? best);
  }

  const work = (deadline?: IdleDeadline) => {
    idle = 0;
    // One slice a call, never the whole idle period (that made 50 ms tasks on a long page); a callback that came on its timeout has no
    // time left by the browser's count but still takes its slice, or it would never get anywhere.
    const budget = deadline && !deadline.didTimeout ? Math.min(SLICE, deadline.timeRemaining()) : SLICE;
    const until = performance.now() + budget;
    while (performance.now() < until) {
      if (!active) {
        const el = queue.shift();
        if (!el) break;
        active = fixing(el);
      }
      if (active.next().done) active = null;
    }
    if (active || queue.length) later();
    else delete document.documentElement.dataset.rectBusy;
  };
  const later = () => {
    if (idle) return;
    idle = typeof requestIdleCallback === 'function' ? requestIdleCallback(work, { timeout: 600 }) : window.setTimeout(work, 50);
  };
  const run = () => {
    timer = 0;
    active?.return();
    active = null;
    queue = blocks();
    // Busy until every block had its turn: the screenshot probes wait for it (scripts/smoke/shoot.mjs).
    document.documentElement.dataset.rectBusy = '';
    later();
  };
  /** Changes come in bursts (a page arriving, a sheet opening): wait for the burst to end, then measure once. */
  const schedule = () => {
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(run, 180);
    // Busy from the first change, not only once the wait is over, so a probe never measures in between.
    document.documentElement.dataset.rectBusy = '';
  };
  const again = () => {
    done = new WeakMap();
    schedule();
  };

  // New words, and things that show or hide (a fold, a tab, a sheet); never the style this file sets, so its own work starts nothing.
  // A ticking clock (the focus pill, its sidebar dot, the Mindful panel's dial) is marked data-rect-quiet: its second-by-second
  // changes hold no words to balance, so they never start a pass over the whole page.
  const ticking = (r: MutationRecord) => {
    const el = r.target instanceof Element ? r.target : r.target.parentElement;
    return !!el?.closest('[data-rect-quiet]');
  };
  const changes = new MutationObserver((records) => {
    if (records.every(ticking)) return;
    schedule();
  });
  changes.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'hidden', 'open', 'aria-expanded'] });
  // The theme changes the weights on dark surfaces, and so the width of every word.
  const theme = new MutationObserver(again);
  theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'data-nav'] });
  // Only a change of width: a shape that adds a line makes the page taller, and that must not start the search again.
  let wide = 0;
  const sizes = new ResizeObserver((entries) => {
    const w = Math.round(entries[0]?.contentRect.width ?? 0);
    if (w === wide) return;
    wide = w;
    schedule();
  });
  sizes.observe(document.documentElement);
  const dark = window.matchMedia('(prefers-color-scheme: dark)');
  dark.addEventListener('change', again);
  void document.fonts?.ready.then(again);
  schedule();
  return () => {
    changes.disconnect();
    theme.disconnect();
    sizes.disconnect();
    dark.removeEventListener('change', again);
    if (timer) window.clearTimeout(timer);
    if (idle && typeof cancelIdleCallback === 'function') cancelIdleCallback(idle);
    else if (idle) window.clearTimeout(idle);
    active?.return();
    queue = [];
    delete document.documentElement.dataset.rectBusy;
  };
}
