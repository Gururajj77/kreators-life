// A probeFile for shoot.mjs (SHOOT_PROBE=scripts/smoke/lone-probe.js).
// Finds a wrapping row of pills, chips or buttons whose last line holds one item alone while the line above holds several:
// the "lone tile" rule in CLAUDE.md, for rows of controls. Each hit is { line }.
// A TabRow's sideways line (`data-pinned-scroll`, 2026-11-07) is one line by design, so it can never leave a pill alone: it is skipped,
// and so is the row that holds it (the strip and its pinned All share one line).
(() => {
  const hits = [];
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
  for (const row of document.querySelectorAll('body *')) {
    if (hits.length > 40) break;
    if (row.matches('[data-pinned-scroll]') || row.querySelector(':scope > [data-pinned-scroll]')) continue;
    const cs = getComputedStyle(row);
    if (cs.display !== 'flex' && cs.display !== 'inline-flex') continue;
    if (cs.flexWrap !== 'wrap' || cs.flexDirection.startsWith('column')) continue;
    const kids = [...row.children].filter((k) => {
      const s = getComputedStyle(k);
      const r = k.getBoundingClientRect();
      return s.display !== 'none' && s.position !== 'absolute' && s.position !== 'fixed' && r.width > 0 && r.height > 0;
    });
    if (kids.length < 3) continue;
    // Only rows of small things: pills, chips, buttons, short links.
    if (kids.some((k) => k.getBoundingClientRect().height > 72)) continue;
    // Items share a line when their boxes overlap vertically (a small label centred beside taller pills is on their line).
    const lines = [];
    for (const k of kids) {
      const r = k.getBoundingClientRect();
      const line = lines.find((l) => Math.min(l.bottom, r.bottom) - Math.max(l.top, r.top) > Math.min(l.bottom - l.top, r.height) / 2);
      if (line) {
        line.n += 1;
        line.top = Math.min(line.top, r.top);
        line.bottom = Math.max(line.bottom, r.bottom);
      } else lines.push({ top: r.top, bottom: r.bottom, n: 1, width: r.width, text: (k.textContent ?? '').trim().slice(0, 24) });
    }
    if (lines.length < 2) continue;
    lines.sort((a, b) => a.top - b.top);
    const last = lines[lines.length - 1];
    const before = lines[lines.length - 2];
    // A last item that fills the row (a full-width button under a card's text) is a stacked layout, not a pill left alone.
    const inner = row.getBoundingClientRect().width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    if (last.n === 1 && last.width >= inner * 0.85) continue;
    if (last.n === 1 && before.n >= 2) hits.push({ line: `${where(row)}: ${lines.map((l) => l.n).join('+')} items per line, "${last.text}" alone on the last line` });
  }
  return hits;
})()
