// A probeFile for shoot.mjs (SHOOT_PROBE=scripts/smoke/orphan-probe.js).
// Evaluated in the page: lists every block of text that wraps onto more than one line and ends on a single word (an orphan).
// A block is any element that shows as a block, list item or flex item, holds its own text and holds no other block. A single word
// alone on the last line is the target; a block of one line, or a last line of two words or more, is fine. Each hit is { line }.
(() => {
  const hits = [];
  const seen = new Set();
  const isBlock = (cs) => /^(block|list-item|flow-root|-webkit-box|table-cell)$/.test(cs.display);
  const where = (el) => {
    const cls = (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean).slice(0, 2).join('.');
    return `${el.tagName.toLowerCase()}${cls ? `.${cls}` : ''}`;
  };
  const all = [...document.querySelectorAll('body *')];
  for (const el of all) {
    if (hits.length >= 80) break;
    if (['SCRIPT', 'STYLE', 'SVG', 'PATH', 'INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(el.tagName.toUpperCase())) continue;
    const cs = getComputedStyle(el);
    if (!isBlock(cs) || cs.visibility === 'hidden' || cs.whiteSpace === 'nowrap' || cs.whiteSpace === 'pre') continue;
    // No block inside it: otherwise its children are measured on their own.
    let hasBlock = false;
    for (const d of el.querySelectorAll('*')) {
      if (isBlock(getComputedStyle(d))) {
        hasBlock = true;
        break;
      }
    }
    if (hasBlock) continue;
    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (text.length < 24) continue;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const lines = new Map();
    let node;
    while ((node = walker.nextNode())) {
      const t = node.textContent ?? '';
      const re = /\S+/g;
      let m;
      while ((m = re.exec(t))) {
        const range = document.createRange();
        range.setStart(node, m.index);
        range.setEnd(node, m.index + m[0].length);
        const rects = range.getClientRects();
        if (!rects.length) continue;
        const top = Math.round(rects[0].top / 4) * 4;
        lines.set(top, (lines.get(top) ?? []).concat(m[0]));
      }
    }
    const tops = [...lines.keys()].sort((a, b) => a - b);
    if (tops.length < 2) continue;
    const last = lines.get(tops[tops.length - 1]);
    if (last.length === 1) {
      const key = `${where(el)}|${text.slice(0, 30)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      hits.push({ line: `${where(el)}: ends alone on "${last[0]}" (${tops.length} lines) "${text.slice(0, 50)}"` });
    }
  }
  return hits;
})();
