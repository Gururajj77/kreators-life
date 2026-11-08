// A probeFile for shoot.mjs (SHOOT_PROBE=scripts/smoke/contrast-probe.js).
// Evaluated in the page: walks every visible text node and every placeholder, composites its colour onto the real
// background behind it (walking up through translucent layers, then onto the page's own wash of glows, at the
// worst place that text can scroll to), and returns everything under WCAG 2.2 AA: 4.5:1 for text under 24px (or
// under 18.66px bold), 3:1 for larger text. A disabled control is exempt in WCAG; it is listed only under 3:1 so it stays legible.
// Anything fixed or sticky that carries text on a fill thinner than 88% is listed too.
(() => {
  const AA = 4.5;
  const AA_LARGE = 3;
  // A canvas turns any colour the browser can draw (color(), oklab, color-mix) into plain rgba.
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const parse = (css) => {
    if (!css || css === 'transparent') return null;
    const m = css.match(/^rgba?\(([^)]+)\)$/);
    if (m) {
      const [r, g, b, a = '1'] = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
      return { r, g, b, a: Number.isFinite(a) ? a : 1 };
    }
    if (!ctx) return null;
    // Draw it over white and over black: the difference gives the alpha, the black pass gives the colour.
    const draw = (under) => {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = under;
      ctx.fillRect(0, 0, 1, 1);
      ctx.fillStyle = '#010203';
      ctx.fillStyle = css;
      if (ctx.fillStyle === '#010203' && !/#010203/.test(css)) return null;
      ctx.fillRect(0, 0, 1, 1);
      return ctx.getImageData(0, 0, 1, 1).data;
    };
    const w = draw('#ffffff');
    const k = draw('#000000');
    if (!w || !k) return null;
    const alpha = Math.min(1, Math.max(0, 1 - ((w[0] - k[0]) + (w[1] - k[1]) + (w[2] - k[2])) / (3 * 255)));
    if (alpha < 0.004) return { r: 0, g: 0, b: 0, a: 0 };
    const clamp = (v) => Math.min(255, Math.max(0, v / alpha));
    return { r: clamp(k[0]), g: clamp(k[1]), b: clamp(k[2]), a: alpha };
  };
  const over = (top, under) => {
    const a = top.a + under.a * (1 - top.a);
    if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
    const mix = (t, u) => (t * top.a + u * under.a * (1 - top.a)) / a;
    return { r: mix(top.r, under.r), g: mix(top.g, under.g), b: mix(top.b, under.b), a };
  };
  const lum = ({ r, g, b }) => {
    const f = (c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  const hex = ({ r, g, b }) => `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
  const where = (el) => {
    const parts = [];
    for (let e = el; e && e !== document.body && parts.length < 4; e = e.parentElement) {
      const cls = typeof e.className === 'string' ? e.className.split(/\s+/).filter(Boolean).slice(0, 3).join('.') : '';
      parts.unshift(e.tagName.toLowerCase() + (e.id ? `#${e.id}` : '') + (cls ? `.${cls}` : ''));
    }
    return parts.join(' > ');
  };
  // The page is a wash: four radial glows and a linear base, fixed to the screen (body::before in app.css). A glass card is translucent
  // over it, so text on a card is judged against the wash too. Text scrolls through the whole viewport, so the worst place counts.
  const rootStyle = getComputedStyle(document.documentElement);
  const token = (name) => parse(rootStyle.getPropertyValue(name).trim());
  const GLOWS = [
    { c: token('--glow-1'), x: 0.06, y: -0.06, rx: 60, ry: 42 },
    { c: token('--glow-3'), x: 1.04, y: 0.06, rx: 52, ry: 40 },
    { c: token('--glow-2'), x: 0.82, y: 1.08, rx: 56, ry: 44 },
    { c: token('--glow-4'), x: -0.04, y: 0.96, rx: 44, ry: 36 },
  ];
  const baseA = token('--page-base-a') ?? { r: 255, g: 255, b: 255, a: 1 };
  const baseB = token('--page-base-b') ?? baseA;
  const remPx = parseFloat(rootStyle.fontSize) || 16;
  const washAt = (x, y) => {
    const W = window.innerWidth;
    const H = window.innerHeight;
    // 165deg linear base: mostly top to bottom, a little left to right.
    const t = Math.min(1, Math.max(0, (y / H) * 0.9 + (x / W) * 0.1));
    let acc = { r: baseA.r + (baseB.r - baseA.r) * t, g: baseA.g + (baseB.g - baseA.g) * t, b: baseA.b + (baseB.b - baseA.b) * t, a: 1 };
    // Painted first to last on top of each other, the last glow in the list is the bottom layer.
    for (const g of [...GLOWS].reverse()) {
      if (!g.c) continue;
      const dx = (x - g.x * W) / (g.rx * remPx);
      const dy = (y - g.y * H) / (g.ry * remPx);
      const d = Math.hypot(dx, dy) / 0.62;
      if (d >= 1) continue;
      acc = over({ ...g.c, a: g.c.a * (1 - d) }, acc);
    }
    return acc;
  };
  // Background behind an element: its own background colour over everything above it, until opaque. Returns the translucent
  // stack (so it can be laid over several places on the wash) and whether an image sits in it.
  const stackOf = (el) => {
    let acc = { r: 0, g: 0, b: 0, a: 0 };
    let images = false;
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      // html carries only the base colour the wash is drawn over, so it stops the walk: the wash itself is worked out in washAt.
      const cs = getComputedStyle(e);
      let bg = parse(cs.backgroundColor);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') {
        images = true;
        // A fill that is only a gradient (a hero, a coloured card): read its first colour stop, the lightest end, as the worst case for white text.
        if (!(bg && bg.a > 0) && /gradient/.test(cs.backgroundImage)) {
          // The first stop that is mostly opaque: a soft white glow layered on top does not count as the fill.
          const stops = cs.backgroundImage.match(/(?:rgba?|color|oklab|oklch)\([^)]*\)/g) ?? [];
          for (const t of stops) {
            const c = parse(t);
            if (c && c.a > 0.5) {
              bg = c;
              break;
            }
          }
        }
      }
      if (bg && bg.a > 0) {
        acc = over(acc, bg);
        if (acc.a >= 0.999) return { stack: acc, images };
      }
    }
    return { stack: acc, images };
  };
  const opacityOf = (el) => {
    let o = 1;
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) o *= Number(getComputedStyle(e).opacity);
    return o;
  };
  // Text inside a drawn chart is scaled by its viewBox, so its size on screen is the font size times the scale.
  const sizeOf = (el, cs) => {
    const px = parseFloat(cs.fontSize);
    if (el instanceof SVGElement && typeof el.getScreenCTM === 'function') {
      const m = el.getScreenCTM();
      if (m) return px * Math.hypot(m.a, m.b);
    }
    return px;
  };
  const isLarge = (el, cs) => {
    const px = sizeOf(el, cs);
    const bold = Number(cs.fontWeight) >= 700;
    return px >= 24 || (px >= 18.66 && bold);
  };
  // The worst ratio of this colour over this stack, across the places the text can sit on the wash.
  const worst = (fg, el, stack, rect) => {
    const W = window.innerWidth;
    const H = window.innerHeight;
    if (stack.a >= 0.999) {
      const f = fg.a < 1 ? over(fg, stack) : fg;
      return { ratio: ratio(f, stack), bg: stack, fg: f };
    }
    let out = null;
    const xs = [Math.max(0, rect.left), Math.min(W, Math.max(0, rect.left + rect.width / 2)), Math.min(W, rect.right)];
    for (const x of xs) {
      for (const y of [0.05 * H, 0.3 * H, 0.55 * H, 0.8 * H, 0.97 * H]) {
        const bg = over(stack, washAt(x, y));
        const f = fg.a < 1 ? over(fg, bg) : fg;
        const r = ratio(f, bg);
        if (!out || r < out.ratio) out = { ratio: r, bg, fg: f };
      }
    }
    return out;
  };
  const hits = [];
  const seen = new Set();
  // Anything fixed or sticky that carries text has to be solid enough to read over whatever scrolls under it.
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
    if (cs.visibility === 'hidden' || cs.display === 'none' || el.getBoundingClientRect().width < 24) continue;
    if (!(el.textContent ?? '').trim()) continue;
    const bg = parse(cs.backgroundColor);
    const image = cs.backgroundImage && cs.backgroundImage !== 'none';
    // A fade or a wrapper with no fill of its own is fine when its children carry the fill; flag a fill that is there but thin.
    if (bg && bg.a > 0.02 && bg.a < 0.88 && !image) hits.push({ text: (el.textContent ?? '').trim().slice(0, 60), color: 'chrome', background: `alpha ${Math.round(bg.a * 100)}%`, ratio: 1, where: where(el), line: `1:1 need chrome [chrome] "${(el.textContent ?? '').trim().slice(0, 50)}"  fill alpha ${Math.round(bg.a * 100)}%  ${where(el)}` });
  }
  const judge = (el, text, kind) => {
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') return;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    // Words only a screen reader gets (`sr-only`, a 1px clipped box) draw nothing, so there is no contrast to judge.
    if (rect.width <= 1 && rect.height <= 1 && cs.overflow === 'hidden') return;
    const op = opacityOf(el);
    if (op === 0) return;
    const colorCss = kind === 'placeholder' ? getComputedStyle(el, '::placeholder').color : el instanceof SVGElement ? cs.fill : cs.color;
    const fg0 = parse(colorCss);
    if (!fg0 || fg0.a === 0) return;
    const fg = { ...fg0, a: fg0.a * op };
    let { stack, images } = stackOf(el);
    // Text drawn inside a chart sits on the shapes under it, not on a CSS background: bring it into view and read the shape beneath.
    if (el instanceof SVGElement && typeof document.elementsFromPoint === 'function') {
      el.scrollIntoView({ block: 'center', inline: 'center' });
      const r2 = el.getBoundingClientRect();
      for (const u of document.elementsFromPoint(r2.left + r2.width / 2, r2.top + r2.height / 2)) {
        if (u === el || u.contains(el) || !(u instanceof SVGGeometryElement)) continue;
        const ucs = getComputedStyle(u);
        const f = parse(ucs.fill);
        if (f && f.a > 0) {
          stack = over({ ...f, a: f.a * Number(ucs.fillOpacity) * Number(ucs.opacity) }, stack);
          break;
        }
      }
    }
    const disabled = el.matches(':disabled') || el.closest('[aria-disabled="true"], :disabled, fieldset:disabled') !== null;
    const large = isLarge(el, cs);
    const need = disabled ? AA_LARGE : large ? AA_LARGE : AA;
    const w = worst(fg, el, stack, rect);
    if (w.ratio < need) {
      const r = Math.round(w.ratio * 100) / 100;
      const k = disabled ? 'disabled' : kind;
      const size = `${Math.round(sizeOf(el, cs))}px/${cs.fontWeight}`;
      const bgHex = hex(w.bg) + (images ? ' (over an image)' : '');
      // shoot.mjs prints `line` as it is: the ratio, what was needed, the kind, the size, the words, the colour pair and where.
      hits.push({ text: text.slice(0, 60), color: hex(w.fg), background: bgHex, ratio: r, need, kind: k, size, where: where(el), line: `${r}:1 need ${need} [${k}] ${size} "${text.slice(0, 50)}"  ${hex(w.fg)} on ${bgHex}  ${where(el)}` });
    }
  };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim();
    // Emoji and symbols draw in their own colours, so only text with letters or digits is judged.
    if (!text || !/[\p{L}\p{N}]/u.test(text)) continue;
    const el = node.parentElement;
    if (!el || seen.has(el) || el.closest('script, style, noscript, title, desc')) continue;
    seen.add(el);
    judge(el, text, 'text');
  }
  // Placeholders count: they are drawn by the field, not by a text node.
  for (const el of document.querySelectorAll('input[placeholder], textarea[placeholder]')) {
    if (el.value) continue;
    if (el instanceof HTMLInputElement && ['checkbox', 'radio', 'range', 'color', 'file', 'hidden'].includes(el.type)) continue;
    judge(el, el.getAttribute('placeholder') ?? '', 'placeholder');
  }
  return hits;
})()
