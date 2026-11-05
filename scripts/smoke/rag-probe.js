// A probeFile for shoot.mjs (SHOOT_PROBE=scripts/smoke/rag-probe.js).
// Every block of text should read as a rectangle (the founder, 2026-11-05): no line noticeably shorter than the line above it.
// Lines about equal, lines that grow going down, and a line broken on purpose after a comma or a full stop are all fine.
// A block is any element that shows as a block, list item or flex item, holds its own text and holds no other block (as in
// orphan-probe.js); a child that holds no text, an svg or picture, and anything taken out of the flow (absolute or fixed, which a
// screen-reader-only label is) does not count as a block, and its words are not measured. The text straight inside a flex or grid
// box (an anonymous item, such as a checkbox label's words) is measured as a block of its own. Each line's width is measured from
// its words' Range rects; a hit is a line under 80% of the widest line above it since the last break made on purpose (so a slow
// taper, each step just over 80%, is caught too): a <br> or the end of an inline-block after a comma, full stop, semicolon, colon,
// question or exclamation mark, or a new line the writer typed in text that keeps them. A paragraph's ordinary last line is never
// let off for ending in a full stop. Printed paper that must match the founder's PDF line for line, anything editable, code and
// hidden or screen-reader-only text are left out. Each hit is { line }. lib/rectText.ts fixes by the same rule.
(() => {
  const RATIO = 0.8;
  const hits = [];
  const seen = new Set();
  const isBlock = (cs) => /^(block|list-item|flow-root|-webkit-box|table-cell)$/.test(cs.display);
  const isBox = (cs) => /^(flex|inline-flex|grid|inline-grid)$/.test(cs.display);
  const SKIP = '.legal-doc, .legal-root, .legal-invoice, .print-doc, .month-print-sheet, [contenteditable]:not([contenteditable="false"]), pre, code, svg, .sr-only, input, textarea, select, script, style, template';
  const ENDS = /[,.;:?!…][”’"')\]]*$/;
  const where = (el) => {
    const cls = (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean).slice(0, 2).join('.');
    return `${el.tagName.toLowerCase()}${cls ? `.${cls}` : ''}`;
  };
  /** Out of the flow: its words sit somewhere else and never share the block's lines. */
  const aside = (cs) => cs.position === 'absolute' || cs.position === 'fixed';
  /** A child that does not make its parent "not a block of text": no words, a picture, or out of the flow. */
  const quiet = (d, cs) => d.closest('svg') || d.tagName === 'IMG' || d.tagName === 'svg' || aside(cs) || !/\S/.test(d.textContent ?? '');
  const range = document.createRange();
  for (const el of document.querySelectorAll('body *')) {
    if (hits.length >= 120) break;
    if (el.closest(SKIP)) continue;
    const cs = getComputedStyle(el);
    const box = isBox(cs);
    if (!(isBlock(cs) || box) || cs.visibility === 'hidden' || cs.whiteSpace === 'nowrap' || cs.whiteSpace === 'pre' || cs.webkitLineClamp !== 'none' && cs.webkitLineClamp !== '') continue;
    // The text nodes measured: a flex or grid box's own, else every one inside the block but those out of the flow.
    const nodes = [];
    if (box) {
      for (const c of el.childNodes) if (c.nodeType === 3 && /\S/.test(c.data)) nodes.push(c);
      if (!nodes.length) continue;
    } else {
      let hasBlock = false;
      const out = [];
      for (const d of el.querySelectorAll('*')) {
        const dcs = getComputedStyle(d);
        if (out.some((o) => o.contains(d))) continue;
        if (aside(dcs)) {
          out.push(d);
          continue;
        }
        if ((isBlock(dcs) || isBox(dcs)) && !quiet(d, dcs)) {
          hasBlock = true;
          break;
        }
      }
      if (hasBlock) continue;
      const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
      for (let n = walk.nextNode(); n; n = walk.nextNode()) if (!out.some((o) => o.contains(n))) nodes.push(n);
    }
    const rect = el.getBoundingClientRect();
    if (rect.width < 4 || rect.height < 4) continue;
    const text = (box ? nodes.map((n) => n.data).join(' ') : (el.textContent ?? '')).replace(/\s+/g, ' ').trim();
    if (text.split(' ').length < 3) continue;
    const keepsNewLines = /^(pre-wrap|pre-line|break-spaces)$/.test(cs.whiteSpace);
    // Lines in reading order: a rect joins the current line when its middle sits inside it.
    const lines = [];
    let cur = null;
    const add = (r, word, node) => {
      const mid = (r.top + r.bottom) / 2;
      if (cur && mid >= cur.top - 1 && mid <= cur.bottom + 1) {
        cur.left = Math.min(cur.left, r.left);
        cur.right = Math.max(cur.right, r.right);
        cur.top = Math.min(cur.top, r.top);
        cur.bottom = Math.max(cur.bottom, r.bottom);
      } else {
        cur = { left: r.left, right: r.right, top: r.top, bottom: r.bottom, last: '', node: null, hard: false, typed: false };
        lines.push(cur);
      }
      cur.last = word;
      cur.node = node;
    };
    for (const n of nodes) {
      if (n.nodeType === 1) {
        if (n.tagName === 'BR' && cur) cur.hard = true;
        continue;
      }
      if (n.parentElement?.closest(SKIP)) continue;
      const t = n.data;
      const re = /\S+/g;
      let m;
      let prevEnd = 0;
      while ((m = re.exec(t))) {
        if (keepsNewLines && cur && t.slice(prevEnd, m.index).includes('\n')) {
          cur.hard = true;
          cur.typed = true;
        }
        prevEnd = m.index + m[0].length;
        range.setStart(n, m.index);
        range.setEnd(n, prevEnd);
        for (const r of range.getClientRects()) if (r.width > 0 && r.height > 0) add(r, m[0], n);
      }
    }
    if (lines.length < 2) continue;
    // A line ending at the end of an inline-block (a phrase kept whole on purpose) ends on purpose too.
    for (const line of lines) {
      if (line.hard || !line.node) continue;
      for (let e = line.node.parentElement; e && e !== el; e = e.parentElement) {
        const d = getComputedStyle(e).display;
        if (d === 'inline-block' || d === 'inline-flex') {
          const rest = document.createRange();
          rest.setStart(line.node, line.node.data.length);
          rest.setEnd(e, e.childNodes.length);
          if (!/\S/.test(rest.toString())) line.hard = true;
          break;
        }
      }
    }
    const widths = lines.map((l) => Math.round(l.right - l.left));
    // The widest line since the last break made on purpose: a line after such a break starts the count again.
    let widest = widths[0];
    for (let i = 1; i < lines.length; i += 1) {
      const above = lines[i - 1];
      if (above.hard && (above.typed || ENDS.test(above.last))) {
        widest = widths[i];
        continue;
      }
      if (widths[i] >= widest * RATIO) {
        widest = Math.max(widest, widths[i]);
        continue;
      }
      const key = `${where(el)}|${text.slice(0, 30)}`;
      if (seen.has(key)) break;
      seen.add(key);
      hits.push({ line: `${where(el)}: line ${i + 1} of ${lines.length} is ${Math.round((widths[i] / widest) * 100)}% of the widest above it (${widths.join(', ')}px) "${text.slice(0, 60)}"` });
      break;
    }
  }
  return hits;
})();
