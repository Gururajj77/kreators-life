// A probeFile for shoot.mjs (SHOOT_PROBE=scripts/smoke/height-probe.js).
// Evaluated in the page: finds rows of sibling cards (same top edge, at least two) whose heights differ, which is the
// "pairs are one height" rule from CLAUDE.md. A cell that is stretched by its grid or flex row but holds a card that is
// shorter than the cell counts too (the card is what the eye sees). Each hit is { line }.
(() => {
  const hits = [];
  const seen = new Set();
  const where = (el) => {
    const parts = [];
    let e = el;
    for (let i = 0; e && e !== document.body && i < 3; i += 1) {
      const cls = (e.getAttribute('class') ?? '').split(/\s+/).filter(Boolean).slice(0, 3).join('.');
      parts.unshift(`${e.tagName.toLowerCase()}${e.id ? `#${e.id}` : ''}${cls ? `.${cls}` : ''}`);
      e = e.parentElement;
    }
    return parts.join(' > ');
  };
  const visible = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed' || cs.position === 'absolute') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  // A box that looks like a card: rounded and either filled or outlined.
  const cardLike = (el) => {
    const cs = getComputedStyle(el);
    const m = cs.backgroundColor.match(/rgba?\(([^)]+)\)/);
    let alpha = 0;
    if (m) {
      const p = m[1].split(',').map(parseFloat);
      alpha = p.length > 3 ? p[3] : 1;
    }
    const filled = alpha > 0.05 || cs.backgroundImage !== 'none';
    const outlined = parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== 'none';
    return parseFloat(cs.borderTopLeftRadius) >= 12 && (filled || outlined);
  };
  // The box the eye sees for a cell: the cell itself when it is a card, else the first card down its single-child chain.
  const visual = (cell) => {
    let e = cell;
    for (let i = 0; e && i < 4; i += 1) {
      if (cardLike(e)) return e;
      const kids = [...e.children].filter(visible);
      if (kids.length !== 1) return null;
      e = kids[0];
    }
    return null;
  };
  for (const parent of document.querySelectorAll('body *')) {
    if (hits.length > 30) break;
    if (!visible(parent)) continue;
    const cs = getComputedStyle(parent);
    if (cs.display !== 'grid' && cs.display !== 'flex' && cs.display !== 'inline-grid') continue;
    const cells = [...parent.children].filter(visible);
    if (cells.length < 2) continue;
    const boxes = cells.map((c) => visual(c)).filter(Boolean);
    if (boxes.length < 2) continue;
    // Group by top edge: the boxes in one visual row.
    const rows = [];
    for (const b of boxes) {
      const r = b.getBoundingClientRect();
      if (r.height < 56 || r.width < 72) continue;
      // A feature cell that spans several grid rows is meant to be taller (the bento's biggest cell).
      let spans = false;
      for (let e = b; e && e !== parent.parentElement; e = e.parentElement) if (/span/.test(getComputedStyle(e).gridRowEnd) || /span/.test(getComputedStyle(e).gridRowStart)) spans = true;
      if (spans) continue;
      const row = rows.find((x) => Math.abs(x.top - r.top) <= 3);
      if (row) row.items.push({ b, r });
      else rows.push({ top: r.top, items: [{ b, r }] });
    }
    for (const row of rows) {
      if (row.items.length < 2) continue;
      const hs = row.items.map((i) => Math.round(i.r.height));
      if (Math.max(...hs) - Math.min(...hs) <= 2) continue;
      const key = where(parent);
      if (seen.has(key)) continue;
      seen.add(key);
      hits.push({ line: `${key}: card heights ${hs.join(', ')}px at ${Math.round(row.top + window.scrollY)}` });
    }
  }
  return hits;
})()
