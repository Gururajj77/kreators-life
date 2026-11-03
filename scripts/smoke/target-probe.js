// A probeFile for shoot.mjs (SHOOT_PROBE=.../target-probe.js).
// Evaluated in the page: lists every tappable control (button, link, input, select, textarea, role=button/switch/tab/checkbox/
// radio/slider/link/menuitem, summary) whose box is smaller than 44 by 44 CSS px (Apple HIG minimum hit target).
// Left out: inline text links inside running text, controls inside a bigger tappable label or control (the bigger one is the
// target), hidden, disabled, aria-hidden and off-layout controls. Each hit is { line }. The first line is a summary.
(() => {
  const MIN = 44;
  const sel = 'button, a[href], input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="switch"], [role="tab"], [role="checkbox"], [role="radio"], [role="slider"], [role="link"], [role="menuitem"], [tabindex]:not([tabindex="-1"])';
  const where = (el) => {
    const parts = [];
    let e = el;
    for (let i = 0; e && e !== document.body && i < 3; i += 1) {
      const cls = (e.getAttribute('class') ?? '').split(/\s+/).filter(Boolean).slice(0, 2).join('.');
      parts.unshift(`${e.tagName.toLowerCase()}${cls ? `.${cls}` : ''}`);
      e = e.parentElement;
    }
    return parts.join(' > ');
  };
  const label = (el) =>
    (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || el.getAttribute('placeholder') || el.getAttribute('name') || el.type || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 40);
  const shown = (el) => {
    if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
    if (el.closest('[aria-hidden="true"], [inert]')) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  // An inline link inside a run of text (a sentence) is exempt, like WCAG 2.5.8's inline exception.
  const inlineText = (el) => {
    if (el.tagName !== 'A') return false;
    const cs = getComputedStyle(el);
    if (!/^inline$/.test(cs.display)) return false;
    const p = el.parentElement;
    if (!p) return false;
    const own = [...p.childNodes].filter((n) => n !== el).map((n) => n.textContent ?? '').join('').trim();
    return own.length >= 12;
  };
  const big = (r) => r.width >= MIN && r.height >= MIN;
  const hits = [];
  const seen = new Set();
  let total = 0;
  for (const el of document.querySelectorAll(sel)) {
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') continue;
    if (!shown(el)) continue;
    const r = el.getBoundingClientRect();
    if (big(r)) continue;
    if (inlineText(el)) continue;
    // A control wrapped by a larger tappable thing (a label, a button, a link) borrows its size.
    let wrapped = false;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      if (p.matches('label, button, a[href], [role="button"], [role="switch"], [role="checkbox"]')) {
        if (big(p.getBoundingClientRect())) wrapped = true;
        break;
      }
    }
    if (wrapped) continue;
    // An input with an associated label that is big enough is fine (checkbox and radio in a row).
    if (el.labels && [...el.labels].some((l) => big(l.getBoundingClientRect()))) continue;
    total += 1;
    const key = `${where(el)}|${label(el)}|${Math.round(r.width)}x${Math.round(r.height)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (hits.length < 40) hits.push({ line: `${Math.round(r.width)}x${Math.round(r.height)} ${el.tagName.toLowerCase()}${el.getAttribute('role') ? `[role=${el.getAttribute('role')}]` : ''} "${label(el)}"  ${where(el)}` });
  }
  if (total) hits.unshift({ line: `SUMMARY ${total} small targets (${seen.size} distinct)` });
  return hits;
})();
