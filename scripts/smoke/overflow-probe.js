// A probeFile for shoot.mjs (SHOOT_PROBE=scripts/smoke/overflow-probe.js).
// Evaluated in the page: says whether the page scrolls sideways, and lists every element that pokes
// past the screen's edges, unless an ancestor scrolls or clips it on purpose. Each hit is { line }.
(() => {
  const w = document.documentElement.clientWidth;
  const hits = [];
  const sw = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
  if (sw > w + 1) hits.push({ line: `page scrolls sideways: ${sw}px wide on a ${w}px screen` });
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
  const clipped = (el) => {
    let p = el.parentElement;
    while (p && p !== document.body) {
      const cs = getComputedStyle(p);
      if (/(auto|scroll|hidden|clip)/.test(cs.overflowX) || /(auto|scroll|hidden|clip)/.test(cs.overflow)) return true;
      p = p.parentElement;
    }
    return false;
  };
  const seen = new Set();
  for (const el of document.querySelectorAll('body *')) {
    if (hits.length > 20) break;
    const cs = getComputedStyle(el);
    if (cs.position === 'fixed' || cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right <= w + 1 && r.left >= -1) continue;
    if (clipped(el)) continue;
    const key = where(el);
    if (seen.has(key)) continue;
    seen.add(key);
    hits.push({ line: `${key}: ${Math.round(r.left)} to ${Math.round(r.right)} of ${w}px${el.textContent ? ` "${el.textContent.trim().slice(0, 40)}"` : ''}` });
  }
  return hits;
})()
