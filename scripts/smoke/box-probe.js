// A probeFile for shoot.mjs (SHOOT_PROBE=scripts/smoke/box-probe.js).
// Finds a control that draws a box (a shadow, a fill or an edge) with square corners: the mistake of putting `toy` (the button
// shadow) on a text link, or a fill on something never meant to have one. A drawn control in this app always has rounded corners.
// Documents (.legal-doc, .print-doc), tables and form fields are left out. Each hit is { line }.
(() => {
  const hits = [];
  const where = (el) => {
    const parts = [];
    let e = el;
    for (let i = 0; e && e !== document.body && i < 3; i += 1) {
      const cls = (e.getAttribute('class') ?? '').split(/\s+/).filter(Boolean).slice(0, 4).join('.');
      parts.unshift(`${e.tagName.toLowerCase()}${cls ? `.${cls}` : ''}`);
      e = e.parentElement;
    }
    return parts.join(' > ');
  };
  const alpha = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return c === 'transparent' ? 0 : 1;
    const p = m[1].split(/[ ,/]+/).filter(Boolean);
    return p.length > 3 ? Number(p[3]) : 1;
  };
  for (const el of document.querySelectorAll('a, button, [role="button"], .toy, summary')) {
    if (hits.length > 40) break;
    if (el.closest('.legal-doc, .print-doc, table, [aria-hidden="true"]')) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
    // A full-screen backdrop (a Sheet's scrim: fixed, inset 0, covering the viewport) is not a control with corners.
    if (cs.position === 'fixed' && r.left <= 1 && r.top <= 1 && r.width >= window.innerWidth - 2 && r.height >= window.innerHeight - 2) continue;
    const drawn = cs.boxShadow !== 'none' || alpha(cs.backgroundColor) > 0.02 || cs.backgroundImage !== 'none' || ['Top', 'Right', 'Bottom', 'Left'].some((s) => parseFloat(cs[`border${s}Width`]) > 0 && alpha(cs[`border${s}Color`]) > 0.05);
    if (!drawn) continue;
    const radii = ['TopLeft', 'TopRight', 'BottomLeft', 'BottomRight'].map((k) => parseFloat(cs[`border${k}Radius`]) || 0);
    if (radii.some((x) => x > 0)) continue;
    hits.push({ line: `${where(el)} "${(el.textContent ?? '').trim().slice(0, 40)}" ${Math.round(r.width)}x${Math.round(r.height)}` });
  }
  return hits;
})();
