// A probeFile for shoot.mjs (SHOOT_PROBE=scripts/smoke/contrast-probe.js).
// Evaluated in the page: walks every visible text node, composites its colour onto the real
// background behind it (walking up through translucent layers), and returns everything under 2.2:1.
// The only accepted hits in this app are white captions on the green fill and greyed unearned badges.
(() => {
  const LIMIT = 2.2;
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
  // Background behind an element: its own background colour over everything above it, until opaque.
  const backgroundOf = (el) => {
    let acc = { r: 0, g: 0, b: 0, a: 0 };
    let images = false;
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      const bg = parse(cs.backgroundColor);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') images = true;
      if (bg && bg.a > 0) {
        acc = over(acc, bg);
        if (acc.a >= 0.999) return { color: acc, images };
      }
      if (e === document.documentElement) break;
    }
    // The paper colour sits on html in this app (body is transparent), so read both before falling back to white.
    const paper = [getComputedStyle(document.documentElement).backgroundColor, getComputedStyle(document.body).backgroundColor].map(parse).find((c) => c && c.a > 0) ?? { r: 255, g: 255, b: 255, a: 1 };
    return { color: over(acc, paper), images };
  };
  const hits = [];
  const seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim();
    // Emoji and symbols draw in their own colours, so only text with letters or digits is judged.
    if (!text || !/[\p{L}\p{N}]/u.test(text)) continue;
    const el = node.parentElement;
    if (!el || seen.has(el)) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    const fg = parse(cs.color);
    if (!fg || fg.a === 0) continue;
    const { color: bg, images } = backgroundOf(el);
    const fgOnBg = fg.a < 1 ? over(fg, bg) : fg;
    const r = ratio(fgOnBg, bg);
    if (r < LIMIT) {
      seen.add(el);
      hits.push({ text: text.slice(0, 60), color: hex(fgOnBg), background: hex(bg) + (images ? ' (over an image)' : ''), ratio: Math.round(r * 100) / 100, where: where(el) });
    }
  }
  return hits;
})()
