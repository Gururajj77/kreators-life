// A probeFile for shoot.mjs (SHOOT_PROBE=scripts/smoke/cut-probe.js).
// Finds a one-line row of tabs or filter pills that scrolls sideways or has a pill cut at its right edge (or the screen's).
// Such a row should be a components/TabRow.tsx (as many as fit, every tab in the All list). Rows of cards (StageBar, kanban lanes,
// media, badge cards, the activity grid) are left alone: only rows of small controls (buttons, links, pills up to 72px tall) count.
// Run it at 360 and 390 wide; it must report 0. Each hit is { line }.
(() => {
  const hits = [];
  const vw = document.documentElement.clientWidth;
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
  const control = (k) => k.matches('button, a[href], [role="button"], [aria-pressed]') || (k.children.length === 1 && k.firstElementChild.matches('button, a[href]'));
  /** The right edge things are clipped at: the screen, or the nearest ancestor that clips or scrolls sideways. */
  const clipRight = (el) => {
    let right = vw;
    for (let e = el.parentElement; e && e !== document.documentElement; e = e.parentElement) {
      const ox = getComputedStyle(e).overflowX;
      if (ox !== 'visible') right = Math.min(right, e.getBoundingClientRect().right);
    }
    return right;
  };
  for (const row of document.querySelectorAll('body *')) {
    if (hits.length > 40) break;
    if (row.closest('[aria-hidden="true"], .act-scroll, .fx-marquee, .legal-doc, .print-doc, table')) continue;
    const cs = getComputedStyle(row);
    if (cs.display !== 'flex' && cs.display !== 'inline-flex') continue;
    if (cs.flexWrap !== 'nowrap' || cs.flexDirection.startsWith('column')) continue;
    const rr = row.getBoundingClientRect();
    if (rr.width === 0 || rr.height === 0 || cs.visibility === 'hidden') continue;
    const kids = [...row.children].filter((k) => {
      const s = getComputedStyle(k);
      const r = k.getBoundingClientRect();
      return s.display !== 'none' && s.position !== 'absolute' && s.position !== 'fixed' && r.width > 0 && r.height > 0;
    });
    if (kids.length < 3) continue;
    if (kids.some((k) => k.getBoundingClientRect().height > 72)) continue;
    if (kids.filter(control).length < 3) continue;
    const scrolls = row.scrollWidth > row.clientWidth + 1 && getComputedStyle(row).overflowX !== 'visible';
    const edge = Math.min(clipRight(row), scrolls ? rr.right : Infinity);
    const cut = kids.find((k) => k.getBoundingClientRect().right > edge + 1);
    if (scrolls || cut) hits.push({ line: `${where(row)}: ${scrolls ? 'scrolls sideways' : 'cut'}${cut ? `, "${(cut.textContent ?? '').trim().slice(0, 24)}" past the edge` : ''}` });
  }
  return hits;
})()
